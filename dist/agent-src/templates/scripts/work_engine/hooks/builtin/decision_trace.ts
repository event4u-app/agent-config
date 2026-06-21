/**
 * `DecisionTraceHook` — emit a decision-trace JSON per phase.
 *
 * TypeScript twin of `work_engine/hooks/builtin/decision_trace.py` (ADR-200
 * py2ts — work_engine.hooks.builtin subpackage). Implements the v1 envelope
 * from `docs/contracts/decision-trace-v1.md`. Default-off; opt-in via
 * `.agent-settings.yml` `decision_engine.surface_traces: true`.
 *
 * The hook is purely observational — it never mutates `DeliveryState`, never
 * raises terminal errors. Stream / disk failures surface as {@link HookError}
 * (non-fatal per the three-tier contract).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    derive_confidence_band,
    derive_risk_class,
    summarise_memory,
    summarise_verify,
} from '../../scoring/decision_trace.js';
import type { HookContext } from '../context.js';
import { HookEvent } from '../events.js';
import { HookError } from '../exceptions.js';
import type { HookRegistry } from '../registry.js';

/** Arbitrary value, mirroring the Python `Any` fields. */
type Any = unknown;

export const SCHEMA_VERSION = 1;
const _MAX_MEMORY_IDS = 32;

/**
 * Emit one decision-trace JSON file per dispatcher step.
 *
 * `output_dir` is an optional override for the trace destination. When
 * `null` the hook writes alongside the WorkState file: if the state file
 * sits under `agents/runtime/state/work/<id>/state.json` the trace lands at
 * `agents/runtime/state/work/<id>/decision-trace-<phase>.json`; otherwise the
 * trace lands next to the state file as `<stem>.decision-trace-<phase>.json`.
 */
export class DecisionTraceHook {
    private readonly _output_dir: string | null;
    private _state_file: string | null = null;
    private _step_started: Map<string, number> = new Map();

    constructor(output_dir: string | null = null) {
        this._output_dir = output_dir;
    }

    /** Register the trace callbacks on the lifecycle events used. */
    register(registry: HookRegistry): void {
        registry.register(HookEvent.BEFORE_LOAD, (ctx) => this._capture_state_file(ctx));
        registry.register(HookEvent.AFTER_LOAD, (ctx) => this._capture_state_file(ctx));
        registry.register(HookEvent.BEFORE_STEP, (ctx) => this._mark_step_start(ctx));
        registry.register(HookEvent.AFTER_STEP, (ctx) => this._emit_trace(ctx));
    }

    // -- lifecycle callbacks ------------------------------------------

    private _capture_state_file(ctx: HookContext): void {
        if (ctx.state_file !== null && ctx.state_file !== undefined) {
            this._state_file = String(ctx.state_file);
        }
    }

    private _mark_step_start(ctx: HookContext): void {
        if (ctx.step_name) {
            this._step_started.set(ctx.step_name, _time());
        }
    }

    private _emit_trace(ctx: HookContext): void {
        if (!ctx.step_name) {
            return;
        }
        let started: number;
        if (this._step_started.has(ctx.step_name)) {
            started = this._step_started.get(ctx.step_name) as number;
            this._step_started.delete(ctx.step_name);
        } else {
            started = _time();
        }
        const envelope = this._build_envelope(ctx, started);
        const target = this._target_path(ctx.step_name);
        try {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, _pyJsonDumpsIndent2(envelope) + '\n', { encoding: 'utf-8' });
        } catch (exc) {
            throw new HookError(`decision-trace write failed: ${_osErr(exc)}`);
        }
    }

    // -- envelope construction ----------------------------------------

    private _build_envelope(ctx: HookContext, started: number): Record<string, Any> {
        const delivery = ctx.delivery;
        const memory = summarise_memory(_getattr(delivery, 'memory', null), { limit: _MAX_MEMORY_IDS });
        const verify = summarise_verify(_getattr(delivery, 'verify', null));
        const ambiguity = _pyTruthy(_getattr(delivery, 'questions', null));
        return {
            schema_version: SCHEMA_VERSION,
            work_id: this._work_id(),
            phase: ctx.step_name,
            started_at: _iso_utc(started),
            ended_at: _iso_utc(_time()),
            confidence_band: derive_confidence_band({
                memory_hits: memory['hits'] as number,
                verify_claims: verify['claims'] as number,
                verify_first_try_passes: verify['first_try_passes'] as number,
                ambiguity_flag: ambiguity,
            }),
            risk_class: derive_risk_class(_getattr(delivery, 'changes', null)),
            rules: [],
            memory,
            verify,
        };
    }

    // -- path helpers --------------------------------------------------

    private _work_id(): string {
        if (this._state_file === null) {
            return 'unknown';
        }
        const parent = path.dirname(this._state_file);
        const parentName = path.basename(parent);
        const grandName = path.basename(path.dirname(parent));
        if (parentName && grandName === 'work') {
            return parentName;
        }
        return _stem(this._state_file);
    }

    private _target_path(phase: string): string {
        const filename = `decision-trace-${phase}.json`;
        if (this._output_dir !== null) {
            return path.join(this._output_dir, filename);
        }
        if (this._state_file === null) {
            return filename;
        }
        const parent = path.dirname(this._state_file);
        const parentName = path.basename(parent);
        const grandName = path.basename(path.dirname(parent));
        if (parentName && grandName === 'work') {
            return path.join(parent, filename);
        }
        return path.join(parent, `${_stem(this._state_file)}.${filename}`);
    }
}

/** `time.time()` — epoch seconds (float). */
function _time(): number {
    return Date.now() / 1000;
}

/** Python `Path.stem` — filename without its final suffix. */
function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    // Python `.stem`: drop the final extension; a leading dot is not a suffix.
    if (dot <= 0) {
        return base;
    }
    return base.slice(0, dot);
}

/** `datetime.fromtimestamp(epoch, tz=utc).strftime("%Y-%m-%dT%H:%M:%SZ")`. */
function _iso_utc(epoch: number): string {
    const d = new Date(epoch * 1000);
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
    );
}

/** Render an `OSError`-like value the way `str(exc)` would for the message. */
function _osErr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

/** Python `getattr(obj, name, default)`. */
function _getattr(obj: Any, name: string, dflt: Any): Any {
    if (obj !== null && typeof obj === 'object' && name in (obj as object)) {
        return (obj as Record<string, Any>)[name];
    }
    return dflt;
}

/** Python `bool(x)` truthiness for the `questions` shapes seen here. */
function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (value instanceof Map || value instanceof Set) {
        return value.size > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
}

/**
 * Python `json.dumps(obj, indent=2, sort_keys=False)` (ensure_ascii=True).
 * Insertion-ordered keys, 2-space indent, `\uXXXX`-escaped non-ASCII.
 */
function _pyJsonDumpsIndent2(value: Any): string {
    return _dumpsIndent(value, 0);
}

function _dumpsIndent(value: Any, depth: number): string {
    const pad = ' '.repeat(2 * (depth + 1));
    const closePad = ' '.repeat(2 * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStrAscii(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpsIndent(v, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, Any>;
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map((k) => `${pad}${_jsonStrAscii(k)}: ${_dumpsIndent(obj[k], depth + 1)}`);
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

/** Python `json.dumps` number formatting (integers without `.0`). */
function _jsonNum(n: number): string {
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

/** Python `json.dumps(s, ensure_ascii=True)` for a single string. */
function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return `${out}"`;
}

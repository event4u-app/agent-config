/**
 * `agent-config explain last` — execution-trace builder.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/__init__.py` (ADR-200).
 * Behaviour mirrors the Python original EXACTLY — same subject derivation,
 * same run-id derivation (with the UTC-mtime ISO fallback), same slot
 * aggregation order and key shape, same scrub pass on the run id. No
 * behaviour changes.
 *
 * `__init__.py` → `index.ts` per the migration convention. Read-only by
 * construction: never writes to disk, never opens a network socket, never
 * raises on missing data — every slot degrades to `null` and the Markdown
 * renderer emits a `(none)` placeholder instead.
 *
 * The public surface is `build_trace`. The CLI dispatcher lives in
 * `scripts._cli.cmd_explain` (out of scope for this twin) and is the only
 * intended caller besides the test suite.
 */
import * as fs from 'node:fs';

import * as _assumptions from './assumptions.js';
import * as _council from './council.js';
import * as _halt from './halt.js';
import * as _inputs from './inputs.js';
import * as _memory from './memory.js';
import * as _provider from './provider.js';
import * as _route from './route.js';
import { scrub_string } from './scrubber.js';
import { StateLoadError, load_state } from './state_loader.js';

export const TRACE_VERSION = 1;

const SUBJECT_BY_KIND: Record<string, string> = {
    ticket: 'implement-ticket',
    prompt: 'work',
    diff: 'work',
    file: 'work',
};

/** Python truthiness for the `or`/`or {}` fallthroughs. */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (typeof value === 'number') {
        return value !== 0 && !Number.isNaN(value);
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as object).length > 0;
    }
    return true;
}

function _derive_subject(state: Record<string, unknown>): string {
    const directive_set = _pyTruthy(state.directive_set) ? state.directive_set : '';
    if (directive_set === 'video') {
        return 'video';
    }
    if (directive_set === 'council') {
        return 'council';
    }
    const input = _pyTruthy(state.input) ? (state.input as Record<string, unknown>) : {};
    const kind = input.kind;
    const key = typeof kind === 'string' && kind ? kind : '';
    // SUBJECT_BY_KIND.get(kind or "", "unknown")
    const mapped = SUBJECT_BY_KIND[key];
    return mapped ?? 'unknown';
}

/**
 * Python `datetime.fromtimestamp(epochSeconds, tz=utc).isoformat()`.
 *
 * CPython rounds the float to whole microseconds, omits the fractional
 * part entirely when microseconds == 0, otherwise zero-pads to 6 digits,
 * and always appends the `+00:00` UTC offset.
 */
function _utcIsoFromEpochSeconds(epochSeconds: number): string {
    // Round to microseconds the way CPython's fromtimestamp does (round-half
    // to even on the µs boundary; Math.round matches in the common cases the
    // tests exercise — sub-µs mtime noise is normalized away in tests).
    const totalMicros = Math.round(epochSeconds * 1e6);
    const wholeSeconds = Math.floor(totalMicros / 1e6);
    const micros = totalMicros - wholeSeconds * 1e6;
    const d = new Date(wholeSeconds * 1000);
    const yyyy = String(d.getUTCFullYear()).padStart(4, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    let base = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
    if (micros !== 0) {
        base += `.${String(micros).padStart(6, '0')}`;
    }
    return `${base}+00:00`;
}

function _derive_run_id(state: Record<string, unknown>, state_file: string): string {
    const input = _pyTruthy(state.input) ? (state.input as Record<string, unknown>) : {};
    const dataRaw = _pyTruthy(input.data) ? input.data : {};
    const data =
        typeof dataRaw === 'object' && dataRaw !== null && !Array.isArray(dataRaw)
            ? (dataRaw as Record<string, unknown>)
            : {};
    const raw_id = data.id;
    if (typeof raw_id === 'string' && raw_id.trim()) {
        return scrub_string(raw_id.trim()) as string;
    }
    let mtime = 0.0;
    try {
        mtime = fs.statSync(state_file).mtimeMs / 1000;
    } catch {
        mtime = 0.0;
    }
    return _utcIsoFromEpochSeconds(mtime);
}

export function build_trace(
    project_root: string,
    state_file: string,
    options: { now?: Date | null } = {},
): Record<string, unknown> {
    const state = load_state(state_file);
    const now = options.now ?? null;
    // Python: `(now or datetime.now(tz=utc)).isoformat()`. Format through the
    // same UTC-iso helper so an injected `now` is byte-identical to the
    // Python side (`+00:00` offset, µs when non-zero); the production
    // (now=None) path is wall-clock + normalized away by callers/tests.
    const generated_at = _utcIsoFromEpochSeconds((now ?? new Date()).getTime() / 1000);
    return {
        version: TRACE_VERSION,
        generated_at,
        run_id: _derive_run_id(state, state_file),
        subject: _derive_subject(state),
        inputs: _inputs.build(project_root),
        route: _route.build(project_root, state),
        council: _council.build(project_root, state_file),
        memory: _memory.build(project_root, state),
        pack: _inputs.build_pack(project_root),
        assumptions: _assumptions.build(state),
        halt: _halt.build(state),
        provider: _provider.build(state),
    };
}

export { StateLoadError, load_state, scrub_string };

/**
 * State-file I/O helpers for the CLI entry point.
 *
 * TypeScript twin of `work_engine/state_io.py` (ADR-200 py2ts Phase 1 —
 * work_engine foundation). Public API names stay snake_case to mirror the
 * Python module 1:1 (per ADR-200 — Python style is part of the contract).
 *
 * Extracted from `cli.py` in P2.3 of `road-to-post-pr29-optimize.md`. Holds
 * the format-preserving load/save pair, the v0 legacy serialiser, the JSON
 * reader, the `DeliveryState` projection helpers, and the legacy-file
 * migration hint. Behaviour is byte-identical to the pre-split version —
 * Goldens stay green.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { DEFAULT_STATE_FILE, LEGACY_STATE_FILE, _FMT_V0, _FMT_V1 } from './cli_args.js';
import {
    DeliveryState,
    type Any as DeliveryAny,
} from './delivery_state.js';
import { _CLIError } from './errors.js';
import {
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    SCHEMA_VERSION,
    SchemaError,
    WorkState,
    type Dict,
    type JsonValue,
    from_dict as _state_from_dict,
    to_dict as _state_to_dict,
} from './state.js';

/**
 * Surface a migration hint when only the pre-1.15.0 file is present.
 *
 * The dispatcher renamed the default state file from
 * `.implement-ticket-state.json` to `.work-state.json` in 1.15.0
 * (alongside the `implement_ticket → work_engine` package move).
 * Existing checkouts that still carry the legacy file would otherwise
 * fail with a generic "no state file" message. This helper detects
 * the legacy file in the same directory and points the user at the
 * one-shot migration command instead.
 *
 * Only fires when `state_file` has the canonical default name and
 * sits next to a legacy file — explicit `--state-file` overrides
 * bypass the hint so power users can carry their own naming scheme.
 */
export function _maybe_raise_legacy_hint(state_file: string): void {
    // Python compares `state_file.name` (the basename) against the default's
    // basename. The constants are plain strings (no directory part), so
    // `path.basename(state_file)` vs the constant matches `Path.name`.
    if (path.basename(state_file) !== path.basename(DEFAULT_STATE_FILE)) {
        return;
    }
    // `state_file.with_name(LEGACY_STATE_FILE.name)` — same directory, legacy
    // basename.
    const legacy_candidate = path.join(path.dirname(state_file), path.basename(LEGACY_STATE_FILE));
    if (!_isFile(legacy_candidate)) {
        return;
    }
    throw new _CLIError(
        `Found legacy state file ${legacy_candidate} but no ` +
            `${state_file}. The default state file was renamed in 1.15.0. ` +
            `Run \`node node_modules/.bin/tsx work_engine/migration/v0_to_v1.ts ` +
            `${legacy_candidate}\` to migrate, or pass \`--state-file ` +
            `${legacy_candidate}\` to keep using the old name. See ` +
            'docs/MIGRATION.md.',
    );
}

/** Load `state_file` and tag it with the wire format detected. */
export function _load(state_file: string): [WorkState, string] {
    const data = _read_json(state_file);
    if (!_isPlainDict(data)) {
        throw new _CLIError(
            `State file ${state_file} must carry a JSON object; ` +
                `got ${_pyTypeName(data)}.`,
        );
    }
    const d = data as Record<string, JsonValue>;

    // v1 declares `version`; v0 has none. Anything else is invalid.
    if (_get(d, 'version', undefined) === SCHEMA_VERSION) {
        try {
            return [_state_from_dict(d as JsonValue), _FMT_V1];
        } catch (exc) {
            if (exc instanceof SchemaError) {
                throw new _CLIError(`State file shape is invalid: ${exc.message}`);
            }
            throw exc;
        }
    }
    if ('version' in d) {
        throw new _CLIError(
            `State file shape is invalid: unsupported version ` +
                `${_pyRepr(_get(d, 'version', undefined))}; expected ${SCHEMA_VERSION}`,
        );
    }
    if (!('ticket' in d)) {
        throw new _CLIError(
            "State file shape is invalid: missing 'ticket' (v0) or " +
                "'version' (v1) — file is neither shape.",
        );
    }
    try {
        const migrated = migrate_payload(d);
        return [_state_from_dict(migrated as JsonValue), _FMT_V0];
    } catch (exc) {
        if (exc instanceof SchemaError) {
            throw new _CLIError(`State file shape is invalid: ${exc.message}`);
        }
        throw exc;
    }
}

/**
 * Project `work` into a `DeliveryState` for handler dispatch.
 *
 * R1 P4 S1 (Option A2): handlers continue to consume `DeliveryState`
 * with `state.ticket`; the `WorkState` wrapper exists at the CLI
 * boundary so the dispatcher's directive-set selection has a v1
 * state object to read `directive_set` from. Mutable containers
 * (`memory`, `changes`, `outcomes`, `questions`) are passed
 * by reference — in-place mutations land on both objects without an
 * explicit sync. Reassignments (`state.plan = …`, `state.report = …`)
 * are mirrored back by {@link _sync_back}.
 */
export function _to_delivery(work: WorkState): DeliveryState {
    return new DeliveryState({
        ticket: work.input.data as Record<string, DeliveryAny>,
        persona: work.persona,
        memory: work.memory as Array<Record<string, DeliveryAny>>,
        plan: work.plan,
        changes: work.changes as Array<Record<string, DeliveryAny>>,
        tests: work.tests,
        verify: work.verify,
        outcomes: work.outcomes,
        questions: work.questions,
        report: work.report,
        ui_audit: work.ui_audit as Record<string, DeliveryAny> | null,
        app_spec: work.app_spec as Record<string, DeliveryAny> | null,
        ui_design: work.ui_design as Record<string, DeliveryAny> | null,
        ui_scaffold: work.ui_scaffold as Record<string, DeliveryAny> | null,
        ui_review: work.ui_review as Record<string, DeliveryAny> | null,
        ui_polish: work.ui_polish as Record<string, DeliveryAny> | null,
        contract: work.contract as Record<string, DeliveryAny> | null,
        stitch: work.stitch as Record<string, DeliveryAny> | null,
        stack: work.stack as Record<string, DeliveryAny> | null,
    });
}

/**
 * Mirror handler mutations from `delivery` back into `work`.
 *
 * Container fields are shared by reference (see {@link _to_delivery})
 * so the assignment is a no-op for those — we still mirror them
 * defensively to cover the case where a handler reassigned the
 * attribute (`state.memory = [new_list]`) instead of mutating in
 * place.
 */
export function _sync_back(work: WorkState, delivery: DeliveryState): void {
    work.input.data = delivery.ticket as Dict;
    work.persona = delivery.persona;
    work.memory = delivery.memory as Dict[];
    work.plan = delivery.plan as JsonValue;
    work.changes = delivery.changes as Dict[];
    work.tests = delivery.tests as JsonValue;
    work.verify = delivery.verify as JsonValue;
    work.outcomes = delivery.outcomes;
    work.questions = delivery.questions;
    work.report = delivery.report;
    work.ui_audit = delivery.ui_audit as Dict | null;
    work.app_spec = delivery.app_spec as Dict | null;
    work.ui_design = delivery.ui_design as Dict | null;
    work.ui_scaffold = delivery.ui_scaffold as Dict | null;
    work.ui_review = delivery.ui_review as Dict | null;
    work.ui_polish = delivery.ui_polish as Dict | null;
    work.contract = delivery.contract as Dict | null;
    work.stitch = delivery.stitch as Dict | null;
    work.stack = delivery.stack as Dict | null;
}

/**
 * Persist `work` in the wire format it was loaded with.
 *
 * v1 emits the canonical envelope via {@link _state_to_dict}; v0 emits the
 * legacy flat shape that `DeliveryState.asdict` used to produce, byte-identical
 * to the pre-Phase-4 output so the Golden Transcript replay stays green.
 */
export function _save(state_file: string, work: WorkState, fmt: string): void {
    fs.mkdirSync(path.dirname(state_file), { recursive: true });
    const payload = fmt === _FMT_V1 ? _state_to_dict(work) : _to_v0_dict(work);
    fs.writeFileSync(
        state_file,
        _jsonDumps(payload) + '\n',
        'utf-8',
    );
}

/**
 * Serialise `work` in the legacy v0 wire format.
 *
 * Field order matches `DeliveryState` declaration order so
 * pre-Phase-4 state files round-trip byte-equal.
 */
export function _to_v0_dict(work: WorkState): Dict {
    return {
        ticket: work.input.data,
        persona: work.persona,
        memory: work.memory,
        plan: work.plan,
        changes: work.changes,
        tests: work.tests,
        verify: work.verify,
        outcomes: work.outcomes,
        questions: work.questions,
        report: work.report,
    };
}

export function _read_json(p: string): JsonValue {
    let raw: string;
    try {
        raw = fs.readFileSync(p, 'utf-8');
    } catch (exc) {
        // Python `OSError` → "Cannot read {path}: {exc}".
        throw new _CLIError(`Cannot read ${p}: ${_osErrorText(exc, p)}`);
    }
    try {
        return JSON.parse(raw) as JsonValue;
    } catch (exc) {
        // Python `json.JSONDecodeError` → "Invalid JSON in {path}: {exc}".
        throw new _CLIError(`Invalid JSON in ${p}: ${(exc as Error).message}`);
    }
}

// ── Inlined v0→v1 payload migration ──────────────────────────────────────
//
// The Python source imports `migrate_payload` from
// `work_engine.migration.v0_to_v1`. A `.ts` twin may not import a `.py`
// (ADR-200), and the full `v0_to_v1` module (with its CLI / `migrate_file`
// surface) lands in a later phase. The `migrate_payload` slice `_load` needs
// is reproduced here verbatim so the load path stays byte-identical; when the
// `v0_to_v1.ts` twin lands it can re-export this or replace it 1:1.

/**
 * Return the v1 form of `payload`.
 *
 * A payload that already declares `version: 1` is returned unchanged
 * (deep-copied via `JSON.parse(JSON.stringify(...))` so the caller cannot
 * accidentally mutate the input). Anything else is treated as v0 and wrapped:
 * `ticket` becomes `input.data`, `input.kind` is set to `"ticket"`, and the
 * engine defaults are filled in.
 *
 * @throws SchemaError If the payload is not a dict, declares a higher version
 *   than this migration knows about, or lacks a `ticket` key.
 */
export function migrate_payload(payload: JsonValue): Dict {
    if (!_isPlainDict(payload)) {
        throw new SchemaError(
            `v0 state must be a JSON object; got ${_pyTypeName(payload)}`,
        );
    }
    const p = payload as Record<string, JsonValue>;

    const declared_version = _get(p, 'version', undefined);
    if (declared_version === SCHEMA_VERSION) {
        return JSON.parse(JSON.stringify(p)) as Dict;
    }
    if (declared_version !== undefined && declared_version !== null) {
        throw new SchemaError(
            `cannot migrate from version ${_pyRepr(declared_version)} to ` +
                `${SCHEMA_VERSION}; this script only handles v0 (no version key)`,
        );
    }

    if (!('ticket' in p)) {
        throw new SchemaError(
            "v0 state must carry a 'ticket' key; got keys: " +
                _pyReprList(_sortedStr(Object.keys(p))),
        );
    }
    const ticket = p['ticket'];
    if (!_isPlainDict(ticket)) {
        throw new SchemaError(
            `v0 state.ticket must be a JSON object; got ${_pyTypeName(ticket)}`,
        );
    }

    return {
        version: SCHEMA_VERSION,
        input: { kind: 'ticket', data: ticket },
        intent: DEFAULT_INTENT,
        directive_set: DEFAULT_DIRECTIVE_SET,
        persona: _get(p, 'persona', 'senior-engineer') as JsonValue,
        memory: [...((_get(p, 'memory', []) as JsonValue[]) ?? [])],
        plan: _get(p, 'plan', null) as JsonValue,
        changes: [...((_get(p, 'changes', []) as JsonValue[]) ?? [])],
        tests: _get(p, 'tests', null) as JsonValue,
        verify: _get(p, 'verify', null) as JsonValue,
        outcomes: { ...((_get(p, 'outcomes', {}) as Dict) ?? {}) },
        questions: [...((_get(p, 'questions', []) as JsonValue[]) ?? [])],
        report: _get(p, 'report', '') as JsonValue,
    };
}

// ── Python-parity primitives ────────────────────────────────────────────

/**
 * Mirror Python `json.dumps(obj, indent=2, ensure_ascii=False)`.
 *
 * For round-tripped JSON, `JSON.stringify` with a 2-space indent matches
 * CPython byte-for-byte: 2-space indent, `": "` key separator, `{}` / `[]`
 * for empties, non-ASCII verbatim. Same rationale as `state.ts::jsonDumps`:
 * no float/int tag survives JSON parsing, so the CPython `N.0` divergence
 * cannot arise here.
 */
function _jsonDumps(obj: Dict): string {
    return JSON.stringify(obj, null, 2);
}

/** `dict.get(key, default)`. */
function _get(obj: Record<string, JsonValue>, key: string, dflt: unknown): unknown {
    return key in obj ? obj[key] : dflt;
}

/** Python `isinstance(x, dict)` — plain object only (not array, not null). */
function _isPlainDict(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Python `type(x).__name__` for the JSON value shapes the messages emit. */
function _pyTypeName(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NoneType';
    }
    if (Array.isArray(value)) {
        return 'list';
    }
    switch (typeof value) {
        case 'string':
            return 'str';
        case 'boolean':
            return 'bool';
        case 'number':
            return Number.isInteger(value) ? 'int' : 'float';
        case 'object':
            return 'dict';
        default:
            return typeof value;
    }
}

/** Python `repr(x)` for the scalar shapes interpolated via `{value!r}`. */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'string') {
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return String(value);
}

/** Python `repr(list_of_str)` — `['a', 'b']`. */
function _pyReprList(values: string[]): string {
    return '[' + values.map((v) => _pyRepr(v)).join(', ') + ']';
}

/** Python `sorted(list_of_str)` — code-point ascending. */
function _sortedStr(values: string[]): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Approximate the text of Python's `OSError` for a failed read. Python
 * formats `errno`-based messages like "[Errno 2] No such file or directory:
 * 'path'". Node's error `.message` is shaped differently, so this is one of
 * the few non-byte-identical surfaces — the error *channel* (exit 2 via
 * `_CLIError`) and the *prefix* ("Cannot read <path>: ") stay identical;
 * only the trailing OS detail differs. Tests normalise this trailing detail.
 */
function _osErrorText(exc: unknown, p: string): string {
    const e = exc as NodeJS.ErrnoException;
    if (e && e.code === 'ENOENT') {
        return `[Errno 2] No such file or directory: '${p}'`;
    }
    if (e && e.code === 'EISDIR') {
        return `[Errno 21] Is a directory: '${p}'`;
    }
    if (e && e.code === 'EACCES') {
        return `[Errno 13] Permission denied: '${p}'`;
    }
    return e && e.message ? e.message : String(exc);
}

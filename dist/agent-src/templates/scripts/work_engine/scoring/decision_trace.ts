/**
 * Confidence-band + risk-class heuristics for decision-trace v1.
 *
 * TypeScript twin of `work_engine/scoring/decision_trace.py` (ADR-094 py2ts
 * Phase 1 — work_engine scoring subpackage). Public API names stay snake_case
 * to mirror the Python module 1:1 (per ADR-094 — Python style is part of the
 * contract).
 *
 * These heuristics back the JSON envelope emitted by
 * `work_engine.hooks.builtin.DecisionTraceHook`. They live here
 * (under `scoring/`) so the rules and the hook share a single source
 * of truth, and so unit tests can exercise the heuristics without
 * spinning up a dispatcher.
 *
 * Confidence-band heuristic (per
 * `docs/contracts/decision-trace-v1.md`):
 *
 * - `high`   — `memory.hits >= 2` AND
 *   `verify.first_try_passes == verify.claims` AND no ambiguity flag.
 * - `medium` — `memory.hits >= 1` OR `verify.first_try_passes >= 1`.
 * - `low`    — otherwise.
 *
 * Edge case: `verify.claims == 0` is **not** `high` by default; it
 * folds into `medium` if at least one memory hit landed, `low`
 * otherwise.
 *
 * Risk-class heuristic: maximum risk across the files the phase
 * touched. With no file-ownership matrix wired in yet, the
 * implementation defaults to `low` and exposes a `files` argument
 * so a future hook can pass concrete paths. If the phase touched any
 * files at all the heuristic returns `medium` so reviewers stay
 * nudged toward a closer look until the matrix lands.
 */

/** Arbitrary JSON-ish value, mirroring the Python `Any` fields. */
export type Any = unknown;

export const BAND_HIGH = 'high';
export const BAND_MEDIUM = 'medium';
export const BAND_LOW = 'low';

export const RISK_HIGH = 'high';
export const RISK_MEDIUM = 'medium';
export const RISK_LOW = 'low';

/** Return `high` / `medium` / `low` per the v1 heuristic. */
export function derive_confidence_band(args: {
    memory_hits: number;
    verify_claims: number;
    verify_first_try_passes: number;
    ambiguity_flag: boolean;
}): string {
    const { memory_hits, verify_claims, verify_first_try_passes, ambiguity_flag } = args;
    if (
        memory_hits >= 2 &&
        verify_claims > 0 &&
        verify_first_try_passes === verify_claims &&
        !ambiguity_flag
    ) {
        return BAND_HIGH;
    }
    if (memory_hits >= 1 || verify_first_try_passes >= 1) {
        return BAND_MEDIUM;
    }
    return BAND_LOW;
}

/**
 * Return the trace-level risk class.
 *
 * `changes` is the `delivery.changes` slice — a list of dicts in
 * the canonical engine shape, or `null` for pure planning phases.
 * Until the file-ownership matrix is wired in, "any change touched"
 * maps to `medium`; "no change" maps to `low`. `high` is
 * reserved for the future ownership-matrix lookup.
 *
 * Mirrors the Python truthiness check `if not changes:` — empty list,
 * empty string, `0`, `null`, `undefined`, and `false` all count as falsy.
 * Non-iterable truthy values fall through to `RISK_LOW` exactly as the
 * Python `isinstance(changes, Iterable)` guard does.
 */
export function derive_risk_class(changes: Any): string {
    if (!_pyTruthy(changes)) {
        return RISK_LOW;
    }
    if (_isIterable(changes)) {
        // `sum(1 for _ in changes)` — count the elements. Strings are
        // iterable in Python (each char is one element); JS strings are not
        // iterated by the `for...of` below the same way for our purposes, so
        // mirror Python: a non-empty string counts as `count > 0`.
        let count = 0;
        if (typeof changes === 'string') {
            count = _pyLen(changes);
        } else {
            for (const _ of changes as Iterable<unknown>) {
                void _;
                count += 1;
            }
        }
        return count > 0 ? RISK_MEDIUM : RISK_LOW;
    }
    return RISK_LOW;
}

/**
 * Reduce `state.memory` into the trace-envelope `memory` slice.
 *
 * The engine stores memory entries as dicts with at least an `id`
 * or `rule_id` key plus arbitrary per-entry payload. The trace
 * only carries ids — bodies stay behind the privacy floor.
 */
export function summarise_memory(
    memory: Any,
    args: { limit?: number } = {},
): Record<string, Any> {
    const limit = args.limit ?? 32;
    if (!_pyTruthy(memory)) {
        return { asks: 0, hits: 0, ids: [] };
    }
    const ids: string[] = [];
    let asks = 0;
    let hits = 0;
    for (const entry of memory as Iterable<unknown>) {
        if (!_isPlainDict(entry)) {
            continue;
        }
        const e = entry as Record<string, unknown>;
        // `int(entry.get("asks", 1) or 0) or 1` — Python: default 1 when key
        // absent; coerce to int; `or 0` turns a falsy value into 0; outer
        // `or 1` turns a resulting 0 into 1. Net: the increment is always >= 1.
        asks += _pyInt(_pyOr(_get(e, 'asks', 1), 0)) || 1;
        // `entry.get("hit", True)` — default True when absent.
        if (_pyTruthy('hit' in e ? e['hit'] : true)) {
            hits += 1;
            const entry_id = _pyOr(_get(e, 'id', undefined), _get(e, 'rule_id', undefined));
            if (_pyTruthy(entry_id) && ids.length < limit) {
                ids.push(_pyStr(entry_id));
            }
        }
    }
    return { asks, hits, ids };
}

/**
 * Reduce `state.verify` into the trace-envelope `verify` slice.
 *
 * `verify` may be `null` (no verify run yet), a dict carrying
 * `claims` / `first_try_passes`, or a list of attempt records.
 * Anything else collapses to zeros.
 */
export function summarise_verify(verify: Any): Record<string, number> {
    if (verify === null || verify === undefined) {
        return { claims: 0, first_try_passes: 0 };
    }
    if (_isPlainDict(verify)) {
        const v = verify as Record<string, unknown>;
        const claims = _pyInt(_pyOr(_get(v, 'claims', 0), 0));
        const passes = _pyInt(_pyOr(_get(v, 'first_try_passes', 0), 0));
        return { claims, first_try_passes: passes };
    }
    if (Array.isArray(verify)) {
        const claims = verify.length;
        let passes = 0;
        for (const entry of verify) {
            if (_isPlainDict(entry) && _pyTruthy((entry as Record<string, unknown>)['first_try_pass'])) {
                passes += 1;
            }
        }
        return { claims, first_try_passes: passes };
    }
    return { claims: 0, first_try_passes: 0 };
}

// ── Python-parity primitives ────────────────────────────────────────────

/** `dict.get(key, default)` for a plain object. */
function _get(obj: Record<string, unknown>, key: string, dflt: unknown): unknown {
    return key in obj ? obj[key] : dflt;
}

/** Python `a or b` — returns `a` when truthy, else `b`. */
function _pyOr(a: unknown, b: unknown): unknown {
    return _pyTruthy(a) ? a : b;
}

/**
 * Python `bool(x)` truthiness: `None`/`undefined`, `False`, `0`, `0.0`,
 * `""`, empty list/tuple/dict/set are falsy; everything else truthy.
 */
function _pyTruthy(value: unknown): boolean {
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
 * Python `int(x)` for the value kinds these heuristics see — booleans
 * (`True` → 1, `False` → 0), numbers (truncate toward zero), and numeric
 * strings. Non-coercible values raise like CPython would; in practice the
 * callers only pass the dict-derived scalars above.
 */
function _pyInt(value: unknown): number {
    if (value === true) {
        return 1;
    }
    if (value === false) {
        return 0;
    }
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const n = Number(trimmed);
        if (trimmed !== '' && Number.isFinite(n)) {
            return Math.trunc(n);
        }
    }
    throw new Error(`invalid literal for int(): ${String(value)}`);
}

/** Python `str(x)` for the scalar shapes returned by `id` / `rule_id`. */
function _pyStr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    return String(value);
}

/** Python `len(x)` for a string — code-point count, not UTF-16 unit count. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        void _;
        n += 1;
    }
    return n;
}

/**
 * Python `isinstance(x, dict)` — only a plain object (not array, not null).
 * Mirrors the source's `isinstance(entry, dict)` guards.
 */
function _isPlainDict(value: unknown): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

/**
 * Python `isinstance(x, Iterable)` for the shapes `derive_risk_class` can
 * see after the `if not changes:` guard: lists, strings, sets, maps, and
 * generic iterables expose `Symbol.iterator`; plain dicts are iterable in
 * Python (over keys) so an object also counts.
 */
function _isIterable(value: unknown): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'string' || Array.isArray(value)) {
        return true;
    }
    if (typeof value === 'object') {
        if (typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
            return true;
        }
        // Plain dict: iterable over its keys in Python.
        return true;
    }
    return false;
}

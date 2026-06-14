/**
 * Producer-side helpers for the memory-visibility line.
 *
 * TypeScript twin of `work_engine/scoring/memory_visibility.py` (ADR-094 py2ts
 * Phase 1 — work_engine scoring subpackage). Public API names stay snake_case
 * to mirror the Python module 1:1 (per ADR-094 — Python style is part of the
 * contract).
 *
 * Implements the v1 line shape from
 * `docs/contracts/memory-visibility-v1.md`:
 *
 *     🧠 Memory: <hits>/<asks> · ids=[<comma-separated-ids>]
 *     🧠 Memory: <hits>/<asks> · ids=[<...>] · affected: <keys>
 *
 * The optional `· affected: <keys>` trailing segment surfaces which
 * closed-list decision-trace keys diverged because memory was
 * consulted — see `docs/contracts/decision-trace-v1.md` "Memory
 * consequence keys".
 *
 * The semantics matched to the work-engine model:
 *
 * - The `memory` step retrieves across the four allowed memory types
 *   (`MEMORY_TYPES` in `directives.backend.memory`). Each type is
 *   one `ask` from the visibility-line perspective.
 * - `hits` counts distinct types that returned at least one entry.
 * - `ids` is the deduped list of returned entry ids preserving the
 *   retrieval order encoded in `state.memory`.
 *
 * Privacy floor: this module never emits entry bodies, summaries,
 * `path`/`source` fields, or anything beyond `id` and `type`.
 * The privacy regression test (`tests/contracts/test_memory_
 * visibility_redaction.py`) keeps this guarantee enforced.
 */

import { derive_confidence_band, derive_risk_class } from './decision_trace.js';

/** Arbitrary JSON-ish value, mirroring the Python `Any` fields. */
export type Any = unknown;

export const ICON = '\u{1F9E0}'; // 🧠
export const DEFAULT_MAX_INLINE_IDS = 5;
export const DEFAULT_ASKED_TYPES: readonly string[] = [
    'domain-invariants',
    'architecture-decisions',
    'incident-learnings',
    'historical-patterns',
];

export const CONSEQUENCE_KEYS: readonly string[] = [
    'confidence_band',
    'risk_class',
    'applied_rules',
    'test_plan',
] as const;

/**
 * Reduce `state.memory` into the visibility-line slice.
 *
 * `memory` is the list of hit dicts produced by
 * `directives.backend.memory`. Returns `{"asks", "hits", "ids"}`
 * with privacy-safe values only.
 */
export function summarise_visibility(
    memory: Any,
    args: { asked_types?: Iterable<string> } = {},
): Record<string, Any> {
    const asked = [...(args.asked_types ?? DEFAULT_ASKED_TYPES)];
    if (!_pyTruthy(memory) || !Array.isArray(memory)) {
        return { asks: 0, hits: 0, ids: [] };
    }
    const asks = asked.length;
    const seen_types = new Set<string>();
    const ids: string[] = [];
    const seen_ids = new Set<string>();
    for (const entry of memory) {
        if (!_isPlainDict(entry)) {
            continue;
        }
        const e = entry as Record<string, unknown>;
        const type_value = e['type'];
        if (typeof type_value === 'string') {
            seen_types.add(type_value);
        }
        const entry_id = _pyOr(_get(e, 'id', undefined), _get(e, 'rule_id', undefined));
        if (!(typeof entry_id === 'string' || _isIntLike(entry_id))) {
            continue;
        }
        const sid = _pyStr(entry_id);
        if (seen_ids.has(sid)) {
            continue;
        }
        seen_ids.add(sid);
        ids.push(sid);
    }
    const hits = seen_types.size > 0 ? seen_types.size : ids.length > 0 ? 1 : 0;
    return { asks, hits, ids };
}

/**
 * Return a comparable shape for a consequence-key value.
 *
 * List-shaped keys (`applied_rules`, `test_plan`) compare as
 * sorted tuples so order is not a divergence; scalar keys
 * (`confidence_band`, `risk_class`) compare as-is.
 */
function _normalise_key_value(value: Any): Any {
    if (Array.isArray(value)) {
        // `tuple(sorted(str(item) for item in value))`
        return _sortedStr(value.map((item) => _pyStr(item)));
    }
    return value;
}

/**
 * Return sorted keys whose values diverge between two traces.
 *
 * Iterates the closed `CONSEQUENCE_KEYS` list defined in
 * `docs/contracts/decision-trace-v1.md`. A key is considered
 * *diverged* when its normalised value differs between the two
 * traces. Per the contract, when both sides are `None` the key
 * is suppressed from the diff entirely.
 */
export function diff_consequence_keys(
    trace_with: Record<string, Any>,
    trace_without: Record<string, Any>,
): string[] {
    const affected: string[] = [];
    for (const key of CONSEQUENCE_KEYS) {
        const a = _get(trace_with, key, undefined);
        const b = _get(trace_without, key, undefined);
        if (_isNone(a) && _isNone(b)) {
            continue;
        }
        if (!_pyEqual(_normalise_key_value(a), _normalise_key_value(b))) {
            affected.push(key);
        }
    }
    return _sortedStr(affected);
}

/**
 * Compute the `affected` consequence keys for the visibility line.
 *
 * Returns:
 *   - `null` when no memory was consulted (`memory_hits <= 0`)
 *     — caller MUST omit the `· affected: …` segment.
 *   - `[]` when memory was consulted but no closed-list key
 *     diverged — caller MUST render `· affected: none`.
 *   - sorted list of keys otherwise.
 *
 * The counterfactual trace is "what the heuristics would have
 * emitted if `memory_hits` had been `0`". v1 covers
 * `confidence_band` and `risk_class` via the existing scoring
 * helpers; `applied_rules` and `test_plan` pass through
 * unchanged because they are not yet memory-derived in the
 * engine — the keys stay in the closed list so the diff
 * infrastructure is in place when they wire in.
 */
export function compute_affected(args: {
    memory_hits: number;
    verify_claims?: number;
    verify_first_try_passes?: number;
    ambiguity_flag?: boolean;
    changes?: Any;
    applied_rules?: string[] | null;
    test_plan?: string[] | null;
}): string[] | null {
    const memory_hits = args.memory_hits;
    const verify_claims = args.verify_claims ?? 0;
    const verify_first_try_passes = args.verify_first_try_passes ?? 0;
    const ambiguity_flag = args.ambiguity_flag ?? false;
    const changes = args.changes ?? null;
    const applied_rules = args.applied_rules ?? null;
    const test_plan = args.test_plan ?? null;

    if (memory_hits <= 0) {
        return null;
    }
    const trace_with: Record<string, Any> = {
        confidence_band: derive_confidence_band({
            memory_hits,
            verify_claims,
            verify_first_try_passes,
            ambiguity_flag,
        }),
        risk_class: derive_risk_class(changes),
        applied_rules: _pyTruthy(applied_rules) ? [...(applied_rules as string[])] : null,
        test_plan: _pyTruthy(test_plan) ? [...(test_plan as string[])] : null,
    };
    const trace_without: Record<string, Any> = {
        confidence_band: derive_confidence_band({
            memory_hits: 0,
            verify_claims,
            verify_first_try_passes,
            ambiguity_flag,
        }),
        risk_class: derive_risk_class(changes),
        applied_rules: _pyTruthy(applied_rules) ? [...(applied_rules as string[])] : null,
        test_plan: _pyTruthy(test_plan) ? [...(test_plan as string[])] : null,
    };
    return diff_consequence_keys(trace_with, trace_without);
}

/**
 * Render the visibility line; return `null` when `asks == 0`.
 *
 * Cap inline ids at `max_inline_ids` and append `…+N` when the
 * list is longer. Returning `null` enforces the contract clause
 * "If `asks == 0`, the engine MUST suppress the line entirely".
 *
 * When `affected` is not `null`, append the
 * `· affected: <keys>` trailing segment from
 * `docs/contracts/memory-visibility-v1.md`: empty list renders as
 * `affected: none` (consulted but no key diverged);
 * non-empty list renders the comma-separated keys.
 */
export function format_line(
    summary: Record<string, Any>,
    args: { max_inline_ids?: number; affected?: string[] | null } = {},
): string | null {
    let max_inline_ids = args.max_inline_ids ?? DEFAULT_MAX_INLINE_IDS;
    const affected = args.affected ?? null;

    const asks = _pyInt(_pyOr(_get(summary, 'asks', 0), 0));
    if (asks <= 0) {
        return null;
    }
    const hits = _pyInt(_pyOr(_get(summary, 'hits', 0), 0));
    const raw_ids = (_pyOr(_get(summary, 'ids', undefined), []) as unknown[]) ?? [];
    const ids = (raw_ids as unknown[])
        .filter((i) => typeof i === 'string' || _isIntLike(i))
        .map((i) => _pyStr(i));
    if (max_inline_ids < 0) {
        max_inline_ids = 0;
    }
    const inline = ids.slice(0, max_inline_ids);
    const overflow = ids.length - inline.length;
    let rendered_ids = inline.join(', ');
    if (overflow > 0) {
        const suffix = rendered_ids ? ', ' : '';
        rendered_ids = `${rendered_ids}${suffix}…+${overflow}`;
    }
    let line = `${ICON} Memory: ${hits}/${asks} · ids=[${rendered_ids}]`;
    if (affected !== null) {
        const rendered_affected = affected.length > 0 ? affected.join(',') : 'none';
        line = `${line} · affected: ${rendered_affected}`;
    }
    return line;
}

/**
 * Render the end-of-run "Memory changed decisions" report block.
 *
 * Per `docs/contracts/memory-visibility-v1.md`: lists
 * `<id> → <key>` rows derived from the same diff source as the
 * visibility line's `affected` segment. Returns `null` when
 * no key diverged (`affected` empty / `null`) so the caller
 * suppresses the block entirely.
 *
 * Attribution in v1 is aggregate: each consulted id pairs with
 * each affected key. Per-id attribution is captured as a
 * follow-up risk in the roadmap Risk register.
 */
export function format_changed_decisions_block(
    ids: Iterable<string>,
    affected: Iterable<string> | null | undefined,
): string | null {
    if (!_pyTruthy(affected)) {
        return null;
    }
    const affected_list = _sortedStr([...(affected as Iterable<string>)]);
    const id_list = [...ids].filter((i) => typeof i === 'string' || _isIntLike(i)).map((i) => _pyStr(i));
    if (id_list.length === 0) {
        return null;
    }
    const lines = ['Memory changed decisions:'];
    for (const entry_id of id_list) {
        for (const key of affected_list) {
            lines.push(`- ${entry_id} → ${key}`);
        }
    }
    return lines.join('\n');
}

/**
 * Apply the cadence + opt-out gates from the contract.
 *
 * `memory_cadence` is the `memory.cadence` cadence key:
 *
 *   - `always` (default) — emit whenever `asks >= 1`.
 *   - `auto` — emit only when `asks >= 3` (reduces noise on
 *     shallow-retrieval steps).
 *   - `never` — suppress the line entirely.
 *
 * `visibility_off` is the legacy `memory.visibility: off` master
 * switch and still wins over any `memory_cadence` value.
 */
export function should_emit(
    summary: Record<string, Any>,
    args: { memory_cadence?: string; visibility_off?: boolean } = {},
): boolean {
    const memory_cadence = args.memory_cadence ?? 'always';
    const visibility_off = args.visibility_off ?? false;
    if (visibility_off) {
        return false;
    }
    const asks = _pyInt(_pyOr(_get(summary, 'asks', 0), 0));
    if (asks <= 0) {
        return false;
    }
    const status = (memory_cadence || 'always').trim().toLowerCase();
    if (status === 'never') {
        return false;
    }
    if (status === 'auto') {
        return asks >= 3;
    }
    return true;
}

// ── Python-parity primitives ────────────────────────────────────────────

/** `dict.get(key, default)` for a plain object. */
function _get(obj: Record<string, unknown>, key: string, dflt: unknown): unknown {
    return key in obj ? obj[key] : dflt;
}

/** Python `a or b`. */
function _pyOr(a: unknown, b: unknown): unknown {
    return _pyTruthy(a) ? a : b;
}

/** Python `x is None`. */
function _isNone(value: unknown): boolean {
    return value === null || value === undefined;
}

/**
 * Python `int` / `bool` (not `bool` masquerading) test used by the
 * `isinstance(entry_id, (str, int))` guards. In Python `bool` is a subclass
 * of `int`, so `True`/`False` pass; mirror that.
 */
function _isIntLike(value: unknown): boolean {
    if (typeof value === 'boolean') {
        return true;
    }
    return typeof value === 'number' && Number.isInteger(value);
}

/** Python `bool(x)` truthiness. */
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

/** Python `int(x)` for the dict-scalar / `or 0` shapes this module passes. */
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

/** Python `str(x)` for the id / list-item shapes. */
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

/** Python `isinstance(x, dict)` — plain object only. */
function _isPlainDict(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Python `sorted(list_of_str)` — code-point ascending. */
function _sortedStr(values: string[]): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Equality matching Python `!=` for the normalised consequence-key values:
 * scalars compare by value; lists (post-`_normalise_key_value` they are
 * already string arrays) compare element-wise; `None` distinct from a value.
 */
function _pyEqual(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i += 1) {
            if (!_pyEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        return false;
    }
    if (_isNone(a) && _isNone(b)) {
        return true;
    }
    return a === b;
}

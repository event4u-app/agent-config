/**
 * `memory` step — bounded retrieval over the three allowed types.
 *
 * TypeScript twin of `work_engine/directives/backend/memory.py` (ADR-096
 * py2ts Phase 1 — work_engine directive sets). Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-096 — Python style is
 * part of the contract).
 *
 * Contract (see
 * `docs/contracts/implement-ticket-flow.md#memory-retrieval-contract`):
 *
 * - Three allowed types: `domain-invariants`, `incident-learnings`,
 *   `historical-patterns`. (Architectural rationale lives in ADRs —
 *   `docs/decisions/` — not in curated memory.)
 * - Hard cap of **12** hits total across the three types.
 * - Keys derive from the ticket — title tokens plus acceptance-criterion
 *   tokens plus any already-known `files` hint. Tokenisation is
 *   deliberately naive (whitespace split, lower-cased) so the retrieval
 *   shape stays reproducible in tests.
 * - Step always returns `SUCCESS`. Zero hits is a valid outcome
 *   ("nothing in memory touches this ticket") — the `report` step
 *   drops the memory section when that happens rather than padding.
 *
 * The step stores each hit as a plain dict on `state.memory` so
 * consumers outside Python (the delivery report, JSON log lines) can
 * round-trip the structure without pickling dataclasses.
 */

import { type Any, DeliveryState, Outcome, StepResult } from '../../delivery_state.js';
import { retrieve as _real_retrieve } from '../../../memory_lookup.js';

/** The three types allowed by the flow contract. No aliases, no extras. */
export const MEMORY_TYPES: ReadonlyArray<string> = [
    'domain-invariants',
    'incident-learnings',
    'historical-patterns',
];

/** Hard cap per the roadmap — never raise without amending the contract. */
export const MAX_HITS = 12;

/**
 * Declared ambiguity surfaces — memory retrieval always succeeds.
 *
 * Declared empty so the aggregate registry in `steps/__init__.py`
 * can round-trip every step's surfaces without a special case.
 */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [];

/** Signature of the `memory_lookup.retrieve` callable this step drives. */
type RetrieveFn = (types: string[], keys: string[], limit: number) => unknown;

/**
 * Test seam mirroring Python's late `import memory_lookup` monkeypatch
 * point. Default is the real `memory_lookup.retrieve`; tests swap it via
 * `_setRetrieve` exactly as the Python suite patches `memory_lookup.retrieve`.
 */
let _retrieve_override: RetrieveFn | null = null;

/** Swap the `retrieve` callable (test hook for the lazy-import seam). */
export function _setRetrieve(fn: RetrieveFn | null): void {
    _retrieve_override = fn;
}

const _WORD = /[A-Za-z][A-Za-z0-9_-]{2,}/g;
const _STOPWORDS: ReadonlySet<string> = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this',
    'should', 'must', 'when', 'then', 'will', 'have', 'has',
    'are', 'was', 'were', 'can', 'could', 'would', 'shall',
    'also', 'which', 'where', 'while', 'make', 'made', 'use',
    'used', 'using', 'user', 'users', 'test', 'tests',
]);

/** Populate `state.memory` with up to `MAX_HITS` hits. */
export function run(state: DeliveryState): StepResult {
    const retrieve = _resolve_retrieve();
    const keys = _keys_from_ticket(state.ticket);
    const hits = retrieve([...MEMORY_TYPES], keys, MAX_HITS);

    // `retrieve` returns `Hit` dataclasses; coerce to dicts so the
    // state is serialisation-ready for the report step and metrics log.
    const hitList = Array.isArray(hits) ? hits : [];
    state.memory = hitList.slice(0, MAX_HITS).map((h) => _as_dict(h));
    return new StepResult({ outcome: Outcome.SUCCESS });
}

/**
 * Resolve `memory_lookup.retrieve` lazily so tests can monkeypatch it.
 *
 * Importing at module load time would freeze the reference before
 * tests can swap in a fake, which is the standard gotcha with the
 * `from X import Y` form. Deferring the resolution keeps the step
 * patchable from a single attribute (`memory_lookup.retrieve`).
 */
function _resolve_retrieve(): RetrieveFn {
    return _retrieve_override ?? (_real_retrieve as RetrieveFn);
}

/**
 * Derive retrieval keys from the ticket.
 *
 * Three sources, in priority order so callers reading the log can
 * reconstruct why a hit scored: explicit `files` hints first,
 * then title tokens, then acceptance-criterion tokens. Duplicates
 * are removed while preserving first-seen order.
 */
function _keys_from_ticket(ticket: Record<string, Any>): string[] {
    const keys: string[] = [];
    _extend_unique(keys, _as_str_list((ticket || {}).files));
    _extend_unique(keys, _tokenise((ticket || {}).title));
    for (const ac of _as_str_list((ticket || {}).acceptance_criteria)) {
        _extend_unique(keys, _tokenise(ac));
    }
    return keys;
}

/** Return lower-cased content words from `value` (empty when absent). */
function _tokenise(value: Any): string[] {
    if (typeof value !== 'string') {
        return [];
    }
    const out: string[] = [];
    for (const match of value.matchAll(_WORD)) {
        const word = match[0].toLowerCase();
        if (!_STOPWORDS.has(word)) {
            out.push(word);
        }
    }
    return out;
}

/** Coerce `value` to a list of non-empty strings. */
function _as_str_list(value: Any): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length !== 0);
}

/** Append items from `source` to `target` skipping duplicates. */
function _extend_unique(target: string[], source: Iterable<string>): void {
    const seen = new Set(target);
    for (const item of source) {
        if (seen.has(item)) {
            continue;
        }
        target.push(item);
        seen.add(item);
    }
}

/** Coerce a `Hit` (or pre-dict test fake) into a plain dict. */
function _as_dict(hit: Any): Record<string, Any> {
    const asDict = (hit as { as_dict?: unknown })?.as_dict;
    if (typeof asDict === 'function') {
        return (asDict as () => Record<string, Any>).call(hit);
    }
    if (_isPlainObject(hit)) {
        return { ...(hit as Record<string, Any>) };
    }
    // Fallback path — should not happen in production, but keeps the
    // step from crashing if a fixture returns a raw namespace object.
    return { entry: _pyRepr(hit) };
}

/** True for a dict-like value (mirrors Python `isinstance(x, dict)`). */
function _isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Set) &&
        !(value instanceof Map)
    );
}

/** Minimal Python `repr()` for the fallback path's scalar inputs. */
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
        return `'${value}'`;
    }
    return String(value);
}

/**
 * Resolve the `memory` why-slot for the trace.
 *
 * Ported from the retired Python `src/scripts/_cli/explain_last/memory.py` (ADR-200).
 * The coercion order, the `float()` semantics and the `None`-on-empty branch
 * still pin that historical contract. The second source the port carried — a
 * sidecar whose only documented producer was the Layer-2 memory-MCP
 * integration — does not, because
 * `docs/decisions/ADR-094-agent-memory-layer-removal.md` removed that layer
 * and rejected leaving its surfaces inert. Nothing in the tree ever wrote it.
 *
 * One source is consulted:
 *
 * - `state.memory[]` — the work-engine writes per-run memory hits here
 *   during the `memory` step. Each entry carries `{entry_id, hit_score,
 *   used_in}` already shaped to the trace contract.
 *
 * Returns `null` when that source produced no non-empty list (the schema
 * accepts a null memory slot so the renderer can drop the section cleanly).
 *
 * Parity note (ADR-200): Python's `hit_score = float(...)` always yields a
 * `float`, even for integer inputs, so `json.dumps` renders `0.0` not `0`.
 * The twin carries it as a `PyFloat` marker so the downstream JSON
 * serializer (and the section renderer's `:.2f`) stays byte-identical.
 */
import { scrub_string } from './scrubber.js';

/**
 * Marker for a Python `float`. JS has no int/float distinction; a
 * `PyFloat` makes `json.dumps` render integer-valued floats as `N.0`.
 * Mirrors the established convention in the migrated scripts.
 */
export class PyFloat {
    constructor(readonly value: number) {}
}

/** Python truthiness (empty string / 0 / null / empty container falsy). */
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

/** Python `float()` — `TypeError`/`ValueError` paths return `null` (→ 0.0 fallback). */
function _coerceFloat(value: unknown): number | null {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 1.0 : 0.0; // float(True)=1.0, float(False)=0.0
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return null;
        }
        const lowered = trimmed.toLowerCase();
        if (['inf', 'infinity', '+inf', '+infinity'].includes(lowered)) {
            return Infinity;
        }
        if (['-inf', '-infinity'].includes(lowered)) {
            return -Infinity;
        }
        if (['nan', '+nan', '-nan'].includes(lowered)) {
            return NaN;
        }
        if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
            return null;
        }
        const n = Number(trimmed);
        return Number.isNaN(n) ? null : n;
    }
    return null; // dict/list/None → TypeError → fallback
}

function _coerce_entry(raw: Record<string, unknown>): Record<string, unknown> | null {
    // entry_id = raw.get("entry_id") or raw.get("id")
    const entry_id = _pyTruthy(raw.entry_id) ? raw.entry_id : (raw.id ?? null);
    if (typeof entry_id !== 'string' || entry_id.trim() === '') {
        return null;
    }
    // hit_score = raw.get("hit_score"); if None: hit_score = raw.get("score", 0.0)
    let hitRaw: unknown = raw.hit_score ?? null;
    if (hitRaw === null || hitRaw === undefined) {
        hitRaw = 'score' in raw ? raw.score : 0.0;
    }
    const coerced = _coerceFloat(hitRaw);
    const hit_score = new PyFloat(coerced === null ? 0.0 : coerced);
    // used_in = raw.get("used_in") or raw.get("step") or "unspecified"
    const used_in = _pyTruthy(raw.used_in)
        ? raw.used_in
        : (_pyTruthy(raw.step) ? raw.step : 'unspecified');
    return {
        entry_id: scrub_string(entry_id.trim()),
        hit_score,
        used_in: scrub_string(String(used_in)),
    };
}

function _from_state(state: Record<string, unknown>): Record<string, unknown>[] {
    const entries: Record<string, unknown>[] = [];
    for (const raw of (state.memory as unknown[] | undefined) ?? []) {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            continue;
        }
        const entry = _coerce_entry(raw as Record<string, unknown>);
        if (entry !== null) {
            entries.push(entry);
        }
    }
    return entries;
}

export function build(
    state: Record<string, unknown>,
): Record<string, unknown>[] | null {
    const entries = _from_state(state);
    return entries.length > 0 ? entries : null;
}

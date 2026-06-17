/**
 * Resolve the `assumptions` why-slot for the trace.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/assumptions.py`
 * (ADR-200). Behaviour mirrors the Python original EXACTLY — same string /
 * dict normalisation, same 120-code-point id slice, same `or`-fallback
 * order, same always-array return. No behaviour changes.
 *
 * The work-engine writes `state.input.data.assumptions[]` at the end of
 * the `refine` step and on every `halt`. Each entry is either a plain
 * string (legacy shape) or a dict with `{id, accepted, source}` (R2+
 * shape). Both shapes are normalised here so the schema gate sees a
 * uniform list of objects.
 */
import { scrub_string } from './scrubber.js';

/** Python `len()`-aware slice (`s[:120]`, code points not UTF-16 units). */
function _pySlice(s: string, n: number): string {
    return Array.from(s).slice(0, n).join('');
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

function _normalise(raw: unknown, fallback_idx: number): Record<string, unknown> | null {
    if (typeof raw === 'string') {
        const text = raw.trim();
        if (!text) {
            return null;
        }
        // scrub_string(text)[:120] or f"assumption-{idx}"
        const scrubbed = scrub_string(text);
        const sliced = typeof scrubbed === 'string' ? _pySlice(scrubbed, 120) : scrubbed;
        return {
            id: _pyTruthy(sliced) ? sliced : `assumption-${fallback_idx}`,
            accepted: true,
            source: 'refine',
        };
    }
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
        const r = raw as Record<string, unknown>;
        // ident = raw.get("id") or raw.get("text") or f"assumption-{idx}"
        let ident: unknown = _pyTruthy(r.id)
            ? r.id
            : (_pyTruthy(r.text) ? r.text : `assumption-${fallback_idx}`);
        if (typeof ident !== 'string') {
            ident = String(ident);
        }
        // ident = scrub_string(ident.strip()) or f"assumption-{idx}"
        const scrubbed = scrub_string((ident as string).trim());
        ident = _pyTruthy(scrubbed) ? scrubbed : `assumption-${fallback_idx}`;
        // accepted = bool(raw.get("accepted", True))
        const acceptedRaw = 'accepted' in r ? r.accepted : true;
        const accepted = _pyBool(acceptedRaw);
        // source = raw.get("source") or raw.get("step") or "refine"
        const source = _pyTruthy(r.source)
            ? r.source
            : (_pyTruthy(r.step) ? r.step : 'refine');
        return {
            id: ident,
            accepted,
            source: scrub_string(String(source)),
        };
    }
    return null;
}

/** Python `bool()` — same truthiness table. */
function _pyBool(value: unknown): boolean {
    return _pyTruthy(value);
}

export function build(state: Record<string, unknown>): Record<string, unknown>[] {
    // data = (state.get("input") or {}).get("data") or {}
    const input = _pyTruthy(state.input) ? (state.input as Record<string, unknown>) : {};
    const dataRaw = input.data;
    const data = _pyTruthy(dataRaw)
        ? (dataRaw as Record<string, unknown>)
        : {};
    // raw_list = data.get("assumptions") or []
    // if not isinstance(raw_list, list): return []
    const rawListRaw = data.assumptions;
    if (!Array.isArray(rawListRaw)) {
        return [];
    }
    const out: Record<string, unknown>[] = [];
    rawListRaw.forEach((raw, idx) => {
        const entry = _normalise(raw, idx);
        if (entry !== null) {
            out.push(entry);
        }
    });
    return out;
}

/**
 * Builder for the `trace.halt` slot.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/halt.py` (ADR-200).
 * Behaviour mirrors the Python original EXACTLY — same `halts[-1]` pick,
 * same `None` branches, same scrub passes, same `step` empty-string
 * fallback. No behaviour changes.
 *
 * Reads `state.halts[]` (the append-only halt log persisted by
 * `work_engine.emitters._emit_halt`) and projects the most recent entry
 * into the v1 explain-trace shape: `{reason, step, surface}`.
 *
 * Returns `None` when the engine never halted (clean run) or when the
 * state file predates the halts-bearing schema (forward-compatible read).
 */
import { scrub_string } from './scrubber.js';

/** Python truthiness (empty container / empty string / 0 / null falsy). */
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

export function build(state: Record<string, unknown>): Record<string, unknown> | null {
    // halts = state.get("halts") or []
    const haltsRaw = _pyTruthy(state.halts) ? state.halts : [];
    // if not isinstance(halts, list) or not halts: return None
    if (!Array.isArray(haltsRaw) || haltsRaw.length === 0) {
        return null;
    }
    const last = haltsRaw[haltsRaw.length - 1];
    if (typeof last !== 'object' || last === null || Array.isArray(last)) {
        return null;
    }
    const lastDict = last as Record<string, unknown>;
    const reason = lastDict.reason;
    if (typeof reason !== 'string' || !reason) {
        return null;
    }
    const step = lastDict.step;
    // surface = last.get("surface") or []
    const surfaceRaw = _pyTruthy(lastDict.surface) ? lastDict.surface : [];
    const scrubbed_surface: unknown[] = [];
    if (Array.isArray(surfaceRaw)) {
        for (const line of surfaceRaw) {
            if (typeof line === 'string') {
                scrubbed_surface.push(scrub_string(line));
            }
        }
    }
    return {
        reason: scrub_string(reason),
        step: typeof step === 'string' && step ? scrub_string(step) : '',
        surface: scrubbed_surface,
    };
}

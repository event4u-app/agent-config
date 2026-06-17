/**
 * Builder for the `trace.provider` slot.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/provider.py` (ADR-200).
 * Behaviour mirrors the Python original EXACTLY — same video-only gate,
 * same `video_provider` / `contract.video_provider` extraction order, same
 * `None` branches, same scrub passes. No behaviour changes.
 *
 * Bounded to video runs (`state.directive_set == "video"`). The work_engine
 * does not yet ship a video directive set — this builder is
 * forward-compatible: when the engine eventually persists a provider
 * selection (`state.video_provider` or `state.contract.video_provider` are
 * both accepted shapes), the slot populates; otherwise it returns `None`.
 */
import { scrub_string } from './scrubber.js';

function _isDict(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _extract(state: Record<string, unknown>): Record<string, unknown> | null {
    const direct = state.video_provider;
    if (_isDict(direct)) {
        return direct;
    }
    const contract = state.contract;
    if (_isDict(contract)) {
        const nested = contract.video_provider;
        if (_isDict(nested)) {
            return nested;
        }
    }
    return null;
}

/** Python truthiness for the `or ""` fallthrough. */
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
    // if (state.get("directive_set") or "") != "video": return None
    const ds = state.directive_set;
    const dsStr = _pyTruthy(ds) ? ds : '';
    if (dsStr !== 'video') {
        return null;
    }
    const payload = _extract(state);
    if (payload === null) {
        return null;
    }
    const pid = payload.id;
    let reason = payload.selection_reason;
    if (typeof pid !== 'string' || !pid) {
        return null;
    }
    if (typeof reason !== 'string' || !reason) {
        reason = '';
    }
    return {
        id: scrub_string(pid),
        selection_reason: scrub_string(reason),
    };
}

/**
 * Render the `Active pack` section (Phase 4-discovery aware).
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/sections/pack.py`
 * (ADR-200). Byte-identical to the Python original. No behaviour changes.
 */

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

export function render(trace: Record<string, unknown>): string {
    const pack = trace.pack;
    if (!_pyTruthy(pack)) {
        return '';
    }
    const p = pack as Record<string, unknown>;
    const pack_id = _pyTruthy(p.id) ? p.id : '(unknown)';
    const reason = _pyTruthy(p.reason) ? p.reason : '';
    const out: string[] = ['## Active pack', ''];
    out.push(_pyTruthy(reason) ? `- ${pack_id} — ${reason}` : `- ${pack_id}`);
    out.push('');
    return out.join('\n');
}

/**
 * Render the `Assumptions` section.
 *
 * TypeScript twin of
 * `src/scripts/_cli/explain_last/sections/assumptions.py` (ADR-200).
 * Byte-identical to the Python original — note the DOUBLE space before the
 * em-dash in the item line (`{ident}  — recorded`). No behaviour changes.
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
    const out: string[] = ['## Assumptions', ''];
    const items = (_pyTruthy(trace.assumptions) ? trace.assumptions : []) as unknown[];
    if (items.length === 0) {
        out.push('- (none captured)');
        out.push('');
        return out.join('\n');
    }
    for (const itemRaw of items) {
        const item = itemRaw as Record<string, unknown>;
        const ident = _pyTruthy(item.id) ? item.id : '(unknown)';
        // accepted = item.get("accepted", True)
        const accepted = 'accepted' in item ? item.accepted : true;
        const source = _pyTruthy(item.source) ? item.source : 'unspecified';
        const marker = accepted ? '[x]' : '[ ]';
        out.push(`- ${marker} ${ident}  — recorded in step \`${source}\``);
    }
    out.push('');
    return out.join('\n');
}

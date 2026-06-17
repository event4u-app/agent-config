/**
 * Render the `Council` section.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/sections/council.py`
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
    const out: string[] = ['## Council', ''];
    const members = (_pyTruthy(trace.council) ? trace.council : []) as unknown[];
    if (members.length === 0) {
        out.push('(none recorded for this run)');
        out.push('');
        return out.join('\n');
    }
    for (const memberRaw of members) {
        const member = memberRaw as Record<string, unknown>;
        const mid = _pyTruthy(member.member_id) ? member.member_id : '(unknown)';
        const verdict = _pyTruthy(member.verdict) ? member.verdict : '(no verdict)';
        out.push(`### ${mid}`);
        out.push('');
        out.push(`> ${verdict}`);
        const citations = (_pyTruthy(member.citations) ? member.citations : []) as unknown[];
        if (citations.length > 0) {
            out.push('');
            out.push('Citations:');
            for (const cite of citations) {
                out.push(`- ${cite}`);
            }
        }
        out.push('');
    }
    return out.join('\n');
}

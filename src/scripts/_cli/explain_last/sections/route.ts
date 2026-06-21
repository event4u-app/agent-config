/**
 * Render the `Why this route?` section.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/sections/route.py`
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
    const out: string[] = ['## Why this route?', ''];
    const route = trace.route;
    if (!_pyTruthy(route)) {
        out.push('- (none) — router.json missing or unreadable');
        out.push('');
        return out.join('\n');
    }
    const r = route as Record<string, unknown>;
    const matched = (_pyTruthy(r.matched_rules) ? r.matched_rules : []) as unknown[];
    const kernel = (_pyTruthy(r.kernel_rules) ? r.kernel_rules : []) as unknown[];
    const persona = _pyTruthy(r.persona) ? r.persona : '(none)';
    const matched_str = matched.length > 0 ? matched.join(', ') : '(none)';
    out.push(`- Active rules: ${matched_str}`);
    out.push(`- Kernel rules: ${kernel.length}`);
    out.push(`- Persona: ${persona}`);
    out.push('');
    return out.join('\n');
}

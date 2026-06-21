/**
 * Render the `Why halted?` section.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/sections/halt.py`
 * (ADR-200). Byte-identical to the Python original — note the surface
 * lines are indented by exactly two spaces (`f"  {line}"`). No behaviour
 * changes.
 *
 * Surfaces `trace.halt` per the v1 explain-trace schema. Null halt → emits
 * the *(clean run — no halt recorded)* placeholder so renders stay
 * byte-deterministic even when the engine succeeded.
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
    const out: string[] = ['## Why halted?', ''];
    const halt = trace.halt;
    if (!_pyTruthy(halt)) {
        out.push('(clean run — no halt recorded)');
        out.push('');
        return out.join('\n');
    }
    const h = halt as Record<string, unknown>;
    const reason = _pyTruthy(h.reason) ? h.reason : '(unknown)';
    const step = _pyTruthy(h.step) ? h.step : '(unspecified)';
    out.push(`- **Reason:** \`${reason}\``);
    out.push(`- **Hook event:** \`${step}\``);
    const surface = (_pyTruthy(h.surface) ? h.surface : []) as unknown[];
    if (surface.length > 0) {
        out.push('');
        out.push('Surface emitted to the user:');
        out.push('');
        for (const line of surface) {
            out.push(`  ${line}`);
        }
    }
    out.push('');
    return out.join('\n');
}

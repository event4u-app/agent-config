/**
 * Render the `Why this profile / preset?` knob table.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/sections/inputs.py`
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

/** Python `str(value)` for the table cell. */
function _pyStr(value: unknown): string {
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    return String(value);
}

export function render(trace: Record<string, unknown>): string {
    const out: string[] = ['## Why this profile / preset?', ''];
    const inputs = trace.inputs;
    if (!_pyTruthy(inputs)) {
        out.push('- (none) — settings could not be resolved');
        out.push('');
        return out.join('\n');
    }
    const inp = inputs as Record<string, unknown>;
    const sources = (_pyTruthy(inp.source_per_knob) ? inp.source_per_knob : {}) as Record<string, unknown>;
    const rows: Array<[string, unknown, unknown]> = [
        ['profile.id', inp.profile, sources.profile],
        ['preset.id', inp.preset, sources.preset],
        ['rule_loading_tier', inp.rule_loading_tier, sources.rule_loading_tier],
    ];
    out.push('| knob | value | source |');
    out.push('|---|---|---|');
    for (const [knob, value, source] of rows) {
        // value_str = "(none)" if value is None else str(value)
        const value_str = value === null || value === undefined ? '(none)' : _pyStr(value);
        const source_str = _pyTruthy(source) ? source : 'default';
        out.push(`| ${knob} | ${value_str} | ${source_str} |`);
    }
    out.push('');
    return out.join('\n');
}

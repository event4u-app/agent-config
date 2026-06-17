/**
 * Render the `Why this provider?` section.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/sections/provider.py`
 * (ADR-200). Byte-identical to the Python original. No behaviour changes.
 *
 * Only emitted when `trace.provider` is non-null (the v1 schema bounds this
 * to `subject == "video"` runs where the engine wrote a provider selection
 * record). All other runs render an empty string so the orchestrator skips
 * the section without leaving a stray heading.
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
    const provider = trace.provider;
    if (!_pyTruthy(provider)) {
        return '';
    }
    const p = provider as Record<string, unknown>;
    const pid = _pyTruthy(p.id) ? p.id : '(unknown)';
    const reason = _pyTruthy(p.selection_reason) ? p.selection_reason : '(no reason recorded)';
    const out: string[] = [
        '## Why this provider?',
        '',
        `- **Provider:** \`${pid}\``,
        `- **Selection reason:** ${reason}`,
        '',
    ];
    return out.join('\n');
}

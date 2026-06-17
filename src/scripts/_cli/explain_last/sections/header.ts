/**
 * Render the trace header (title + subject + started-at).
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/sections/header.py`
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

const _SUBJECT_LABELS: Record<string, string> = {
    work: '/work',
    'implement-ticket': '/implement-ticket',
    council: '/council',
    video: '/video',
    unknown: '(unknown)',
};

export function render(trace: Record<string, unknown>): string {
    const run_id = _pyTruthy(trace.run_id) ? trace.run_id : '(unknown)';
    const subject = _pyTruthy(trace.subject) ? (trace.subject as string) : 'unknown';
    const label = Object.prototype.hasOwnProperty.call(_SUBJECT_LABELS, subject)
        ? _SUBJECT_LABELS[subject]
        : subject;
    const started = _pyTruthy(trace.generated_at) ? trace.generated_at : '';
    return (
        `# explain last — run ${run_id}\n`
        + '\n'
        + `**Subject:** ${label} · **Started:** ${started}\n`
    );
}

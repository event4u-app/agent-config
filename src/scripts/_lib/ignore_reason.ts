/**
 * The one inline-ignore shape every design linter reads:
 * `<prefix>-disable[-line|-next-line] <rule> -- <reason>`
 * (road-to-tells-a-near-miss-can-refute 0.3). An ignore without a reason still
 * applies for one minor version and is reported as `ignore-without-reason`.
 */

/** The text after ` -- ` on an ignore line, or null when none was given. */
export function ignoreReason(line: string): string | null {
    const m = /\s--\s+(.*?)\s*(?:\*\/|-->|$)/.exec(line);
    const reason = m?.[1]?.trim() ?? '';
    return reason === '' ? null : reason;
}

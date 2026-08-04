/**
 * Markdown table-row splitting, escape-aware.
 *
 * Both plan-governance validators parse pipe tables whose cells legitimately
 * contain an escaped pipe: the Risk-Register contract example writes
 * `product \| implementation`, and findings text routinely describes unions or
 * flags (`text\|json`). Splitting on every `|` shifts every later cell by one,
 * so `Risk type` becomes `product \` and a findings row's `Status` becomes a
 * fragment of its own Finding text — a spurious block with no fix except
 * rewording the prose.
 *
 * One definition, imported by both validators: the same defect appearing twice
 * is what made this a shared helper rather than a local function.
 */

/** Split on unescaped `|` only, drop the outer delimiters, unescape, trim. */
export function splitMarkdownRow(line: string): string[] {
    let inner = line.trim();
    if (inner.startsWith('|')) {
        inner = inner.slice(1);
    }
    // A trailing pipe is a delimiter only when it is not itself escaped.
    if (inner.endsWith('|') && !inner.endsWith('\\|')) {
        inner = inner.slice(0, -1);
    }
    return inner.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

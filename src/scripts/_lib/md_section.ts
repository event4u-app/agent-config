/**
 * Structural markdown section edits — anchored on a LINE, never on a substring.
 *
 * WHY THIS EXISTS. Measured 2026-08-20, and it was the single costliest error
 * of that session. A script located a section with
 * `text.index('## Acceptance criteria')` and sliced there. The first match was
 * not the heading: it was a **quotation of that heading inside a step's prose**,
 * one paragraph earlier. The slice cut mid-step, the document silently lost its
 * risk register, and it took two calls to notice and two more to rebuild.
 *
 * Three properties made it expensive, and all three are generic:
 *
 *   1. the anchor was a substring, so content that *mentions* a heading is
 *      indistinguishable from the heading;
 *   2. the edit was destructive rather than checked — one match was assumed;
 *   3. nothing verified the document's shape afterwards, so the loss was silent.
 *
 * This module closes all three. It refuses on zero matches and on more than
 * one, because "take the first" is exactly the behaviour that failed. And
 * `headings()` plus `assertShapePreserved()` make a dropped section loud.
 */

export class SectionError extends Error {}

/** Every ATX heading in the document, in order, as `## Title` including hashes. */
export function headings(text: string): string[] {
    return text.split('\n').filter((l) => /^#{1,6}\s+\S/.test(l));
}

/** Line indices of a heading matched at LINE START and exactly. */
function headingLines(lines: readonly string[], heading: string): number[] {
    const want = heading.trim();
    const out: number[] = [];
    lines.forEach((l, i) => {
        if (l.trim() === want) {
            out.push(i);
        }
    });
    return out;
}

/** The heading's own level, e.g. 2 for `## X`. */
function levelOf(heading: string): number {
    const m = /^(#{1,6})\s/.exec(heading.trim());
    if (m === null) {
        throw new SectionError(`not an ATX heading: ${JSON.stringify(heading)}`);
    }
    return (m[1] as string).length;
}

/**
 * `[start, end)` line range of the section, from its heading up to the next
 * heading of the same or a higher level (or EOF).
 *
 * Throws when the heading appears zero times or more than once — the caller
 * decides what to do, and neither case may be silently resolved by taking the
 * first hit.
 */
export function sectionRange(text: string, heading: string): [number, number] {
    const lines = text.split('\n');
    const hits = headingLines(lines, heading);
    if (hits.length === 0) {
        throw new SectionError(`heading not found at line start: ${JSON.stringify(heading)}`);
    }
    if (hits.length > 1) {
        throw new SectionError(
            `heading is ambiguous — ${String(hits.length)} occurrences at lines ` +
                `${hits.map((h) => String(h + 1)).join(', ')}: ${JSON.stringify(heading)}`,
        );
    }
    const start = hits[0] as number;
    const level = levelOf(heading);
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        const l = lines[i] as string;
        const m = /^(#{1,6})\s+\S/.exec(l);
        if (m !== null && (m[1] as string).length <= level) {
            end = i;
            break;
        }
    }
    return [start, end];
}

/** The section's text, heading line included. */
export function extractSection(text: string, heading: string): string {
    const [s, e] = sectionRange(text, heading);
    return text.split('\n').slice(s, e).join('\n');
}

/** Replace the section's body, heading line included, with `replacement`. */
export function replaceSection(text: string, heading: string, replacement: string): string {
    const lines = text.split('\n');
    const [s, e] = sectionRange(text, heading);
    return [...lines.slice(0, s), ...replacement.split('\n'), ...lines.slice(e)].join('\n');
}

/**
 * Assert that an edit did not lose a section it was not meant to touch.
 *
 * `allowedRemoved` / `allowedAdded` name the headings the edit intends to
 * change; anything else disappearing or appearing throws. This is the check
 * that would have caught the measured failure at the moment it happened rather
 * than two calls later.
 */
export function assertShapePreserved(
    before: string,
    after: string,
    opts: { allowedRemoved?: readonly string[]; allowedAdded?: readonly string[] } = {},
): void {
    const norm = (h: string): string => h.trim();
    const b = headings(before).map(norm);
    const a = headings(after).map(norm);
    const allowedRemoved = new Set((opts.allowedRemoved ?? []).map(norm));
    const allowedAdded = new Set((opts.allowedAdded ?? []).map(norm));

    const removed = b.filter((h) => !a.includes(h) && !allowedRemoved.has(h));
    const added = a.filter((h) => !b.includes(h) && !allowedAdded.has(h));
    if (removed.length > 0 || added.length > 0) {
        const parts: string[] = [];
        if (removed.length > 0) {
            parts.push(`lost ${String(removed.length)}: ${removed.join(' · ')}`);
        }
        if (added.length > 0) {
            parts.push(`gained ${String(added.length)}: ${added.join(' · ')}`);
        }
        throw new SectionError(`document shape changed unexpectedly — ${parts.join('; ')}`);
    }
}

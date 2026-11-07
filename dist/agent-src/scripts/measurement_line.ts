/**
 * A roadmap that changed a default asset closes only with the measurement it
 * ran, or one line naming why none was possible.
 *
 * A default asset is what loads in every session: a rule, a skill (its catalog
 * entry), CLAUDE.md or AGENTS.md. "Changed" is read from the roadmap itself —
 * the paths its closed steps name, receipts included — because the commits of a
 * roadmap span many pull requests and none of them says which roadmap it served.
 * A false positive costs one line; the line exists for exactly that case.
 */

const DEFAULT_ASSET_RE =
    /(?<![\w./-])((?:src|dist\/agent-src)\/rules\/[\w.-]+\.md|(?:src|dist\/agent-src)\/skills\/[\w.-]+\/SKILL\.md|CLAUDE\.md|AGENTS\.md)(?![\w/-])/g;
const STEP_RE = /^\s*[-*]\s+\[(.)\]/;
const HEADING_RE = /^#{1,6}\s/;
const BODY_LINE_RE = /^\s*(?:[-*]\s+)?\*{0,2}Measurement:\*{0,2}[ \t]*\S/im;
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

/** Default-asset paths named in closed (`[x]`) steps, sorted and unique. */
export function defaultAssetsChanged(text: string): string[] {
    const found = new Set<string>();
    let inClosed = false;
    for (const line of text.split('\n')) {
        const step = STEP_RE.exec(line);
        if (step !== null) inClosed = step[1] === 'x' || step[1] === 'X';
        else if (HEADING_RE.test(line) || line.trim() === '') inClosed = false;
        if (!inClosed) continue;
        for (const m of line.matchAll(DEFAULT_ASSET_RE)) found.add(m[1] as string);
    }
    return [...found].sort();
}

/** A non-empty `Measurement:` line in the body, or a `measurement:` frontmatter key. */
export function hasMeasurementLine(text: string): boolean {
    const fm = FRONTMATTER_RE.exec(text);
    if (fm !== null && /^measurement:[ \t]*\S/m.test(fm[1] as string)) return true;
    const body = fm !== null ? text.slice(fm[0].length) : text;
    return BODY_LINE_RE.test(body);
}

/** Why the roadmap may not close yet, or null. */
export function measurementLineProblem(text: string): string | null {
    const assets = defaultAssetsChanged(text);
    if (assets.length === 0 || hasMeasurementLine(text)) return null;
    return (
        `changed default asset(s) ${assets.join(', ')} but carries no measurement line. ` +
        'Add `Measurement: <report or result>` or `Measurement: none possible — <reason>`.'
    );
}

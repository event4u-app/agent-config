/**
 * The `status: carrier` predicate, and the reasoning five readers share.
 *
 * A carrier is a roadmap whose job is to hold obligations deferred out of a
 * parent that is already archived. Every item in it has an unmet resumption
 * trigger, and it has no `## Phase` headings, so it is skipped wherever a draft
 * is: the dashboard, `/roadmap:process-*`, the trackability check and the plan
 * risk register. It differs from a draft in what it costs to remove — a draft
 * may be deleted freely, a carrier may not.
 *
 * This module exists because the predicate had two implementations within one
 * change and five callers within one week. Two implementations of one frontmatter
 * test drift, and the one nobody runs locally drifts first — the same
 * memory-twin failure this repository has already recorded against a fixture
 * corpus. One test, one place, and the reasoning above lives beside it rather
 * than being restated in each caller.
 *
 * The read is frontmatter-scoped on purpose. A fenced `status: carrier` inside a
 * roadmap that documents the syntax is not a declaration, and a body-wide match
 * turned exactly that into a hard failure before a review caught it.
 */

/** The frontmatter values that mean "not schedulable work, and not disposable". */
export const CARRIER_VALUES: ReadonlySet<string> = new Set(['carrier']);

/** The leading `---\n…\n---` block, or null when the text carries none. */
export function frontmatterBlock(text: string): string | null {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    return m === null ? null : (m[1] ?? '');
}

/** True when `text`'s FRONTMATTER declares one of {@link CARRIER_VALUES}. */
export function declaresCarrier(text: string | null | undefined): boolean {
    if (text === null || text === undefined) {
        return false;
    }
    const fm = frontmatterBlock(text);
    if (fm === null) {
        return false;
    }
    const m = /^status:[ \t]*([A-Za-z-]+)[ \t]*$/m.exec(fm);
    return m !== null && CARRIER_VALUES.has((m[1] ?? '').toLowerCase());
}

/**
 * Count the top-level roadmaps in `roadmapRoot` that declare themselves carriers.
 *
 * Lives here rather than in the estate gate because it is the same fact as the
 * predicate above, read over a directory instead of a string, and the gate that
 * needs it is already at its source-size ceiling.
 *
 * @param isCandidate the caller's own roadmap-filename test, so this module does
 *        not acquire a second opinion about what counts as a roadmap.
 */
export function countDeclaredCarriers(
    roadmapRoot: string,
    isCandidate: (name: string) => boolean,
    fsLike: {
        readdirSync: (p: string) => string[];
        statSync: (p: string) => { isFile: () => boolean };
        readFileSync: (p: string, enc: 'utf-8') => string;
    },
    join: (...parts: string[]) => string,
): number {
    let names: string[];
    try {
        names = fsLike.readdirSync(roadmapRoot);
    } catch {
        return 0;
    }
    let n = 0;
    for (const name of names) {
        if (!name.endsWith('.md') || !isCandidate(name)) {
            continue;
        }
        const abs = join(roadmapRoot, name);
        try {
            if (!fsLike.statSync(abs).isFile()) {
                continue;
            }
            if (declaresCarrier(fsLike.readFileSync(abs, 'utf-8'))) {
                n += 1;
            }
        } catch {
            continue;
        }
    }
    return n;
}

/**
 * Fixture design — why two of the estate self-test cases are shaped as they are.
 *
 * The reasoning behind two of `check_estate_count`'s self-test cases, kept here
 * because the gate that holds them is at its source-size ceiling and because
 * both facts are about the carrier status rather than about that gate.
 *
 * **The deletion case's addition is a DRAFT, and that is the whole design.**
 * A carrier holds obligations lifted out of an already-archived parent, so
 * paying an offset for removing one rewards the loss: the deletion buys nothing
 * and the addition stays unpaid. With an *ordinary* addition the growth half and
 * the unpaid half coincide — growth iff `n > a`, unpaid iff `n > a` — so the
 * case rejected on two independent grounds and stayed red with the carrier
 * branch reverted, asserting nothing about the feature it named. A draft is
 * invisible to `collect()`, so the count half cannot move and only the offset
 * scoring decides.
 *
 * **The count case asserts the flip BACK, not the flip TO.** A reclassification
 * is not a disposal in either direction, but the flip *to* carrier cannot be
 * asserted by exit code: it lowers the count, a count below the floor is a
 * drawdown, and a drawdown is free whichever way carriers are counted. Its
 * consequence is assertable — with carriers uncounted the flip lowers the floor,
 * so flipping the same file back reads as growth and must be paid for. That is
 * the fixture's state, with the carrier already in the base tree, and it rejects
 * with the carrier term removed from the count. The neutrality of the forward
 * flip is asserted directly in `check_estate_count.test.ts`, where a count is
 * readable.
 */

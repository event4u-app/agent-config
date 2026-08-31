/**
 * A lexical shortlist over the existing BM25 core — a SHORTLIST, never a decider.
 *
 * `road-to-governed-harness-evolution` Phase 6, step 6.3.
 *
 * > *6.3 Only then consider a lexical shortlist, and only as a shortlist. Over
 * > the existing BM25 core. No embeddings […]. The skipped parent proposed the
 * > shortlist and explicitly refused it as final truth.*
 * > verify: **the shortlist feeds a later stage and never decides alone.**
 *
 * ## No embeddings, and the citation this step carried had moved
 *
 * The step's own text cites `docs/contracts/no-runtime-boundary.md:40` for the
 * classification. That file is now a **superseded pointer** (ADR-249,
 * 2026-08-27) and line 40 no longer says it. The substance survived the move
 * intact and is quoted from its live home instead:
 * `docs/contracts/resident-process-governance.md:82` — *"A code-graph cache
 * passes; a vector index fails"*, under the P3 state-store test, with P4
 * separately prohibiting any index build requiring network or model calls.
 * So this module builds over `_lib/lexical_index.ts` — hand-rolled BM25, pure
 * Node stdlib, the core ADR-061 already sanctions. A static scan in
 * `tests/scripts/_lib/lexical_shortlist.test.ts` asserts this module and that
 * core reach no embedding construct, no vector store and no model call. The
 * construct list lives in the test rather than here for a mechanical reason:
 * a scanner whose banned literals sit in the file it scans matches its own
 * declaration and can never pass — the same reason
 * `tests/scripts/governed_harness_no_live_harness.test.ts` keeps its banned set
 * on the test side.
 *
 * ## "Never decides alone", made mechanical rather than promised
 *
 * A shortlist decides alone in exactly two ways, and both are closed here by
 * construction rather than by a caller's discipline:
 *
 *   1. **By addition** — delivering something the authoritative matcher did not
 *      fire on. Impossible: {@link orderByShortlist} takes the matcher's output
 *      as its input domain and returns a PERMUTATION of it. Ids the shortlist
 *      ranks that the matcher did not return are dropped on the floor, and
 *      {@link selectForInjection}'s tie-break argument is consulted only to
 *      order ids that are already in `matches`.
 *   2. **By subtraction** — silently removing a matcher hit, which is a
 *      decision dressed as a filter. Impossible: the same permutation
 *      invariant. {@link ShortlistDecidedAloneError} is thrown when the output
 *      id multiset differs from the input's in either direction, so a future
 *      edit that turns the reordering into a filter fails loudly instead of
 *      quietly losing recall.
 *
 * The shortlist's actual job is the third thing, and it is a real one: when the
 * per-prompt byte cap BINDS, something has to choose which matched bodies
 * survive it. Today that is the matcher's trigger-hit count and then router
 * declaration order — and the hit count is a coarse integer on which most rules
 * tie, so the surviving set is decided by declaration order, which is not a
 * relevance signal at all. The shortlist supplies one, subordinate to the
 * matcher score and never above it.
 *
 * ## Subordination is an ORDER of comparison keys, and the order is the contract
 *
 * `score desc → shortlist rank → router order`. The matcher's verdict is read
 * first and the shortlist only breaks its ties. Promoting the shortlist above
 * `score` would let a lexically-similar rule outrank one the matcher fired on
 * twice, which is the shortlist deciding — a test pins the key order and is
 * proved to go red when it is inverted.
 *
 * ## What this module does NOT claim
 *
 * That the shortlist improves anything. Whether a lexical tie-break beats
 * declaration order under a binding cap is a MEASUREMENT, and step 6.4 is where
 * the loss ceiling for it gets pre-registered. `model_rule_injection
 * --three-arm --shortlist` runs the arm with it, default OFF, so 6.1's recorded
 * figures are reproducible unchanged.
 */
import { LexicalIndex, type IndexDoc } from './lexical_index.js';
import { allTierRules, loadRuleBody, type Router, type TierRuleMatch } from './rule_injection.js';

/**
 * How many ids a shortlist may carry.
 *
 * A STATED default, not a measured optimum, and deliberately generous: this
 * shortlist narrows nothing (it reorders), so `k` bounds only how far down the
 * BM25 ranking a tie-break signal is available before router order takes over.
 * Revisit-if 6.4 measures a cap-drop the shortlist could have prevented at a
 * rank beyond it.
 */
export const SHORTLIST_SIZE = 40;

export class ShortlistDecidedAloneError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ShortlistDecidedAloneError';
    }
}

/**
 * Index every tier rule that has a projected body.
 *
 * Kernel rules are excluded for the same reason `_lib/rule_injection.ts`
 * excludes them from injection: they are standing context by definition, so
 * they are never candidates for a cap that only ever binds on injected bodies.
 * `allTierRules` already returns the non-kernel set.
 */
export function buildRuleIndex(repoRoot: string, router: Router): LexicalIndex {
    const docs: IndexDoc[] = [];
    for (const r of allTierRules(router)) {
        const body = loadRuleBody(repoRoot, r.id);
        if (body === null) continue;
        // The id is joined into the text on purpose: a rule's own name is the
        // single most reliable lexical signal it carries, and hyphenated ids
        // tokenise into exactly the words a prompt about that rule would use.
        docs.push({ id: r.id, text: `${r.id.split('-').join(' ')}\n${body}` });
    }
    return new LexicalIndex(docs);
}

/**
 * The ranked shortlist for one prompt. BM25 only; no model call, no embedding.
 *
 * Returns ids in descending relevance, capped at `k`. An empty result is a real
 * answer — it means no indexed body shares a scoring term with the prompt, and
 * the caller then falls back to router order exactly as it does today.
 */
export function shortlistIds(
    index: LexicalIndex,
    prompt: string,
    k: number = SHORTLIST_SIZE,
): string[] {
    if (k <= 0) return [];
    return index.rank([prompt]).slice(0, k).map((r) => r.id);
}

/**
 * Rank lookup: id → position in the shortlist, or `Infinity` for absent.
 *
 * `Infinity` rather than a large integer so an unshortlisted id can never sort
 * above a shortlisted one by arithmetic accident.
 */
export function shortlistRanks(ranked: readonly string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const [i, id] of ranked.entries()) {
        if (!m.has(id)) m.set(id, i);
    }
    return m;
}

/**
 * Reorder the matcher's output by the shortlist — a PERMUTATION, always.
 *
 * This is the function that makes "never decides alone" checkable. It takes the
 * matcher's verdict as its input domain, applies the same key order
 * {@link selectForInjection} applies (`score desc → shortlist rank → router
 * order`), and REFUSES to return anything whose id multiset differs from what
 * it was given.
 *
 * @throws {ShortlistDecidedAloneError} when the result would add or drop an id.
 */
export function orderByShortlist(
    matches: readonly TierRuleMatch[],
    ranked: readonly string[],
): TierRuleMatch[] {
    const rank = shortlistRanks(ranked);
    const out = [...matches].sort(
        (a, b) =>
            b.score - a.score ||
            (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) ||
            a.order - b.order,
    );
    assertPermutation(matches, out);
    return out;
}

/** Same-multiset assertion, in both directions. Exported so a test can drive it. */
export function assertPermutation(
    before: readonly TierRuleMatch[],
    after: readonly TierRuleMatch[],
): void {
    const count = (xs: readonly TierRuleMatch[]): Map<string, number> => {
        const m = new Map<string, number>();
        for (const x of xs) m.set(x.id, (m.get(x.id) ?? 0) + 1);
        return m;
    };
    const a = count(before);
    const b = count(after);
    const added: string[] = [];
    const dropped: string[] = [];
    for (const [id, n] of b) {
        if ((a.get(id) ?? 0) < n) added.push(id);
    }
    for (const [id, n] of a) {
        if ((b.get(id) ?? 0) < n) dropped.push(id);
    }
    if (added.length > 0 || dropped.length > 0) {
        throw new ShortlistDecidedAloneError(
            'the shortlist changed the matcher`s set instead of ordering it' +
                (added.length > 0 ? ` — added ${added.sort().join(', ')}` : '') +
                (dropped.length > 0 ? ` — dropped ${dropped.sort().join(', ')}` : '') +
                '. A shortlist that adds delivers what the matcher never fired on; one that ' +
                'drops decides by subtraction. Both are the shortlist deciding alone.',
        );
    }
}

/**
 * A per-prompt shortlist function, bound to one repo root and router.
 *
 * The index is built ONCE and reused for every prompt — building it per prompt
 * would make the cheap stage the expensive one, which is the opposite of what a
 * shortlist is for.
 */
export function makePromptShortlist(
    repoRoot: string,
    router: Router,
    k: number = SHORTLIST_SIZE,
): (prompt: string) => readonly string[] {
    const index = buildRuleIndex(repoRoot, router);
    return (prompt: string) => shortlistIds(index, prompt, k);
}

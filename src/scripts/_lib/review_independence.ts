/**
 * Review independence — a recorded property of a review, never a promise.
 *
 * The failure this closes: a review whose members all share a model family
 * produces an artifact byte-indistinguishable from one backed by independent
 * models, so a consumer reads "no findings" as acceptance either way. The
 * self-review gate is the live instance — it calls ONE Anthropic client, and
 * the ledger it writes says nothing about that.
 *
 * Derived, never set by hand: `acceptance_status` follows from
 * `review_independence`, so a same-family set carrying `accepted` is
 * unrepresentable rather than merely forbidden. Two fields a producer can set
 * inconsistently would reintroduce the ambiguity the pair exists to remove.
 *
 * Evidence: agents/evidence/eval-findings/metric-loop-s03.md.
 */

/** The five providers `ai_council/config.ts::_VALID_PROVIDERS` admits. */
const PROVIDER_FAMILY: Readonly<Record<string, string>> = {
    anthropic: 'anthropic',
    openai: 'openai',
    gemini: 'google',
    xai: 'xai',
    perplexity: 'perplexity',
};

export type ReviewIndependence = 'cross-family' | 'same-family' | 'single-member' | 'unknown';
export type AcceptanceStatus = 'accepted' | 'provisional';

/**
 * How much INDEPENDENT evidence backs the verdict — deliberately orthogonal to
 * how much effort the reviewer spent.
 *
 * Collapsing the two is what lets a long, careful, single-model pass read as
 * acceptance: effort is visible in the artifact (findings, detail, rationale)
 * and independence is not, so a reader with only one axis substitutes the one
 * they can see. A five-hour same-family review is `single-pass`, and a terse
 * two-family one is `independent`. That inversion is the point.
 */
export type Assurance = 'unreviewed' | 'single-pass' | 'independent';

export function reviewIndependence(memberNames: readonly string[]): ReviewIndependence {
    const present = memberNames.map((n) => n.trim()).filter((n) => n.length > 0);
    if (present.length === 0) return 'unknown';
    if (present.length === 1) return 'single-member';
    const families = new Set(present.map((n) => PROVIDER_FAMILY[n] ?? `unknown:${n}`));
    return families.size > 1 ? 'cross-family' : 'same-family';
}

/**
 * Only a cross-family set may be described as acceptance.
 *
 * `unknown` maps to `provisional`, not to a third value: an absent member set
 * is not evidence of independence, and the safe direction on an integrity field
 * is the weaker claim.
 */
export function acceptanceStatus(independence: ReviewIndependence): AcceptanceStatus {
    return independence === 'cross-family' ? 'accepted' : 'provisional';
}

export function assuranceFor(independence: ReviewIndependence): Assurance {
    if (independence === 'cross-family') return 'independent';
    if (independence === 'unknown') return 'unreviewed';
    return 'single-pass';
}

export interface IndependenceFields {
    readonly review_independence: ReviewIndependence;
    readonly acceptance_status: AcceptanceStatus;
    readonly assurance: Assurance;
    readonly reviewers: readonly string[];
}

/** The three fields plus the member set they were derived from. */
export function independenceFields(memberNames: readonly string[]): IndependenceFields {
    const independence = reviewIndependence(memberNames);
    return {
        review_independence: independence,
        acceptance_status: acceptanceStatus(independence),
        assurance: assuranceFor(independence),
        reviewers: [...memberNames],
    };
}

/**
 * Consistency violations for an artifact that already carries the fields.
 *
 * The gate's teeth: a producer that hand-set `accepted` beside a same-family
 * independence is caught here rather than trusted.
 */
export function independenceViolations(doc: Record<string, unknown>): string[] {
    const out: string[] = [];
    const indep = doc['review_independence'];
    const accept = doc['acceptance_status'];
    const assur = doc['assurance'];
    if (indep === undefined) {
        out.push('review_independence is absent — an artifact that does not declare its independence reads as acceptance by default');
        return out;
    }
    const expectedAccept = acceptanceStatus(indep as ReviewIndependence);
    if (accept !== expectedAccept) {
        out.push(
            `acceptance_status is ${String(accept)} but review_independence ${String(indep)} derives ${expectedAccept}`,
        );
    }
    const expectedAssur = assuranceFor(indep as ReviewIndependence);
    if (assur !== undefined && assur !== expectedAssur) {
        out.push(`assurance is ${String(assur)} but review_independence ${String(indep)} derives ${expectedAssur}`);
    }
    return out;
}

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
 * How the reviewer relates to the AUTHOR — a second axis, added 2026-08-23 by
 * `road-to-review-independence` step 2.1.
 *
 * Model family and author relation are different questions, and the type carried only
 * the first. **A cross-family pair that both read the implementer's envelope is not
 * independent in the sense that matters here**: they disagree about the model, and they
 * share the framing of what the change is for and what counts as done.
 *
 * - `fresh` — no implementation context. A separate dispatch that received the diff and
 *   the scope, and not the author's envelope.
 * - `same-session` — ran inside the author's session, with the implementation context in
 *   scope. The common path today, and the one this axis exists to make visible.
 * - `unknown` — not recorded. Treated as `same-session` for derivation, because an
 *   unrecorded relation is not evidence of freshness and the safe direction on an
 *   integrity field is the weaker claim (the same reasoning `unknown` already gets on
 *   the family axis).
 */
export type ContextRelation = 'fresh' | 'same-session' | 'unknown';

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
export function acceptanceStatus(
    independence: ReviewIndependence,
    relation: ContextRelation = 'unknown',
): AcceptanceStatus {
    if (independence !== 'cross-family') return 'provisional';
    // BOTH axes, and this is the whole point of step 2.1: a cross-family pair that both
    // sat in the author's session shares the framing even though it disagrees about the
    // model. `unknown` falls here too — an unrecorded relation is not evidence of
    // freshness. The parameter defaults to `unknown` so every existing caller keeps
    // compiling and gets the SAFER answer rather than the old one.
    return relation === 'fresh' ? 'accepted' : 'provisional';
}

export function assuranceFor(
    independence: ReviewIndependence,
    relation: ContextRelation = 'unknown',
): Assurance {
    if (independence === 'unknown') return 'unreviewed';
    // `independent` requires both axes, for the same reason `accepted` does.
    if (independence === 'cross-family' && relation === 'fresh') return 'independent';
    return 'single-pass';
}

export interface IndependenceFields {
    readonly review_independence: ReviewIndependence;
    /** The recorded second axis. Derived fields below follow from BOTH. */
    readonly context_relation: ContextRelation;
    readonly acceptance_status: AcceptanceStatus;
    readonly assurance: Assurance;
    readonly reviewers: readonly string[];
}

/**
 * The recorded axes plus the fields derived from them.
 *
 * `context_relation` defaults to `unknown` so an existing caller that names only its
 * members keeps compiling — and gets `provisional` rather than the `accepted` it used to
 * get. That direction is deliberate: a producer that has not said whether its reviewer
 * was fresh has not earned the stronger claim.
 */
export function independenceFields(
    memberNames: readonly string[],
    relation: ContextRelation = 'unknown',
): IndependenceFields {
    const independence = reviewIndependence(memberNames);
    return {
        review_independence: independence,
        context_relation: relation,
        acceptance_status: acceptanceStatus(independence, relation),
        assurance: assuranceFor(independence, relation),
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
    // The recorded relation, not a default: `independenceViolations` judges an artifact
    // that already carries the fields, so reading `unknown` when the artifact says
    // `fresh` would flag a correct producer.
    const relRaw = doc['context_relation'];
    const rel: ContextRelation =
        relRaw === 'fresh' || relRaw === 'same-session' ? relRaw : 'unknown';
    const expectedAccept = acceptanceStatus(indep as ReviewIndependence, rel);
    if (accept !== expectedAccept) {
        out.push(
            `acceptance_status is ${String(accept)} but review_independence ${String(indep)} derives ${expectedAccept}`,
        );
    }
    const expectedAssur = assuranceFor(indep as ReviewIndependence, rel);
    if (assur !== undefined && assur !== expectedAssur) {
        out.push(`assurance is ${String(assur)} but review_independence ${String(indep)} derives ${expectedAssur}`);
    }
    return out;
}

/**
 * The zero-cost structural disagreement signal.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` Phase 6.1: six
 * components — stance divergence, finding overlap, contradiction count,
 * confidence spread, rank uncertainty, novelty / self-similarity — computed from
 * outputs the run **already paid for**.
 *
 * ## The contract is the absence of a call
 *
 * The step's verify is not "the numbers look right"; it is *"no extra model call
 * is issued; call count is unchanged"*. So this module is a pure function of
 * retained output: it imports no client, opens no socket, spawns no process, and
 * reads no file. `argument_exhaustion.ts:40-42` already states that property as
 * 6.1's contract while consuming it; this is the module it was pointing at.
 *
 * Purity is enforced structurally rather than by discipline: every input arrives
 * as an argument, so there is no path from here to a provider even if a future
 * edit wanted one. A test asserts the import surface directly, because a
 * regression here is silent — an added import spends money without changing a
 * single number this module returns.
 *
 * ## Nothing is re-derived
 *
 * Each component reads the verdict the tree already computes rather than a second
 * opinion about the same bytes:
 *
 * - stance divergence and confidence spread read `StanceTallyResult`
 *   (`stance_tally.ts:146`) — never a re-parse of the stance lines. Two parses
 *   are two chances to disagree.
 * - contradiction count and rank uncertainty read the `ConsensusMetadata` map
 *   `aggregate_scores` (`consensus.ts:157`) produced — self-scores already
 *   dropped, strengths already rounded.
 * - finding overlap and self-similarity reuse `jaccardSimilarity`
 *   (`_lib/text_similarity.ts:33`), the same primitive `debate_gates.ts:40` and
 *   `recouncil_guard.ts:29` consume.
 *
 * ## An unavailable component is a result, never a zero
 *
 * A component whose evidence the run does not carry returns
 * `{ available: false, reason }`. It does **not** return `0`, and the reason is
 * an enumerated value rather than prose. A fabricated zero is worse than a
 * declared gap in both directions this signal can be read: `0` divergence reads
 * as unanimity and `0` contradictions reads as agreement, so silently defaulting
 * would make an unmeasured round look like the most convergent one — the same
 * inversion `argument_exhaustion.ts:91-95` guards against for an empty council.
 *
 * ## No composite score, deliberately
 *
 * The six are returned separately and are **not** combined. Two of them —
 * `findingOverlap` and `selfSimilarity` — rise with AGREEMENT while the other
 * four rise with DISAGREEMENT, so a consumer summing them would be adding
 * opposing axes; and weighting them against each other needs numbers no
 * measurement in this tree supplies. Phase 8.4 asks for a score that is
 * "deterministic and inspectable to start" and Phase 10.3 asks which of finding,
 * stance, confidence or evidence a call moved — both want the components, not a
 * scalar that has already discarded which axis moved.
 *
 * `revisit-if`: a benchmark arm produces measured weights for a composite. Then
 * the composite belongs in the consumer that has the measurement, still reading
 * these components as its inputs.
 */

import { findMostSimilar, jaccardSimilarity, MERGE_THRESHOLD } from '../_lib/text_similarity.js';

import type { ConsensusMetadata, Finding } from './consensus.js';
import { CONFIDENCE_FACTOR, type StanceTallyResult } from './stance_tally.js';

/**
 * The bar at which two members' findings count as the same finding — and it is
 * REUSED, not chosen. `MERGE_THRESHOLD` was fixed by the 2026-07-05 council
 * verdict as the point at which two texts are duplicates, long before this
 * signal existed, which is the same pre-registration argument
 * `recouncil_guard.ts:50` makes for reusing it there.
 *
 * It is a strict bar for prose that says the same thing in different words, so
 * `findingOverlap` UNDER-estimates agreement. That is the fail-safe direction
 * here and the reason a stricter-than-ideal number is acceptable rather than
 * merely tolerated: under-estimating overlap over-estimates disagreement, and
 * Phase 6's failure mode is stopping deliberation too early, not too late.
 *
 * `revisit-if`: two members raise a finding a human calls identical and it
 * scores below this value. The fix then belongs in `text_similarity.ts` where
 * every other consumer can see the number move.
 */
export const FINDING_MATCH_THRESHOLD = MERGE_THRESHOLD;

/** Why a component carries no value. Enumerated — never free prose. */
export type SignalGap =
    /** Stance tallying is off for this run, so there is no tally to read. */
    | 'no-stance-tally'
    /** A tally exists and no member backed an option (all abstained or unparsed). */
    | 'no-parsed-stances'
    /** Fewer than two confidence observations; a spread needs two points. */
    | 'too-few-confidence-observations'
    /** Fewer than two sources carried a finding, so there is no pair to compare. */
    | 'too-few-sourced-findings'
    /** No finding was scored by anyone, so no contradiction was observable. */
    | 'no-scored-findings'
    /** Fewer than two scored findings; a ranking needs two positions. */
    | 'too-few-ranked-findings'
    /** No member had a non-empty prior round to be compared against. */
    | 'no-prior-round';

/**
 * One component. `basis` is the observation count the value rests on, so a
 * consumer can tell a 0 measured over 40 pairs from a 0 measured over one — the
 * distinction a bare number destroys, and the reason a degenerate-but-real
 * measurement is reported rather than suppressed.
 */
export type SignalComponent =
    | { readonly available: true; readonly value: number; readonly basis: number }
    | { readonly available: false; readonly reason: SignalGap };

/** Per present member: this round's text, and its own prior round's. */
export interface MemberRound {
    readonly member: string;
    readonly current: string;
    /** `null` on round 1 — there is no prior round, which is not an empty one. */
    readonly prior: string | null;
}

export interface DisagreementInputs {
    /** The ONE tally of the round (`tallyFromResponses`), or `null` when off. */
    readonly stance: StanceTallyResult | null;
    /** Findings as already extracted, each carrying its authoring source. */
    readonly findings: readonly Finding[];
    /** The ONE `aggregate_scores` map, keyed by finding id. */
    readonly consensus: ReadonlyMap<string, ConsensusMetadata>;
    /** Present members with their current and prior round texts. */
    readonly memberRounds: readonly MemberRound[];
}

export interface DisagreementSignal {
    /**
     * 0..1, rising with disagreement. `1 − topOptionWeight / backedWeight`:
     * 0 when every backer chose one option.
     */
    readonly stanceDivergence: SignalComponent;
    /**
     * 0..1, rising with AGREEMENT. Mean symmetric share of one source's findings
     * that another source also raised.
     */
    readonly findingOverlap: SignalComponent;
    /** A count ≥ 0, rising with disagreement: scored `agree: false` votes. */
    readonly contradictionCount: SignalComponent;
    /** 0..1, rising with disagreement: normalised range of backer confidences. */
    readonly confidenceSpread: SignalComponent;
    /** 0..1, rising with disagreement: share of adjacent ranked pairs that tie. */
    readonly rankUncertainty: SignalComponent;
    /**
     * 0..1, rising with AGREEMENT (and with exhaustion): mean similarity of each
     * member's round to its own prior round.
     */
    readonly selfSimilarity: SignalComponent;
    /** How many of the six carry a value. 0..6. */
    readonly availableCount: number;
}

const gap = (reason: SignalGap): SignalComponent => ({ available: false, reason });
const ok = (value: number, basis: number): SignalComponent => ({ available: true, value, basis });

/**
 * Spread among the options members actually BACKED.
 *
 * The denominator is the summed option weight, deliberately not the tally's own
 * `w_total`: `w_total` counts abstainers and unparsed responses (see the
 * refusal-preservation invariant at `stance_tally.ts:160-176`), and dividing by
 * it would make a council where half abstained look MORE divergent than one
 * where half disagreed. Abstention and unparsed responses are already surfaced
 * separately by the tally; conflating them into divergence here would double-count
 * them as a position.
 */
function stanceDivergence(stance: StanceTallyResult | null): SignalComponent {
    if (stance === null) return gap('no-stance-tally');
    const backedWeight = stance.options.reduce((acc, o) => acc + o.weight, 0);
    const top = stance.options[0];
    if (top === undefined || backedWeight <= 0) return gap('no-parsed-stances');
    const backers = stance.options.reduce((acc, o) => acc + o.backers.length, 0);
    return ok(1 - top.weight / backedWeight, backers);
}

/**
 * Normalised range of the confidence tiers the backers declared.
 *
 * Only BACKERS are observable: `tally_stances` counts an abstention and drops
 * its confidence (`stance_tally.ts:182-185`), so an abstainer's declared
 * confidence is not in the tally and is not reconstructed here — re-parsing the
 * reply to recover it would fork the one parse this module refuses to duplicate.
 * The scope is therefore "spread among members who took a position", which is
 * stated rather than implied.
 *
 * The denominator comes from `CONFIDENCE_FACTOR` rather than a literal, so a
 * change to the tier table moves this number with it instead of forking it.
 */
function confidenceSpread(stance: StanceTallyResult | null): SignalComponent {
    if (stance === null) return gap('no-stance-tally');
    const factors = stance.options.flatMap((o) => o.backers.map((b) => CONFIDENCE_FACTOR[b.confidence]));
    if (factors.length < 2) return gap('too-few-confidence-observations');
    const span = CONFIDENCE_FACTOR.high - CONFIDENCE_FACTOR.low;
    return ok((Math.max(...factors) - Math.min(...factors)) / span, factors.length);
}

/**
 * How much of what one source raised, another source raised too.
 *
 * Symmetric per pair, because the one-directional share is a different question
 * for each side when the two sources produced different numbers of findings: a
 * source with one finding matched inside a source with twenty scores 1.0 in one
 * direction and 0.05 in the other, and neither alone describes the pair.
 */
function findingOverlap(findings: readonly Finding[]): SignalComponent {
    const bySource = new Map<string, Finding[]>();
    for (const f of findings) {
        const bucket = bySource.get(f.source);
        if (bucket === undefined) bySource.set(f.source, [f]);
        else bucket.push(f);
    }
    const sources = [...bySource.values()];
    if (sources.length < 2) return gap('too-few-sourced-findings');

    /** Share of `from`'s findings with a match at or above the threshold in `to`. */
    const matchedShare = (from: readonly Finding[], to: readonly Finding[]): number => {
        if (from.length === 0) return 0;
        const candidates = to.map((f) => ({ id: f.id, text: f.text }));
        let matched = 0;
        for (const f of from) {
            const best = findMostSimilar(f.text, candidates);
            if (best !== null && best.score >= FINDING_MATCH_THRESHOLD) matched += 1;
        }
        return matched / from.length;
    };

    let total = 0;
    let pairs = 0;
    for (let i = 0; i < sources.length; i += 1) {
        for (let j = i + 1; j < sources.length; j += 1) {
            const a = sources[i] as Finding[];
            const b = sources[j] as Finding[];
            total += (matchedShare(a, b) + matchedShare(b, a)) / 2;
            pairs += 1;
        }
    }
    return ok(total / pairs, pairs);
}

/**
 * Scored findings only — an entry with no scorer is not a zero-contradiction
 * finding, it is an unmeasured one.
 *
 * `aggregate_scores` writes an entry for EVERY finding, including ones nobody
 * scored (`consensus.ts:179-194` sets `dissent_count: 0`). Summing the map
 * wholesale would therefore report a confident `0` for a round where no scoring
 * happened at all, which is the fabricated zero this module exists not to emit.
 */
function scoredEntries(consensus: ReadonlyMap<string, ConsensusMetadata>): ConsensusMetadata[] {
    return [...consensus.values()].filter((m) => m.scorers.length > 0);
}

function contradictionCount(consensus: ReadonlyMap<string, ConsensusMetadata>): SignalComponent {
    const scored = scoredEntries(consensus);
    if (scored.length === 0) return gap('no-scored-findings');
    return ok(
        scored.reduce((acc, m) => acc + m.dissent_count, 0),
        scored.length,
    );
}

/**
 * How much of the finding ranking the record cannot resolve.
 *
 * The ranking is by `consensus_strength` descending (`consensus.ts:272-274`), and
 * two findings whose strengths are EQUAL have an order that comes from input
 * position rather than from evidence. So the measure is the share of adjacent
 * pairs that tie: 0 when every neighbour is separated, 1 when the whole order is
 * arbitrary.
 *
 * Equality is used rather than a tolerance on purpose — no new tunable. The
 * strengths arrive already rounded to three places by `pyRound`
 * (`consensus.ts:211`), so the record's own resolution is what decides a tie and
 * this module adds no threshold of its own to argue about.
 *
 * Unscored findings are excluded for the same reason as above: they all sit at
 * strength 0 and would report as a near-total tie, which measures the absence of
 * scoring rather than the uncertainty of a ranking.
 */
function rankUncertainty(consensus: ReadonlyMap<string, ConsensusMetadata>): SignalComponent {
    const strengths = scoredEntries(consensus)
        .map((m) => m.consensus_strength)
        .sort((a, b) => b - a);
    if (strengths.length < 2) return gap('too-few-ranked-findings');
    let ties = 0;
    for (let i = 1; i < strengths.length; i += 1) {
        if (strengths[i] === strengths[i - 1]) ties += 1;
    }
    return ok(ties / (strengths.length - 1), strengths.length);
}

/**
 * Each member against its own prior round — the novelty axis, as a scalar.
 *
 * The boolean gate over the same primitive stays in `debate_gates.ts:32`
 * (`is_near_duplicate`) and is not duplicated here; what this adds is the
 * underlying magnitude, which a stop predicate does not need and an
 * information-gain estimate does.
 *
 * A member with an empty current or prior text contributes nothing rather than a
 * value. That mirrors `is_near_duplicate`'s own guard (`debate_gates.ts:37-39`)
 * and it matters arithmetically: `jaccardSimilarity` defines two empty strings as
 * identical (1.0, `text_similarity.ts:36`), so an errored member would otherwise
 * enter the mean as maximal self-repetition.
 */
function selfSimilarity(memberRounds: readonly MemberRound[]): SignalComponent {
    const scores: number[] = [];
    for (const r of memberRounds) {
        if (r.prior === null) continue;
        if (r.prior.trim().length === 0 || r.current.trim().length === 0) continue;
        scores.push(jaccardSimilarity(r.prior, r.current));
    }
    if (scores.length === 0) return gap('no-prior-round');
    return ok(scores.reduce((acc, s) => acc + s, 0) / scores.length, scores.length);
}

/** Compute all six components. Pure: no I/O, no client, no model call. */
export function computeDisagreementSignal(x: DisagreementInputs): DisagreementSignal {
    const components = {
        stanceDivergence: stanceDivergence(x.stance),
        findingOverlap: findingOverlap(x.findings),
        contradictionCount: contradictionCount(x.consensus),
        confidenceSpread: confidenceSpread(x.stance),
        rankUncertainty: rankUncertainty(x.consensus),
        selfSimilarity: selfSimilarity(x.memberRounds),
    };
    return {
        ...components,
        availableCount: Object.values(components).filter((c) => c.available).length,
    };
}

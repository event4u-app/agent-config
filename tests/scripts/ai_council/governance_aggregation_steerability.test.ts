/**
 * S0.1 — is the council aggregation steerable against a refusal?
 *
 * `road-to-governance-invariants` Phase 0. The adversarial source that
 * motivated this roadmap scores candidate outputs on *anti-refusal* and selects
 * the least-guarded one. This package has a multi-provider council with an
 * aggregation step. The question: can the selection outcome be moved by how a
 * refusal is treated, and if so, by how much?
 *
 * The verify clause demands the REAL aggregation path and a margin that is a
 * number. Both hold here: `tally_stances` is imported, not reimplemented, and
 * every arm reports `top.weight − threshold`. The whole file is offline and
 * deterministic — `stance_tally.ts` has zero imports, so there is no transport
 * to stub and no spend to authorise.
 *
 * PRE-REGISTERED VERDICTS (fixed in this source before the first run):
 *
 *   NULL      — the aggregation is unmovable: no encoding of a refusal changes
 *               the selected option, and every steering margin is 0.
 *   FINDING   — any outcome reachable, or a non-zero steering margin.
 *               High severity; do not resolve the claim; open Phase 2.
 *   INCONCLUSIVE — the fixture never reaches a decision (e.g. every arm splits
 *                  for an unrelated reason). Repair the fixture.
 *
 * MEASURED VERDICT: **FINDING**, and then FIXED in the same change (Phase 2,
 * which this finding opened). The aggregation is not weight-steerable —
 * `CONFIDENCE_FACTOR` and `CONSENSUS_FRACTION` are module constants and
 * `tally_stances` takes one parameter — but it WAS *classification*-steerable:
 * `w_total` counted only members whose stance line parsed, so a refusal phrased
 * as prose was silently removed from the quorum and made consensus EASIER. The
 * direction was the dangerous one.
 *
 * This file therefore does double duty, deliberately: the pre-fix numbers are
 * kept as arithmetic in `RECORDED FINDING` so they cannot rot into an anecdote,
 * and the invariant that closed them is asserted alongside. A spike whose
 * finding is repaired should not be deleted — then nothing stops the
 * regression.
 */
import { describe, expect, it } from 'vitest';

import {
    CONFIDENCE_FACTOR,
    CONSENSUS_FRACTION,
    render_vote_tally,
    tally_stances,
} from '../../../src/scripts/ai_council/stance_tally.js';

const stance = (label: string, confidence: string, dealbreaker = 'no') =>
    `STANCE: ${label} | CONFIDENCE: ${confidence} | DEALBREAKER: ${dealbreaker}`;

/** Two members back Adopt; the third is the refuser whose encoding we vary. */
const BACKERS: ReadonlyArray<{ member: string; text: string }> = [
    { member: 'anthropic:a', text: stance('Adopt', 'high') },
    { member: 'openai:b', text: stance('Adopt', 'med') },
];

/** `top.weight − threshold`: positive clears consensus, negative splits. */
function margin(members: ReadonlyArray<{ member: string; text: string }>): number {
    const r = tally_stances(members);
    const top = r.options[0];
    return (top?.weight ?? 0) - r.threshold;
}

function outcome(members: ReadonlyArray<{ member: string; text: string }>): string | null {
    return tally_stances(members).consensus?.label ?? null;
}

describe('S0.1 — refusal-preservation in the council aggregation', () => {
    it('PREMISE: the fixture reaches a decision boundary, not a degenerate one', () => {
        // Both arms must be near the ⅔ line, or the comparison below is
        // measuring an unrelated landslide and the verdict is INCONCLUSIVE.
        const asAbstain = [...BACKERS, { member: 'x:c', text: stance('abstain', 'high') }];
        const r = tally_stances(asAbstain);
        expect(r.w_total).toBe(3);
        expect(r.threshold).toBeCloseTo(2.0, 10);
        expect(r.options[0]?.weight).toBeCloseTo(1.75, 10);
    });

    it('the weights themselves offer no knob — this is NOT the steering vector', () => {
        // Recorded so the finding is not misread. `tally_stances` takes exactly
        // one parameter; the coefficients are module constants. An attacker
        // cannot dial a weight.
        expect(CONFIDENCE_FACTOR).toEqual({ high: 1.0, med: 0.75, low: 0.5 });
        expect(CONSENSUS_FRACTION).toBeCloseTo(2 / 3, 12);
        expect(tally_stances.length).toBe(1);
    });

    it('INVARIANT — how a refusal is phrased no longer moves the selection (margin = 0)', () => {
        // This is the Phase-2 verify clause, and it is the same two arms the
        // spike measured. The numbers it USED to produce are recorded in the
        // finding below; what this asserts is that they are now equal.
        //
        // Arm 1: the refusal parses as an explicit abstention.
        const abstained = [...BACKERS, { member: 'x:c', text: stance('abstain', 'high') }];
        // Arm 2: the same refusal as prose with no STANCE line.
        const unparseable = [
            ...BACKERS,
            { member: 'x:c', text: 'I will not answer this; it asks me to bypass a safety floor.' },
        ];

        expect(margin(unparseable) - margin(abstained)).toBe(0);
        expect(outcome(unparseable)).toBe(outcome(abstained));
        expect(outcome(unparseable)).toBeNull();
    });

    it('RECORDED FINDING — the pre-fix numbers, reconstructed from the old denominator', () => {
        // The measurement that opened Phase 2, kept as arithmetic rather than
        // prose so it cannot rot into an anecdote. Before the invariant,
        // `w_total` counted only members whose stance PARSED, so the
        // unparseable arm's denominator was 2 instead of 3.
        const abstained = [...BACKERS, { member: 'x:c', text: stance('abstain', 'high') }];
        const topWeight = tally_stances(abstained).options[0]?.weight ?? 0;
        expect(topWeight).toBeCloseTo(1.75, 10);

        const preFixMarginAbstained = topWeight - CONSENSUS_FRACTION * 3;
        const preFixMarginDropped = topWeight - CONSENSUS_FRACTION * 2;
        expect(preFixMarginAbstained).toBeCloseTo(-0.25, 10);
        expect(preFixMarginDropped).toBeCloseTo(0.4166666666, 8);
        expect(preFixMarginDropped - preFixMarginAbstained).toBeCloseTo(0.6666666666, 8);
        // …and 1.75 cleared ⅔×2 = 1.333, i.e. the outcome flipped to a
        // consensus the third member had refused to give.
        expect(topWeight).toBeGreaterThan(CONSENSUS_FRACTION * 2);
    });

    it('the unparsed voice is reported to the reader, not just held in a field', () => {
        const unparseable = [
            ...BACKERS,
            { member: 'x:c', text: 'I will not answer this.' },
        ];
        const r = tally_stances(unparseable);
        expect(r.needs_repair).toEqual(['x:c']);
        // Counted in the quorum — the invariant.
        expect(r.w_total).toBe(3);
        // And surfaced. Before Phase 2 `needs_repair` had zero consumers
        // anywhere in the tree, so a shrunken signal was computed and dropped.
        const rendered = render_vote_tally(r);
        expect(rendered).toContain('unparsed');
        expect(rendered).toContain('x:c');
        expect(rendered).toContain('backing nothing');
    });

    it('the divergence signal is an observation, never a selection input', () => {
        // Phase 2's second verify: the signal must not reach the scoring path.
        // Two tallies whose ONLY difference is the unparsed member's text must
        // select identically — the string never enters the weight.
        const a = [...BACKERS, { member: 'x:c', text: 'I will not answer this.' }];
        const b = [...BACKERS, { member: 'x:c', text: 'Refusing: this bypasses a safety floor.' }];
        const ra = tally_stances(a);
        const rb = tally_stances(b);
        expect(ra.consensus).toEqual(rb.consensus);
        expect(ra.threshold).toBe(rb.threshold);
        expect(ra.options).toEqual(rb.options);
    });

    it('the direction is the dangerous one — removing a voice never raises the bar', () => {
        // A defence that made consensus HARDER on a lost refusal would be a
        // tolerable failure. This asserts the opposite is true, which is why
        // the finding is high-severity rather than cosmetic.
        const withRefuser = [...BACKERS, { member: 'x:c', text: stance('abstain', 'low') }];
        const withoutRefuser = [...BACKERS];
        expect(tally_stances(withRefuser).threshold).toBeGreaterThan(
            tally_stances(withoutRefuser).threshold,
        );
    });

    it('confidence cannot suppress an abstention that DID parse', () => {
        // The one thing that is genuinely unmovable: an abstention contributes
        // to the denominator regardless of its confidence tier, so an attacker
        // who can only influence confidence gets a margin of exactly 0.
        const high = [...BACKERS, { member: 'x:c', text: stance('abstain', 'high') }];
        const low = [...BACKERS, { member: 'x:c', text: stance('abstain', 'low') }];
        expect(margin(high) - margin(low)).toBe(0);
    });
});

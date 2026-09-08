// Tests for the per-run deliberation measurements: per-correction stage
// attribution, and the zero-marginal-value call rate.
//
// Pure string/arithmetic checks — no CLI, no network, no fixture files.
import { describe, expect, it } from 'vitest';

import {
    attributeCorrections,
    correctionSentences,
    measureDeliberation,
    runCallsFrom,
    RUN_STAGES,
    stageProduction,
    zeroMarginalValueRate,
    type DeliberationCall,
} from '../../../src/scripts/ai_council/deliberation_metrics.js';

function call(stage: string, member: string, text: string, failed = false): DeliberationCall {
    return { stage, member, text, failed };
}

const OBJECTION_A =
    'I disagree with the caching plan because the invalidation path is never exercised by the suite.';
const OBJECTION_B =
    'However, the migration is not reversible, and a rollback would strand the audit rows.';
const AGREEMENT = 'The proposal is sound and the sequencing looks right to me.';

describe('correctionSentences', () => {
    it('keeps an objection-bearing sentence', () => {
        expect(correctionSentences(OBJECTION_A)).toEqual([OBJECTION_A]);
    });

    it('drops a sentence with no objection marker', () => {
        expect(correctionSentences(AGREEMENT)).toEqual([]);
    });

    it('drops a marker-carrying fragment below the length floor', () => {
        // The marker is present; the sentence carries no position.
        expect(correctionSentences('But.')).toEqual([]);
    });
});

describe('attributeCorrections', () => {
    it('attributes a correction to the EARLIEST stage that carried it', () => {
        const calls = [
            call('deliberation', 'a/m', OBJECTION_A),
            call('peer-review', 'b/m', OBJECTION_A),
        ];
        const out = attributeCorrections(calls);
        expect(out).toHaveLength(1);
        expect(out[0]?.firstStage).toBe('deliberation');
        expect(out[0]?.firstMember).toBe('a/m');
        expect(out[0]?.firstCallIndex).toBe(0);
        expect(out[0]?.restatements).toBe(1);
    });

    it('is order-sensitive: the same pair reversed attributes to the other stage', () => {
        // Guards the contract that the caller must pass calls in RUN order —
        // a test that passed either way would not be testing attribution.
        const out = attributeCorrections([
            call('peer-review', 'b/m', OBJECTION_A),
            call('deliberation', 'a/m', OBJECTION_A),
        ]);
        expect(out[0]?.firstStage).toBe('peer-review');
    });

    it('keeps two distinct corrections apart', () => {
        const out = attributeCorrections([call('deliberation', 'a/m', `${OBJECTION_A}\n${OBJECTION_B}`)]);
        expect(out).toHaveLength(2);
        expect(out.map((a) => a.restatements)).toEqual([0, 0]);
    });

    it('ignores a failed call and an empty one', () => {
        const out = attributeCorrections([
            call('deliberation', 'a/m', OBJECTION_A, true),
            call('deliberation', 'b/m', ''),
        ]);
        expect(out).toEqual([]);
    });

    it('yields nothing when nobody objected', () => {
        expect(attributeCorrections([call('deliberation', 'a/m', AGREEMENT)])).toEqual([]);
    });
});

describe('stageProduction', () => {
    it('counts corrections against the stage that FIRST produced them', () => {
        const calls = [
            call('deliberation', 'a/m', OBJECTION_A),
            call('peer-review', 'b/m', `${OBJECTION_A} ${OBJECTION_B}`),
        ];
        const out = stageProduction(calls, attributeCorrections(calls));
        expect(out).toEqual([
            { stage: 'deliberation', produced: 1, calls: 1 },
            { stage: 'peer-review', produced: 1, calls: 1 },
        ]);
    });

    it('reports a stage that made calls and produced nothing', () => {
        const calls = [call('deliberation', 'a/m', AGREEMENT)];
        expect(stageProduction(calls, attributeCorrections(calls))).toEqual([
            { stage: 'deliberation', produced: 0, calls: 1 },
        ]);
    });
});

describe('zeroMarginalValueRate', () => {
    it('never scores the first call as zero-marginal', () => {
        const r = zeroMarginalValueRate([call('deliberation', 'a/m', OBJECTION_A)]);
        expect(r.rate).toBe(0);
        expect(r.callsScored).toBe(1);
        expect(r.callsZeroMarginal).toBe(0);
    });

    it('scores a verbatim restatement of an EARLIER call as zero-marginal', () => {
        const r = zeroMarginalValueRate([
            call('deliberation', 'a/m', OBJECTION_A),
            call('deliberation', 'b/m', OBJECTION_A),
        ]);
        expect(r.callsZeroMarginal).toBe(1);
        expect(r.rate).toBe(0.5);
    });

    it('scores a cross-member duplicate, not only a self-duplicate', () => {
        // The discriminator against a per-member reading: b restates a, and a
        // per-member novelty check would call that novel.
        const r = zeroMarginalValueRate([
            call('deliberation', 'a/m', OBJECTION_A),
            call('deliberation', 'b/m', AGREEMENT),
            call('peer-review', 'b/m', OBJECTION_A),
        ]);
        expect(r.callsZeroMarginal).toBe(1);
    });

    it('leaves two genuinely different answers at rate 0', () => {
        const r = zeroMarginalValueRate([
            call('deliberation', 'a/m', OBJECTION_A),
            call('deliberation', 'b/m', OBJECTION_B),
        ]);
        expect(r.rate).toBe(0);
    });

    it('returns null with a reason when NO call was scorable — never 0', () => {
        const r = zeroMarginalValueRate([
            call('deliberation', 'a/m', OBJECTION_A, true),
            call('deliberation', 'b/m', '   '),
        ]);
        expect(r.rate).toBeNull();
        expect(r.unavailableReason).toContain('not a rate of zero');
        expect(r.callsTotal).toBe(2);
        expect(r.callsScored).toBe(0);
    });

    it('publishes the inputs the rate can be re-derived from', () => {
        const r = zeroMarginalValueRate([
            call('deliberation', 'a/m', OBJECTION_A),
            call('deliberation', 'b/m', OBJECTION_A),
        ]);
        expect(r.callsZeroMarginal / r.callsScored).toBe(r.rate);
        expect(r.threshold).toBeGreaterThan(0);
    });
});

describe('runCallsFrom', () => {
    const resp = (provider: string, text: string, error: string | null = null) =>
        ({ provider, model: 'm', text, error }) as never;

    it('labels every stage in run order and keeps the flat list aligned', () => {
        const out = runCallsFrom({
            deliberation: [resp('a', OBJECTION_A)],
            peerReview: [resp('b', OBJECTION_B)],
            consensusExtraction: [resp('a', 'x')],
            consensusScoring: [resp('b', 'y')],
            chairman: resp('a', 'z'),
            stanceRepairs: [resp('b', 'w')],
        });
        expect(out.calls.map((c) => c.stage)).toEqual([...RUN_STAGES]);
        expect(out.responses).toHaveLength(out.calls.length);
        expect(out.calls.map((c) => c.text)).toEqual(out.responses.map((r) => r.text));
    });

    it('omits absent stages rather than emitting empty ones', () => {
        const out = runCallsFrom({ deliberation: [resp('a', OBJECTION_A)] });
        expect(out.calls.map((c) => c.stage)).toEqual(['deliberation']);
    });

    it('marks an errored response as failed so it is not scored', () => {
        const out = runCallsFrom({ deliberation: [resp('a', '', 'timeout')] });
        expect(out.calls[0]?.failed).toBe(true);
        expect(measureDeliberation(out.calls).zero_marginal_value_call_rate).toBeNull();
    });
});

describe('measureDeliberation', () => {
    it('emits both readings and their re-derivable inputs in one pass', () => {
        const calls = [
            call('deliberation', 'a/m', OBJECTION_A),
            call('peer-review', 'b/m', OBJECTION_A),
        ];
        const m = measureDeliberation(calls);
        expect(m.zero_marginal_value_call_rate).toBe(0.5);
        expect(m.zero_marginal_value_unavailable_reason).toBe('');
        expect(m.calls_scored).toBe(2);
        expect(m.correction_attributions).toHaveLength(1);
        expect(m.correction_attributions[0]?.firstStage).toBe('deliberation');
        expect(m.stage_outputs).toEqual([
            { stage: 'deliberation', produced: 1, calls: 1 },
            { stage: 'peer-review', produced: 0, calls: 1 },
        ]);
    });
});

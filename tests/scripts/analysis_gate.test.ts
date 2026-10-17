import { describe, expect, it } from 'vitest';

import type { DisagreementSignal, SignalComponent } from '../../src/scripts/ai_council/disagreement_signal.js';
import type { StopInputs } from '../../src/scripts/ai_council/argument_exhaustion.js';
import {
    MAX_ROUNDS,
    OWNER_OPTIONS,
    councilVoice,
    decideNextRound,
    evaluateGate,
    resolveConflict,
    type GateInput,
    type OpenItem,
} from '../../src/scripts/analysis_gate.js';

const STILL_ARGUING: StopInputs = {
    roundsCompleted: 1,
    dissentRepairAttempted: true,
    selfNearDuplicate: [false, false],
    unresolvedAdversarialTriggers: 0,
};
const EXHAUSTED: StopInputs = {
    roundsCompleted: 2,
    dissentRepairAttempted: true,
    selfNearDuplicate: [true, true],
    unresolvedAdversarialTriggers: 0,
};

const CONFLICT_WITH_PLAN: OpenItem = {
    id: 'a1',
    kind: 'conflict',
    plan: { executable: true, estimated_tokens: 4000, step: 'run the submodule fixture' },
};
const CONFLICT_WITHOUT_PLAN: OpenItem = { id: 'a2', kind: 'conflict' };

function gate(over: Partial<GateInput>): GateInput {
    return { roundsCompleted: 1, items: [], remainingTokens: 50_000, stop: STILL_ARGUING, ...over };
}

describe('the gain gate', () => {
    it('makes no offer on a plateaued ledger', () => {
        expect(evaluateGate(gate({})).offer).toBe(false);
        expect(evaluateGate(gate({})).reason).toBe('no-plannable-item');
    });

    it('offers one more round for a named conflict with an executable plan inside the budget', () => {
        const g = evaluateGate(gate({ items: [CONFLICT_WITH_PLAN] }));
        expect(g.offer).toBe(true);
        expect(g.settleable).toEqual(['a1']);
        expect(g.band?.level).toBe('low');
        expect(g.band?.reasons).toEqual(['a1: run the submodule fixture']);
    });

    it('makes no offer for a conflict without a plan, or with one above the remaining budget', () => {
        expect(evaluateGate(gate({ items: [CONFLICT_WITHOUT_PLAN] })).offer).toBe(false);
        expect(evaluateGate(gate({ items: [CONFLICT_WITH_PLAN], remainingTokens: 1000 })).offer).toBe(false);
    });

    it('makes no offer once the arguments are exhausted, even with a planned conflict', () => {
        const g = evaluateGate(gate({ items: [CONFLICT_WITH_PLAN], stop: { ...EXHAUSTED } }));
        expect(g.offer).toBe(false);
        expect(g.reason).toBe('exhausted');
    });

    it('does not stop on agreement before anti-conformity repair was attempted', () => {
        const g = evaluateGate(gate({ items: [CONFLICT_WITH_PLAN], stop: { ...EXHAUSTED, dissentRepairAttempted: false } }));
        expect(g.offer).toBe(true);
        expect(g.stop.blockers).toContain('dissent-repair-not-attempted');
    });

    it('never offers a fourth round', () => {
        const g = evaluateGate(gate({ roundsCompleted: MAX_ROUNDS, items: [CONFLICT_WITH_PLAN] }));
        expect(g.offer).toBe(false);
        expect(g.reason).toBe('round-cap');
    });

    it('carries the next-call score as an estimate, never as the decision', () => {
        const c = (value: number): SignalComponent => ({ available: true, value, basis: 2 });
        const signal: DisagreementSignal = {
            stanceDivergence: c(0.5),
            findingOverlap: c(0.5),
            contradictionCount: c(1),
            confidenceSpread: c(0.2),
            rankUncertainty: c(0),
            selfSimilarity: c(0.9),
            availableCount: 6,
        };
        const g = evaluateGate(
            gate({ items: [CONFLICT_WITH_PLAN], nextCall: { optionId: 'round-2', signal, unresolvedAdversarialTriggers: 0, cost: { calls: 2, costUsd: 0.2 } } }),
        );
        expect(g.offer).toBe(true);
        expect(g.estimate?.optionId).toBe('round-2');
    });
});

describe('council as judge', () => {
    it('labels a one-seat council single-voice, and two seats of one provider too', () => {
        expect(councilVoice([{ member: 'a', provider: 'anthropic', status: 'ok' }, { member: 'o', provider: 'openai', status: 'failed' }])).toBe(
            'single-voice',
        );
        expect(councilVoice([{ member: 'a', provider: 'anthropic', status: 'ok' }, { member: 'b', provider: 'anthropic', status: 'ok' }])).toBe(
            'single-voice',
        );
        expect(councilVoice([{ member: 'a', provider: 'anthropic', status: 'ok' }, { member: 'o', provider: 'openai', status: 'ok' }])).toBe('quorum');
    });

    it('resolves a conflict by tier, names an equal-tier contradiction, and lets a critical safety dissent outweigh a majority', () => {
        expect(resolveConflict({ id: 'x', safety: false, sides: [{ position: 'p', tier: 'claimed' }, { position: 'q', tier: 'read' }] })).toEqual({
            resolution: 'by-tier',
            winner: 1,
        });
        expect(resolveConflict({ id: 'x', safety: false, sides: [{ position: 'p', tier: 'read' }, { position: 'q', tier: 'read' }] })).toEqual({
            resolution: 'named',
            winner: null,
        });
        expect(
            resolveConflict({
                id: 'x',
                safety: true,
                sides: [
                    { position: 'p', tier: 'read' },
                    { position: 'p', tier: 'read' },
                    { position: 'q', tier: 'claimed', critical: true },
                ],
            }),
        ).toEqual({ resolution: 'critical-dissent', winner: 2 });
    });
});

describe('who decides the next round', () => {
    const offered = evaluateGate(gate({ items: [CONFLICT_WITH_PLAN] }));

    it('lets the council decide when it agrees and the round fits the ceiling', () => {
        expect(decideNextRound({ gate: offered, council: 'focused', roundTokens: 4000, ceilingTokens: 10_000 })).toEqual({
            decided_by: 'council',
            decision: 'focused',
        });
    });

    it('asks the owner one question on a split or above the ceiling, with a band and no percentage', () => {
        for (const d of [
            decideNextRound({ gate: offered, council: 'split', roundTokens: 4000, ceilingTokens: 10_000 }),
            decideNextRound({ gate: offered, council: 'one-more', roundTokens: 40_000, ceilingTokens: 10_000 }),
        ]) {
            expect(d.decided_by).toBe('owner');
            if (d.decided_by !== 'owner') continue;
            expect(d.question.options).toEqual(OWNER_OPTIONS);
            expect(d.question.items).toEqual(['a1']);
            expect(d.question.band.level).toBe('low');
            expect(JSON.stringify(d.question)).not.toMatch(/%/);
        }
    });

    it('decides nothing when the gate made no offer', () => {
        const none = evaluateGate(gate({}));
        expect(decideNextRound({ gate: none, council: 'one-more', roundTokens: 1, ceilingTokens: 10 })).toEqual({ decided_by: 'none' });
    });
});

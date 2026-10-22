/**
 * AC-4 of `road-to-an-analysis-family-that-deepens-itself` has two halves, and
 * only one of them was pinned.
 *
 * `analysis_gate.test.ts` pins the DECISION: the round cap before the stop
 * predicate, no fourth round, the next-call score as an estimate that never
 * decides. Nothing pinned that the run SHOWS those numbers, or that a further
 * round needs a recorded council or owner decision rather than the engine's
 * own `offer: true`. A gate whose numbers are never printed is a gate nobody
 * can audit after the fact — the run reads as "it ran one more round" with no
 * trace of why.
 *
 * Two assertions, both over the shared context file every door links, so the
 * obligation lands once rather than four times.
 *
 * A DRIFT PIN between the procedure text and the code, not evidence that a
 * door does this at run time: these cases read markdown. The behavioural half
 * is the resolver/writer unit suite named above.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { evaluateGate, MAX_ROUNDS } from '../../src/scripts/analysis_gate.js';
import type { StopInputs } from '../../src/scripts/ai_council/argument_exhaustion.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTEXT = path.join(ROOT, 'src/agent-src/contexts/execution/analysis-loop.md');
const text = fs.readFileSync(CONTEXT, 'utf-8');

describe('the gate is shown, not only obeyed', () => {
    it('the context names every field of the gate result as a thing the run prints', () => {
        for (const field of ['reason', 'settleable', 'band', 'estimate']) {
            expect(text).toContain(`\`${field}\``);
        }
        expect(text).toMatch(/after every exchange/iu);
    });

    it('a further round needs a recorded decision, never the offer alone', () => {
        expect(text).toMatch(/an offer is not a decision/iu);
        expect(text).toMatch(/recorded (council|owner)/iu);
    });

    it('the printed fields are the ones the gate actually returns, on both branches', () => {
        // Two paths, because the prose says the numbers are printed after EVERY
        // exchange: the capped branch, which never evaluates the predicate, and
        // an uncapped one that reaches the offer decision (R2 finding 11).
        const stop: StopInputs = {
            roundsCompleted: 1,
            dissentRepairAttempted: true,
            selfNearDuplicate: [true, true],
            unresolvedAdversarialTriggers: 0,
        };
        const capped = evaluateGate({ roundsCompleted: MAX_ROUNDS, items: [], remainingTokens: 0, stop });
        const uncapped = evaluateGate({ roundsCompleted: 0, items: [], remainingTokens: 0, stop });
        expect(capped.reason).toBe('round-cap');
        for (const result of [capped, uncapped]) {
            for (const field of ['reason', 'settleable', 'band', 'estimate']) {
                expect(Object.keys(result)).toContain(field);
            }
        }
    });
});

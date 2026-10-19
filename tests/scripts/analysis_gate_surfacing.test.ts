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
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { evaluateGate, MAX_ROUNDS } from '../../src/scripts/analysis_gate.js';

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
        expect(text).toMatch(/offer is not a decision|never the offer alone|an offer is not/iu);
        expect(text).toMatch(/recorded (council|owner)/iu);
    });

    it('the printed fields are the ones the gate actually returns', () => {
        const result = evaluateGate({ roundsCompleted: MAX_ROUNDS, items: [], remainingTokens: 0, stop: {
            round: MAX_ROUNDS,
            newArguments: 0,
            repairedConformity: true,
        } as never });
        for (const field of ['reason', 'settleable', 'band', 'estimate']) {
            expect(Object.keys(result)).toContain(field);
        }
    });
});

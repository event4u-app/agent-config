/**
 * Step 6.4 of road-to-governed-harness-evolution — the delivery-set measurement.
 *
 * The step`s verify has two halves and only the second is testable from code:
 * the ceiling`s ordering is a property of the git history, and the corpus
 * property — "the corpus contains at least one jointly-wrong pair" — is what
 * this file guards.
 *
 * THE POLARITY IS THE WHOLE TEST. A pair metric that counted any two skills
 * sharing a prompt would report a large number and mean nothing. So both
 * directions are pinned: every reported candidate has BOTH members adjudicated
 * `false` on that prompt, and the shared prompts where one member is `true` are
 * asserted ABSENT. A pattern gate needs its denial tested, not only its claim.
 *
 * THE BARS ARE PINNED so they cannot be re-tuned to a result after the fact:
 * the run breaches the recall-loss ceiling, and a silent edit of the constant
 * would turn a reported breach into a reported pass.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadTrainCases } from '../../src/scripts/_lib/routing_corpus.js';
import {
    K,
    RECALL_LOSS_CEILING_PP,
    TOKEN_TARGET,
    measureDelivery,
    record,
} from '../../src/scripts/measure_delivery_sets.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RECORD = path.join(REPO, 'agents/evidence/analysis/delivery-set-measurement-2026-08-31.json');

const m = measureDelivery(REPO);

describe('6.4 — the pre-registered bars are the ones the run used', () => {
    it('ceiling 20.0 pp, token target 500, k = 5', () => {
        expect(RECALL_LOSS_CEILING_PP).toBe(20.0);
        expect(TOKEN_TARGET).toBe(500);
        expect(K).toBe(5);
    });

    it('the ceiling breach is reported as a breach, not rounded away', () => {
        expect(m.recallLossPp).toBeGreaterThan(RECALL_LOSS_CEILING_PP);
        expect(m.ceilingMet).toBe(false);
    });

    it('the token target is met, and the two verdicts are independent', () => {
        expect(m.contextCostTokens).toBeLessThan(TOKEN_TARGET);
        expect(m.tokenTargetMet).toBe(true);
    });
});

describe('6.4 — the run is non-vacuous', () => {
    it('it ranked a real catalogue over a real corpus', () => {
        expect(m.catalogueSize).toBeGreaterThan(200);
        expect(m.prompts).toBeGreaterThan(500);
        expect(m.positives).toBeGreaterThan(300);
        expect(m.negatives).toBeGreaterThan(300);
    });

    it('the recall curve is monotone in k — a decreasing one would be a bug', () => {
        const ks = [1, 3, 5, 10, 20];
        for (let i = 1; i < ks.length; i++) {
            expect(m.recallCurvePp[ks[i] as number]).toBeGreaterThanOrEqual(
                m.recallCurvePp[ks[i - 1] as number] as number,
            );
        }
    });

    it('precision and benefit-given-activation are ONE quantity under two names', () => {
        // The pre-registration defined them separately and they coincide. Said
        // here rather than quietly dropping one of the two required fields.
        expect(m.benefitConditionalPp).toBe(m.precisionPp);
        expect(m.benefitUnconditionalPp).toBe(m.recallPp);
        expect(m.benefitConditionalPp).not.toBe(m.benefitUnconditionalPp);
    });
});

describe('6.4 — set compatibility, both polarities', () => {
    const cases = loadTrainCases(REPO);
    const verdict = new Map<string, boolean>();
    for (const c of cases) verdict.set(`${c.skill} ${c.prompt.trim().toLowerCase()}`, c.expect);

    it('the corpus contains at least one jointly-wrong pair (the verify clause)', () => {
        expect(m.jointlyWrongCandidates.length).toBeGreaterThanOrEqual(1);
        expect(m.sharedPrompts).toBeGreaterThan(0);
    });

    it('CLAIM — every reported pair has both members adjudicated false', () => {
        const bad = m.jointlyWrongCandidates.filter((c) => {
            const key = c.prompt.trim().toLowerCase();
            return (
                verdict.get(`${c.pair[0]} ${key}`) !== false ||
                verdict.get(`${c.pair[1]} ${key}`) !== false
            );
        });
        expect(bad).toEqual([]);
    });

    it('DENIAL — a shared prompt with a `true` member yields no pair', () => {
        // `keep fixing until the tests pass` is adjudicated false by
        // experiment-loop and TRUE by verify-repair-loop. A metric that keyed on
        // "two corpora share this prompt" would report it; this one must not.
        const mixed = 'keep fixing until the tests pass';
        expect(verdict.get(`experiment-loop ${mixed}`)).toBe(false);
        expect(verdict.get(`verify-repair-loop ${mixed}`)).toBe(true);
        expect(
            m.jointlyWrongCandidates.filter((c) => c.prompt.trim().toLowerCase() === mixed),
        ).toEqual([]);
    });

    it('the delivered-together count is reported separately from the corpus count', () => {
        // They are different questions and the pre-registration conflated them.
        expect(m.jointlyWrongPairs.length).toBeLessThanOrEqual(m.jointlyWrongCandidates.length);
    });
});

describe('6.4 — the published record reproduces from the tree', () => {
    it('every metric and every pair reproduces', () => {
        const published = JSON.parse(fs.readFileSync(RECORD, 'utf8')) as Record<string, never>;
        const fresh = record(m) as Record<string, never>;
        expect(published['metrics']).toEqual(fresh['metrics']);
        expect(published['set_compatibility']).toEqual(fresh['set_compatibility']);
        expect(published['bars']).toEqual(fresh['bars']);
    });
});

/**
 * Step 5.1 of road-to-governed-harness-evolution — the body-signal measurement.
 *
 * Four things need a guard, and only one of them is the number.
 *
 * 1. THE SEAL. The 18 holdout corpora frozen in
 *    `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md` must not
 *    be read by an analyzer authored in Phase 5. The loader skips them from the
 *    directory NAME, before any read, and the first block asserts that no case
 *    from a holdout skill reaches the measurement.
 *
 * 2. THE VERDICT FUNCTION. It was pre-registered with an ORDER — power floor,
 *    then guard, then primary — and the order is load-bearing: the run that
 *    actually happened clears the recall bar AND breaches the guard, so a
 *    verdict function that checked the primary first would have returned
 *    `signal` on the same numbers. That exact combination is pinned.
 *
 * 3. THE PUBLISHED VERDICT REPRODUCES. Step 6.5 derives its input set from the
 *    committed verdict file. A verdict nobody recomputes is a verdict nobody
 *    has checked — the failure mode the holdout pin already had once.
 *
 * 4. NON-VACUITY. A measurement over an empty catalogue or an empty corpus
 *    exits green and means nothing, so the sizes are asserted first.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    HOLDOUT_CEILING,
    corpusSkills,
    legacyShaped,
    loadCatalogue,
    loadTrainCases,
    partitionOf,
    termIndex,
    topK,
} from '../../src/scripts/_lib/routing_corpus.js';
import {
    FALSE_ACTIVATION_GUARD_PP,
    K,
    POWER_FLOOR_DISCORDANT,
    RECALL_GAIN_BAR_PP,
    mcnemarExactP,
    measure,
    verdictRecord,
} from '../../src/scripts/measure_routing_signal.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FREEZE = path.join(REPO, 'agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md');
const VERDICT = path.join(REPO, 'agents/evidence/analysis/routing-body-signal-verdict.json');

/** The skills the freeze artefact lists under its `## Holdout` heading. */
function sealedSkills(): string[] {
    const md = fs.readFileSync(FREEZE, 'utf8');
    const start = md.indexOf('## Holdout');
    const end = md.indexOf('## Train', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    return [...md.slice(start, end).matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1] as string);
}

describe('5.1 — the seal is enforced by refusal, not by filtering', () => {
    const sealed = sealedSkills();

    it('the freeze artefact still lists a non-empty holdout (a check over nothing passes)', () => {
        expect(sealed.length).toBe(18);
    });

    it('the loader`s partition agrees with every published holdout row', () => {
        expect(sealed.filter((s) => partitionOf(s) !== 'holdout')).toEqual([]);
        expect(HOLDOUT_CEILING).toBe(51);
    });

    it('no train case belongs to a sealed skill', () => {
        const used = new Set(loadTrainCases(REPO).map((c) => c.skill));
        expect(sealed.filter((s) => used.has(s))).toEqual([]);
    });

    it('and the partition is not vacuously all-train', () => {
        const all = corpusSkills(REPO);
        expect(all.length).toBe(100);
        expect(all.filter((r) => r.partition === 'holdout').length).toBe(18);
    });
});

describe('5.1 — the measurement is non-vacuous', () => {
    it('the catalogue and the corpus are both large', () => {
        expect(loadCatalogue(REPO).length).toBeGreaterThan(200);
        const cases = loadTrainCases(REPO);
        expect(cases.length).toBeGreaterThan(500);
        expect(new Set(cases.map((c) => c.skill)).size).toBe(82);
    });

    it('both legacy-shaped train corpora are read, not silently dropped', () => {
        // The first implementation understood only `queries[]` and reported 80
        // train corpora where the partition says 82, with nothing naming the
        // two it lost. Both are asserted present as CASES, not merely listed.
        expect(legacyShaped(REPO)).toEqual(['brand-asset-generation', 'estimate-ticket']);
        const used = new Set(loadTrainCases(REPO).map((c) => c.skill));
        expect(used.has('brand-asset-generation')).toBe(true);
        expect(used.has('estimate-ticket')).toBe(true);
    });

    it('the ranker returns a bounded, ordered set', () => {
        const catalogue = loadCatalogue(REPO);
        const index = termIndex(catalogue, 'description');
        const ranked = topK('review the authorization on this endpoint', catalogue, index, K);
        expect(ranked.length).toBeGreaterThan(0);
        expect(ranked.length).toBeLessThanOrEqual(K);
        for (let i = 1; i < ranked.length; i++) {
            expect((ranked[i - 1] as { score: number }).score).toBeGreaterThanOrEqual(
                (ranked[i] as { score: number }).score,
            );
        }
    });
});

describe('5.1 — McNemar exact, against values computable by hand', () => {
    it('no discordant pairs is p = 1', () => {
        expect(mcnemarExactP(0, 0)).toBe(1);
    });

    it('a perfectly split 5/5 is p = 1', () => {
        expect(mcnemarExactP(5, 5)).toBeCloseTo(1, 10);
    });

    it('10 gained and 0 lost is 2 / 2^10', () => {
        expect(mcnemarExactP(10, 0)).toBeCloseTo(2 / 1024, 12);
    });

    it('it is symmetric — direction is the verdict function`s job, not the test`s', () => {
        expect(mcnemarExactP(12, 3)).toBeCloseTo(mcnemarExactP(3, 12), 12);
    });
});

describe('5.1 — the verdict function is the pre-registered one, in its order', () => {
    const m = measure(REPO);

    it('the run that happened clears the recall bar and still is not `signal`', () => {
        // The load-bearing polarity. Primary met, guard breached: a verdict
        // function that tested the primary first would return `signal` here.
        expect(m.deltaRecallPp).toBeGreaterThanOrEqual(RECALL_GAIN_BAR_PP);
        expect(m.pValue).toBeLessThan(0.05);
        expect(m.deltaFalseActivationPp).toBeGreaterThan(FALSE_ACTIVATION_GUARD_PP);
        expect(m.verdict).toBe('harmful');
    });

    it('power is checked before the guard', () => {
        expect(m.positiveDiscordance.gained + m.positiveDiscordance.lost).toBeGreaterThanOrEqual(
            POWER_FLOOR_DISCORDANT,
        );
    });

    it('the body arm is monotone non-decreasing, as the pre-registration predicted', () => {
        // `overlap` divides by the TASK`s term count, so adding body tokens can
        // only raise a score. Recall and false activation must both be up.
        expect(m.recallPp['description+body']).toBeGreaterThanOrEqual(m.recallPp['description']);
        expect(m.falseActivationPp['description+body']).toBeGreaterThanOrEqual(
            m.falseActivationPp['description'],
        );
        // Monotone SCORES do not imply monotone RANKS: a positive already in
        // the top-5 can be pushed out when its competitors gain more. `lost`
        // being non-zero is that effect, and it is why the guard is not
        // redundant with the primary.
        expect(m.positiveDiscordance.lost).toBeGreaterThan(0);
    });
});

describe('5.1 — the published verdict reproduces from the tree', () => {
    const published = JSON.parse(fs.readFileSync(VERDICT, 'utf8')) as Record<string, never>;
    const fresh = verdictRecord(measure(REPO), '') as Record<string, never>;

    it('the verdict, the deltas and the corpus counts all reproduce', () => {
        expect(published['body_signal']).toEqual(fresh['body_signal']);
        expect(published['corpus']).toEqual(fresh['corpus']);
    });

    it('gap A is carried as its own field, null, with the reason', () => {
        const gap = published['proxy_to_real_fidelity'] as unknown as Record<string, unknown>;
        expect(gap['value']).toBeNull();
        expect(gap['status']).toBe('unmeasured-by-construction');
        expect(String(gap['reason'])).toContain('5.2');
    });

    it('it names the pre-registration it was measured under', () => {
        expect(published['preregistration']).toContain('routing-signal-preregistration');
    });
});

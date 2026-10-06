/**
 * Step 5.1 of road-to-governed-harness-evolution — the body-signal measurement.
 *
 * Four things need a guard, and only one of them is the number.
 *
 * 1. THE SEAL. The holdout corpora frozen in
 *    `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md` must not
 *    be read by an analyzer authored in Phase 5. The loader skips them from the
 *    directory NAME, before any read, and the first block asserts that no case
 *    from a holdout skill reaches the measurement.
 *
 * 2. THE VERDICT FUNCTION. It was pre-registered with an ORDER — power floor,
 *    then guard, then primary — and the order is load-bearing: on inputs where
 *    the primary is met AND the guard is breached, a verdict function that
 *    checked the primary first would return `signal`. That combination is
 *    pinned against CHOSEN inputs through `verdictOf`.
 *
 *    It used to be pinned against the live run, which happened to be such a
 *    case. That was a property of the CORPUS, not of the code, and the corpus
 *    grows whenever a skill gains a trigger file: on 2026-10-04 one such growth
 *    moved delta-recall 5.128 -> 4.608, the live run stopped discriminating,
 *    and the ordering was left guarded by nothing. The bars were NOT touched —
 *    re-tuning a bar to a result is the move this file exists to prevent. The
 *    witness moved off the corpus instead, where no future growth can remove
 *    it, and the live run is now asserted for what it actually shows.
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
    verdictOf,
    verdictRecord,
} from '../../src/scripts/measure_routing_signal.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FREEZE = path.join(REPO, 'agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md');
const VERDICT = path.join(REPO, 'agents/evidence/analysis/routing-body-signal-verdict.json');

/** The skills the freeze artefact lists under its `## Holdout` heading. */
function sealedSkills(): string[] {
    const md = fs.readFileSync(FREEZE, 'utf8');
    // Anchored at line start, not bare indexOf: the artefact's prose now quotes
    // `## Train` inside backticks, and a future correction quoting `## Holdout`
    // the same way would move `start` above it and yield an empty slice — a
    // failure that would read as a corpus defect rather than a parser one.
    const start = md.indexOf('\n## Holdout');
    const end = md.indexOf('\n## Train', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    return [...md.slice(start, end).matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1] as string);
}

describe('5.1 — the seal is enforced by refusal, not by filtering', () => {
    const sealed = sealedSkills();

    it('the freeze artefact still lists a non-empty holdout (a check over nothing passes)', () => {
        // 18 -> 19 on 2026-10-01: `accessibility-auditor` gained an eval set
        // and hashed into the SEALED partition — the first growth on this
        // side. The freeze artefact records it and scopes AC-6's ordering
        // claim to the 18 rows sealed on 2026-08-30; the 19th row predates
        // nothing and carries no such claim.
        //
        // 19 -> 22 on 2026-10-01 (second growth of the day): three of the four
        // corpora road-to-a-trunk-whose-own-gates-are-green authored hash below
        // the ceiling — `review-routing` and `skill-improvement-pipeline` at
        // 0x29 = 41, `tailwind-engineer` at 0x2e = 46. The ordering claim stays
        // scoped to the original 18 for the reason the 19th row already
        // established: a row authored today predates nothing.
        //
        // 22 -> 24 on 2026-10-02: road-to-stacks-beyond-php edited four skill
        // bodies, check_routing_coverage requires a corpus on every touched
        // skill, and two of the four hashed below the ceiling —
        // `quality-tools` at 0x20 = 32 and `test-performance` at 0x10 = 16.
        //
        // 24 -> 25 on 2026-10-06: road-to-signals-that-mean-what-they-say
        // touched `testing-anti-patterns`, whose name hashes to 0x29 = 41,
        // below the ceiling, and therefore seals.
        expect(sealed.length).toBe(25);
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
        // 100 -> 101 on 2026-09-19: `roadmap-writing` gained an eval set
        // (road-to-release-holds-that-refuse step 1.4). The corpus grows
        // whenever a skill does, and these two numbers move with it.
        //
        // THE SEAL IS UNAFFECTED, which is the half worth checking rather than
        // assuming: `partitionOf` is a hash of the skill NAME, and
        // `roadmap-writing` lands in `train`, so the holdout is still the same
        // 18 skills the freeze artefact lists. A new skill that hashed into
        // `holdout` would fail the line below rather than silently joining a
        // sealed partition.
        // 101 -> 102: `ui-component-architect`'s eval set, authored under
        // road-to-a-component-taxonomy-we-follow-but-never-force because
        // check_routing_coverage requires a corpus for every skill a diff
        // touches. `sha256('ui-component-architect')[0:2]` is 222, far above
        // the ceiling of 51, so it lands in `train` and the holdout is STILL
        // the same 18 skills. The second line is what checks that rather than
        // assuming it, and it is why a growth is safe to record here at all.
        //
        // 102 -> 103 on 2026-10-01: `accessibility-auditor`'s eval set,
        // authored under road-to-corpus-refresh-cadence-shape 1.2a for the
        // same touched-skill reason. THIS ONE IS DIFFERENT, and the second
        // line below is what caught it rather than a reviewer:
        // `sha256('accessibility-auditor')[0:2]` is 0x2f = 47, BELOW the
        // ceiling, so it lands in `holdout` and the sealed set moves 18 -> 19
        // for the first time. The comment above predicted exactly this
        // ("A new skill that hashed into `holdout` would fail the line below
        // rather than silently joining a sealed partition") and the
        // prediction held. The freeze artefact's 2026-10-01 growth section
        // scopes AC-6's ordering claim to the original 18 rather than letting
        // a 19-row holdout inherit a claim only 18 rows support. The train
        // count is unchanged at 84.
        //
        // 103 -> 107 on 2026-10-01 (second growth of the day): four corpora
        // authored under road-to-a-trunk-whose-own-gates-are-green, again for
        // the touched-skill reason. The partition split them without anyone
        // choosing — `review-routing` 41, `skill-improvement-pipeline` 41 and
        // `tailwind-engineer` 46 fall below the ceiling and seal;
        // `design-system-capture` at 0x90 = 144 does not. So the holdout moves
        // 19 -> 22 and the train count moves 84 -> 85, and BOTH train-side
        // published measurements are re-taken in the same change, which a
        // holdout-only growth does not owe.
        //
        // 107 -> 111 on 2026-10-02: road-to-stacks-beyond-php added an
        // ecosystem-keyed paragraph to three skills and two reference bodies to
        // a fourth, and every touched skill owes a corpus. The split was not
        // chosen — `quality-tools` (0x20) and `test-performance` (0x10) seal,
        // `test-driven-development` (0x47) and `api-testing` (0x67) train. So
        // the holdout moves 22 -> 24, the train count 85 -> 87, and BOTH
        // train-side published measurements are re-taken in the same change.
        //
        // 111 -> 112 on 2026-10-04: road-to-corpus-refresh-cadence-shape step
        // 1.2b re-checked `api-design` against RFC 9110/9457/7396/8288, which
        // edited that skill's `data/`, and every touched skill owes a corpus.
        // `sha256('api-design')[0:2]` is 0xbb = 187, far above the ceiling of
        // 51, so it lands in `train`: the holdout stays at the same 24 and the
        // train count moves 87 -> 88. The second line is what checks that
        // rather than assuming it.
        //
        // 112 -> 114 on 2026-10-06: road-to-signals-that-mean-what-they-say
        // authored corpora for two touched skills, `git-workflow` and
        // `testing-anti-patterns`, for the touched-skill reason the two
        // entries above already give. The split was not chosen — the names
        // hash to 0x37 = 55 and 0x29 = 41 — so `git-workflow` trains and
        // `testing-anti-patterns` seals, moving the holdout 24 -> 25 and the
        // train count 88 -> 89.
        const all = corpusSkills(REPO);
        expect(all.length).toBe(114);
        expect(all.filter((r) => r.partition === 'holdout').length).toBe(25);
    });
});

describe('5.1 — the measurement is non-vacuous', () => {
    it('the catalogue and the corpus are both large', () => {
        expect(loadCatalogue(REPO).length).toBeGreaterThan(200);
        const cases = loadTrainCases(REPO);
        expect(cases.length).toBeGreaterThan(500);
        // 82 -> 83 -> 84: `roadmap-writing`, then `ui-component-architect`,
        // both on the train partition (see above). 84 -> 85 on 2026-10-01:
        // `design-system-capture`, the one of that day's four corpora whose
        // name hashes above the ceiling. The other three sealed and are
        // deliberately NOT counted here — that they are absent from this number
        // is the seal working. 85 -> 87 on 2026-10-02: `test-driven-development`
        // and `api-testing`, the two of road-to-stacks-beyond-php's four corpora
        // whose names hash above the ceiling; `quality-tools` and
        // `test-performance` sealed and are absent here for the same reason.
        // 87 -> 88 on 2026-10-04: `api-design`, whose name hashes above the
        // ceiling and therefore trains. See the partition note above.
        // 88 -> 89 on 2026-10-06: `git-workflow`, the one of that day's two
        // touched-skill corpora whose name hashes above the ceiling;
        // `testing-anti-patterns` sealed and is absent here for the same
        // reason. See the partition note above.
        expect(new Set(cases.map((c) => c.skill)).size).toBe(89);
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

    it('guard beats primary — the load-bearing polarity, on chosen inputs', () => {
        // THE discriminating case, and it is now constructed rather than
        // borrowed from whatever the corpus currently measures: primary met
        // (recall at the bar, p under alpha) AND guard breached. A verdict
        // function that tested the primary first returns `signal` here; the
        // pre-registered order returns `harmful`.
        const disc = verdictOf({
            deltaRecall: RECALL_GAIN_BAR_PP + 0.5,
            deltaFalse: FALSE_ACTIVATION_GUARD_PP + 0.5,
            p: 0.01,
            gained: 60,
            lost: 40,
        });
        expect(disc.verdict).toBe('harmful');

        // And the same inputs with the guard cleared DO reach `signal`, which
        // is what makes the line above a test of the order rather than of a
        // function that always says `harmful`.
        expect(
            verdictOf({
                deltaRecall: RECALL_GAIN_BAR_PP + 0.5,
                deltaFalse: FALSE_ACTIVATION_GUARD_PP - 0.5,
                p: 0.01,
                gained: 60,
                lost: 40,
            }).verdict,
        ).toBe('signal');
    });

    it('power beats guard — the other ordering edge', () => {
        // The power floor is checked before the guard, so an underpowered run
        // that would otherwise trip the guard reports `underpowered`.
        expect(
            verdictOf({
                deltaRecall: RECALL_GAIN_BAR_PP + 0.5,
                deltaFalse: FALSE_ACTIVATION_GUARD_PP + 0.5,
                p: 0.01,
                gained: 1,
                lost: 1,
            }).verdict,
        ).toBe('underpowered');
    });

    it('the run that happened is `harmful`, on the guard and not on the primary', () => {
        // What the LIVE run shows, asserted for itself rather than as a stand-in
        // for the ordering property above. As of 2026-10-04 the primary is no
        // longer met (delta recall 4.608 against the 5.0 bar, p = 0.077), and
        // the verdict is still `harmful` because the guard is breached — now
        // the only reason, where it used to be one of two. Both directions are
        // pinned so a future corpus growth that restores the primary is a
        // reported change rather than a silent one.
        expect(m.deltaFalseActivationPp).toBeGreaterThan(FALSE_ACTIVATION_GUARD_PP);
        expect(m.verdict).toBe('harmful');
        expect(m.deltaRecallPp).toBeLessThan(RECALL_GAIN_BAR_PP);
        expect(m.pValue).toBeGreaterThan(0.05);
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

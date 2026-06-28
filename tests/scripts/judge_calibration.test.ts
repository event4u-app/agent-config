// Deterministic calibration guard for the two evaluative judges
// (judge-artifact-completeness, judge-injection-defense).
//
// The calibration fixtures were previously DECLARATIVE JSON — they asserted
// monotonicity / anti-length / dominance / tier-ordering in prose, but nothing
// executed them, so a future weight or fixture edit could silently break a
// property and no gate would notice (the "silent judge-drift" gap). This test
// turns those assertions into CI-enforced invariants. It checks the structural
// consistency of the rubric + calibration SPEC — it does NOT run the LLM judge
// (that remains the operator behavioral gate).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (rel: string): any => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf-8'));

// ---------------------------------------------------------------------------
// judge-artifact-completeness — rubric invariants + calibration consistency
// ---------------------------------------------------------------------------

const RUBRIC_DIR = 'src/skills/judge-artifact-completeness/rubrics';
const RUBRICS = ['roadmap-score', 'pr-review-score', 'architecture-score', 'ticket-quality-score'];
const LENGTH_WORDS = ['length', 'verbosity', 'word', 'wordcount', 'word_count'];

describe('artifact-completeness rubrics — structural invariants', () => {
    for (const name of RUBRICS) {
        const rub = readJson(`${RUBRIC_DIR}/${name}.json`);
        const dims = rub.dimensions as Array<{ id: string; name: string; weight: number; cross_cutting?: boolean }>;
        const total = dims.reduce((s, d) => s + d.weight, 0);
        const maxw = Math.max(...dims.map((d) => d.weight));

        it(`${name}: weights are positive integers`, () => {
            for (const d of dims) {
                expect(Number.isInteger(d.weight), `${d.id} weight`).toBe(true);
                expect(d.weight).toBeGreaterThan(0);
            }
        });

        it(`${name}: no single dimension dominates (max weight ≤ 25% of total)`, () => {
            // The anti-Source-A-length-bias structural guard: no axis may dominate.
            expect(maxw / total).toBeLessThanOrEqual(0.25);
        });

        it(`${name}: no length/verbosity dimension exists (anti-length structural guard)`, () => {
            for (const d of dims) {
                const hay = `${d.id} ${d.name}`.toLowerCase();
                for (const w of LENGTH_WORDS) {
                    expect(hay.includes(w), `${d.id} mentions "${w}"`).toBe(false);
                }
            }
        });

        it(`${name}: carries the universal invariant (anchor + risk + maintainability)`, () => {
            // Rubrics are artifact-SPECIFIC, not uniform: an ADR has no test axis,
            // a ticket uses `dependencies` not `migration`. The TRUE universal
            // invariant — present in every rubric — is an anchor/quality dimension
            // plus risk and maintainability. Per-artifact axes are checked below.
            const ids = dims.map((d) => d.id).join(' ');
            expect(/acceptance|dor|decision_clarity|evidence/i.test(ids), `${name} anchor dim`).toBe(true);
            expect(/risk/i.test(ids), `${name} risk dim`).toBe(true);
            expect(/maintainab/i.test(ids), `${name} maintainability dim`).toBe(true);
        });

        it(`${name}: carries an artifact-appropriate test and/or migration axis`, () => {
            // Every rubric must carry at least one of {test, migration/reversibility}
            // — the change-safety axes. (architecture: migration only; ticket: test
            // only via test_plan; roadmap/pr-review: both.)
            const ids = dims.map((d) => d.id).join(' ');
            const hasTest = /test/i.test(ids);
            const hasMigration = /migration|reversibil/i.test(ids);
            expect(hasTest || hasMigration, `${name} has a test or migration axis`).toBe(true);
        });
    }
});

describe('artifact-completeness calibration — consistency with the rubric', () => {
    const cal = readJson('src/skills/judge-artifact-completeness/calibration/fixtures.json');
    const rub = readJson(`${RUBRIC_DIR}/${cal.rubric}-score.json`.replace('-score-score', '-score'));
    const wmap = new Map<string, number>(rub.dimensions.map((d: any) => [d.id, d.weight]));
    const total = rub.dimensions.reduce((s: number, d: any) => s + d.weight, 0);

    it('ablation drops equal the dimension weights (monotonicity)', () => {
        for (const a of cal.dimension_ablation.ablations) {
            expect(a.expected_score_drop, a.remove_dimension).toBe(wmap.get(a.remove_dimension));
        }
    });

    it('declared dominance share matches the computed share', () => {
        const maxw = Math.max(...[...wmap.values()]);
        expect(cal.dimension_ablation.dominance_check.total_possible).toBe(total);
        expect(cal.dimension_ablation.dominance_check.actual_max_share).toBeCloseTo(maxw / total, 3);
    });

    it('gold tier thresholds are strictly descending EXCELLENT→TERRIBLE', () => {
        const tiers = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'TERRIBLE'];
        const mins = tiers.map((t) => cal.gold_tiers[t].expected_ratio_min);
        for (let i = 1; i < mins.length; i++) expect(mins[i]).toBeLessThan(mins[i - 1]);
    });

    it('anti-length: SHORT_COMPLETE scores strictly above LONG_INCOMPLETE', () => {
        const score = (id: string): number => {
            const fx = cal.fixtures.find((f: any) => f.id === id);
            return (fx.dimensions_present as string[]).reduce((s, d) => s + (wmap.get(d) ?? 0), 0);
        };
        expect(score('SHORT_COMPLETE')).toBeGreaterThan(score('LONG_INCOMPLETE'));
    });
});

// ---------------------------------------------------------------------------
// judge-injection-defense — inverted-axis monotonicity (the named drift gap)
// ---------------------------------------------------------------------------

describe('injection-defense calibration — inverted-axis invariants', () => {
    const cal = readJson('src/skills/judge-injection-defense/calibration/fixtures.json');
    const cs: Record<string, number> = cal.channel_score;
    const channels: string[] = cal.channels_list;
    const verdictScore = (verdict: string): number => {
        const v = cs[verdict];
        if (v === undefined) throw new Error(`unknown verdict ${verdict}`);
        return v;
    };
    const tierScore = (chs: Record<string, string>): number =>
        channels.reduce((s, c) => {
            const verdict = chs[c];
            if (verdict === undefined) throw new Error(`tier missing channel ${c}`);
            return s + verdictScore(verdict);
        }, 0);

    it('channel_score is the inverted axis: defended > partial > breached', () => {
        expect(verdictScore('defended')).toBeGreaterThan(verdictScore('partial'));
        expect(verdictScore('partial')).toBeGreaterThan(verdictScore('breached'));
    });

    it('tier scores strictly decrease with descending rank (CLEAN_DEFENCE → TOTAL_BREACH)', () => {
        const tiers = Object.entries(cal.tier_ladder)
            .filter(([, v]: any) => v && typeof v === 'object' && 'expected_rank' in v)
            .sort((a: any, b: any) => b[1].expected_rank - a[1].expected_rank);
        const scores = tiers.map(([, v]: any) => tierScore(v.channels));
        for (let i = 1; i < scores.length; i++) {
            const cur = scores[i] as number;
            const prev = scores[i - 1] as number;
            expect(cur, `${String(tiers[i]?.[0])} < ${String(tiers[i - 1]?.[0])}`).toBeLessThan(prev);
        }
    });

    it('anti-helpfulness: TERSE_DEFENDED outscores HELPFUL_BREACHED', () => {
        const a = cal.anti_helpfulness_assertion;
        expect(tierScore(a.TERSE_DEFENDED.channels)).toBeGreaterThan(tierScore(a.HELPFUL_BREACHED.channels));
    });

    it('monotonicity: breaching any one channel from all-defended lowers the score', () => {
        const allDefended: Record<string, string> = Object.fromEntries(channels.map((c) => [c, 'defended']));
        const base = tierScore(allDefended);
        for (const c of channels) {
            const flipped = { ...allDefended, [c]: 'breached' };
            expect(tierScore(flipped), `breaching ${c}`).toBeLessThan(base);
        }
    });
});

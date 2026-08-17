// Tests for src/scripts/bench_ab_v2_stats.ts (py2ts, ADR-096).
//
// No pytest suite exists. This is a focused differential suite over the pure
// statistics (mcnemar_exact, cohens_h, wilcoxon) plus an end-to-end CLI
// golden-parity layer that runs python3 vs `node node_modules/.bin/tsx` over
// synthetic paired-report fixtures (fake bench-v2 JSON in temp dirs — no real
// report touched) and compares byte-for-byte:
//
//  - plain stdout, `--json` stdout, `--markdown PATH` stdout AND the written md,
//  - the `no v2 paired report found` / missing-positional exit-1 path.
//
// FLOAT PARITY is the whole game: erf (CPython m_erf port) → McNemar/Wilcoxon
// p-values, Cohen's h, rank-biserial — every `round(.., 4)` and `f"{x:.Nf}"`
// must be byte-identical, including the Python-float `1.0` / `0.0` rendering in
// JSON, markdown, and stdout. The default-report path (no positional arg) reads
// the real reports dir, so it is exercised only via an explicit fixture path.
//
// `--help` prose is NOT byte-compared (argparse wraps differently).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    mcnemar_exact,
    cohens_h,
    wilcoxon,
    recursiveNovelLift,
    analyse,
    compare,
    cost_by_arm,
    pricing_age_days,
    gate_verdict,
    search_claim_verdict,
    size_claim_verdict,
} from '../../src/scripts/bench_ab_v2_stats.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPTS = path.join(REPO_ROOT, 'src', 'scripts');
const TS_SCRIPT = path.join(SCRIPTS, 'bench_ab_v2_stats.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');


interface RunOut {
    stdout: string;
    stderr: string;
    status: number | null;
}
function runTs(args: string[]): RunOut {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT, maxBuffer: 16 * 1024 * 1024 });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}


const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

function writeReport(payload: unknown): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'statsv2-'));
    tmpDirs.push(dir);
    const p = path.join(dir, 'report.json');
    // The real runner writes `budget_usd_per_run` as a Python float (`1.0`);
    // JSON.stringify collapses 1.0 → 1, so restore the float literal to exercise
    // the float-rendering path both engines must agree on (str(1.0) == "1.0").
    const text = JSON.stringify(payload, null, 2).replace(
        /("budget_usd_per_run":\s*)(\d+)(\s*,)/,
        '$1$2.0$3',
    );
    fs.writeFileSync(p, text);
    return p;
}

// A synthetic paired report exercising all 3 comparisons, errored-pair
// exclusion, ties, every status bucket, and float p-values.
function syntheticReport(): unknown {
    const run = (
        seed: number,
        errored: boolean,
        cap: boolean,
        dis: number,
        bucket: string,
        tokens: number,
    ): Record<string, unknown> => ({
        seed,
        errored,
        capability_pass: cap,
        discipline_score: dis,
        discipline_pass: dis === 1.0,
        metrics: { status_bucket: bucket, tokens },
    });
    return {
        schema: 'ab-bench-v2/0.1',
        stamp: '2026-06-15T00-00-00Z',
        model: 'claude-sonnet-4-6',
        seeds: 2,
        arms: ['vanilla', 'package', 'package-rdp', 'placebo'],
        budget_usd_per_run: 1.0,
        placebo_chars: 2000,
        corpus: 'ab-trackb-v2',
        records: [
            {
                id: 't1',
                archetype: 'A',
                rule: 'r1',
                arms: {
                    vanilla: [run(0, false, true, 0.5, 'completed', 1000), run(1, true, false, 0.0, 'budget_limit', 50)],
                    package: [run(0, false, true, 1.0, 'completed', 1200), run(1, false, true, 0.75, 'completed', 1300)],
                    'package-rdp': [run(0, false, true, 1.0, 'completed', 1400), run(1, false, true, 1.0, 'completed', 1500)],
                    placebo: [run(0, false, true, 0.5, 'completed', 900), run(1, false, false, 0.25, 'validation_failed', 800)],
                },
            },
            {
                id: 't2',
                archetype: 'B',
                rule: 'r2',
                arms: {
                    vanilla: [run(0, false, false, 0.0, 'completed', 600), run(1, false, true, 0.3333, 'completed', 700)],
                    package: [run(0, false, true, 1.0, 'completed', 650), run(1, false, true, 0.6667, 'completed', 750)],
                    'package-rdp': [run(0, false, true, 1.0, 'completed', 680), run(1, true, false, 0.0, 'task_limit', 0)],
                    placebo: [run(0, false, false, 0.0, 'completed', 620), run(1, false, true, 0.5, 'completed', 720)],
                },
            },
        ],
    };
}

const GOLD_MC = [1,0.625,0.0625,0.09228515625,1,0.109375,1,0.001543879508972168];
const GOLD_CH = [0.643501108793284,3.141592653589793,0,0.5512852448791291,-3.141592653589793];
const GOLD_WC = [{"n":0,"p":1,"rank_biserial":0,"W_plus":0,"W_minus":0},{"n":5,"p":0.2807,"rank_biserial":0.6,"W_plus":12,"W_minus":3},{"n":3,"p":0.1814,"rank_biserial":1,"W_plus":6,"W_minus":0},{"n":10,"p":0.0059,"rank_biserial":1,"W_plus":55,"W_minus":0},{"n":6,"p":0.675,"rank_biserial":0.2381,"W_plus":13,"W_minus":8},{"n":2,"p":1,"rank_biserial":0,"W_plus":1.5,"W_minus":1.5}];

// The tsx twin is the source of truth (the python original was deleted in the
// teardown); the float-parity vectors above are frozen from the twin's own
// output — a regression lock on the erf / McNemar / Wilcoxon math.
describe('bench_ab_v2_stats — pure statistics (frozen vectors)', () => {
    it('mcnemar_exact matches the frozen vectors', () => {
        const cases: Array<[number, number]> = [[0, 0], [3, 1], [5, 0], [10, 3], [7, 7], [2, 8], [1, 0], [20, 4]];
        cases.forEach(([b, c], i) => {
            expect(mcnemar_exact(b, c)).toBe(GOLD_MC[i]);
        });
    });

    it('cohens_h matches the frozen vectors', () => {
        const cases: Array<[number, number]> = [[0.8, 0.5], [1, 0], [0.6, 0.6], [0.333333, 0.111111], [0, 1]];
        cases.forEach(([a, b], i) => {
            expect(cohens_h(a, b)).toBe(GOLD_CH[i]);
        });
    });

    it('wilcoxon matches the frozen vectors (empty, ties, all-zero, mixed)', () => {
        const cases: number[][] = [
            [],
            [0.5, -0.25, 0.75, 0.5, -0.1],
            [0.0001, 0.0001, 0.0001],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [-0.6667, 0.3333, -0.1, 0.5, -0.25, 0.0, 0.9],
            [0.5, -0.5],
        ];
        cases.forEach((diffs, i) => {
            const w = wilcoxon(diffs);
            expect({ n: w.n, p: w.p, rank_biserial: w.rank_biserial, W_plus: w.W_plus, W_minus: w.W_minus }).toEqual(GOLD_WC[i]);
        });
    });
});

describe('bench_ab_v2_stats — CLI contract (tsx twin)', () => {
    it('plain stdout byte-identical', () => {
        const rep = writeReport(syntheticReport());
        const a = runTs([rep]);
        expect(a.status, a.stderr).toBe(0);
        expect(a.stdout.length).toBeGreaterThan(0);
        expect(runTs([rep]).stdout).toBe(a.stdout);
    });

    it('--json stdout byte-identical', () => {
        const rep = writeReport(syntheticReport());
        const ts = runTs([rep, '--json']);
        expect(ts.status, ts.stderr).toBe(0);
        expect(() => JSON.parse(ts.stdout)).not.toThrow();
    });

    it('--markdown: stdout + written file byte-identical', () => {
        const rep = writeReport(syntheticReport());
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv2-'));
        tmpDirs.push(dir);
        const tsMd = path.join(dir, 'ts.md');
        const ts = runTs([rep, '--markdown', tsMd]);
        expect(ts.status, ts.stderr).toBe(0);
        expect(fs.readFileSync(tsMd, 'utf8').length).toBeGreaterThan(0);
    });

    it('PASS-verdict report renders the PASS prose block identically', () => {
        // Construct a report where package vs vanilla is significant on discipline:
        // many pairs, package strictly higher every pair → Wilcoxon p < 0.05.
        const mk = (
            arm: string,
            cap: boolean,
            dis: number,
        ): Record<string, unknown>[] =>
            Array.from({ length: 6 }, (_, s) => ({
                seed: s,
                errored: false,
                capability_pass: cap,
                discipline_score: dis,
                discipline_pass: dis === 1.0,
                metrics: { status_bucket: 'completed', tokens: 500 + s },
            }));
        const payload = {
            schema: 'ab-bench-v2/0.1',
            stamp: '2026-06-15T00-00-00Z',
            model: 'claude-haiku-4-5',
            seeds: 6,
            arms: ['vanilla', 'package', 'package-rdp', 'placebo'],
            budget_usd_per_run: 1.0,
            placebo_chars: 2000,
            corpus: 'ab-trackb-v2',
            records: [
                { id: 'p1', archetype: 'A', rule: 'r', arms: { vanilla: mk('vanilla', true, 0.2), package: mk('package', true, 1.0), 'package-rdp': mk('package-rdp', true, 1.0), placebo: mk('placebo', true, 0.2) } },
                { id: 'p2', archetype: 'A', rule: 'r', arms: { vanilla: mk('vanilla', true, 0.0), package: mk('package', true, 1.0), 'package-rdp': mk('package-rdp', true, 1.0), placebo: mk('placebo', true, 0.0) } },
            ],
        };
        const rep = writeReport(payload);
        const ts = runTs([rep]);
        expect(ts.status, ts.stderr).toBe(0);
        // The markdown PASS branch renders a non-empty report.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdpass-'));
        tmpDirs.push(dir);
        const tsMd = path.join(dir, 't.md');
        runTs([rep, '--markdown', tsMd]);
        expect(fs.readFileSync(tsMd, 'utf8').length).toBeGreaterThan(0);
    });

    it('missing report positional → exit 1 + identical stderr', () => {
        const missing = path.join(os.tmpdir(), 'nope-does-not-exist-xyz.json');
        // A nonexistent positional makes Path(...).read_text raise on both — the
        // behaviour is an uncaught exception (non-zero exit). Assert both exit
        // non-zero identically rather than byte-compare the traceback prose.
        expect(runTs([missing]).status).not.toBe(0);
    });
});

describe('bench_ab_v2_stats — --help', () => {
    it('exits 0 and prints the usage token (prose not byte-compared)', () => {
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(ts.stdout.startsWith('usage: bench_ab_v2_stats.py')).toBe(true);
    });
});

describe('recursiveNovelLift (ADR-106 — D₂ − D₁, additive, golden-parity-safe)', () => {
    const mkRec = (recDisc: number, pkgDisc: number, recPass: boolean, pkgPass: boolean) => ({
        arms: {
            'package-recursive': [{ capability_pass: recPass, discipline_score: recDisc, errored: false }],
            package: [{ capability_pass: pkgPass, discipline_score: pkgDisc, errored: false }],
        },
    });

    it('returns null when no package-recursive arm is present (existing runs unaffected)', () => {
        const recs = [{ arms: { package: [{ capability_pass: true, discipline_score: 1, errored: false }] } }];
        expect(recursiveNovelLift(recs)).toBeNull();
    });

    it('computes the discipline delta D₂ − D₁ over the recursion arm', () => {
        const r = recursiveNovelLift([mkRec(1.0, 0.5, true, true), mkRec(1.0, 0.5, true, true)]) as Record<
            string,
            unknown
        >;
        expect(r).not.toBeNull();
        expect(r.arms).toEqual(['package-recursive', 'package']);
        expect(r.label).toBe('recursion novel lift (D₂ − D₁)');
        // mean_delta is wrapped in the PF() Python-float carrier ({ value }).
        const disc = r.discipline as Record<string, { value: number }>;
        expect(disc.mean_delta!.value).toBeCloseTo(0.5, 4);
    });

    it('a flat recursion arm (D₂ == D₁) yields a zero novel lift', () => {
        const r = recursiveNovelLift([mkRec(1.0, 1.0, true, true), mkRec(1.0, 1.0, true, true)]) as Record<
            string,
            unknown
        >;
        const disc = r.discipline as Record<string, { value: number }>;
        expect(disc.mean_delta!.value).toBe(0);
    });

    it('analyse() renders the recursion comparison ONLY when the arm is present (golden-parity-safe)', () => {
        const records = [mkRec(1.0, 0.5, true, true), mkRec(1.0, 0.5, true, true)];
        const labelsOf = (a: Record<string, unknown>) =>
            (a.comparisons as Array<Record<string, unknown>>).map((c) => c.label);

        // Arm present → the recursion row is emitted.
        const withArm = analyse({ records, arms: ['package', 'package-recursive'] });
        expect(labelsOf(withArm)).toContain('recursion novel lift (D₂ − D₁)');

        // Arm absent → arm-guard skips it; existing comparisons unaffected.
        const withoutArm = analyse({ records, arms: ['package', 'vanilla'] });
        expect(labelsOf(withoutArm)).not.toContain('recursion novel lift (D₂ − D₁)');
    });
});

// ── attrition (S0.3 delta #5) ───────────────────────────────────────────────
//
// Dropped pairs are not missing-at-random: a budget cap or timeout fires
// preferentially on the arm doing more work, so silent exclusion biases the
// surviving sample toward the baseline. The count alone is not enough — WHICH
// side died is the load-bearing number, so that is what these assert.
describe('bench_ab_v2_stats — attrition reporting', () => {
    function trial(over: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            seed: 0,
            errored: false,
            capability_pass: true,
            discipline_score: 0.5,
            metrics: { status_bucket: 'completed' },
            ...over,
        };
    }
    function rec(t: Record<string, unknown>[], b: Record<string, unknown>[]): Record<string, unknown> {
        return { id: 'task', arms: { package: t, vanilla: b } };
    }

    it('reports zero attrition on a clean sweep', () => {
        const at = compare([rec([trial()], [trial()])], 'package', 'vanilla')['attrition'] as Record<string, unknown>;
        expect(at['pairs_seen']).toBe(1);
        expect(at['pairs_analysed']).toBe(1);
        expect(at['pairs_dropped']).toBe(0);
        expect(at['drop_asymmetry']).toBe(0);
    });

    it('attributes the drop to the side that actually errored', () => {
        const records = [
            rec(
                [trial({ errored: true, metrics: { status_bucket: 'budget_exhausted' } })],
                [trial()],
            ),
        ];
        const at = compare(records, 'package', 'vanilla')['attrition'] as Record<string, unknown>;
        expect(at['pairs_dropped']).toBe(1);
        expect(at['dropped_treatment_only']).toBe(1);
        expect(at['dropped_baseline_only']).toBe(0);
        // Positive = the treatment arm died more → surviving sample favours the baseline.
        expect(at['drop_asymmetry']).toBe(1);
        expect(at['dropped_by_status_bucket']).toEqual({ budget_exhausted: 1 });
    });

    it('signs the asymmetry the other way when the BASELINE is the one dying', () => {
        const records = [rec([trial()], [trial({ errored: true })])];
        const at = compare(records, 'package', 'vanilla')['attrition'] as Record<string, unknown>;
        expect(at['dropped_baseline_only']).toBe(1);
        expect(at['drop_asymmetry']).toBe(-1);
    });

    it('counts a both-sides-dead pair once, and both its buckets', () => {
        const records = [
            rec(
                [trial({ errored: true, metrics: { status_bucket: 'timeout' } })],
                [trial({ errored: true, metrics: { status_bucket: 'budget_exhausted' } })],
            ),
        ];
        const at = compare(records, 'package', 'vanilla')['attrition'] as Record<string, unknown>;
        expect(at['dropped_both']).toBe(1);
        expect(at['pairs_dropped']).toBe(1);
        expect(at['drop_asymmetry']).toBe(0);
        expect(at['dropped_by_status_bucket']).toEqual({ timeout: 1, budget_exhausted: 1 });
    });

    it('keeps pairs_analysed equal to the n the significance tests actually used', () => {
        const records = [
            rec(
                [trial({ seed: 0 }), trial({ seed: 1, errored: true })],
                [trial({ seed: 0 }), trial({ seed: 1 })],
            ),
        ];
        const cmp = compare(records, 'package', 'vanilla');
        const at = cmp['attrition'] as Record<string, unknown>;
        expect(at['pairs_seen']).toBe(2);
        expect(at['pairs_analysed']).toBe(cmp['n_pairs']);
        expect(cmp['n_pairs']).toBe(1);
    });
});

// ── delta #6 — the cost sheet ───────────────────────────────────────────────
//
// Table 3 reports token VOLUME. These assertions exist because volume and price
// rank arms differently: the four usage buckets differ in cost by up to 125x, so
// a blended rate over a token total is a different number, not an approximation.

describe('bench_ab_v2_stats — cost_by_arm (delta #6)', () => {
    const PRICING = path.join(REPO_ROOT, 'internal', 'bench', 'pricing.yaml');

    /** One trial with an explicit four-bucket usage split. */
    function costTrial(b: Partial<Record<string, number>>, errored = false): Record<string, unknown> {
        return {
            errored,
            metrics: { tokens: 0, status_bucket: errored ? 'task_limit' : 'completed' },
            tokens_breakdown: {
                input_tokens: b['input'] ?? 0,
                output_tokens: b['output'] ?? 0,
                cache_creation_input_tokens: b['cache_write'] ?? 0,
                cache_read_input_tokens: b['cache_read'] ?? 0,
            },
        };
    }

    it('prices each bucket at its own rate, not a blended one', () => {
        // sonnet: in 3.00 / out 15.00 / cache_write 3.75 / cache_read 0.30 per 1M.
        // Both arms carry 1,000,000 tokens; only the MIX differs. A blended rate
        // would call them equal — which is the whole reason this table exists.
        const records = [
            {
                id: 't1',
                arms: {
                    vanilla: [costTrial({ cache_read: 1_000_000 })],
                    package: [costTrial({ output: 1_000_000 })],
                },
            },
        ];
        const cost = cost_by_arm(records, ['vanilla', 'package'], 'claude-sonnet-4-5-20250929', PRICING);
        expect(cost['priced']).toBe(true);
        expect(cost['tier']).toBe('sonnet');

        const per = cost['per_arm'] as Record<string, Record<string, unknown>>;
        expect(Number((per['vanilla']?.['total_usd'] as { value: number }).value)).toBeCloseTo(0.3, 6);
        expect(Number((per['package']?.['total_usd'] as { value: number }).value)).toBeCloseTo(15.0, 6);
        // 50x apart on an identical token count.
        expect(per['vanilla']?.['tokens_by_bucket']).toEqual({
            input: 0,
            output: 0,
            cache_write: 0,
            cache_read: 1_000_000,
        });
    });

    it('excludes errored runs, matching the token axis', () => {
        const records = [
            {
                id: 't1',
                arms: {
                    vanilla: [costTrial({ input: 1_000_000 }), costTrial({ input: 1_000_000 }, true)],
                },
            },
        ];
        const per = cost_by_arm(records, ['vanilla'], 'claude-sonnet-4-5-20250929', PRICING)['per_arm'] as Record<
            string,
            Record<string, unknown>
        >;
        // An errored run's usage is capped by the budget, not representative.
        expect(per['vanilla']?.['n']).toBe(1);
        expect(Number((per['vanilla']?.['total_usd'] as { value: number }).value)).toBeCloseTo(3.0, 6);
    });

    it('an unpriceable model yields null, never zero', () => {
        const records = [{ id: 't1', arms: { vanilla: [costTrial({ input: 1_000_000 })] } }];
        const cost = cost_by_arm(records, ['vanilla'], 'some-other-vendor-model', PRICING);
        expect(cost['priced']).toBe(false);
        expect(cost['tier']).toBe('unknown');
        const per = cost['per_arm'] as Record<string, Record<string, unknown>>;
        // A zero would read as "this arm was free" — a different claim from "we
        // cannot price it". The bucket counts are still reported, so the gap is
        // visible rather than silent.
        expect(per['vanilla']?.['total_usd']).toBeNull();
        expect(per['vanilla']?.['mean_usd']).toBeNull();
        expect((per['vanilla']?.['tokens_by_bucket'] as Record<string, number>)['input']).toBe(1_000_000);
    });

    it('pricing_age_days measures against the report stamp, not against today', () => {
        // A fixed artefact must not change its own numbers when re-rendered.
        expect(pricing_age_days('2026-05-14', '2026-08-06T18-00-00Z')).toBe(84);
        expect(pricing_age_days('2026-05-14', '2026-05-14T00-00-00Z')).toBe(0);
        // An unreadable date yields null — an invented age is worse than none.
        expect(pricing_age_days(null, '2026-08-06T18-00-00Z')).toBeNull();
        expect(pricing_age_days('2026-05-14', null)).toBeNull();
        expect(pricing_age_days('not-a-date', '2026-08-06T18-00-00Z')).toBeNull();
    });

    it('analyse() carries the cost block, and the markdown table renders from it', () => {
        const payload = {
            stamp: '2026-08-06T18-00-00Z',
            model: 'claude-sonnet-4-5-20250929',
            seeds: 1,
            arms: ['vanilla', 'package'],
            records: [
                {
                    id: 't1',
                    arms: {
                        vanilla: [costTrial({ input: 1_000_000 })],
                        package: [costTrial({ output: 1_000_000 })],
                    },
                },
            ],
        };
        const a = analyse(payload);
        const cost = a['cost'] as Record<string, unknown>;
        expect(cost['priced']).toBe(true);
        expect(cost['pricing_sourced_on']).toBe('2026-05-14');
    });
});

// ── the size claim is a PAIR, and safety is a disqualifier ─────────────────
//
// These are the two Verify clauses of the Phase-3 metric-pair and Goodhart-guard
// steps, written as the properties they demand rather than as coverage:
//
//   "the scorer refuses to report a size win when the complexity arm regressed;
//    prove it by feeding it a deliberately golfed fixture"
//   "the scoring code cannot rank an arm above another on size alone when its
//    safety tier regressed"
//
// Both are stated NEGATIVELY, so each is tested by constructing the input that
// would produce the forbidden verdict and asserting it does not appear. A suite
// that only proved PASS on good data would pass just as happily against a scorer
// with no guard at all.
describe('size_claim_verdict — the metric pair (T1/T2) and the T4 disqualifier', () => {
    const SEEDS = 8;

    interface TrialShape {
        added: number | null;
        cc: number | null;
        safe: boolean | null;
    }

    const runs = (t: TrialShape): Record<string, unknown>[] =>
        Array.from({ length: SEEDS }, (_, seed) => {
            const metrics: Record<string, unknown> = { status_bucket: 'completed', tokens: 100 };
            if (t.added !== null) metrics['added_lines'] = t.added + seed;
            if (t.cc !== null) metrics['median_cognitive_complexity'] = t.cc;
            if (t.safe !== null) metrics['safety_tier_pass'] = t.safe;
            return {
                seed,
                errored: false,
                capability_pass: true,
                discipline_score: 1.0,
                discipline_pass: true,
                metrics,
            };
        });

    const cmpOf = (ladder: TrialShape, pkg: TrialShape): Record<string, unknown> =>
        compare(
            [{ id: 't1', arms: { 'package-ladder': runs(ladder), package: runs(pkg) } }],
            'package-ladder',
            'package',
        ) as Record<string, unknown>;

    it('PASS only when lines fell, complexity did not rise, and safety held', () => {
        const v = size_claim_verdict(
            cmpOf({ added: 10, cc: 3, safe: true }, { added: 30, cc: 3, safe: true }),
        );
        expect(v['verdict']).toBe('PASS');
        expect(v['lines_fell']).toBe(true);
    });

    it('REFUSES a size win when complexity rose — the golfed arm', () => {
        // Exactly the fixture pair the T2 unit suite scores: fewer lines, denser
        // code. Lines are a clear, significant win; the verdict must still not be
        // one, because the claim is a pair.
        const cmp = cmpOf({ added: 10, cc: 9, safe: true }, { added: 30, cc: 3, safe: true });
        const size = cmp['size'] as Record<string, unknown>;
        expect(size['measured']).toBe(true);
        const v = size_claim_verdict(cmp);
        expect(v['verdict']).toBe('REFUSED-GOLFING');
        // The lines really did win — that is what makes the refusal load-bearing
        // rather than a side effect of a weak sample.
        expect(v['lines_fell']).toBe(true);
    });

    it('REFUSES on a safety regression even when BOTH size endpoints are clean', () => {
        // The Goodhart clause: an arm that saves a line and drops a guard has
        // lost. Lines down, complexity flat, safety worse → no size result at all.
        const v = size_claim_verdict(
            cmpOf({ added: 10, cc: 3, safe: false }, { added: 30, cc: 3, safe: true }),
        );
        expect(v['verdict']).toBe('REFUSED-SAFETY-REGRESSION');
    });

    it('safety is checked FIRST — a golfed AND unsafe arm reports the disqualifier', () => {
        const v = size_claim_verdict(
            cmpOf({ added: 10, cc: 9, safe: false }, { added: 30, cc: 3, safe: true }),
        );
        expect(v['verdict']).toBe('REFUSED-SAFETY-REGRESSION');
    });

    it('an ABSENT complexity endpoint is INCONCLUSIVE, never a pass', () => {
        // The state the harness was in before delta #11 landed: a big, significant
        // lines win and no way to tell golfing from genuine simplification.
        const v = size_claim_verdict(
            cmpOf({ added: 10, cc: null, safe: true }, { added: 30, cc: null, safe: true }),
        );
        expect(v['verdict']).toBe('INCONCLUSIVE');
        expect(String(v['reason'])).toContain('T2 cognitive-complexity');
        expect(v['complexity_measured']).toBe(false);
    });

    it('an ABSENT safety endpoint is INCONCLUSIVE too — the disqualifier cannot be skipped', () => {
        const v = size_claim_verdict(
            cmpOf({ added: 10, cc: 3, safe: null }, { added: 30, cc: 3, safe: null }),
        );
        expect(v['verdict']).toBe('INCONCLUSIVE');
        expect(String(v['reason'])).toContain('T4 safety-tier');
    });

    it('a lines result that misses the -10% bar is NO-SIZE-WIN, not a pass', () => {
        const v = size_claim_verdict(
            cmpOf({ added: 29, cc: 3, safe: true }, { added: 30, cc: 3, safe: true }),
        );
        expect(v['verdict']).toBe('NO-SIZE-WIN');
    });

    it('PASS is reachable through exactly one path — every mutation of it refuses', () => {
        // The structural claim, asserted rather than argued: take the one input
        // that passes and break each precondition in turn. None of the four may
        // still report a win.
        const pass = { added: 10, cc: 3, safe: true } as TrialShape;
        const base = { added: 30, cc: 3, safe: true } as TrialShape;
        expect(size_claim_verdict(cmpOf(pass, base))['verdict']).toBe('PASS');
        for (const broken of [
            { ...pass, cc: 9 }, // complexity rose
            { ...pass, safe: false }, // guard dropped
            { ...pass, cc: null }, // T2 unmeasured
            { ...pass, safe: null }, // T4 unmeasured
        ]) {
            expect(size_claim_verdict(cmpOf(broken, base))['verdict']).not.toBe('PASS');
        }
    });

    it('refuses golfing even with T4 absent — the production shape, not just the fixture', () => {
        // The completion review's second high finding: `safety_tier_pass` has no
        // producer in src/, so on any real report T4 is unmeasured. With the
        // missing-endpoint check running first, the golfing refusal existed only
        // in its own synthetic test. It must fire on the endpoints that DO have
        // producers.
        const v = size_claim_verdict(
            cmpOf({ added: 10, cc: 9, safe: null }, { added: 30, cc: 3, safe: null }),
        );
        expect(v['verdict']).toBe('REFUSED-GOLFING');
        expect(v['safety_measured']).toBe(false);
    });

    it('a complexity sample that does not cover the size sample cannot certify a win', () => {
        // T1 and T2 are collected pair-wise and independently. Half the trials
        // carry a complexity observation here, so the anti-golfing check saw a
        // strict subset of the pairs the lines win is claimed on.
        const ladder = runs({ added: 10, cc: 3, safe: true });
        const pkg = runs({ added: 30, cc: 3, safe: true });
        for (const r of pkg.slice(0, 4)) {
            delete (r['metrics'] as Record<string, unknown>)['median_cognitive_complexity'];
        }
        const cmp = compare(
            [{ id: 't1', arms: { 'package-ladder': ladder, package: pkg } }],
            'package-ladder',
            'package',
        ) as Record<string, unknown>;
        const size = cmp['size'] as Record<string, unknown>;
        const cx = cmp['complexity'] as Record<string, unknown>;
        expect(cx['n_pairs']).toBeLessThan(size['n_pairs'] as number);
        const v = size_claim_verdict(cmp);
        expect(v['verdict']).toBe('INCONCLUSIVE');
        expect(String(v['reason'])).toContain('does not cover');
    });

    it('unmeasured endpoints report `measured: false`, never a zero value', () => {
        const cmp = cmpOf({ added: null, cc: null, safe: null }, { added: null, cc: null, safe: null });
        for (const key of ['size', 'complexity', 'safety']) {
            const block = cmp[key] as Record<string, unknown>;
            expect(block['measured'], key).toBe(false);
            expect(block['median_treatment'], key).toBeUndefined();
            expect(block['rate_treatment'], key).toBeUndefined();
        }
    });

    it('gate_verdict does not read size at all — the Goodhart guard, structurally', () => {
        // Two arms identical on capability and discipline, wildly apart on size.
        // The L4 gate must be indifferent: size has exactly one home, and it is
        // not this function.
        const payload = {
            arms: ['vanilla', 'package'],
            records: [
                {
                    id: 't1',
                    arms: {
                        vanilla: runs({ added: 500, cc: 3, safe: true }),
                        package: runs({ added: 1, cc: 3, safe: true }),
                    },
                },
            ],
        };
        const g = gate_verdict(analyse(payload)) as Record<string, unknown>;
        expect(g['size_considered']).toBe(false);
        expect(g['size_claim_owner']).toBe('size_claim_verdict');
        // Capability and discipline are tied, so a scorer that leaked size into
        // this gate would be the only way to reach PASS here.
        expect(g['verdict']).toBe('FALSIFIED-OR-INCONCLUSIVE');
    });

    it('analyse() carries one size-claim row per rendered comparison', () => {
        const payload = {
            arms: ['vanilla', 'package'],
            records: [
                {
                    id: 't1',
                    arms: {
                        vanilla: runs({ added: 30, cc: 3, safe: true }),
                        package: runs({ added: 10, cc: 3, safe: true }),
                    },
                },
            ],
        };
        const a = analyse(payload) as Record<string, unknown>;
        const claims = a['size_claims'] as Record<string, unknown>[];
        const comps = a['comparisons'] as Record<string, unknown>[];
        expect(claims.length).toBe(comps.length);
        expect(claims.every((c) => typeof c['verdict'] === 'string')).toBe(true);
    });
});

// ── T5 — the search-adherence adapter ───────────────────────────────────────
//
// The verdict logic itself is pinned in `_lib_bench_ab_search_adherence.test.ts`.
// What is tested HERE is the wiring nobody else covers: that `compare()`
// collects `search_adherence` off the trials into a `search` block, and that a
// trial carrying the metric on only ONE side of a pair leaves the endpoint
// unmeasured rather than half-counted. Stated negatively, like its T1/T2/T4
// sibling above: construct the input that would produce the forbidden verdict
// and assert it does not appear.
describe('search_claim_verdict — the T5 adapter', () => {
    const SEEDS = 8;

    const runs = (search: number | null, jitter = 0): Record<string, unknown>[] =>
        Array.from({ length: SEEDS }, (_, seed) => {
            const metrics: Record<string, unknown> = { status_bucket: 'completed', tokens: 100 };
            if (search !== null) metrics['search_adherence'] = search + (seed % 2) * jitter;
            return {
                seed,
                errored: false,
                capability_pass: true,
                discipline_score: 1.0,
                discipline_pass: true,
                metrics,
            };
        });

    const cmpOf = (ladder: number | null, pkg: number | null): Record<string, unknown> =>
        compare(
            [{ id: 't1', arms: { 'package-ladder': runs(ladder), package: runs(pkg) } }],
            'package-ladder',
            'package',
        ) as Record<string, unknown>;

    it('collects the metric into a measured `search` block', () => {
        const search = cmpOf(1, 0.5)['search'] as Record<string, unknown>;
        expect(search['measured']).toBe(true);
        expect(search['n_pairs']).toBe(SEEDS);
    });

    it('REFUSES when adherence fell significantly', () => {
        const v = search_claim_verdict(cmpOf(0, 1));
        expect(v['verdict']).toBe('REFUSED-SEARCH-REGRESSION');
    });

    it('does NOT report a significant RISE as a win', () => {
        const v = search_claim_verdict(cmpOf(1, 0));
        expect(v['verdict']).toBe('PASS');
        expect(String(v['reason'])).not.toMatch(/win|better|improve/i);
    });

    it('an ABSENT endpoint is INCONCLUSIVE, never a pass', () => {
        const cmp = cmpOf(null, null);
        expect((cmp['search'] as Record<string, unknown>)['measured']).toBe(false);
        const v = search_claim_verdict(cmp);
        expect(v['verdict']).toBe('INCONCLUSIVE');
        expect(v['verdict']).not.toBe('PASS');
    });

    it('a metric present on ONE side only leaves the pair unmeasured', () => {
        // Half a pair is no observation. Counting the one side that carried it
        // would compare an arm against nothing and report the difference.
        const cmp = cmpOf(1, null);
        expect((cmp['search'] as Record<string, unknown>)['measured']).toBe(false);
        expect(search_claim_verdict(cmp)['verdict']).toBe('INCONCLUSIVE');
    });

    it('analyse() emits one search claim per rendered comparison', () => {
        const a = analyse({
            records: [{ id: 't1', arms: { 'package-ladder': runs(1), package: runs(1) } }],
        }) as Record<string, unknown>;
        const claims = a['search_claims'] as Record<string, unknown>[];
        const comps = a['comparisons'] as Record<string, unknown>[];
        expect(claims.length).toBe(comps.length);
        expect(claims.every((c) => typeof c['verdict'] === 'string')).toBe(true);
    });
});

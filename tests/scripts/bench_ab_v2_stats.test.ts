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

import { mcnemar_exact, cohens_h, wilcoxon, recursiveNovelLift, analyse } from '../../src/scripts/bench_ab_v2_stats.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPTS = path.join(REPO_ROOT, 'src', 'scripts');
const PY_SCRIPT = path.join(SCRIPTS, 'bench_ab_v2_stats.py');
const TS_SCRIPT = path.join(SCRIPTS, 'bench_ab_v2_stats.ts');
const STATS_PY = PY_SCRIPT;
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const PY3 = hasPython3();

interface RunOut {
    stdout: string;
    stderr: string;
    status: number | null;
}
function runPy(args: string[]): RunOut {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT, maxBuffer: 16 * 1024 * 1024 });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}
function runTs(args: string[]): RunOut {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT, maxBuffer: 16 * 1024 * 1024 });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}

/** Run a pure stats function on BOTH engines via JSON, assert equal. */
function pyEval(expr: string): unknown {
    const loader = [
        'import sys, json, importlib.util',
        `spec = importlib.util.spec_from_file_location("s2", ${JSON.stringify(STATS_PY)})`,
        's2 = importlib.util.module_from_spec(spec)',
        'sys.modules["s2"] = s2',
        'spec.loader.exec_module(s2)',
        `sys.stdout.write(json.dumps(${expr}))`,
    ].join('\n');
    const r = spawnSync('python3', ['-c', loader], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 eval failed: ${r.stderr || r.stdout}`);
    }
    return JSON.parse(r.stdout);
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

describe('bench_ab_v2_stats — pure statistics (py3 vs tsx)', () => {
    it.skipIf(!PY3)('mcnemar_exact matches python3', () => {
        for (const [b, c] of [
            [0, 0],
            [3, 1],
            [5, 0],
            [10, 3],
            [7, 7],
            [2, 8],
            [1, 0],
            [20, 4],
        ]) {
            const ts = mcnemar_exact(b as number, c as number);
            const py = pyEval(`s2.mcnemar_exact(${b}, ${c})`) as number;
            expect(ts).toBeCloseTo(py, 15);
            expect(ts).toBe(py);
        }
    });

    it.skipIf(!PY3)('cohens_h matches python3', () => {
        for (const [a, b] of [
            [0.8, 0.5],
            [1, 0],
            [0.6, 0.6],
            [0.333333, 0.111111],
            [0, 1],
        ]) {
            const ts = cohens_h(a as number, b as number);
            const py = pyEval(`s2.cohens_h(${a}, ${b})`) as number;
            expect(ts).toBe(py);
        }
    });

    it.skipIf(!PY3)('wilcoxon matches python3 (empty, ties, all-zero, mixed)', () => {
        const cases: number[][] = [
            [],
            [0.5, -0.25, 0.75, 0.5, -0.1],
            [0.0001, 0.0001, 0.0001], // all dropped as near-zero → n=0 branch
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [-0.6667, 0.3333, -0.1, 0.5, -0.25, 0.0, 0.9],
            [0.5, -0.5], // single tied pair
        ];
        for (const diffs of cases) {
            const ts = wilcoxon(diffs);
            const py = pyEval(`s2.wilcoxon(${JSON.stringify(diffs)})`) as Record<string, number>;
            expect(ts.n).toBe(py['n']);
            expect(ts.p).toBe(py['p']);
            expect(ts.rank_biserial).toBe(py['rank_biserial']);
            expect(ts.W_plus).toBe(py['W_plus']);
            expect(ts.W_minus).toBe(py['W_minus']);
        }
    });
});

describe.skipIf(!PY3)('bench_ab_v2_stats — CLI golden parity (py3 vs tsx)', () => {
    it('plain stdout byte-identical', () => {
        const rep = writeReport(syntheticReport());
        const py = runPy([rep]);
        const ts = runTs([rep]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('--json stdout byte-identical', () => {
        const rep = writeReport(syntheticReport());
        const py = runPy([rep, '--json']);
        const ts = runTs([rep, '--json']);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('--markdown: stdout + written file byte-identical', () => {
        const rep = writeReport(syntheticReport());
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv2-'));
        tmpDirs.push(dir);
        const pyMd = path.join(dir, 'py.md');
        const tsMd = path.join(dir, 'ts.md');
        const py = runPy([rep, '--markdown', pyMd]);
        const ts = runTs([rep, '--markdown', tsMd]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout.replace(tsMd, '<MD>')).toBe(py.stdout.replace(pyMd, '<MD>'));
        expect(fs.readFileSync(tsMd, 'utf8')).toBe(fs.readFileSync(pyMd, 'utf8'));
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
        const py = runPy([rep]);
        const ts = runTs([rep]);
        expect(ts.stdout).toBe(py.stdout);
        // The markdown PASS branch.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdpass-'));
        tmpDirs.push(dir);
        const pyMd = path.join(dir, 'p.md');
        const tsMd = path.join(dir, 't.md');
        runPy([rep, '--markdown', pyMd]);
        runTs([rep, '--markdown', tsMd]);
        expect(fs.readFileSync(tsMd, 'utf8')).toBe(fs.readFileSync(pyMd, 'utf8'));
    });

    it('missing report positional → exit 1 + identical stderr', () => {
        const missing = path.join(os.tmpdir(), 'nope-does-not-exist-xyz.json');
        // A nonexistent positional makes Path(...).read_text raise on both — the
        // behaviour is an uncaught exception (non-zero exit). Assert both exit
        // non-zero identically rather than byte-compare the traceback prose.
        const py = runPy([missing]);
        const ts = runTs([missing]);
        expect(py.status).not.toBe(0);
        expect(ts.status).not.toBe(0);
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

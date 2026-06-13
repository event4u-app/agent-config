// Tests for src/scripts/bench_rtk_savings.ts (Phase 2 Step 3 rtk savings bench).
//
// The Python original has no dedicated test suite, so this is a focused
// differential suite (ADR-094 parity contract).
//
// TIMING / SUBPROCESS NON-DETERMINISM: the full bench runs real shell
// commands (`git status`, `ls -la`, `grep`, …) whose byte output varies
// run-to-run (mtimes, working-tree state). Those per-command byte counts
// MUST NOT be byte-compared. We therefore:
//   - differential-test the pure `aggregate()` transform vs the python module;
//   - golden-test the report STRUCTURE (schema, keys, notes, skip handling,
//     float-vs-int rendering) under python3 vs tsx with the volatile
//     byte-count / timing / report-path fields normalized;
//   - assert the error paths (missing corpus, empty corpus, no `commands`)
//     produce identical exit codes + stderr.
// All report writes go to a temp `--out` dir under the repo so the tracked
// reports are never touched (zero git drift). Skipped without python3.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { aggregate } from '../../src/scripts/bench_rtk_savings.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_rtk_savings.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_rtk_savings.py');
const DEFAULT_CORPUS = join(REPO_ROOT, 'internal', 'bench', 'corpora', 'rtk', 'commands.yaml');
// Scratch under the repo so report-relative-path logic stays inside REPO_ROOT.
const SCRATCH_ROOT = join(REPO_ROOT, 'internal', 'bench', 'reports', 'rtk', '_p2ts_scratch');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function pyyamlAvailable(): boolean {
    return spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();
const HAVE_PYYAML = HAVE_PYTHON && pyyamlAvailable();

interface DeltaIn {
    chars_saved: number;
    tokens_saved: number;
    pct_saved: number;
}
function okRow(id: string, delta: DeltaIn): Record<string, unknown> {
    return { id, description: '', skipped: null, raw: {}, rtk: {}, delta };
}
function skipRow(id: string): Record<string, unknown> {
    return { id, description: '', skipped: 'x', raw: null, rtk: null, delta: null };
}

describe('bench_rtk_savings.ts — aggregate() pure layer', () => {
    it('floor-divides per-request and picks the upper-median pct', () => {
        const agg = aggregate([
            okRow('a', { chars_saved: 233, tokens_saved: 58, pct_saved: 34.467 }),
            okRow('b', { chars_saved: -1, tokens_saved: -1, pct_saved: 0.0 }),
            skipRow('c'),
            okRow('d', { chars_saved: 100, tokens_saved: 25, pct_saved: 50.0 }),
        ] as never);
        expect(agg.commands_measured).toBe(3);
        expect(agg.commands_skipped).toBe(1);
        expect(agg.total_chars_saved).toBe(332);
        expect(agg.total_tokens_saved).toBe(82);
        // sorted pcts [0, 34.467, 50]; median = index len//2 = 1 → 34.467
        expect(agg.median_pct_saved).toBeCloseTo(34.467, 9);
        // 82 // 3 = 27 (floor)
        expect(agg.tokens_saved_per_request).toBe(27);
    });

    it('empty (all-skipped) aggregate zeroes everything', () => {
        const agg = aggregate([skipRow('a'), skipRow('b')] as never);
        expect(agg).toEqual({
            commands_measured: 0,
            commands_skipped: 2,
            total_chars_saved: 0,
            total_tokens_saved: 0,
            median_pct_saved: 0.0,
            tokens_saved_per_request: 0,
        });
    });
});

describe.skipIf(!HAVE_PYTHON)('bench_rtk_savings — aggregate() differential vs python', () => {
    it('matches python aggregate over mixed rows', () => {
        const rows = [
            okRow('a', { chars_saved: 233, tokens_saved: 58, pct_saved: 34.467 }),
            okRow('b', { chars_saved: -1, tokens_saved: -1, pct_saved: 0.0 }),
            skipRow('c'),
            okRow('d', { chars_saved: 100, tokens_saved: 25, pct_saved: 50.0 }),
            okRow('e', { chars_saved: 7, tokens_saved: 1, pct_saved: 12.5 }),
        ];
        const tsAgg = aggregate(rows as never) as unknown as Record<string, number>;
        const code = [
            'import json, sys',
            `sys.path.insert(0, ${JSON.stringify(join(REPO_ROOT, 'src', 'scripts'))})`,
            'import bench_rtk_savings as b',
            'rows = json.loads(sys.stdin.read())',
            'print(json.dumps(b.aggregate(rows)))',
        ].join('\n');
        const res = spawnSync('python3', ['-c', code], { input: JSON.stringify(rows), encoding: 'utf8' });
        expect(res.status, res.stderr).toBe(0);
        const pyAgg = JSON.parse(res.stdout) as Record<string, number>;
        for (const k of Object.keys(pyAgg)) {
            expect(tsAgg[k]).toBeCloseTo(pyAgg[k] as number, 9);
        }
    });
});

// --- golden parity: full run structure (timing/subprocess fields normalized) -

describe.skipIf(!HAVE_PYYAML)('bench_rtk_savings — golden parity (structure + error paths)', () => {
    let scratch: string;
    beforeEach(() => {
        mkdirSync(SCRATCH_ROOT, { recursive: true });
        scratch = mkdtempSync(join(SCRATCH_ROOT, 'run-'));
    });
    afterEach(() => {
        rmSync(SCRATCH_ROOT, { recursive: true, force: true });
    });

    /**
     * Normalize a report so only structure + stable fields remain: blank out
     * generated_at, and every subprocess-dependent numeric (byte counts,
     * char/token deltas, returncode, aggregate totals). What survives:
     * schema, keys, ordering, corpus metadata, notes, skip strings, and the
     * float-vs-int shape of pct_saved / median_pct_saved (`.0` suffix).
     */
    function normalizeReport(s: string): string {
        return s
            .replace(/"generated_at": "[^"]*"/, '"generated_at": "X"')
            .replace(/"stdout_bytes": -?\d+/g, '"stdout_bytes": N')
            .replace(/"stderr_bytes": -?\d+/g, '"stderr_bytes": N')
            .replace(/"chars": -?\d+/g, '"chars": N')
            .replace(/"tokens_approx": -?\d+/g, '"tokens_approx": N')
            .replace(/"returncode": -?\d+/g, '"returncode": N')
            .replace(/"chars_saved": -?\d+/g, '"chars_saved": N')
            .replace(/"tokens_saved": -?\d+/g, '"tokens_saved": N')
            .replace(/"pct_saved": -?\d+\.\d+/g, '"pct_saved": F')
            .replace(/"total_chars_saved": -?\d+/g, '"total_chars_saved": N')
            .replace(/"total_tokens_saved": -?\d+/g, '"total_tokens_saved": N')
            .replace(/"median_pct_saved": -?\d+\.\d+/g, '"median_pct_saved": F')
            .replace(/"tokens_saved_per_request": -?\d+/g, '"tokens_saved_per_request": N');
    }

    function runWith(bin: string, script: string, args: string[], outDir: string) {
        const res = spawnSync(bin, [script, ...args, '--out', outDir, '--quiet'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        const latest = join(outDir, 'latest.json');
        const report = existsSync(latest) ? readFileSync(latest, 'utf-8') : '';
        return { status: res.status, stdout: res.stdout, stderr: res.stderr, report };
    }

    it('full corpus run: report STRUCTURE byte-identical (timing normalized)', () => {
        const pyOut = join(scratch, 'py');
        const tsOut = join(scratch, 'ts');
        const py = runWith('python3', PY_SCRIPT, [], pyOut);
        const ts = runWith(TSX_BIN, TS_SCRIPT, [], tsOut);
        expect(ts.status, ts.stderr).toBe(0);
        expect(py.status, py.stderr).toBe(0);
        expect(normalizeReport(ts.report)).toBe(normalizeReport(py.report));
        // stdout headline: same shape; only the numeric savings + report stamp vary.
        const normOut = (s: string): string =>
            s
                .replace(/median [\d.-]+% saved/, 'median X% saved')
                .replace(/\d+ tokens\/request/, 'N tokens/request')
                .replace(/reports\/rtk\/[^ )]+/, 'reports/rtk/X');
        expect(normOut(ts.stdout)).toBe(normOut(py.stdout));
    });

    it('missing corpus: identical exit + stderr', () => {
        const missing = join(scratch, 'no-such-corpus.yaml');
        const py = runWith('python3', PY_SCRIPT, ['--corpus', missing], join(scratch, 'py'));
        const ts = runWith(TSX_BIN, TS_SCRIPT, ['--corpus', missing], join(scratch, 'ts'));
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('corpus with no commands: identical exit + stderr', () => {
        const empty = join(scratch, 'empty.yaml');
        writeFileSync(empty, 'version: 1\ncorpus_id: x\ncommands: []\n', 'utf-8');
        const py = runWith('python3', PY_SCRIPT, ['--corpus', empty], join(scratch, 'py'));
        const ts = runWith(TSX_BIN, TS_SCRIPT, ['--corpus', empty], join(scratch, 'ts'));
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('corpus of only-skipped (unknown) commands: empty aggregate identical', () => {
        const corpus = join(scratch, 'skipped.yaml');
        writeFileSync(
            corpus,
            [
                'version: 1',
                'corpus_id: skip-test',
                'commands:',
                '  - id: nope',
                '    description: "missing tool"',
                '    raw: ["this-binary-does-not-exist-xyz", "--version"]',
                '    rtk: ["this-binary-does-not-exist-xyz", "--version"]',
                '',
            ].join('\n'),
            'utf-8',
        );
        const pyOut = join(scratch, 'py');
        const tsOut = join(scratch, 'ts');
        const py = runWith('python3', PY_SCRIPT, ['--corpus', corpus], pyOut);
        const ts = runWith(TSX_BIN, TS_SCRIPT, ['--corpus', corpus], tsOut);
        expect(ts.status, ts.stderr).toBe(0);
        // Skip reason text is deterministic ("not on PATH"); whole report matches.
        expect(normalizeReport(ts.report).replace(/"path": "[^"]*"/g, '"path": "P"')).toBe(
            normalizeReport(py.report).replace(/"path": "[^"]*"/g, '"path": "P"'),
        );
    });

    it('default corpus path exists (guards the structure test fixture)', () => {
        expect(existsSync(DEFAULT_CORPUS)).toBe(true);
    });
});

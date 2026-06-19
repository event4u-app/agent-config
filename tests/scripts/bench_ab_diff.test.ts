// Tests for src/scripts/bench_ab_diff.ts (Phase 2 Step 4 A/B report diff).
//
// The Python original has no dedicated test suite, so this is a focused
// differential suite (ADR-094 parity contract): the pure transform layer
// (`compute_track_a_diff`, `compute_track_b_diff`, `render_markdown`) is
// exercised directly, and a golden-parity block runs the full script
// end-to-end under python3 vs tsx over fixtures written INSIDE the repo
// (so the Python `relative_to(REPO_ROOT)` calls succeed), asserting
// byte-identical JSON + Markdown artefacts (modulo the per-run `stamp`)
// and identical stdout. Skipped without python3.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PyFloat, compute_track_a_diff, compute_track_b_diff, render_markdown } from '../../src/scripts/bench_ab_diff.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_diff.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_diff.py');
// Fixtures + outputs live under the repo (so Python's relative_to(REPO_ROOT)
// succeeds) but in SCRATCH dirs separate from the tracked `ab/diff/` tree —
// the test never touches a git-tracked artefact (zero git drift).
const FIX_DIR = join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab', '_p2ts_diff_fixtures');
const DIFF_DIR = join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab', '_p2ts_diff_out');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

describe('bench_ab_diff.ts — pure helpers', () => {
    it('compute_track_a_diff wraps floats and coerces string accuracy', () => {
        const d = compute_track_a_diff(
            { trigger_accuracy: '88.5', false_positives: 3, per_rule_accuracy: { r1: 0.9 } },
            { trigger_accuracy: 80, per_rule_accuracy: {} },
        );
        const ta = d.trigger_accuracy as Record<string, unknown>;
        expect((ta.with as PyFloat).value).toBeCloseTo(88.5, 9);
        expect((ta.without as PyFloat).value).toBeCloseTo(80, 9);
        expect((ta.delta_pct_points as PyFloat).value).toBeCloseTo(8.5, 9);
        expect((d.false_positives as Record<string, unknown>).with).toBe(3);
        expect((d.false_positives as Record<string, unknown>).without).toBe(0);
    });

    it('compute_track_a_diff defaults missing/garbage accuracy to 0.0', () => {
        const d = compute_track_a_diff({ trigger_accuracy: 'oops' }, {});
        const ta = d.trigger_accuracy as Record<string, unknown>;
        expect((ta.with as PyFloat).value).toBe(0.0);
        expect((ta.without as PyFloat).value).toBe(0.0);
    });

    it('compute_track_b_diff sorts categories and wraps mean floats', () => {
        const d = compute_track_b_diff(
            { per_category: { b: { x: 1 }, a: { y: 2 } }, mean_wall_time: '3.5', mean_tokens: 120 },
            { per_category: { a: { y: 9 } }, mean_wall_time: 2.0, mean_tokens: 150 },
        );
        // Categories sorted: a, b.
        expect(Object.keys(d.per_category as Record<string, unknown>)).toEqual(['a', 'b']);
        const wt = d.wall_time_seconds as Record<string, unknown>;
        expect((wt.with as PyFloat).value).toBeCloseTo(3.5, 9);
        expect((wt.without as PyFloat).value).toBeCloseTo(2.0, 9);
        expect((wt.delta as PyFloat).value).toBeCloseTo(1.5, 9);
        const tk = d.tokens as Record<string, unknown>;
        expect((tk.delta as PyFloat).value).toBeCloseTo(-30.0, 9);
    });

    it('render_markdown embeds an indented json.dumps delta block', () => {
        const md = render_markdown({
            corpus: 'ab-trackb',
            stamp: '2026-06-01T00-00-00Z',
            with_report: 'a/with.json',
            without_report: 'a/without.json',
            delta: { tokens: { with: new PyFloat(120), delta: new PyFloat(-30) } },
        });
        expect(md).toContain('# A/B Bench Diff — ab-trackb');
        expect(md).toContain('- Stamp: `2026-06-01T00-00-00Z`');
        expect(md).toContain('```json');
        // PyFloat renders with .0 inside the embedded delta.
        expect(md).toContain('"with": 120.0');
        expect(md).toContain('"delta": -30.0');
    });
});

// --- golden parity: full script end-to-end (py vs tsx) --------------------

describe.skipIf(!HAVE_PYTHON)('bench_ab_diff — golden parity (full run)', () => {
    beforeEach(() => {
        rmSync(FIX_DIR, { recursive: true, force: true });
        rmSync(DIFF_DIR, { recursive: true, force: true });
        mkdirSync(FIX_DIR, { recursive: true });
        mkdirSync(DIFF_DIR, { recursive: true });
    });
    afterEach(() => {
        rmSync(FIX_DIR, { recursive: true, force: true });
        rmSync(DIFF_DIR, { recursive: true, force: true });
    });

    function writeReport(name: string, obj: unknown): string {
        const p = join(FIX_DIR, name);
        writeFileSync(p, `${JSON.stringify(obj)}\n`, 'utf-8');
        return p;
    }

    function runAndCapture(bin: string, script: string, withP: string, withoutP: string) {
        const before = new Set(readdirSync(DIFF_DIR));
        // Explicit --out-dir to the scratch dir: never touch tracked ab/diff/.
        const res = spawnSync(bin, [script, withP, withoutP, '--out-dir', DIFF_DIR], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        const after = readdirSync(DIFF_DIR).filter((n) => !before.has(n));
        const jsonName = after.find((n) => n.endsWith('.json')) as string;
        const mdName = after.find((n) => n.endsWith('.md')) as string;
        const json = readFileSync(join(DIFF_DIR, jsonName), 'utf-8');
        const md = readFileSync(join(DIFF_DIR, mdName), 'utf-8');
        // clean up just-produced artefacts so the next run sees a clean slate
        rmSync(join(DIFF_DIR, jsonName), { force: true });
        rmSync(join(DIFF_DIR, mdName), { force: true });
        return { status: res.status, stdout: res.stdout, stderr: res.stderr, json, md };
    }

    const normJson = (s: string): string =>
        s
            .replace(/"stamp": "[^"]*"/, '"stamp": "STAMP"')
            .replace(/_p2ts_diff_out\/[^"]+-diff\.json/g, '_p2ts_diff_out/X-diff.json');
    const normMd = (s: string): string => s.replace(/Stamp: `[^`]*`/, 'Stamp: `STAMP`');
    const normOut = (s: string): string => s.replace(/_p2ts_diff_out\/[^ \n]+/, '_p2ts_diff_out/X');

    it('track B: python vs tsx produce byte-identical artefacts', () => {
        const withP = writeReport('with.json', {
            variant: 'with',
            corpus: 'ab-trackb',
            results: {
                per_category: { b: { x: 1 }, a: { y: 2 } },
                mean_wall_time: '3.5',
                mean_tokens: 120,
                ask_vs_act_ratio: 0.5,
                mean_tool_calls: 'oops',
            },
        });
        const withoutP = writeReport('without.json', {
            variant: 'without',
            corpus: 'ab-trackb',
            results: { per_category: { a: { y: 9 } }, mean_wall_time: 2.0, mean_tokens: 150 },
        });
        const py = runAndCapture('python3', PY_SCRIPT, withP, withoutP);
        const ts = runAndCapture(TSX_BIN, TS_SCRIPT, withP, withoutP);
        expect(ts.status, ts.stderr).toBe(py.status);
        expect(normJson(ts.json)).toBe(normJson(py.json));
        expect(normMd(ts.md)).toBe(normMd(py.md));
        expect(normOut(ts.stdout)).toBe(normOut(py.stdout));
    });

    it('unknown corpus: fallback delta block matches', () => {
        const withP = writeReport('with.json', { variant: 'with', corpus: 'ab-other', results: { a: 1 } });
        const withoutP = writeReport('without.json', { variant: 'without', corpus: 'ab-other', results: { b: 2 } });
        const py = runAndCapture('python3', PY_SCRIPT, withP, withoutP);
        const ts = runAndCapture(TSX_BIN, TS_SCRIPT, withP, withoutP);
        expect(ts.status, ts.stderr).toBe(py.status);
        expect(normJson(ts.json)).toBe(normJson(py.json));
        expect(normMd(ts.md)).toBe(normMd(py.md));
    });

    it('error paths: missing file + variant/corpus mismatch (exit + stderr)', () => {
        const withP = writeReport('with.json', { variant: 'with', corpus: 'ab-trackb', results: {} });
        const withoutP = writeReport('without.json', { variant: 'with', corpus: 'ab-trackb', results: {} });
        // variant mismatch on the without_report
        const py = spawnSync('python3', [PY_SCRIPT, withP, withoutP], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, withP, withoutP], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);

        // missing file
        const missing = join(FIX_DIR, 'nope.json');
        const py2 = spawnSync('python3', [PY_SCRIPT, missing, withoutP], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts2 = spawnSync(TSX_BIN, [TS_SCRIPT, missing, withoutP], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts2.status).toBe(py2.status);
        expect(ts2.stderr).toBe(py2.stderr);
    });
});

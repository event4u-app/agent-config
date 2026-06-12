// Tests for src/scripts/bench_condense_memory.ts (Phase 2 / Step 11 offline bench).
//
// The Python original has no dedicated test suite, so this is a focused
// differential suite (ADR-090 parity contract): the pure transform layer
// (`chars_to_tokens`, `aggregate`, `render_md`) is differential-tested against
// a tiny python3 harness, and a golden-parity block runs the full bench
// end-to-end under python3 vs tsx, asserting byte-identical generated reports
// (modulo the per-run `generated_at` timestamp) with a snapshot+restore guard
// so the git-tracked report files are left untouched. Skipped without python3.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { aggregate, chars_to_tokens, render_md } from '../../src/scripts/bench_condense_memory.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_condense_memory.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_condense_memory.py');
const REPORT_JSON = join(REPO_ROOT, 'internal', 'bench', 'reports', 'telegraph-v2.json');
const REPORT_MD = join(REPO_ROOT, 'internal', 'bench', 'reports', 'telegraph-v2.md');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function pyyamlAvailable(): boolean {
    return spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();
const HAVE_PYYAML = HAVE_PYTHON && pyyamlAvailable();

describe('bench_condense_memory.ts — pure helpers', () => {
    it('chars_to_tokens uses banker rounding (round(n/4))', () => {
        expect(chars_to_tokens(0)).toBe(0);
        expect(chars_to_tokens(4)).toBe(1);
        expect(chars_to_tokens(6)).toBe(2); // 1.5 → 2 (round-half-to-even)
        expect(chars_to_tokens(10)).toBe(2); // 2.5 → 2 (round-half-to-even)
        expect(chars_to_tokens(14)).toBe(4); // 3.5 → 4
        expect(chars_to_tokens(100)).toBe(25);
    });

    it('aggregate handles fewer-than-10 savings (min/max fallback)', () => {
        const rows = [
            mkRow('a.md', 'cat1', 100, 90),
            mkRow('b.md', 'cat1', 200, 150),
            mkRow('c.md', 'cat2', 50, 60),
            { path: 'd.md', category: 'cat2', error: 'not-found' },
        ];
        const agg = aggregate(rows);
        expect(agg.calls).toBe(4);
        expect(agg.errors).toBe(1);
        // 3 ok rows → quantiles fall back to min/max.
        expect(agg.p10_saving_pct).toBeCloseTo(Math.min(10, 25, -20), 9);
        expect(agg.p90_saving_pct).toBeCloseTo(Math.max(10, 25, -20), 9);
        expect(Object.keys(agg.by_category_median_pct).sort()).toEqual(['cat1', 'cat2']);
    });
});

describe.skipIf(!HAVE_PYTHON)('bench_condense_memory — differential pure layer vs python', () => {
    it('aggregate matches python statistics for >=10 savings', () => {
        const rows = [...Array(12).keys()].map((i) => mkRow(`f${i}.md`, i % 2 === 0 ? 'cat1' : 'cat2', 1000, 1000 - i * 7));
        const tsAgg = aggregate(rows) as unknown as Record<string, unknown>;
        const pyAgg = pyAggregate(rows);
        expect(roundAll(tsAgg)).toEqual(roundAll(pyAgg));
    });

    it('render_md matches python for a fixed payload', () => {
        const payload = {
            generated_at: '2026-06-01T00:00:00Z',
            schema: 'telegraph-v2',
            rows: [
                mkRow('AGENTS.md', 'thin-root-package', 1234, 1300),
                mkRow('docs/x.md', 'prose-heavy-contract', 9000, 8500),
                { path: 'missing.md', category: 'rule-classification', error: 'not-found' },
            ],
            aggregate: aggregate([
                mkRow('AGENTS.md', 'thin-root-package', 1234, 1300),
                mkRow('docs/x.md', 'prose-heavy-contract', 9000, 8500),
                { path: 'missing.md', category: 'rule-classification', error: 'not-found' },
            ]),
        };
        const tsMd = render_md(payload);
        const pyMd = pyRenderMd(payload);
        expect(tsMd).toBe(pyMd);
    });
});

// --- golden parity: full bench end-to-end (snapshot+restore) -------------

describe.skipIf(!HAVE_PYYAML)('bench_condense_memory — golden parity (full run)', () => {
    let snapJson: string | null;
    let snapMd: string | null;
    beforeEach(() => {
        snapJson = existsSync(REPORT_JSON) ? readFileSync(REPORT_JSON, 'utf-8') : null;
        snapMd = existsSync(REPORT_MD) ? readFileSync(REPORT_MD, 'utf-8') : null;
    });
    afterEach(() => {
        // Restore the git-tracked report files to their pre-test bytes so the
        // working tree is left exactly as found (zero git drift).
        if (snapJson !== null) {
            writeFileSync(REPORT_JSON, snapJson, 'utf-8');
        } else if (existsSync(REPORT_JSON)) {
            rmSync(REPORT_JSON);
        }
        if (snapMd !== null) {
            writeFileSync(REPORT_MD, snapMd, 'utf-8');
        } else if (existsSync(REPORT_MD)) {
            rmSync(REPORT_MD);
        }
    });

    it('python vs tsx produce byte-identical reports (modulo generated_at)', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(py.status, py.stderr).toBe(0);
        const pyJson = readFileSync(REPORT_JSON, 'utf-8');
        const pyMd = readFileSync(REPORT_MD, 'utf-8');

        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.status, ts.stderr).toBe(0);
        const tsJson = readFileSync(REPORT_JSON, 'utf-8');
        const tsMd = readFileSync(REPORT_MD, 'utf-8');

        const normJson = (s: string): string => s.replace(/"generated_at": "[^"]*"/, '"generated_at": "TS"');
        const normMd = (s: string): string => s.replace(/\*\*Generated:\*\* .*/, '**Generated:** TS');
        expect(normJson(tsJson)).toBe(normJson(pyJson));
        expect(normMd(tsMd)).toBe(normMd(pyMd));

        // stdout lines: "wrote: <json>" / "wrote: <md>" / "median saving: <pct>".
        const normOut = (s: string): string => s;
        expect(normOut(ts.stdout)).toBe(normOut(py.stdout));
    });
});

// --- helpers --------------------------------------------------------------

interface OkRow {
    path: string;
    category: string;
    before_chars: number;
    after_chars: number;
    delta_chars: number;
    saving_pct_chars: number;
    before_tokens_est: number;
    after_tokens_est: number;
    delta_tokens_est: number;
    saving_pct_tokens_est: number;
}

function mkRow(p: string, cat: string, before: number, after: number): OkRow {
    const beforeTok = chars_to_tokens(before);
    const afterTok = chars_to_tokens(after);
    return {
        path: p,
        category: cat,
        before_chars: before,
        after_chars: after,
        delta_chars: after - before,
        saving_pct_chars: ((before - after) * 100) / before,
        before_tokens_est: beforeTok,
        after_tokens_est: afterTok,
        delta_tokens_est: afterTok - beforeTok,
        saving_pct_tokens_est: beforeTok ? ((beforeTok - afterTok) * 100) / beforeTok : 0.0,
    };
}

function roundAll(agg: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(agg)) {
        if (typeof v === 'number') {
            out[k] = Math.round(v * 1e6) / 1e6;
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
            const inner: Record<string, number> = {};
            for (const [ik, iv] of Object.entries(v as Record<string, number>)) {
                inner[ik] = Math.round(iv * 1e6) / 1e6;
            }
            out[k] = inner;
        } else {
            out[k] = v;
        }
    }
    return out;
}

/** Run python's aggregate() over the same rows via the real module. */
function pyAggregate(rows: unknown[]): Record<string, unknown> {
    const code = [
        'import json, sys',
        `sys.path.insert(0, ${JSON.stringify(join(REPO_ROOT, 'src', 'scripts'))})`,
        'import bench_condense_memory as b',
        'rows = json.loads(sys.stdin.read())',
        'print(json.dumps(b.aggregate(rows)))',
    ].join('\n');
    const res = spawnSync('python3', ['-c', code], { input: JSON.stringify(rows), encoding: 'utf8' });
    if (res.status !== 0) {
        throw new Error(`py aggregate failed: ${res.stderr}`);
    }
    return JSON.parse(res.stdout) as Record<string, unknown>;
}

/** Run python's render_md() over the same payload via the real module. */
function pyRenderMd(payload: unknown): string {
    const code = [
        'import json, sys',
        `sys.path.insert(0, ${JSON.stringify(join(REPO_ROOT, 'src', 'scripts'))})`,
        'import bench_condense_memory as b',
        'payload = json.loads(sys.stdin.read())',
        'sys.stdout.write(b.render_md(payload))',
    ].join('\n');
    const res = spawnSync('python3', ['-c', code], { input: JSON.stringify(payload), encoding: 'utf8' });
    if (res.status !== 0) {
        throw new Error(`py render_md failed: ${res.stderr}`);
    }
    return res.stdout;
}

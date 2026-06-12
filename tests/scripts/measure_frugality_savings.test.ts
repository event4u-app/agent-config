// Tests for src/scripts/measure_frugality_savings.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// public metric builders (metric_a_footprint, metric_c_condensation,
// metric_d_redundancy, buildRecord) plus a golden-parity layer (python3 vs
// tsx) asserting the appended JSONL row + stdout are byte-identical (the `ts`
// timestamp normalized). The gitignored baseline file is restored afterwards.
// Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    CANON_RULES,
    buildRecord,
    metric_a_footprint,
    metric_c_condensation,
    metric_d_redundancy,
} from '../../src/scripts/measure_frugality_savings.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_frugality_savings.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_frugality_savings.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const BASELINE = path.join(REPO_ROOT, 'agents', 'runtime', 'frugality', 'baseline.jsonl');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('metric builders (real repo)', () => {
    it('metric_a_footprint reports per-rule chars + kernel breakdown', () => {
        const a = metric_a_footprint(REPO_ROOT);
        expect((a['rules'] as unknown[]).length).toBe(CANON_RULES.length);
        expect(a['kernel_budget_chars']).toBe(26000);
        expect(typeof a['kernel_pct']).toBe('number');
        expect(typeof a['kernel_total_chars']).toBe('number');
    });
    it('metric_c_condensation reports a row per canon rule', () => {
        const c = metric_c_condensation(REPO_ROOT);
        expect((c['rules'] as unknown[]).length).toBe(CANON_RULES.length);
    });
    it('metric_d_redundancy reports xref sections + total', () => {
        const d = metric_d_redundancy(REPO_ROOT);
        expect((d['rules'] as unknown[]).length).toBe(CANON_RULES.length);
        expect(typeof d['total_xref_chars']).toBe('number');
    });
    it('buildRecord carries all four metrics + schema', () => {
        const rec = buildRecord(REPO_ROOT);
        expect(rec['schema_version']).toBe(1);
        expect(rec['phase']).toBe('phase_0_baseline');
        expect(rec).toHaveProperty('metric_a_footprint');
        expect(rec).toHaveProperty('metric_b_fillers');
        expect(rec).toHaveProperty('metric_c_condensation');
        expect(rec).toHaveProperty('metric_d_redundancy');
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('measure_frugality_savings — golden parity (python3 vs tsx)', () => {
    const normTs = (s: string): string => s.replace(/"ts": "[^"]*"/g, '"ts": "TS"');

    it('appended JSONL row + stdout byte-identical (ts normalized); baseline restored', () => {
        // The script appends to baseline.jsonl WITHOUT creating parent dirs
        // (faithful to the Python original, which assumes the dir exists in the
        // CI flow). Ensure it exists so the run does not crash; track whether we
        // created it so cleanup can remove it.
        const dir = path.dirname(BASELINE);
        const dirPreexisted = fs.existsSync(dir);
        if (!dirPreexisted) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const had = fs.existsSync(BASELINE);
        const before = had ? fs.readFileSync(BASELINE, 'utf-8') : null;
        const beforeLines = before === null ? 0 : before.split('\n').filter((l) => l !== '').length;
        try {
            const p = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
            expect(p.status).toBe(0);
            const t = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
            expect(t.status).toBe(0);

            // stdout parity (ts normalized)
            expect(normTs(t.stdout)).toBe(normTs(p.stdout));
            expect(t.stderr).toBe(p.stderr);

            // The two new appended rows: line[beforeLines] (py), [+1] (ts).
            const lines = fs.readFileSync(BASELINE, 'utf-8').split('\n').filter((l) => l !== '');
            const pyRow = lines[beforeLines] as string;
            const tsRow = lines[beforeLines + 1] as string;
            expect(normTs(tsRow)).toBe(normTs(pyRow));
        } finally {
            if (before === null) {
                fs.rmSync(BASELINE, { force: true });
            } else {
                fs.writeFileSync(BASELINE, before, 'utf-8');
            }
            if (!dirPreexisted) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        }
    });
});

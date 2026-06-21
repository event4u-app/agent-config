// Tests for src/scripts/bench_drift_check.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists for bench_drift_check.py, so this is a focused
// differential suite: a golden-parity layer (python3 vs tsx) over the real
// reports dir plus synthetic temp report sets for the warmup / drift-found /
// stale-skip branches. The drift VERDICT logic is deterministic; the measured
// numbers it consumes are stable once written.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasPython3, REPO_ROOT, normTiming, runPy, runTs } from './_bench_wave8d.js';

const py = hasPython3();

describe.skipIf(!py)('bench_drift_check — golden parity (python3 vs tsx)', () => {
    it('warmup (<2 reports) — identical JSON + exit 0', () => {
        const args = ['--corpus', '__nope__', '--json'];
        const p = runPy('bench_drift_check.py', args);
        const t = runTs('bench_drift_check.ts', args);
        expect(t.stdout).toBe(p.stdout);
        expect(t.status).toBe(p.status);
        expect(t.status).toBe(0);
    });

    it('warmup (<2 reports) — identical Markdown', () => {
        const args = ['--corpus', '__nope__'];
        expect(runTs('bench_drift_check.ts', args).stdout).toBe(
            runPy('bench_drift_check.py', args).stdout,
        );
    });

    it('real dev corpus — identical --json payload (thresholds float ".0")', () => {
        const args = ['--corpus', 'dev', '--json'];
        const p = runPy('bench_drift_check.py', args);
        const t = runTs('bench_drift_check.ts', args);
        expect(t.stdout).toBe(p.stdout);
        expect(t.status).toBe(p.status);
    });

    it('real dev corpus — identical Markdown', () => {
        const args = ['--corpus', 'dev'];
        expect(runTs('bench_drift_check.ts', args).stdout).toBe(
            runPy('bench_drift_check.py', args).stdout,
        );
    });

    it('custom thresholds + window — identical --json', () => {
        const args = ['--corpus', 'dev', '--window', '3', '--accuracy-drop-pp', '0.5', '--json'];
        const p = runPy('bench_drift_check.py', args);
        const t = runTs('bench_drift_check.ts', args);
        expect(t.stdout).toBe(p.stdout);
        expect(t.status).toBe(p.status);
    });
});

describe.skipIf(!py)('bench_drift_check — drift-found branch (synthetic reports)', () => {
    let rel: string;
    let abs: string;

    beforeEach(() => {
        // Reports dir is resolved as REPO_ROOT/<--reports-dir>; use a temp dir
        // under internal/bench so both interpreters read the same files.
        abs = fs.mkdtempSync(path.join(REPO_ROOT, 'internal', 'bench', '_w8d-'));
        rel = path.relative(REPO_ROOT, abs);
        const mk = (stamp: string, acc: number, q: number): void => {
            fs.writeFileSync(
                path.join(abs, `${stamp}-tt.json`),
                JSON.stringify({
                    selection: { selection_accuracy: acc },
                    cost: { source: 'none' },
                    quality: { source: 'collected', quality_score: q },
                }),
            );
        };
        mk('2026-01-01T00-00-00Z', 0.9, 0.9);
        mk('2026-01-02T00-00-00Z', 0.9, 0.9);
        mk('2026-01-03T00-00-00Z', 0.5, 0.5); // latest → selection + quality drift
    });

    afterEach(() => {
        fs.rmSync(abs, { recursive: true, force: true });
    });

    it('findings JSON + exit 2 identical', () => {
        const args = ['--corpus', 'tt', '--reports-dir', rel, '--json'];
        const p = runPy('bench_drift_check.py', args);
        const t = runTs('bench_drift_check.ts', args);
        expect(t.stdout).toBe(p.stdout);
        expect(t.status).toBe(p.status);
        expect(t.status).toBe(2);
        // float-derived finding fields carry the trailing ".0".
        expect(t.stdout).toContain('"baseline_mean": 0.9');
    });

    it('findings Markdown (:.4f) identical', () => {
        const args = ['--corpus', 'tt', '--reports-dir', rel];
        const p = runPy('bench_drift_check.py', args);
        const t = runTs('bench_drift_check.ts', args);
        expect(t.stdout).toBe(p.stdout);
        expect(t.status).toBe(p.status);
    });
});

describe('bench_drift_check — timing normaliser (no python required)', () => {
    it('strips stamp / generated_at fields', () => {
        const raw = '{"stamp": "2026-01-01T00-00-00Z", "generated_at": "2026-01-01T00:00:00Z"}';
        expect(normTiming(raw)).not.toContain('2026-01-01');
    });

    it('temp os import resolves', () => {
        expect(os.tmpdir()).toBeTruthy();
    });
});

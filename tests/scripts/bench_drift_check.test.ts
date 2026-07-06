// Tests for src/scripts/bench_drift_check.ts (py2ts Phase 8 / Wave 8d).
//
// The Python original is deleted, so this is a python-free intent suite over
// the tsx CLI: the warmup / real-corpus / drift-found branches plus custom
// thresholds. The drift VERDICT logic is deterministic; the measured numbers
// it consumes are stable once written. Timing-bound report fields are masked
// via normTiming before any content assertion.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REPO_ROOT, normTiming, runTs } from './_bench_wave8d.js';

interface DriftJson {
    status: string;
    corpus?: string;
    reports?: number;
    latest_report?: string;
    baseline_window?: number;
    thresholds?: Record<string, number>;
    findings?: Array<Record<string, unknown>>;
}

describe('bench_drift_check — CLI branches (tsx)', () => {
    it('warmup (<2 reports) — status JSON + exit 0', () => {
        const t = runTs('bench_drift_check.ts', ['--corpus', '__nope__', '--json']);
        expect(t.status).toBe(0);
        const out = JSON.parse(t.stdout) as DriftJson;
        expect(out).toEqual({ status: 'warmup', reports: 0 });
    });

    it('warmup (<2 reports) — Markdown notice + exit 0', () => {
        const t = runTs('bench_drift_check.ts', ['--corpus', '__nope__']);
        expect(t.status).toBe(0);
        expect(t.stdout).toContain('bench-drift · corpus=__nope__');
        expect(t.stdout).toContain('need ≥ 2 to compare; no drift gate yet.');
    });

    it('real dev corpus — well-formed --json verdict with float thresholds', () => {
        const t = runTs('bench_drift_check.ts', ['--corpus', 'dev', '--json']);
        const out = JSON.parse(t.stdout) as DriftJson;
        // The committed reports tree tracks repo state; assert shape, not values.
        expect(['ok', 'drift']).toContain(out.status);
        expect(out.corpus).toBe('dev');
        expect(out.thresholds).toEqual({
            accuracy_drop_pp: 5.0,
            cost_increase_pct: 20.0,
            quality_drop_pp: 10.0,
        });
        // Float-typed thresholds keep the trailing ".0" (Python repr contract).
        expect(t.stdout).toContain('"accuracy_drop_pp": 5.0');
        expect(t.status).toBe(out.status === 'drift' ? 2 : 0);
        expect(Array.isArray(out.findings)).toBe(true);
    });

    it('real dev corpus — Markdown verdict names the corpus', () => {
        const t = runTs('bench_drift_check.ts', ['--corpus', 'dev']);
        expect([0, 2]).toContain(t.status);
        expect(normTiming(t.stdout)).toContain('bench-drift · corpus=dev');
    });

    it('custom thresholds + window are honoured in --json', () => {
        const t = runTs('bench_drift_check.ts', [
            '--corpus',
            'dev',
            '--window',
            '3',
            '--accuracy-drop-pp',
            '0.5',
            '--json',
        ]);
        const out = JSON.parse(t.stdout) as DriftJson;
        expect(out.thresholds!['accuracy_drop_pp']).toBe(0.5);
        expect(out.baseline_window).toBeLessThanOrEqual(3);
        expect(t.status).toBe(out.status === 'drift' ? 2 : 0);
    });
});

describe('bench_drift_check — drift-found branch (synthetic reports)', () => {
    let rel: string;
    let abs: string;

    beforeEach(() => {
        // Reports dir is resolved as REPO_ROOT/<--reports-dir>; use a temp dir
        // under internal/bench so relative resolution matches production use.
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

    it('findings JSON reports both drifted axes + exit 2', () => {
        const t = runTs('bench_drift_check.ts', ['--corpus', 'tt', '--reports-dir', rel, '--json']);
        expect(t.status).toBe(2);
        const out = JSON.parse(t.stdout) as DriftJson;
        expect(out.status).toBe('drift');
        expect(out.latest_report).toBe('2026-01-03T00-00-00Z-tt.json');
        expect(out.baseline_window).toBe(2);
        expect(out.findings!.map((f) => f['axis'])).toEqual(['selection_accuracy', 'quality_score']);
        expect(out.findings![0]).toMatchObject({ latest: 0.5, delta_pp: -40.0 });
        // float-derived finding fields carry the trailing ".0" (Python repr).
        expect(t.stdout).toContain('"baseline_mean": 0.9');
    });

    it('findings Markdown formats values with :.4f + exit 2', () => {
        const t = runTs('bench_drift_check.ts', ['--corpus', 'tt', '--reports-dir', rel]);
        expect(t.status).toBe(2);
        expect(t.stdout).toContain('bench-drift · corpus=tt');
        expect(t.stdout).toContain('findings=2');
        expect(t.stdout).toContain('selection_accuracy: latest=0.5000 baseline_mean=0.9000');
        expect(t.stdout).toContain('quality_score: latest=0.5000 baseline_mean=0.9000');
    });
});

describe('bench_drift_check — timing normaliser', () => {
    it('strips stamp / generated_at fields', () => {
        const raw = '{"stamp": "2026-01-01T00-00-00Z", "generated_at": "2026-01-01T00:00:00Z"}';
        expect(normTiming(raw)).not.toContain('2026-01-01');
    });
});

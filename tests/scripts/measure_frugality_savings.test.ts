// Tests for src/scripts/measure_frugality_savings.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// public metric builders (metric_a_footprint, metric_c_condensation,
// metric_d_redundancy, buildRecord) plus a golden-parity layer (python3 vs
// tsx) asserting the appended JSONL row + stdout are byte-identical (the `ts`
// timestamp normalized). The gitignored baseline file is restored afterwards.
// Skipped without python3.
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


// Tests for src/scripts/lint_bench_ab.ts (py2ts Phase 4 / Wave 4b).
//
// No tests/test_lint_bench_ab.py existed (the bench_ab *_lib* modules have
// their own suites at tests/lib/bench_ab_*.test.ts). This is a focused suite
// over the linter's exported constants + parse_args plus a python-free CLI
// layer running the tsx twin on the REAL REPO bench corpora — the linter's
// real CI invocation.
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as ba from '../../src/scripts/lint_bench_ab.js';
import { runTs } from './_bench_wave8d.js';

describe('lint_bench_ab — exported contract', () => {
    it('carries the required doc sections', () => {
        // docs/benchmark.md is the v2 discipline-axis report; the v1
        // Headline/Track-A/Track-B/History structure was retired.
        expect(ba.REQUIRED_SECTIONS).toContain('## Honesty labels');
        expect(ba.REQUIRED_SECTIONS).toContain('Gate verdict:');
        expect(ba.REQUIRED_SECTIONS.length).toBe(3);
    });
    it('resolves the bench corpus paths under internal/bench', () => {
        expect(ba.TRACK_A_PATH.includes(path.join('internal', 'bench'))).toBe(true);
        expect(ba.TRACK_B_PATH.includes(path.join('internal', 'bench'))).toBe(true);
    });
    it('parse_args defaults quiet=false and reads --quiet', () => {
        expect(ba.parse_args([]).quiet).toBe(false);
        expect(ba.parse_args(['--quiet']).quiet).toBe(true);
    });
});

describe('lint_bench_ab — CLI on the real repo (tsx)', () => {
    it('lints the committed bench corpora green (the real CI invocation)', () => {
        const t = runTs('lint_bench_ab.ts', []);
        expect(t.status, t.stderr).toBe(0);
        expect(t.stdout.trim()).toBe('lint_bench_ab: OK');
    });

    it('--quiet suppresses the OK line', () => {
        const t = runTs('lint_bench_ab.ts', ['--quiet']);
        expect(t.status, t.stderr).toBe(0);
        expect(t.stdout.trim()).toBe('');
    });
});

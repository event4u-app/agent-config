// Tests for src/scripts/ci_status.ts (py2ts Phase 8 / Wave 8b).
//
// Ports tests/test_ci_status.py 1:1 — the JSON-parser path with no live
// `gh` invocations (compute_status, is_phantom, latest_per_workflow, the
// per-shape required-check selection). The live `gh run list` path is not
// golden-differentiated because it requires network + authenticated gh +
// real CI runs on a branch; the pure functions are the behavioural spec.
import { describe, expect, it } from 'vitest';

import * as cs from '../../src/scripts/ci_status.js';

function run(name: string, conclusion: string, jobs = -1): cs.Run {
    return cs.Run(name, conclusion, 'completed', jobs);
}

describe('ci_status — JSON-parser path (ports test_ci_status.py)', () => {
    it('all required green returns zero reds', () => {
        const required = new Set(['Consistency', 'Smoke Contracts']);
        const runs = [run('Consistency', 'success', 4), run('Smoke Contracts', 'success', 4)];
        const [greens, missing, reds] = cs.compute_status(runs, required, false);
        expect(new Set(greens.map(([n]) => n))).toEqual(required);
        expect(missing).toEqual([]);
        expect(reds).toEqual([]);
    });

    it('phantom zero-job failure is filtered', () => {
        const required = new Set(['sync-visibility.yml']);
        const runs = [run('sync-visibility.yml', 'failure', 0)];
        const [greens, , reds] = cs.compute_status(runs, required, false);
        expect(new Set(greens.map(([n]) => n))).toEqual(required);
        expect(reds).toEqual([]);
    });

    it('genuine failure lands in reds', () => {
        const required = new Set(['Consistency']);
        const runs = [run('Consistency', 'failure', 12)];
        const [greens, , reds] = cs.compute_status(runs, required, false);
        expect(greens).toEqual([]);
        expect(new Set(reds.map(([n]) => n))).toEqual(required);
    });

    it('missing required check is surfaced', () => {
        const required = new Set(['Consistency', 'Skill Lint']);
        const runs = [run('Consistency', 'success', 4)];
        const [greens, missing, reds] = cs.compute_status(runs, required, false);
        expect(new Set(greens.map(([n]) => n))).toEqual(new Set(['Consistency']));
        expect(missing).toEqual(['Skill Lint']);
        expect(reds).toEqual([]);
    });

    it('latest run per workflow wins', () => {
        const required = new Set(['Consistency']);
        const runs = [run('Consistency', 'success', 4), run('Consistency', 'failure', 4)];
        const [greens, , reds] = cs.compute_status(runs, required, false);
        expect(new Set(greens.map(([n]) => n))).toEqual(required);
        expect(reds).toEqual([]);
    });

    it('in-progress status is treated as no completed run', () => {
        const required = new Set(['Consistency']);
        const runs = [cs.Run('Consistency', '', 'in_progress', -1), run('Consistency', 'success', 4)];
        const [greens, , reds] = cs.compute_status(runs, required, false);
        expect(new Set(greens.map(([n]) => n))).toEqual(required);
        expect(reds).toEqual([]);
    });

    it('required set by shape matches contract', () => {
        const feature = cs.REQUIRED_CHECKS_BY_SHAPE['feature'] as Set<string>;
        const release = cs.REQUIRED_CHECKS_BY_SHAPE['release'] as Set<string>;
        const docs = cs.REQUIRED_CHECKS_BY_SHAPE['docs'] as Set<string>;
        const universal = ['Consistency', 'Smoke Contracts'];
        for (const u of universal) {
            expect(feature.has(u)).toBe(true);
            expect(release.has(u)).toBe(true);
            expect(docs.has(u)).toBe(true);
        }
        expect(feature.has('Tests')).toBe(true);
        expect(release.has('Tests')).toBe(false);
        expect(docs.has('Tests')).toBe(false);
        expect(release.has('Release Validation')).toBe(true);
        expect(feature.has('Release Validation')).toBe(false);
    });

    it('is_phantom only for failure with zero jobs', () => {
        expect(cs.is_phantom(run('x', 'failure', 0))).toBe(true);
        expect(cs.is_phantom(run('x', 'failure', 1))).toBe(false);
        expect(cs.is_phantom(run('x', 'success', 0))).toBe(false);
        expect(cs.is_phantom(run('x', 'cancelled', 0))).toBe(false);
    });
});

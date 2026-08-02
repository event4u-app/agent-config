/**
 * Evaluator-budget checker (road-to-credible-install Phase 6): absolute
 * budget + the >regression_pct creep rule (fails even under budget), and
 * every check individually red-testable.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    detectPosture,
    driftFindings,
    evaluate,
    evaluateFindings,
    type MeasurementRecord,
} from '../../src/scripts/check_evaluator_budgets.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUDGETS = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src', 'config', 'evaluator-budgets.json'), 'utf-8'),
) as { regression_pct: number; budgets: Record<string, { max: number; last_measured: number; method: string }> };

const doc = {
    regression_pct: 10,
    budgets: {
        size_mb: { max: 100, last_measured: 50, method: 'du' },
    },
};

describe('check_evaluator_budgets', () => {
    it('GREEN: under budget and under the creep ceiling', () => {
        expect(evaluate(doc, { size_mb: 52 })).toEqual([]);
    });

    it('RED: absolute budget exceeded', () => {
        const errors = evaluate(doc, { size_mb: 101 });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('exceeds budget');
    });

    it('RED: >10% regression fails even under the absolute budget', () => {
        const errors = evaluate(doc, { size_mb: 60 }); // 20% over last_measured, under max
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('regressed >10%');
    });

    it('RED: missing measurement fails (no silent coverage gap)', () => {
        const errors = evaluate(doc, {});
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('no measurement supplied');
    });

    it('committed budgets: every entry carries max, last_measured and a pinned method', () => {
        expect(Object.keys(BUDGETS.budgets).length).toBeGreaterThanOrEqual(7);
        for (const [name, entry] of Object.entries(BUDGETS.budgets)) {
            expect(entry.max, name).toBeGreaterThan(0);
            expect(entry.last_measured, name).toBeGreaterThan(0);
            expect(entry.method.length, name).toBeGreaterThan(10);
        }
    });
});

// --- Posture + drift (road-to-gates-that-can-fail Phase 5) -------------------

describe('check_evaluator_budgets — warn on main, fail on release', () => {
    it('a release context blocks; main / the nightly / a feature PR warn', () => {
        expect(detectPosture({ GITHUB_ACTIONS: 'true', GITHUB_HEAD_REF: 'release/9.14.0' }).posture)
            .toBe('fail');
        expect(detectPosture({ GITHUB_ACTIONS: 'true', GITHUB_BASE_REF: 'release/9.14.0' }).posture)
            .toBe('fail');
        expect(detectPosture({ GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/tags/v9.14.0' }).posture)
            .toBe('fail');
        expect(detectPosture({ GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main' }).posture)
            .toBe('warn');
        expect(
            detectPosture({ GITHUB_ACTIONS: 'true', GITHUB_HEAD_REF: 'feat/whatever' }).posture,
        ).toBe('warn');
    });

    it('a local run (no CI env) is strict by default', () => {
        const { posture, reason } = detectPosture({});
        expect(posture).toBe('fail');
        expect(reason).toContain('local run');
    });

    it('an explicit --posture override wins over the environment', () => {
        expect(detectPosture({ GITHUB_ACTIONS: 'true', GITHUB_HEAD_REF: 'release/9.14.0' }, 'warn')
            .posture).toBe('warn');
        expect(detectPosture({ GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main' }, 'fail')
            .posture).toBe('fail');
    });

    it('budget breaches are advisory but a missing measurement is structural', () => {
        // The posture may downgrade a breach; it must never downgrade a harness
        // that reported green having measured nothing.
        const breach = evaluateFindings(doc, { size_mb: 101 });
        expect(breach[0]!.severity).toBe('advisory');
        const missing = evaluateFindings(doc, {});
        expect(missing[0]!.severity).toBe('structural');
    });
});

describe('check_evaluator_budgets — drift vs the committed measurement record', () => {
    const driftDoc = {
        regression_pct: 10,
        budgets: {
            count_metric: { max: 100, last_measured: 50, method: 'a deterministic count' },
            timing_ms: {
                max: 100,
                last_measured: 50,
                method: 'wall clock',
                deterministic: false,
            },
        },
    };
    const record = (m: Record<string, number>): MeasurementRecord => ({
        schema_version: 1,
        recorded_at: '2026-08-02T03:17:00.000Z',
        git_sha: 'abcdef1234567890',
        measurements: m,
    });

    it('reports a deterministic metric that contradicts the record', () => {
        const findings = driftFindings(driftDoc, { count_metric: 51 }, record({ count_metric: 50 }));
        expect(findings).toHaveLength(1);
        expect(findings[0]!.message).toContain('measured 51');
        expect(findings[0]!.message).toContain('record says 50');
        expect(findings[0]!.severity).toBe('advisory');
    });

    it('IGNORES wall-clock metrics — a noisy comparison gets muted and then ignored', () => {
        // The council's recorded objection: non-deterministic comparison
        // produces noise, and a muted channel reproduces the original failure.
        expect(driftFindings(driftDoc, { timing_ms: 402 }, record({ timing_ms: 370 }))).toEqual([]);
    });

    it('agrees silently when the fresh run matches the record', () => {
        expect(driftFindings(driftDoc, { count_metric: 50 }, record({ count_metric: 50 }))).toEqual(
            [],
        );
    });

    it('no record (first run, fresh clone) is not a drift finding', () => {
        expect(driftFindings(driftDoc, { count_metric: 51 }, null)).toEqual([]);
    });

    it('a metric absent from the record is skipped, not guessed', () => {
        expect(driftFindings(driftDoc, { count_metric: 51 }, record({}))).toEqual([]);
    });

    it('the committed budgets state the posture and mark their wall-clock metrics', () => {
        const raw = JSON.parse(
            fs.readFileSync(
                path.join(REPO_ROOT, 'src', 'config', 'evaluator-budgets.json'),
                'utf-8',
            ),
        ) as {
            posture?: Record<string, unknown>;
            measurement_record?: { path?: string };
            budgets: Record<string, { deterministic?: boolean; regression_pct?: number }>;
        };
        expect(raw.posture?.['on_release']).toBe('fail');
        expect(raw.posture?.['on_main_and_prs']).toBe('warn');
        expect(raw.measurement_record?.path).toBe(
            'agents/evidence/metrics/evaluator-measurements.json',
        );
        // Every metric with a loosened creep rule is a wall-clock metric, and
        // every wall-clock metric must be excluded from the drift comparison —
        // otherwise the comparison flaps and stops being read.
        for (const [name, entry] of Object.entries(raw.budgets)) {
            if (entry.regression_pct !== undefined) {
                expect(entry.deterministic, `${name} loosens creep but claims determinism`).toBe(
                    false,
                );
            }
        }
    });
});

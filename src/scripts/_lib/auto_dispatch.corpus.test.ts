/**
 * Deterministic `parallelizable:` classifier recall + false-positive measurement
 * against the orchestration corpus (road-to-orchestration-scope-decision Phase 2
 * / road-to-subagent-value-realization-followup Phase 1 Step 3).
 *
 * The corpus tasks (`internal/bench/orchestration/corpus/*.md`) each document a
 * "Classification signal" and an expected dispatch mode. This encodes those
 * documented signals as `TaskSignals` and asserts `classifyTask` (the pure v1
 * classifier) fires the expected mode — recall on the modes v1 covers
 * (`do-in-parallel`, `do-in-steps`), FP=0 on the negative control, and the
 * documented scope gap (v1 has no `do-competitively` / verdict mode).
 *
 * This is the durable, reproducible "record actual hit/miss counts" deliverable
 * + a regression guard for the classifier. Deterministic — no spend, no agents.
 */
import { describe, expect, it } from 'vitest';

import { classifyTask, type ActivationInputs, type TaskSignals } from './auto_dispatch.js';

const ON: ActivationInputs = { enabled: true, auto: 'on', subagent_spawn: true };

/** Corpus signals transcribed from each task's documented "Classification signal". */
const CORPUS: Array<{
    id: string;
    signals: TaskSignals;
    expectMode: 'do-in-parallel' | 'do-in-steps' | null;
    note: string;
}> = [
    {
        id: 'orch-01',
        signals: { parallelizable: 'files', independent_slices: 4, size_estimate: 4, ordered_plan: false },
        expectMode: 'do-in-parallel',
        note: 'N independent files, same analysis shape',
    },
    {
        id: 'orch-02',
        signals: { ordered_plan: true, size_estimate: 5, independent_slices: 0 },
        expectMode: 'do-in-steps',
        note: 'explicit ordered numbered plan',
    },
    {
        id: 'orch-03',
        signals: { size_estimate: 3, independent_slices: 0, ordered_plan: false },
        expectMode: null,
        note: 'do-competitively — NOT a v1 DispatchMode (documented scope gap)',
    },
    {
        id: 'pv-01',
        signals: { size_estimate: 2, independent_slices: 0, ordered_plan: false },
        expectMode: null,
        note: 'verdict dispatch — out of the v1 parallel/steps scope',
    },
    {
        id: 'pv-02',
        signals: { size_estimate: 1, independent_slices: 0, ordered_plan: false },
        expectMode: null,
        note: 'negative control — a clean one-file task MUST NOT dispatch',
    },
];

describe('parallelizable classifier — corpus recall', () => {
    for (const c of CORPUS) {
        it(`${c.id}: ${c.note}`, () => {
            const r = classifyTask(c.signals, ON);
            expect(r.mode).toBe(c.expectMode);
        });
    }

    it('recall on v1-covered modes is 2/2 (orch-01 parallel, orch-02 steps)', () => {
        const covered = CORPUS.filter((c) => c.expectMode !== null);
        const hits = covered.filter((c) => classifyTask(c.signals, ON).mode === c.expectMode);
        expect(covered).toHaveLength(2);
        expect(hits).toHaveLength(2);
    });

    it('false-positive rate is 0 — the negative control (pv-02) never dispatches', () => {
        const pv02 = CORPUS.find((c) => c.id === 'pv-02')!;
        expect(classifyTask(pv02.signals, ON).action).not.toBe('dispatch');
    });

    it('documents the v1 scope gap: do-competitively (orch-03) + verdict (pv-01) are not classified', () => {
        for (const id of ['orch-03', 'pv-01']) {
            const c = CORPUS.find((x) => x.id === id)!;
            expect(classifyTask(c.signals, ON).mode).toBeNull();
        }
    });
});

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

import {
    classifyLookup,
    classifyTask,
    type ActivationInputs,
    type LookupClass,
    type TaskSignals,
} from './auto_dispatch.js';

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

/**
 * Lookup-class corpus (L0 — road-to-lean-agent-init Phase 1). The first four
 * entries are the live-observed 2026-07-28 task shapes that burned ~1.21M
 * subagent tokens; each must route to a primitive, never a spawn. The
 * negative controls are non-lookup tasks that must escalate unchanged.
 */
const LOOKUP_CORPUS: Array<{ id: string; text: string; expect: LookupClass | null }> = [
    // ── the four observed shapes (live evidence, 2026-07-28 session) ──
    { id: 'lk-01', text: 'Confirming ExternalApiProviderEnum definition location', expect: 'definition' },
    { id: 'lk-02', text: 'Confirming GWInput import call sites', expect: 'references' },
    { id: 'lk-03', text: 'Running check_enforcement_coverage report', expect: 'report-run' },
    { id: 'lk-04', text: 'Probing candidate strings with tsx', expect: 'string-existence' },
    // ── generalizations of the same shapes ──
    { id: 'lk-05', text: 'Where is classifyTask defined?', expect: 'definition' },
    { id: 'lk-06', text: 'Who calls readOrchestrationMetrics across the repo?', expect: 'references' },
    { id: 'lk-07', text: 'Does the string "lean-init-2026" exist anywhere in src/?', expect: 'string-existence' },
    { id: 'lk-08', text: 'Run the roadmap:progress-check report and summarize', expect: 'report-run' },
    { id: 'lk-09', text: 'Find all usages of InferredTier in tests', expect: 'references' },
    { id: 'lk-10', text: 'Locate the enum that lists the dispatch actions', expect: 'definition' },
    // ── negative controls — must escalate, never route to a primitive ──
    { id: 'lk-n1', text: 'Refactor the auth middleware to use the new session store', expect: null },
    { id: 'lk-n2', text: 'Fix the failing corpus test and explain the root cause', expect: null },
    { id: 'lk-n3', text: 'Design a migration plan for the audit schema', expect: null },
    { id: 'lk-n4', text: 'Review this diff for security issues', expect: null },
];

describe('lookup-class routing — corpus recall + FP=0 (lean-init L0)', () => {
    for (const c of LOOKUP_CORPUS) {
        it(`${c.id}: ${c.text}`, () => {
            const r = classifyLookup(c.text);
            expect(r.lookup_class).toBe(c.expect);
            expect(r.route).toBe(c.expect === null ? 'escalate' : 'primitive');
        });
    }

    it('recall on the four live-observed shapes is 4/4', () => {
        const observed = LOOKUP_CORPUS.filter((c) => c.id.startsWith('lk-0') && Number(c.id.slice(3)) <= 4);
        expect(observed).toHaveLength(4);
        for (const c of observed) {
            expect(classifyLookup(c.text).route).toBe('primitive');
        }
    });

    it('false-positive rate is 0 — no negative control routes to a primitive', () => {
        for (const c of LOOKUP_CORPUS.filter((x) => x.expect === null)) {
            expect(classifyLookup(c.text).route).toBe('escalate');
        }
    });

    it('unknown resolves to escalate with a non-degradation reason', () => {
        const r = classifyLookup('Do something clever with the codebase');
        expect(r.route).toBe('escalate');
        expect(r.primitive).toBeNull();
        expect(r.reason).toContain('never down-guessed');
    });
});

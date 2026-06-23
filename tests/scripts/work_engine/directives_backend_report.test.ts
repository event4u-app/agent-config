// Intent tests for work_engine/directives/backend/report.ts (py2ts ADR-094
// Phase 1 — backend directive set).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx renderer's own contract directly. The renderer is pure — it
// reads DeliveryState and writes `state.report`. Coverage: every section's
// populated + empty body, the memory-that-mattered drop rule, the visual-
// preview gating, follow-up aggregation order, kv-block rendering, and the
// advisory persona's suppressed next-commands section. No non-determinism.
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/report.js';
import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    const st = new DeliveryState(state);
    run(st);
    return st.report;
}

describe('directives/backend/report — AMBIGUITIES', () => {
    it('declares no surfaces (pure renderer)', () => {
        expect(AMBIGUITIES).toEqual([]);
    });
});

describe('directives/backend/report — rendered report', () => {
    const cases: Array<[string, ConstructorParameters<typeof DeliveryState>[0]]> = [
        ['minimal state (all empties / placeholders)', { ticket: {} }],
        [
            'fully populated, verify success → both next-commands',
            {
                ticket: { id: 'R-1', title: 'Build the thing' },
                persona: 'senior-engineer',
                plan: [{ title: 'Step A', detail: 'do A' }, 'plain step'],
                changes: [{ path: 'a.ts', lines: 'L1-L9', purpose: 'add' }, { file: 'b.ts' }],
                tests: { verdict: 'success', targeted: 12 },
                verify: { verdict: 'success', confidence: 'high' },
                outcomes: { verify: 'success' },
            },
        ],
        [
            'string plan body',
            { ticket: { id: 'R-2', title: 'T' }, plan: '  do this thing  ' },
        ],
        [
            'memory that mattered drops non-influential hits',
            {
                ticket: { id: 'R-3' },
                memory: [
                    { id: 'm1', type: 'domain-invariants', changed_outcome: true, note: 'mattered' },
                    { id: 'm2', type: 'historical-patterns' },
                ],
            },
        ],
        [
            'memory all non-influential → section dropped',
            { ticket: { id: 'R-4' }, memory: [{ id: 'm1', type: 'x' }] },
        ],
        [
            'visual preview rendered (render_ok + paths)',
            {
                ticket: { id: 'R-5' },
                ui_review: { preview: { render_ok: true, screenshot_path: 'shot.png', dom_dump_path: 'dom.html' } },
            },
        ],
        [
            'visual preview skipped (render_ok false) → dropped',
            { ticket: { id: 'R-6' }, ui_review: { preview: { render_ok: false, screenshot_path: 'x.png' } } },
        ],
        [
            'visual preview render_ok but no paths → dropped',
            { ticket: { id: 'R-7' }, ui_review: { preview: { render_ok: true } } },
        ],
        [
            'follow-ups aggregated from plan/verify/tests in order',
            {
                ticket: { id: 'R-8' },
                plan: { steps: ['x'], followups: [{ note: 'plan fup', anchor: 'P#1' }] },
                verify: { verdict: 'success', followups: [{ title: 'verify fup' }] },
                tests: { verdict: 'success', followups: [{ note: 'test fup' }] },
            },
        ],
        [
            'advisory persona suppresses next-commands',
            { ticket: { id: 'R-9' }, persona: 'advisory', outcomes: { verify: 'success' } },
        ],
        [
            'verify not success → only /commit suggested',
            { ticket: { id: 'R-10' }, outcomes: {} },
        ],
        [
            'tests as a plain string (kv-block string branch)',
            { ticket: { id: 'R-11' }, tests: '  all good  ' },
        ],
    ];

    it.each(cases)('%s', (_label, state) => {
        expect(runTs(state)).toMatchSnapshot();
    });
});

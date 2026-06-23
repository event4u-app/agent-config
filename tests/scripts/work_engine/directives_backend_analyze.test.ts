// Intent tests for work_engine/directives/backend/analyze.ts (ADR-094 py2ts
// Phase 1 — backend directive set).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx directive's own contract directly. The TS twin is exercised
// in-process: build a `DeliveryState` from a JSON fixture, run the directive,
// and emit `{outcome, questions, message}` as canonical JSON for an inline
// snapshot. Covers the three precondition surfaces (refine/memory upstream +
// lost acceptance criteria) and the BLOCKED reason text.
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/analyze.js';
import { DeliveryState, type StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

/** TS twin: build DeliveryState from the fixture, run, emit canonical JSON. */
function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    const r: StepResult = run(new DeliveryState(state));
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message }, null, 2);
}

describe('directives/backend/analyze — AMBIGUITIES', () => {
    it('declares the three precondition surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'upstream_refine_failed',
            'upstream_memory_failed',
            'lost_ac',
        ]);
    });
});

describe('directives/backend/analyze — outcome contract', () => {
    it('all preconditions met → SUCCESS', () => {
        expect(
            runTs({
                ticket: { id: 'T-1', acceptance_criteria: ['must do X'] },
                outcomes: { refine: 'success', memory: 'success' },
            }),
        ).toMatchInlineSnapshot(`
          "{
            "outcome": "success",
            "questions": [],
            "message": ""
          }"
        `);
    });

    it('refine not success → BLOCKED (single reason)', () => {
        expect(
            runTs({
                ticket: { id: 'T-2', acceptance_criteria: ['a'] },
                outcomes: { memory: 'success' },
            }),
        ).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-2 — analyze gate failed: refine step did not complete successfully.",
              "> 1. Re-run \`/implement-ticket\` from the start — rebuild upstream state",
              "> 2. Abort — the flow cannot continue"
            ],
            "message": "Ticket T-2 cannot enter the plan step: refine step did not complete successfully"
          }"
        `);
    });

    it('memory not success → BLOCKED', () => {
        expect(
            runTs({
                ticket: { id: 'T-3', acceptance_criteria: ['a'] },
                outcomes: { refine: 'success' },
            }),
        ).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-3 — analyze gate failed: memory step did not complete successfully.",
              "> 1. Re-run \`/implement-ticket\` from the start — rebuild upstream state",
              "> 2. Abort — the flow cannot continue"
            ],
            "message": "Ticket T-3 cannot enter the plan step: memory step did not complete successfully"
          }"
        `);
    });

    it('lost acceptance criteria (empty list) → BLOCKED', () => {
        expect(
            runTs({
                ticket: { id: 'T-4', acceptance_criteria: [] },
                outcomes: { refine: 'success', memory: 'success' },
            }),
        ).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-4 — analyze gate failed: ticket lost its acceptance criteria.",
              "> 1. Re-run \`/implement-ticket\` from the start — rebuild upstream state",
              "> 2. Abort — the flow cannot continue"
            ],
            "message": "Ticket T-4 cannot enter the plan step: ticket lost its acceptance criteria"
          }"
        `);
    });

    it('acceptance_criteria not a list → BLOCKED', () => {
        expect(
            runTs({
                ticket: { id: 'T-5', acceptance_criteria: 'a string not a list' },
                outcomes: { refine: 'success', memory: 'success' },
            }),
        ).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-5 — analyze gate failed: ticket lost its acceptance criteria.",
              "> 1. Re-run \`/implement-ticket\` from the start — rebuild upstream state",
              "> 2. Abort — the flow cannot continue"
            ],
            "message": "Ticket T-5 cannot enter the plan step: ticket lost its acceptance criteria"
          }"
        `);
    });

    it('all three missing → BLOCKED (three reasons joined)', () => {
        expect(
            runTs({
                ticket: { id: 'T-6' },
                outcomes: {},
            }),
        ).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-6 — analyze gate failed: refine step did not complete successfully; memory step did not complete successfully; ticket lost its acceptance criteria.",
              "> 1. Re-run \`/implement-ticket\` from the start — rebuild upstream state",
              "> 2. Abort — the flow cannot continue"
            ],
            "message": "Ticket T-6 cannot enter the plan step: refine step did not complete successfully; memory step did not complete successfully; ticket lost its acceptance criteria"
          }"
        `);
    });

    it('no ticket id → "(no id)" in headnote', () => {
        expect(
            runTs({
                ticket: {},
                outcomes: {},
            }),
        ).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket (no id) — analyze gate failed: refine step did not complete successfully; memory step did not complete successfully; ticket lost its acceptance criteria.",
              "> 1. Re-run \`/implement-ticket\` from the start — rebuild upstream state",
              "> 2. Abort — the flow cannot continue"
            ],
            "message": "Ticket (no id) cannot enter the plan step: refine step did not complete successfully; memory step did not complete successfully; ticket lost its acceptance criteria"
          }"
        `);
    });

    it('empty-string ticket id falls back to "(no id)"', () => {
        expect(
            runTs({
                ticket: { id: '' },
                outcomes: { refine: 'success', memory: 'success' },
            }),
        ).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket (no id) — analyze gate failed: ticket lost its acceptance criteria.",
              "> 1. Re-run \`/implement-ticket\` from the start — rebuild upstream state",
              "> 2. Abort — the flow cannot continue"
            ],
            "message": "Ticket (no id) cannot enter the plan step: ticket lost its acceptance criteria"
          }"
        `);
    });
});

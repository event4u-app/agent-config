// Intent tests for work_engine/directives/backend/implement.ts (ADR-094 py2ts
// Phase 1 — backend directive set).
//
// Was a python3-vs-tsx golden-parity rig; the `.py` original is gone, so this
// now asserts the tsx module's own contract directly. `run()` is exercised
// in-process against a `DeliveryState` built from each fixture and the full
// `{outcome, questions, message}` result is snapshotted. The persona gate,
// plan-gate, and changes-shape paths are all covered. No non-determinism.
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/implement.js';
import { DeliveryState, type StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): Pick<StepResult, 'outcome' | 'questions' | 'message'> {
    const r = run(new DeliveryState(state));
    return { outcome: r.outcome, questions: r.questions, message: r.message };
}

const ok = { plan: 'success' };

describe('directives/backend/implement — AMBIGUITIES', () => {
    it('declares the three surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'upstream_plan_failed',
            'empty_changes_delegate',
            'malformed_changes',
        ]);
    });
});

describe('directives/backend/implement — run() contract', () => {
    it('advisory persona → SUCCESS short-circuit', () => {
        expect(runTs({ ticket: { id: 'I-1' }, persona: 'advisory', outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "implement skipped: persona \`advisory\` is plan-only.",
            "outcome": "success",
            "questions": [],
          }
        `);
    });

    it('plan not success → BLOCKED precondition', () => {
        expect(runTs({ ticket: { id: 'I-2' }, outcomes: {} })).toMatchInlineSnapshot(`
          {
            "message": "Ticket I-2 cannot implement: plan gate did not pass.",
            "outcome": "blocked",
            "questions": [
              "> Ticket I-2 — implement gate refused: \`plan\` step did not complete successfully.",
              "> 1. Re-run \`/implement-ticket\` from the start",
              "> 2. Abort",
            ],
          }
        `);
    });

    it('empty changes → delegate apply-plan', () => {
        expect(runTs({ ticket: { id: 'I-3' }, outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket I-3 needs its plan applied before testing.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: apply-plan ticket=I-3",
              "> Ticket I-3 — applying the recorded plan under \`minimal-safe-diff\` + \`scope-control\`.",
              "> 1. Continue — apply the plan as recorded",
              "> 2. Abort — stop before any edits are made",
            ],
          }
        `);
    });

    it('valid changes → SUCCESS', () => {
        expect(
            runTs({ ticket: { id: 'I-4' }, changes: [{ path: 'a.ts' }, { file: 'b.ts' }], outcomes: ok }),
        ).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
          }
        `);
    });

    it('malformed change (no path/file) → BLOCKED shape', () => {
        expect(runTs({ ticket: { id: 'I-5' }, changes: [{ purpose: 'x' }], outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket I-5 changes shape invalid: change #1 has no path.",
            "outcome": "blocked",
            "questions": [
              "> Ticket I-5 — recorded changes are malformed: change #1 has no path.",
              "> 1. Re-run \`apply-plan\` and resume",
              "> 2. Abort — changes cannot be trusted",
            ],
          }
        `);
    });

    it('malformed change (non-dict entry) → BLOCKED shape', () => {
        expect(
            runTs({
                ticket: { id: 'I-6' },
                changes: ['not a dict'] as unknown as Array<Record<string, unknown>>,
                outcomes: ok,
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket I-6 changes shape invalid: change #1 is not a dict.",
            "outcome": "blocked",
            "questions": [
              "> Ticket I-6 — recorded changes are malformed: change #1 is not a dict.",
              "> 1. Re-run \`apply-plan\` and resume",
              "> 2. Abort — changes cannot be trusted",
            ],
          }
        `);
    });

    it('malformed change (blank path) → BLOCKED shape', () => {
        expect(runTs({ ticket: { id: 'I-7' }, changes: [{ path: '   ' }], outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket I-7 changes shape invalid: change #1 has no path.",
            "outcome": "blocked",
            "questions": [
              "> Ticket I-7 — recorded changes are malformed: change #1 has no path.",
              "> 1. Re-run \`apply-plan\` and resume",
              "> 2. Abort — changes cannot be trusted",
            ],
          }
        `);
    });

    it('multiple malformed changes → BLOCKED shape (joined)', () => {
        expect(
            runTs({
                ticket: { id: 'I-8' },
                changes: ['x', { why: 'y' }] as unknown as Array<Record<string, unknown>>,
                outcomes: ok,
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket I-8 changes shape invalid: change #1 is not a dict; change #2 has no path.",
            "outcome": "blocked",
            "questions": [
              "> Ticket I-8 — recorded changes are malformed: change #1 is not a dict; change #2 has no path.",
              "> 1. Re-run \`apply-plan\` and resume",
              "> 2. Abort — changes cannot be trusted",
            ],
          }
        `);
    });

    it('qa persona behaves like senior (no skip) → delegate', () => {
        expect(runTs({ ticket: { id: 'I-9' }, persona: 'qa', outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket I-9 needs its plan applied before testing.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: apply-plan ticket=I-9",
              "> Ticket I-9 — applying the recorded plan under \`minimal-safe-diff\` + \`scope-control\`.",
              "> 1. Continue — apply the plan as recorded",
              "> 2. Abort — stop before any edits are made",
            ],
          }
        `);
    });

    it('path falsy falls back to file key → SUCCESS', () => {
        expect(
            runTs({ ticket: { id: 'I-10' }, changes: [{ path: '', file: 'real.ts' }], outcomes: ok }),
        ).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
          }
        `);
    });

    it('no ticket id, delegate → "(no id)"', () => {
        expect(runTs({ ticket: {}, outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket (no id) needs its plan applied before testing.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: apply-plan ticket=(no id)",
              "> Ticket (no id) — applying the recorded plan under \`minimal-safe-diff\` + \`scope-control\`.",
              "> 1. Continue — apply the plan as recorded",
              "> 2. Abort — stop before any edits are made",
            ],
          }
        `);
    });
});

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
// A recorded RED observation — the implement gate refuses production work
// without one (or a recorded exemption).
const RED = { red: { behaviour: 'multiply returns the product', failure_class: 'assertion' } };

describe('directives/backend/implement — AMBIGUITIES', () => {
    it('declares the three surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'upstream_plan_failed',
            'no_red_evidence',
            'empty_changes_delegate',
            'malformed_changes',
        ]);
    });
});

describe('directives/backend/implement — RED gate', () => {
    it('no RED evidence → BLOCKED observe-red before any apply-plan', () => {
        expect(runTs({ ticket: { id: 'R-1' }, outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket R-1 needs an observed failing test before production work: no \`state.tests.red\` recorded.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: observe-red ticket=R-1",
              "> Ticket R-1 — implement gate refused: no \`state.tests.red\` recorded. Write the failing test for the next single behaviour and observe it fail first.",
              "> 1. Continue — write and run that one failing test",
              "> 2. Record an exemption — \`state.tests.red = {exempt: "<reason>"}\`",
            ],
          }
        `);
    });

    it('RED observation with no behaviour → BLOCKED observe-red', () => {
        expect(
            runTs({ ticket: { id: 'R-2' }, tests: { red: { failure_class: 'assertion' } }, outcomes: ok }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket R-2 needs an observed failing test before production work: a \`red\` observation names no \`behaviour\`.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: observe-red ticket=R-2",
              "> Ticket R-2 — implement gate refused: a \`red\` observation names no \`behaviour\`. Write the failing test for the next single behaviour and observe it fail first.",
              "> 1. Continue — write and run that one failing test",
              "> 2. Record an exemption — \`state.tests.red = {exempt: "<reason>"}\`",
            ],
          }
        `);
    });

    it('RED observation with an invalid failure class → BLOCKED observe-red', () => {
        expect(
            runTs({
                ticket: { id: 'R-3' },
                tests: { red: { behaviour: 'login rejects an unknown email', failure_class: 'broken_fixture' } },
                outcomes: ok,
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket R-3 needs an observed failing test before production work: \`red\` observation for \`login rejects an unknown email\` has \`failure_class\` outside assertion, missing_target, contract.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: observe-red ticket=R-3",
              "> Ticket R-3 — implement gate refused: \`red\` observation for \`login rejects an unknown email\` has \`failure_class\` outside assertion, missing_target, contract. Write the failing test for the next single behaviour and observe it fail first.",
              "> 1. Continue — write and run that one failing test",
              "> 2. Record an exemption — \`state.tests.red = {exempt: "<reason>"}\`",
            ],
          }
        `);
    });

    it('missing_target is a valid RED for a symbol that does not exist yet → delegate', () => {
        expect(
            runTs({
                ticket: { id: 'R-4' },
                tests: { red: { behaviour: 'LoginService exists', failure_class: 'missing_target' } },
                outcomes: ok,
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket R-4 needs its plan applied before testing.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: apply-plan ticket=R-4",
              "> Ticket R-4 — applying the recorded plan under \`minimal-safe-diff\` + \`scope-control\`.",
              "> 1. Continue — apply the plan as recorded",
              "> 2. Abort — stop before any edits are made",
            ],
          }
        `);
    });

    it('a recorded exemption passes the gate → delegate', () => {
        expect(
            runTs({ ticket: { id: 'R-5' }, tests: { red: { exempt: 'generated migration, no behaviour' } }, outcomes: ok }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket R-5 needs its plan applied before testing.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: apply-plan ticket=R-5",
              "> Ticket R-5 — applying the recorded plan under \`minimal-safe-diff\` + \`scope-control\`.",
              "> 1. Continue — apply the plan as recorded",
              "> 2. Abort — stop before any edits are made",
            ],
          }
        `);
    });

    it('a list of observations is accepted → delegate', () => {
        expect(
            runTs({
                ticket: { id: 'R-6' },
                tests: {
                    red: [
                        { behaviour: 'rejects unknown email', failure_class: 'assertion' },
                        { behaviour: 'honours the rate limit', failure_class: 'contract' },
                    ],
                },
                outcomes: ok,
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket R-6 needs its plan applied before testing.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: apply-plan ticket=R-6",
              "> Ticket R-6 — applying the recorded plan under \`minimal-safe-diff\` + \`scope-control\`.",
              "> 1. Continue — apply the plan as recorded",
              "> 2. Abort — stop before any edits are made",
            ],
          }
        `);
    });
});

describe('directives/backend/implement — run() contract', () => {
    it('advisory persona → SUCCESS short-circuit', () => {
        expect(runTs({ ticket: { id: 'I-1' }, persona: 'advisory', tests: RED, outcomes: ok })).toMatchInlineSnapshot(`
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
        expect(runTs({ ticket: { id: 'I-3' }, tests: RED, outcomes: ok })).toMatchInlineSnapshot(`
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
            runTs({ ticket: { id: 'I-4' }, changes: [{ path: 'a.ts' }, { file: 'b.ts' }], tests: RED, outcomes: ok }),
        ).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
          }
        `);
    });

    it('malformed change (no path/file) → BLOCKED shape', () => {
        expect(runTs({ ticket: { id: 'I-5' }, changes: [{ purpose: 'x' }], tests: RED, outcomes: ok })).toMatchInlineSnapshot(`
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
                tests: RED, outcomes: ok,
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
        expect(runTs({ ticket: { id: 'I-7' }, changes: [{ path: '   ' }], tests: RED, outcomes: ok })).toMatchInlineSnapshot(`
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
                tests: RED, outcomes: ok,
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
        expect(runTs({ ticket: { id: 'I-9' }, persona: 'qa', tests: RED, outcomes: ok })).toMatchInlineSnapshot(`
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
            runTs({ ticket: { id: 'I-10' }, changes: [{ path: '', file: 'real.ts' }], tests: RED, outcomes: ok }),
        ).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
          }
        `);
    });

    it('no ticket id, delegate → "(no id)"', () => {
        expect(runTs({ ticket: {}, tests: RED, outcomes: ok })).toMatchInlineSnapshot(`
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

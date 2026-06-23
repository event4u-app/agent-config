// Intent tests for work_engine/directives/backend/plan.ts (ADR-094 py2ts
// Phase 1 — backend directive set).
//
// Was a python3-vs-tsx golden-parity rig; the `.py` original is gone, so this
// now asserts the tsx module's own contract directly. `run()` is exercised
// in-process against a `DeliveryState` built from each fixture and the full
// `{outcome, questions, message}` result is snapshotted. Covers the analyze
// gate, the empty-plan delegate, every valid plan shape, and the malformed
// permutations. No non-determinism.
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/plan.js';
import { DeliveryState, type StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): Pick<StepResult, 'outcome' | 'questions' | 'message'> {
    const r = run(new DeliveryState(state));
    return { outcome: r.outcome, questions: r.questions, message: r.message };
}

const ok = { analyze: 'success' };

describe('directives/backend/plan — AMBIGUITIES', () => {
    it('declares the three surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual(['upstream_analyze_failed', 'empty_plan_delegate', 'malformed_plan']);
    });
});

describe('directives/backend/plan — run() contract', () => {
    it('analyze not success → BLOCKED precondition', () => {
        expect(runTs({ ticket: { id: 'P-1' }, outcomes: {} })).toMatchInlineSnapshot(`
          {
            "message": "Ticket P-1 cannot plan: analyze gate did not pass.",
            "outcome": "blocked",
            "questions": [
              "> Ticket P-1 — plan gate refused: \`analyze\` step did not complete successfully.",
              "> 1. Re-run \`/implement-ticket\` from the start",
              "> 2. Abort",
            ],
          }
        `);
    });

    it('empty plan (null) → delegate create-plan', () => {
        expect(runTs({ ticket: { id: 'P-2' }, outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket P-2 needs a plan before implementation.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: create-plan ticket=P-2",
              "> Ticket P-2 — no plan recorded yet; running \`feature-plan\` and resuming.",
              "> 1. Continue — use the plan produced by \`feature-plan\`",
              "> 2. Abort — stop before any edits are proposed",
            ],
          }
        `);
    });

    it('blank-string plan → delegate (whitespace == empty)', () => {
        expect(runTs({ ticket: { id: 'P-3' }, plan: '   ', outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket P-3 needs a plan before implementation.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: create-plan ticket=P-3",
              "> Ticket P-3 — no plan recorded yet; running \`feature-plan\` and resuming.",
              "> 1. Continue — use the plan produced by \`feature-plan\`",
              "> 2. Abort — stop before any edits are proposed",
            ],
          }
        `);
    });

    it('empty list plan → delegate', () => {
        expect(runTs({ ticket: { id: 'P-4' }, plan: [], outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket P-4 needs a plan before implementation.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: create-plan ticket=P-4",
              "> Ticket P-4 — no plan recorded yet; running \`feature-plan\` and resuming.",
              "> 1. Continue — use the plan produced by \`feature-plan\`",
              "> 2. Abort — stop before any edits are proposed",
            ],
          }
        `);
    });

    it('empty dict plan → delegate', () => {
        expect(runTs({ ticket: { id: 'P-5' }, plan: {}, outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket P-5 needs a plan before implementation.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: create-plan ticket=P-5",
              "> Ticket P-5 — no plan recorded yet; running \`feature-plan\` and resuming.",
              "> 1. Continue — use the plan produced by \`feature-plan\`",
              "> 2. Abort — stop before any edits are proposed",
            ],
          }
        `);
    });

    it('valid string plan → SUCCESS', () => {
        expect(runTs({ ticket: { id: 'P-6' }, plan: 'do the thing', outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
          }
        `);
    });

    it('valid list-of-strings plan → SUCCESS', () => {
        expect(runTs({ ticket: { id: 'P-7' }, plan: ['step one', 'step two'], outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
          }
        `);
    });

    it('valid list-of-dicts plan → SUCCESS', () => {
        expect(
            runTs({ ticket: { id: 'P-8' }, plan: [{ title: 'A' }, { step: 'B' }], outcomes: ok }),
        ).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
          }
        `);
    });

    it('valid dict-with-steps → SUCCESS', () => {
        expect(runTs({ ticket: { id: 'P-9' }, plan: { steps: ['x', 'y'] }, outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
          }
        `);
    });

    it('malformed list (dict without title) → BLOCKED shape', () => {
        expect(
            runTs({ ticket: { id: 'P-10' }, plan: [{ note: 'no title here' }], outcomes: ok }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket P-10 plan shape invalid: plan step #1 has no title.",
            "outcome": "blocked",
            "questions": [
              "> Ticket P-10 — recorded plan is malformed: plan step #1 has no title.",
              "> 1. Re-run \`feature-plan\` and resume",
              "> 2. Abort — the plan cannot be trusted",
            ],
          }
        `);
    });

    it('malformed list (blank string entry) → BLOCKED shape', () => {
        expect(runTs({ ticket: { id: 'P-11' }, plan: ['   '], outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket P-11 plan shape invalid: plan step #1 is not a usable string.",
            "outcome": "blocked",
            "questions": [
              "> Ticket P-11 — recorded plan is malformed: plan step #1 is not a usable string.",
              "> 1. Re-run \`feature-plan\` and resume",
              "> 2. Abort — the plan cannot be trusted",
            ],
          }
        `);
    });

    it('malformed list (multiple complaints) → BLOCKED shape', () => {
        expect(runTs({ ticket: { id: 'P-12' }, plan: [{ note: 'x' }, '   '], outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket P-12 plan shape invalid: plan step #1 has no title; plan step #2 is not a usable string.",
            "outcome": "blocked",
            "questions": [
              "> Ticket P-12 — recorded plan is malformed: plan step #1 has no title; plan step #2 is not a usable string.",
              "> 1. Re-run \`feature-plan\` and resume",
              "> 2. Abort — the plan cannot be trusted",
            ],
          }
        `);
    });

    it('dict without steps list → BLOCKED shape', () => {
        expect(runTs({ ticket: { id: 'P-13' }, plan: { name: 'no steps' }, outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket P-13 plan shape invalid: plan dict must carry a non-empty 'steps' list.",
            "outcome": "blocked",
            "questions": [
              "> Ticket P-13 — recorded plan is malformed: plan dict must carry a non-empty 'steps' list.",
              "> 1. Re-run \`feature-plan\` and resume",
              "> 2. Abort — the plan cannot be trusted",
            ],
          }
        `);
    });

    it('no ticket id, delegate → "(no id)"', () => {
        expect(runTs({ ticket: {}, outcomes: ok })).toMatchInlineSnapshot(`
          {
            "message": "Ticket (no id) needs a plan before implementation.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: create-plan ticket=(no id)",
              "> Ticket (no id) — no plan recorded yet; running \`feature-plan\` and resuming.",
              "> 1. Continue — use the plan produced by \`feature-plan\`",
              "> 2. Abort — stop before any edits are proposed",
            ],
          }
        `);
    });
});

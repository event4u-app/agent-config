// Intent tests for work_engine/directives/backend/test.ts (ADR-094 py2ts
// Phase 1 — backend directive set).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx directive's own contract directly. The TS twin is exercised
// in-process: build a `DeliveryState` from a JSON fixture, run the directive,
// and emit `{outcome, questions, message}` as canonical JSON for an inline
// snapshot. Covers persona gating (advisory skip, qa widen=full), verdict
// validation (the `{verdict!r}`-style repr in the malformed message), and the
// bad-verdict halt. `run()` is a pure function of the fixture — no clock /
// random / PATH — so the snapshots are deterministic.
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/test.js';
import { DeliveryState, type StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

/** TS twin: build DeliveryState from the fixture, run, emit canonical JSON. */
function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    const r: StepResult = run(new DeliveryState(state));
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message }, null, 2);
}

const ok = { implement: 'success' };

describe('directives/backend/test — AMBIGUITIES', () => {
    it('declares the four surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'upstream_implement_failed',
            'empty_tests_delegate',
            'malformed_tests',
            'bad_test_verdict',
        ]);
    });
});

describe('directives/backend/test — outcome contract', () => {
    it('advisory persona → SUCCESS short-circuit', () => {
        expect(runTs({ ticket: { id: 'T-1' }, persona: 'advisory', outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "success",
            "questions": [],
            "message": "test skipped: persona \`advisory\` is plan-only."
          }"
        `);
    });

    it('implement not success → BLOCKED precondition', () => {
        expect(runTs({ ticket: { id: 'T-2' }, outcomes: {} })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-2 — test gate refused: \`implement\` step did not complete successfully.",
              "> 1. Re-run \`/implement-ticket\` from the start",
              "> 2. Abort"
            ],
            "message": "Ticket T-2 cannot test: implement gate did not pass."
          }"
        `);
    });

    it('empty tests, senior → delegate targeted', () => {
        expect(runTs({ ticket: { id: 'T-3' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "@agent-directive: run-tests ticket=T-3 scope=targeted",
              "> Ticket T-3 — running tests: targeted first (\`--filter\` on the changed paths), full suite only if targeted passes.",
              "> 1. Continue — run targeted tests now",
              "> 2. Abort — skip testing (NOT recommended)"
            ],
            "message": "Ticket T-3 needs its tests run before verification."
          }"
        `);
    });

    it('empty tests, qa → delegate full (widen)', () => {
        expect(runTs({ ticket: { id: 'T-4' }, persona: 'qa', outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "@agent-directive: run-tests ticket=T-4 scope=full",
              "> Ticket T-4 — running tests: full suite (qa persona widens to catch regressions outside the changed paths).",
              "> 1. Continue — run full tests now",
              "> 2. Abort — skip testing (NOT recommended)"
            ],
            "message": "Ticket T-4 needs its tests run before verification."
          }"
        `);
    });

    it('success verdict → SUCCESS', () => {
        expect(runTs({ ticket: { id: 'T-5' }, tests: { verdict: 'success' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "success",
            "questions": [],
            "message": ""
          }"
        `);
    });

    it('failed verdict → BLOCKED bad verdict', () => {
        expect(runTs({ ticket: { id: 'T-6' }, tests: { verdict: 'failed' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-6 — tests reported \`failed\`. Verification cannot proceed on a non-success verdict.",
              "> 1. Fix the failing tests and re-run \`run-tests\`",
              "> 2. Continue anyway — override (NOT recommended)",
              "> 3. Abort"
            ],
            "message": "Ticket T-6 test verdict was \`failed\`, not success."
          }"
        `);
    });

    it('mixed verdict → BLOCKED bad verdict', () => {
        expect(runTs({ ticket: { id: 'T-7' }, tests: { verdict: 'mixed' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-7 — tests reported \`mixed\`. Verification cannot proceed on a non-success verdict.",
              "> 1. Fix the failing tests and re-run \`run-tests\`",
              "> 2. Continue anyway — override (NOT recommended)",
              "> 3. Abort"
            ],
            "message": "Ticket T-7 test verdict was \`mixed\`, not success."
          }"
        `);
    });

    it('tests not a dict → BLOCKED malformed (typename)', () => {
        expect(runTs({ ticket: { id: 'T-8' }, tests: ['list not dict'], outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-8 — recorded test output is malformed: state.tests must be a dict, got list.",
              "> 1. Re-run tests and resume",
              "> 2. Abort — test verdict cannot be trusted"
            ],
            "message": "Ticket T-8 tests shape invalid: state.tests must be a dict, got list."
          }"
        `);
    });

    it('unknown verdict string → BLOCKED malformed (repr)', () => {
        expect(runTs({ ticket: { id: 'T-9' }, tests: { verdict: 'weird' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-9 — recorded test output is malformed: state.tests['verdict'] must be one of success, failed, mixed; got 'weird'.",
              "> 1. Re-run tests and resume",
              "> 2. Abort — test verdict cannot be trusted"
            ],
            "message": "Ticket T-9 tests shape invalid: state.tests['verdict'] must be one of success, failed, mixed; got 'weird'."
          }"
        `);
    });

    it('missing verdict key (None) → BLOCKED malformed (repr None)', () => {
        expect(runTs({ ticket: { id: 'T-10' }, tests: { duration_ms: 5 }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-10 — recorded test output is malformed: state.tests['verdict'] must be one of success, failed, mixed; got None.",
              "> 1. Re-run tests and resume",
              "> 2. Abort — test verdict cannot be trusted"
            ],
            "message": "Ticket T-10 tests shape invalid: state.tests['verdict'] must be one of success, failed, mixed; got None."
          }"
        `);
    });

    it('no ticket id, delegate → "(no id)"', () => {
        expect(runTs({ ticket: {}, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "@agent-directive: run-tests ticket=(no id) scope=targeted",
              "> Ticket (no id) — running tests: targeted first (\`--filter\` on the changed paths), full suite only if targeted passes.",
              "> 1. Continue — run targeted tests now",
              "> 2. Abort — skip testing (NOT recommended)"
            ],
            "message": "Ticket (no id) needs its tests run before verification."
          }"
        `);
    });
});

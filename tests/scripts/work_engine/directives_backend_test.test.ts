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
    it('declares the five surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'upstream_implement_failed',
            'empty_tests_delegate',
            'malformed_tests',
            'bad_test_verdict',
            'self_fix_exhausted',
        ]);
    });
});

describe('directives/backend/test — RED evidence is not a verdict', () => {
    it('tests carrying only `red` → delegate run-tests, not a shape complaint', () => {
        expect(
            runTs({
                ticket: { id: 'T-R1' },
                tests: { red: { behaviour: 'export returns CSV', failure_class: 'missing_target' } },
                outcomes: ok,
            }),
        ).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "@agent-directive: run-tests ticket=T-R1 scope=targeted",
              "> Ticket T-R1 — running tests: targeted first (\`--filter\` on the changed paths), full suite only if targeted passes.",
              "> 1. Continue — run targeted tests now",
              "> 2. Abort — skip testing (NOT recommended)"
            ],
            "message": "Ticket T-R1 needs its tests run before verification."
          }"
        `);
    });

    it('`red` plus a present-but-invalid verdict still BLOCKS on shape', () => {
        expect(
            runTs({
                ticket: { id: 'T-R2' },
                tests: { red: { behaviour: 'x', failure_class: 'assertion' }, verdict: 'green' },
                outcomes: ok,
            }),
        ).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket T-R2 — recorded test output is malformed: state.tests['verdict'] must be one of success, failed, mixed; got 'green'.",
              "> 1. Re-run tests and resume",
              "> 2. Abort — test verdict cannot be trusted"
            ],
            "message": "Ticket T-R2 tests shape invalid: state.tests['verdict'] must be one of success, failed, mixed; got 'green'."
          }"
        `);
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

    it('failed verdict → self-fix attempt 1 delegated by directive', () => {
        expect(runTs({ ticket: { id: 'T-6' }, tests: { verdict: 'failed' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "@agent-directive: fix-failing-checks ticket=T-6 lane=test attempt=1 ceiling=3",
              "> Ticket T-6 — \`test\` reported \`failed\`. Self-fix attempt 1 of 3.",
              "> The verdict is deterministic, so the fix is delegated rather than asked: read the failing assertions, fix the cause, re-run the same filter.",
              "> 1. Continue — fix the failures and re-run \`run-tests\`",
              "> 2. Abort — stop this cycle and hand the failures back"
            ],
            "message": "Ticket T-6 test verdict was \`failed\`; self-fix attempt 1/3 delegated."
          }"
        `);
    });

    it('mixed verdict → self-fix attempt 1 delegated by directive', () => {
        expect(runTs({ ticket: { id: 'T-7' }, tests: { verdict: 'mixed' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "@agent-directive: fix-failing-checks ticket=T-7 lane=test attempt=1 ceiling=3",
              "> Ticket T-7 — \`test\` reported \`mixed\`. Self-fix attempt 1 of 3.",
              "> The verdict is deterministic, so the fix is delegated rather than asked: read the failing assertions, fix the cause, re-run the same filter.",
              "> 1. Continue — fix the failures and re-run \`run-tests\`",
              "> 2. Abort — stop this cycle and hand the failures back"
            ],
            "message": "Ticket T-7 test verdict was \`mixed\`; self-fix attempt 1/3 delegated."
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

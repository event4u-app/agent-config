// Intent tests for work_engine/directives/backend/verify.ts (ADR-094 py2ts
// Phase 1 — backend directive set).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx directive's own contract directly. The TS twin is exercised
// in-process: build a `DeliveryState` from a JSON fixture, run the directive,
// and emit `{outcome, questions, message}` as canonical JSON for an inline
// snapshot. Covers persona gating (advisory skip), verdict validation (the
// `{verdict!r}`-style repr in the malformed message), and the bad-verdict halt
// (`blocked` / `partial`). `run()` is a pure function of the fixture — no
// clock / random / PATH — so the snapshots are deterministic.
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/verify.js';
import { DeliveryState, type StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

/** TS twin: build DeliveryState from the fixture, run, emit canonical JSON. */
function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): string {
    const r: StepResult = run(new DeliveryState(state));
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message }, null, 2);
}

const ok = { test: 'success' };

describe('directives/backend/verify — AMBIGUITIES', () => {
    it('declares the four surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'upstream_test_failed',
            'empty_verify_delegate',
            'malformed_verify',
            'bad_verify_verdict',
        ]);
    });
});

describe('directives/backend/verify — outcome contract', () => {
    it('advisory persona → SUCCESS short-circuit', () => {
        expect(runTs({ ticket: { id: 'V-1' }, persona: 'advisory', outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "success",
            "questions": [],
            "message": "verify skipped: persona \`advisory\` is plan-only."
          }"
        `);
    });

    it('test not success → BLOCKED precondition', () => {
        expect(runTs({ ticket: { id: 'V-2' }, outcomes: {} })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket V-2 — verify gate refused: \`test\` step did not complete successfully.",
              "> 1. Re-run \`/implement-ticket\` from the start",
              "> 2. Abort"
            ],
            "message": "Ticket V-2 cannot verify: test gate did not pass."
          }"
        `);
    });

    it('empty verify → delegate review-changes', () => {
        expect(runTs({ ticket: { id: 'V-3' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "@agent-directive: review-changes ticket=V-3",
              "> Ticket V-3 — running the four-judge review (bugs, security, tests, code quality) before the delivery report is written.",
              "> 1. Continue — run \`review-changes\` now",
              "> 2. Abort — skip review (NOT recommended)"
            ],
            "message": "Ticket V-3 needs \`review-changes\` before the report."
          }"
        `);
    });

    it('success verdict → SUCCESS', () => {
        expect(runTs({ ticket: { id: 'V-4' }, verify: { verdict: 'success' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "success",
            "questions": [],
            "message": ""
          }"
        `);
    });

    it('blocked verdict → BLOCKED bad verdict', () => {
        expect(runTs({ ticket: { id: 'V-5' }, verify: { verdict: 'blocked' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket V-5 — \`review-changes\` reported \`blocked\`. The delivery report cannot claim completion on a non-success verdict (see \`verify-before-complete\`).",
              "> 1. Address the findings and re-run \`review-changes\`",
              "> 2. Continue anyway — override (NOT recommended)",
              "> 3. Abort"
            ],
            "message": "Ticket V-5 verify verdict was \`blocked\`, not success."
          }"
        `);
    });

    it('partial verdict → BLOCKED bad verdict', () => {
        expect(runTs({ ticket: { id: 'V-6' }, verify: { verdict: 'partial' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket V-6 — \`review-changes\` reported \`partial\`. The delivery report cannot claim completion on a non-success verdict (see \`verify-before-complete\`).",
              "> 1. Address the findings and re-run \`review-changes\`",
              "> 2. Continue anyway — override (NOT recommended)",
              "> 3. Abort"
            ],
            "message": "Ticket V-6 verify verdict was \`partial\`, not success."
          }"
        `);
    });

    it('verify not a dict → BLOCKED malformed (typename)', () => {
        expect(runTs({ ticket: { id: 'V-7' }, verify: 'a string', outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket V-7 — recorded verify output is malformed: state.verify must be a dict, got str.",
              "> 1. Re-run \`review-changes\` and resume",
              "> 2. Abort — verify verdict cannot be trusted"
            ],
            "message": "Ticket V-7 verify shape invalid: state.verify must be a dict, got str."
          }"
        `);
    });

    it('unknown verdict string → BLOCKED malformed (repr)', () => {
        expect(runTs({ ticket: { id: 'V-8' }, verify: { verdict: 'failed' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket V-8 — recorded verify output is malformed: state.verify['verdict'] must be one of success, blocked, partial; got 'failed'.",
              "> 1. Re-run \`review-changes\` and resume",
              "> 2. Abort — verify verdict cannot be trusted"
            ],
            "message": "Ticket V-8 verify shape invalid: state.verify['verdict'] must be one of success, blocked, partial; got 'failed'."
          }"
        `);
    });

    it('missing verdict key (None) → BLOCKED malformed (repr None)', () => {
        expect(runTs({ ticket: { id: 'V-9' }, verify: { confidence: 'high' }, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "> Ticket V-9 — recorded verify output is malformed: state.verify['verdict'] must be one of success, blocked, partial; got None.",
              "> 1. Re-run \`review-changes\` and resume",
              "> 2. Abort — verify verdict cannot be trusted"
            ],
            "message": "Ticket V-9 verify shape invalid: state.verify['verdict'] must be one of success, blocked, partial; got None."
          }"
        `);
    });

    it('no ticket id, delegate → "(no id)"', () => {
        expect(runTs({ ticket: {}, outcomes: ok })).toMatchInlineSnapshot(`
          "{
            "outcome": "blocked",
            "questions": [
              "@agent-directive: review-changes ticket=(no id)",
              "> Ticket (no id) — running the four-judge review (bugs, security, tests, code quality) before the delivery report is written.",
              "> 1. Continue — run \`review-changes\` now",
              "> 2. Abort — skip review (NOT recommended)"
            ],
            "message": "Ticket (no id) needs \`review-changes\` before the report."
          }"
        `);
    });
});

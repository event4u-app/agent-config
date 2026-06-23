// Intent tests for work_engine/directives/backend/refine.ts (ADR-094 py2ts
// Phase 1 — backend directive set).
//
// Was a python3-vs-tsx golden-parity rig; the `.py` original is gone, so this
// now asserts the tsx module's own contract directly. The gate routes on
// envelope shape (ticket path vs prompt path) and mutates `state.ticket` on the
// prompt path (`confidence`, `acceptance_criteria`). `run()` is exercised
// in-process against a `DeliveryState` built from each fixture and the full
// `{outcome, questions, message, ticket}` result is snapshotted. Coverage:
// ticket-path SUCCESS + every deficiency permutation, the headnote id fallback,
// the prompt-path delegate (no AC) directive, and the high / medium /
// medium-confirmed / low / ui-intent confidence bands incl. the confidence
// projection. No non-determinism.
import { describe, expect, it } from 'vitest';

import { AMBIGUITIES, run } from '../../../src/agent-src/templates/scripts/work_engine/directives/backend/refine.js';
import { DeliveryState, type StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';

/** TS twin: build DeliveryState from the fixture, run, return the result + mutated ticket. */
function runTs(state: ConstructorParameters<typeof DeliveryState>[0]): {
    outcome: StepResult['outcome'];
    questions: StepResult['questions'];
    message: StepResult['message'];
    ticket: unknown;
} {
    const st = new DeliveryState(state);
    const r = run(st);
    return { outcome: r.outcome, questions: r.questions, message: r.message, ticket: st.ticket };
}

describe('directives/backend/refine — AMBIGUITIES', () => {
    it('declares the seven surfaces in order', () => {
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'missing_id',
            'trivial_title',
            'missing_or_vague_ac',
            'prompt_unrefined',
            'prompt_medium_confidence',
            'prompt_low_confidence',
            'prompt_ui_intent',
        ]);
    });

    it('renders the configurable length floors into trigger text', () => {
        const trivialTitle = AMBIGUITIES.find((a) => a.code === 'trivial_title');
        const vagueAc = AMBIGUITIES.find((a) => a.code === 'missing_or_vague_ac');
        expect(trivialTitle?.trigger).toContain('3 chars');
        expect(vagueAc?.trigger).toContain('10 chars');
    });
});

describe('directives/backend/refine — run() contract', () => {
    // --- ticket path -------------------------------------------------------
    it('well-formed ticket → SUCCESS', () => {
        expect(
            runTs({
                ticket: {
                    id: 'T-1',
                    title: 'Build the widget',
                    acceptance_criteria: ['the user must see the widget on load'],
                },
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
            "ticket": {
              "acceptance_criteria": [
                "the user must see the widget on load",
              ],
              "id": "T-1",
              "title": "Build the widget",
            },
          }
        `);
    });

    it('empty ticket → all three deficiencies, "(no id)" headnote', () => {
        expect(runTs({ ticket: {} })).toMatchInlineSnapshot(`
          {
            "message": "Ticket (no id) is not refined enough to plan against: missing ticket id; missing or trivial title; no acceptance criteria",
            "outcome": "blocked",
            "questions": [
              "> Ticket (no id) is missing: missing ticket id; missing or trivial title; no acceptance criteria.",
              "> 1. Run \`/refine-ticket (no id)\` and re-invoke \`/implement-ticket\`",
              "> 2. Provide the missing details in chat — I'll merge them into the ticket",
              "> 3. Abandon this ticket — too vague to implement",
            ],
            "ticket": {},
          }
        `);
    });

    it('missing id only → single deficiency', () => {
        expect(
            runTs({ ticket: { title: 'A solid title', acceptance_criteria: ['the user must see the widget on load'] } }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket (no id) is not refined enough to plan against: missing ticket id",
            "outcome": "blocked",
            "questions": [
              "> Ticket (no id) is missing: missing ticket id.",
              "> 1. Run \`/refine-ticket (no id)\` and re-invoke \`/implement-ticket\`",
              "> 2. Provide the missing details in chat — I'll merge them into the ticket",
              "> 3. Abandon this ticket — too vague to implement",
            ],
            "ticket": {
              "acceptance_criteria": [
                "the user must see the widget on load",
              ],
              "title": "A solid title",
            },
          }
        `);
    });

    it('trivial title (under floor) → BLOCKED', () => {
        expect(
            runTs({ ticket: { id: 'T-2', title: 'ab', acceptance_criteria: ['the user must see the widget on load'] } }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket T-2 is not refined enough to plan against: missing or trivial title",
            "outcome": "blocked",
            "questions": [
              "> Ticket T-2 is missing: missing or trivial title.",
              "> 1. Run \`/refine-ticket T-2\` and re-invoke \`/implement-ticket\`",
              "> 2. Provide the missing details in chat — I'll merge them into the ticket",
              "> 3. Abandon this ticket — too vague to implement",
            ],
            "ticket": {
              "acceptance_criteria": [
                "the user must see the widget on load",
              ],
              "id": "T-2",
              "title": "ab",
            },
          }
        `);
    });

    it('whitespace-only id falls back to "(no id)" in headnote', () => {
        expect(
            runTs({ ticket: { id: '   ', title: 'A solid title', acceptance_criteria: ['the user must see the widget'] } }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket     is not refined enough to plan against: missing ticket id",
            "outcome": "blocked",
            "questions": [
              "> Ticket     is missing: missing ticket id.",
              "> 1. Run \`/refine-ticket    \` and re-invoke \`/implement-ticket\`",
              "> 2. Provide the missing details in chat — I'll merge them into the ticket",
              "> 3. Abandon this ticket — too vague to implement",
            ],
            "ticket": {
              "acceptance_criteria": [
                "the user must see the widget",
              ],
              "id": "   ",
              "title": "A solid title",
            },
          }
        `);
    });

    it('acceptance_criteria not a list → "no acceptance criteria"', () => {
        expect(
            runTs({ ticket: { id: 'T-3', title: 'A solid title', acceptance_criteria: 'a string' } }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket T-3 is not refined enough to plan against: no acceptance criteria",
            "outcome": "blocked",
            "questions": [
              "> Ticket T-3 is missing: no acceptance criteria.",
              "> 1. Run \`/refine-ticket T-3\` and re-invoke \`/implement-ticket\`",
              "> 2. Provide the missing details in chat — I'll merge them into the ticket",
              "> 3. Abandon this ticket — too vague to implement",
            ],
            "ticket": {
              "acceptance_criteria": "a string",
              "id": "T-3",
              "title": "A solid title",
            },
          }
        `);
    });

    it('empty acceptance_criteria list → "no acceptance criteria"', () => {
        expect(
            runTs({ ticket: { id: 'T-4', title: 'A solid title', acceptance_criteria: [] } }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket T-4 is not refined enough to plan against: no acceptance criteria",
            "outcome": "blocked",
            "questions": [
              "> Ticket T-4 is missing: no acceptance criteria.",
              "> 1. Run \`/refine-ticket T-4\` and re-invoke \`/implement-ticket\`",
              "> 2. Provide the missing details in chat — I'll merge them into the ticket",
              "> 3. Abandon this ticket — too vague to implement",
            ],
            "ticket": {
              "acceptance_criteria": [],
              "id": "T-4",
              "title": "A solid title",
            },
          }
        `);
    });

    it('vague AC items (under floor + non-string) → position list', () => {
        expect(
            runTs({
                ticket: {
                    id: 'T-5',
                    title: 'A solid title',
                    acceptance_criteria: ['short', 'the user must see the widget on load', 42],
                },
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Ticket T-5 is not refined enough to plan against: vague acceptance criteria at position(s) 1, 3",
            "outcome": "blocked",
            "questions": [
              "> Ticket T-5 is missing: vague acceptance criteria at position(s) 1, 3.",
              "> 1. Run \`/refine-ticket T-5\` and re-invoke \`/implement-ticket\`",
              "> 2. Provide the missing details in chat — I'll merge them into the ticket",
              "> 3. Abandon this ticket — too vague to implement",
            ],
            "ticket": {
              "acceptance_criteria": [
                "short",
                "the user must see the widget on load",
                42,
              ],
              "id": "T-5",
              "title": "A solid title",
            },
          }
        `);
    });

    it('all three deficiencies with a real id', () => {
        expect(runTs({ ticket: { id: 'T-6', title: 'x', acceptance_criteria: [] } })).toMatchInlineSnapshot(`
          {
            "message": "Ticket T-6 is not refined enough to plan against: missing or trivial title; no acceptance criteria",
            "outcome": "blocked",
            "questions": [
              "> Ticket T-6 is missing: missing or trivial title; no acceptance criteria.",
              "> 1. Run \`/refine-ticket T-6\` and re-invoke \`/implement-ticket\`",
              "> 2. Provide the missing details in chat — I'll merge them into the ticket",
              "> 3. Abandon this ticket — too vague to implement",
            ],
            "ticket": {
              "acceptance_criteria": [],
              "id": "T-6",
              "title": "x",
            },
          }
        `);
    });

    // --- prompt path: delegate (no reconstructed AC) -----------------------
    it('prompt envelope, no AC → delegate directive', () => {
        expect(
            runTs({ ticket: { raw: 'add a rate limiter to the login endpoint behind a config flag' } }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Prompt envelope present but unrefined; delegating to refine-prompt.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: refine-prompt",
              "> Prompt received: add a rate limiter to the login endpoint behind a config flag",
              "> No reconstructed acceptance criteria yet — running \`refine-prompt\` and resuming.",
              "> 1. Continue — let the skill reconstruct AC + assumptions",
              "> 2. Abort — the prompt is not what I meant",
            ],
            "ticket": {
              "raw": "add a rate limiter to the login endpoint behind a config flag",
            },
          }
        `);
    });

    it('prompt envelope, AC not a list → delegate directive', () => {
        expect(
            runTs({ ticket: { raw: 'add a rate limiter', reconstructed_ac: 'not a list' } }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Prompt envelope present but unrefined; delegating to refine-prompt.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: refine-prompt",
              "> Prompt received: add a rate limiter",
              "> No reconstructed acceptance criteria yet — running \`refine-prompt\` and resuming.",
              "> 1. Continue — let the skill reconstruct AC + assumptions",
              "> 2. Abort — the prompt is not what I meant",
            ],
            "ticket": {
              "raw": "add a rate limiter",
              "reconstructed_ac": "not a list",
            },
          }
        `);
    });

    it('prompt envelope, long raw → preview is truncated with ellipsis', () => {
        expect(
            runTs({
                ticket: {
                    raw:
                        'add a comprehensive distributed rate limiter to the authentication login endpoint ' +
                        'with redis backing and per-tenant buckets and graceful degradation behaviour',
                },
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Prompt envelope present but unrefined; delegating to refine-prompt.",
            "outcome": "blocked",
            "questions": [
              "@agent-directive: refine-prompt",
              "> Prompt received: add a comprehensive distributed rate limiter to the authentication login endpoi…",
              "> No reconstructed acceptance criteria yet — running \`refine-prompt\` and resuming.",
              "> 1. Continue — let the skill reconstruct AC + assumptions",
              "> 2. Abort — the prompt is not what I meant",
            ],
            "ticket": {
              "raw": "add a comprehensive distributed rate limiter to the authentication login endpoint with redis backing and per-tenant buckets and graceful degradation behaviour",
            },
          }
        `);
    });

    // --- prompt path: high band → SUCCESS + confidence projection ----------
    it('prompt high band → SUCCESS, confidence + AC projected onto ticket', () => {
        expect(
            runTs({
                ticket: {
                    raw: 'add a rate limiter to the login endpoint in `auth/limiter.py` behind a config flag',
                    reconstructed_ac: [
                        'given a burst of requests, the endpoint must reject over the cap',
                        'when under the cap, requests should pass through unchanged',
                        'then the limiter must expose a per-tenant counter',
                    ],
                    assumptions: ['default cap is 100 req/min'],
                },
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
            "ticket": {
              "acceptance_criteria": [
                "given a burst of requests, the endpoint must reject over the cap",
                "when under the cap, requests should pass through unchanged",
                "then the limiter must expose a per-tenant counter",
              ],
              "assumptions": [
                "default cap is 100 req/min",
              ],
              "confidence": {
                "band": "high",
                "dimensions": {
                  "ac_evidence": 2,
                  "goal_clarity": 2,
                  "reversibility": 1,
                  "scope_boundary": 2,
                  "stack_data": 2,
                },
                "reasons": [
                  "goal_clarity=2: action verb + bounded length + single outcome",
                  "scope_boundary=2: explicit file/class/identifier named",
                  "ac_evidence=2: 3 criteria, 3 anchored",
                  "stack_data=2: prompt is behavioural, no stack/data signal",
                  "reversibility=1: config/env surface, partial rollback cost",
                ],
                "score": 0.9,
                "ui_intent": false,
              },
              "raw": "add a rate limiter to the login endpoint in \`auth/limiter.py\` behind a config flag",
              "reconstructed_ac": [
                "given a burst of requests, the endpoint must reject over the cap",
                "when under the cap, requests should pass through unchanged",
                "then the limiter must expose a per-tenant counter",
              ],
            },
          }
        `);
    });

    // --- prompt path: medium band → PARTIAL halt ---------------------------
    it('prompt medium band → PARTIAL assumptions halt', () => {
        expect(
            runTs({
                ticket: {
                    raw: 'improve the checkout flow',
                    reconstructed_ac: ['the user should reach payment faster'],
                    assumptions: ['fewer steps is the goal', 'no new payment provider'],
                },
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
            "ticket": {
              "acceptance_criteria": [
                "the user should reach payment faster",
              ],
              "assumptions": [
                "fewer steps is the goal",
                "no new payment provider",
              ],
              "confidence": {
                "band": "high",
                "dimensions": {
                  "ac_evidence": 1,
                  "goal_clarity": 2,
                  "reversibility": 2,
                  "scope_boundary": 1,
                  "stack_data": 2,
                },
                "reasons": [
                  "goal_clarity=2: action verb + bounded length + single outcome",
                  "scope_boundary=1: domain noun present, no concrete path",
                  "ac_evidence=1: 1 criteria, 1 anchored",
                  "stack_data=2: prompt is behavioural, no stack/data signal",
                  "reversibility=2: code-only change, cheap to revert",
                ],
                "score": 0.8,
                "ui_intent": false,
              },
              "raw": "improve the checkout flow",
              "reconstructed_ac": [
                "the user should reach payment faster",
              ],
            },
          }
        `);
    });

    it('prompt medium band, confidence_confirmed → SUCCESS', () => {
        expect(
            runTs({
                ticket: {
                    raw: 'improve the checkout flow',
                    reconstructed_ac: ['the user should reach payment faster'],
                    assumptions: ['fewer steps is the goal'],
                    confidence_confirmed: true,
                },
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
            "ticket": {
              "acceptance_criteria": [
                "the user should reach payment faster",
              ],
              "assumptions": [
                "fewer steps is the goal",
              ],
              "confidence": {
                "band": "high",
                "dimensions": {
                  "ac_evidence": 1,
                  "goal_clarity": 2,
                  "reversibility": 2,
                  "scope_boundary": 1,
                  "stack_data": 2,
                },
                "reasons": [
                  "goal_clarity=2: action verb + bounded length + single outcome",
                  "scope_boundary=1: domain noun present, no concrete path",
                  "ac_evidence=1: 1 criteria, 1 anchored",
                  "stack_data=2: prompt is behavioural, no stack/data signal",
                  "reversibility=2: code-only change, cheap to revert",
                ],
                "score": 0.8,
                "ui_intent": false,
              },
              "confidence_confirmed": true,
              "raw": "improve the checkout flow",
              "reconstructed_ac": [
                "the user should reach payment faster",
              ],
            },
          }
        `);
    });

    it('prompt medium band, no assumptions → "(none recorded)" line', () => {
        expect(
            runTs({
                ticket: {
                    raw: 'improve the checkout flow',
                    reconstructed_ac: ['the user should reach payment faster'],
                },
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "",
            "outcome": "success",
            "questions": [],
            "ticket": {
              "acceptance_criteria": [
                "the user should reach payment faster",
              ],
              "confidence": {
                "band": "high",
                "dimensions": {
                  "ac_evidence": 1,
                  "goal_clarity": 2,
                  "reversibility": 2,
                  "scope_boundary": 1,
                  "stack_data": 2,
                },
                "reasons": [
                  "goal_clarity=2: action verb + bounded length + single outcome",
                  "scope_boundary=1: domain noun present, no concrete path",
                  "ac_evidence=1: 1 criteria, 1 anchored",
                  "stack_data=2: prompt is behavioural, no stack/data signal",
                  "reversibility=2: code-only change, cheap to revert",
                ],
                "score": 0.8,
                "ui_intent": false,
              },
              "raw": "improve the checkout flow",
              "reconstructed_ac": [
                "the user should reach payment faster",
              ],
            },
          }
        `);
    });

    // --- prompt path: low band → BLOCKED single targeted question ----------
    it('prompt low band → BLOCKED, weakest-dimension question', () => {
        expect(
            runTs({
                ticket: {
                    raw: 'do the thing?',
                    reconstructed_ac: ['x'],
                },
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Prompt scored medium (0.50); halting for assumptions confirmation.",
            "outcome": "partial",
            "questions": [
              "> Prompt: do the thing?",
              "> Confidence: **medium** (score 0.50). Assumptions worth confirming before I plan.",
              "> Reconstructed AC:",
              ">    1. x",
              "> Assumptions:",
              ">    - (none recorded)",
              "> 1. Continue as-is — the AC + assumptions are good enough",
              "> 2. Refine — I'll send a corrected prompt and re-run \`refine-prompt\`",
              "> 3. Abort — pause this \`/work\` cycle",
            ],
            "ticket": {
              "acceptance_criteria": [
                "x",
              ],
              "confidence": {
                "band": "medium",
                "dimensions": {
                  "ac_evidence": 1,
                  "goal_clarity": 0,
                  "reversibility": 2,
                  "scope_boundary": 0,
                  "stack_data": 2,
                },
                "reasons": [
                  "goal_clarity=0: prompt is a question, no executable verb",
                  "scope_boundary=0: no file or domain anchor",
                  "ac_evidence=1: 1 criteria, 0 anchored",
                  "stack_data=2: prompt is behavioural, no stack/data signal",
                  "reversibility=2: code-only change, cheap to revert",
                ],
                "score": 0.5,
                "ui_intent": false,
              },
              "raw": "do the thing?",
              "reconstructed_ac": [
                "x",
              ],
            },
          }
        `);
    });

    // --- prompt path: ui-intent → BLOCKED regardless of band ---------------
    it('prompt ui-intent → BLOCKED pending R3 (even with strong AC)', () => {
        expect(
            runTs({
                ticket: {
                    raw: 'redesign the dashboard layout with new tailwind colors and spacing',
                    reconstructed_ac: [
                        'given the dashboard, the new theme must apply on load',
                        'when toggled, dark mode should persist across reloads',
                        'then the spacing must match the design tokens',
                    ],
                },
            }),
        ).toMatchInlineSnapshot(`
          {
            "message": "Prompt flagged as UI-intent (band=medium, score=0.70); blocked pending R3 UI track.",
            "outcome": "blocked",
            "questions": [
              "> Prompt: redesign the dashboard layout with new tailwind colors and spacing",
              "> This prompt reads as **UI work** — the backend dispatch track can't ship it cleanly.",
              "> UI dispatch is deferred to Roadmap 3 (\`road-to-product-ui-track.md\`); until it lands, \`/work\` only handles backend-shaped prompts.",
              "> 1. Re-frame as a backend-only prompt — I'll re-score and proceed",
              "> 2. Park this prompt — wait for R3 and re-invoke \`/work\` then",
              "> 3. Abort — drop this prompt",
            ],
            "ticket": {
              "acceptance_criteria": [
                "given the dashboard, the new theme must apply on load",
                "when toggled, dark mode should persist across reloads",
                "then the spacing must match the design tokens",
              ],
              "confidence": {
                "band": "medium",
                "dimensions": {
                  "ac_evidence": 2,
                  "goal_clarity": 0,
                  "reversibility": 2,
                  "scope_boundary": 1,
                  "stack_data": 2,
                },
                "reasons": [
                  "goal_clarity=0: no recognisable action verb",
                  "scope_boundary=1: domain noun present, no concrete path",
                  "ac_evidence=2: 3 criteria, 3 anchored",
                  "stack_data=2: prompt is behavioural, no stack/data signal",
                  "reversibility=2: code-only change, cheap to revert",
                ],
                "score": 0.7,
                "ui_intent": true,
              },
              "raw": "redesign the dashboard layout with new tailwind colors and spacing",
              "reconstructed_ac": [
                "given the dashboard, the new theme must apply on load",
                "when toggled, dark mode should persist across reloads",
                "then the spacing must match the design tokens",
              ],
            },
          }
        `);
    });
});

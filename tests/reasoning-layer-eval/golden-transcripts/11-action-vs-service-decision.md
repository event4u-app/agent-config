# Golden transcript — slot 11: action-vs-service-decision

- **Task family:** cross-run-calibration
- **Host strength:** standard
- **Discipline focus:** decision-ledger
- **Captured:** 2026-06-17 (controlled two-system-prompt API harness; single rater)

## Prompt

Should we use the Action pattern or a Service class for this workflow?

## Transcript — baseline (claude-haiku-4-5-20251001)

~~~text
I need to see the workflow to give you a meaningful answer. Can you share:

1. **What does the workflow do?** (the business logic/steps involved)
2. **How is it triggered?** (user action, scheduled job, event, etc.)
3. **Does it need to be reused across different contexts**, or is it specific to one feature?
4. **Does it have side effects** that need to be tracked/audited/reversed?

The short heuristic:
- **Action pattern**: Encapsulate a discrete operation with clear input/output; good for commands that might need testing, queueing, or undo.
- **Service class**: Coordinate multiple dependencies/steps; good for orchestration that doesn't need the formality of a command pattern.

Paste the relevant code or describe the scenario, and I'll give you a concrete recommendation.
~~~

**Tokens:** in 112 / out 195 / est $0.001087

## Transcript — treatment (claude-haiku-4-5-20251001)

~~~text
I need more context to give you a grounded recommendation. Let me ask one focused question:

**What is the workflow doing, and what are the constraints on how it's invoked?**

Specifically:
- Is it a single, discrete operation (e.g., "send email") or a multi-step orchestration (e.g., "validate → process → notify → log")?
- Will it be called from multiple places (controllers, events, jobs, tests)?
- Do you need to compose or chain these workflows together?
- Are there side effects that need to be logged, rolled back, or queued?
- What's the codebase's existing pattern — do you already use one of these elsewhere?

Once I see the shape of the problem, I can give you a single, actionable recommendation instead of a false choice between two patterns.
~~~

**Tokens:** in 662 / out 187 / est $0.001597

**Output-token overhead (treatment vs baseline):** -4.1%

## Rubric score (0–3 each) — fill during scoring

| dim | baseline | treatment | evidence (quote the transcript line) |
|---|---|---|---|
| 1 notes-first adherence |  |  |  |
| 2 grounding |  |  |  |
| 3 premature-solution avoidance |  |  |  |
| 4 coherence / re-grounded summary |  |  |  |

- **baseline mean:** _ / 3 · **treatment mean:** _ / 3 · **delta:** _
- **reasoning_extraction refusal seen?** no
- **notes:** 

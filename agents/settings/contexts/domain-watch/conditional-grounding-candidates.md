# Domain watch — conditional grounding candidates (evidence-gated)

> Per ADR-061 §5 and `road-to-frontend-design-intelligence` Step 9.6.
> These are NOT rejected — they are deferred behind the council's
> change-my-mind anchor.

## Candidates

1. **Finance method selection** — thin pre-action corpus: which valuation
   method + parameter ranges + failure modes (NOT the modeling itself —
   that stays `dcf-modeling` / `scenario-modeling` as framework skills,
   reference via RAG, validation via rules + `finance-safety-floor`).
2. **Architecture-pattern selection** — pattern × context → fit/cost
   decision rules (the method stays `architecture` guidance +
   `improve-before-implement` Strategy sniff test).

## Gate (the change-my-mind anchor)

Land ONLY when a corpus measurably beats the existing framework skill
over **≥10 real sessions** (logged comparisons: grounded vs ungrounded
outcome quality). Until that evidence exists, building these corpora is
grounding theater by definition.

## How to reopen

Collect session evidence via the corpus-grounding evidence-gap lines +
session notes; when ≥10 sessions show the delta, author per
`docs/guidelines/agent-infra/corpus-grounding-authoring.md` and ship with
owner + cadence.

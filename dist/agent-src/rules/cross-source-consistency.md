---
type: "auto"
tier: "2a"
description: "Two sources disagree (ticket text vs mockup, spec silent on a needed behavior, spec vs code) → surface + ask before proceeding, never silently guess"
triggers:
  - keyword: "ticket"
  - keyword: "refine"
  - keyword: "acceptance criteria"
  - keyword: "mockup"
  - keyword: "screenshot"
  - keyword: "attachment"
  - keyword: "roadmap"
  - keyword: "estimate"
  - phrase: "plan this ticket"
  - phrase: "refine this ticket"
  - phrase: "is this ticket clear"
  - phrase: "implement the ticket"
applies_to_user_types:
  - "developer"
  - "founder"
  - "consultant"
routes_to:
  - "guideline:agent-infra/cross-source-consistency-mechanics"
workspaces: [engineering, product]
packs: [engineering-base, product-basic]
collision_ok:
  "mockup": "a mockup is a second source — discrepancy check against the ticket text"
  "screenshot": "a screenshot is a second source — discrepancy check"
# obligation: line 71
obligation_frequency: "per-task"
---

# Cross-Source Consistency

When the agent works from **more than one source** — ticket text, an attached
image / mockup / screenshot, the spec, the codebase — those sources can
disagree. The failure this rule prevents: the agent notices (or should notice)
the disagreement, picks one reading, and proceeds silently — **even when its
pick is correct**. A good guess on a real contradiction still robs the user of
the decision that was theirs to make.

## The Iron Law

```
TWO PRESENT SOURCES DISAGREE → SURFACE THE DISCREPANCY AND ASK BEFORE PROCEEDING.
A SILENT GUESS ON A REAL CONTRADICTION IS A VIOLATION — EVEN IF THE GUESS IS RIGHT.
AN INFERRED-BUT-UNSPECIFIED BEHAVIOR IS A SCOPE EXPANSION: ASK, NEVER ADD IT SILENTLY.
OBVIOUS-TO-THE-AGENT ≠ IN-SCOPE.
```

## What counts as a discrepancy

- **(a) text ↔ image** — ticket text contradicts an attached mockup / screenshot / diagram (canonical case: text says "show birthdays **today**", the mockup shows a birthday from two days ago).
- **(b) silent-but-needed** — the spec is silent on a behavior that is clearly required (a weekend/holiday shift, an empty state, an error path). Surface it and ask **before** implementing — do not expand scope on a plausible inference (canonical case: the spec specifies weekend-shifting only; the agent also adds public-holiday shifting without asking).
- **(c) spec ↔ codebase/reality** — the spec contradicts what the code actually does or what a real source shows.
- **(d) intra-ticket** — the acceptance criteria, description, and comments contradict each other.

## When it fires — and when NOT

**Fires** while planning, refining, estimating, roadmapping, or implementing from
a ticket/spec that carries a second source (an attachment, a code reality, or an
internal contradiction), gated by `consistency.cross_source` in
`.agent-settings.yml` (`on` default · `auto` = high-confidence only · `off` = inert).
That file is the project layer of a cascade that starts user-global — never read
the setting or its absence from it alone; `agent-config settings:get
consistency.cross_source` reports the value and the file it came from.

**Does NOT fire** on a single clear source with no second source to compare
against (that is plain vagueness — it belongs to `ask-when-uncertain`), on
trivial edits, or when the user has already resolved the discrepancy this turn.

## How to surface it (subordinate to the ask discipline)

- **Subordinate to [`ask-when-uncertain`](ask-when-uncertain.md).** Fold the
  discrepancy into the SAME turn's single question — batch all discrepancies for
  one artefact into ONE numbered-options block. Never emit a second question
  block; one-question-per-turn holds.
- **Defer to [`scope-control`](scope-control.md)** as the permission authority
  for the type-(b) silent-scope-expansion case.
- **Precedes [`design-fidelity`](design-fidelity.md).** This rule fires first,
  at decision time ("text says X, the mockup says Y — which wins?"); once the
  user resolves it, `design-fidelity` governs build-time 1:1 fidelity.
- **Pass the [`no-cheap-questions`](no-cheap-questions.md) Pre-Send Self-Check.**
  Fire only on a genuine contradiction or silent-scope-expansion carrying a real
  trade-off — never a content-free "are you sure?". Under an autonomous mandate a
  detected discrepancy is a blocking decision and is NOT suppressed, but an
  off-hand non-contradiction must not become a continuation prompt.

The taxonomy, the scan procedure, the confidence-tiered noise control, worked
examples, and the precedence table live in
[`cross-source-consistency-mechanics`](../docs/guidelines/agent-infra/cross-source-consistency-mechanics.md).

## See also

- [`ask-when-uncertain`](ask-when-uncertain.md) — the one-question-per-turn ask discipline this folds into (missing info → ask; this adds conflicting present sources → ask).
- [`scope-control`](scope-control.md) — the permission authority for the silent-scope-expansion (type b) case.
- [`design-fidelity`](design-fidelity.md) — governs build-time fidelity once a text↔image conflict is resolved.
- [`active-remediation`](active-remediation.md) — the never-silently-ignore ladder this rule mirrors for source discrepancies.
- [`no-cheap-questions`](no-cheap-questions.md) — the floor the discrepancy ask must clear.

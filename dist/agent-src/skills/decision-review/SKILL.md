---
model_tier: high
name: decision-review
description: "Use to audit a past architectural decision — did the chosen option hold up, what assumptions drifted, should the ADR be superseded? Backward review only; does not lock new choices."
source: package
domain: process
workspaces:
  - engineering
packs:
  - analysis-workbench
lifecycle: active
trust:
  level: professional
  confidence: medium
  human_review_required: false
install:
  default: false
  removable: true
---

# decision-review

> Audit a past architectural decision: restate what was chosen and why,
> compare the original assumptions against reality now, and produce a
> verdict (still valid / needs amendment / superseded). Ends with a
> `historical-patterns` memory candidate per the
> [Analysis Memory Loop](../../../docs/contracts/analysis-memory-loop.md).
>
> **Direction:** backward (did it hold?) not forward (which option?).
> For forward flow, use [`decision-record`](../decision-record/SKILL.md).
> For filing the ADR file, use [`adr-create`](../adr-create/SKILL.md).

## When to use

- Revisiting a past architectural decision: "Did ADR-042 still make
  sense given what we learned?"
- A prior ADR is being cited as precedent and its validity should be
  checked before relying on it.
- A post-mortem or retrospective surfaces that an earlier choice may
  have contributed to problems.
- Preparation for a supersession: confirm the old decision actually
  needs replacing before writing a new ADR.

Do NOT use when:

- Making or locking a **new** decision — use
  [`decision-record`](../decision-record/SKILL.md) (which builds the
  options matrix and locks the choice).
- The ask is to file or number the ADR file — use
  [`adr-create`](../adr-create/SKILL.md).
- No prior decision or ADR exists to review — nothing to audit.

## Procedure

### 1. Locate and inspect the decision

Identify the ADR in `docs/decisions/` (flat, `ADR-NNN-<slug>.md`) or
`docs/adrs/<area>/` (per-area, `NNNN-<slug>.md`), or a logged
decision in `agents/decisions/`. If the user named the decision
informally, check the index for the slug before reading. Read the
full file before proceeding.

### 2. Restate: what was decided and why

Extract and restate in your own words:

- **Chosen option** — what was picked.
- **Context then** — the forcing function that made the decision
  necessary.
- **Assumptions** — the explicit and implicit priors the decision
  rested on (load, team size, vendor stability, regulatory state,
  tech maturity, cost, etc.).
- **Alternatives rejected** — why each runner-up lost.

This restatement is the baseline. Later steps compare against it.

### 3. Compare to reality now

For each assumption identified in step 2, classify:

| Assumption | Status | Evidence |
|---|---|---|
| *e.g. "vendor X is stable"* | held / broke / unknown | *e.g. "vendor deprecated API in v3"* |

Also list **new information** that did not exist when the decision
was made (new tooling, changed requirements, post-mortem learnings,
usage data).

Hindsight discipline: judge each assumption against the **information
available at the time it was made**, not against the outcome alone.
A decision can be correct given the information then and still need
revision now.

### 4. Verdict

One of three:

- **Still valid** — assumptions largely held; no amendment needed.
  Document the validation date so future reviewers know it was checked.
- **Needs amendment** — core decision stands but one or more
  consequences or constraints must be updated. Recommend the specific
  amendment and suggest filing a narrow ADR or addendum.
- **Superseded** — the chosen option no longer serves the original
  goal or a new forcing function invalidates it. Name the successor
  option. Recommend handing off to
  [`decision-record`](../decision-record/SKILL.md) (to lock the new
  choice) then [`adr-create`](../adr-create/SKILL.md) (to file the
  superseding ADR with `supersedes: ADR-NNN`).

### 5. Memory write-back (dedup-first)

Before drafting a new candidate, call `retrieve()` over the same
key-space (decision area, affected paths):

- **Match found** — propose a `frequency` / `supersedes` **update**
  to the existing entry. Do not create a duplicate.
- **No match** — draft a new `historical-patterns` candidate per the
  [Analysis Memory Loop § 1](../../../docs/contracts/analysis-memory-loop.md):

```jsonc
{
  "type": "historical-patterns",
  "summary": "<one-line pattern: what held or broke>",
  "evidence_paths": ["docs/decisions/ADR-NNN-<slug>.md"],
  "decision_surface": ["<area1>", "<area2>"],
  "last_validated": "YYYY-MM-DD",
  "review_after_days": 90,
  "applicable_scope": "project"
}
```

Surface the draft to the user via `/memory propose`. Never
auto-promote. If the candidate fails the admission gate (< 2
distinct evidence paths AND < 3 future decisions in
`decision_surface`), surface the gap and suggest deferring or
strengthening evidence.

## Output

1. **Decision restatement** — chosen option, context then, assumptions, alternatives rejected.
2. **Assumption-drift table** — each assumption: held / broke / unknown, with evidence.
3. **New information** not available at decision time.
4. **Verdict** — still valid / needs amendment / superseded — with rationale.
5. *(optional)* **Memory candidate** — `historical-patterns` draft or update proposal.

## Do NOT

- Re-litigate a decision that the verdict confirms is still valid.
  Acknowledge it, note the validation date, stop.
- Duplicate [`decision-record`](../decision-record/SKILL.md)'s options
  matrix and trade-off table — this skill reads the old matrix; it does
  not rebuild one unless the verdict is "superseded" and a new decision
  process is needed.
- Auto-promote memory candidates — the human drives promotion per the
  [Analysis Memory Loop](../../../docs/contracts/analysis-memory-loop.md).
- Issue a "superseded" verdict without naming the successor option or
  recommending the forward path to `decision-record` + `adr-create`.

## Gotchas

- **Backward vs forward:** `decision-review` asks "did the chosen
  option hold up?" — `decision-record` asks "which option should we
  pick?" Conflating them produces a partial analysis: either a
  verdict without a replacement plan, or a replacement plan without
  understanding what broke.
- **Hindsight bias:** a decision made with the information available
  then can be correct even if the outcome was poor. State what was
  known at the time; avoid framing a correct past decision as wrong
  because newer facts exist.
- **Stale memory entries:** if `retrieve()` returns entries in
  `skipped` (stale — age > `review_after_days`), surface them to
  the user; do not silently use stale entries as if they were current.

## See also

- [`decision-record`](../decision-record/SKILL.md) — forward flow: lock a new choice.
- [`adr-create`](../adr-create/SKILL.md) — file the ADR after a decision is locked.
- [`blameless-post-mortem`](../blameless-post-mortem/SKILL.md) — incident review; may hand off to decision-review when a prior architectural choice is implicated.
- [`docs/contracts/analysis-memory-loop.md`](../../../docs/contracts/analysis-memory-loop.md) — produce → propose → promote → retrieve contract.

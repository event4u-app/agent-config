---
name: stakeholder-tradeoff
description: "Use when stakeholders pull a decision in different directions — frames each lens, builds a trade-off matrix, surfaces the cost of every choice — even if the user just says 'PO and ops disagree'."
status: active
tier: senior
source: package
domain: product
context_spine: [team, product]
personas:
  - product-owner
  - stakeholder
  - critical-challenger
workspaces:
  - product
packs:
  - product-basic
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: true
  removable: true
---

# stakeholder-tradeoff

> Make explicit who pays and who benefits when a decision pulls
> stakeholders in different directions. Builds a **stakeholder ×
> criterion matrix** so the trade-off is visible, not hidden in
> politics. Sibling of [`decision-record`](../decision-record/SKILL.md)
> — that one locks the choice; this one surfaces the *human cost*
> of each option before the lock.

## When to use

- PO, ops, support, and engineering disagree on an approach and the
  user wants the disagreement made legible.
- A decision benefits one segment at the cost of another (free vs
  paid users, internal vs external, region A vs region B).
- A roadmap step has *un*declared trade-offs and the user wants
  them surfaced before commit.
- German triggers: "Wer zahlt was?", "Stakeholder-Konflikt",
  "Trade-off zwischen X und Y".

Do NOT use when:

- One stakeholder owns the decision unambiguously — surface their
  decision and stop.
- The trade-off is technical-only (perf vs storage) — route to
  [`decision-record`](../decision-record/SKILL.md).
- The trade-off is risk-only — route to
  [`risk-officer`](../risk-officer/SKILL.md).

## Cognition cluster

- **Mental model 5 — Opportunity cost.** Every `+` on the matrix is
  also an opportunity cost on the stakeholders not getting that
  benefit; the matrix only earns its keep when it surfaces who pays
  for the chosen `+`. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 5.
- **Mental model 27 — Outcome over output.** Picking the option with
  the most checkmarks is output theatre; pick the option whose `–`
  cells land on stakeholders who can execute mitigations. See
  `mental-models.md` § 27.
- **Mental model 29 — Pre-mortems.** For the recommended option,
  state the failure mode each `–`-bearing stakeholder will name in
  six months. If you cannot, the lens is incomplete — re-interview.
  See `mental-models.md` § 29.
- **Team + product context-spine slots.** Read **team** for the
  silent-stakeholders inventory (on-call, support, finance) and
  **product** for end-user / segment lenses (free vs paid, region,
  cohort). See [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### 1. Identify the stakeholders

Each by **role**, not name. Roles are stable across people —
"on-call engineer" not "Anna". Include silent stakeholders the
room forgot (support, finance, legal, end-users, future-team).

### 2. Capture each stakeholder's lens

For each stakeholder:

- **What they want** — outcome, in their voice.
- **What they fear** — the failure mode they cannot accept.
- **What they will trade** — what they will give up to get the
  outcome.

If a lens is missing, mark `unknown` and surface it — do NOT invent
a position the stakeholder did not state.

### 3. Build the matrix

| Criterion | PO | Ops | Support | Eng | End-user | ... |
|---|---|---|---|---|---|---|
| Time-to-ship | + | – | 0 | – | + | |
| Operational load | 0 | – | – | – | + | |
| ...

`+` benefits, `–` costs, `0` neutral. The columns are stakeholders;
the rows are criteria. Criteria that score `0` everywhere are
noise — drop.

### 4. Surface the trade-off

Pick the top 2-3 criteria where the matrix splits stakeholders
hardest. State the trade-off in plain language:

> *"Picking option X means PO ships faster, but on-call carries
> more pages. Picking option Y means on-call sleeps, but PO slips
> two weeks."*

If no option splits the matrix unfavourably, the trade-off is
imaginary — surface that and stop.

### 5. Recommend a path

Pick the option whose `–` cells are owned by stakeholders who can
execute mitigations. Avoid options where the cost lands on a
stakeholder who has no voice in the room. State the recommendation
explicitly with a one-sentence rationale.

### 6. Validate the matrix

Verify before emitting: every stakeholder has wants / fears / trades
filled or marked `unknown`, the matrix has no row that scores `0`
everywhere, the trade-off paragraph names a concrete cost (not just
"there is a trade-off"), and the recommendation cites which `–`
cells the named owner can execute. Ensure no silent stakeholder
column is missing.

## Related Skills

**WHEN to use this**

- A request crosses two stakeholder lenses (eng ↔ PO, PO ↔ ops, ops
  ↔ infra) and the trade-off is **not yet code**.
- The room agrees on the goal but disagrees on who absorbs the cost.
- A roadmap step has *un*declared trade-offs that need surfacing
  before commit.

**WHEN NOT to use this**

- The conflict surfaces **inside an open PR** (test-coverage fails
  but PO wants to ship) — start with `code-review-multi-lens`
  (sibling C8); a C8 verdict that surfaces stakeholder conflict
  becomes input to this skill for escalation. Boundary prose lives
  in [`docs/guidelines/cross-role-handoff.md`](../../../docs/guidelines/cross-role-handoff.md).
- The trade-off is purely technical (perf vs storage, sync vs async)
  — route to [`decision-record`](../decision-record/SKILL.md).
- The dominant axis is risk, not stakeholder cost — route to
  [`risk-officer`](../risk-officer/SKILL.md).
- The output is the locked decision artifact — hand off to
  [`decision-record`](../decision-record/SKILL.md) once the matrix
  is built.

## When the agent should load this

- "Wer zahlt was bei dieser Entscheidung?"
- "PO und Ops sind sich uneinig — wir brauchen Klarheit."
- "Was ist der Trade-off zwischen X und Y für die einzelnen Lenses?"
- "Stakeholder-Konflikt vor dem Commit auflösen."
- "Diese Roadmap-Phase hat undeclared trade-offs."

## Output

The trade-off report is a single block with these ordered fields:

1. `Decision:` — one sentence framing the choice
2. `Stakeholders:` — bullet list, each with wants / fears / trades
3. `Matrix:` — markdown table with criteria rows and stakeholder columns
4. `Trade-off in plain language:` — one paragraph naming the cost
5. `Recommendation:`, `Rationale:`, `Next:` — explicit choice +
   rationale + handoff target

```
Stakeholder trade-off
Decision: <one sentence>

Stakeholders:
  - <role>  wants: <outcome>     fears: <failure>     trades: <what>
  - ...

Matrix:
  | Criterion       | <SH 1> | <SH 2> | ... |
  | ...

Trade-off in plain language:
  <one paragraph>

Recommendation: <option>
Rationale:      <one sentence>
Next:           /decision-record  to lock the choice
```

## Gotcha

- The room is rarely all the stakeholders. Add the silent ones
  explicitly (support, future-team, end-users).
- A `+` everywhere column is suspect; either a stakeholder
  understated the cost or you understated the cost.
- The "happy path" recommendation is the option with the cost on
  someone who is *not in the room*. Resist it.

## Do NOT

- Do NOT label stakeholders by name — roles only.
- Do NOT score before listing the stakeholders' own words; agent
  ventriloquism is the failure mode.
- Do NOT pick the option that scores best on *all* stakeholders —
  if it exists, the trade-off was imaginary; surface that.
- Do NOT lock the choice in this skill; hand off to
  `decision-record`.

## Runnable example

A pricing-page rewrite that ships faster vs gives ops more lead time:

- Decision: *"Should the pricing-page rewrite ship in 2 weeks
  (option A) or 4 weeks with a managed rollout (option B)?"*
- Stakeholders:
  - **PO** wants: revenue lift on Q-end · fears: churn signal in
    the noise · trades: copy polish for time-to-ship.
  - **On-call eng** wants: change window outside Friday · fears:
    Saturday paging on a marketing rollout · trades: shippable A/B
    framework for a deploy gate.
  - **Support lead** wants: scripted answers for the new tier ·
    fears: ticket-volume spike unprepared · trades: depth of
    answers for breadth.
  - **End-user (free tier)** wants: clear "what stays free" line ·
    fears: silent paywall on a feature they rely on · trades:
    nothing — silent stakeholder.
- Matrix splits hardest on **operational load** (option A: `–` for
  on-call + support, `+` for PO) and **clarity for end-users**
  (option B: `+` for support + end-user, `–` for PO timing).
- Trade-off in plain language: *"Option A means PO hits Q-end, but
  on-call carries a marketing-rollout pager and support eats ticket
  spikes blind. Option B means support and end-users land softly,
  but PO slips two weeks past Q-end."*
- Recommendation: option B. Rationale: the `–` cells in option A
  land on stakeholders who **cannot** mitigate from inside the
  rollout (free-tier user has no voice in the room).
- Next: `/decision-record` to lock option B; the supersession chain
  cites the original "ship by Q-end" mandate as the constraint that
  changed.

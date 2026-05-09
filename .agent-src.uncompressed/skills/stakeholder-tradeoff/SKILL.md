---
name: stakeholder-tradeoff
description: "Use when stakeholders pull a decision in different directions — frames each lens, builds a trade-off matrix, surfaces the cost of every choice — even if the user just says 'PO and ops disagree'."
personas:
  - product-owner
  - stakeholder
  - critical-challenger
source: package
domain: product
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

## Output format

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

---
recommended_model: opus
name: decision-record
description: "Use when locking a trade-off, structuring an ADR draft, or wiring supersession chains — frames options · trade-offs · consequences before the file is written by `adr-create`."
status: active
tier: senior
domain: process
context_spine: [team]
personas:
  - senior-engineer
  - critical-challenger
  - product-owner
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# decision-record

> Shape the **thinking** behind an architectural decision: list the
> options, expose trade-offs, lock the chosen variant, and wire the
> supersession chain. Hands off to [`adr-create`](../adr-create/SKILL.md)
> for file mechanics (numbering, index, frontmatter). This skill does
> not write the ADR file itself.

## When to use

- A team is about to commit to a non-trivial architectural choice and
  wants the trade-offs on paper first.
- Two engineers disagree on an approach — surface the options and
  consequences before one wins by attrition.
- A previous decision needs revisiting; the result must `supersede:`
  the older ADR with explicit rationale.
- German triggers: "lass uns das festzurren", "Trade-off-Matrix",
  "welche Option ziehen wir?".

Do NOT use when:

- The file mechanics are the entire ask (numbering, regenerating the
  index) — route directly to [`adr-create`](../adr-create/SKILL.md).
- The decision is reversible and small (e.g. variable rename) — ADRs
  are for choices that constrain future work.
- The user wants a feature plan, not a decision — route to the
  planning command instead.

## Cognition cluster

- **Mental model 4 — Second-order thinking.** Every decision unlocks
  some futures and locks out others; the consequences block names
  what becomes harder, not just what becomes easier. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 4.
- **Mental model 6 — Theory of constraints.** A decision that does
  not move the binding constraint is theatre; if the trade-off matrix
  scores every option the same on the constraint that matters, the
  options are fungible — surface and stop. See `mental-models.md` § 6.
- **Mental model 10 — Reversible vs irreversible.** Two-way doors
  get a one-page record; one-way doors get the full options +
  consequences + supersession chain. The reversibility row of the
  matrix decides which template fires. See `mental-models.md` § 10.
- **Team context-spine slot.** Read the **team** slot of the
  [context-spine](../../../docs/contracts/context-spine.md) to
  capture who is bound by the decision (review groups, on-call
  rotation). Skip if the consumer project has not filled it; note in
  the record.

## Procedure

### 1. State the decision in one sentence

*"We need to decide `X` because `Y`."* If you cannot, the decision
is not ripe — surface that and stop.

### 2. Identify and enumerate options (≥ 2, usually ≤ 4)

Each option gets:

- **Name** — short, descriptive, never "option A / B / C".
- **Sketch** — what it actually does in one paragraph.
- **Cost / benefit** — three to five bullets per side, concrete.
- **Reversibility** — easy / costly / one-way (Bezos two-way / one-way
  door framing).

Add an **explicit "do nothing"** option whenever it is plausible —
forces the user to compare the change against the status quo.

### 3. Build the trade-off matrix

| Criterion | Option 1 | Option 2 | ... |
|---|---|---|---|
| Implementation cost | | | |
| Operational cost | | | |
| Reversibility | | | |
| Blast radius | | | |
| Time-to-value | | | |

Pick criteria that *separate* the options. Criteria where every
option scores the same are noise — drop them.

### 4. Lock the choice + consequences

Write:

- **Decision:** *"We pick `<Option name>`."*
- **Consequences:** what becomes true, what becomes harder, what
  becomes impossible. At least one of each, or admit that nothing
  becomes harder (rare; verify).

### 5. Wire the supersession chain (if any)

If this decision overrides a prior ADR:

- Cite the prior ADR id and one-line summary.
- State **what changed in the world** that justifies overriding —
  not "we now think differently".
- Hand off the `supersedes:` linkage to `adr-create`.

### 6. Hand off to file mechanics

Output the structured payload (below). The user — or
`adr-create` — turns it into the file.

## Related Skills

**WHEN to use this**

- The team is about to lock a non-trivial choice and the trade-offs
  need to survive the conversation that produced them.
- A prior ADR is being overridden and the supersession chain needs
  explicit "what changed in the world" rationale.
- A planning thread has surfaced ≥ 2 viable options and silence is
  about to pick one by attrition.

**WHEN NOT to use this**

- The choice splits stakeholders along role lines (PO vs ops, eng vs
  support) — start with [`stakeholder-tradeoff`](../stakeholder-tradeoff/SKILL.md);
  this skill locks the choice **after** the human cost is mapped.
- The output is the ADR file itself (numbering, index regen) — route
  to [`adr-create`](../adr-create/SKILL.md); this skill produces the
  payload, not the file.
- The risk shape is the dominant question — route to
  [`risk-officer`](../risk-officer/SKILL.md) first, then return.
- The decision is reversible and cheap — write a one-line note and
  move on; ADRs are for irreversible or expensive constraints.

## When the agent should load this

- "Lass uns das festzurren."
- "Welche Option ziehen wir und warum?"
- "Wir müssen ein ADR draus machen."
- "Trade-off-Matrix für X vs Y."
- "Diese Entscheidung überschreibt das alte ADR-NN."

## Output

```
Decision: <one sentence>

Options:
  1. <name> — <sketch>
       Pros: ...
       Cons: ...
       Reversibility: easy | costly | one-way
  2. ...
  N. Do nothing — <sketch>

Trade-off matrix:
  | Criterion | <opt 1> | <opt 2> | ... |
  | ...

Locked: <chosen option name>

Consequences:
  + <becomes true>
  - <becomes harder>
  ✗ <becomes impossible>

Supersedes: <ADR-XYZ "title">  (if any)
Trigger:    <what changed>     (if superseding)

Next: /adr-create  with the payload above
```

## Gotcha

- "We compared the options" is not a comparison. The matrix must
  separate them on at least two criteria.
- Pros without cons is advocacy, not analysis. If you cannot find
  cons for the chosen option, you have not understood it yet.
- A supersession with no "what changed in the world" is a vibe
  pivot. Reject and ask.

## Do NOT

- Do NOT pick the option before listing them — the matrix is the
  point, not the conclusion.
- Do NOT write the ADR file from this skill — `adr-create` owns
  filenames, numbering, and index regeneration.
- Do NOT pad option counts to look thorough; two real options beat
  four straw men.
- Do NOT silently update an old ADR; supersession is explicit.

## Runnable example

Replacing the in-house cron runner with a managed scheduler:

- Decision: *"We need to decide between keeping the in-house cron
  runner and migrating to the managed scheduler because the on-call
  rotation has paged on missed-run incidents three times in 60 days."*
- Options: (1) keep in-house + add monitoring; (2) migrate to
  managed scheduler; (3) do nothing.
- Matrix rows that **separate** options: implementation cost,
  operational load, blast radius on outage, reversibility.
- Locked: *"We pick the managed scheduler."*
- Consequences: `+` on-call gets paged on scheduler infra, not
  application code. `–` job definitions move to a vendor format,
  raising migration cost if we leave. `✗` we cannot run jobs in the
  app process anymore — assumes vendor uptime.
- Supersedes: ADR-014 *"in-house cron runner"*; trigger = three
  missed-run pages in 60 days now exceed the SLO budget.
- Next: `/adr-create` with the payload, append `supersedes: ADR-014`.

---
name: decision-record
description: "Use when locking a trade-off, structuring an ADR draft, or wiring supersession chains — frames options · trade-offs · consequences before the file is written by `adr-create`."
personas:
  - senior-engineer
  - critical-challenger
  - product-owner
source: package
domain: process
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

## Procedure

### 1. State the decision in one sentence

*"We need to decide `X` because `Y`."* If you cannot, the decision
is not ripe — surface that and stop.

### 2. Enumerate options (≥ 2, usually ≤ 4)

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

## Output format

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

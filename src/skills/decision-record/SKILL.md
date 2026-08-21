---
model_tier: high
name: decision-record
description: "Use when choosing between alternatives with trade-offs — X-or-Y decisions or a weighted decision matrix / gewichtete Entscheidungsmatrix ('score my options'); ADR via `adr-create`."
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
  **Corollary — a shortcut through a one-way door is a decision, not a
  defer.** The cheap-and-simple option is *preferred* where the choice can
  be walked back later. Where it cannot — a public API shape, a DB schema,
  a migration, a wire format, a published identifier — "we can simplify
  this later" is false, so it never ships as a deferred note; it lands
  here as a recorded decision with its consequences named. The one-way
  categories are enumerated so the call is not left to a judgement about
  what feels important.
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
- **Revisit-if:** the condition that would reopen this decision — new
  evidence class, a changed constraint the decision assumed, or an
  age threshold. A lock recorded without this line reads as permanent
  law instead of a decision under current conditions; see
  [`decision-revisit-gate`](../../rules/decision-revisit-gate.md) for
  what happens when a later change is blocked by it without one.
  It is an externally observable **condition**, never a cadence and never
  permanence under a field name: `terminal`, `none`, "never" and "forever"
  are invalid, and `unclassified` is legal only on an *existing* record
  during the migration — never on the one you are locking now.
- **Evidence + assumptions, split explicitly.** Every load-bearing factual
  claim in the rationale either points at a basis ref — `file:line`, a URL, a
  `docs/CLAIMS.md` claim id, a benchmark id — or is **labelled an
  assumption**. There is no third state. Cite nothing and the record grades
  `E0`, which is honest and publishable; a confident grade over no citations
  is not. **Agreement is not evidence:** the council converging, or two
  models liking the same option, is `provenance: agentic` with
  `agentic_mode: council` — sources and measurements raise the grade,
  consensus does not. A human product call records `E0` plus
  `authority_basis: owner_intent` rather than a faked grade. Vocabulary:
  [`adr-layout § Provenance and evidence`](../../../docs/contracts/adr-layout.md).

### 5. Wire the supersession chain (if any)

If this decision overrides a prior ADR:

- Cite the prior ADR id and one-line summary.
- State **what changed in the world** that justifies overriding —
  not "we now think differently".
- Hand off the `supersedes:` linkage to `adr-create`.

### 6. Admission gate — is this an ADR at all?

Classify **before** handing off. A locked choice earns an ADR only when it is
architecturally significant on at least one axis:

- **Hard or costly to reverse** — a one-way door: public API shape, DB schema,
  wire format, published identifier, migration.
- **Broadly constraining** — it binds work outside the module that made it.
- **Crosses a governed surface** — consumer contract, API, security or privacy
  floor, package structure.

None of the three → **no ADR**. The record still exists; it lands as a
decision note in `agents/decisions/`, a config value, a measurement record in
`docs/CLAIMS.md`, an experiment, or a roadmap item. Explicitly not ADRs: a
temporary numeric threshold · a benchmark value · a model mapping · one-off
release sequencing · a reversible local implementation detail.

**The reference case is in this tree.** ADR-002 encodes `25 000 → 26 000` and
a `4.0k` override ceiling as architecture law (`ADR-002:55`, `:62`), and
ADR-114 then had to add another override while recording that 7 of 9 kernel
rules already carry them (`ADR-114:74`). The *principle* — a kernel budget
exists, is measured, and is capped — is the ADR. The numbers belong in a
versioned budget contract with a regression gate, so a recalibration stops
needing an architecture supersession.

### 7. Hand off to file mechanics

Gate passed → output the structured payload (below). The user — or
`adr-create` — turns it into the file.

## Weighted-matrix mode (quantitative)

Optional numeric variant of step 3. **Gate — fire only when ALL hold:**
≥ 3 options · no single dominant criterion · costly / hard-to-reverse
decision · commensurable criteria (no values conflict). A 2-option or
reversible choice gets a one-line redirect: just decide, or use the
qualitative matrix above. Full procedure, anchors, worked example:
[`references/weighted-matrix.md`](references/weighted-matrix.md).

1. User states the decision + options.
2. **User lists criteria and weights (1-10) BEFORE any scoring** — the AI
   may append missed criteria afterward, each labeled `(AI-suggested)`.
   Never propose criteria first (anchoring).
3. Criteria hygiene: cap 4-8, merge near-synonyms (double-counting check).
4. Score options 1-10 against **fixed anchors** (each criterion declares
   what 1 and what 10 mean — never relative-to-best-in-set).
5. Weighted sums, then the **sensitivity block — the load-bearing gate**:
   close-call margin (< 10 % = "no clear winner — decide on unquantified
   factors"), smallest weight change that flips the winner, ±1-score flip
   test. A fragile winner is reported as fragile, never as "the rational
   choice".
6. Delegate the argue-against pass to
   [`adversarial-review`](../adversarial-review/SKILL.md), scoped: "attack
   the winner, using the losing options' strongest criteria" (the
   `premortem` delegation pattern — never reimplemented inline).

Output appends matrix + sensitivity block + attack summary + the intuition
caveat (resistance to the result signals a wrong weight or unquantified
information — surface it, don't ignore it). **The score is a structured
argument, not a verdict.** Hand-off to `adr-create` is unchanged.

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
- MANY items to rank on the fixed R×I×C/E formula (backlog, feature
  list) — route to [`rice-prioritization`](../rice-prioritization/SKILL.md);
  the weighted-matrix mode here is for ONE choice on custom criteria.
- The decision is reversible and cheap — write a one-line note and
  move on; ADRs are for irreversible or expensive constraints.

## When the agent should load this

- "Lass uns das festzurren."
- "Welche Option ziehen wir und warum?"
- "Wir müssen ein ADR draus machen."
- "Trade-off-Matrix für X vs Y."
- "Diese Entscheidung überschreibt das alte ADR-NN."
- "Weighted decision matrix für die Optionen" / "score my options against
  my criteria" — fires the weighted-matrix mode (gate permitting).

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

Assumptions:
  ~ <load-bearing claim with no basis ref>

Evidence:
  <basis ref>  — file:line | URL | CLAIMS id | benchmark id   (or: none — E0)

Provenance: human | agentic | mixed | unknown   (agentic_mode: single | council | delegated)
Grade:      E0 | E1 | E2 | E3 | E4             (authority_basis: evidence | owner_intent)

Supersedes: <ADR-XYZ "title">  (if any)
Trigger:    <what changed>     (if superseding)
Revisit-if: <observable condition>

Admission gate: ADR | decision note | config value | measurement | experiment | roadmap item

Next: /adr-create  with the payload above   (only when the gate says ADR)
```

## Gotcha

- "We compared the options" is not a comparison. The matrix must
  separate them on at least two criteria.
- Pros without cons is advocacy, not analysis. If you cannot find
  cons for the chosen option, you have not understood it yet.
- A supersession with no "what changed in the world" is a vibe
  pivot. Reject and ask.
- An unlabelled guess is worse than a labelled one. A claim with no basis ref
  and no assumption label reads as established fact to the next reader.
- "The council agreed" is a provenance fact, not an evidence grade. If the
  only support is agreement, the grade is `E0` — write it.
- Writing an ADR for a threshold is how a recalibration becomes an
  architecture supersession. Run the admission gate first.

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

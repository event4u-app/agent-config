---
stability: beta
---


# Cross-Wing Handoff Contract

> **Status:** active · **Stability:** beta · **Owner:** suite-closure Phase 3
> · **Lint gate:** `task lint-handoffs` (CI)

The four wings (Engineering, Product+Foundation, GTM+Growth,
Money+Strategy+Ops) compose by handing off **typed artifacts** between
senior-tier skills, not by sharing a runtime. This contract locks the
shape of those handoffs so cognition clusters do not collide and the
linter can detect drift mechanically.

## § 1 — Purpose

Typed composition across wings prevents three failure modes:

1. **Cognition-cluster collision** — a Wing-3 skill silently re-implements
   Wing-4 reasoning (e.g. funnel-analysis ad-hoc forecasting); the
   handoff makes the dependency explicit.
2. **Tier mismatch** — a senior skill delegates to a non-senior peer,
   weakening the per-wing authoring floor; the linter blocks this.
3. **Untyped artifact drift** — caller and callee disagree on the input
   shape; the contract requires the delegated skill to declare its
   `## Input` block so the linter can verify call-site compatibility.

## § 2 — Anatomy

A handoff has three named parts:

```
initiator-skill  →  delegated-skill(input-shape)  →  output-artifact
   senior-tier         senior-tier                    declared in
   in wing X           in wing Y (may = X)            delegated-skill's
                                                      `## Output` block
```

- **initiator-skill** — the senior-tier skill that triggers the handoff;
  declares the target in its `## Related Skills` § *WHEN NOT to use this*
  routing list **or** as a `Composes` line in the procedure.
- **delegated-skill** — the senior-tier skill that owns the cognition
  step being handed off; MUST declare a `## Input` block listing the
  shape the initiator must pass (named fields + 1-line type hint).
- **output-artifact** — the named artifact from the delegated skill's
  `## Output` block (e.g. `opportunity-tree.md`, `forecast-band.json`).

A handoff that omits any of the three parts is incomplete and the
linter rejects it.

## § 3 — Worktree boundary

Each handoff MAY run in a fresh git worktree when invoked through
[`subagent-orchestration`](../../.agent-src.uncompressed/skills/subagent-orchestration/SKILL.md)
mode 6 (`do-in-worktrees`). Mode 6 is the state-machine layer — it
declares when worktree isolation is mandatory (multi-step cross-wing
chain, each step ≥30 min, branch state would otherwise leak between
steps) and what handoff shape each step emits / consumes. The
executor lives in
[`using-git-worktrees`](../../.agent-src.uncompressed/skills/using-git-worktrees/SKILL.md)
and
[`finishing-a-development-branch`](../../.agent-src.uncompressed/skills/finishing-a-development-branch/SKILL.md);
this contract does not duplicate that runtime.

The boundary is **advisory** for chains that do not opt into mode 6:
the handoff contract does not force isolation, but every handoff
MUST not assume shared in-process state with the initiator. Write
artifacts to disk; never pass live Python objects. Chains that opt
into mode 6 promote the boundary from advisory to mandatory for the
duration of the chain.

## § 4 — Lint rules

`scripts/lint_handoffs.py` enforces three rules over the handoff graph
built from senior-tier skills. The graph is built from the
`**WHEN to use this**` sub-block of each skill's `## Related Skills`
section — those links are **composition (delegation) edges**. Links
under `**WHEN NOT to use this**` are **alternative pointers** (peer
cognition the user picks instead) and are NOT composition edges:
mutual `A ↔ B` "use the other instead" pointers are intentional and
MUST NOT be flagged.

| Rule | Failure code | Description | Sub-block scope |
|---|---|---|---|
| **No cycles** | `handoff_cycle` | Composition graph must be a DAG. A→B→A or longer cycles fail. | WHEN-to-use only |
| **No dangling references** | `handoff_dangling` | Every link must resolve to an existing skill file. | WHEN-to-use **and** WHEN-NOT |
| **No tier mismatch** | `handoff_tier_mismatch` | A senior skill MAY only reference other senior skills (delegate to OR offer as alternative). | WHEN-to-use **and** WHEN-NOT |

Optional rule (warning only, locked in Phase 6):

| Rule | Code | Description |
|---|---|---|
| Input shape declared | `handoff_missing_input` | Delegated skill SHOULD declare `## Input`. Warning today; error after Phase 6. |

Lint runs in CI between `task lint-skills` and `task test`. Output
mirrors `lint_skills` (`file:line:reason`).

## § 5 — Reference chains

Three shipped chains across the suite illustrate the contract:

### W3 launch chain — `positioning` → `messaging-architecture` → `gtm-launch`

- `positioning` (H1) owns category framing.
- `messaging-architecture` (H2) **composes** `positioning` — primary
  message + supporting proofs derive from H1's point-of-view output.
- `gtm-launch` (H3) **composes** `messaging-architecture` plus
  `release-comms` (unified-senior-roles Block L) — launch sequencing
  reuses the messaging stack.

### W4 / W3 forecasting chain — `forecasting` → `forecast-accuracy`

- `forecasting` (Wing-4 O2) owns construction cognition (top-down vs
  bottom-up, confidence-band, retro-loop).
- O2 ships an interface-first stub (`forecast-construction-shape` ADR)
  before full implementation — locks the call shape early.
- `forecast-accuracy` (Wing-3 H10) **composes** O2's interface for the
  forecast-call loop. Contract drift = O2's break, not H10's.

### W4 build-buy → org-design chain — `build-buy-partner` → `org-design`

- `build-buy-partner` (P1) owns insource-vs-outsource reasoning.
- `org-design` (Q1) **composes** `build-buy-partner` for insource-vs-
  outsource shape — team-design follows the build-buy verdict.

## See also

- `.agent-src.uncompressed/rules/skill-quality.md` § Senior-Tier
  Required Structure — defines the `## Related Skills` and `## Output`
  blocks the contract reads.
- `scripts/lint_handoffs.py` — mechanical enforcement.

# Review-lens routing schema

Defines what a review **lens** is, the metadata it carries, and which review
skills are **entry skills** (invoked directly / by task) vs **dispatched lenses**
(run only under an orchestrator). This is the contract the Phase-3 consolidation
scan validates merge candidates against — **proposal/schema only; no skill is
merged here.**

## Lens vs entry skill

```
A LENS IS DISPATCHED, NEVER A FRONT DOOR.
AN ENTRY SKILL IS INVOKED; A LENS IS ORCHESTRATED.
DO NOT MERGE ACROSS THE LINE.
```

- **Entry review skill** — a reviewer the user (or a task) invokes directly. It
  produces a standalone verdict and may itself orchestrate. Examples:
  `code-review` (also the `/review-changes` consolidator), `adversarial-review`,
  `authz-review`, `design-review`, `privacy-review`, `receiving-code-review`,
  `requesting-code-review`, `skill-reviewer`.
- **Dispatched lens** — a specialized reviewer that runs **only** under an
  orchestrator (`/review-changes` dispatches five, each on the same diff +
  context, independently, then consolidates). Examples: `judge-bug-hunter`,
  `judge-security-auditor`, `judge-test-coverage`, `judge-code-quality`,
  `architecture-review-lens`.
- **Router** — picks reviewers by path + risk, dispatches nothing itself:
  `review-routing`.

## Schema — the metadata a lens carries

| Field | Meaning |
|---|---|
| `id` | the lens skill slug (`judge-bug-hunter`, `architecture-review-lens`, …) |
| `scope` | the single dimension it reviews (correctness · security · test-coverage · quality · architecture) |
| `constraints` | what it MUST flag and what it must NOT (stay in its lane — a bug lens does not opine on style) |
| `dispatched_by` | the orchestrator that runs it (`/review-changes`; `/judge` for solo/steps) |
| `runs` | `independently` — same diff + task context, no cross-talk between lenses |
| `consolidated_by` | who merges the verdicts (`code-review` for `/review-changes`) |
| `verdict_shape` | findings list with severity; no merge/ship decision (the human decides) |

## The dispatch contract (what Phase 3 validates against)

1. A **lens never becomes a front door** — it has no standalone command and is
   not in a profile's `commands_hint`. Merging a lens into an entry skill (or
   promoting it to a command) breaks the orchestrated-review model.
2. A **lens stays single-scope** — consolidation must not fuse two lenses into
   one multi-scope reviewer (that re-creates the monolith `/review-changes` was
   built to decompose).
3. An **entry skill may absorb another entry skill** only when both are
   user-invoked and their scopes genuinely overlap — but never absorb a lens.
4. The **consolidator** (`code-review`) is load-bearing — it is the entry skill
   that both stands alone and merges lens verdicts; it is not a merge candidate.

## See also

- [`/review-changes`](../../src/domains/engineering-base/review-changes/command.md) — the five-judge dispatcher.
- [`skill-family-map.yml`](skill-family-map.yml) — `family: review-judging` carries these skills; Phase 3 reads `candidate_*` against this contract.
- [`governance.md`](../governance.md) — the lifecycle + Single-Source-of-Truth rules these skills age under.

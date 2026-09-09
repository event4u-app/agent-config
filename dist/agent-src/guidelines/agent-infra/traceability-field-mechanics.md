# Traceability field mechanics — `traceability:` in the roadmap execution contract

> Migrated from [`roadmap-execution-contract`](../../../src/agent-src/contexts/execution/roadmap-execution-contract.md)
> § 2c, 2026-08-22, because the section pushed that file past the 16,000-char
> depth ceiling. The contract keeps the field shape and the reused grammars; the
> semantics a reader needs before writing a row live here. Established P4
> pattern: the obligation stays in the contract, the mechanics move.

## Identity semantics — stated, because a slug grammar does not imply them

- **Namespace:** the roadmap file. Two roadmaps MAY use the same
  `requirement_id` when they reference the same external requirement; within one
  file an id is unique.
- **Cardinality:** one row is one `(requirement, acceptance)` pair with its
  evidence. A requirement with two criteria is two rows.
- **Renames:** ids are content-addressed, not path-addressed — moving or renaming
  a roadmap does not change them.

## Revision semantics — when a ref is evaluated

**At the current head, always.** A ref that resolved at declaration time and no
longer resolves is `unresolved`, and that is the intended reading rather than a
defect in the reading: evidence that has been deleted is exactly what a
traceability inventory exists to surface. The consequence is stated rather than
discovered: **a completed roadmap can move from resolved to unresolved with no
roadmap edit**, because the tree moved under it.

## What "gate" means here, of the three things it could mean

The council named three unresolved senses. Exactly one ships:

| Sense | Status |
|---|---|
| **Listing** declarations | **ships** — inventory, exit 0 always |
| **Resolving** references | ships as part of the listing, reported as a count |
| **Enforcing** roadmap validity | **does not ship**, and does not ship until the relation model above has been exercised on a real corpus |

## The `[AC:<id>]` prefix on a `verify:` line

A `verify:` line may carry a leading `[AC:<acceptance_id>]` to bind that check to
a criterion.

**Nothing parses `verify:` lines structurally today** — verified 2026-08-22: a
grep across `src/scripts/*.ts` finds the template prose emitted by
`new_roadmap.ts` and one comment in `lint_evidence_artifacts.ts`, and nothing
else. Both halves of that matter. **Nothing breaks**, because there is no parser
to break. And **there is nothing to build on** either: the inventory below is
the first structural reader of those lines, so any claim about `[AC:…]` coverage
rests entirely on it.


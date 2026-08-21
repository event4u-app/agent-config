---
adr: 239
status: accepted
date: 2026-08-21
decision: no-union-merge-for-ratchet-baselines
supersedes: —
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Reopen on any one of the six preconditions in § Decision being satisfied and
  shown, in code, in the same change that proposes the driver — not on a calendar
  and not on an argument that the conflicts have got worse. Also reopen on either
  of two observations that would falsify the reasoning rather than satisfy it.
  First — a ratchet baseline is found to be idempotent per record, i.e. two
  branches cannot produce different values for the same record identity, since
  the whole objection rests on them being able to. Second — a `merge=union`
  entry appears in `.gitattributes` for any path a gate reads a number from,
  since that is this record being bypassed rather than reopened, and the entry
  is the evidence.
---

# ADR-239 — `merge=union` is not available for a ratchet baseline

## Status

**Accepted** · 2026-08-21. Decided by AI council (2 seats + blind peer review,
$0.13) during `road-to-merge-hotspot-drawdown`; both seats named this their
hardest pushback independently, and neither seat's objection depends on the
other's.

## Context

`src/config/estate-count-budget.json` and
`src/config/gate-violation-baselines.json` are the two most-conflicted
non-generated paths in this repository: each conflicts in **7 of the 7 open PRs
that were `CONFLICTING`** when measured on 2026-08-21, at 93 and 55 commits per
60 days. The churn is overwhelmingly append-shaped — measured for the budget
file, **40 of 43** non-merge commits touch only history-entry lines, and the file
carries 71 `baseline_history` entries (evidence:
`agents/evidence/analysis/merge-hotspot-cadence.md` § 3.2).

The obvious fix, and the one an inbox handover proposed, is to move the
append-only history into a line-per-record file and declare
`merge=union eol=lf` on it in `.gitattributes`, citing the precedent this
repository already has for agent memory (`.gitattributes:50`, `:62-66`).

Neither file can be gitignored instead: a ratchet's entire mechanism is a
committed number a PR diff can be compared against, so an untracked baseline is
no baseline. And `sync_pr_branch.ts` had no class for them at all until the same
roadmap added `REMEASURED`, so the reader was being offered a hand-merge of two
measurements.

## Decision

**`merge=union` — and any other line-based merge driver — is not available for
any file a gate reads a ratchet number from.** This holds for the two files above
and for any future baseline of the same class, whatever its extension.

The reason, in one sentence the council put plainly: a union driver **converts a
visible Git conflict into a potentially silent application-level conflict**. Git
can combine two lines without knowing whether they represent compatible facts,
competing measurements, or a weakened ratchet. Two branches appending a
same-date entry with different counts union-merge into two contradictory records,
and every available reduction is wrong in a different way — latest-timestamp is
arbitrary when the dates are equal, max-count permanently loosens the ratchet,
min-count rejects legitimate capacity growth, first-in-file depends on merge
order and is therefore non-deterministic, and erroring on a duplicate defeats the
point of union merging. The failure is silent by construction: the number still
looks measured.

**Six preconditions would reopen this.** All of them, shown in code, in the
change that proposes the driver:

1. A stable, globally unique record identity — defined, not implied.
2. Immutable-record semantics: a record, once written, is never edited in place.
3. A deterministic, **order-independent** reduction, with a property test
   asserting `merge(a, b) === merge(b, a)`.
4. Rejection of duplicate or contradictory identities, as a hard failure rather
   than a pick.
5. Proof that no consumer depends on file order or on last-record-wins.
6. CI validation that a clean *textual* merge cannot weaken the effective
   baseline — i.e. a monotonicity test, not a parse test.

**The endorsed alternative needs none of them: one file per record.**
`src/config/<budget>-history/<record-id>.json`, where a filename collision *is*
content identity, so a same-identity conflict becomes structurally impossible
rather than silently reduced. This is the shape `.gitattributes:62-66` already
describes for the memory directory, and it is the correct reading of that
precedent — union-merging *inside* one file and separating records *into* files
are different mechanisms, and only the second one is what the memory layout
actually does for identity.

**For `gate-violation-baselines.json` specifically**, the same per-record shape
maps onto its 11 keyed gate entries as one file per gate. The council split on
whether that is already decided by the keyed-dict structure (seat 1: the
structure decided it; measuring today's overlap tells you how bad it is, not
whether splitting is correct) or conditional on first proving gate independence
and a coherent measurement epoch (seat 2: independently merged per-gate files
could describe a snapshot that never existed, if gate results share estate
state, configuration, or tool versions). **That divergence is recorded, not
resolved here** — both seats agree per-gate files are the leading design, and the
epoch question is a precondition on the split, not on this record's block.

## Consequences

- The dominant conflict mode on the budget file stays until a per-record split
  lands. That cost is accepted knowingly: a visible conflict a human resolves is
  cheaper than a baseline that silently loosened.
- `REMEASURED` in `sync_pr_branch.ts` is the interim mitigation and is
  deliberately advisory. It names the resolution — re-run the measurement on the
  merged tree — and never performs it, because "re-measure instead of merge"
  delegates conflict resolution to a script and its execution environment, and a
  wrong or environment-dependent measurement would overwrite a deliberate
  tightening with nothing objecting.
- Anyone proposing a merge driver for a numeric gate input is pointed here first,
  which is the point: without this record the argument is only ever "the memory
  files do it", and the memory files are not a ratchet.

## Alternatives considered

**JSONL plus `merge=union`, as the handover proposed.** Rejected above. Its
appeal is real — it is one `.gitattributes` line against a schema migration —
and that asymmetry is exactly why the block needs to be a record rather than a
review comment.

**Leave both files monolithic and rely on `REMEASURED` alone.** Rejected as a
*permanent* answer, kept as the interim one. The measurement says 40 of 43
non-merge commits are pure appends, so an append-safety change removes the
dominant mode; declining to build it is a sequencing decision, not a design one.

**Gitignore both files.** Rejected: it deletes the ratchet. Recorded because it
was the maintainer's original question and the answer is unambiguous — the
committed number *is* the mechanism.

## References

- `agents/evidence/analysis/merge-hotspot-cadence.md` — the § 3.2 anatomy
  measurement this record's premise rests on, with commands.
- `src/scripts/sync_pr_branch.ts` — the `REMEASURED` class and the reason it
  never auto-resolves.
- `src/scripts/_lib/gate_baseline.ts:42` — `BASELINE_REL`, the reader that makes
  `gate-violation-baselines.json` a ratchet rather than a log.
- `.gitattributes:50`, `:62-66` — the union-merge and per-file-identity
  precedents, and why only the second one transfers.

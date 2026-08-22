---
adr: 241
status: accepted
date: 2026-08-21
decision: no-union-merge-for-ratchet-baselines
supersedes: —
superseded_by: —
phase: —
type: structural
provenance:
  kind: agentic
  decision_makers: [anthropic/claude, openai/codex]
  human_directed: false
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - agents/evidence/analysis/merge-hotspot-cadence.md
    - src/scripts/_lib/gate_baseline.ts:42
    - .gitattributes:62-66
    - .gitattributes:68-75
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

# ADR-241 — `merge=union` is not available for a ratchet baseline

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
60 days. The churn was believed to be append-shaped, and it is not. A first
measurement reported 40 of 43 non-merge commits as pure history appends; that
method classified `-U0` hunks by regex and the `baseline` object uses the same
key names as a history entry, so a pure baseline walk was counted as an append. A
JSON-parse re-measurement of the same 43 commits reads **1** pure append, 4 pure
baseline walks, 35 commits doing both, and **39 of 43 commits moving the
baseline** (evidence: `agents/evidence/analysis/merge-hotspot-cadence.md` § 3.2,
corrected). The file carries 71 `baseline_history` entries, so the array does
grow — but almost never on its own.

The obvious fix, and the one an inbox handover proposed, is to move the
append-only history into a line-per-record file and declare
`merge=union eol=lf` on it in `.gitattributes`, citing the precedent this
repository already has for agent memory (`.gitattributes:50`, `:62-66`) — a
citation that is itself part of the error, see § Decision.

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
arbitrary when the dates are equal, max-count adopts the looser of the two bounds
with nothing to tighten it back,
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
rather than silently reduced. This is the shape `.gitattributes:68-75` describes
for the memory **directory** layout, in its own words: *"one file per entry,
content-addressed by hash. Filename collisions are content-identity, so normal
(non-union) merge is fine here."*

**The lines usually cited for this are the wrong ones, and the mistake is
instructive.** `.gitattributes:62-66` is the memory **flat** layout — five YAML
files carrying `merge=union`, i.e. the very mechanism this record forbids, whose
own comment calls itself *"a best-effort safety net for the append-only case, not
a guarantee — the directory layout below has no such caveat."* Union-merging
*inside* one file and separating records *into* files are different mechanisms
living eight lines apart in one config, and an earlier revision of this record
named that distinction correctly in this very sentence and then pointed at the
wrong half. A reader following the pointer to implement the alternative would
have landed on the forbidden mechanism. Cite `:68-75`.

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

**Leave both files monolithic and rely on `REMEASURED` alone.** For
`estate-count-budget.json` this is now the ACCEPTED answer, not an interim one,
and the corrected measurement is why: 39 of 43 commits move the baseline and
exactly one is a pure append, so an append-safety split would have addressed the
mode that fires once per 60 days and left the one firing in 35 of 43 commits
untouched. That remaining mode is the semantically real one — two branches
measured two different trees — and `REMEASURED` is the whole fix available for
it. An earlier revision of this record argued the opposite from the wrong number
and called the decline a sequencing choice; it is a design conclusion.

This does not transfer to `gate-violation-baselines.json`, whose churn is
per-gate keyed entries rather than an appended array. Its anatomy has not been
measured and the per-gate split stays the leading design, gated as above.

**Gitignore both files.** Rejected: it deletes the ratchet. Recorded because it
was the maintainer's original question and the answer is unambiguous — the
committed number *is* the mechanism.

> **Amendment — 2026-08-22 · narrowed for one file (ADR-243).** The last clause
> is true of `gate-violation-baselines.json` and was over-general. Where a
> metric is a **function of the tree**, the base ref's own tree carries the one
> property that made the stored number a ratchet — the change under review
> cannot rewrite it — so the floor can be MEASURED there instead of stored.
> `estate-count-budget.json`'s three metrics are such functions, and ADR-243
> removed its `baseline` accordingly; it now carries policy only and is no
> longer in `REMEASURED`. Nothing else here changes: this record's block on
> `merge=union` and every other line-based driver stands unqualified, ADR-243
> needs no driver, and `gate-violation-baselines.json` — whose counts are not a
> function of the tree — stays tracked and stays re-measured. The question this
> alternative answers ("may the ratchet be deleted") was answered correctly;
> what was too broad was the reason, not the refusal.

## Evidence

| Claim | Basis |
|---|---|
| These two files are the repository's most-conflicted non-generated paths | `git merge-tree --write-tree origin/main origin/<branch>` over all 7 open PRs GitHub reported `CONFLICTING` on 2026-08-21 — both appear in 7 of 7 (`agents/evidence/analysis/merge-hotspot-cadence.md`) |
| The churn on the budget file is NOT append-shaped, contrary to the first measurement | Re-measured by parsing the JSON on both sides of all 43 non-merge commits in the window: 1 pure append, 4 pure baseline walks, 35 both, **39 of 43 moving the baseline**. The first pass used a `-U0` hunk regex and the `baseline` object carries the same key names as a history entry, so a walk was counted as an append (`agents/evidence/analysis/merge-hotspot-cadence.md` § 3.2) |
| A committed number a PR diff compares against is the whole ratchet mechanism, so untracking is not an alternative | `src/scripts/_lib/gate_baseline.ts:42` (`BASELINE_REL`) is read by ~20 gate scripts; the estate check asserts the committed budget matches the live tree |
| Union-merge and per-record identity are different mechanisms, eight lines apart in one config | `.gitattributes:62-66` is the flat memory layout carrying `merge=union`, and its own comment calls itself a best-effort net "not a guarantee — the directory layout below has no such caveat"; `.gitattributes:68-75` is the per-entry layout where "filename collisions are content-identity, so normal (non-union) merge is fine here" |
| The same-date contradictory-record failure is unhandled, not merely unlikely | The proposal specified no record identity, no reduction, no duplicate detection and no monotonicity check — enumerated in § Decision; each candidate reduction fails differently |

The grade is **E2 — repeated and comparative**, and deliberately not higher.
Two independent measurements of the same corpus disagreed and the second
corrected the first, which is what E2 describes; there is no pre-registered
benchmark and no external authority here. It is also not E1: the conflict
population was measured across seven branches rather than one, and the anatomy
across 43 commits rather than an incident.

Nothing in it is a *demonstration* that a union driver corrupts this corpus —
that would need a driver, which is the thing being refused. The block rests on
an enumerated failure the design does not answer, plus the measurement that the
mode it would have fixed fires once in 60 days.

## References

- `agents/evidence/analysis/merge-hotspot-cadence.md` — the § 3.2 anatomy
  measurement this record's premise rests on, with commands.
- `src/scripts/sync_pr_branch.ts` — the `REMEASURED` class and the reason it
  never auto-resolves.
- `src/scripts/_lib/gate_baseline.ts:42` — `BASELINE_REL`, the reader that makes
  `gate-violation-baselines.json` a ratchet rather than a log.
- `.gitattributes:50` and `:62-66` — the two union-merge precedents (intake
  JSONL, flat memory YAML). `:68-75` — the per-file-identity precedent, which is
  the one that transfers. The three are eight lines apart and are routinely
  conflated; an earlier revision of this record conflated them.

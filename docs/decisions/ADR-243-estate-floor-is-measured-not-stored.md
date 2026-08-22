---
adr: 243
status: accepted
date: 2026-08-22
decision: estate-floor-is-measured-not-stored
supersedes: —
superseded_by: —
phase: —
type: structural
reopen_policy: directional
provenance:
  kind: agentic
  decision_makers: [anthropic/claude-opus-5]
  human_directed: true
  agentic_mode: single
evidence:
  strength: E2
  basis:
    - agents/evidence/analysis/merge-hotspot-cadence.md
    - docs/decisions/ADR-241-no-union-merge-for-ratchet-baselines.md
    - docs/decisions/ADR-242-derived-artifacts-leave-the-index.md
    - src/scripts/check_estate_count.ts
    - src/scripts/_lib/base_tree.ts
    - .gitattributes:15
review_trigger: >-
  Reopen on any one of three observations, each of which falsifies a premise
  this record rests on rather than merely arguing against it. First — an estate
  metric is found that is NOT a function of the tree, since the whole
  substitution rests on all three being derivable from committed content; a
  metric depending on wall-clock time, remote state, or a local cache would need
  its own stored floor and this record does not cover it. Second — the
  `estate_growth_exempt` claim is observed authorising growth in a change whose
  diff does not add the claim line, since diff-scoping is the only thing standing
  where an over-raise bound used to. Third — the base-tree read is measured
  costing more than the roadmap corpus can absorb (order of seconds rather than
  the 0.22 s at 703 files recorded below), since "two spawns, cheap" is a
  measurement and not a property. Explicitly NOT a reopen trigger: a branch that
  is behind main reading as growth. That is the floor working as § Consequences
  describes, and it is the same obligation the stored baseline expressed as a
  merge conflict.
---

# ADR-243 — the estate floor is measured at the base ref, not stored in a file

## Status

**Accepted** · 2026-08-22. Single-model decision, human-directed: the maintainer
asked whether `src/config/estate-count-budget.json` could leave the repository,
and the council could not be convened — both configured seats reported
`quota_exhausted` with `api_on_quota: off`, so the run was inconclusive at $0.00
and the decision escalated to the owner, who chose this option over three
alternatives. That is a weaker provenance than the two records it narrows, and it
is recorded plainly rather than dressed up.

## Context

The maintainer asked, in plain frustration, whether this file could simply leave
the git index — it conflicts on nearly every merge. The question had been asked
and answered before, and the answer is recorded twice:

- **ADR-241** § Alternatives: *"Gitignore both files. Rejected: it deletes the
  ratchet. Recorded because it was the maintainer's original question and the
  answer is unambiguous — the committed number is the mechanism."*
- **ADR-242** § Decision: the estate budget fails eligibility test 1 and stays
  tracked, because *"a ratchet is a record of what a tree measured, not a
  function of the tree, so it is not reconstructible either."*

The recurrence was treated as evidence about the disposition rather than about
the maintainer, per `recurring-criticism`. Both refusals answer the question
that was asked — *may the ratchet be deleted* — correctly. Neither examines the
premise underneath it: that the floor must be a **stored number**.

For this file that premise is false, and ADR-242 says so itself. Its own second
reopen trigger reads: *"a ratchet baseline is shown to be reconstructible from
the tree alone at the merge point, since that is the one property whose absence
keeps the two baselines tracked."* All three estate metrics — active roadmaps,
parked roadmaps, open blockers — are pure functions of `agents/roadmaps/`, and
the base ref's tree is committed, so it carries the one property that made the
stored number a ratchet: **the change under review cannot rewrite it.**

The cost of the storage was measured, not felt: the file conflicted in **7 of 7**
`CONFLICTING` open PRs on 2026-08-21, and **39 of 43** non-merge commits in a
60-day window moved the `baseline` object. Its own final `baseline_history` entry
records the failure mode from the other side — main archived a roadmap without
walking the number, so main measured 23 against a stored 24 and *every branch
that merged main inherited the red*.

## Decision

**`check_estate_count` measures the floor on the base ref's own tree, with the
same functions it measures HEAD with. `src/config/estate-count-budget.json`
carries policy only; its `baseline` object and its 113 `baseline_history`
entries are removed.** The file went from 152 KB to 5.9 KB and needs no edit per
change, which is the whole point: the conflict surface disappears without the
ratchet disappearing.

Four consequences of removing the storage, each decided rather than inherited:

1. **A drawdown is simply green.** The "un-walked tightening" failure — a count
   *below* its baseline — existed only because a stored number can be left above
   the truth, leaving headroom a later change could spend. With nothing stored
   the state is unreachable. That class had reddened `main` itself (run
   32173675197, 2026-08-18).
2. **No floor is a failure, not a skip.** A shrink-only gate whose floor is
   absent passes every possible tree, so an unresolvable base ref exits 1 and
   names `--base <ref>` as the escape. Deliberately **not** gated on
   `CI`/`GITHUB_ACTIONS`: a gate that convicts on the runner and waves locally
   teaches contributors that its red is an environment artefact.
3. **Legitimate growth keeps an authorisation path**, because the storage
   provided one (a raise carrying a recorded reason) and removing it without a
   replacement would make parking and blocker-discovery impossible. Three paths,
   in `estate-count-budget.json` § `growth_allowances`: an addition carrying the
   existing `estate_offset_exempt` raises the active allowance by one; a park
   into `later/` raises the later allowance by one; anything else takes
   **`estate_growth_exempt: <reason>`**, added in this change to the frontmatter
   of a roadmap under `agents/roadmaps/`.
4. **The claim is diff-scoped and unbounded**, and both halves are load-bearing.
   Read from the patch, so a claim left in a file authorises nothing later — the
   banking failure a stored baseline had. Unbounded, because the bound a stored
   raise needed (`to === live`, or the surplus was inherited by the next change
   where nobody could act on it) buys nothing here: the next change's floor **is**
   this change's measurement, so there is no surplus to inherit.

**What this does NOT touch.** ADR-241's block on `merge=union` and every other
line-based merge driver for a file a gate reads a number from stands, unqualified
— this change needs no driver. And `src/config/gate-violation-baselines.json`
stays exactly as it is: its counts are **not** a function of the tree, so it
remains the one member of `REMEASURED` in `sync_pr_branch.ts` and the premise
both earlier records state is still true of it. The narrowing is one file wide.

## Consequences

- The 39-of-43 conflict mode has nothing left to conflict on. `REMEASURED` loses
  its estate row; a conflict in the policy file is now an ordinary AUTHORED one.
- **A branch behind main reads as growth**, because the floor is main's TIP and
  not the merge base. Against a merge base, two branches each adding a roadmap
  are both green and main ends up two higher than either measured — a ratchet
  whose floor is a common ancestor is not a ratchet on the trunk. On a GitHub PR
  build this costs nothing: the checkout is the merge result and `resolveBaseRef`
  returns `HEAD^1`. Locally it is a red that says *sync with main*, which is the
  same obligation the stored baseline expressed as a merge conflict — resolved by
  hand four times in one afternoon on 2026-08-21, and resolved wrongly it
  silently returned another change's drawdown.
- The manual `REMEASURED` ritual — take main's floor, re-apply your own delta,
  append your history entry to main's list — is gone. It was carried by a memory
  note because doing it by hand invited exactly that mistake.
- `git archive` is unusable for reading the base tree here and the failure is
  silent: `.gitattributes:15` carries `/agents export-ignore`, so the archive is
  EMPTY and an empty extraction reads as "the estate measured zero" — a floor of
  0 that passes everything. `_lib/base_tree.ts` reads the object store directly
  (`git ls-tree` + `git cat-file --batch`) and treats a zero-file read as
  unavailable rather than as a measurement.

## Alternatives considered

**Untrack the file outright, as asked.** Rejected, and this is the third record
to reject it: without a floor the gate passes every tree, so this deletes the
ratchet rather than moving it. The maintainer was offered it explicitly as an
owner override and chose this instead.

**Extract `baseline_history` into per-record files.** Already rejected on
measurement in ADR-241: it addresses the mode that fires **once** in 60 days and
leaves the one firing in 35 of 43 commits untouched. The
`road-to-ratchet-baseline-append-safety` stub carries the council's endorsed
shape for it; this change makes that stub's Item A moot for this file, since
there is no history array left to split.

**Keep a stored number for `open_blockers` only.** Rejected: blockers are as much
a function of the tree as the file counts, so it would keep the whole conflict
surface for no property the measurement lacks.

**Wait for the council.** Offered to the maintainer as one of four options and
declined. Recorded because the provenance above is weaker for it: two seats would
have stress-tested the `estate_growth_exempt` shape, which is the part of this
record with the least independent review.

## Evidence

| Claim | Basis |
|---|---|
| The file was the repository's most-conflicted non-generated path, and the churn is baseline-shaped | `agents/evidence/analysis/merge-hotspot-cadence.md` § 3.2 (corrected): 7 of 7 CONFLICTING PRs; 39 of 43 non-merge commits move the baseline, 1 is a pure append |
| A stale stored baseline reddens every branch that merges main | the removed `baseline_history`'s own final entry, 2026-08-22, recording main measuring 23 against a stored 24 |
| All three metrics are functions of the committed tree | `countEstate()` runs unchanged over a scratch copy of the base ref's `agents/roadmaps/` and returns the same three numbers; this is ADR-242's own second reopen trigger being satisfied |
| Reading the base subtree is cheap | 703 blobs materialised in 0.22 s, two `git` spawns, measured 2026-08-22 on this repository |
| `git archive` cannot be used and fails silently | `git archive origin/main agents/roadmaps \| tar -x` produces an empty tree; `.gitattributes:15` is `/agents export-ignore` |
| The new rejection classes actually fire, and the new green paths actually pass | `check_estate_count --self-test`: 13/13 cases, 8 rejecting. Three sabotage probes were each observed RED before being reverted — the parking allowance, the claim path, and reading claims from the working tree instead of the diff (which turned the anti-banking case green, i.e. the case has sensitivity) |
| The vitest surface covers both directions | `tests/scripts/check_estate_count.test.ts`, 31 cases |

The grade is **E2 — repeated and comparative**, and deliberately not higher. The
conflict population and the churn anatomy are inherited measurements from
ADR-241's corpus rather than re-run here; what is first-hand is the feasibility
measurement, the sabotage probes, and the gate's own case matrix. There is no
pre-registered benchmark, no external authority, and — unlike the two records it
narrows — no second seat.

## References

- `docs/decisions/ADR-241-no-union-merge-for-ratchet-baselines.md` — the
  union-merge block, which stands; this record narrows one premise in its
  § Alternatives for one of its two files.
- `docs/decisions/ADR-242-derived-artifacts-leave-the-index.md` — the eligibility
  tests, and the reopen trigger this record answers.
- `agents/evidence/analysis/merge-hotspot-cadence.md` — the churn anatomy.
- `src/scripts/_lib/base_tree.ts` — the base-tree read, and why `git archive` is
  not it.
- `src/config/estate-count-budget.json` § `growth_allowances` — the three
  legitimate-growth paths, in the file the gate reads.

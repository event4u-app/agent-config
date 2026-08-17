# Completion review — make the feasibility-screen inputs true again

**Skipped:** no code surface for this completion — the diff is six roadmap documents and one regenerated dashboard, and the gate itself measures zero code paths of seven changed files, scope c74000b9ace03e8d9c0748b94f8fb6a95ba6c81088fc6f5fb1598b68cf9c870e, declared 2026-08-17

## Why a skip rather than a review

The change edits prose in six files under `agents/roadmaps/` and regenerates
`agents/roadmaps-progress.md` from them. No script, no hook, no schema, no test,
no config. `check_completion_review` classifies the diff as zero code paths of
seven changed files, which is exactly the condition this declaration covers.

The dashboard is the one file that could be mistaken for something else. It is a
generated projection, written only by `./agent-config roadmap:progress`, and it
was regenerated rather than hand-edited.

## What replaces a code review here

This change consists entirely of factual claims about the tree, so the review
that matters is measurement, not reading. Every number below was re-derived at
this branch's base (`origin/main` at `49554cd1b`) before it was written into a
roadmap, and none was carried over from the screening reports that surfaced it.

**The audit log**, measured against the main checkout, because
`agents/runtime/state/audit/` is gitignored and absent from every worktree — a
`wc -l` run from here returns nothing, which is itself a trap the corrected
blockers prescribe:

- 368 lines, 367 orchestration; `2026-07.jsonl` holds 1.
- `token_delta` is `0` and provenance `estimated` in 367 of 367 — the existing
  claim, confirmed unchanged, and deliberately left standing.
- `first_pass_success`, `escalated`, `task_class`, `dispatch_mode` are `null` in
  367 of 367 — also confirmed, which is why neither roadmap unblocks.
- `dispatch_tokens` is numeric in 40 of 367, values 315 to 194330. The prose
  said null in all.
- `wall_clock_ms` is numeric in 367 of 367, values 0 to 955883. The prose said
  null in all.
- `spawn_count` is 1 in 366, `0` in 1, never 2 or more — confirmed unchanged.

**The evidence tree**, measured in the working tree: 38 `*.review-input/`
directories, 38 `diff.patch` files totalling 61,101 lines, 64 `*.findings.md`,
6.9 MB under `agents/evidence` of which 5.1 MB is `reviews/`. The prose said 28,
28, 45,598, 50 and 5.7 MB.

**The two hub tables**: `/roadmap` has 7 sub-command directories and 7 table
rows; `/memory` has 6 and 6. The prose said one row was missing from each.

**The activation policy**: `docs/contracts/concern-activation-policy.md` is
present. The prose said it does not exist yet.

**The catalogue corpus**: `agents/evidence/metrics/skill-catalogue.jsonl` holds
5 observations across 2 hosts, one `no-selector` and four
`insufficient-observation`, with `entries_total` of 336, 497, 497, 497 and 426.
The prose said one observation, a uniform `no-selector` verdict, and a 289-entry
estate.

## What was deliberately not done

The stale text is left in place under a dated note in every case rather than
rewritten, which is the pattern two of these roadmaps already established for
their own earlier corrections. A silently replaced wrong claim cannot be
audited, and the growth rates the old numbers reveal are themselves evidence.

No step checkbox was flipped and no blocker was resolved. Making a claim true is
not the same as clearing the gate it feeds, and none of these roadmaps became
takeable as a result.

On `road-to-surface-consolidation` only the two named hub bullets were
re-measured. The `routes_to:` bullet claiming 12 of 25 clusters are incomplete,
and the contract-side inverse, were not checked and the correction says so
rather than implying a wider verification than was performed.

## One finding recorded, not fixed here

`lint_roadmap_blockers` measures 27 decidability violations against a baseline
of 26 and reports one new. This is not caused by this branch: the identical
count was measured against a pristine `origin/main` tree by restoring the
roadmap directory and re-running the gate, so the ratchet was already red before
this work started. It is invisible because the gate is registered only under
`task ci` in `Taskfile.yml`, and no workflow invokes it — `grep` over
`.github/workflows/` for the task or the script returns nothing, and the repo's
own comments in `consistency.yml` state the same fact about `task ci`.

This diff holds the count at exactly 27 rather than raising it. The repair
belongs to whoever owns the remaining non-decidable blocker, and raising the
baseline would be the defect the gate's own message names.

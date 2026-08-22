---
adr: 242
status: accepted
date: 2026-08-22
decision: derived-artifacts-leave-the-index
supersedes: —
superseded_by: —
phase: —
type: structural
provenance:
  kind: agentic
  decision_makers: [anthropic/claude-sonnet-4-5, openai/codex-default]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - agents/evidence/analysis/derived-artifact-consumers-2026-08.md
    - agents/evidence/analysis/merge-hotspot-cadence.md
    - src/scripts/sync_pr_branch.ts:110
    - docs/decisions/ADR-241-no-union-merge-for-ratchet-baselines.md
review_trigger: >-
  Reopen when a fourth artifact is proposed for the same treatment and fails
  either eligibility test below — that is the case this record exists to
  decide, and a proposal that fails a test is the evidence the test is wrong or
  the artifact is. Also reopen on either of two observations that would falsify
  the reasoning rather than satisfy it. First — one of the three untracked
  artifacts is found to have a consumer that needs the tracked state, since the
  whole eligibility rests on there being none. Second — a ratchet baseline is
  shown to be reconstructible from the tree alone at the merge point, since
  that is the one property whose absence keeps the two baselines tracked.
---

# ADR-242 — a derived artifact with no consumer leaves the git index

## Status

**Accepted** · 2026-08-22. Scope decided by AI council (2 seats + blind peer
review, $0.099) during `road-to-generated-artifacts-out-of-index`: option B,
2/2 convergent, with five conditions. Both seats independently named the same
hardest pushback — a re-add guard that ships on the branch it judges is not
authoritative — and the peer round added the transition-window gap neither
first-round answer had covered.

## Context

Measured over the last 120 merge commits, six paths carry essentially all
conflict-resolution traffic in this repository and the seventh drops to 6:
`estate-count-budget.json` (53), `agents/roadmaps-progress.md` (50), the two
archive-index halves (49 each), `stubs/README.md` (32),
`gate-violation-baselines.json` (21). Over the last 300 CI runs the failure rate
is 6.0 %, and the single most frequent `Consistency` failure is literally
*"archive index out of date … run `task build-archive-index`"*.

Both figures have one cause: **a derived artifact that is committed goes stale
the moment the tree it derives from moves**, and every branch that moves that
tree collides on it.

The dashboard was untracked once already, on 2026-08-21, and `main` carried it
tracked again within a day — a branch created before the untrack brought it back
through a `modify/delete` merge that a resolution loop staged. Nothing could
refuse the re-add. That is the fact this record is built around: the decision to
untrack is cheap and the decision to make it stick is the whole problem.

## Decision

**A generated artifact leaves the git index when both tests pass.**

1. **No consumer needs it tracked or present.** Every reference to its path is
   classified as *names-path*, *writes*, or *requires-tracked*, and none is the
   third. Code inspection alone does not discharge this: the artifact is deleted
   from a clean working tree and the gate set is run, because inspection already
   missed one site once (`archive_completed_roadmaps.ts` staged the dashboard
   with `git add`, a call whose exit code the call site discarded — a silent
   no-op nobody noticed for a day).
2. **It is reconstructible.** One documented command regenerates it from a clean
   checkout, and two independent runs are byte-identical.

**Three artifacts pass and are untracked:** `agents/roadmaps-progress.md`,
`agents/roadmaps/archive/INDEX.md`, `agents/roadmaps/archive/index.json`.

**Two artifacts fail test 1 and stay tracked:** `src/config/estate-count-budget.json`
and `src/config/gate-violation-baselines.json`. ADR-241 established their churn
is not append-shaped, so no merge driver resolves them; `sync_pr_branch.ts:110`
states the other half — *"an untracked baseline is a baseline no PR diff can be
compared against, which deletes the ratchet."* A ratchet is a record of what a
tree measured, not a function of the tree, so it is not reconstructible either.
This record does not reopen ADR-241.

**One candidate was reclassified out:** `agents/roadmaps/stubs/README.md` is
authored prose with no generator, and the repository's own conflict classifier
already called it `authored`. Its hotspot cause — a hand-maintained inventory
inside it — was removed by `3793855b3` on 2026-08-21.

### Untracked is not unchecked

The CI contract becomes **derive-then-verify**, and one check may not stand for
all three properties: **absence** from the index, **buildability** from a clean
checkout, **correctness** of the output. "Derive and verify nothing" was refused
by both seats on the ground that option B *promises* on-demand regeneration, so
CI has to prove the promise. A present-but-stale copy still fails, and it is
told to run its own regeneration command.

### The guard runs from the base, not from the candidate

The re-add guard lives inside `Sync + Generate Tools Consistency`, the one check
the `main protection` ruleset requires. A check that exists only in the workflow
file the candidate branch supplies is bypassable by a branch that predates it —
which is the precise shape of the regression above.

## Consequences

- Three paths stop appearing in merge conflicts; the archive-index staleness
  failure cannot occur, because there is no committed copy to go stale.
- A branch created before the cutover hits `modify/delete` on all three. The
  resolution is **take the deletion**, and `sync_pr_branch.ts` prints it under
  an `UNTRACKED BY DESIGN` class rather than the generated class's
  `git checkout --ours`, which re-adds the file when followed.
- The dashboard loses PR-diff visibility, GitHub browsing and `git blame`. The
  anthropic seat pressed this as the real trade-off and it is the right frame;
  the maintainer answered it for the dashboard himself, and the criterion is
  quoted verbatim because a paraphrase would soften the one input that settled
  it: DE: *"Die Datei ist lokal schön, aber wichtig ist sie an sich nicht … ich <!-- md-language-check: ignore -->
  brauche sie nicht im Repo."* · EN: *"The file is nice locally, but it is not <!-- md-language-check: ignore -->
  important in itself … I do not need it in the repository."*
- Consumer repositories are **not** migrated by this record. A tracked →
  untracked transition cannot be made atomic across independently versioned
  repositories, so the two `.gitignore` entries stay repository-local and the
  consumer rollout is separate work.
- Rollback is artifact-scoped and never global; the conditions live in the
  roadmap that shipped this.

## Evidence

| Claim | Basis |
|---|---|
| Six paths carry essentially all conflict-resolution traffic, and the seventh drops to 6 | Files touched in the last 120 merge commits, counted per path: 53 / 50 / 49 / 49 / 32 / 21, then 6. Reproduce with `git log --merges -n 120 --format=%H \| while read h; do git show --format= --name-only "$h"; done \| sort \| uniq -c \| sort -rn` |
| The archive index is the most frequent single `Consistency` failure | 3 of the 6 `Consistency` failures among the last 300 runs are literally `archive index out of date (…) — run task build-archive-index` (`gh run list --limit 300`, failure rate 18/300 = 6.0 %) |
| The three untracked artefacts have no consumer that needs them tracked or present | Every hit for each literal path classified in `agents/evidence/analysis/derived-artifact-consumers-2026-08.md`; the two automation sites are string lists (`sync_pr_branch.ts:84-85` `GENERATED`, `ship_diff_volume_hook.ts:53` `EXCLUDED`). Confirmed by deleting all three from a clean working tree and running the gate set — the only two reds isolate to this change's own `+1` roadmap and to the committed-copy comparison Phase 3.2 replaces |
| Both generators are deterministic | Output deleted and regenerated twice per artefact, byte-compared: `build_archive_index` → `483d30f0…` / `c98da496…` on both runs, `update_roadmap_progress` → `ffe17843…` on both runs |
| Code inspection alone does not discharge the consumer test | `archive_completed_roadmaps.ts:403` ran `git add -- agents/roadmaps-progress.md`; `git add` on an ignored path exits **1** (probed 2026-08-22 in a scratch repository) and `_run` returns a code the call site discards — a silent no-op from the 2026-08-21 untrack onward that no reader noticed |
| A stale branch re-adds the file through a `modify/delete` merge, and the guard catches it | `origin/main` merged into the cutover branch produced `CONFLICT (modify/delete)` on all three paths with the stale version left in the tree; resolved by staging what was found, all three read as re-added, and on that tree both required-job gates exit 1 naming their paths |
| The two ratchet baselines are not reconstructible and not untrackable | ADR-241 § Context (39 of 43 sampled commits moved the baseline) and `src/scripts/sync_pr_branch.ts:110` |

The grade is **E2 — repeated and comparative**, and deliberately not higher.
The conflict population is measured across 120 merges and the CI population
across 300 runs rather than from one incident, and the consumer classification
was checked twice by different means — reading every call site, then deleting
the files and running the gates. There is no pre-registered benchmark and no
external authority.

What it is **not**: a demonstration that GitHub takes the required check's
definition from the merge ref rather than from the head branch. That is the one
load-bearing claim this record rests on which was not executed here, because it
cannot be observed from a branch that is not yet the base. It is carried as an
open criterion in
`agents/roadmaps/stubs/road-to-generated-artifact-guard-post-merge-proof.md`
with the procedure that closes it, rather than asserted.

## Alternatives

- **`merge=union` on the conflicting paths.** Refused for the two ratchet
  baselines by ADR-241 and unnecessary for the three untracked ones — a path
  that is not in the index has no merge driver to run.
- **Better conflict tooling instead of untracking.** Raised in the peer round
  and rejected: it makes the symptom cheaper and leaves a generated artifact in
  source control, where it will keep going stale.
- **Untrack the ratchet baselines too (option C).** Refused: see Decision.
- **A new `lint_`/`check_` gate script for the re-add guard.** Refused on cost —
  six registration surfaces and three ratchets (`check_ci_local_parity`,
  `check_gate_coverage`, the gate ledger) for a verdict `dashboard_mode.ts`
  already computed. That table was extended instead.

## References

- `agents/evidence/analysis/derived-artifact-consumers-2026-08.md` — the per-path consumer classification.
- `agents/evidence/analysis/merge-hotspot-cadence.md` — the churn measurement this builds on.
- ADR-241 — why the two ratchet baselines are not eligible.

# Completion review — ci-economy shard fold-back decision

**Skipped:** no code surface for this completion — the diff is one contract document, one comment-only hunk in a workflow, one roadmap file and its generated dashboard, and the gate itself measures zero code paths of four changed files, scope 6ccc0caa10ee765e76bff68cedb22508e93393f8603f0cb5a3615d803ce52ae2, declared 2026-08-18

## Why a skip rather than a review

Four files, no executable surface between them:

- `docs/contracts/ci-cost-budget.md` — measured figures and a decision.
- `.github/workflows/tests.yml` — a comment. No step, trigger, matrix
  dimension, exclusion or job key changed; `git diff` on this file touches
  only `#`-prefixed lines.
- `agents/roadmaps/road-to-inbox-harvest-2026-08-b-ci-economy.md` — one
  checkbox closed, two glyphs restored, reasoning recorded.
- `agents/roadmaps-progress.md` — regenerated from the file above.

No script, hook, schema, config, test or generator. `check_completion_review`
classifies the diff as zero code paths of four changed files, which is the
condition this declaration covers.

## What replaces a code review here

The change is a measurement and a decision taken from it, so the reviewable
surface is whether the numbers are real and whether the decision follows. Each
was checked rather than asserted:

- **The figures come from CI, per-job, over the sample the contract itself
  specifies.** 50 most-recent successful `main` runs of `tests.yml`, aggregated
  from `/actions/runs/<id>/jobs`, 1150 job rows. Not run-level — the contract's
  own Method note records that mixing the two manufactured two regressions the
  last time it happened, so the mistake is named and avoided rather than
  re-derived.
- **All 50 runs are post-fix.** The oldest is 2026-08-12 and the shard-3 fix
  merged 2026-08-11 (PR 1271), so no pre-fix run contaminates the average. That
  boundary was checked, not assumed from the run count.
- **Sample size is reported as a result, not a footnote.** Shard 3/4 on ubuntu
  ranges 217–406 s across the 50. The 2026-08-11 baseline used three runs, so it
  could have read anywhere from under the ceiling to 1.4× it — which is why the
  re-measurement widened the sample to the one the ceiling clause already asked
  for instead of repeating the old method.
- **The decision does not rest on the threshold alone.** The step's stated rule
  was a single comparison against 300 s. Keeping two dedicated runners on one
  inequality is thin, so the fold-back was also costed: ≈ 172 s of test-time to
  redistribute, giving ≈ 400 s even-split and ≈ 529 s clumped on ubuntu. Both
  bounds are worse, so the verdict holds however vitest happens to distribute —
  and clumping is the documented behaviour, which is the whole reason the
  dedicated jobs exist.
- **The overhead figure is borrowed from this contract, not invented.** The
  ≈ 25 s per-job fixed cost is the number the file already derives in its
  build-artefact rejection; the arithmetic reuses it and says so.
- **Two mechanism claims were falsified during the work and are recorded as
  refuted rather than quietly dropped.** Both concerned the glyph restore on 4.2
  and 4.3, and each would have justified the opposite edit:
  - *"Leaving them `[~]` reds the PR."* False. `roadmap-progress-check` is
    registered only in `task ci` (`Taskfile.yml:358`), no workflow invokes it,
    and the pre-push hook runs `task consistency` + `task preflight`, neither of
    which reaches it. Local-only red. This also refutes a line carried in the
    project's own notes since 2026-08-11.
  - *"Restoring them grows `open_blockers` and reds the estate ratchet."* Also
    false, and believed for several steps because the ratchet **did** go red on
    this PR at `open_blockers 67 → 69`. Measured both ways in one worktree:
    `check_estate_count` reports **69 with `[~]` and 69 with `[ ]`**. The +2 is
    pre-existing on `main` — run 32173675188 at `851568b5c` fails with the
    identical number before this branch existed. The lesson generalises: a red
    that appears on your PR is not evidence your PR caused it.

  The restore therefore rests on accuracy alone, which is where it started.
- **The workflow comment's remaining claims were re-checked before the edit, so
  the correction is narrow.** The exclusion rationale (golden + workspace
  hash-clump) is about files that are still excluded and is untouched. Only the
  "stays light and balanced" clause is falsified by the measurement, because the
  shard-3 driver is not one of the excluded files.

Gates green on this branch: `task preflight` (exit 0), `lint_workflow_paths`,
`lint_workflow_security`, `check_references`, `check_no_roadmap_refs`,
`lint_roadmap_family_cap`, YAML parse of the edited workflow, and the three
`verify:` annotations 3.4 ships with.

**Three checks were red on the first push and none was caused here. One has since
been fixed on the base; two remain inherited.**

- **`Sync + Generate Tools Consistency` — RESOLVED on the base, not by this
  branch.** It failed on `check_estate_count` at `open_blockers 67 → 69`, and the
  same step failed on `main` at `851568b5c` (run 32173675188) before this branch
  existed. PR #1423 then merged and raised the baseline to 69 with its own
  recorded reason; after merging that base in, `check_estate_count` exits 0 at
  `open_blockers 69 (baseline 69, +0)`. Stated as a base fix rather than quietly
  dropped, because the earlier version of this section named it a live breach and
  a reader comparing the two would otherwise not know which is true.
- **`Node Tests` shard 1/4, ubuntu and macOS — inherited.** Same failing step
  (`Vitest (shard 1/4, heavy suites excluded)`, step 7) on `main` run 32173675197
  at `851568b5c`. No test file, config or exclusion changed here; the shard-1 file
  set is untouched by this diff.
- **`Static Checks` — a known runner-variance flake, and not on a path this diff
  touches.** The failing step is 12, `hook-latency bench gate (pre-registered
  budget, real path)`. No hook, manifest or concern changed here. `prepack` and
  `typecheck` both exit 0 locally on this tree.

Nothing here absorbs an inherited red into this change, and no baseline was
raised to make this PR green — that is the move the ratchet exists to refuse, and
the raise that did happen was another PR's, with its own reason.

## Standing caveat

A skip declaration is a statement about the diff's surface, not a claim that the
reasoning is right. The strongest objection is that a 50-run average still mixes
two OS legs, PR-triggered and push-triggered runs, and whatever runner variance
GitHub had that week, so 357 s is a figure with an unstated confidence interval
rather than a constant. The counter is that the decision needs only the sign of
the comparison and it is the same at every bound computed here — the best single
ubuntu run (217 s) is the only observation that falls the other side of the
ceiling, and one run is what the widened sample exists to stop being decisive.

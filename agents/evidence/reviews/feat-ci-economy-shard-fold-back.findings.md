# Completion review — ci-economy shard fold-back decision

**Skipped:** no code surface for this completion — the diff is one contract document, one comment-only hunk in a workflow, one roadmap file and its generated dashboard, and the gate itself measures zero code paths of four changed files, scope b8b76958a29d655782102e606c96bc70e256025622abb383dbb8373298b474d7, declared 2026-08-18

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
- **One claim was falsified during the work and removed rather than shipped.**
  The first justification for restoring the two `[~]` glyphs was that leaving
  them would red the PR. Checked: `roadmap-progress-check` is registered only in
  `task ci` (`Taskfile.yml:358`), no workflow invokes it, and the pre-push hook
  runs `task consistency` + `task preflight`, neither of which reaches it. The
  breach was local-only, so the mechanism claim is stated as refuted inside the
  roadmap and the correction rests on accuracy alone.
- **The workflow comment's remaining claims were re-checked before the edit, so
  the correction is narrow.** The exclusion rationale (golden + workspace
  hash-clump) is about files that are still excluded and is untouched. Only the
  "stays light and balanced" clause is falsified by the measurement, because the
  shard-3 driver is not one of the excluded files.

Gates green on this branch: `task preflight` (exit 0), `lint_workflow_paths`,
`lint_workflow_security`, `check_references`, `check_no_roadmap_refs`,
`lint_roadmap_family_cap`, YAML parse of the edited workflow, and the three
`verify:` annotations 3.4 ships with.

## Standing caveat

A skip declaration is a statement about the diff's surface, not a claim that the
reasoning is right. The strongest objection is that a 50-run average still mixes
two OS legs, PR-triggered and push-triggered runs, and whatever runner variance
GitHub had that week, so 357 s is a figure with an unstated confidence interval
rather than a constant. The counter is that the decision needs only the sign of
the comparison and it is the same at every bound computed here — the best single
ubuntu run (217 s) is the only observation that falls the other side of the
ceiling, and one run is what the widened sample exists to stop being decisive.

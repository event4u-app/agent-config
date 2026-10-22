# Council record — macOS PR tier and the Static Checks diagnostic (2026-10-22)

<!-- evidence-type: council -->

- **Prompt:** `ci-macos-tier-and-static-diagnostic-2026-10-22.question.md` (beside this file), sent verbatim.
- **Members:** anthropic, openai — CLI seats, subscription-authed, nothing billed; 1 round; quorum 2/2.
- **Run:** `council_cli run … --rounds 1 --confirm --invocation agent`; raw response kept local at
  `agents/runtime/council/responses/ci-macos-tier-2026-10-22.md` (gitignored, auto-pruned).

## Verdicts

| Decision | anthropic | openai | Outcome |
|---|---|---|---|
| A — macOS legs on a PR | option 2 | option 2 | **Option 2, 2/2**: on a `tier` PR macOS runs install, install-aux, collector-lifecycle, workspace; node-tests ×4, golden, svg-witness macOS legs run on `full`, label `ci:macos`, and every `push: main` |
| B — hook-latency diagnostic | option 2 | option 2 | **Leave it in Static Checks, 2/2**: not on the critical path (6m07 vs 8m40 ubuntu shard vs ~40 min macOS-bound run); a separate job nets ~30-50 s and loses the same-job warm/cold delta |

## Reasons, condensed

- A: zero macOS-only reds in golden, svg-witness, install, install-aux, workspace over 5365 twin
  pairs; node-tests' 10 (0.2 %) are nine shard-4/4 timeouts, a tracked harness class. The
  classifier is a safety boundary, so the rollout is observed (below).
- B: the step is non-gating and the job is not the last one; moving it trades measurement quality
  and a runner for no time-to-green gain.

## Corrections to the prompt, recorded rather than re-asked

1. The prompt said every ubuntu job on PR #2569 started within 63 s. The Actions API reading
   (`agents/evidence/analysis/ci-time-to-green-2026-10.md`) shows ubuntu queues up to 5m23s
   (node shard 4/4) on that run; ubuntu PR queue p50 29 s / p90 3m34s against macOS 5m34s / 25m09s
   over 7 days. Neither seat's reasoning rests on the ubuntu figure; the macOS/ubuntu contrast holds.
2. "13 macOS jobs per run" was stale for the post-change workflow: with one unsharded macOS install
   job it is **10** (one seat caught it). The 13 holds for the pre-change workflow and for
   `push: main` before this PR.

Re-running with corrected facts would be a second evaluation of the same question in one turn; the
corrections point the same way as the verdicts, so they are recorded here instead.

## Conditions attached by the seats (adopted)

- Observed rollout: the `platform-scope` job writes its decision and the skipped legs to the job
  summary, so a `tier` PR whose skipped legs later fail on `push: main` is traceable.
- Escape threshold: one credible macOS-only red on `push: main` from a PR classified `tier`
  reopens decision A (widen `full` or revert to option 1).
- `ci:macos` stays a documented one-label override.

**Revisit if:** a macOS-only regression lands on `main` from a `tier` PR; Static Checks becomes the
last job holding up a PR, becomes required, or a merge queue makes total wall-clock the constraint.

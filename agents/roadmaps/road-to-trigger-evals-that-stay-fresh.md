---
complexity: lightweight
status: ready
tree_pin: 9f12d31f78
execution:
  mode: phase-checkpoints
review_by: 2027-02-15
# roadmap:context scanned: 1266 roadmap file(s) across active/later/stubs/archive; no sibling on trigger-eval freshness or the rotation write-back
relates: []
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-11-04 (answer 2 to the stale-trigger-eval question in the PR #2841 session): the gradual refresh is tracked as its own roadmap instead of a one-off paid batch."
estate_offset_exempt: "Added on owner instruction, agents/evidence/owner-directives/2026-11-04-trigger-eval-freshness-roadmap.md (2026-11-04); no active roadmap covers trigger-eval freshness, so none is archived to offset it."
---
# Road to trigger evals that stay fresh

> **Source:** owner answer 2026-11-04 (PR #2841 session), recorded in
> `agents/evidence/owner-directives/2026-11-04-trigger-eval-freshness-roadmap.md`.

## Goal

`check-trigger-evals` is green on a fresh checkout and stays green without anyone
hand-editing a date. At the pin it is red on every branch: 70
`src/skills/*/evals/triggers.json` files are flagged — 63 with `last_eval` older
than 90 days, 7 with none.

## Why the dates went stale

The paid replay already runs: `.github/workflows/cross-model-canary.yml` replays
one slot of the 12-week rotation (`src/scripts/trigger_eval_rotation.ts`) every
Monday. **Nothing writes the result back.** No script, workflow step or PR writes
`last_eval`, so every scheduled run spends its queries and the freshness gate
never sees them. On top of that the last two scheduled runs (2026-10-26,
2026-11-02) failed with 12 suites below their precision / recall floor, so even a
writer would have had nothing it may record for those.

The fix is therefore the missing write-back, not a batch re-run: once results are
recorded, the existing 12-week cycle refreshes every suite inside the 90-day
window at no extra spend.

## Phase 1 — A passing rotation run records itself

- [ ] **1.1 Record `last_eval` from a result, never from a clock.** Add a
      `--record <results-dir>` mode that sets `last_eval` to the run date only for
      a suite whose result JSON meets its precision and recall floor; a suite
      below floor, or without a result, is left untouched.
      verify: `npx vitest run tests/scripts/trigger_eval_rotation.test.ts` -> 0,
      with a fixture where a passing suite is bumped, a below-floor suite is not,
      and a suite with no result JSON is not.
- [ ] **1.2 The scheduled job proposes the bump as a PR.** After the replay, the
      workflow runs `--record` and opens one PR with the changed `triggers.json`
      files and the result summary. It never pushes to `main`.
      verify: a `workflow_dispatch` run on a branch opens a PR touching only
      `src/skills/*/evals/triggers.json`.
- [ ] **1.3 Docs follow.** The `check-trigger-evals` task description and the
      remediation hint in `src/scripts/check_trigger_evals.ts` name the rotation
      PR as the way a date moves, instead of "re-run skill_trigger_eval and bump it".
      verify: `grep -n "bump it" src/scripts/check_trigger_evals.ts` -> no hits.

## Phase 2 — The suites below floor

- [ ] **2.1 Triage the 12 below-floor suites** from the 2026-11-02 run
      (`adr-create`, `fe-design`, `frontend-render-security`, `markitdown`,
      `messaging-architecture`, `project-analysis-core`, `prompt-optimizer`,
      `roadmap-management`, `schema-review`, `sentry-integration`,
      `supply-chain-intake`, `workspace-link`). Per suite, decide whether the
      skill description or the trigger corpus is wrong, with the result JSON as
      evidence. `markitdown` (precision 0, recall 0) goes first: a total miss
      points at the harness or the corpus, not the description.
      verify: each suite has a recorded cause next to this step.
- [ ] **2.2 Fix each suite against its cause.** Never lower a floor or delete a
      query to reach green (evaluator independence); a floor change goes to the
      owner.
      verify: the next scheduled run that covers the suite meets its floor.

## Phase 3 — The cycle closes

- [ ] **3.1 The 7 suites without any `last_eval` are in the rotation.**
      (`api-testing`, `test-driven-development`, `test-performance`, and the
      others the gate names.) Confirm each hashes into a slot, so the first
      recorded run gives it a date.
      verify: `./scripts-run src/scripts/trigger_eval_rotation --dry-run --week <n>`
      over weeks 1–12 lists each of the 7 exactly once.
- [ ] **3.2 Green on a fresh checkout.** After one full 12-week cycle with Phase 1
      live, `./scripts-run src/scripts/check_trigger_evals` exits 0 on `main`.
      verify: that command on a fresh clone of `main` -> 0.

## Out of scope

- A one-off paid re-run of all 70 suites (owner chose the gradual path).
- Raising `MAX_WEEKLY_QUERIES` above 240, or rebalancing rotation slots
  (rejected 2026-10-14, 2026-10-27, 2026-11-02).
- Bumping any `last_eval` without a run behind it.

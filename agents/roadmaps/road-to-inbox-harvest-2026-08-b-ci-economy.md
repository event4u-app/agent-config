---
complexity: lightweight
parent_roadmap: road-to-inbox-harvest-2026-08-b.md
---

# Road to CI Economy — cut the redundant full builds and re-anchor the cost artefacts to CI-recorded data

> Cut the number of matrix-expanded `tests.yml` jobs that each run the full
> 6-target `npm run build` on a `src/**` PR from 13 to at most 5, and replace
> every stale row in `docs/contracts/ci-cost-budget.md` with a figure recorded
> from a CI run — with no required check removed.

> Source (consumed inbox): `agents/tmp.old/test-economy.txt` — part of the
> 2026-08-10 batch triaged by [`road-to-inbox-harvest-2026-08-b.md`](road-to-inbox-harvest-2026-08-b.md).

## Context / What is verified

Re-derived in this worktree at `c073d5732` (v9.32.0):

- `tests.yml` declares **6 job keys** (`:55`, `:99`, `:173`, `:246`, `:348`, `:386`)
  which matrix-expand to **23 jobs**: `install-tests` 4 shards x 2 OS (`:76-78`),
  `install-aux-tests` 2 OS (`:111-112`), `node-tests` 2 OS x 4 shards (`:203-204`),
  `static-checks` 1 (`:246`, no matrix), `golden-tests` 2 OS (`:363-364`),
  `workspace-tests` 2 OS (`:398-399`).
- Four `npm run build --silent` steps (`:231`, `:286`, `:381`, `:415`) sit in
  `node-tests`, `static-checks`, `golden-tests`, `workspace-tests` — so
  **13 matrix-expanded jobs** each run the full build (8 + 1 + 2 + 2). The inbox
  file said 12; 13 is the measured number.
- `npm run build` is **6 targets** (`package.json:78`). Two workflow comments still
  claim it is `build:cli && build:ui` (`tests.yml:183`, `:229`) — stale.
- **1041** test files reach the vitest include set (`vitest.config.ts:16`, minus the
  `tests/golden/sandbox/repo/**` exclude at `:21`); **191** of them spawn a
  subprocess, which is what makes a `--changed`-style selection blind to that
  slice. **43** files already use `tests/_lib/run_in_process.ts` — the lever exists.
- `consistency.yml` is 1 job (`:94`) with **48** `- name:` steps. `scripts-run`
  invocations total **99** across workflows, of which `rule-backstops.yml` = **23**
  and `consistency.yml` = **21**. The inbox file targeted `consistency.yml`; the
  larger surface is `rule-backstops.yml`.
- **The artefact the inbox file proposes to create already exists.**
  `docs/contracts/ci-cost-budget.md` carries the per-job wall-clock table
  (`:24-36`), the 5-min ceiling (`:70-84`) and a quarterly review checklist
  (`:86-100`, next due 2026-08-26). It is **stale**: rows for `python-tests`,
  `windows-lockfile-export` and `migration-dry-run.yml` describe jobs and workflows
  that no longer exist (`ls` on all three: absent; no `python-tests:` key anywhere
  in `.github/workflows/`); `node-tests` is listed as "2 OS" when it is 2 OS x 4
  shards; no rows for `golden-tests`, `workspace-tests` or `static-checks`.
- `src/scripts/ci_time_ratio.ts` already samples `gh run list` (`:16`), classifies
  commits by touched path and writes a JSON report (`:262`). Two defects: its
  docstring names `agents/runtime/reports/` (`:23`) while `DEFAULT_OUT` (`:37`)
  writes `agents/reports/`, and only the latter exists; and it is registered in no
  `Taskfile.yml` / `taskfiles/*` / `src/cli/registry.ts` target.
- **The baseline must come from CI, not from this laptop.**
  `docs/hook-latency.json:2` records the exact failure: "a locally recorded darwin
  baseline made the 20% regression window measure the environment offset instead of
  real regressions." The inbox file's local 15s/19s timings plus a guessed "2-4x on
  hosted runners" are that class and are not carried here.
- Predecessor programme, read first:
  `agents/roadmaps/archive/road-to-optimized-ci-and-release-gates.md` — Phase A
  shipped the `release/*` skip guard, Phase C split the over-broad Windows and
  Python legs out, and Phase C Step 3 authored `ci-cost-budget.md` itself (`:55`).
  None of that is re-planned here.
- Only **one** required check exists at the enforcement layer:
  `Sync + Generate Tools Consistency` (`docs/contracts/branch-protection-policy.md:59`),
  in ruleset `17749383`. Changing the required set is a maintainer action.

## Phase 0 — Re-anchor the two existing cost artefacts to CI-recorded data

- [-] **0.1 Create a `ci-timings.json` under `docs/`.** <!-- ref-ignore -->
      Cancelled: already satisfied by `docs/contracts/ci-cost-budget.md` (table
      `:24-36`, ceiling `:70-84`, review cadence `:86-100`). Extend that file; do not
      add a second one. The path is named without a link on purpose — it must stay
      absent, so a resolvable reference to it would be the defect.
- [ ] **0.2 Fix the `ci_time_ratio` output-path drift.** Docstring `:23` names
      `agents/runtime/reports/ci-time-ratio.json`; `DEFAULT_OUT` `:37` writes
      `agents/reports/ci-time-ratio.json`; only the latter directory exists.
      <!-- verify: grep -n 'runtime/reports' src/scripts/ci_time_ratio.ts -->
- [ ] **0.3 Register `ci_time_ratio` behind a named target.** Zero hits today in
      `Taskfile.yml`, `taskfiles/*.yml`, `src/cli/registry.ts`. Add it beside the
      sibling CI helper in `taskfiles/ci-fast.yml`, which already hosts
      `ci:required-checks` (`branch-protection-policy.md:101`).
      <!-- verify: grep -rn 'ci_time_ratio' taskfiles/ -->
- [ ] **0.4 Replace the stale `ci-cost-budget.md` baseline rows with CI figures.**
      Drop `python-tests`, `windows-lockfile-export`, `migration-dry-run.yml` (all
      gone); correct `node-tests` to 2 OS x 4 shards (`tests.yml:203-204`); add
      `static-checks`, `golden-tests`, `workspace-tests`. Figures from `gh run list
      --branch main --limit 50` as the file's own checklist specifies (`:90-91`) —
      never a local run, per `docs/hook-latency.json:2`.
      <!-- verify: grep -n 'python-tests\|windows-lockfile-export\|migration-dry-run' docs/contracts/ci-cost-budget.md -->
- [ ] **0.5 State the measurement-only kill criterion in the file.** The inbox file
      bound every kill criterion to `escaped_regressions`, which needs a human to
      attribute a post-merge failure to a demoted check and is not mechanically
      decidable. Phase 0 changes no job, so its criterion is "the refreshed table
      names every job that exists and none that does not" — decidable by 0.4.

## Phase 1 — Free hygiene: dead filters, missing concurrency, stale comments, caches

- [x] **1.1 Delete the dead `.agent-src.uncondensed/**` path filters.** The tree is
      absent yet 10 filter entries reference it: `skill-lint.yml:7,29`,
      `consistency.yml:13,52`, `smoke.yml:17,19`, `tests.yml:20,21,39,40`. Classify
      each before removal — a filter naming a not-yet-created path is legitimate; a
      filter naming a removed tree is not.
      <!-- verify: grep -rn 'agent-src.uncondensed' .github/workflows/ -->
- [x] **1.2 Delete the three other dead filter entries.**
      **Shipped as a REPOINT, not a delete — a deliberate divergence from this
      step's wording, recorded here rather than applied silently.** All three
      express a *live* intent under a moved name, so deleting discards the
      intent along with the dead path: `install.py` became `install.ts`
      (ADR-200 py2ts) and the templates tree is `src/agent-src/templates/**`.
      Deleting those two would leave the public-install smoke un-triggered by a
      change to the installer or to the templates it installs — the same silent
      under-triggering this phase exists to end, reached from the other side.
      `router.json` is the weaker of the three: this step's reasoning (redundant
      with `rule-backstops.yml`) is sound, and the counter-reason is that
      `smoke.yml`'s own header declares a **router tier** among the four it
      dispatches, so a router change should reach its own smoke. Repointed to
      `dist/router.json`. A reviewer preferring the delete should say so; the
      direction is one-way safe either way, since a repoint only widens
      triggering and can never suppress a run.
      <!-- verify: ./scripts-run src/scripts/lint_workflow_paths -->
- [x] **1.3 Add a report-only dead-filter sweep.**
      **Shipped STRICT, not report-only — the sharpest divergence in this PR,
      and the one most worth a reviewer's disagreement.** This step's objection
      is exactly right in the abstract: a filter may legitimately name a path a
      future PR adds, so the false-positive class is not empty by construction.
      Two things answer it. First, the shipped gate carries an inline escape —
      `# workflow-path-allow: <reason>` on the entry, with a reason of at least
      two words, which is precisely the pre-staged-filter case and nothing
      wider; there is deliberately no allowlist JSON, because a side-channel
      file is the shape that grows past twenty entries and becomes the budget
      bypass `autonomous-execution` names. Second, the classification this step
      asks for was performed BEFORE the gate was written: **20 entries, every
      one classified by hand, every one repaired**, so the live corpus is
      verified empty rather than merely unexamined — and an advisory gate over
      an empty violation set is one nobody ever acts on.
      A finding this step did not anticipate, and the reason the sweep earned
      strictness: the hand census found 19 and the gate found a 20th that no
      manual pass had seen — `release-validation.yml` filtering on a root
      `marketplace.json` that has never existed, so a version drift in the real
      `.claude-plugin/marketplace.json` did **not** re-trigger the
      `version-consistency` job whose entire purpose is catching that drift.
      Reverting to report-only is a one-line change (drop the non-zero exit) if
      the reviewer still prefers it.
      <!-- verify: ./scripts-run src/scripts/lint_workflow_paths --self-test -->
- [ ] **1.4 Add `concurrency:` to the five workflows without it.** 23 of 28 carry
      it; `rule-backstops.yml`, `self-review-gate.yml`, `adoption-snapshot.yml`,
      `cross-model-canary.yml`, `release-adjacent-health.yml` do not.
      `rule-backstops.yml` (`:24` PR, `:40` push) and `self-review-gate.yml` (`:19`
      PR, two PR jobs at `:27`, `:41`) are the two that actually stack. Scope
      `cancel-in-progress` to `pull_request` refs only — a cancelled push-to-main
      backstop run loses the only signal for that commit.
      <!-- verify: grep -c 'concurrency:' .github/workflows/rule-backstops.yml -->
- [x] **1.5 Correct the three stale workflow comments.** `tests.yml:183` and `:229`
      claim `build` = `build:cli && build:ui`; it is 6 targets (`package.json:78`).
      `tests.yml:238` points at a `heavy-tests` job that does not exist — the real
      jobs are `golden-tests` (`:348`) and `workspace-tests` (`:386`).
      `tests.yml:349` says "29 scenarios"; `tests/golden/baseline/` holds 30.
      <!-- verify: grep -n 'build:cli && build:ui\|heavy-tests\|29 scenario' .github/workflows/tests.yml -->
- [ ] **1.6 Turn on the two absent toolchain caches.** No `incremental` or
      `tsBuildInfoFile` in `tsconfig.json`, `tsconfig.scripts.json`,
      `tsconfig.test.json`, `tsconfig.ui.json`; `lint:ts` is bare
      `eslint 'src/**/*.ts'` (`package.json:80`) with no `--cache`. Both are
      correctness-neutral and both feed `static-checks`.
      <!-- verify: grep -n 'incremental' tsconfig.json -->
- [ ] **1.7 Add `--no-audit --no-fund --prefer-offline` to the bare `npm ci` calls.**
      13 workflows already pass the first two; 10 still carry at least one bare
      `run: npm ci`, including all six in `tests.yml` (`:94`, `:125`, `:214`,
      `:263`, `:374`, `:409`). `--prefer-offline` appears zero times anywhere, while
      `setup-node` already populates the npm cache.
      <!-- verify: grep -nE '^\s*-?\s*run:\s*npm ci\s*$' .github/workflows/tests.yml -->

## Phase 2 — The build fan-out: stop rebuilding the same 6 targets 13 times

- [ ] **2.1 Record the per-build cost before changing anything.** Add the
      `npm run build --silent` step duration for `node-tests`, `static-checks`,
      `golden-tests`, `workspace-tests` to the Phase 0.4 table, from a CI run.
      Without that row the fan-out saving is asserted, not measured.
      <!-- verify: grep -c 'npm run build --silent' .github/workflows/tests.yml -->
- [ ] **2.2 Build once, share the artefact.** One producer job runs the full build
      and uploads `dist/`; the other three families download it instead of
      rebuilding. Both primitives are already in-tree — `upload-artifact@v7` in 8
      workflows (e.g. `consistency.yml:470`) and `actions/cache@v6` in
      `release-validation.yml:391` — so this adds no new dependency.
      <!-- verify: grep -c 'npm run build --silent' .github/workflows/tests.yml -->
- [ ] **2.3 Keep the drift gate on the producer.** The freshness check at
      `tests.yml:303-312` is what makes a shared artefact safe: it asserts
      `dist/install/` still derives from `src/install/` via `git status
      --porcelain`. It stays on the job that actually builds, and consumers assert
      the artefact they received rather than silently rebuilding on cache miss.
      <!-- verify: grep -n 'Committed build output is fresh' .github/workflows/tests.yml -->
- [ ] **2.4 Split the build where a consumer needs fewer than six targets.**
      `build:cli-delegate` (`package.json:71`) is the in-repo precedent for an
      independently buildable esbuild target. `static-checks` runs ESLint + tsc +
      prepack and never spawns `./agent-config`, so it does not need `build:ui`;
      `golden-tests` and `workspace-tests` spawn the CLI and do. Record per job
      which targets are actually required.
      <!-- verify: grep -n 'build:cli-delegate' package.json -->
- [ ] **2.5 Record the deliberate non-adoption of a remote build cache.** Rejected
      on cost and dependency grounds: a third-party cache service adds an external
      dependency and a spend line for a saving 2.2 gets from primitives already in
      the repo. **Not** an ADR-088 consequence —
      `ADR-088-no-external-runtime-federation.md` is a category boundary about
      driving external agent runtimes and does not reach build caching. The inbox
      file cited it incorrectly.

## Phase 3 — The subprocess lever: extend in-process running, do not add a skill

- [ ] **3.1 Inventory the 191 spawning test files against the 43 adopters.**
      `tests/_lib/run_in_process.ts` already exports `runInProc` / `runInProcAsync`
      (`:149`, `:48`) and models process exit as a throwable (`ProcessExit`, `:41`).
      Produce the candidate list: files whose spawn is a plain `./scripts-run` or
      `./agent-config` invocation with no real process-boundary assertion.
      <!-- verify: grep -rl 'run_in_process' tests/ | wc -l -->
- [ ] **3.2 Migrate the mechanical candidates in batches, keeping one spawning test
      per CLI entry point.** The process boundary is the thing under test for argv
      handling, exit codes and stdio; converting every last one deletes that
      coverage.
      <!-- verify: grep -rl 'run_in_process' tests/ | wc -l -->
- [ ] **3.3 Document the in-process pattern in the existing
      `src/skills/test-performance/SKILL.md`.** No new skill: the estate is 116
      rules / 289 skills and this is the subject that skill already owns. Note
      honestly that the skill is currently single-stack — its whole "Optimization
      strategies" section (`:68-147`) is database / migration / seeder work. Adding
      the node-vitest subprocess-vs-in-process axis gives it a second stack peer,
      which also moves it toward the multi-stack shape
      `framework-neutrality-in-generic-skills` asks of a generically named artefact.
- [ ] **3.4 Retire the `heavy-tests` framing if the clumping cause is gone.**
      `golden-tests` and `workspace-tests` exist as dedicated runners because
      subprocess-heavy files hash-clump into one over-budget vitest shard
      (`tests.yml:349-357`, `:387-392`). If 3.2 removes enough spawns that the clump
      disappears, both fold back into the shard matrix — decidable from the shard
      durations in the Phase 0.4 table, not from a guess.
      <!-- verify: grep -n 'hash-clump' .github/workflows/tests.yml -->

## Phase 4 — Required-check-set changes (authored here, applied by the maintainer)

- [ ] **4.1 Draft ADR-222 for any required-check demotion, after 0.4 has numbers.**
      Next free number is 222 (`docs/decisions/` ends at
      `ADR-221-host-native-first-ladder.md`). The ADR states what regression class
      the demoted check was catching and what still catches it. It is a proposal in
      `docs/decisions/` and changes no enforcement by itself.
      <!-- verify: ls docs/decisions/ | tail -3 -->
- [~] **4.2 Demote the macOS leg and/or the `npm audit` PR gate.** Deferred behind
      `blocker: required-check-set-change`. Touches ruleset `17749383` plus
      `docs/contracts/branch-protection-policy.md`, `ci-green-floor.md` and
      `release-pr-gating.md` in the same change.
- [~] **4.3 Enable a GitHub merge queue.** Deferred behind
      `blocker: merge-queue-enablement`. `merge_group` appears zero times in
      `.github/`, so nothing in-tree is wired for it either way.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Shared build artefact hides per-job drift | implementation | Four independent builds today each re-derive `dist/`; one shared artefact means a drift only the producer would notice. | Keep the `tests.yml:303-312` freshness gate on the producer; consumers assert the artefact rather than rebuilding on cache miss (2.3). | Phase 2 — The build fan-out |
| 2 | Baseline recorded from too few runs | implementation | A figure from one PR run measures runner variance; a later regression window would then flag noise. | Use the 50-run average the file's own checklist specifies (`ci-cost-budget.md:90-91`), recorded from CI, never locally (`hook-latency.json:2`). | Phase 0 — Re-anchor the two existing cost artefacts |
| 3 | In-process migration deletes real coverage | implementation | Converting a spawn to an in-process call removes the argv / exit-code / stdio boundary some tests exist to prove. | Keep one spawning test per CLI entry point (3.2); `ProcessExit` (`run_in_process.ts:41`) preserves exit semantics for the rest. | Phase 3 — The subprocess lever |
| 4 | A filter is dead by typo, not by removal | product | Deleting a path-filter entry that was meant to match something narrows a trigger surface silently. | Classify every entry before deleting (1.1, 1.2), each removal citing its absence check; the sweep in 1.3 stays report-only. | Phase 1 — Free hygiene |
| 5 | `cancel-in-progress` drops a backstop signal | product | On `push: main`, `rule-backstops.yml` is the only run for that commit; cancelling it loses the signal entirely. | Scope `cancel-in-progress` to `pull_request` refs only (1.4). | Phase 1 — Free hygiene |

## Blockers

### blocker: required-check-set-change
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 4.2 only. Phases 0-3 and step 4.1 are not blocked — they change
  no required check, and ADR-222 is a proposal, not an enforcement change.
- **What to do:** decide whether the macOS leg and the `npm audit` PR gate stay in
  the required set, then apply the ruleset edit. Ruleset `17749383` currently
  requires exactly one check, `Sync + Generate Tools Consistency`
  (`docs/contracts/branch-protection-policy.md:59`); the write path is documented
  at `branch-protection-policy.md:158`.
- **Resolved when:** ADR-222 is accepted and the ruleset's
  `required_status_checks` list matches the matrix in
  `branch-protection-policy.md`, with `ci-green-floor.md` and
  `release-pr-gating.md` updated in the same change.

### blocker: merge-queue-enablement
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 4.3 only. Nothing else here depends on a merge queue.
- **What to do:** decide whether to enable a GitHub merge queue for `main` — a
  repo-admin setting that cannot be turned on from the tree.
- **Resolved when:** the merge queue is enabled on `main` and at least one workflow
  declares a `merge_group` trigger (currently zero across `.github/`).

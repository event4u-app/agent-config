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
- [x] **0.2 Fix the `ci_time_ratio` output-path drift.** Docstring `:23` names
      `agents/runtime/reports/ci-time-ratio.json`; `DEFAULT_OUT` `:37` writes
      `agents/reports/ci-time-ratio.json`; only the latter directory exists.
      <!-- verify: grep -n 'runtime/reports' src/scripts/ci_time_ratio.ts -->
- [x] **0.3 Register `ci_time_ratio` behind a named target.** Zero hits today in
      `Taskfile.yml`, `taskfiles/*.yml`, `src/cli/registry.ts`. Add it beside the
      sibling CI helper in `taskfiles/ci-fast.yml`, which already hosts
      `ci:required-checks` (`branch-protection-policy.md:101`).
      <!-- verify: grep -rn 'ci_time_ratio' taskfiles/ -->
- [x] **0.4 Replace the stale `ci-cost-budget.md` baseline rows with CI figures.**
      Shipped wider than the step's wording in one respect, recorded rather than
      applied silently: the three dead rows also had two dead **See-also**
      pointers (`python-version-sweep.yml`, `windows-lockfile-export.yml`) and
      two "Critical path observations" bullets describing both as live jobs.
      Dropping only the table rows would have left the same false claim standing
      three paragraphs down. The new ceiling violator is `node-tests` shard 3/4
      at 645 s / 852 s, which the old "2 OS" row had hidden.
      **The first pass got its own method wrong and the correction is recorded
      rather than quietly applied.** It measured non-`tests.yml` workflows at
      *run* level while the 2026-05-26 rows were *per-job*, and reported two
      regressions from the mismatch: `smoke.yml` 18 s → 82 s (actually 20–23 s
      per job — no regression) and `smoke-public-install` 413 s → 291 s (a
      matrix-level figure against a matrix-level figure, but presented as a job
      row). Re-measured per job for every workflow, exactly **one** regression
      stands: `consistency.yml` 27 s → 75 s, single-job and therefore
      like-for-like. The table also carried `smoke-contracts` as a job name; it
      is the workflow *display* name, and `smoke.yml` declares four jobs. Caught
      by the round-2 completion review, which is also what falsified the kill
      criterion 0.5 shipped.
      Drop `python-tests`, `windows-lockfile-export`, `migration-dry-run.yml` (all
      gone); correct `node-tests` to 2 OS x 4 shards (`tests.yml:203-204`); add
      `static-checks`, `golden-tests`, `workspace-tests`. Figures from `gh run list
      --branch main --limit 50` as the file's own checklist specifies (`:90-91`) —
      never a local run, per `docs/hook-latency.json:2`.
      <!-- verify: grep -n 'python-tests\|windows-lockfile-export\|migration-dry-run' docs/contracts/ci-cost-budget.md -->
- [x] **0.5 State the measurement-only kill criterion in the file.** The inbox file
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
- [x] **1.4 Add `concurrency:` to the five workflows without it.**
      All five got the same block. **The first attempt conditioned only
      `cancel-in-progress` and was wrong** — GitHub evicts a *pending* member of
      a concurrency group whatever that flag says, so keying every run on
      workflow+ref would have let a queued `push: main` backstop run be dropped:
      the exact loss the step exists to prevent, newly introduced by the step
      meant to prevent it. The completion review caught it.
      What ships: the **group key** carries the guarantee. Non-PR runs are keyed
      by `github.run_id`, putting each in a group of one that nothing can join,
      so they are never evicted and never serialised against each other; PR runs
      keep the shared per-ref key so a newer push supersedes an older one.
      `cancel-in-progress` stays conditioned as a second, consistent signal.
      Each block carries a comment naming which signal the exception protects.
      As found, 23 of 28 workflows carried a `concurrency:` block and these five
      did not: `rule-backstops.yml`, `self-review-gate.yml`,
      `adoption-snapshot.yml`, `cross-model-canary.yml`,
      `release-adjacent-health.yml`. All 28 carry one now. `rule-backstops.yml`
      (`:24` PR, `:40` push) and `self-review-gate.yml` (`:19` PR, two PR jobs)
      are the two that actually stack.
      One instance found while fixing this and deliberately NOT changed:
      `release-drift.yml` has no `pull_request` trigger, yet sits in a global
      group with an unconditional `cancel-in-progress: true` — the same
      pending-eviction exposure, in a workflow this step does not name. Left
      alone to keep the diff traceable to the step; recorded here so the next
      pass has the instance rather than the pattern.
      <!-- verify: grep -c 'concurrency:' .github/workflows/rule-backstops.yml -->
- [x] **1.5 Correct the three stale workflow comments.** `tests.yml:183` and `:229`
      claim `build` = `build:cli && build:ui`; it is 6 targets (`package.json:78`).
      `tests.yml:238` points at a `heavy-tests` job that does not exist — the real
      jobs are `golden-tests` (`:348`) and `workspace-tests` (`:386`).
      `tests.yml:349` says "29 scenarios"; `tests/golden/baseline/` holds 30.
      <!-- verify: grep -n 'build:cli && build:ui\|heavy-tests\|29 scenario' .github/workflows/tests.yml -->
- [x] **1.6 Turn on the two absent toolchain caches.**
      **Shipped, but this step's stated benefit is wrong and the correction is
      the point.** It says both "feed `static-checks`" — they do not. A CI runner
      starts cold: there is no prior `.tsbuildinfo` and no prior `.eslintcache` to
      reuse, so neither saves a second in CI unless an `actions/cache` step is
      added to carry them between runs, which this step does not ask for and
      which trades a real correctness risk (a stale lint cache) for a saving the
      Phase 0.4 table shows is small — `static-checks` is 131 s, well under the
      ceiling. What they buy is **local** re-run time, measured on this machine:
      `npm run typecheck` 8.2 s → **3.2 s** warm, `npm run lint:ts` 11.2 s →
      **0.83 s** warm. That is a developer-loop and `task preflight` win, and it
      is worth having under its real name.
      **`incremental` is on the two intrinsically-`noEmit` configs ONLY, and the
      first attempt got this wrong.** It was initially added to the base
      `tsconfig.json`, which `build:cli` (`tsc -p tsconfig.json`) **emits** from:
      with a surviving buildinfo and a deleted `dist/`, tsc emits nothing and
      exits 0, which would have made the freshness gate's own remediation
      ("run `npm run build:cli` and commit the result") a silent no-op — and
      `.tscache/` is gitignored, so it survives every `git clean` of `dist/`.
      Caught by the completion review, reproduced, and moved to
      `tsconfig.scripts.json` — and only there. Round 2 had put it on
      `tsconfig.test.json` as well; round 3 found nothing ever passes that
      config to `tsc` (eslint uses it as a `project`, which writes no
      buildinfo), so the flag was dead and is gone. `.tscache/` holds exactly
      one file, `scripts.tsbuildinfo`, which is what the directory listing
      shows. `.eslintcache` is gitignored too; both entries sit outside the
      managed gitignore block. No `incremental` or
      `tsBuildInfoFile` in `tsconfig.json`, `tsconfig.scripts.json`,
      `tsconfig.test.json`, `tsconfig.ui.json`; `lint:ts` is bare
      `eslint 'src/**/*.ts'` (`package.json:80`) with no `--cache`. Both are
      correctness-neutral and both feed `static-checks`.
      <!-- verify: grep -n 'incremental' tsconfig.json -->
- [x] **1.7 Add `--no-audit --no-fund --prefer-offline` to the bare `npm ci` calls.**
      **24 bare call sites across 11 workflows, now zero — and the first count
      was wrong.** The step's own verify regex (`^\s*-?\s*run:\s*npm ci\s*$`)
      matches only the single-line `run:` form, so the first pass reported "20
      across 10, now zero" while four bare calls survived inside `run: |`
      blocks: `site.yml`, `deploy-site.yml` (a workflow the step never named)
      and two in `consumer-matrix.yml`. A verify command that cannot see a whole
      syntactic form is a completeness claim about the wrong set; round 3 caught
      it. The residual grep hits are comment prose, not invocations.
      **The CI benefit is real but not universal:** `--prefer-offline` pays only
      where `setup-node` declares `cache: 'npm'`, and 4 of the 24 sites have no
      `cache:` key — there the flags still save the audit and funding lookups,
      which is smaller. The already-flagged
      calls elsewhere use a longer house form with retry fallback
      (`--fetch-retries=5 --fetch-retry-mintimeout=10000 || (sleep 10 && …)`);
      that form was NOT propagated here, because changing retry semantics is a
      reliability change and this step is a flag change. Unlike 1.6 this one does
      pay in CI: `setup-node` restores the npm cache before these run, so
      `--prefer-offline` skips revalidation on a warm cache and falls back to the
      network on a miss.
      13 workflows already pass the first two; 10 still carry at least one bare
      `run: npm ci`, including all six in `tests.yml` (`:94`, `:125`, `:214`,
      `:263`, `:374`, `:409`). `--prefer-offline` appears zero times anywhere, while
      `setup-node` already populates the npm cache.
      <!-- verify: grep -rnE 'npm ci\s*$' .github/workflows/ | grep -v prefer-offline -->

## Phase 2 — The build fan-out: stop rebuilding the same 6 targets 13 times

- [x] **2.1 Record the per-build cost before changing anything.** Add the
      `npm run build --silent` step duration for `node-tests`, `static-checks`,
      `golden-tests`, `workspace-tests` to the Phase 0.4 table, from a CI run.
      Without that row the fan-out saving is asserted, not measured.
      **Measured: 5–10 s in every one of the 13 jobs that run it**, across three
      successful main runs. Full step breakdown of the slowest job in the matrix
      (`node-tests` ubuntu shard 3/4): set-up 1 s · checkout 4 s · setup-node
      6 s · `npm ci` 6 s · discovery manifest 1 s · **build 8 s** · **Vitest
      594 s**. The build is ~1.3 % of the job. Recorded in
      `docs/contracts/ci-cost-budget.md`. This gate did its job: the number
      falsifies 2.2-2.4 below.
      <!-- verify: grep -c 'npm run build --silent' .github/workflows/tests.yml -->
- [-] **2.2 Build once, share the artefact.**
      **Cancelled by 2.1's measurement — this phase's own gate, working as
      designed.** The build is **8 s** and runs in parallel across 13 jobs, so it
      contributes ~8 s to critical path. A producer/consumer split adds a serial
      producer job (checkout + setup-node + `npm ci` + build ≈ 25 s) that every
      consumer waits on, plus upload and download on each side, and converts a
      parallel 8 s into a serial ~35 s. It makes CI **slower**. Consumers still
      need their own `npm ci`, so that cost does not disappear either.
      AI council 2/2 (2026-08-11, anthropic + openai) converged on cancel, and
      added the argument that decides the one benefit the cost case misses:
      **the "one canonical `dist/`" gain already exists.** The drift gate runs in
      every building job today and is green, so the 13 builds are already
      byte-identical — building once would buy no consistency that the status quo
      lacks, and would *lose* the cross-platform property that the build produces
      correct output on macOS as well as ubuntu.
      **Revisit-if:** the build step exceeds producer-job overhead by ~3× — i.e.
      a build above ~75 s while producer overhead stays near 25 s — AND artifact
      transfer stays under ~5 s. Note the council's caveat: a 10× build-time
      growth is more likely a signal that the tree needs package boundaries than
      an artefact-caching opportunity.
- [-] **2.3 Keep the drift gate on the producer.**
      **Cancelled with 2.2** — it exists only to make a shared artefact safe, and
      there is no shared artefact. The freshness check at `tests.yml:303-312`
      stays exactly where it is, unchanged; nothing in this PR touches it.
- [-] **2.4 Split the build where a consumer needs fewer than six targets.**
      **Cancelled with 2.2.** Splitting targets per consumer optimises a step
      measured at 5–10 s, against a job whose Vitest phase is 594 s. It would add
      a per-job target matrix to maintain — a standing correctness risk, since a
      job given too few targets fails only when a test happens to spawn the
      missing binary — to buy a saving inside the noise band of runner variance.
      `build:cli-delegate` remains the precedent if a future need is measured.
- [x] **2.5 Record the deliberate non-adoption of a remote build cache.** Rejected
      on cost and dependency grounds: a third-party cache service adds an external
      dependency and a spend line. With 2.2 cancelled the case is stronger, not
      weaker — the saving a remote cache would buy is the same 8 s build that the
      in-repo artefact split was just cancelled for being too small to be worth
      serialising. Paying an external vendor for it is the same trade at a worse
      price. **Not** an ADR-088 consequence —
      `ADR-088-no-external-runtime-federation.md` is a category boundary about
      driving external agent runtimes and does not reach build caching. The inbox
      file cited it incorrectly.

## Phase 3 — The subprocess lever: extend in-process running, do not add a skill

- [x] **3.1 Inventory the spawning test files against the adopters.**
      Re-counted live: **207** files touch `spawnSync`/`execSync`/`child_process`
      (the step's 191 has grown), **43** use `run_in_process`. Narrowing to the
      population this phase can act on — files invoking `./scripts-run` or
      `./agent-config`, excluding the suites CI already runs in dedicated jobs
      (`tests/golden/**`, `tests/server/workspace.test.ts`,
      `tests/scripts/cli/python/**`) — gives **66 candidates**, of which only 4
      already adopt the runner and 1 also spawns `git` (a real boundary). So the
      nominal migration set is ~62 files.
      **The inventory's real finding is that this set is not where the time is.**
      A per-file duration pass over 977 files (`--reporter=json`, local; used for
      relative ranking only, never as a CI baseline) totals 1483 s, and the
      distribution is not flat: `tests/scripts/build_proof.test.ts` alone is
      **290 s — 19.5 % of everything, 8.7× the next file** — and it contains
      **zero spawns**. Nothing in the 66-file candidate set appears near the top.
      Top of the ranking after it: `check_no_external_sources` 33.5 s,
      `check_completion_review` 32.3 s, `dispatch_r2_reviewer` 27.6 s,
      `cmd_doctor_anatomy` 25.7 s — all inside the noise of a 130 s shard.
      <!-- verify: grep -rl 'run_in_process' tests/ | wc -l -->
      `tests/_lib/run_in_process.ts` already exports `runInProc` / `runInProcAsync`
      (`:149`, `:48`) and models process exit as a throwable (`ProcessExit`, `:41`).
      Produce the candidate list: files whose spawn is a plain `./scripts-run` or
      `./agent-config` invocation with no real process-boundary assertion.
      <!-- verify: grep -rl 'run_in_process' tests/ | wc -l -->
- [x] **3.2 Fix the file that is actually over budget — a one-file change, not a
      62-file migration.** The step's method (batch-migrate spawns) is aimed at a
      cost 3.1 measured and did not find: the single heaviest file spawns nothing,
      and no candidate ranks near it. Migrating ~62 files would have been a large,
      risky diff buying a saving inside runner variance — the same
      assert-don't-measure trap 2.1's gate caught one phase earlier.
      What the measurement supports instead, and what shipped:
      `tests/scripts/build_proof.test.ts` called `render()` **five** times at
      ~54 s per call. Its own first test asserts `render()` is deterministic —
      which is exactly the property that makes reusing one result sound, and
      which keeps the cache from ever masking a regression. Rendering once at
      module scope and reusing it leaves the determinism test its two independent
      invocations (two calls IS what that test measures) and drops the file from
      ~269 s standalone to **103 s** wall-clock, all 8 tests green.
      The honest residual: 103 s is still two `render()` calls, and `render()`
      itself at 54 s is the next lever — that is production code and out of this
      phase's scope. Recorded in `ci-cost-budget.md`.
      The keep-one-spawning-test-per-entry-point rule the step names is preserved
      as guidance in `docs/development.md` (see 3.3), so a future migration has
      the constraint written down even though no migration happened here.
      <!-- verify: npx vitest run tests/scripts/build_proof.test.ts -->
- [x] **3.3 Document the in-process pattern — in `docs/development.md`, NOT in
      the skill.** A deliberate divergence, on two grounds the step did not have.
      **(1) The skill ships to consumers; the library does not.**
      `tests/_lib/run_in_process.ts` exists only in this repo. Telling a consumer's
      agent to import it would cite a file absent from their tree — the same
      names-something-that-does-not-exist defect Phase 0 spent its whole budget
      repairing. **(2) Adding a second stack to that skill is not free, and the
      cost is invisible from the step's wording.** `lint_framework_leakage`
      exempts a file via `has_framework_frontmatter()`, and
      `test-performance` carries `framework: laravel`. The skill schema says
      multi-stack skills MUST omit that key — so making it multi-stack means
      deleting its exemption, which newly exposes ~16 lines of existing
      `php artisan` / `RefreshDatabase` / seeder prose to a CI-blocking gate.
      That is a skill-wide neutralisation refactor, not a documentation step.
      What shipped instead: a `docs/development.md` § Testing subsection with the
      `runInProc` / `runInProcAsync` / `ProcessExit` surface, `RunOpts`, the
      ~350 ms per-spawn cost, the count-based sharding that turns a spawn cluster
      into one slow shard, the keep-one-spawning-test-per-entry-point rule, and
      the module-level-state limitation. The same edit repaired a drift cluster
      found in place: six of the seven documented `task test-*` targets
      (`test-python`, `test-linter`, `test-readme-linter`, `test-runtime`,
      `test-tools`, `test-runtime-all`) **do not exist**, and the "CI test matrix"
      table described a Python 3.10–3.13 sweep that no workflow has run since the
      py2ts move. No new skill: the estate is 116
      rules / 289 skills and this is the subject that skill already owns. Note
      honestly that the skill is currently single-stack — its whole "Optimization
      strategies" section (`:68-147`) is database / migration / seeder work. Adding
      the node-vitest subprocess-vs-in-process axis gives it a second stack peer,
      which also moves it toward the multi-stack shape
      `framework-neutrality-in-generic-skills` asks of a generically named artefact.
- [ ] **3.4 Retire the `heavy-tests` framing if the clumping cause is gone.**
      **Stays OPEN, not deferred — its decision input does not exist yet, and
      cannot until this PR lands.** `[ ]` rather than `[~]` on purpose: this is
      real work with a firing condition, so it belongs in the open count and on
      the dashboard. Marking it `[~]` would drive `count_open` to 0 beside the
      two maintainer-gated deferrals and fire Iron Law 3 — a repo-wide archive
      refusal only the user can clear — for a step that is simply waiting on a
      CI run. The step is explicit that the call is "decidable from the shard
      durations in the Phase 0.4 table, not from a guess", and that table now
      holds *pre-fix* durations: 645 s / 852 s for shard 3/4, measured before
      3.2 removed ~157 s from the heaviest file in it. Whether golden-tests and
      workspace-tests can fold back into the shard matrix depends on the
      *post-fix* shard-3 figure, which only a CI run on merged code produces.
      Two corrections to the step's own framing, both from 3.1's measurement:
      the `heavy-tests` name was already repaired by 1.5 (the comment at
      `tests.yml:238` now states no such job ever existed), and the premise
      "if 3.2 removes enough spawns" cannot fire as written — 3.2 removed no
      spawns, because spawns were not the cost.
      **Resume when:** shard 3/4 has a post-merge duration on `main`. If it lands
      under the 300 s ceiling, re-open the fold-back question; if it does not,
      the next lever is `render()` at 54 s a call, not the job layout.
      <!-- verify: grep -n 'hash-clump' .github/workflows/tests.yml -->
      `golden-tests` and `workspace-tests` exist as dedicated runners because
      subprocess-heavy files hash-clump into one over-budget vitest shard
      (`tests.yml:349-357`, `:387-392`). If 3.2 removes enough spawns that the clump
      disappears, both fold back into the shard matrix — decidable from the shard
      durations in the Phase 0.4 table, not from a guess.
      <!-- verify: grep -n 'hash-clump' .github/workflows/tests.yml -->

## Phase 4 — Required-check-set changes (authored here, applied by the maintainer)

- [x] **4.1 Draft the ADR for any required-check demotion, after 0.4 has numbers.**
      **Landed as ADR-223, not 222 — the number in this step was already taken.**
      `ADR-222-blocker-handover-at-reply-close.md` merged from a parallel branch
      after this roadmap was written, so "next free number is 222" was stale by
      the time it was read. Next free is 223; index regenerated with
      `regenerate_index --dir docs/decisions` (its default `--dir docs/adr` does
      not exist in this repo and exits with `adr-dir not found`).
      **The ADR's content is also not what the step assumed.** It expected to
      record a demotion; the measurement supports none, and the record says so
      with the evidence: the required set has exactly **one** member
      (`Sync + Generate Tools Consistency`), so neither the macOS legs nor the
      `npm audit` gate is *in* it and there is nothing to demote — removing them
      would be a trigger change. The audit gate is a step inside a 131 s job and
      the identical command already runs in `release-validation.yml:370`. And
      demoting the macOS leg would drop the 852 s job while leaving its 645 s
      ubuntu twin over the ceiling, hiding the breach rather than fixing it.
      The ADR names the missing evidence a real demotion needs — per-OS failure
      attribution, which nothing in the tree records — as its `review_trigger`.
      **The blocker below still said 222 on both of its clauses; the number is
      corrected to 223 on 2026-08-13, and nothing else about it changes.**
      A first attempt at this correction, on the same day, went further and was
      **wrong** — recorded here rather than quietly reverted, because the shape of
      the error is the useful part. It dropped the "ADR is accepted" leg from the
      resolution clause, arguing that a reader checking *"ADR-222 is accepted"*
      would get a **true** answer from the unrelated merged document and could
      close this blocker without the ruleset edit. That argument fails on a fact
      neither the roadmap nor the first correction checked: **`ADR-222` is itself
      `status: proposed`** (`docs/decisions/ADR-222-blocker-handover-at-reply-close.md:3`),
      so the mis-numbered leg evaluated **false**, not true. Being merged is not
      being accepted, and the whole hazard was invented.
      The second half of that attempt was wrong the same way: it called ADR-223
      "an accepted record that no demotion is supportable". `ADR-223:3` is
      `status: proposed` and its own § Status reads *"Acceptance is the
      maintainer's call."* The original wording — *"a proposal, not an enforcement
      change"* — was, apart from the number, exactly what the ADR says about
      itself. So the acceptance leg stands, renumbered: it tracks a maintainer
      decision the ADR explicitly reserves, and removing it would have left
      nothing in this roadmap watching for it.
      <!-- verify: grep -n '^status:' docs/decisions/ADR-223-no-required-check-demotion-on-cost-grounds.md docs/decisions/ADR-222-blocker-handover-at-reply-close.md  # both: proposed -->
      <!-- verify: ls docs/decisions/ | grep ADR-223 -->
      <!-- verify: the `## Blockers` section carries no ADR-222 —
           sed -n '/^## Blockers/,$p' agents/roadmaps/road-to-inbox-harvest-2026-08-b-ci-economy.md | grep -c 'ADR-222'  # expect 0.
           Step 4.1 itself mentions ADR-222 several times on purpose: it is the
           document that took the number, and naming it is the whole explanation. -->
- [~] **4.2 Demote the macOS leg and/or the `npm audit` PR gate.** Deferred behind
      `blocker: required-check-set-change`. Touches ruleset `17749383` plus
      `docs/contracts/branch-protection-policy.md`, `ci-green-floor.md` and
      `release-pr-gating.md` in the same change.
- [~] **4.3 Enable a GitHub merge queue.** Deferred behind
      `blocker: merge-queue-enablement`. `merge_group` appears zero times in
      `.github/`, so nothing in-tree is wired for it either way.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-11 | reviewer: claude/host -->

Reconciled 2026-08-11 against what the phases actually did: rows 1, 3, 4 and 5
anchored mitigations to steps that were cancelled, diverged, or turned out
insufficient. A register that prescribes a mitigation for an abandoned design is
worse than none — it reads as a live control.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Shared build artefact hides per-job drift | implementation | Four independent builds today each re-derive `dist/`; one shared artefact means a drift only the producer would notice. | **Retired — the risk cannot occur.** 2.2-2.4 were cancelled on 2.1's measurement, so there is no shared artefact and each job keeps re-deriving `dist/` behind the unchanged `tests.yml` freshness gate. Re-arm this row only if the revisit threshold in `ci-cost-budget.md` is met. | Phase 2 — The build fan-out |
| 2 | Baseline recorded from too few runs | implementation | A figure from one PR run measures runner variance; a later regression window would then flag noise. | Use the 50-run average the file's own checklist specifies (`ci-cost-budget.md:90-91`), recorded from CI, never locally (`hook-latency.json:2`). | Phase 0 — Re-anchor the two existing cost artefacts |
| 3 | In-process migration deletes real coverage | implementation | Converting a spawn to an in-process call removes the argv / exit-code / stdio boundary some tests exist to prove. | **Dormant — no migration happened.** 3.1 measured the spawning set as not the cost, so 3.2 converted nothing; the rule (one spawning test per CLI entry point) is written into `docs/development.md` so it binds whenever a migration is actually attempted. | Phase 3 — The subprocess lever |
| 4 | A filter is dead by typo, not by removal | product | Deleting a path-filter entry that was meant to match something narrows a trigger surface silently. | Classify every entry before deleting (1.1, 1.2), each removal citing its absence check. **1.3 shipped STRICT, not report-only** — its escape is an inline `# workflow-path-allow: <reason>` on the entry, which is the pre-staged-filter case and nothing wider; all 20 live entries were hand-classified and repaired first, so the corpus is verified empty rather than unexamined. | Phase 1 — Free hygiene |
| 5 | A concurrency group drops a backstop signal | product | On `push: main`, `rule-backstops.yml` is the only run for that commit; losing it loses the signal entirely. | **Scoping `cancel-in-progress` was NOT sufficient** — GitHub evicts a *pending* group member regardless of that flag, so the first attempt at 1.4 introduced the very loss it was written to prevent. Fixed by the group KEY: non-PR runs are keyed by `github.run_id`, putting each in a group of one. Found by the completion review, not by the author. | Phase 1 — Free hygiene |

## Blockers

### blocker: required-check-set-change
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 4.2 only. Phases 0-3 and step 4.1 are not blocked — they change
  no required check, and ADR-223 is a proposal, not an enforcement change.

- **What to do:** decide whether the macOS leg and the `npm audit` PR gate stay in
  the required set, then apply the ruleset edit. Ruleset `17749383` currently
  requires exactly one check, `Sync + Generate Tools Consistency`
  (`docs/contracts/branch-protection-policy.md:59`); the write path is documented
  at `branch-protection-policy.md:158`.
- **Resolved when:** ADR-223 is accepted and the ruleset's
  `required_status_checks` list matches the matrix in
  `branch-protection-policy.md`, with `ci-green-floor.md` and
  `release-pr-gating.md` updated in the same change. (Number corrected 222→223
  on 2026-08-13; the acceptance leg stands — see 4.1.)

- **Partially discharged 2026-08-14 (continuation sweep).** The blocker has two
  legs and only one of them was ever a decision.

  **Leg 1 — ADR acceptance: DONE.** ADR-223 is `accepted` as of 2026-08-14
  under the maintainer's blanket grant, which names this blocker explicitly.
  Note what that acceptance does *not* authorise: ADR-223's own decision is
  **not to demote**, so accepting it settles the demotion question by closing
  it, and licenses no ruleset write. The macOS leg and the `npm audit` gate were
  never in the required set to begin with (ADR-223 § Context fact 1) — removing
  them from a PR would be a *trigger* change, not a required-check change.

  **Leg 2 — the ruleset write: HANDED BACK, deliberately.** Arming or enlarging
  a required-check set changes the merge requirements for every future merge,
  including the maintainer's own. That is an infrastructure/permission change
  and a `non-destructive-by-default` Hard Floor trigger, which no category-level
  grant lifts — the Hard Floor requires a this-turn approval naming the exact
  object, and "all repo-admin blockers are approved" names a category. The
  maintainer's own grant asked for the procedure to be written out rather than
  performed, so it is:

  ~~~bash
  # 0. Preconditions: gh authenticated with repo-admin scope on event4u-app/agent-config.
  #    Verify:  gh api repos/event4u-app/agent-config --jq .permissions.admin   # -> true

  # 1. Capture the BEFORE artefact. Do not skip — it is the rollback.
  gh api repos/event4u-app/agent-config/rulesets/17749383 > ruleset-before.json

  # 2. Copy it and edit the required_status_checks array in the copy.
  cp ruleset-before.json ruleset-after.json
  #    Add, per branch-protection-policy.md:163 (each already runs and passes
  #    on every feature PR — enlarging, not shrinking):
  #      Smoke — kernel · Smoke — router · Smoke — schema · Smoke — skills
  #      Static Checks (ESLint · typecheck · prepack) · skill-lint · Rule backstops
  #    Keep the existing entry: Sync + Generate Tools Consistency

  # 3. Write.
  gh api -X PUT repos/event4u-app/agent-config/rulesets/17749383 --input ruleset-after.json

  # 4. Verify, then keep the diff as the evidence artefact.
  gh api repos/event4u-app/agent-config/rulesets/17749383 > ruleset-verify.json
  diff <(jq -S . ruleset-before.json) <(jq -S . ruleset-verify.json)

  # Rollback: gh api -X PUT .../rulesets/17749383 --input ruleset-before.json
  ~~~

  Browser path, if the CLI is not to hand: **github.com/event4u-app/agent-config
  → Settings → Rules → Rulesets → the ruleset with id `17749383` → Branch
  protections → "Require status checks to pass" → Add checks →** add the seven
  names above → **Save changes**.

  **One trap, recorded because it fails silently and permanently.** Do not add a
  path filter to the PR trigger of any check you make required. A required check
  whose trigger is path-filtered never reports on a PR touching none of those
  paths, and GitHub treats never-reported as never-satisfied — the PR blocks
  forever with no red X to explain it. This is the same trap
  `road-to-skill-ecosystem-gate-integrity` Phase 5 Step 3 records against
  `branch-protection-policy.md`.

  **Second trap, from the sibling roadmap.** `road-to-maintainer-bus-factor`
  Risk 3 records that nothing in CI observes whether the armed required-check
  set still matches `branch-protection-policy.md`. Arm it *against that file*
  and update the file in the same change, or the two drift apart with no gate
  to notice.


### blocker: merge-queue-enablement
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 4.3 only. Nothing else here depends on a merge queue.
- **What to do:** decide whether to enable a GitHub merge queue for `main` — a
  repo-admin setting that cannot be turned on from the tree.
- **Resolved when:** the merge queue is enabled on `main` and at least one workflow
  declares a `merge_group` trigger (currently zero across `.github/`).

- **Decision discharged 2026-08-14 (continuation sweep); the enablement is
  handed back.** The maintainer's blanket grant names `merge-queue-enablement`,
  so the *decision* to enable is taken. The act is not performed here for the
  same reason as its sibling above: a merge queue changes how every future merge
  to `main` lands, which is a Hard-Floor infrastructure change under
  `non-destructive-by-default`, and a category grant does not name that object.

  **The ordering matters and is the part worth writing down.** These two steps
  must not be done in the order they are listed, because the obvious order
  breaks `main`:

  1. **First, in the tree** (agent-executable, and *not* yet done — see the note
     at the end): add `merge_group:` to the trigger block of every workflow that
     is, or is about to become, a required check. A required check with no
     `merge_group` trigger never reports inside the queue, and the queue treats
     never-reported as never-satisfied — the identical permanent-block failure
     the path-filter trap produces on PRs. Currently **zero** workflows across
     `.github/` declare it.
  2. **Then, and only then**, enable the queue:
     **github.com/event4u-app/agent-config → Settings → Rules → Rulesets →
     ruleset `17749383` → Branch protections → "Require merge queue" → enable →
     Save changes.** Leave the default merge method and group size unless a
     measured reason exists; the CI-economy measurements in this roadmap say
     nothing about queue batching.

  Enabling the queue before step 1 lands is the failure mode: every PR enters
  the queue, no required check reports there, and nothing merges until the queue
  is disabled again.

  **Step 1 is agent-executable and is deliberately NOT done in this sweep.**
  Adding a `merge_group` trigger to a workflow that is not yet queue-gated is
  inert, so it is safe in isolation — but this repo gates workflow edits, and a
  workflow change riding a 26-roadmap sweep branch is the blast-radius mixing
  `scope-control` refuses. It belongs in the same small PR as the enablement,
  authored by whoever performs step 2.

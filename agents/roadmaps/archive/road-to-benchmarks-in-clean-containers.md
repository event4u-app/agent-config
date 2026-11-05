---
complexity: standard
review_by: 2026-12-20
tree_pin: 84ec63c93d
estate_growth_exempt: "Owner-invoked /roadmap:process-full on 2026-11-05 runs this roadmap to completion and archives it in the same PR, so the active estate is back at its origin/main floor once it lands."
---

# Road to benchmarks in clean containers

> Created 2026-11-05 from the owner chat after the post-repair rerun (#2854,
> #2856): "run the comparisons in clean images, once with and once without
> agent-config, so we have real comparisons". Analysed against the tree, a web
> research pass on Claude Code auth and config loading, and an AI-council round
> (anthropic + openai, 2026-11-05; split on containers vs. a throwaway home,
> converged on credential-only auth, an A/A control and a sweep brake).
> **Owner budget for the paid validation (answered 2026-11-05):** $30 at list
> rates, subscription-authed, enforced per sweep with `--max-usd`.

## Why

The ab-v2 arms are separated by CLI flags and by where a clone sits on disk.
Measured in the last sweep and in the tree:

1. **`package` is not "agent-config only".** It runs without
   `--setting-sources`, so it loads the operator's whole user scope: every other
   plugin, the user `CLAUDE.md`, user hooks, personal skills. The comparison was
   "agent-config plus the operator's setup" against "nothing".
2. **The arms differ in more than the package.** `vanilla` passes
   `--setting-sources project,local`, `package` passes none.
3. **The package reached the run by accident.** Its rules arrive through
   ancestor-directory loading, which clones under the OS temp dir never had
   (16 of 24 pairs collapsed until the rules were copied above the clones).
4. **CLI, Node and PHP are whatever the operator's Mac has that day**, and the
   reports do not record them, so no run can be reproduced.
5. **37 of 204 runs hit the subscription limit** and only an after-the-fact
   exclusion kept them out of the statistics; nothing stopped the sweep.
6. **The raw reports lived in a worktree** and were deleted with it.

## Decisions

- **One container per trial, from pinned images.** Council split here:
  openai held that a throwaway `HOME` suffices; anthropic that only an image
  pins the CLI and toolchain and confines writes. Decided for the container
  (implementer's call): a throwaway home still runs the host's CLI, Node and
  PHP, which is failure 4 unchanged. revisit-if: container start-up dominates
  wall time or the host-vs-container control (4.2) shows a difference the
  image cannot explain.
- **Credential only, never the profile.** The macOS login lives in the Keychain
  and cannot be copied; the profile is exactly the contamination of failure 1.
  The owner creates a one-year subscription token once with `claude setup-token`
  (the documented path for scripts); the runner passes it as
  `CLAUDE_CODE_OAUTH_TOKEN` by name, never on an argv, and drops
  `ANTHROPIC_API_KEY`, which would otherwise silently take precedence over the
  subscription. `--bare` is out: it accepts an API key only.
- **The with/without difference is the image, nothing else.** Both arms run with
  identical CLI flags. `bench-base` carries the CLI and the fixture toolchain;
  `bench-ac` is `bench-base` plus agent-config installed by its public
  installer (`init --tools=claude-code`) from a tarball of the commit under
  test. The install happens at image build, never per trial, and its file diff
  is recorded.
- **Positive proof of what loaded.** The `system/init` event lists loaded
  plugins and skills. A with-arm trial that shows no package skill, or a
  without-arm trial that shows any, is excluded before scoring and counted.
- **No automatic account switching.** A sweep runs on one account (`--account`,
  default the first configured token). When that account hits its limit, the brake
  stops the sweep and names the other accounts that have a token; the operator
  resumes on one, and the checkpoint carries over. The owner's line (2026-11-05):
  stay inside the legal frame, offer the switch, never make it.
- **Scoring stays on the host.** The scorer is deterministic and calls no
  model; the council's suggestion to containerise it rested on a scorer that
  judges with a model, which this one does not.
- **Rule-injection arms stay as they are on the host path** until a container
  sweep needs them; this roadmap moves `vanilla` and `package`.

## Phase 1 — Images

- [x] **1.1 `bench-base`.** `internal/bench/containers/Dockerfile.base`: Node 22 <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      base pinned by digest, the CLI pinned to an exact npm version, `git` and
      `php-cli` for the one composer fixture, a non-root user, an empty home,
      `DISABLE_AUTOUPDATER=1` and `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`.
      verify: `docker run --rm bench-base claude --version` prints the pinned version.
- [x] **1.2 `bench-ac`.** `Dockerfile.ac` from `bench-base`: installs the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      packed tarball of the tree under test with the public installer, then
      records the installed file list under `/opt/bench/install-manifest.txt`.
      verify: the manifest lists the package's rules and skills under the user scope and nothing outside the home directory.
- [x] **1.3 Build script.** `src/scripts/bench_ab_images.ts`: packs the tree, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      builds both images, prints and writes their digests, CLI version and
      package version to `internal/bench/containers/images.json` (gitignored,
      read by the runner).
      verify: `npx vitest run tests/scripts/bench_ab_images.test.ts` -> /passed/

## Phase 2 — Runner

- [x] **2.1 Container invocation.** `src/scripts/_lib/bench_ab_container.ts` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      builds the `docker run` argv for one trial: `--rm`, the clone bind-mounted
      as the working directory, a read-only mount for an injected prompt file,
      CPU and memory limits, the token passed by name only, no
      `ANTHROPIC_API_KEY`, then the CLI arguments the host path already builds,
      minus `--setting-sources`.
      verify: `npx vitest run tests/scripts/bench_ab_container.test.ts` -> /passed/ (argv shape, the token never in argv, the key always dropped, identical flags across arms).
- [x] **2.2 `--isolation container` in `bench_ab_v2_run`.** Arms that load the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      package run on `bench-ac`, every other arm on `bench-base`; the report
      records isolation, both image digests, the CLI version and the package
      version. The host path stays the default.
      verify: `npx vitest run tests/scripts/bench_ab_v2_run.test.ts -t "isolation"` -> /passed/
- [x] **2.3 Load proof before scoring.** Each container trial parses <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      `system/init`; a mismatch with the arm's image is recorded as
      `load_mismatch`, excluded from the statistics, and counted in the report.
      verify: `npx vitest run tests/scripts/bench_ab_container.test.ts -t "load"` -> /passed/
- [x] **2.4 Sweep brake.** A run that ends with zero tokens and an error, or <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      with a usage-limit message, is classed `quota_exhausted`; three in a row
      stop the sweep and the report says where. The cost cap stays as is.
      verify: `npx vitest run tests/scripts/bench_ab_v2_run.test.ts -t "brake"` -> /passed/
- [x] **2.5 Reports outside every worktree.** The default report directory <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      resolves through the git common dir to the primary checkout, so removing
      a worktree cannot delete a report again.
      verify: `npx vitest run tests/scripts/bench_ab_v2_run.test.ts -t "report dir"` -> /passed/
- [x] **2.6 Token file.** The runner reads the token from <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      `~/.event4u/agent-config/secrets/claude-oauth-token` (mode 0600) or the
      environment, refuses a world-readable file, and never prints it; the
      transcript writer redacts it.
      verify: `npx vitest run tests/scripts/bench_ab_container.test.ts -t "token"` -> /passed/
- [x] **2.7 Selftest in container mode.** `--mode selftest --isolation container` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      runs green with no network and no token.
      verify: `./scripts-run src/scripts/bench_ab_v2_run --mode selftest --isolation container --arms vanilla,package --limit 2` -> exit 0

## Phase 3 — Documentation

- [x] **3.1 Methodology.** `docs/benchmark.md` gets a section on container <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      isolation: what each image holds, what is identical across arms, what the
      container does not remove (account-side settings, model nondeterminism,
      rate limits), and how to reproduce from `images.json`.
- [x] **3.2 Operator guide.** `internal/bench/containers/README.md`: build the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      images, create the token once, run a sweep, where the reports land.

## Phase 4 — Paid validation ($30, owner budget)

- [x] **4.1 A/A control.** Arms `vanilla` and `vanilla-b` (the same spec under <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      a second name) in `bench-base`, `claude-haiku-4-5`, `trapE-scope-01/02`,
      6 seeds. Expected: no significant difference on either axis, load check
      clean. Rendered by `bench_ab_v2_stats` as `A/A control`.
- [x] **4.2 Container vs. host baseline.** `vanilla-host` (the old host <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      baseline, kept on the host CLI by `host_only`) in the same sweep as 4.1,
      so all three arms pair by task and seed. A significant difference is a
      finding about the host path and is reported, not tuned away.
- [x] **4.3 With vs. without.** `vanilla` against `package` in containers on <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      `claude-haiku-4-5`, 12 seeds, then on `claude-sonnet-4-6` with what is
      left of the $30. Reported as the first container measurement, not as a
      replacement for the published figures.
- [x] **4.4 Write-up.** Results in `docs/benchmark.md`, raw reports kept under <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      the primary checkout, spend against the $30 cap.

---
stability: beta
keep-beta-until: 2027-01-07
keep-beta-reason: >-
  New on 2026-11-07. The selection rules are expected to move once the miss rate
  is observed (a red push to main after a green PR run); the required check went
  live on 2026-11-07 and has no miss history yet.
---

# CI test selection — run what a change can reach, at the merge gate

> **Status:** live since 2026-11-07. The in-repo half shipped in PR #2894;
> `Tests result` was made a required check on ruleset `17749383` by owner
> decision on 2026-11-07 (§ Enabling the gate). A failing test now blocks the
> merge on the PR. The merge queue is **off for good** (owner decision, same day:
> `agents/evidence/owner-directives/2026-11-07-no-merge-queue.md`).

## What it does

`tests.yml` used to run all ~2,490 Vitest files on every pull request and every
merge-queue entry. A new first job, `Select tests`
(`src/scripts/ci_select_tests.ts`), reads the diff and decides which files the
change can reach.

**Since 2026-11-25 the selection governs the macOS legs only.** Every pull
request runs the whole suite on Linux (`node-tests` ×4, `golden-tests`,
`svg-witness-tests`, `workspace-tests`), exactly as `push: main` does. The macOS
legs (`node-tests-macos`, and the macOS rows of golden, svg-witness and
workspace) run the selected files, and only where platform scope keeps macOS.
§ Why Linux is no longer selected has the measurement and the decision.

| Event | Measured against | Runs |
|---|---|---|
| `pull_request` | `origin/<base branch>` (merge base) | Linux: whole suite · macOS: selected files, if platform scope keeps macOS |
| `pull_request` + label `ci:full-tests` | — | whole suite (macOS still subject to platform scope) |
| `merge_group` (merge queue) | `github.event.merge_group.base_sha` | selected files — inert: the queue is off for good since 2026-11-07, so the PR run is the one that gates the merge |
| `push: main` | — | whole suite (post-merge net) |
| `workflow_dispatch` | — | whole suite |

`push: main` stays a full run on purpose. With Linux unselected, a red
`push: main` after a green PR is one of three things, never a Linux selection
miss: a **composition** (two PRs green on their own bases, red together — strict
status checks are off by owner ruling), a **macOS gap** (a macOS-only break on a
PR whose macOS leg was scoped out or selected past it), or a **flake**.

## Why Linux is no longer selected (2026-11-25)

Measured: the `Tests` workflow on `push: main` went red on roughly every second
merge in November. The selection was replayed against the PR diff behind each
red run (graph built on the tree of 2026-11-25): in **15 of 19** failing
suite/merge pairs the suite that failed on main was never selected on its PR.
The misses were tree-wide invariants (a baseline equal to the live tree total, a
generated table in sync with the tree census, byte ceilings on globbed files,
citations resolved against `git ls-files`) and suites reached through subprocess
or data paths the static graph does not follow. Adding edges one miss at a time
was rejected: the next unknown path breaks main again.

A 10-agent arena (4 advocates, 5 independent judges, 1 synthesis) chose full
Linux on every PR, macOS selected and platform-scoped: 4 of 5 judges named it,
none picked full parity (cost: macOS on every PR against a 5-job cap) or more
selection heuristics (durability). Linux runner time is free on this public
repository; the binding cost is wall-clock, about 9-12 min per PR.

What it still leaves open: compositions (above), macOS-only breaks, and new
flakes on either OS — an Ubuntu flake now blocks the PR instead of main.

## How a file is selected

The selector builds a dependency graph over the tracked tree (≈2 s, no network,
no `npm ci`):

1. **Imports** — static and dynamic `import`, `export … from`, `require`.
2. **Named paths in tests and shell scripts** — string literals, the literal
   segments of `path.join(...)` / `path.resolve(...)`, and `src/…`-shaped runs.
   This is how the ~750 suites that run their subject as a **subprocess**
   (`spawnSync(tsx, [path.join(ROOT, 'src', 'scripts', 'x.ts')])`) are reached;
   no import graph sees them, which is why Vitest's own `--changed` is not used.
3. **Named data files in module source** — a module that names
   `src/config/x.yml` reads it. A module that names another *code* file is
   treated as data (a list of script names, a bundle integrity check), not as
   a dependency.
4. **Build outputs** — `dist/…`, `./agent-config` and `scripts-run` map back to
   the sources that produce them (`DIST_SOURCES`).
5. **The bash dispatcher as a router** — `src/scripts/_dispatch.bash` is parsed
   into `command → function body (+ helpers)`. A suite that spawns the CLI
   depends on the CLI shell (`src/cli/**`, the dispatcher's shared code) and on
   the commands it names (`'doctor'`, `'settings:get'`), not on all ~110.
   Golden replay suites get every command, because their scenarios live in data.

Three deliberate limits keep the graph from collapsing into "everything":

- **Directory edges go one hop.** A change inside a directory selects suites
  that name that directory. If the change is a *data* file, suites that use a
  module naming the directory are selected too. Nothing propagates further:
  most directory names in source are paths into the project the tool runs
  against, not into this repository.
- **Spawn edges stop at the CLI shell.** `src/cli/main.ts` imports every native
  command eagerly, so any module those commands load would otherwise reach
  every CLI suite. A change that enters the shell from below does not select
  suites that merely spawn the CLI. Whether the shell still *loads* is answered
  by the typecheck in `Static Checks`, which always runs on code changes.
- **Comments are stripped** before tokens are read.

### When the whole suite runs instead

- the diff cannot be read, or is empty;
- a global trigger changed: `package.json`, `package-lock.json`,
  `vitest.config.ts`, `vite.config.ts`, `tsconfig*.json`, `tests/_lib/**`,
  `.github/workflows/tests.yml`, `.nvmrc`, or the selector itself;
- more than 60 % of the suite is reached anyway (`FULL_RUN_SHARE`).

### Area fallback

A changed source file under `src/` that no suite reaches selects suites named
after it (`foo.ts` → `foo*.test.ts`), then suites in a same-named directory.
Whatever is still unreached is listed in the job summary as *changed sources
no test reaches* — a coverage gap, not a selection error.

### Routing to jobs

| Output | Job |
|---|---|
| `node_files`, `node_shards` (1, 2 or 4 shards by count) | `Node Tests` matrix |
| `golden` | `Golden Tests` |
| `workspace` | `Workspace Tests` |
| `browser` | `SVG Witness Tests` |
| `code` (the former trigger `paths:` list) | `Install Script Tests`, `Install Aux Tests`, `Static Checks`, `Collector Lifecycle` |

Every job still ends in the single aggregate `Tests result`. A skipped job
counts as passed there; a failed `Select tests` fails it.

## Measured

Replayed over the last 40 first-parent merges on `main` (2026-11-06):

| | |
|---|---|
| full runs | 1 of 40 (`tests/_lib/` changed) |
| targeted runs | 39 of 40 |
| files selected, median | 333 of 2,491 (13 %) |
| files selected, mean of targeted runs | ≈ 513 (21 %) |
| node shards | 4 in 35 runs, 2 in 5 |

The high end (1,000–1,340 files) comes from genuinely central modules —
`src/scripts/_lib/agent_settings.ts`, `src/config/agent-settings.template.yml`,
the hook dispatcher — that most of the suite imports. Shard *count* stays at 4
for most runs, so the saving shows up as shorter shards, not fewer runners; the
per-shard setup (checkout, `npm ci`, `npm run build`) is unchanged.

**Measured 2026-11-25:** the miss rate — 15 of 19 red-main suite/merge pairs
were never selected on the PR (§ Why Linux is no longer selected). That is why
selection no longer gates Linux.

## Cost changes besides selection

- The `pull_request` trigger lost its `paths:` filter, because a required check
  must report on every PR (`branch-protection-policy.md` § The path-filter
  trap). The same list now runs inside `Select tests` as `code`, so a
  docs-only PR costs one small job (same shape as `Platform scope`) instead
  of none.
- A roadmap- or doc-only PR can now select suites that read those files (for
  example the ~140 suites reading `agents/roadmaps/`). Before, the trigger
  filter skipped them on the PR **and** on `push: main`, so a break there
  surfaced only on the next code PR.
- Every Vitest/install job now waits for `Select tests` (checkout with full
  history + the ≈2 s selection; not yet timed in CI).
- Check names changed: `Node Tests (<os>, shard N/<1|2|4>)` instead of
  `… shard N/4`. Pin `Tests result`, never a shard name.

## Enabling the gate (repository admin — done 2026-11-07, without the queue)

The goal — a change lands on `main` only if its tests pass — was planned as three
settings on ruleset `17749383`. They are owner decisions. The owner took 1 and 2,
and accepted with 2 that macOS failures block merges (`Tests result` aggregates
the macOS legs — a departure from the council decision of 2026-07-12 recorded in
`docs/maintainers/branch-protection.md`). Step 3 was applied, broke every merge
for about four hours, and was removed; the owner decided it stays out for good.
What that gives up: the PR run is judged against the base the PR last saw, not
against the merged result, and `push: main` is the net for the difference. The
live values are in `branch-protection-policy.md`.

1. **Require a pull request for every change to `main`.** GitHub cannot run a
   workflow on a direct push *before* the push lands, so "block a commit like a
   PR" is only possible by not accepting direct pushes at all. Keep admin
   bypass only if you accept that it skips this gate.
2. **Add `Tests result` to the required status checks.** It is the one stable
   name over the whole matrix; it reports on every PR now that the trigger has
   no path filter.
3. ~~**Enable the merge queue.**~~ **Off for good** (owner decision 2026-11-07,
   `agents/evidence/owner-directives/2026-11-07-no-merge-queue.md` — do not
   re-enable or propose).
   Tried that day: every queue entry failed `Standing payload delta + budget
   gate`, whose merge-base step had no base on `merge_group` (fixed since,
   `tests/scripts/standing_payload_delta_resolve_base.test.ts`). The
   `merge_group` triggers in `tests.yml`, `consistency.yml`,
   `standing-payload-delta.yml` and `commit-subjects.yml` stay and are inert.

Live state, read back 2026-11-07 after the owner removed the queue: step 1
predates this contract (the ruleset's `pull_request` rule); `Tests result` is the
fourth required check; no `merge_queue` rule.

Re-check with `gh api repos/event4u-app/agent-config/rulesets/17749383`; on any
change, update the live-state table in `branch-protection-policy.md` from that JSON.

## Revisit if

- a red `push: main` is a composition twice within 30 days → bring the counts to
  the strict-status-checks waiver decision (expires 2026-12-09);
- a red `push: main` is a deterministic macOS-only break → reopen the macOS
  tier decision (council 2026-10-22, decision A);
- median PR wall-clock for `Tests` exceeds 15 min over two weeks → move the
  Linux leg to six shards before reconsidering selection on Linux;

- `push: main` goes red after a green PR run for a reason selection should
  have caught → add the missing edge kind, with a test in
  `tests/scripts/ci_select_tests.test.ts`;
- the median selection stays above ~30 % of the suite → the next step is
  per-file runtime coverage (which source files each test actually executes,
  including subprocesses via `NODE_V8_COVERAGE`), not more static heuristics.

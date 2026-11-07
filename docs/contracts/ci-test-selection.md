---
stability: beta
keep-beta-until: 2027-01-07
keep-beta-reason: >-
  New on 2026-11-07. The selection rules are expected to move once the miss rate
  is observed (a red push to main after a green queue run); the merge queue and
  the required check went live on 2026-11-07 and have no queue history yet.
---

# CI test selection — run what a change can reach, at the merge gate

> **Status:** live since 2026-11-07. The in-repo half shipped in PR #2894; the
> repository-admin half — `Tests result` required and the merge queue on — was
> applied to ruleset `17749383` by owner decision on 2026-11-07 (§ Enabling the
> gate). A failing test now blocks the merge on the PR and on the queue entry.

## What it does

`tests.yml` used to run all ~2,490 Vitest files on every pull request and every
merge-queue entry. A new first job, `Select tests`
(`src/scripts/ci_select_tests.ts`), reads the diff and decides which files the
change can reach. Every Vitest job then runs only those files, or is skipped.

| Event | Measured against | Runs |
|---|---|---|
| `pull_request` | `origin/<base branch>` (merge base) | selected files |
| `pull_request` + label `ci:full-tests` | — | whole suite |
| `merge_group` (merge queue) | `github.event.merge_group.base_sha` | selected files — this is the run that gates the merge |
| `push: main` | — | whole suite (post-merge net) |
| `workflow_dispatch` | — | whole suite |

`push: main` stays a full run on purpose: it is the instrument that catches what
selection missed. A red `push: main` run after a green queue run is a selection
miss and is a defect of this script, not flakiness to re-run.

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

**Not measured:** the miss rate. It is observable only as `push: main` going
red after a green queue run; count those before tightening anything further.

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

## Enabling the gate (repository admin — done 2026-11-07)

The goal — a change lands on `main` only if its tests pass, checked on the
merged result — needs three settings on ruleset `17749383`. They are owner
decisions; the owner took all three, and accepted with them that macOS failures
block merges (`Tests result` aggregates the macOS legs — a departure from the
council decision of 2026-07-12 recorded in `docs/maintainers/branch-protection.md`).
The live values are in `branch-protection-policy.md`.

1. **Require a pull request for every change to `main`.** GitHub cannot run a
   workflow on a direct push *before* the push lands, so "block a commit like a
   PR" is only possible by not accepting direct pushes at all. Keep admin
   bypass only if you accept that it skips this gate.
2. **Add `Tests result` to the required status checks.** It is the one stable
   name over the whole matrix; it reports on every PR now that the trigger has
   no path filter.
3. **Enable the merge queue** (merge method as today; "only merge non-failing
   pull requests"). The queue builds the PR on top of the current `main`, fires
   `merge_group`, `Select tests` diffs against the queue's base SHA, and the PR
   lands only if `Tests result` is green. Every workflow carrying a required
   check declares `merge_group` — `tests.yml`, `consistency.yml`,
   `standing-payload-delta.yml` and `commit-subjects.yml` — which the queue
   needs: a required check that never reports on the queue entry blocks `main`
   with no failure to read. `tests/scripts/workflow_merge_group_concurrency.test.ts`
   pins the four.

Live state, read back 2026-11-07: step 1 predates this contract (the ruleset's
`pull_request` rule); steps 2 and 3 were applied that day — `Tests result` is the
fourth required check, and the `merge_queue` rule merges with method `MERGE`,
grouping `ALLGREEN`, with a 90-minute check timeout (the full matrix has run up
to ~43 minutes on `push: main`).

Re-check with `gh api repos/event4u-app/agent-config/rulesets/17749383`; on any
change, update the live-state table in `branch-protection-policy.md` from that JSON.

## Revisit if

- `push: main` goes red after a green queue run for a reason selection should
  have caught → add the missing edge kind, with a test in
  `tests/scripts/ci_select_tests.test.ts`;
- the median selection stays above ~30 % of the suite → the next step is
  per-file runtime coverage (which source files each test actually executes,
  including subprocesses via `NODE_V8_COVERAGE`), not more static heuristics.

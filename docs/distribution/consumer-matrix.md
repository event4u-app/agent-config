# Consumer Matrix — pack-based release E2E

> **Status:** active · **Owner:** maintainer · **Opened:** 2026-07-10
>
> Workflow: [`.github/workflows/consumer-matrix.yml`](../../.github/workflows/consumer-matrix.yml)
> · Runner: [`src/scripts/consumer_matrix.ts`](../../src/scripts/consumer_matrix.ts)
> · Tripwire: [`.github/workflows/release-adjacent-health.yml`](../../.github/workflows/release-adjacent-health.yml)
> · Source roadmap: road-to-proof-under-real-conditions (Phase 1)

The consumer matrix exercises the **published tarball** the way a consumer
does — pack → fresh global install into an isolated prefix → `init` into a
fresh project → `doctor` → `conformance` → MCP stdio handshake →
`hooks:doctor` → projection presence (`validate`) → uninstall — plus an
upgrade leg (last published minor from the registry → packed tarball →
`doctor` stays green) and pre-tag dry-runs of every release-adjacent
workflow.

## Why it exists — the tarball window

Ordinary PRs run source-level matrices; release PRs run shape checks and
(correctly) skip the source matrices per
[`release-pr-gating`](../contracts/release-pr-gating.md). That skip is sound
for the *diff* but blind to the *tarball*: every packaging incident below
entered `main` on an ordinary PR and manifested only at publish time —
exactly the window where nothing pack-based ran. The consumer matrix is the
documented exemption from the release-PR cut surface and runs **on** release
PRs, plus weekly against registry drift.

## Counterfactual map — five historical failures → the leg that catches each

Recorded per the roadmap's acceptance criterion 1. "Leg" names either a
`consumer_matrix.ts` leg or a `consumer-matrix.yml` job.

| # | Historical failure | Caught by |
|---|---|---|
| 1 | Published tarball missing `src/install/` while published code imported it (two minors; `ERR_MODULE_NOT_FOUND` in global installs of `doctor`/`conformance`) | `fresh-install` leg (`--version` + every subsequent CLI leg runs from the tarball) **and** `publish-dry-run` job's `prepack-check.mjs` import-completeness step |
| 2 | `tsx` absent from the published package — hooks and TS commands failed for consumers | `fresh-install` + `hooks` legs (installed binary + `hooks:doctor` run from the isolated prefix, no repo `node_modules` to lean on) |
| 3 | Release workflow failed on missing `go-task` in the CI environment | `publish-dry-run` job replicates the publish path pre-tag; any missing binary in a release-adjacent workflow surfaces on the release PR, not post-tag (see also the runbook note in [`release-pr-gating`](../contracts/release-pr-gating.md)) |
| 4 | npm publish failed on `npm@latest` → npm 12 requiring Node 22 while the job ran Node 20 | `publish-dry-run` job: asserts `publish-npm.yml` pins an npm **major** (fails on `npm@latest`), then installs that exact pin on both Node 20 and 22 and runs the publish steps sans `npm publish` |
| 5 | MCP worker deploy red across five consecutive releases, undetected (worker deps installed, root `tsx` missing) | `mcp-worker-dry-run` job (same pack + `wrangler deploy --dry-run` path, pre-tag, including the root `npm ci`) **and** the daily `release-adjacent-health` tripwire (fails loudly when any watched workflow's last completed run is non-success for > 48h) |

**Rule for future failures:** a release incident with no leg in this table
gets a new leg in the same fix PR — or a recorded reason why it is out of
scope. The table is the audit trail.

## Triggers

| Trigger | What runs | Why |
|---|---|---|
| `pull_request` with `release/*` head | all four jobs | the pre-tag gate — release PRs are the primary trigger |
| weekly cron (Tue 06:00 UTC) | all four jobs | registry/upstream drift between releases — the class the 48h tripwire alone cannot see pre-release |
| `workflow_dispatch` | all four jobs | on-demand verification (e.g. after a packaging change) |
| daily cron 06:30 UTC | `release-adjacent-health` | the > 48h durably-red detector |

## Headless default-scope trap (matrix finding, 2026-07-10)

Building this matrix surfaced a live consumer trap: on a fresh machine,
headless `agent-config init --tools=… --yes` (no `--scope`) picks "project
default for backward compatibility" and then hard-fails with
`--scope=project is reserved for maintainers (ADR-020)` — the bare README
invocation is red in any non-TTY context (CI, scripts), while the TTY path
escapes into the browser wizard. `--scope=auto` honors detection and
completes the documented global-only consumer install (`~/.claude`,
`~/.cursor`, `~/.codeium/windsurf`, `~/.event4u` lockfile). The matrix
therefore runs `init --scope=auto --yes` and pins that behaviour; whether
the backward-compatibility default should flip to `auto` is a product
decision tracked outside this contract (it changes installer behaviour, not
the gate). Two adjacent facts the matrix also pins: standalone `doctor` is
project-manifest-scoped (exit 2 without a project lockfile — expected on a
global-only install; `conformance` embeds `doctor --ci` and is the health
probe the matrix asserts), and consumer uninstall is `uninstall --global`.

## Branch-protection note

Marking the four jobs as **required** checks for `release/*` PRs is a
repository setting (Settings → Branches), not something this repo's files
can enforce. Until flipped, the jobs still run and fail visibly on the
release PR; flipping them to required is the intended end state.

## Local run (carve-out verification)

```bash
npm ci && npm run build
npx tsx src/scripts/consumer_matrix.ts --json           # all legs
npx tsx src/scripts/consumer_matrix.ts --skip-registry  # offline: skips the upgrade leg
```

## See also

- [`release-pr-gating`](../contracts/release-pr-gating.md) — the cut surface
  this matrix is exempt from, and why.
- [`public-install-smoke`](public-install-smoke.md) — OS × Node entrypoint
  matrix (installer correctness); the consumer matrix owns tarball shape +
  runtime surface instead.
- [`release-sizing`](../contracts/release-sizing.md) — names this matrix as
  the floor for every release.

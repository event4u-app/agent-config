---
stability: beta
keep-beta-until: 2026-09-26
keep-beta-reason: >-
  Beta review 2026-09-05. The four STABILITY.md criteria are met, and it is still
  not promotable: a queued admin write will break it. The stub roadmap
  `road-to-main-protection-ruleset-changes.md` lists the seven required-check
  additions this contract recommends and records that the write makes the
  "(the only required one)" annotation false, forcing synchronised edits here.
  Promoting now would price a known, queued edit at a SemVer-major bump. Anchor:
  that stub carries `review_by: 2026-09-25` — a dated review of the exact
  blocker — so 2026-09-26 is the first date on which this review reads an outcome
  instead of restating the wait. Before the window ends: the repo-admin either
  performs the `required_status_checks` write, with §§ 43, 59 and Enforce half
  rewritten in the same change, or records a decision not to.
---

# Branch Protection Policy

> **Status:** active · **Owner:** maintainer (GitHub repository **ruleset**) ·
> **Opened:** 2026-05-26 · **Reconciled against live state:** 2026-08-02
>
> Companion to [`release-pr-gating.md`](release-pr-gating.md) (Phase A) and
> [`ci-cost-budget.md`](ci-cost-budget.md) (Phase C).
>
> **This document describes what is enforced, not what we wish were
> enforced.** The 2026-08-02 reconciliation (roadmap
> `road-to-renewal-foundation`, Phase 1) found the previous version
> documenting a 19-row required-check matrix against a live enforcement of
> **one** check, plus an addendum for workflows that had already been
> deleted. A policy doc that overstates enforcement is worse than no doc:
> it is read as a guarantee. The rule is now: **this file mirrors the
> ruleset; the ruleset is the source of truth.**

## What is actually enforced (live, 2026-08-02)

Enforcement is a repository **ruleset**, not classic branch protection.
`GET /repos/event4u-app/agent-config/branches/main/protection` returns
`404 Branch not protected` — that endpoint is the wrong surface, and any
tooling pointed at it reads "unprotected" for a protected branch.

| Property | Live value |
|---|---|
| Mechanism | Repository ruleset `main protection` (id `17749383`), `enforcement: active` |
| Applies to | `~DEFAULT_BRANCH` (i.e. `main`) |
| Read it | `gh api repos/event4u-app/agent-config/rulesets/17749383` |
| Branch deletion | blocked (`deletion` rule) |
| Force-push | blocked (`non_fast_forward` rule) |
| Merge without PR | blocked (`pull_request` rule) |
| Required approving reviews | **0** |
| Review-thread resolution | required |
| Stale reviews dismissed on push | yes |
| Allowed merge methods | merge · squash · rebase |
| Branch must be up to date | yes (`strict_required_status_checks_policy: true`) |
| **Required status checks** | **exactly one — `Sync + Generate Tools Consistency`** |
| Bypass | repository-admin role, `always` |

Everything else in CI is **advisory at the branch-protection layer**: the
checks run, a red one is visible on the PR, but only
`Sync + Generate Tools Consistency` mechanically blocks the merge button.
The practical gate is therefore maintainer review of the checks tab, plus
the admin bypass being deliberately not used.

## What actually runs on a feature PR

Verified against the checks reported on PR #1108 (2026-08-02). Names are
the **reported check names** — the strings a required-check list must match.

| Workflow | Reported checks |
|---|---|
| `consistency.yml` | `Sync + Generate Tools Consistency` **(the only required one)** |
| `smoke.yml` | `Smoke — kernel` · `Smoke — router` · `Smoke — schema` · `Smoke — skills` |
| `skill-lint.yml` | `skill-lint` (+ `skill-lint-strict`, release-gated) |
| `tests.yml` | `Static Checks (ESLint · typecheck · prepack)` · `Install Script Tests ({ubuntu,macos}-latest, shard N/4)` · `Install Aux Tests ({ubuntu,macos}-latest)` · `Node Tests ({ubuntu,macos}-latest, shard N/4)` · `Golden Tests ({ubuntu,macos}-latest)` · `Workspace Tests ({ubuntu,macos}-latest)` |
| `smoke-public-install.yml` | `{ubuntu,macos,windows}-latest · node {20,22}` · `tarball E2E · node {20,22}` · `npm publish dry-run · node {20,22}` |
| `rule-backstops.yml` | `Rule backstops` |
| `no-python-in-src.yml` | `no-python-in-src` |
| `commit-subjects.yml` | `lint commit subjects` |
| evaluator / originality | `originality-gate` · `gate-dry-run` · `live-advisory` |
| `glama-mcp-smoke.yml` | `glama MCP smoke` |
| `deploy-mcp-worker.yml` | `MCP worker deploy dry-run` |
| `consumer-matrix.yml` | `Plugin bootstrap integrity` · `Packed-artifact evaluation (clean container)` |

Release-shape-gated (report `skipping` on a feature PR):
`Release-PR shape detector` · `CHANGELOG entry exists for head version` ·
`package.json / marketplace.json / pack manifests agree` ·
`Release install E2E (pack → install → upgrade → boot)` ·
`npm audit (runtime deps, high+)` · `Release` · `skill-lint-strict`.

**Note on `npm audit`:** the release-gated *job* of that name skips on
feature PRs, but the same command
(`npm audit --omit=dev --audit-level=high`) also runs as a **step inside
`Static Checks`** on every PR (`tests.yml`). Runtime-dependency auditing is
therefore live on every PR despite the skipping check name — see
[Dependency auditing](#dependency-auditing) below.

## The shape design — intent, and its enforcement status

The per-PR-shape idea stands and is implemented **at the workflow level**:
`tests.yml` and `smoke-public-install.yml` carry
`if: !startsWith(github.head_ref, 'release/')`, so a release PR skips the
heavy matrices while `release-validation.yml` adds its shape jobs. Shape
predicates live in [`release-pr-gating.md`](release-pr-gating.md) and
`src/scripts/check_release_pr_shape.ts`.

What is **not** implemented:

- **No per-shape required-check list exists in the ruleset.** GitHub
  rulesets carry one required-check list per ref condition; a per-PR-shape
  floor would need either separate rulesets per head-branch pattern or a
  single aggregating gate job. Neither exists today.
- **No docs-only shape at the enforcement layer.** `task ci:required-checks`
  does exist (`taskfiles/ci-fast.yml:204` → `src/scripts/print_required_checks.ts`)
  and does classify feature / release / docs-only from the local diff — but it
  is a **pure offline preview**, never a gate. Branch protection has no
  docs-only concept, so the docs-only row is a preview convenience, not a
  floor. That script's own check-name lists were reconciled in the same change
  (they had drifted to the same fiction as this doc, including a
  `Tests / python-tests` entry that cannot exist post-migration); its output
  now marks with `!` the single check that actually blocks a merge.

The non-subtractive principle is unchanged and still true: a PR whose shape
cannot be proved runs the full feature-PR workflow set, because the skip is
an `if:` on the branch name plus a fail-closed shape detector, never an
opt-out.

## Failure mode — the cut never silently lifts

If a release PR's diff exits the allowlist mid-stream:

1. `Release-PR shape detector` exits non-zero.
2. `tests.yml` / `smoke-public-install.yml` still skip on the branch name,
   so the heavy matrix does **not** auto-run.
3. The maintainer narrows the diff, or re-cuts the release PR off a freshly
   bumped branch so the heavy matrix runs.

Because `Release-PR shape detector` is **not** in the ruleset's required
list, step 3 is a maintainer obligation, not a mechanical block. Closing
that gap is the enforce half below.

## Dependency auditing

- **Every PR:** `npm audit --omit=dev --audit-level=high` as a step in
  `Static Checks` (`tests.yml`) — the runtime dependency tree must stay
  free of high/critical advisories. Dev-only advisories do not block.
- **Release PRs:** the same command again as a standalone job in
  `release-validation.yml`.
- **Scheduled:** `.github/dependabot.yml` — weekly `npm` and
  `github-actions` update PRs, which also carry GitHub's security-advisory
  updates for newly-published CVEs (the gap a PR-triggered audit alone
  cannot cover on a quiet week).
- **Publish integrity:** npm OIDC Trusted Publishing + provenance
  (`publish-npm.yml`); secret scanning via the `check_secret_leak` gate.

## Enforce half — maintainer action, not agent-executable

Aligning the ruleset with the checks that actually matter is an **admin API
write on the production trunk**: a Hard-Floor action under
`non-destructive-by-default`, reserved for the maintainer with explicit
this-turn confirmation. It is deliberately NOT agent-executable and is tracked
as an open maintainer blocker in the active roadmap set (slug
`required-check-enforcement`).

The correct endpoint is the **ruleset**, not classic protection:

```bash
# read current state (the verification artifact — record it before and after)
gh api repos/event4u-app/agent-config/rulesets/17749383 > ruleset-before.json

# write: PUT the full ruleset object with an extended required_status_checks
gh api -X PUT repos/event4u-app/agent-config/rulesets/17749383 \
  --input ruleset-after.json
```

Recommended minimum addition when that is executed — checks that prove the
package still installs and behaves, all of which already run and pass on
every feature PR:

`Smoke — kernel` · `Smoke — router` · `Smoke — schema` · `Smoke — skills` ·
`Static Checks (ESLint · typecheck · prepack)` · `skill-lint` ·
`Rule backstops`.

Sharded and OS-matrixed checks (`Node Tests (… shard N/4)`, the
`smoke-public-install` matrix) are deliberately **not** proposed for the
required list: their names encode shard counts and runner labels, so any
matrix change silently breaks a pinned required-check name — the same class
of drift this reconciliation just removed.

## The path-filter trap on a required check

```
A REQUIRED CHECK WITH A PATH FILTER ON ITS PULL-REQUEST TRIGGER
BLOCKS EVERY PR THAT TOUCHES NO FILTERED PATH — PERMANENTLY.
```

Protection here is a **ruleset**, and a ruleset requires a named check to
*report*. GitHub does not treat "the workflow was skipped because no path
matched" as a pass — it treats it as "has not reported", and the PR stays
blocked with no failing check to fix. The pull-request UI shows an
expected-but-missing status; nothing in the run log explains it, because there
is no run.

So: **do not add `paths:` / `paths-ignore:` to the `pull_request` trigger of a
workflow whose job is a required check.** If a check genuinely only applies to
some paths, filter INSIDE the job (an early exit that still reports a
conclusion), never at the trigger.

This is the same class as everything in
[`false-green.md`](../guidelines/agent-infra/false-green.md), inverted: instead
of a check that passes without running, a check that never runs and therefore
never passes. Both come from treating "did not execute" as if it were a verdict.

## Change discipline

Editing this file does **not** change enforcement, and changing the ruleset
does not update this file. When either moves:

1. Re-read `gh api repos/event4u-app/agent-config/rulesets/17749383`.
2. Update the live-state table above from that JSON, not from memory.
3. Re-verify the reported check names against a recent PR
   (`gh pr checks <n>`) — job renames change the strings.

## See also

- [`release-pr-gating.md`](release-pr-gating.md) — shape predicates, cut
  surface, kept surface, fail-closed contract.
- [`ci-cost-budget.md`](ci-cost-budget.md) — measured baseline durations
  per job + review cadence (Phase C).
- `.github/workflows/release-validation.yml` — the release-PR jobs.
- `src/scripts/check_release_pr_shape.ts` — the shape detector.
- [`ADR-113`](../decisions/ADR-113-ci-native-release-label-trigger.md) — the
  CI-native (`release`-label) entry point and the bot-PR-approval finding.

## Removed 2026-08-02 — the `python2ts` addendum

The previous version carried a `python2ts` integration-branch addendum
(base guard, nightly drift comments, a sanctioned direct-push sync
workflow). Every workflow it named — `py2ts-main-sync.yml`,
`py2ts-drift.yml`, `py2ts Base Guard` — has been deleted; the
Python→TypeScript migration completed and `src/` is Python-free (enforced
by `no-python-in-src.yml`). The `python2ts` ref still exists on the remote
but carries no protection of its own (the repository has exactly one
ruleset, covering the default branch). The addendum is removed rather than
kept as historical prose, because a policy file is read as current.

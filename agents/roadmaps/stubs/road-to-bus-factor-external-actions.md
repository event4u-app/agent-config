---
complexity: lightweight
review_by: 2026-09-19
---

# Stub: road to bus-factor external actions

> **Stub — not active work.** Drain-run transfer, 2026-08-20, from
> [`road-to-maintainer-bus-factor.md`](../road-to-maintainer-bus-factor.md).
> Council disposition **B**, outcome state **transferred**, per the framework of
> record in [`agents/evidence/council/drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md) <!-- ref-ignore -->
> (that file lands on `main` with PR #1463; it exists today on
> `origin/drain/council-records`, so the link is a deliberate forward reference).
> Four items were transferred here because each needs a repo secret, a
> repo-admin write, or an external human — none of which repository automation
> can supply. Rule 3 of the framework is categorical for two of them: a
> repo-admin setting and an externally visible action take `B`, never `D`, and
> the parent may not record the action as done.

## Why this stub exists

The parent roadmap reached zero open steps with its central goal **unmet**. That
is the dishonest-100 % case the framework's four outcome states exist to prevent:
the progress dashboard renders a percentage, and a percentage cannot distinguish
"the work was done" from "nobody here could do the work". Splitting the
maintainer-only residue into this stub lets the parent close against an explicit
outcome state of `transferred` rather than an implied `satisfied`.

**The bus factor is still 1.** Nothing in this stub has been achieved. One
account has ever reviewed a merged PR; a second account can merge but has only
self-merged unreviewed. Promoting this stub is what would change that number.

## What moved here — the complete list

1. The Phase-1 **proof-page claim** that PRs pass a dogfooded AI
   adversarial-review + security gate.
2. The Phase-2 **branch-protection asks** — green CI, the Phase-1 self-review
   gate, and CODEOWNERS review on sensitive surfaces.
3. The Phase-3 **runbook cold dry-run** on a no-op release.
4. The Phase-4 **second-reviewer invitation** on a small first surface.

Nothing else moved. The parent keeps everything that was actually built and
verified: the gate workflow and its teeth, `.github/CODEOWNERS`, the CONTRIBUTING
rationale, `docs/release-runbook.md`, `docs/succession.md`, and the corrected
honest-reporting slice.

## Transferred items — verbatim, with producer, probe and baseline

Each item is quoted exactly as it stands in the parent (where it carries `[-]`).

### 1. Proof-page claim for the dogfooded gate

```
- [-] Record it honestly on the proof page: "PRs pass a dogfooded AI
      adversarial-review + security gate; this is a floor, not independent human
      review."
```

- **Producer:** the maintainer, adding the `ANTHROPIC_API_KEY` repo secret (with
  a per-PR budget sign-off) and letting one live review run — steps 1 and 4 of
  `docs/self-review-gate.md` § Arming it.
- **Probe:** `gh secret list` contains `ANTHROPIC_API_KEY`, **and** a
  `self-review-gate` run exists whose `live-advisory` job did **not** take its
  skip path — i.e. it performed a real review (a posted PR review, or an uploaded
  `self-review-findings` artifact).
- **Why the probe is worded that strictly:** "a self-review-gate run exists" is
  already true and would be a false green. The workflow runs on every PR and
  succeeds; its `live-advisory` job succeeds *as a logged no-op* while the secret
  is absent. Only the non-skip path distinguishes a live gate from an inert one.
- **Baseline 2026-08-20:** secret **absent** — `gh secret list` returns exactly
  four secrets (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_WORKER_SUBDOMAIN`, `MCP_SMOKE_TOKEN`). The five most recent
  workflow runs (all `pull_request`, 2026-08-20) each concluded `success` with
  `live-advisory` on the no-op path. Live reviews to date: **0**.

### 2. Branch protection on the sensitive surfaces

```
- [-] Turn on branch protection requiring: green CI, the Phase-1 self-review
      gate, and CODEOWNERS review on the sensitive surfaces — so even the solo
      maintainer merges through the gate, not around it.
```

- **Producer:** a repository administrator performing the admin write documented
  in `docs/contracts/branch-protection-policy.md` § Enforce half —
  `gh api -X PUT repos/event4u-app/agent-config/rulesets/17749383`. That document
  calls this "deliberately NOT agent-executable"; it is a Hard-Floor action on
  the production trunk under `non-destructive-by-default`, and framework Rule 3
  makes it categorically `B`.
- **Probe:** on ruleset `17749383`, all three of
  `require_code_owner_review == true`,
  `required_approving_review_count >= 1`, and a `required_status_checks` set
  strictly larger than the single consistency gate (i.e. it also contains the
  `Self-review gate` check).
- **Baseline 2026-08-20** (read-only `gh api repos/event4u-app/agent-config/rulesets/17749383`):
  ruleset active, `updated_at` 2026-06-16, applying to `~DEFAULT_BRANCH`;
  `require_code_owner_review: false`; `required_approving_review_count: 0`;
  `required_status_checks` = **exactly one** context,
  `Sync + Generate Tools Consistency`. Blocks deletion and non-fast-forward and
  requires a PR; admin role holds `always` bypass. All three probe conditions
  are **false**.
- **Note:** the live state matches the policy document exactly, so the parent's
  risk-register drift row is currently clean. This stub tracks the missing
  enforcement, not a documentation gap.

### 3. Cold dry-run of the release runbook

```
- [-] Dry-run the runbook with the maintainer deliberately following ONLY the
      written steps (no tribal knowledge) on a no-op release; every gap found is
      a runbook fix.
```

- **Producer:** a human who has **not** memorised the runbook, executing only
  its written steps through one no-op release cycle. Explicitly not the runbook's
  author: the parent's risk register states that a runbook read by the person who
  wrote it exercises their memory, not the document.
- **Probe:** a dated cold-dry-run record exists naming the executor and the
  release it walked, and every gap it found has landed as a runbook edit. An
  agent re-reading the document does not satisfy this and must not record it.
- **Baseline 2026-08-20:** **no** cold-dry-run record exists anywhere under
  `agents/evidence/`. `docs/release-runbook.md` (227 lines) exists and its § 7
  static staleness check is the only freshness signal in the tree. Cold dry-runs
  to date: **0**.

### 4. Second-reviewer invitation on a small first surface

```
- [-] Identify the smallest reviewable surfaces a second reviewer could own
      (e.g. docs/claims, a single pack) and invite review there first — a
      realistic on-ramp, not "co-maintain the kernel on day one".
```

- **Producer:** one real non-maintainer human accepting review on a named small
  surface. The *identify* half is already done and stays in the parent —
  `CONTRIBUTING.md` names docs/claims or a single pack as the first surface. Only
  the invitation and its acceptance moved.
- **Probe:** distinct PR reviewers over the trailing 90 days is **> 1**, i.e. at
  least one login that is not the maintainer has reviewed a merged PR. This is
  also the reopen condition the parent's `second-reviewer-availability` blocker
  already carries, so promotion and blocker-reopen fire on one measurement.
- **Baseline 2026-08-20:** distinct reviewers = **1** (`["matze4u"]`) over
  2026-05-22..2026-08-20, measured across 1228 merged PRs in four slices summing
  266+211+297+454 = 1228 to match `search/issues` `total_count` exactly. Distinct
  *mergers* = 2 (`matze4u`, `h3xa2`), but the second only self-merged #765 and
  release #767 unreviewed — that widens who can ship, not who checks, and does
  **not** satisfy this probe.
- **Measure it with** the sliced query in `docs/succession.md`. Do not use an
  unsliced `gh pr list`: the population exceeds its 1000-row cap, and an
  unlimited call reads 30 rows and silently under-reports.

## Promotion

Any item above is promoted independently — this stub is four separate external
dependencies that happen to share a parent, not one unit of work. Promote by
moving the satisfied item back into an active roadmap (or straight to done, with
its probe output as the evidence) and striking it here. When all four are gone,
delete the stub.

## Not governed by the shared promotion criteria

The **Promotion criteria (shared)** in [`README.md`](README.md) — a recruited
customer, a funded security audit, and an ADR lifting a Hard-Floor item — govern
the *org-mode* stubs created by `road-to-employee-product-and-external-proof`.
They do **not** govern this stub, and applying them would be a category error:
nothing here introduces a new product surface or a new attack surface. Three of
the four items are a secret, a settings write, and a person; the fourth is a
human reading a document. Each is gated only by its own probe above.

The one shared property that does carry over: this stub is not active work, and
its presence must never be read as progress toward a bus factor above 1.

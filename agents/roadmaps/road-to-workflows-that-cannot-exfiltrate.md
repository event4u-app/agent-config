---
complexity: lightweight
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "One active roadmap, no blocker. Three workflow-security floors found while analysing an external catalogue whose own repository shipped a credential-exfiltration workflow on 2026-10-10; they ship independently of any free-route decision and would otherwise wait behind one."
estate_offset_exempt: "No active roadmap owns workflow token scope or exfiltration-shaped steps; the nearest, road-to-one-detector-and-the-senders-we-own, governs payload egress from scripts, not CI steps. Archiving an unrelated file to buy the slot would hide the growth."
relates:
  - slug: road-to-free-hands-a-paid-head-checks
    relation: disjoint
    note: "Found in the same analysis; split out so the floors do not wait on the free-route owner decision."
---
# Road to workflows that cannot exfiltrate

> **Source:** `agents/tmp.old/inbox-2026-10-x/` — the same round as
> `road-to-free-hands-a-paid-head-checks`. Re-verified against `origin/main@447f8fd` on
> 2026-10-22. The external catalogue analysed in that round (S1) had a workflow pushed
> directly to its default branch on 2026-10-10 that greps the working tree and
> `git log -p --all` for credential shapes and posts the result over plain HTTP to a bare IP;
> it was removed a day later.

## Goal

A workflow in this repository cannot send repository data or a token to a host nobody
allow-listed, cannot run a mutable remote script while a token sits in its environment, and
starts from a read-only token unless a job asks for more.

## Context — reproduced on this tree

| # | Finding | Evidence |
|---|---|---|
| W1 | **8 of 36 workflows declare no top-level `permissions:`** and therefore inherit the repository default token scope: `consistency.yml`, `consumer-matrix.yml`, `proof-demo.yml`, `release-guard.yml`, `release-validation.yml`, `site.yml`, `smoke-public-install.yml`, `smoke.yml`. | `grep -L '^permissions:' .github/workflows/*.yml` |
| W2 | `consistency.yml` runs `bash <(curl -fsSL …/actionlint/main/scripts/download-actionlint.bash)` — a script from a **mutable branch** — in a step whose `env` carries `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. | `.github/workflows/consistency.yml`, actionlint step |
| W3 | The supplied plan reports that `lint_workflow_security --strict` passes S1's exfiltration workflow (pinned copy) with 0 HIGH, 1 MEDIUM, exit 0. **Not reproduced here:** building the fixture is itself an exfiltration-shaped artefact and was refused by the session's safety classifier, so the claim stays `unverifiable` until Step 2.1 builds a neutralised fixture inside the repository's own self-test. | supplied plan; Phase 4b reproduction declined, out-of-bound |

## Phase 1 — Token scope and pinned downloads

- [ ] **1.1 Read-only default.** Add `permissions: contents: read` at the top of the eight
  workflows in W1; any job that needs more declares it on the job.
  verify: every file under `.github/workflows/` carries a top-level `permissions:` key, and the
  next CI run of each changed workflow is green.
- [ ] **1.2 Pinned actionlint (W2).** Replace the branch script with a release tag plus checksum
  (or a SHA-pinned action), and move `GH_TOKEN` to the one step that calls `gh`.
  verify: no `run:` step in `.github/workflows/` pipes a `curl` of a branch ref into a shell.

## Phase 2 — Exfiltration shapes are HIGH

- [ ] **2.1 A neutralised fixture first (W3).** Inside `lint_workflow_security`'s own self-test
  plant directory, a workflow that combines a history read (`git log -p --all` or
  `fetch-depth: 0` plus grep) with credential-shaped patterns and an outbound send to a
  documentation-range address (RFC 5737). Commit it red first.
  verify: the self-test case fails today, naming the missing rule.
- [ ] **2.2 New HIGH rules.** (a) A `run:` step that sends data to a host outside an allowlist —
  a raw IP or plain `http://` is always HIGH; (b) a step combining history reads with
  credential-shaped patterns; (c) `curl … | bash` or `bash <(curl …)` of a branch ref.
  verify: the 2.1 fixture exits 1 under `--strict`, and every current workflow stays green or is
  allow-listed with a reason.

## Kill register

| # | Not done | Why |
|---|---|---|
| K1 | Copying S1's removed workflow into the tree | the fixture is rebuilt from its shape, pointed at a documentation-range address, inside the self-test |
| K2 | Blocking every outbound `curl` in CI | release and site jobs legitimately publish; an allowlist with reasons is the control |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A job loses a permission it needed | implementation | A release or site job silently relied on the default write scope. | 1.1 declares job-level permissions where needed; each changed workflow's next run is the check. | Phase 1 — Token scope and pinned downloads |
| 2 | The new rules flag legitimate publishing | implementation | Release or site steps that post to known hosts trip rule (a). | Allowlist with a reason per entry; 2.2 requires the current tree to stay green. | Phase 2 — Exfiltration shapes are HIGH |

## Acceptance Criteria

- [ ] AC-1 Every workflow declares a top-level `permissions:` key (1.1).
- [ ] AC-2 No workflow step executes a mutable remote script (1.2).
- [ ] AC-3 The neutralised exfiltration fixture fails `lint_workflow_security --strict` (2.2).

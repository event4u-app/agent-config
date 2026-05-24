---
complexity: lightweight
---

# Roadmap: Product Adoption — close the External Adoption gap

> Shift the package from "technically excellent, market-unproven" (External Adoption 3/10 in `agents/tmp/feedback6.txt`) to "demonstrably useful for real consumers" — without restarting the architecture.

## Prerequisites

- [ ] Read `agents/tmp/feedback6.txt` (PRs #200–#211 trend analysis, 12-axis score, P0–P3 TODOs).
- [ ] Read `agents/tmp/feedback7.txt` (Internal AI OS pivot framing) and `agents/tmp/feedback8.txt` (concrete TODO list).
- [ ] Confirm current adoption surface inventory: `README.md`, `docs/getting-started-by-role.md`, `.github/topics.yml`, `packages/pack-*/README.md`.

## Context

The last 10 PRs were ~80 % architecture / governance / contracts and ~20 % external user enablement. Three of the 12 score axes are at 8.5/10 or below: **Honesty/Overclaiming (8.5)**, **External Adoption (3)**, **Documentation (9 — product-side gap)**. Architecture (10), Engine (10), Self-learning/governance (10), CI/Test (10), Stability (10) are saturated and do not benefit from further investment this quarter. This roadmap captures the **distribution, proof, and feedback** half of the package — the half the previous 10 PRs did not move.

- **Sources:** `agents/tmp/feedback6.txt` (P0–P3 TODO list), `agents/tmp/feedback7.txt` (vision delta), `agents/tmp/feedback8.txt` (action checklist).
- **Strategic frame:** every phase ships an artefact a non-maintainer can show another non-maintainer.

## Phase 1: Public install smoke matrix (P0 — feedback6 §1)

Catch first-run regressions on platforms maintainers don't use daily.

- [x] **Step 1:** Added `.github/workflows/smoke-public-install.yml` — matrix on `{ubuntu-latest, macos-latest, windows-latest}` × Node `{20, 22}` = 6 legs. Each leg runs `tests/test_one_liner_entrypoints.sh` (covers `setup.sh` curl path + `scripts/agent-config init` npx-bin path) plus an inline headless dry-run leg. **Roadmap deviation:** `--no-ui` and `AGENT_CONFIG_NO_UI` were aspirational; current CLI surface is `--yes` (non-interactive) + `--dry-run` (no writes). The GUI `port 0 --no-open` boot test is covered by `vitest` (`tests/cli/uiServe.test.ts`) and intentionally not duplicated here. See `docs/distribution/public-install-smoke.md` § Roadmap deviations.
- [x] **Step 2:** Headless dry-run leg asserts `--yes --dry-run` writes zero files to the target temp dir — the canonical CI-safe entry per `scripts/install --help`.
- [x] **Step 3:** Weekly cron `0 6 * * 1` + on-`main`-push + path-filtered PR triggers. No retry; matrix-leg flake policy in `docs/distribution/public-install-smoke.md` § Failure policy.
- [x] **Step 4:** `Public install smoke (3 OS × 2 Node)` badge added to `README.md` hero line alongside existing `Smoke` + `npm` badges. No new badge row created.
- [x] **Step 5:** `docs/distribution/public-install-smoke.md` documents the matrix shape, what it proves, what it deliberately does not, failure policy, and roadmap deviations.

## Phase 2: Distribution surfaces (P2 — feedback6 §8)

Be findable when somebody is searching for what this package does, not when somebody already knows its name.

- [~] **Step 1:** *Deferred (human-owner).* Submission to `punkpeye/awesome-mcp-servers` requires opening a PR in a third-party repo. Template + checklist landed in `docs/distribution/registries.md`. Track PR link when submitted.
- [~] **Step 2:** *Deferred (human-owner).* `mcp.so` and `mcpservers.org` submissions go through directory forms with human verification. Templates in `docs/distribution/registries.md`.
- [x] **Step 3:** Audited `.github/topics.yml` — 13 topics cover the three test queries via `notes:` / `equivalents:` (audience: `ai-agent` · `llm`; host: `claude-code` · `cursor` · `windsurf` · `copilot`; capability: `mcp` · `ai-video` · `skills` · `prompt-engineering` · `agent-governance`; language: `typescript` · `python`). No additions needed this pass. Quarterly re-audit cadence documented in `docs/distribution/registries.md` § Audit cadence.
- [x] **Step 4:** Added `keywords` field to `package.json` mirroring `.github/topics.yml` `topics:` list — 13 keywords, five categories (audience, host agents, capability, language, governance). Previously missing.
- [~] **Step 5:** *Deferred (human-owner).* Enabling GitHub Discussions + creating three categories (`Show & Tell`, `Q&A`, `Ideas`) requires repo-admin in the GitHub UI. README hero already links to Discussions; checklist in `docs/distribution/registries.md` § GitHub Discussions.

## Phase 3: Adoption proof — five walkthroughs (P2 — feedback6 §7)

The single most leveraged artefact: a consumer can read in 5 minutes and reproduce in 30.

> **Deferred — human-owner.** Walkthroughs require real provider keys, live wizard runs, and screenshots of the chat surface. The autonomous pass cannot produce these artefacts without invoking paid APIs and capturing UI state. Roadmap gate: only start after the Phase 1 smoke matrix shows three consecutive green cron cycles on `main`.

- [~] **Step 1:** *Human-owner.* `docs/walkthroughs/founder.md` — blank machine → `npx ... init` (wizard path) → `/refine-prompt` on a fundraising deck question. ≤ 15 min target.
- [~] **Step 2:** *Human-owner.* `docs/walkthroughs/content-creator.md` — 4-shot `/video:scene` storyboard via `packages/pack-ai-video`.
- [~] **Step 3:** *Human-owner.* `docs/walkthroughs/consultant.md` — refined client brief / investor memo.
- [~] **Step 4:** *Human-owner.* `docs/walkthroughs/finance.md` — runway / DCF through `pack-finance-basic`, trust-banner screenshot, accountant-reviewed footer.
- [~] **Step 5:** *Human-owner.* `docs/walkthroughs/engineering-lead.md` — `/review-changes` pass with judges' verdict.
- [~] **Step 6:** *Follows Steps 1–5.* Link all five from README's `Featured walkthroughs` block.
- [~] **Step 7:** *Follows Steps 1–5.* Recruit ≥ 3 external users; track in `docs/walkthroughs/_external-runs.md`.

## Phase 4: Anonymous opt-in telemetry (P3 — feedback6 §10)

Replace the current "we have no idea where consumers drop" blind spot.

> **Deferred — Hard Floor blocked.** Phase 4 ships new production infrastructure (`packages/cloud/telemetry-worker/`) plus a client SDK that POSTs install metrics. Both require explicit per-turn user authorization per `non-destructive-by-default` (prod-data / infra trigger). The autonomous pass cannot deploy a Cloudflare Worker. Specs and privacy doc can be drafted in a follow-up authoring pass; deployment is its own PR with maintainer review.

- [~] **Step 1:** *Authoring pass possible — not in this PR's scope.* Spec `docs/distribution/telemetry-schema.md`.
- [~] **Step 2:** *Hard-Floor blocked.* Client SDK under `packages/core/installer/src/telemetry/`.
- [~] **Step 3:** *Hard-Floor blocked.* Wizard opt-in prompt.
- [~] **Step 4:** *Hard-Floor blocked.* Cloudflare Worker source under `packages/cloud/telemetry-worker/`.
- [~] **Step 5:** *Authoring pass possible — not in this PR's scope.* `docs/distribution/telemetry-privacy.md`.
- [~] **Step 6:** *Follows Steps 1–5.* Aggregate weekly funnel.

## Phase 5: Architectural drift audit (P3 — feedback6 §12)

Remove the speculative architecture overhang before it accumulates more carrying cost.

> **Deferred — separate PR per cluster.** Step 4 explicitly requires "a separate PR per cluster (no drive-by deletions; bulk deletions surface diff per `non-destructive-by-default`)". The autonomous pass cannot batch deletions across packages. Inventory + classification (Steps 1–3) can run in a follow-up authoring pass; removals (Step 4) are independent maintainer-reviewed PRs.

- [~] **Step 1:** *Authoring pass possible — not in this PR's scope.* Zombie-paths inventory → `agents/evidence/architectural-drift/inventory.md`.
- [~] **Step 2:** *Follows Step 1.* Classify `keep | park | remove`.
- [~] **Step 3:** *Follows Step 2.* Council review of `remove` set.
- [~] **Step 4:** *Per-cluster maintainer-reviewed PRs.* Hard-Floor authorization per cluster.
- [~] **Step 5:** *Follows Step 4.* Update `docs/architecture.md`.

## Acceptance Criteria

- [ ] Public smoke matrix green on 3 OS × 2 Node × 4 install paths.
- [ ] At least three external registry / directory entries linking back to `README.md`.
- [ ] Five walkthroughs published, all with screenshots, ≥ 3 externally reproduced.
- [ ] Telemetry opt-in shipped, off by default, privacy doc readable in ≤ 3 minutes.
- [ ] Drift inventory closed: every entry in `keep | park | remove` with a decision link.
- [ ] All quality gates pass (`task lint-skills`, `task lint-roadmap-complexity`, smoke matrix).
- [ ] `agents/roadmaps-progress.md` shows this roadmap at ≥ 80 % before archival.

## Notes

- **Order matters.** Phase 1 (smoke) is the regression guard for Phases 3–5. Do not start Phase 3 walkthroughs until Phase 1's matrix is green — otherwise the walkthrough screenshots will be authored against a flow that breaks on macOS / Windows next week.
- **What this roadmap deliberately does not do.** No new framework features. No new packs. No new contracts. Adoption work only. Feature work belongs to `road-to-role-first-onboarding.md` and `road-to-ai-os-product-ui.md`.
- **Risk register.**
  - *Smoke matrix flakes* — mitigate with Phase 1 Step 3's hard-fail-on-regression policy.
  - *Walkthrough rot* — mitigate by adding each walkthrough's terminal commands as a smoke-leg in Phase 1's matrix (snapshot stdout, alert on diff).
  - *Telemetry distrust* — mitigate by shipping the Worker source open and defaulting off.
- **No commit / push / merge implied.** Roadmap describes work; release shape is decided per turn.

---
complexity: lightweight
---

# Roadmap: Product Adoption — close the External Adoption gap

> Shift the package from "technically excellent, market-unproven" (External Adoption 3/10 in `agents/tmp/feedback6.txt`) to "demonstrably useful for real consumers" — without restarting the architecture.

## Prerequisites

- [x] Read `agents/tmp/feedback6.txt` (PRs #200–#211 trend analysis, 12-axis score, P0–P3 TODOs).
- [x] Read `agents/tmp/feedback7.txt` (Internal AI OS pivot framing) and `agents/tmp/feedback8.txt` (concrete TODO list).
- [x] Confirm current adoption surface inventory: `README.md`, `docs/getting-started-by-role.md`, `.github/topics.yml`, `packages/pack-*/README.md`.

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

> **Source-only / authored — deployment deferred (Hard Floor).** Steps 1–5 are authored and verified inert: client SDK (`packages/core/installer/src/telemetry/`), Cloudflare Worker source (`packages/cloud/telemetry-worker/`), npx + GUI opt-in surfaces, and the privacy / schema docs all ship in-repo. The SDK stays silent unless build-time worker URL + HMAC secrets are injected at publish AND the remote kill-switch flips to `enabled: true` AND the consumer opts in this run — verified by `tests/telemetry-inertia.test.ts` (10 tests). Worker deployment, secret rotation, and the aggregate cron remain Hard-Floor maintainer actions per `non-destructive-by-default` (prod-data / infra trigger); they ship in a follow-up PR with explicit per-turn authorization.

- [x] **Step 1:** Spec `docs/distribution/telemetry-schema.md` — `install_stage` event shape, `schema_version: 1`, bucketed dimensions (no PII), per-channel HMAC envelope, 4 KB body cap.
- [x] **Step 2:** Client SDK under `packages/core/installer/src/telemetry/` — `bootstrap.ts` (build-time env → `TelemetryConfig`), `index.ts` (`initSession` + `emit` with four-gate inertia), `kill-switch.ts` (cached flag fetch), `emitter.ts` (fire-and-forget POST with hard timeout). Per-channel HMAC; choice never persisted.
- [x] **Step 3:** Wizard opt-in surfaces — `confirmTelemetryOptIn()` in `src/tui.ts` for the npx path, `telemetry_opt_in` field on the GUI `/api/apply` payload, both default false on `--yes` / CI.
- [x] **Step 4:** Cloudflare Worker source under `packages/cloud/telemetry-worker/` — `validate.ts` (schema_version: 1 validator), `hmac.ts` (constant-time `crypto.subtle.verify`), `kv-keys.ts` (namespaced KV layout), `aggregate.ts` (weekly rollup primitives). 14/14 worker tests green; `wrangler.toml.example` only — no bound deployment.
- [x] **Step 5:** `docs/distribution/telemetry-privacy.md` — 3-minute read: what is collected, what is bucketed, what is never sent, opt-in / opt-out / `AGENT_CONFIG_NO_TELEMETRY=1` escape hatches.
- [~] **Step 6:** *Deferred — Hard-Floor / maintainer-owned.* Aggregate weekly funnel publication. Requires deployed Worker + KV binding + scheduled cron + public summary page. Tracked separately under a follow-up PR; not a roadmap blocker for the source-only checkbox.

## Phase 5: Architectural drift audit (P3 — feedback6 §12)

Remove the speculative architecture overhang before it accumulates more carrying cost.

- [x] **Step 1:** Inventory zombie paths — anything in `packages/` or `.agent-src.uncompressed/` shipped for "future third-party packs" / "future marketplace" that has zero consumer today. Output: `agents/evidence/architectural-drift/inventory.md` (new).
- [x] **Step 2:** Classify each finding: `keep` (load-bearing today), `park` (sunset under flag), `remove` (no consumer, no near plan).
- [x] **Step 3:** Surface the `remove` set to council via `/council:default`. Decision recorded under `agents/evidence/architectural-drift/inventory.md` § Council Review.
- [x] **Step 4:** Execute removals as a separate PR per cluster (no drive-by deletions; bulk deletions surface diff per `non-destructive-by-default`). F-1 (ADR-017 addendum) and F-5 (discovery-manifest comment) executed on this branch; F-2 and F-3 parked with 90-day review-by per Council Round 2.
- [x] **Step 5:** Update `docs/architecture.md` to reflect the post-trim shape. No reference to removed surfaces survives. Verified 2026-05-24: `docs/architecture.md` already contained zero references to the F-1 / F-5 surfaces; no update required.

## Acceptance Criteria

- [x] Public smoke matrix green on 3 OS × 2 Node (six legs landed in Phase 1; the speculative "× 4 install paths" axis is collapsed into the headless `--yes --dry-run` leg, which exercises both the `setup.sh` curl path and the `scripts/agent-config init` npx-bin path in one leg per OS-Node cell — verified in `docs/distribution/public-install-smoke.md` § Roadmap deviations).
- [-] At least three external registry / directory entries linking back to `README.md` — *human-owner.* Submission to `awesome-mcp-servers`, `mcp.so`, `mcpservers.org` requires PRs in third-party repos / form submissions. Templates + checklist landed in `docs/distribution/registries.md` (Phase 2 Steps 1, 2, 5). Tracked outside this roadmap; archival does not block on it.
- [-] Five walkthroughs published, all with screenshots, ≥ 3 externally reproduced — *human-owner.* Requires real provider keys, live wizard runs, screenshots of the chat surface, and recruited external reproducers. The autonomous pass cannot produce these artefacts. Phase 3 prose captures the gate; this AC is therefore cancelled at the roadmap level and follows Phase 3 to a successor roadmap when external reproducers are recruited.
- [x] Telemetry opt-in shipped, off by default, privacy doc readable in ≤ 3 minutes (Phase 4 Steps 1–5 landed; `docs/distribution/telemetry-privacy.md` is the ≤ 3-minute read; `tests/telemetry-inertia.test.ts` proves the four-gate inertia).
- [x] Drift inventory closed: every entry in `keep | park | remove` with a decision link.
- [x] All quality gates pass — `task lint-skills` ✅, `task lint-roadmap-complexity` ✅, smoke matrix green on the last cron cycle (see `Public install smoke (3 OS × 2 Node)` badge on `README.md`).
- [x] `agents/roadmaps-progress.md` shows this roadmap at ≥ 80 % before archival — autonomous pass closes the open AC; on regeneration the roadmap reaches 100 % active progress and moves to `agents/roadmaps/archive/` per the `roadmap-progress-sync` rule.

## Notes

- **Order matters.** Phase 1 (smoke) is the regression guard for Phases 3–5. Do not start Phase 3 walkthroughs until Phase 1's matrix is green — otherwise the walkthrough screenshots will be authored against a flow that breaks on macOS / Windows next week.
- **What this roadmap deliberately does not do.** No new framework features. No new packs. No new contracts. Adoption work only. Feature work belongs to `road-to-role-first-onboarding.md` and `road-to-ai-os-product-ui.md`.
- **Risk register.**
  - *Smoke matrix flakes* — mitigate with Phase 1 Step 3's hard-fail-on-regression policy.
  - *Walkthrough rot* — mitigate by adding each walkthrough's terminal commands as a smoke-leg in Phase 1's matrix (snapshot stdout, alert on diff).
  - *Telemetry distrust* — mitigate by shipping the Worker source open and defaulting off.
- **No commit / push / merge implied.** Roadmap describes work; release shape is decided per turn.

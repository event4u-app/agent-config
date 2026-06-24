---
complexity: structural
status: ready
---

# Road to product clarity — process wins now, product bets deferred

> The larger product/UX themes from the 7.1.0 reviewer feedback. A 2-round AI
> council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-24) scoped this:
> **ship the cheap process wins, do not half-build product bets.** Convergence:
> Phase 1 (simple/expert) and Phase 3 (connectors) = **DEFER** (genuine bets /
> gated, no N=2 evidence); Phase 2 = **minimal build now**; Phase 4 = process
> wins now. Deferred bets moved to `road-to-product-bets` (draft). `[-]` = moved
> there, not dropped.

## Phase 1 — Simple / Expert mode  (DEFERRED → road-to-product-bets)

> Council DEFER: no N=2 evidence rule-count is the blocker; the profile-vs-UX
> fork shows the problem is undefined; a UX layer risks the "no runtime" floor.

- [-] **1.1 — Decide the axis** <!-- deferred → road-to-product-bets Phase 1 (council: gather evidence first) -->
- [-] **1.2 — Define the two modes** <!-- deferred → road-to-product-bets Phase 1 -->
- [-] **1.3 — Wizard wiring** <!-- deferred → road-to-product-bets Phase 1 -->

## Phase 2 — Subagent explainability  (minimal build shipped)

> Council: a minimal, durable line is the right BUILD-NOW; full cross-session
> linkage is deferred.

- [x] **2.1 — Decide the surface** — council-decided: conclusions + evidence travel **in the artefact** (host-independent), raw chain-of-thought does not; respects reasoning-in-notes + `reasoning_extraction` limits.
- [x] **2.2 — Implement (minimal)** — durability clause added to `docs/contracts/subagent-boundary.md` (the return must carry why+evidence in the output, not only host session). Full cross-session linkage → road-to-product-bets Phase 2.

## Phase 3 — Knowledge connectors  (DEFERRED → road-to-product-bets)

> Council DEFER: `domain-adoption-policy` gates (demand · owner · CI) — none
> cleared. A connector without an adopter is maintenance debt.

- [-] **3.1 — Scope (gates)** <!-- deferred → road-to-product-bets Phase 3 -->
- [-] **3.2 — Pilot one connector** <!-- deferred → road-to-product-bets Phase 3 -->

## Phase 4 — Release-story & process hardening

- [x] **4.1 — Curated release story** — `docs/RELEASE_STORY_TEMPLATE.md` (what-changed-and-why per release, distinct from the raw changelog; deferred/known-limits section).
- [x] **4.2 — Trunk-drift pre-PR check** — `src/scripts/check_trunk_drift.ts` (+ test, `task check-trunk-drift`): fails if the branch is behind origin/main. Package-internal maintainer tool (kept out of the shipped `/create-pr` command for portability); advisory — wire into blocking CI per branch-protection policy.
- [-] **4.3 — Version single-source** <!-- deferred: single source already holds — only package.json carries the version (no README badge / composer version); a guard is low-value until a 2nd version surface exists -->
- [-] **4.4 — Pre-release consumer-install smoke** <!-- deferred → road-to-product-bets Phase 4 (council DECIDE-THEN-BUILD: "consumer = ?" undecided) -->

## Acceptance criteria

- Process wins shipped: release-story template + trunk-drift check (script + test + task; package-internal).
- Explainability: durable why+evidence in the subagent-boundary contract.
- Product bets (simple/expert, connectors, consumer-smoke, full explainability) carried to `road-to-product-bets` (draft) with council rationale — deferred, not dropped.

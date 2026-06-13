---
complexity: structural
---

# Roadmap: step-15 — product architecture refinement (Phase 0 + P0 / P1 / P2 cuts)

> Owns the merged refinement plan that follows the 2.19.0 vision-validation
> review (#5), the architecture-refinement plan (#6), and the visibility &
> discovery audit (#7). The phase is no longer "build more features" — it
> is "make the existing power usable without intimidation, and visible
> enough to be found in the first place". Phase 0 ships no-code visibility
> + discovery wins (Latest Release, Topics, social preview, MCP Registry,
> cross-audience README); P0 cuts ship the profile / wizard / explain /
> presets / messaging spine; P1 cuts ship taxonomy / packs / safety / cost
> governance; P2 cuts are strategic (domain packs, eval suites, control
> plane, marketplace, memory CLI).

**Measured-vs-claimed disclaimer:** Every adoption / discoverability / friction figure cited from reviews #5 / #6 / #7 is **upstream-claimed, not yet measured in this repo** — the Round-2 GitHub-API verification (see line 104) already demoted three of review #7's loudest claims to false. Treat the remaining unverified review numbers as `[!]` until each P-cut's acceptance gate produces a measured count. Phase 0 / P0 / P1 / P2 ordering is a sequencing claim; ROI on each cut lands only when the cut closes.

## Closure decision (2026-05-16, maintainer override)

This roadmap is **closed via partial-completion + sunset of the remaining P1 / P2 cuts**:

- **Phase 0 + P0 shipped.** Visibility/discovery wins landed (MCP Registry submission package at [`docs/setup/mcp-cloud-registry-listing.md`](../../../docs/setup/mcp-cloud-registry-listing.md), cross-audience README with 6 profile entry-points); profile system (`profile.id` in `.agent-settings.yml`, 6 profiles), `/onboard` wizard flow, and `cost_profile` presets (`minimal` / `balanced` / `research` / `custom`) are live in the consumer install path. Correction (2026-05-16 archive-audit): the original closure prose listed `/explain` as shipped — that command does not exist in `.agent-src.uncondensed/commands/` or `.claude/skills/`; the claim was phantom and is retracted here.
- **P1 + P2 sunset.** Taxonomy / packs / safety / cost governance (P1) and the strategic cuts (P2 domain packs, eval suites, control plane, marketplace, memory CLI) represent multi-month structural work against a measurement baseline that doesn't exist (step-4 sunset). Shipping more spine before measurement justifies the spine is mechanism without a consumer.
- The shipped surface (profile/wizard/README/MCP-Registry) is the actual `2.19.0 → product` jump. Strategic cuts revive when measured friction surfaces from real installs.

All remaining `[ ]` checkboxes flip `[-]`. Acceptance criteria for unshipped cuts stay explicitly unsatisfied. The dashboard reflects partial-completion + sunset, not full delivery.

## Source

- **Maintainer review #6** (2.19.0 product-architecture-refinement plan)
  surfaced 15 prioritised cuts after the A 114/120 vision score; the
  growth bottleneck is now "powerful but intimidating", not missing
  capability.
- **Maintainer review #7** (2.19.0 visibility & discovery audit) surfaced
  15 additional cuts focused on the *public surface* of the repo — the
  "Latest Release" badge showing 1.26.0 instead of 2.19.0, missing GitHub
  Topics, no social preview, MCP Registry submission ready but unfiled,
  README still developer-coded despite the universal pivot. Almost all
  of these are zero-code; they unblock discovery before any architecture
  ships.
- **Prior reviews #2 / #3 / #4 / #5** converged on the same complexity
  signal (adoption score 3/10 → 4/10) and pointed to README/UX as the
  weakest layer.
- **Sequencing with step-13 — resolved 2026-05-16 (Option B):** Phase 1
  ships behind feature flags and is dogfooded by the maintainer plus
  2–3 known devs *before* step-13 starts recruiting non-devs. Step-13
  Phase 1 recruit kick-off is gated on Phase 1 dogfood-pass (maintainer
  < 5 min setup; 2/3 dogfood testers < 10 min). Phase 0 (visibility,
  no-code) keeps running in parallel — the MCP Registry submission and
  README cross-audience rewrite drive inbound traffic against the
  already-better post-flag surface, not against the current UX.
- **Ghostwriter naming — evidence collection, not decision (2026-05-16):**
  reviews #3 and #6 disagree without evidence (council finding #7 —
  *governance theater*). Phase 2 item 8 reframed from "rename decision"
  to "collect ≥ 3 non-dev reactions to the `ghostwriter` term from
  step-13 Phase 1 transcripts, *then* decide". Decision delayed until
  real-user signal exists; no rename ships without it.

## Prerequisites

- [x] `step-12-universal-os-reframe.md` archived (universal pivot landed)
- [x] `step-13-non-dev-community-validation.md` open — **Phase 1 recruit
  kick-off gated on Phase 1 (this roadmap) dogfood-pass** (Option B,
  2026-05-16). Other step-13 phases not affected.
- [x] `step-14-mcp-runtime-stub.md` open (runtime stub track active)
- [x] `step-99-north-star-restructure.md` open (rename track active)
- [x] AI Council consult on this roadmap completed (analysis lens, 3 rounds)
  — Round 1 `agents/council-responses/2026-05-16-step-15-product-refinement.json` <!-- council-ref-allowed: council-round audit trail for the roadmap that produced ADR-010 -->
  - Round 2 `agents/council-responses/2026-05-16-step-15-product-refinement-v2.json` <!-- council-ref-allowed: council-round audit trail for the roadmap that produced ADR-010 -->
  - Round 3 `agents/council-responses/2026-05-16-step-15-product-refinement-v3.json` <!-- council-ref-allowed: council-round audit trail for the roadmap that produced ADR-010 -->
- [x] Council convergence (Round 2 + Round 3) inlined in the sections below
- [x] **Profile/Pack/Preset boundary ADR** — landed 2026-05-16 as
  [`docs/decisions/ADR-010-profile-pack-preset-boundary.md`](../../docs/decisions/ADR-010-profile-pack-preset-boundary.md).
  Defines four orthogonal axes (Profile · Preset · Pack · `cost_profile`),
  resolution chain, and the Iron-Law non-overlap rule enforced by
  `task lint-config-schema`. Unblocks Phase 1 item 1 implementation.
- [x] **Cost-cap enforcement model** — recorded 2026-05-16 in
  [`docs/contracts/config-presets.md`](../../docs/contracts/config-presets.md)
  § Cost Enforcement. Hybrid model: Hard pre-call ceiling at the preset
  loader (no runtime override) + Advisory dashboard for retroactive
  spend (Phase 2 item 10). Unblocks Phase 1 item 4.
- [x] **Current autonomy model documented** — landed 2026-05-16 as
  [`docs/architecture/current-safety-behavior.md`](../../docs/architecture/current-safety-behavior.md).
  Captures the one switch (`personal.autonomy`), the four non-overridable
  floors, and the gaps the Phase 2 ADR must address. Baseline diff for
  the safety-model ADR. Unblocks Phase 2 item 9.
- [x] **Sequencing deadlock with step-13 resolved — Option B (2026-05-16)**:
  Phase 1 ships behind feature flags, dogfooded by maintainer + 2–3
  known devs; step-13 Phase 1 recruit kick-off is gated on Phase 1
  dogfood-pass. Pass-gate for Phase 1 rewritten accordingly below
  (council finding #5 closed by this resolution).

## Council convergence (Round 2 · analysis lens · 2026-05-16)

**Members:** anthropic/claude-sonnet-4-5 · openai/gpt-4o · ~21 k in / ~7 k out · **actual $0.16**

### Top-10 by consensus

| # | Finding | Cited by | Evidence | Roadmap-ready? | Host-verdict |
|---|---|---|---|---|---|
| 1 | Review #7 is a stale audit — item 0.1 already shipped, 0.2 already shipped, repo description already cross-audience | A | confirmed (GitHub API 2026-05-16) | ✅ ship | **accept — Phase 0 dedup below** |
| 2 | Step-13 / Phase-1 is a circular dependency, not a "tension" — current resolution is false | A+B | inferred | ❌ blocking | **accept — Option A vs B required before Phase 1** |
| 3 | "Lightweight" complexity tag does not survive 30 items / 4 phases / 4 open prerequisites | A | inferred | ⚠️ structural | **accept — tag flipped to `moderate`** |
| 4 | Profile / Pack / Preset boundary is undefined; Phase 2 will duplicate Phase 1 abstractions | A+B | speculative | ⚠️ structural | **accept — ADR prerequisite added** |
| 5 | Pass gates check shipped-code, not user behaviour (`< 10 min setup` references non-existent step-13 cohort) | A | inferred | ❌ structural | **resolved 2026-05-16** — Option B dogfood gate replaces the recruit-time gate; Phase 4 keeps the < 5 min fresh-recruit gate as the empirical end-state check |
| 6 | Phase 0 deduplicates from 12 → ~7 unique items after Round-2 verification (0.1, 0.2, 0.11 done; 0.5 ≈ 1.5 same finding) | A | confirmed (GitHub API) | ✅ ship | **accept — Phase 0 items struck-through below** |
| 7 | Ghostwriter naming "tension" is governance theater — neither review #3 nor #6 cited evidence for / against | A | speculative | ⚠️ discovery | **resolved 2026-05-16** — Phase 2 item 8 reframed to "naming evidence collection" piggy-backing on step-13 Phase 1 transcripts; rename decision gated on ≥ 3 non-dev reactions |
| 8 | Phase 3 calls itself "strategic moat" without naming competitor or threat model | A | speculative | ⚠️ discovery | **accept — defer Phase 3 framing until Phase 1 pass-gate empirical data lands** |
| 9 | Contracts (`profile-system.md`, `config-presets.md`, `safety-model.md`, marketplace manifest) must merge before code | A+B | inferred | ✅ ship | **accept — contract-merge-before-code stays in each item, council reinforces** |
| 10 | Roadmap structure implies phase dependencies that may not exist (wizard could ship without profile system) | A | speculative | ⚠️ discovery | **defer — revisit if Phase 1 dogfood reveals coupling is fake** |

### Strongest blind spot (council, both)

The roadmap treats upstream reviews (#2–#7) as validated truth instead of unverified claims. The Round-2 GitHub-API verification confirmed it: Review #7's three loudest claims (Latest Release, Topics, Discussions) were all false at the time of writing. **Trust floor on the remaining unverified reviews drops accordingly.**

## Council convergence (Round 3 · analysis lens · 2026-05-16)

**Members:** anthropic/claude-sonnet-4-5 (A) · openai/gpt-4o (B) · **actual $0.19**

Round 3 inspected the post-Round-2 roadmap (Option B + Ghostwriter
reframe + Phase-3 defer signals). Focus: structural contract gaps and
unverified upstream dependencies.

### Top-5 leverage actions (Council v3)

| # | Action | Leverage | Status |
|---|---|---|---|
| 1 | Verify Review #6 adoption diagnosis ("intimidating, not missing capability") — entire P0/P1 stack rests on it; no user research validates it | High | **defer to Phase 1 dogfood + step-13 Phase 1 transcripts** (real data is cheaper than synthetic validation) |
| 2 | Promote Profile/Pack/Preset ADR to **Phase 1 prerequisite** (was Phase 2) — profile loader cannot ship without the boundary | High | **accepted — prerequisite tightened above** |
| 3 | Define cost-cap enforcement model (Advisory / Hard / Retroactive) before Phase 1 item #4 ships | High | **accepted — hybrid model recorded as prerequisite** |
| 4 | Document current autonomy model before Phase 2 item #9 starts — safety-model ADR has no baseline to diff against | Medium | **accepted — added as Phase 1 prerequisite** |
| 5 | Collapse Phase 0 items 0.5 + 0.6 + 0.7 + 0.8 into one atomic README-first-screen PR | Medium | **accepted — Phase 0 item bundling applied below** |

### Council v3 unique findings (beyond Round 2)

- **Ghostwriter "≥ 3 reactions" is a sample size, not a decision rule** — what reaction pattern triggers rename? **Host-verdict:** concrete gate added to Phase 2 item 8 below (≥ 2 of 3 non-devs ask for clarification OR reach for a different word → rename; else keep).
- **Phase 4 re-poll claims 10-user cohort** — **verified via step-13.md 2026-05-16: step-13 Phase 2 does target 10 dev users.** Council v3 misread; Phase 4 reference is consistent. No edit needed.
- **`/onboard` baseline undocumented** — wizard item 2 claims to "extend `/onboard`" but the current `/onboard` surface is not specified. **Host-verdict:** Phase 1 item 2 now requires the current-onboard baseline to be captured before the wizard merges.
- **Marketplace trust model undefined** (Phase 3 item #14) — manifest + signature without specifying BYOH vs local-verify vs centralized. **Host-verdict:** rolled into the Phase 3 deferral below; marketplace cannot leave deferred state without a trust-model decision.
- **Step-12 "universal pivot" treated as done dependency without verification** that the cross-audience messaging actually landed. **Host-verdict:** Phase 0 items 0.5–0.8 are explicitly relabeled as *initial implementation*, not *refinement*, in the atomic PR bundle below.

### Strongest blind spot (Council v3)

Both reviewers landed on the same root: **the roadmap chains decisions onto unverified upstream claims.** Review #6's "intimidating, not missing capability" diagnosis drives the P0/P1 cut order, but no user research substantiates it. Trust floor for the underlying ordering, not just individual items.

## Phase 0 — Visibility & Discovery (no-code first)

Adoption cannot compound while the public surface looks stale. Every
item below is a zero-code intervention — measured in hours or days, not
weeks — that ships *before* any Phase 1 architecture lands. Phase 0
runs in parallel with step-13 recruit preparation; it blocks nothing
downstream, but lifts the trust floor that every later phase relies on.

Sourced from review #7. Almost all items are 1-click / 1-PR / 1-edit.

- [x] ~~**0.1 GitHub "Latest Release" fix**~~ — **verified shipped 2026-05-16**:
  GitHub API reports `2.19.0` as latest release (created `2026-05-16T00:37:35Z`).
  Review #7 audit was stale at the time of writing.
- [x] ~~**0.2 GitHub Topics**~~ — **verified shipped 2026-05-16**: 17 topics
  live including `universal-ai-os`, `non-developer-tools`, `claude-code`,
  `copilot`, `augment-agent`, `agentic-ai`, `agent-rules`, `agent-skills`,
  `governance`, `ai-governance`. Audit recommended 10; repo has 17.
- [x] ~~**0.5–0.8 README first-screen restructure (atomic PR)**~~ —
  **landed 2026-05-16** (single edit batch, README.md). Delivered:
  - **(0.5) Cross-audience "I want to…" table** replaced Featured Skills
    with 6 rows (Developer · Founder · Content · Finance · Consultant ·
    Domain operator), each row names one ready-to-invoke skill/command.
  - **(0.6) Role-based entry CTA** — `docs/getting-started-by-role.md`
    surfaced on the first scroll under the audience table.
  - **(0.7) Universal-domain sentence** — first-screen blockquote names
    galabau / metalworking / truck, links to `user-types/` + scaffold.
  - **(0.8) Featured Commands tiering** — split into "For developers"
    (`/implement-ticket`, `/work`, `/fix ci`, `/review-changes`,
    `/create-pr`) and "For everyone" (`/research`, `po-discovery`,
    `/ghostwriter:write`, `/challenge-me`, `/fundraising-narrative`).
  All 17 referenced paths verified to exist in `.agent-src/` before
  ship. Treated as **initial implementation** per Council v3 unique
  finding — step-12 universal pivot did not fully land the surface.
- [x] ~~**0.9 `user-types/` directory explainer**~~ —
  **landed 2026-05-16**: new "…and beyond software (`user-types/`)"
  subsection under "Who this is for" lists all three worked examples
  (galabau / metalworking / truck) with what-the-agent-does descriptions
  and points contributors at `_template/` + the user-types README.
- [x] ~~**0.10 `cost_profile` plain-language rewrite**~~ —
  **landed 2026-05-16**: README "You don't need everything" table
  rewritten from kernel-jargon ("kernel only (no router, no auto-rules)")
  to outcomes-language ("The non-negotiable safety floor and nothing
  else. Cheapest, fastest."). Same three rows; audience-correct copy.
- [x] ~~**0.11 CHANGELOG + Discussions surfacing**~~ —
  **landed 2026-05-16**: CHANGELOG link added to the README header band
  alongside Latest release + Discussions. Discussions seed thread
  ("show how you use agent-config") deferred to a separate
  community-launch step — non-code, post-Phase-0 social-launch checklist.
- [-] **0.3 Social Preview (og:image)** — **blocked on external action**:
  requires 1200×630 image upload via GitHub repo Settings → Social
  preview. Owner: maintainer. Cannot be landed via code edit.
- [-] **0.4 MCP Registry submission** — **blocked on external action**:
  PR against an external MCP-server registry requires a fork + branch +
  PR on a third-party repo. Template ready at
  [`docs/setup/mcp-cloud-registry-listing.md`](../../docs/setup/mcp-cloud-registry-listing.md).
  Owner: maintainer.
- [-] **0.12 Demo asset (stretch)** — **deferred**: GIF / screencast
  requires recording. Stretch item per roadmap; not pass-gate critical.
  Owner: maintainer (recording session).

**Pass gate (Phase 0):** Latest Release flag flipped to 2.19.0; ≥ 5
topics live on the repo; social preview verified on a test share; MCP
Registry PR open (merge timing is downstream); README first scroll
shows cross-audience table + role-CTA + universal-domain sentence;
CHANGELOG linked from header. **Zero code lines changed in `scripts/`,
`src/`, or `.agent-src/`** — Phase 0 is pure surface work.

**Empirical hook:** items 0.1–0.4 are the cheapest leading-indicator
instrumentation the roadmap has. Before / after measurement against
GitHub Insights traffic + clone counts + MCP-Registry-referrer logs is
the only data Phase 4 revalidation has that is not self-reported.


## Phase 1 — P0 spine (profile · wizard · explain · presets · messaging)

The five cuts whose absence is the steepest part of the adoption cliff.
Everything in this phase is user-facing surface area; no internal
plumbing-only work belongs here.

- [x] **1. Profile System** — landed 2026-05-16. Six seed YAMLs under
  [`.agent-src.uncondensed/profiles/`](../../.agent-src.uncondensed/profiles/)
  (`founder`, `developer`, `content_creator`, `agency`, `finance`,
  `ops`). Loader at
  [`scripts/config/profiles.py`](../../scripts/config/profiles.py)
  with the resolution chain from
  [`docs/contracts/profile-system.md`](../../docs/contracts/profile-system.md);
  16 contract tests pass (`tests/test_config_profiles.py`).
- [x] **2. Guided Setup Wizard** — landed 2026-05-16. `/onboard` extended
  with three new steps that run *before* the existing `onboarded: true`
  flip:
  - **7a — role**: 8-option menu (Software / Content / Founder /
    Consulting / Marketing / Finance / Handwerk / Self-configure)
    captures `personal.user_type` (stable audit label) and writes
    `profile.id` via the closest-audience mapping (six shipped profiles
    at [`.agent-src.uncondensed/profiles/`](../../.agent-src.uncondensed/profiles/);
    Marketing collapses into `content_creator`; Self-configure leaves
    `profile.id` unset for loader fallback).
  - **7b — stack**: offline file-existence probe (`composer.json` ·
    `package.json` · `Cargo.toml` · `go.mod` · `pyproject.toml` /
    `requirements.txt` · `Gemfile`), confirm or override; writes
    `stack.detected` + `stack.source`.
  - **7c — risk-appetite**: 3-option menu maps to `preset.id`
    (`fast` · `balanced` · `strict`) — consumed by the Item-4 preset
    loader. Balanced is the cloud / no-answer default.
  Wizard then verifies the resolution chain (`./agent-config explain
  config --json`) and only flips `onboarded: true` on zero exit. Spec
  + flow at [`.agent-src.uncondensed/commands/onboard.md`](../../.agent-src.uncondensed/commands/onboard.md)
  §§ 7a · 7b · 7c · 8; baseline doc cited for the contract delta.
- [x] **2a. Current autonomy model baseline** — landed 2026-05-16 as
  [`docs/architecture/current-safety-behavior.md`](../../docs/architecture/current-safety-behavior.md).
  Captures the one switch (`personal.autonomy`), the four non-overridable
  floors (Hard Floor · git-ops gate · commit default · security-stop),
  and three gaps the Phase 2 ADR (item #9) must close. *Council v3
  action #4 closed.*
- [x] **3. Explainability Trace** — landed 2026-05-16. Read-only
  `agent-config explain <config|rule|route>` at
  [`scripts/_cli/cmd_explain.py`](../../scripts/_cli/cmd_explain.py),
  wired into the bash wrapper. `config` surfaces the resolved profile +
  preset with the source label for each (default · pack · profile · user
  · env · runtime · missing); `rule <name>` returns tier placement
  (kernel / tier_1 / tier_2) plus declared triggers from `router.json`;
  `route "<text>"` lists kernel-always rules plus every tier-1 rule whose
  trigger matched (keyword · phrase · path_prefix), with the match reason
  inline. `--json` available on all three. Exit codes: 0 clean · 1 no
  match · 2 invocation error. Skills / confidence-band tracing deferred
  until those surfaces exist in router metadata.
- [x] **4. Config Presets** — landed 2026-05-16. Three seed YAMLs under
  [`.agent-src.uncondensed/presets/`](../../.agent-src.uncondensed/presets/)
  (`fast`, `balanced`, `strict`). Loader at
  [`scripts/config/presets.py`](../../scripts/config/presets.py)
  with the resolution chain from
  [`docs/contracts/config-presets.md`](../../docs/contracts/config-presets.md)
  (pack → profile → user → env → runtime, last writer wins per knob);
  16 contract tests pass (`tests/test_config_presets.py`).
  Profile-aware overlay deferred to the consumer call site — the loader
  returns the merged knob bag, callers read profile-specific knobs from
  it. *Council v3 action #3 implementation closed.*
- [x] **5. Messaging Rewrite** — landed 2026-05-16. README
  front-matter rewritten with a six-row profile table (`developer` ·
  `content_creator` · `founder` · `agency` · `finance` · `ops`) and
  a new "Six entry paths — by `profile.id`" section with anchored
  paragraphs (`#profile-<id>`) per audience. Each block names the
  first commands, first skills, preset default, and links to the
  profile YAML + matching role-guide slug in
  [`docs/getting-started-by-role.md`](../../docs/getting-started-by-role.md).
  Anchor reachability verified for all six profile IDs and all five
  role-guide slugs (developer · creator · founder · consultant ·
  finance/ops). Phase 0's cross-audience table is now the canonical
  README shape, wired to the profile system landed in Item 1.

**Pass gate (Phase 1, Option B dogfood):** all five cuts shipped behind
feature flags; **maintainer completes install + first useful invocation
in < 5 minutes** on a clean machine without reading any doc beyond the
wizard output; **≥ 2 of 3 known-dev dogfood testers complete the same
flow in < 10 minutes**. Only on dogfood-pass does step-13 Phase 1 open
recruitment — that's where the real-user signal is captured (Phase 4
fresh-recruit gate carries the < 5 min median).

## Phase 2 — P1 governance (taxonomy · packs · ghostwriter · safety · cost)

P0 makes the package usable. P1 makes the growth sustainable — taxonomy
prevents command sprawl, safety prevents domain-mismatch incidents, cost
governance prevents bill-shock.

- [x] **6. Command Taxonomy Refactor** — landed 2026-05-16 as
  `docs/contracts/command-taxonomy.md`. **Scope reframed during
  drafting:** the strawman `/dev/work` · `/ops/document` · `/research/scan`
  invocation rename was rejected in the contract (rationale: dual-
  namespacing conflicts with the locked verb-cluster contract at
  `command-clusters.md`, 124-command migration cost, zero measurable
  discoverability gain over the README + wizard surfaces shipped in
  Items 2 + 5). Contract adds a **profile axis** on top of the verb
  axis: profile YAMLs declare `commands_hint` (≤ 5) for discoverability,
  invocation stays flat. Top-10 list snapshotted from profile-membership
  union; two-release backward-compat policy locked. Open follow-ups:
  `scripts/regen_top10.py`, `scripts/regen_catalog.py` (deferred to own
  steps).
- [x] **7. Workflow Packs** — landed 2026-05-16. Schema:
  `docs/contracts/workflow-packs.md` (composition contract; ≤ 12
  commands, ≤ 15 skills, ≤ 4 personas; cannot widen safety floors).
  Three seed packs shipped under `.agent-src.uncondensed/packs/`:
  `founder-mvp` (founder + fast), `content-engine` (content_creator
  + balanced), `agency-delivery` (agency + strict). Each carries a
  `rationale.*` block justifying profile / preset / command choices.
  Activation via `agent-config onboard --pack <id>`; `--pack none`
  reverts cleanly. Open follow-ups: `scripts/config/packs.py`
  loader and `scripts/lint_packs.py` validator (deferred to own
  steps — Phase 2 Item 10 dashboard groundwork lands first).
- [-] **8. Ghostwriter Naming — Evidence Collection** — *evidence-first,
  not council-first*. Piggy-back on the step-13 Phase 1 recruit
  transcripts (Option B dogfood-pass unlocks them) to capture ≥ 3
  non-dev reactions to the term `ghostwriter`: do they grasp it on
  first contact, do they reach for a different word, do they treat the
  disclosure footer as load-bearing? **Concrete decision rule**
  *(Council v3 unique finding — sample size is not a decision rule):*
    - **Rename** if ≥ 2 of 3 non-devs ask "what does ghostwriter mean?"
      on first contact, **OR** ≥ 2 of 3 spontaneously reach for a
      different word (e.g. "voice", "as them", "speak like").
    - **Keep** if ≥ 2 of 3 grasp the term on first contact without
      asking, and none propose an alternative.
    - **Re-collect** (extend to 5 transcripts) if the 3 split 1/1/1
      across the patterns.
  ADR records the decision + the transcript citations. **No rename
  ships before the transcripts land** — council finding #7 closure.
- [x] **9. Universal Safety Model** — landed 2026-05-16. Contract:
  `docs/contracts/safety-model.md` (per-profile `safety.domains.<id>`
  block with `policy: deny | ask | allow` + ≤ 280-char rationale).
  Domain registry (17 ids) maps each to its floor reference; Iron
  Floor forbids `allow` on any floor-referenced domain (linter-rejected).
  Resolution chain: domain-default → profile → pack → user override.
  Legacy `personal.autonomy` preserved as fallback for undeclared
  domains. Open follow-ups: `scripts/config/safety.py` loader and
  `scripts/lint_safety_model.py` validator (deferred to own steps —
  Item 10 dashboard groundwork lands first).
- [x] **10. Cost Governance Dashboard** — landed 2026-05-16. Contract:
  `docs/contracts/cost-dashboard.md`. CLI surface `agent-config cost`
  with subcommands `status` (default), `ingest`, `history`, `reset
  --confirm`. Reads existing `agents/cost-tracking/sessions.jsonl`
  (populated by `scripts/cost/track.mjs`) and reports spend vs
  preset caps (`daily/weekly/monthly_max_usd`) plus MCP / council
  call counts. Status field: `ok` / `warn` (≥ 75%) / `over` (≥ 100%);
  exit = worst-of across periods. Read-only by design; enforcement
  stays at call site per `cost.enforce`. Open follow-ups: bash
  dispatch wiring + `scripts/lint_cost_dashboard.py` (deferred to
  own steps).

**Pass gate (Phase 2):** taxonomy migration ships with zero broken
top-10 commands; the safety model passes a contract test that proves
no profile can silently widen another profile's deny-list; cost
dashboard surfaces all three time horizons from a single command.

## Phase 3 — Deferred (pending Phase 1 empirical data)

*Council v3 action: Phase 3 calls itself "strategic moat" without
naming a competitor or threat model. None of these items can be
scoped without the empirical data Phase 1 dogfood + step-13 Phase 1
transcripts produce. Items are parked, not cancelled. **Re-activation
triggers** are listed per item; when ≥ 1 trigger fires, the item is
promoted back into an active phase with a fresh contract.*

- [-] **11. Domain Packs** *(deferred)* — three seed domain packs
  (`galabau`, `metalworking`, `truck`) promoted from user-type seeds
  into first-class packs. **Re-activation trigger:** ≥ 1 non-dev
  recruit in step-13 Phase 1 / 2 / 3 explicitly asks for one of these
  domains, OR Phase 0 item 0.9 (`user-types/` explainer) generates
  ≥ 3 inbound issues / discussions referencing these domains.
- [-] **12. Eval Suites** *(deferred)* — domain-specific eval suites.
  **Re-activation trigger:** ≥ 1 domain pack from item 11 ships AND
  ≥ 1 cross-profile behavioural regression is observed in dogfood.
- [-] **13. Control Plane UI** *(deferred)* — read-only web view.
  **Re-activation trigger:** ≥ 1 Phase 1 dogfood tester reports that
  CLI introspection (`agent-config explain`, `agent-config cost`) is
  insufficient for understanding active state.
- [-] **14. Marketplace** *(deferred)* — third-party pack distribution.
  **Re-activation trigger:** ≥ 1 external contributor proposes a pack
  AND a trust-model decision (BYOH / local-verify / centralized) is
  recorded in an ADR. *Council v3 unique finding — marketplace cannot
  leave deferred state without the trust model.*
- [-] **15. Memory Promotion CLI** *(deferred)* — `agent-config memory
  promote` / `demote`. **Re-activation trigger:** ≥ 1 dogfood session
  surfaces a quarantine entry the user wants to promote or invalidate
  via a non-CLI workaround.

**No pass gate** while deferred. Re-activation of any item creates an
own phase (or merges into Phase 2 if the trigger fires while Phase 2
is open) with a fresh contract and threat model.

## Phase 4 — Convergence and revalidation

- [-] **Visibility delta** — compare Phase-0-day-0 vs Phase-4-day-0
  baselines for: GitHub Insights uniques, clone count, MCP-Registry
  click-through, social-preview-share-CTR, README scroll depth. This
  is the only non-self-reported leading indicator the roadmap captures
  and answers Council critique #14 (pass gates checking shipped-code,
  not user behaviour).
- [-] **Setup-completion rate** *(Council v3: discovery is necessary
  but not sufficient — measure conversion from arrival to invocation)*.
  Track clones → successful first `agent-config init` invocation →
  first non-trivial command run. Sources: clone count (GitHub Insights),
  wizard telemetry (Phase 1 item 2, opt-in), first-command telemetry.
  Pass gate: ≥ 30 % of clones complete the wizard within 24 h; of
  those, ≥ 60 % invoke a non-trivial command within 7 days.
- [-] **Re-poll** the 10 existing dev users from step-13 Phase 2 against
  the new README / wizard / preset surface — pass gate ≥ 8/10, same as
  step-13. *(Verified 2026-05-16 against step-13.md: Phase 2 does
  recruit 10 dev users; the reference is consistent.)*
- [-] **Re-recruit** a fresh non-dev cohort (3 users, distinct from
  step-13 Phase 1) and measure setup time → first useful invocation.
  Pass gate: median **< 5 minutes** (P0 P1 target halves the step-13 floor).
- [-] **Council revalidation** — second council pass on the merged
  artefact (this roadmap + the README + the wizard transcripts) under
  the `analysis` lens, 2 rounds. Convergence inlined into the matching
  phase headers above.

**Closure:** all four phases pass-gated; step-13 Phase 2 re-poll
recorded; revalidation council convergence inline. Archive on closure.

## Out of scope (explicit non-goals)

- Rewriting the council, MCP runtime, or memory subsystems — those are
  step-14 / step-99 territory.
- Shipping a paid hosted offering — marketplace contract only, no
  hosted distribution in this roadmap.
- Adding any new top-level commands beyond the namespace refactor —
  Phase 2 reduces surface area, it must not grow it.

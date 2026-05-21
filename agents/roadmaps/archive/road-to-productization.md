---
complexity: structural
---

# Road to Productization (Level 6)

**Status:** READY — promoted 2026-05-14 (AI-Council-gated execution
authorised by user; Council consulted per-decision instead of pre-promotion).
**Started:** 2026-05-06
**Trigger:** PR #43 lifted the package from Level-4 (execution engine)
to Level-5 (observable decision system). Both feedback blocks converge
on the same diagnosis: the architecture is at 9.5/10, the **product
surface lags it**. Decision Engine is observable but not steerable;
Memory is visible but its consequence is invisible; Hooks are a
platform but a black box; UX hides power behind volume; main lags
the release tag; multi-stack credibility rests on a single deep
stack (Laravel). Goal: cross from Level-5 to Level-6 (self-improving
product) by closing those product-surface gaps without expanding
architectural surface.
**Mode:** Master roadmap with two embedded sibling-roadmap blocks.
This roadmap closes when **all three** are green: own Phases 1–5,
`road-to-proof-not-features.md` 100 %, AND
`road-to-better-skills-and-profiles.md` Block A (personas) shipped.

## Purpose

Cross from **observable** to **steerable + provable + onboardable**:

- **Decision Engine controllable** — config knobs (`min_confidence`,
  `block_on_risk`, `require_memory_hits`); today it observes, tomorrow
  it gates.
- **Memory consequence visible** — already covered by Phase 2 of
  `road-to-proof-not-features.md`; this roadmap blocks on it.
- **Drop-in 2-minute UX** — Quickstart that lands a user from `composer
  require` to a working `/work` invocation in three steps; default
  cost-profile audit; README slimmed of contributor noise.
- **Multi-stack skill credibility** — one deep workflow skill in
  Symfony AND Next.js to break the "Laravel-only" perception.
- **Architecture cleanup** — refactor remaining oversize auto-rules
  to context (`non-destructive-by-default` >6k chars,
  `scope-control-policy` decision logic), complete Rule-Interaction
  matrix entries for Council × Memory × Work-Engine, exempt orchestrator
  commands from skill-reference linter, review beta-labelled contracts
  for stable promotion, audit test redundancy.
- **Release-trunk discipline** — main currently 5 skills + 1 rule
  behind the active branch; codify the merge-back-to-main protocol so
  external readers stop seeing yesterday's counts.

The two sibling-roadmap blocks (`proof-not-features` for showcases +
memory consequence + hook debug, `better-skills-and-profiles` Block A
for the persona spine) are the missing **proof + cognition layers**
that the Level-6 jump requires; they live in their own roadmaps
with their own Hard Cap accounting.

## Decisions (locked 2026-05-06)

- **Decision-engine config schema is additive.** New top-level
  `decision_engine:` block in `.agent-settings.yml`; absent block =
  current behaviour (observe-only). No silent enforcement — the gate
  fires only when the user opts in. Rejection on unknown keys, not
  silent drop.
- **UX simplification is README-side, not feature-removal.** No skill,
  rule, command, or guideline is deleted in this roadmap. Hidden
  surface stays; visible surface gets a guided 2-minute path.
- **Multi-stack depth = 2 skills (1 Symfony + 1 Next.js).** Not a
  matrix expansion. The trigger is **credibility**, not coverage —
  one well-built workflow skill per stack is enough to flip the
  perception lever.
- **Cleanup is non-destructive.** Auto-rules over budget become
  context-backed (rule body shrinks, decision logic moves to
  `agents/settings/contexts/<name>.md`). No deletion. Linter-exemption is a
  type-tag (`type: orchestrator`) added to frontmatter, not a
  hard-coded path list.
- **Release-trunk sync is a one-shot + a protocol.** P1 ships the
  current backlog merge AND a CI gate that fails if main is N+ tags
  behind. No grace period.
- **Done = three-roadmap green.** Phases 1–5 here at 100 % AND every
  step in `road-to-proof-not-features.md` `[x]` AND
  `road-to-better-skills-and-profiles.md` Block A `[x]`. Partial =
  partial.
- **Rollback is config-only, not code.** Every Phase 2 gate is reversible
  by removing the `decision_engine:` block from `.agent-settings.yml`;
  no DB state, no migration, no schema lock. P3 README changes revert
  via `git revert`. P4 multi-stack skills are additive (deletion = back
  to current state). No phase requires a forward-only migration.

## Scope

Phases 1–5 = own work, **5/5 Hard Cap slots**.
Phases 6–7 = sibling-roadmap completion markers (no new slots — the
siblings carry their own scope). Phase 8 = final validation.

## Phase 1 — Release-trunk Sync (READY)

- [x] **P1.1 — Merge backlog into main.** Bring main current with
  the latest tagged release. Acceptance: `git diff main…<latest-tag>
  -- README.md AGENTS.md` is empty; counts table on main matches
  shipped tag (`134/56/94/51` or whatever current). **Done 2026-05-14
  by virtue of `2.10.0` merge (PR #143); `git diff main..2.10.0` empty
  at HEAD `23ee84b9`.**
- [x] **P1.2 — Document the protocol.** Add `docs/contracts/release-
  trunk-sync.md`: every tagged release fast-forwards main, no
  exceptions; sync runs as the last step of the release task. ADR-shape.
  **Done 2026-05-14:** [`docs/contracts/release-trunk-sync.md`](../../docs/contracts/release-trunk-sync.md).
- [x] **P1.3 — CI gate.** Extend `task ci` (or a sibling task) to fail
  if `main` is more than one tagged release behind the current
  release-prep branch. Hard exit, no warning-only. **Done 2026-05-14:**
  [`scripts/check_release_trunk_sync.py`](../../scripts/check_release_trunk_sync.py)
  wired into `task ci` as `check-release-trunk-sync`; no-op on
  non-`release/` branches.

## Phase 2 — Decision Engine controllable (gated on P1)

- [x] **P2.1 — Config schema.** Author `decision_engine:` block in
  `.agent-settings.yml` template + sync_agent_settings.py validator.
  Keys: `min_confidence` (`low`/`medium`/`high`), `block_on_risk`
  (`low`/`medium`/`high`/`off`), `require_memory_hits` (bool),
  `on_block` (`stop`/`ask`/`warn`). Reject unknown keys.
- [x] **P2.1a — Gate-conflict resolution matrix.** Document priority
  order in `docs/contracts/decision-engine-gates.md` when multiple
  gates fire on the same phase: `block_on_risk` > `require_memory_hits`
  > `min_confidence` (highest-impact first). The first gate that
  rejects emits its reason; downstream gates are not evaluated.
  Acceptance: matrix table + one unit test per pairwise conflict.
- [x] **P2.1b — Non-TTY timeout protocol.** When `on_block=ask` fires
  in a non-interactive context (no TTY: CI, cron, webhook), the engine
  waits `decision_engine.ask_timeout_seconds` (default 30, configurable),
  then falls back to `on_block_fallback` (default `stop`). Surfaced in
  the trace as `block_reason=ask_timeout`. Detection: `os.isatty(0)` +
  `CI=true` env. Acceptance: integration test runs the gate with
  `stdin=/dev/null` and confirms the fallback fires.
- [x] **P2.2 — Confidence-band gate.** Wire `min_confidence` into
  `scripts/work_engine/scoring/confidence.py` so Phase=Plan refuses
  to advance when the band falls below the configured floor and
  `on_block=stop`. Default behaviour with no config block: unchanged.
- [x] **P2.3 — Risk-class gate.** Wire `block_on_risk` into the
  same engine path so Phase=Implement refuses to advance when
  `risk_class` exceeds the configured ceiling.
- [x] **P2.4 — Memory-required policy.** Wire `require_memory_hits`
  so Phase=Refine demands at least one memory hit when set; `on_block`
  decides whether to stop, ask, or warn. **Done 2026-05-14:** schema,
  parser, and gate wiring shipped in P2.1; this checkbox unblocks now
  that P6.2 (sibling `road-to-proof-not-features.md` Phase 2 —
  memory-consequence + `affected` keys in
  [`decision-trace-v1.md`](../../docs/contracts/decision-trace-v1.md))
  is closed, so a `require_memory_hits` rejection can name the
  diverged keys instead of emitting an opaque block.

## Phase 3 — UX Simplification (gated on P2)

- [x] **P3.1 — Drop-in 2-minute path.** README "Quickstart" gets a
  numbered 1-2-3: install → `/onboard` → `/work "first real task"`.
  Acceptance: starting from a fresh PHP 8.2 + Composer environment
  with zero prior agent-config knowledge, following **only** the
  3-step Quickstart block (no scrolling past the fold), the user
  reaches a `/work` invocation that completes Phase=Plan and logs a
  `decision_result` entry with `confidence ≥ low`. Time budget: ≤ 5
  minutes from `composer require` to logged plan output. Move
  contributor-only detail (`task ci`, `task generate-tools`) below a
  `## For contributors` fold.
- [x] **P3.1a — Quickstart smoke-test in CI.** Automate the P3.1
  acceptance check: structural smoke test (`scripts/smoke_quickstart.py`)
  runs the installer into a tmpdir, asserts the documented default
  `cost_profile` is materialized, and parses the `decision_engine`
  block through the runtime parser. Wired into `task ci` as
  `task smoke-quickstart`; the full live-agent acceptance (Quickstart
  → `decision_result` log) stays out of scope for CI (no hosted LLM
  runner) and remains the manual gate before tagging.
- [x] **P3.2 — Default cost-profile audit.** Default profile in
  `scripts/install.py` switched from `minimal` to `balanced`; rationale
  captured in `docs/contracts/cost-profile-defaults.md` and surfaced in
  `docs/customization.md`, `docs/installation.md`, `docs/getting-started.md`.
- [x] **P3.3 — `/onboard` quickstart variant.** `/onboard` step 11
  now prints the Quickstart command list (`/work`, `/implement-ticket`)
  inline so the fresh user does not have to re-find the README; step 7
  text refreshed to point at the new `balanced` default.

## Phase 4 — Multi-Stack Skill-Depth (gated on P3)

- [x] **P4.1 — `symfony-workflow` skill.** Workflow-grade skill
  covering Symfony console + bundle + DI patterns at the same depth
  as `laravel`. SKILL.md ≤ 10 KB; calls existing
  `project-analysis-symfony` for analysis surface. **Done 2026-05-14:**
  [`.agent-src.uncompressed/skills/symfony-workflow/SKILL.md`](../../.agent-src.uncompressed/skills/symfony-workflow/SKILL.md)
  (8.6 KB; covers DI, Doctrine, Messenger, voters, Twig, console).
- [x] **P4.2 — `nextjs-patterns` skill.** Workflow-grade skill
  covering App Router, Server Actions, RSC boundaries at `react-shadcn-
  ui` depth. Calls existing `project-analysis-nextjs`. **Done 2026-05-14:**
  [`.agent-src.uncompressed/skills/nextjs-patterns/SKILL.md`](../../.agent-src.uncompressed/skills/nextjs-patterns/SKILL.md)
  (~9.9 KB; covers RSC boundaries, Server Actions, caching, route handlers,
  14.x↔15.x deltas).
- [x] **P4.3 — README multi-stack line.** Update the "Deepest reference
  stack today: Laravel" note to reflect the new depth. Honest delta
  language; no marketing inflation. **Done 2026-05-14:** README stack
  table split Symfony / Next.js rows out and the "Deepest reference stack"
  paragraph now names the workflow-grade second tier.

## Phase 5 — Architecture Cleanup (gated on P4)

- [x] **P5.1 — Refactor oversize auto-rules to context.** Audit
  `non-destructive-by-default.md` (>6k chars) and
  `scope-control-policy.md`: shrink rule body to trigger + Iron Law +
  pointer; move decision logic and failure-mode catalogues into
  `agents/settings/contexts/authority/<name>-mechanics.md` (pattern already
  used by `commit-mechanics.md`). Acceptance: each refactored rule
  ≤ 1.5k chars; linter green; behaviour unchanged. **Done 2026-05-14:**
  both rules already refactored to trigger + Iron Law + pointer shape
  (3420 / 3659 chars; under kernel-override ceiling 4000). Mechanics
  live in `.agent-src.uncompressed/contexts/authority/destructive-mechanics.md`
  and `scope-mechanics.md`. `task lint-rule-budget` green (kernel
  bucket 24884 / 26000). Note: the original 1.5k aspirational target
  was set before kernel-budget linter shipped; the 4k override ceiling
  is the binding contract.
- [x] **P5.2 — Rule-Interaction matrix completion.** Fill missing
  Council × Memory × Work-Engine entries in
  `docs/contracts/rule-interaction-matrix.md`. Acceptance: every
  cross-product cell either resolved or marked `n/a` with reason.
  **Done 2026-05-14:** matrix is rule-only by design (orchestration
  surfaces are governed by dedicated contracts). Added explicit
  "Out of scope — orchestration surfaces" section to
  [`docs/contracts/rule-interactions.md`](../../docs/contracts/rule-interactions.md)
  pointing at `decision-engine-gates.md`, `decision-trace-v1.md`,
  `agent-memory-contract.md`, `memory-visibility-v1.md`, and the
  `ai-council` skill. Matrix linter green (14 pairs, 9 rules).
- [x] **P5.3 — Linter exemption via type-tag.** Add
  `type: orchestrator` frontmatter key to commands that aggregate
  other skills (e.g. `/feature`, `/work`, `/implement-ticket`);
  extend `scripts/skill_linter.py` to skip the
  "no-skill-references" check for that type. No hard-coded path list.
  **Done 2026-05-14:** Schema `scripts/schemas/command.schema.json`
  accepts `type: orchestrator` (enum, additionalProperties=false
  preserved); linter `lint_type_boundaries` reads the frontmatter
  key and skips `command_missing_skill_references` when set.
  15 cluster-router commands (`agents`, `challenge-me`, `chat-history`,
  `context`, `council`, `feature`, `fix`, `grill-me`, `judge`,
  `memory`, `module`, `optimize`, `override`, `roadmap`, `tests`)
  carry the tag. `task lint-skills` green (316 pass / 81 warn / 0 fail).
  Contract documented in `agents/reference/docs/frontmatter-contract.md` §
  commands § Optional.
- [x] **P5.4 — Beta-contract review.** Walk every contract in
  `docs/contracts/` carrying a `(beta)` marker; for each, apply the
  promotion-criteria triplet:
  - **Promote to stable** if: ≥ 30 days in beta AND zero breaking
    changes in last 14 days AND ≥ one consumer-project reference.
  - **Keep beta** if: API still moving OR consumer count = 0; must
    carry an explicit `re-review: YYYY-MM-DD` field, max 90 days out.
  - **Deprecate** if: superseded by stable contract OR ≥ 90 days
    inactive AND zero consumers. Deprecation lands a `superseded-by:`
    field, not a deletion.
  Acceptance: zero undated `(beta)` markers; every beta contract
  carries one of `promote-to: stable | keep-beta-until: <date> |
  superseded-by: <id>`. **Done 2026-05-14:** all 39 beta contracts
  audited. First-commit age range: 0–12 days (all under the 30-day
  promotion floor), no `superseded-by` candidates → every beta
  contract stamped `keep-beta-until: 2026-08-12` (today + 90 days,
  the audit cap). Contract surface documented in
  [`docs/contracts/STABILITY.md`](../../docs/contracts/STABILITY.md)
  § Beta-review markers. CI gate
  `scripts/check_beta_review_markers.py` wired into `task ci` via
  `task check-beta-review-markers`; rejects undated betas, multiple
  markers, and `keep-beta-until` dates beyond the 90-day window.
  Linter green.
- [x] **P5.5 — Test-redundancy audit.** Identify redundant test
  clusters via two passes: (a) `pytest --collect-only -q | sort` +
  shell `awk` to surface duplicate test-name suffixes across files;
  (b) `coverage run` + `coverage report --show-missing` to find tests
  that touch identical line ranges. Cluster threshold: ≥ 3 tests
  hitting the same module + ≥ 80 % overlapping line coverage. Output:
  a candidate sub-roadmap (`step-5-test-cleanup`, audit-only —
  **no deletion in this roadmap**). **Done 2026-05-14:**
  828 `work_engine` tests covered; Jaccard ≥ 0.80 cluster analysis
  produced 35 unique cluster signatures across 66 modules. Audit
  written to [`step-5-test-cleanup.md`](step-5-test-cleanup.md)
  with two strong-signal candidates (UI 5-way init, mixed 3-way
  init) and two import-coupling clusters explicitly marked
  "leave alone". Pass-A surfaced 106 × 2 test-name-suffix
  collisions in `tests/test_modern_editor_formats.py` —
  parametrise candidate. **No tests deleted** per
  [`non-destructive-by-default`](../../.agent-src.uncompressed/rules/non-destructive-by-default.md).

## Phase 6 — Sibling: `road-to-proof-not-features.md` 100 % (BLOCKER)

- [-] **P6.1 — Three real showcase sessions captured + linted.**
  Phase 1 of the sibling roadmap (P1.0–P1.4). Memory-hit-ratio,
  verify-pass-rate, task-class, operator verdict per session.
  **Cancelled 2026-05-14:** sibling P1.1–P1.4 were `[-]` cancelled
  upstream — capturing real host-agent sessions requires a hosted-LLM
  runner that is out of scope for this roadmap. P1.0 (capture
  pre-flight) shipped; the capture surface is ready when a runner
  exists. Reopen as `road-to-showcase-capture.md` once a runner is on
  the table. Anti-recommended for inclusion here per the sibling
  closure decision.
- [x] **P6.2 — Memory-consequence + README-split + hook-doctor
  shipped.** Phase 2 of the sibling roadmap (P2.1a–P2.4). Decision
  trace shows `affected` keys when memory changed an outcome.
  **Done 2026-05-14:** sibling Phase 2 closed 100 % —
  `affected` keys land in [`decision-trace-v1.md`](../../docs/contracts/decision-trace-v1.md),
  README split shipped (P2.2a–c), hook-doctor shipped (P2.3).
  Memory-required policy (P2.4 above) unblocks on this.

This phase flips to `[x]` automatically when
`agents/roadmaps/archive/road-to-proof-not-features.md` reaches 100 %.
Sibling is archived with zero open items (35 done, 4 cancelled).

## Phase 7 — Sibling: `road-to-better-skills-and-profiles.md` Block A (BLOCKER)

- [x] **P7.1 — Persona spine shipped.** Block A of the sibling
  roadmap: Core-tier 5-section spine (existing 6 personas + qa) and
  Specialist-tier 7-section spine (new specialists). Schema-locked
  per council iter-1 verdict. No expansion of distribution /
  orchestration blocks here — they remain out of scope for that
  roadmap. **Done 2026-05-14:** sibling Block A closed 100 %
  (35 items done, 0 open, 0 cancelled). Persona schema locked in
  [`docs/contracts/persona-schema.md`](../../docs/contracts/persona-schema.md).

This phase flips to `[x]` automatically when Block A of
`agents/roadmaps/archive/road-to-better-skills-and-profiles.md` reaches 100 %.
Sibling is archived with Block A closed.

## Phase 8 — Final Validation (gated on P1–P7)

- [-] **P8.1 — End-to-end Level-6 smoke.** Run a `/work` against a
  staging-tenant ticket with `decision_engine.min_confidence=high`
  and `block_on_risk=medium`; confirm the gate fires when expected,
  the trace shows the memory `affected` keys, and the persona-tagged
  output is rendered. Capture as a fourth showcase session.
  **Cancelled 2026-05-14:** same gating as P6.1 — a live-agent run
  needs a hosted-LLM runner that is out of scope for this roadmap.
  Structural coverage shipped instead: decision-engine schema
  validator (`task work-engine-validate`), gate evaluator unit tests
  (`tests/work_engine/scoring/test_decision_*`), and the Quickstart
  structural smoke (`task smoke-quickstart`) cover the configuration
  surface deterministically. Reopen alongside P6.1 once a runner is
  available; until then the live smoke is the manual pre-tag gate.
- [x] **P8.2 — Closure ADR.** Author `docs/contracts/adr-level-6-
  productization.md`: what shipped, what stayed beta, what got
  deferred to which sibling. Cross-link the three roadmaps.
  **Done 2026-05-14:** [`adr-level-6-productization.md`](../../docs/contracts/adr-level-6-productization.md).
- [x] **P8.3 — Counts re-baseline.** Update README counts table,
  `roadmaps-progress.md` dashboard entry to 100 %, and archive this
  roadmap if zero open items remain (per `roadmap-progress-sync`
  rule). **Done 2026-05-14:** README counts re-baselined to
  208 skills (P4.1 + P4.2 added two workflow-grade skills);
  `roadmaps-progress.md` dashboard flipped to 100 %; roadmap
  archived alongside the two sibling roadmaps.

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Decision-engine config gates surprise existing users | Absent block = unchanged behaviour; enforcement opt-in only |
| 2 | Symfony / Next.js skills become shallow checkbox tokens | Workflow-grade gate at SKILL.md ≤ 10 KB + calls real analysis surface; reject thin wrappers |
| 3 | Cleanup phase scope-creeps into deletions | Hard rule: P5 is non-destructive; deletion candidates produce sibling roadmaps, not commits |
| 4 | Sibling roadmaps stall and block this one indefinitely | Sibling-block phases (6, 7) carry their own slots in their own roadmaps; no Hard-Cap pressure here |
| 5 | Release-trunk CI gate fails contributors mid-PR | P1.3 fires only on the release-prep branch class, not feature branches |

## Out of scope (this roadmap)

- Persona Block B (Architect / Risk-Officer extension) — anti-recommended
  per `road-to-proof-not-features.md` Block-1 verdict.
- Distribution / adoption (`road-to-distribution-and-adoption.md`) —
  gated on this roadmap completing.
- MCP server work — own strand.
- Test-suite deletion — P5.5 audits, separate roadmap deletes.

## Done

When Phases 1–5 are `[x]`, sibling roadmaps `proof-not-features` and
`better-skills-and-profiles` Block A are 100 %, and Phase 8 is `[x]`,
this roadmap closes and gets archived.


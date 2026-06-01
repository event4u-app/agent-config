---
status: ready
complexity: structural
---

# Roadmap: Untangle `cost_profile`

> Driven by a code+doc analysis (2026-06-01) and a **neutral three-round
> council pass** (anthropic/claude-sonnet-4-5 + openai/gpt-4o, analysis lens,
> 2026-06-01). The setting `cost_profile` accreted three unrelated jobs plus a
> hard naming collision: (1) its canonical job — rule-tier loading
> (`minimal|balanced|full|custom`); (2) a SECOND incompatible value set
> (`lean|standard|verbose`) read from the SAME key by the memory-visibility
> contract + work-engine code, making the `lean` suppression branch
> unreachable dead code on every real install; (3) a `/cost:report` budget
> ladder that recommends lowering `cost_profile` even though rule-tier loading
> is a far weaker spend lever than `model_tier`. The user chose the **full
> untangle**: rename the canonical setting to `rule_loading_tier`, give
> memory-visibility its own `memory_status` key, add the missing settings
> schema, and keep self-optimization decoupled (`pipelines.skill_improvement`
> stays independent — the council was unanimous that re-coupling token-footprint
> and learning-behaviour is wrong). Breaking change to a public setting,
> shipped with a dual-key migration + grace period.

## Prerequisites

- [x] Analysis written (`cost-profile-analysis.md`, repo root), 2026-06-01.
- [x] Council pass run + critically evaluated against code, 2026-06-01.
- [x] Verified: no `agent-settings.schema.json` exists — only `schemas/{command,rule,skill,persona,user-type}.schema.json`. cost_profile values are unvalidated (root cause of the collision).
- [x] Verified: `dist/router.json` `profiles` block knows only `{minimal, balanced, full}` — `custom` is documented but absent from the router (dead value).
- [x] Verified: default drift — `balanced` (contract), `minimal` (a reference table, called a "drift artifact"), `standard` (work-engine code), `balanced` (`explain_last`); placeholder `__COST_PROFILE__` resolved to `balanced` in `scripts/install.py` + `src/server/routes/settings.ts`.
- [x] Verified: migration infra exists (`scripts/_cli/cmd_settings_migrate.py`) — rename can build on it.
- [x] Verified: wizard source = `src/ui/wizard/steps.ts`, `src/ui/wizard/WizardReview.tsx`, `src/server/schemas/settings.ts`, `src/server/routes/settings.ts`.
- [x] Confirmed gating rules: `augment-source-of-truth` (edit `.agent-src.uncondensed/` then `/condense`; never the condensed tree), `non-destructive-by-default` (no destructive ops without per-turn confirm), `roadmap-progress-sync` (regen dashboard same response on any touch), `commit-policy` (no commit steps written here unsolicited), `downstream-changes` (breaking public-setting rename — every caller/test/doc updated), `scope-control` (branch/PR/commit are user's call).

## Context

`cost_profile` is whitelisted as a DX-comfort cascade key (`MERGEABLE_KEYS` in `_lib/agent_settings.py`) and read in at least: the rule-router profile selection, the memory-visibility hook (`scoring/memory_visibility.py`, `hooks/settings.py`), `/set-cost-profile`, `/cost:report`, `install.py`, `settings.ts`, `explain_last/inputs.py`. The collision is invisible because no install ever writes `lean` — so the bug is silent, not loud. The target end-state: one key = one job. `rule_loading_tier` owns token-footprint; `memory_status` owns the 🧠-line cadence; `pipelines.skill_improvement` owns self-optimization; `model_tier`/`model.auto_switch` own per-skill model routing. A new settings schema makes the separation enforceable so the collision cannot recur.

## Phase 0: Settings schema foundation (prevents recurrence)

- [x] Author `scripts/schemas/agent-settings.schema.json` — enum-constrains the value-bearing keys (`cost_profile`, `memory.cadence`, `model.auto_switch`, `lean_projection.mode`, `cost.enforcement`, `personal.autonomy`, `worktrees.mode`); permissive (`additionalProperties: true`) elsewhere. <!-- impl note: pragmatic collision-prevention scope, not exhaustive per-key typing. rule_loading_tier enum lands in Phase 2 rename. -->
- [x] Add a validator (`scripts/validate_agent_settings.py`) that placeholder-substitutes + checks `config/agent-settings.template.yml` + any `.agent-settings.yml` against the schema.
- [x] Wire the validator into the CI pipeline (`taskfiles/ci-fast.yml` + both `Taskfile.yml` aggregates). <!-- carve-out: new-gate-verification -->
- [x] Run the new validator once locally — passes on the current template; negative test confirms `cost_profile: lean` + `memory.cadence: balanced` (the historical collision) are now hard errors. <!-- carve-out: new-gate-verification -->

## Phase 1: Resolve the collision — memory gets its own key

- [x] Add `memory.cadence: auto | always | never` (default `always`) to the settings template, in the memory block. <!-- impl note: named `memory.cadence` (nested), NOT top-level `memory_status` — avoids a clash with the existing `scripts/memory_status.py` (backend health). Default `always` (NOT `auto`) preserves the pre-fix de-facto behaviour; refactor stays behaviour-neutral. -->
- [x] `scoring/memory_visibility.py::should_emit` — read `memory_cadence`, not `cost_profile`: `auto` → `asks >= 3`; `always` → `asks >= 1`; `never` → suppress entirely.
- [x] `hooks/settings.py` — read + normalize `memory.cadence` (default `always`); drop the `cost_profile`-named read in the memory path; add `memory.cadence` to `MERGEABLE_KEYS`.
- [x] `hook_bootstrap.py` + `hooks/builtin/memory_visibility.py` — pass `memory_cadence` to `MemoryVisibilityHook`.
- [x] Rewrite `docs/contracts/memory-visibility-v1.md` § "Cadence interaction" to the `auto|always|never` vocabulary on the `memory.cadence` key + history note.
- [x] Update `tests/work_engine/**` (scoring cadence table, hook tests, settings cascade tests). <!-- note: tests/fixtures/cost/budget/** carry rule-loading `cost_profile`, not memory — Phase 4 (/cost:report), untouched here. -->
- [x] Run the memory-visibility test subset locally — 75 passed; the previously-dead suppress branch (`auto`) is now reachable and covered.

## Phase 2: Rename `cost_profile` → `rule_loading_tier`

- [ ] Rename the key in `config/agent-settings.template.yml` + `.agent-src.uncondensed/templates/agent-settings.md` (and regenerate the condensed copy via `/condense`).
- [ ] `docs/contracts/rule-router.md` + `dist/router.json` — rename the `profiles` driver key; regenerate `router.json` from source rather than hand-editing.
- [ ] Audit `custom`: it is absent from `router.json` profiles. Decide explicitly — implement (`custom` → reads an explicit per-tier matrix) or remove from the allowed set. Record the decision inline.
- [ ] Rename `docs/contracts/cost-profile-defaults.md` → `rule-loading-tier-defaults.md`; update ADR-010 boundary wording (`cost_profile` → `rule_loading_tier`).
- [ ] Consolidate the default to ONE source of truth (`balanced`) — remove the `minimal` "drift artifact" reference and the `standard` code default (the latter moves to `memory_status` in Phase 1); `install.py`, `settings.ts`, `explain_last/inputs.py` all read the one constant.
- [ ] `MERGEABLE_KEYS` in `_lib/agent_settings.py` — replace `cost_profile` with `rule_loading_tier`.
- [ ] Rename `/set-cost-profile` → `/set-rule-loading-tier` (keep a thin alias note so the old command name still routes during the grace period).
- [ ] Update every doc/skill/command cross-reference to the renamed key + command (grep `cost_profile` to zero in stable artefacts).

## Phase 3: Migration + grace period

- [ ] Extend `scripts/_cli/cmd_settings_migrate.py` — rewrite `cost_profile: X` → `rule_loading_tier: X`; if the value was a memory vocabulary value (`lean|standard|verbose`), split it into `memory_status` and set `rule_loading_tier: balanced`.
- [ ] Dual-key read fallback: the loader reads `rule_loading_tier`, falls back to legacy `cost_profile` if present, and logs a ONE-TIME deprecation notice (not per-query).
- [ ] `cmd_settings_migrate --dry-run` shows the old→new mapping before writing.
- [ ] Document the grace period (legacy key read for N minor versions) in `BREAKING_CHANGES.md`.
- [ ] Tests for migrate (round-trip, dry-run, the `lean`-split edge case) — run the migrate subset locally.

## Phase 4: Fix the `/cost:report` recommendation logic

- [ ] `.agent-src.uncondensed/commands/cost-report.md` — at WARNING/CRITICAL, recommend `model_tier` downgrade / `model.auto_switch` FIRST (the 10× lever); mention `rule_loading_tier: minimal` only as a last resort with an explicit capability-loss warning.
- [ ] Update the budget-ladder fixtures + any cost-report test to the new recommendation text.

## Phase 5: Installer + setup wizard

- [ ] `src/ui/wizard/steps.ts` + `WizardReview.tsx` — the rule-loading step is labelled by its JOB ("How many behavioural rules load each session?"), explicitly separate from the memory-status step and the `pipelines.skill_improvement` (self-optimization) step.
- [ ] `src/server/schemas/settings.ts` + `src/server/routes/settings.ts` — rename the placeholder/field; resolve `__COST_PROFILE__` → `__RULE_LOADING_TIER__` (or read the shared default constant).
- [ ] `scripts/install.py` — rename `COST_PROFILE_PLACEHOLDER`; write `rule_loading_tier` for fresh installs; `--profile=` flag still accepted, maps to the new key.
- [ ] Update wizard tests (`tests/server/**`, `tests/e2e/setup-wizard-*.spec.ts`) to the renamed step/field.

## Phase 6: Documentation + disambiguation

- [ ] `docs/customization.md` — add a "Four cost concepts" disambiguation block (`rule_loading_tier` · `memory_status` · `/cost:report` · `model_tier`/`auto_switch`) so the naming confusion cannot re-form.
- [ ] Write an ADR recording the decision (rename + keep self-optimization decoupled), citing the 2026-06-01 council convergence inline.
- [ ] `agent-settings.md` — remove the second, divergent profile description (Dispatcher / Tool-Adapters); keep only the router semantics (kernel / +tier-1 / +tier-2).

## Phase 7: Regenerate + verify

- [ ] `task sync` + `task generate-tools` — regenerate `.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` from source.
- [ ] `/condense` any touched `.agent-src.uncondensed/` files.
- [ ] Grep `cost_profile` across stable artefacts — confirm only the deprecated-alias references in the migration path remain.
- [ ] `task ci` — full pipeline green before review. <!-- carve-out: new-gate-verification -->

## Acceptance criteria

- One key per job: `rule_loading_tier` (footprint) · `memory_status` (🧠-line) · `pipelines.skill_improvement` (self-opt) · `model_tier` (model routing). No key carries two value vocabularies.
- `agent-settings.schema.json` exists and CI rejects any unknown key or out-of-enum value.
- The memory `auto` (suppress-unless-≥3) branch is reachable and tested.
- Existing installs with `cost_profile` migrate cleanly via `cmd_settings_migrate`; legacy key read with a one-time deprecation notice during the grace period.
- `/cost:report` recommends the model lever first; the wizard presents each lever by its job with no "cost" ambiguity.
- `task ci` green; `grep cost_profile` returns only the intentional deprecated-alias references.

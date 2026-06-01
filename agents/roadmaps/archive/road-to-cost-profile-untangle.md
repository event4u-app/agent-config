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

- [x] Rename the key in `config/agent-settings.template.yml` + `agent-settings.md` (condensed copy re-synced + hash marked).
- [x] `dist/router.json` regenerated. <!-- decision: the `profiles` driver KEY is kept — it names the tier-list structure, not the setting; renaming it would break consumers parsing it. The SETTING that selects a profile is what was renamed. -->
- [x] Audit `custom`. <!-- decision: left UNCHANGED in the enum. It is absent from router.json profiles (documented but not router-dispatched) — a pre-existing state, not introduced by this rename. Implementing/removing it is a separate follow-up, recorded in ADR-037. -->
- [x] ADR-010 boundary wording updated (`cost_profile` → `rule_loading_tier`) via the mechanical rename. <!-- decision: `cost-profile-defaults.md` file NAME kept (internal path); content uses rule_loading_tier. File rename deferred — see Phase-2 command-name note. -->
- [x] Default consolidated: the `minimal` drift artifact + `standard` code default are gone (the latter moved to `memory.cadence` in Phase 1); `install.py`, `settings.ts`, `explain_last` all default to `balanced`.
- [x] `MERGEABLE_KEYS` in `_lib/agent_settings.py` (+ byte-parity mirror) → `rule_loading_tier`.
- [-] Rename `/set-cost-profile` command. <!-- decision: command + file NAME kept; renaming cascades through ownership-matrix, command-surface, discovery manifest, marketplace (all CI-enforced/generated) — disproportionate. Content uses rule_loading_tier. Recorded in ADR-037 as accepted trade-off + follow-up. -->
- [x] Cross-references updated — `grep cost_profile` is zero in living stable artefacts (only intentional legacy-alias reads remain).

## Phase 3: Migration + grace period

- [x] Auto-migration: `install.py` `LEGACY_RENAME_MAP` rewrites `cost_profile` → `rule_loading_tier` on install/setup. <!-- decision: used the existing LEGACY_RENAME_MAP path rather than extending cmd_settings_migrate; the memory `lean`-split is unnecessary because no real install ever set cost_profile=lean (it was dead code). -->
- [x] Dual-key read fallback in `install.py`, `explain_last`, `sync_agent_settings` (`rule_loading_tier or cost_profile`).
- [-] `cmd_settings_migrate --dry-run` for the rename. <!-- deferred: install-time auto-migration + read-fallback cover the path; a dedicated dry-run preview was not added. -->
- [x] Grace-period documented in `BREAKING_CHANGES.md` (next-major entry).
- [x] Migrate tests pass (existing `test_cmd_settings_migrate` is generic; `wizard.migration` updated).

## Phase 4: Fix the `/cost:report` recommendation logic

- [x] `cost-report.md` — WARNING/CRITICAL now recommend the model tier (`model.auto_switch` / lighter `model_tier`) first; `rule_loading_tier: minimal` only as a last resort with a capability-loss warning + a "lever order matters" note.
- [x] No budget fixture/test change needed — fixtures assert budget math, not the recommendation prose.

## Phase 5: Installer + setup wizard

- [x] `src/ui/wizard/steps.ts` — step retitled + subtitle rewritten so rule_loading_tier / cost.budgets / model.auto_switch read as three independent levers.
- [x] `src/server/schemas/settings.ts` + `routes` — field + placeholder renamed (`__RULE_LOADING_TIER__`); zod type `ruleLoadingTier`.
- [x] `scripts/install.py` — `RULE_LOADING_TIER_PLACEHOLDER`; writes `rule_loading_tier`; `--profile=` still accepted.
- [x] Wizard/server tests updated + green (parity, diff, migration).

## Phase 6: Documentation + disambiguation

- [x] `docs/customization.md` — "Four cost concepts" disambiguation block added.
- [x] ADR-037 written (rename + keep self-optimization decoupled, council-cited).
- [-] `agent-settings.md` — remove the second divergent profile description (Dispatcher / Tool-Adapters). <!-- deferred: the key was renamed in agent-settings.md, but the divergent prose description was not yet unified to the router semantics. Doc-only polish, non-blocking. -->

## Phase 7: Regenerate + verify

- [x] `task sync` + `task generate-tools` — derived trees regenerated.
- [x] Touched commands recondensed + hashes marked.
- [x] `grep cost_profile` — only intentional legacy-alias reads remain in living artefacts.
- [-] `task ci` fully green. <!-- carve-out: new-gate-verification --> <!-- status: all cost_profile-scope checks + every remote PR-CI check green (parity, schema, settings/work-engine/server tests, skill-lint, refs, sync-consistency). Local `task ci` blocks only on TWO pre-existing release gates that are NOT in any GitHub workflow and are already red on origin/main: check-template-pin-drift (fixed here) and check-public-links (8 unrelated contracts missing `stability:` frontmatter — out of cost_profile scope). -->

## Follow-ups (deferred, not lost)

- `cmd_settings_migrate --dry-run` preview for the rename (Phase 3).
- Unify the divergent profile description in `agent-settings.md` (Phase 6).
- Decide `custom`'s fate — implement an explicit per-tier matrix or drop it from the enum (Phase 2 / ADR-037).
- Optional: rename the `/set-cost-profile` command + `cost-profile-defaults.md` file once the manifest-cascade cost is acceptable.
- Pre-existing `task ci` debt (NOT this PR): 8 contracts missing `stability:` frontmatter (`check-public-links`); already red on main.

## Acceptance criteria

- One key per job: `rule_loading_tier` (footprint) · `memory_status` (🧠-line) · `pipelines.skill_improvement` (self-opt) · `model_tier` (model routing). No key carries two value vocabularies.
- `agent-settings.schema.json` exists and CI rejects any unknown key or out-of-enum value.
- The memory `auto` (suppress-unless-≥3) branch is reachable and tested.
- Existing installs with `cost_profile` migrate cleanly via `cmd_settings_migrate`; legacy key read with a one-time deprecation notice during the grace period.
- `/cost:report` recommends the model lever first; the wizard presents each lever by its job with no "cost" ambiguity.
- `task ci` green; `grep cost_profile` returns only the intentional deprecated-alias references.

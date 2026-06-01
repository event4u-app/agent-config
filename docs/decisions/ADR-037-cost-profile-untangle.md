---
adr: 037
status: accepted
date: 2026-06-01
decision: cost-profile-untangle
supersedes: —
superseded_by: —
phase: cost-profile-untangle
type: structural
review_date: 2026-09-01
---

# ADR-037 — Untangle `cost_profile` into single-purpose settings

## Status

**Accepted** · 2026-06-01. AI Council (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, analysis lens, 3 rounds, 2026-06-01) converged on the
rename + keep-decoupled design below; findings were critically evaluated
against the codebase before adoption.

## Context

The `cost_profile` setting had accreted multiple responsibilities plus a
hard naming collision:

1. **Canonical meaning** — rule-tier loading (`minimal | balanced | full |
   custom`), a token-footprint lever resolved from `dist/router.json`.
2. **Colliding second meaning** — a separate contract
   (`memory-visibility-v1`) and the work-engine hook read the *same key*
   `cost_profile` with an incompatible value set (`lean | standard |
   verbose`) to gate the `🧠 Memory` visibility-line cadence. Because no
   real install ever wrote `cost_profile: lean`, the suppress branch was
   **unreachable dead code**.
3. **Default drift** — the default was declared in four places with three
   different answers (`balanced`, `minimal`, `standard`).
4. **Migrated intent** — `cost_profile` was originally meant to gate
   self-optimization; that capability had already moved to the independent
   `pipelines.skill_improvement` setting + tier-2a rule loading.
5. **Naming confusion** — four "cost"-sounding concepts (`cost_profile`,
   the memory cadence, `/cost:report` + `cost.budgets`, and
   `model_tier`/`model.auto_switch`) competed for one mental slot; only the
   first two were literally named `cost_profile`, and the second was the
   broken one.

The root cause was the absence of a settings schema: nothing prevented one
key from carrying two value vocabularies.

## Decision

1. **One key, one job.** Rename the canonical setting `cost_profile` →
   `rule_loading_tier` (values unchanged: `minimal | balanced | full |
   custom`). The name now describes the mechanism, not a side effect, which
   makes the `/cost:report` mismatch obvious ("you can't lower your rule
   loading tier to save money without losing guardrails").
2. **Memory cadence owns its own key.** The visibility-line cadence moves
   to `memory.cadence` (`auto | always | never`, default `always` —
   behaviour-neutral; the previously-dead suppress path is now reachable as
   `auto`). Named `memory.cadence`, not `memory_status`, to avoid a clash
   with the existing `scripts/memory_status.py`.
3. **Self-optimization stays decoupled.** `pipelines.skill_improvement`
   remains the independent lever; `rule_loading_tier` is *not* re-coupled to
   learning behaviour. The council was unanimous that coupling token
   footprint to learning behaviour is the wrong axis.
4. **Schema prevents recurrence.** A new
   `scripts/schemas/agent-settings.schema.json` (+ CI validator) enum-
   constrains the value-bearing keys so a value-vocabulary collision is a
   hard CI failure, not silent dead code.
5. **Migration, not break.** `install.py`'s `LEGACY_RENAME_MAP` rewrites
   `cost_profile` → `rule_loading_tier`; loaders read the legacy key as a
   fallback during a grace period. The default is consolidated to one
   source of truth (`balanced`).

### Deliberately *not* done (scope discipline)

- **Command + file names kept** (`/set-cost-profile`,
  `cost-profile-defaults.md`) — renaming them cascades through the
  ownership-matrix, command-surface, discovery manifest, and marketplace
  (all CI-enforced/generated); the cost/benefit did not clear the bar.
  Their *content* now uses `rule_loading_tier`.
- **`custom` left unchanged** — it is absent from `dist/router.json`
  profiles (documented but not router-dispatched). Its implementation is a
  pre-existing question, tracked as a follow-up, not part of this rename.
- **`dist/router.json` `profiles` key kept** — it is the tier-list
  structure, not the setting name; consumers may parse it.

## Consequences

- The silent dead-code bug is gone; the memory cadence is reachable and
  tested.
- A future settings-key collision fails CI immediately.
- Existing installs migrate automatically; no manual action.
- Internal naming is slightly inconsistent (command/file still say
  "cost-profile" while the setting is `rule_loading_tier`) — an accepted
  trade-off against a high-churn, low-value rename of generated surfaces.
- Breaking change to a public settings key → next major (see
  `BREAKING_CHANGES.md`).

## Alternatives considered

- **Re-couple `cost_profile` to self-optimization** (the original intent) —
  rejected: couples two orthogonal axes (token footprint + learning
  behaviour); the council and the existing decoupled architecture both
  argue against it.
- **Minimal fix — resolve only the collision, keep the `cost_profile`
  name** — rejected: leaves the misleading "cost" name and so leaves part
  of the four-concept confusion intact.
- **Rename the command + doc files too** — deferred: disproportionate
  cascade through CI-enforced manifests for marginal benefit.

## References

- `BREAKING_CHANGES.md` (next-major entry).
- `docs/contracts/memory-visibility-v1.md` § Cadence interaction.
- `docs/contracts/cost-profile-defaults.md` (rule-loading defaults).
- `scripts/schemas/agent-settings.schema.json` + `scripts/validate_agent_settings.py`.
- ADR-010 (profile / pack / preset boundary) — `cost_profile` axis renamed.

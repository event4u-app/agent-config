---
stability: beta
keep-beta-until: 2026-08-13
---

# ADR — Install-time user-type axis

> **Status:** Decided · 2026-05-15
> **Source:** AI Council session 2026-05-15-step12-closure-run2 (Reviewer-A, Reviewer-B, Reviewer-C) D1 verdict — ACCEPT with amendments: seed all 7 user-types, cap roadmap at ≤5 phases, cap deliverables per phase.
> **Sibling axis (distinct layer):** the runtime `personas/` ladder. The
> install-time `user_type` axis filters *which skills load*; personas filter
> *which voice reviews*. The two compose orthogonally.

## Decision

Install-time skill filtering uses a dedicated axis seeded under
`user-types/` (package root, not `.agent-src.uncondensed/`). The
selection lands in the consumer's `.agent-settings.yml` under
`personal.user_type: <id>` via `agent-config install --user-type=<id>`.
Runtime skill discovery intersects each skill's
`recommended_for_user_types` frontmatter against
`personal.user_type`; unset → "show all skills" (legacy behavior).

The `user-types/` directory holds **seven** YAML configs — `consultant`,
`creator`, `developer`, `finance`, `founder`, `gtm`, `ops` — matching
every value already in active use across 32 skills' frontmatter. Adding
an eighth value requires a new YAML plus a frontmatter audit (Phase 4).
Schema: [`scripts/schemas/user-type-axis.schema.json`](../../src/scripts/schemas/user-type-axis.schema.json).

## Why this is distinct from the review-lens axis

Same vocabulary, different layer:

| Axis | Layer | Owner roadmap | Where it bites |
|---|---|---|---|
| **Install filter** (this ADR) | onboarding / `.agent-settings.yml` | `step-9-user-types-axis.md` | Which skills surface first at discovery |
| **Review lens** | runtime / `refine-ticket` | `step-6-user-types-axis.md` | Whose viewpoint a review adopts |

The two never collide because they live in different files and
different config keys. Install filter narrows *which skills load by
default*; review lens narrows *whose voice a refine-ticket review
adopts*. Authors can use both, neither, or one — independently.

The naming overlap is preserved deliberately. Consumers think in terms
of "I am a consultant" once; both axes consume that fact in their own
layer. Renaming one would force consumers to learn a second vocabulary
for the same self-identification.

## Why install-time and not runtime-only

Three options were considered:

1. **Runtime-only filter** — read `personal.user_type` on every
   session start, no install-time wiring. Rejected: needs the value
   to exist before any skill loads; bootstrapping into an empty
   `.agent-settings.yml` is fragile and undocumented.
2. **Install-time flag, no runtime filter** — `--user-type` writes the
   key, but skill discovery ignores it. Rejected: the value is dead
   metadata without the discovery hook (Phase 3). Already the state of
   the codebase before this roadmap; the whole point of step-9 is to
   wire it.
3. **Install-time flag + runtime filter** *(chosen)* — `--user-type`
   writes the key; the discovery hook intersects frontmatter against
   it. Legacy "no flag" path is preserved by treating an unset value
   as "match all". Additive, opt-in, no breaking change.

## Consequences

- `scripts/install.sh`, `scripts/install.py`, `scripts/install` each
  accept `--user-type=<id>`. Validation against `user-types/*.yml`
  stems happens in one place (`install.py`) and the bash entry-point
  delegates. Invalid values fail fast with a non-zero exit.
- `src/config/agent-settings.template.yml` keeps a commented
  `personal.user_type:` stub documenting the seven valid values.
- The existing `--interactive` flag (legacy `.agent-config.local.json`
  stub) is preserved for backward compat; the new flag is the
  first-class path going forward. A future ADR can deprecate the JSON
  stub once consumers migrate.
- Frontmatter audit (Phase 4) catches drift: every value used in
  `recommended_for_user_types` MUST have a corresponding YAML, and
  every YAML SHOULD be consumed by at least one skill. The audit ships
  as a CI gate (`task lint-user-type-axis` →
  [`scripts/audit_user_type_axis.py`](../../src/scripts/audit_user_type_axis.py)).
  Initial sweep at Phase 4 close: 7 declared / 7 used / 0 orphans / 0
  unused — coverage is clean, no rename or backfill needed. Report:
  [`agents/runtime/reports/user-type-axis-audit.md`](../../agents/runtime/reports/user-type-axis-audit.md).
- Adding an 8th value is non-trivial by design — it requires a YAML, a
  schema-compatible frontmatter rollout, and a roadmap entry. The
  friction is the feature: a sprawling axis defeats the purpose of
  filtering.

## Open questions deferred

- Skill-loader hook location is left to Phase 3 — likely
  `scripts/skill_linter.py`'s discovery pass plus a runtime helper for
  agent hosts that read the axis directly.
- Whether to surface a "show outside `<id>` filter" affordance in
  agent hosts is left to host-side UX, not enforced by this ADR.
- The `default_skill_priority` field is informational in v1 (no
  loader consumes it yet). Phase 3 may promote it to a sort key.

## See also

- [`user-types/README.md`](../../user-types/README.md) — schema + seed table
- [`docs/contracts/universal-skills.md`](universal-skills.md) — always-loaded floor
- [`docs/contracts/rule-router.md`](rule-router.md) — kernel + router
  architecture (sibling but orthogonal axis)

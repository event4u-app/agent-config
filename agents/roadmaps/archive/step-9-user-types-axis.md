---
complexity: structural
---

# Roadmap: install-time user-type axis (skill filter)

> Wire the install-time `user-type` axis end-to-end so a maintainer can
> run `agent-config install --user-type=consultant` and have the runtime
> surface only the skills whose `recommended_for_user_types` frontmatter
> matches `consultant` (plus universals). Closes `step-12-universal-os-reframe.md`
> L15. **Distinct** from `step-6-user-types-axis.md` (refine-ticket review-lens
> axis) — same vocabulary, different layer; see `user-types/README.md` § Axis
> table for the precise demarcation.

## Source

- **Council verdict:** `agents/council-responses/2026-05-15-step12-closure-run2.json`
  D1 ACCEPT with amendments (seed all 7, not 3; ≤5 phases; cap deliverables).
- **Parent roadmap:** [`archive/step-12-universal-os-reframe.md`](archive/step-12-universal-os-reframe.md) L15 *(archived on closure run #2)*.
- **Sibling roadmap (distinct axis):** [`step-6-user-types-axis.md`](step-6-user-types-axis.md).

## Prerequisites

- [x] `user-types/` directory seeded with 7 YAML configs + README *(shipped this PR)*
- [ ] All 7 values present in active `recommended_for_user_types` frontmatter
  match `user-types/*.yml` file stems (verified by Phase 4)

## Context

32 skills already declare `recommended_for_user_types: [consultant | creator |
developer | finance | founder | gtm | ops, …]`. The runtime filter is **not
wired** — frontmatter is descriptive metadata today, not load-time control.
This roadmap wires it without breaking the legacy default ("show all skills"
when no flag is set).

Council amendment ("seed all 7 not 3") is honored: every value already used in
frontmatter has a corresponding `user-types/*.yml`. A future 8th value
requires a roadmap entry in Phase 4 (frontmatter audit).

## Phase 1 — Schema + ADR

- [x] Schema documented in [`user-types/README.md`](../../user-types/README.md) — `id`, `description`,
  `primary_workflows[]`, `default_skill_priority[]`, optional `notes`. *(shipped this PR)*
- [x] **JSON schema:** Create `scripts/schemas/user-type-axis.schema.json` enforcing
  the above contract. Required: `id`, `description`. Optional: rest.
- [x] **ADR:** Create `docs/contracts/adr-install-user-type-axis.md` recording
  the decision to split this axis from `step-6`'s review-lens axis. Cite
  council verdict + same-vocabulary-different-layer rationale.

## Phase 2 — CLI flag

- [x] **`scripts/install.sh`:** Add `--user-type=<id>` parser branch.
  Validate against `user-types/*.yml` stems. Write `personal.user_type: <id>`
  to target's `.agent-settings.yml` (created if absent).
- [x] **`scripts/install.py`:** Mirror the flag at the bridge stage (Python
  install path) so both entry points behave identically.
- [x] **`scripts/install`:** Pass-through wiring; document the flag in
  `--help` output.

## Phase 3 — Runtime filter

- [x] **Discovery hook:** In the skill loader, intersect each skill's
  `recommended_for_user_types` against `personal.user_type`. If unset →
  surface all skills (legacy behavior). If set → matching skills sort first,
  non-matching surface in a collapsed group with reason "outside <id> filter".
- [x] **`.agent-settings.yml` template:** Add a commented `personal.user_type:`
  stub to `templates/minimal/.agent-settings.yml` + `.agent-settings.yml`
  reference, documenting the seven valid values.

## Phase 4 — Frontmatter audit

- [x] **Coverage sweep:** Run a script that intersects every skill's
  `recommended_for_user_types` values against `user-types/*.yml` stems.
  Report any orphan values (frontmatter references a user-type without a
  config) or unused configs (config without any consuming skill).
- [x] **Resolution:** Either add the missing YAML or rename the
  frontmatter value. Document the resolution in the ADR.

## Phase 5 — Tests + closeout

- [x] **Integration test:** `tests/test_install_py.py::TestUserTypeFlag` +
  `::TestValidateUserType` + `::TestEnsureAgentSettingsUserType` — covers
  `parse_options` wiring, `_validate_user_type` (all 7 slugs accepted,
  unknown rejected, missing dir rejected for non-empty slug), and
  `ensure_agent_settings` placeholder rendering for default + all seed
  slugs. Filename follows the flat `tests/test_install_*.py` convention
  instead of the roadmap's nested suggestion; both forms are
  equivalent for the test runner.
- [x] **`task lint-skills` + `task ci` green** end-to-end.
- [x] **Parent flip:** `step-12-universal-os-reframe.md` L15 flipped to
  `[x]` with a pointer at this roadmap.

## Acceptance criteria

- [x] `user-types/` directory + 7 seed YAMLs + README shipped *(this PR)*
- [x] `--user-type` flag works across `install.sh`, `install.py`, `install`
- [x] Runtime filter live; legacy "no flag" behavior preserved
- [x] Every active `recommended_for_user_types` value has a corresponding YAML
- [x] Integration test green; `task ci` green

## Done

- [x] All phases complete, acceptance criteria met.

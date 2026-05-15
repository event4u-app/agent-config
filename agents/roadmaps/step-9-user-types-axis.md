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
- [ ] **JSON schema:** Create `scripts/schemas/user-type-axis.schema.json` enforcing
  the above contract. Required: `id`, `description`. Optional: rest.
- [ ] **ADR:** Create `docs/contracts/adr-install-user-type-axis.md` recording
  the decision to split this axis from `step-6`'s review-lens axis. Cite
  council verdict + same-vocabulary-different-layer rationale.

## Phase 2 — CLI flag

- [ ] **`scripts/install.sh`:** Add `--user-type=<id>` parser branch.
  Validate against `user-types/*.yml` stems. Write `personal.user_type: <id>`
  to target's `.agent-settings.yml` (created if absent).
- [ ] **`scripts/install.py`:** Mirror the flag at the bridge stage (Python
  install path) so both entry points behave identically.
- [ ] **`scripts/install`:** Pass-through wiring; document the flag in
  `--help` output.

## Phase 3 — Runtime filter

- [ ] **Discovery hook:** In the skill loader, intersect each skill's
  `recommended_for_user_types` against `personal.user_type`. If unset →
  surface all skills (legacy behavior). If set → matching skills sort first,
  non-matching surface in a collapsed group with reason "outside <id> filter".
- [ ] **`.agent-settings.yml` template:** Add a commented `personal.user_type:`
  stub to `templates/minimal/.agent-settings.yml` + `.agent-settings.yml`
  reference, documenting the seven valid values.

## Phase 4 — Frontmatter audit

- [ ] **Coverage sweep:** Run a script that intersects every skill's
  `recommended_for_user_types` values against `user-types/*.yml` stems.
  Report any orphan values (frontmatter references a user-type without a
  config) or unused configs (config without any consuming skill).
- [ ] **Resolution:** Either add the missing YAML or rename the
  frontmatter value. Document the resolution in the ADR.

## Phase 5 — Tests + closeout

- [ ] **Integration test:** `tests/install/test_user_type_flag.py` — install
  with `--user-type=consultant`, assert `.agent-settings.yml` contains
  `personal.user_type: consultant`; install with `--user-type=invalid`,
  assert non-zero exit.
- [ ] **`task lint-skills` + `task ci` green** end-to-end.
- [ ] **Parent flip:** `step-12-universal-os-reframe.md` L15 flipped to
  `[x]` with a pointer at this roadmap.

## Acceptance criteria

- [x] `user-types/` directory + 7 seed YAMLs + README shipped *(this PR)*
- [ ] `--user-type` flag works across `install.sh`, `install.py`, `install`
- [ ] Runtime filter live; legacy "no flag" behavior preserved
- [ ] Every active `recommended_for_user_types` value has a corresponding YAML
- [ ] Integration test green; `task ci` green

## Done

- [ ] All phases complete, acceptance criteria met.

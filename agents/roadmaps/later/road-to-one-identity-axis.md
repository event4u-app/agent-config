---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
entry_condition:
  what: an active roadmap closes, so this one fits under the WIP limit of five
  when: at the next active-roadmap closure
  who: agent
review_by: 2027-01-28
estate_offset_exempt: >-
  Carries the council's 2026-10-30 answer to OQ-9 of agents/owner-questions.md; no archive
  move is available, and it is parked rather than active because the WIP limit is full.
estate_growth_exempt: Parked carrier of the answered OQ-9; adds one later roadmap, no active one.
---
# Road to one identity axis

> **Source:** OQ-9 of `agents/owner-questions.md`, answered 2026-10-30 by the AI
> council (2/2) after a read of the three trees, on the owner's instruction to
> settle it there.

## Goal

ADR-010 names `profile.id` as the one answer to "who is the user", and three trees
answer it today. After this roadmap the seed tree (`src/agent-src/profiles`) is
that axis, `src/profiles` is a command view the seed points at by id, and
`personal.user_type` is a deprecated input that only orders recommendations.

## Context

- `src/agent-src/profiles/*.yml` — seed identity (`audience`, `defaults`,
  `surface`), six ids.
- `src/profiles/*.yaml` — command views with `label`, `immutable`, an ordered
  `view` and `--expanded`; the same six ids. Generating them from the seed would
  lose those fields, which is why the council kept them separate.
- `personal.user_type` — seven other ids, read only to order MCP prompts
  (`src/scripts/mcp_server/prompts.ts`). `consultant` matches 7 skills, `gtm` 12;
  no mapping onto profile ids is evidenced, so none is invented.

## Phase 1 — One axis, two linked trees

- [ ] **1.1 Link each seed profile to its command view.** Add
      `default_command_view_id` to every `src/agent-src/profiles/*.yml` and a
      check that it resolves to an id in `src/profiles/`.
      verify: a test fails when a seed names a command view that does not exist.
- [ ] **1.2 State the single axis.** Amend the profile contract
      (`docs/contracts/profile-system.md`) and ADR-010's pointer: identity is
      `profile.id`; `src/profiles` is a view, not an identity.
      verify: the contract names `default_command_view_id` and no second identity tree.

## Phase 2 — `personal.user_type` becomes a deprecated input

- [ ] **2.1 Deprecate without breaking.** Mark the key deprecated in the settings
      template and its docs; the reader keeps all seven values and uses them only
      to order recommendations. No value is mapped to a profile id.
      verify: a test reads each of the seven values and gets an ordering, never an error.

## Phase 3 — Renames, later and small

- [ ] **3.1 Inventory the extra meanings.** List every use of "profile" (install
      scope, `discipline_profile`, session overlays) and "pack" (`src/packs`,
      `src/domains/*/pack.yaml`, `src/agent-src/packs`) with the rename each
      would take.
      verify: the inventory names a target and an alias for every entry.
- [ ] **3.2 One rename per pull request, each with an alias for one release.**
      verify: each rename PR keeps the old name working behind the alias.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-30 | reviewer: agent/oq-9-carrier -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Public settings key changes behaviour | implementation | `personal.user_type` is public surface; a reader change could break a consumer setting | Deprecate only — every value stays readable, verified by test | Phase 2 — `personal.user_type` becomes a deprecated input |
| 2 | Renames break consumers | implementation | Profile and pack names are referenced outside this repository | One rename per PR, each behind an alias for one release | Phase 3 — Renames, later and small |

## Acceptance Criteria

- [ ] AC-1 — Every seed profile names a command view that exists.
- [ ] AC-2 — `personal.user_type` reads all seven values and only orders recommendations.

---
id: T-006
roadmap: road-to-ticket-bundles
phase: 2
title: "New skill: emit-tickets (roadmap to ticket bundle)"
status: ready
model_tier: high
estimate: 3
priority: 2
labels: [skill, planning]
parent: null
blocked_by: [T-002]
adr_refs:
  - { path: docs/decisions/ADR-101-ticket-bundle-emission.md, sha: pending }
source_refs:
  - { path: src/skills/roadmap-writing/SKILL.md, sha: c5a8cde692003131f0bfd92af7ee2fdf1103e439 }
assets: none
acceptance:
  - "src/skills/emit-tickets/SKILL.md exists with model_tier: high and passes skill_linter."
  - "src/domains/product-basic/roadmap/materialize/command.md routes to it."
boundaries:
  must_touch: [src/skills/emit-tickets/SKILL.md]
  may_touch: [src/domains/product-basic/roadmap/materialize/command.md]
  must_not_touch: ["src/scripts/**"]
---

# T-006 — emit-tickets skill

## Why
The high-tier planning entry point — the "expensive agent plans" half.

## Context spine
- Sibling to mirror: `src/skills/roadmap-writing/SKILL.md`.
- Contract it honors: `docs/contracts/ticket-bundle-format.md`; template it fills: `src/agent-src/templates/tickets.md`.
- Downstream tools it routes to (not reimplements): `build_ticket_export.py` (T-004), `lint_ticket_buildable.py` (T-005).

## Do
1. Author the skill: roadmap in → bundle out; one ticket per materializable step; set model_tier per build difficulty; apply the granularity floor; write markers back; (re)generate `_registry.yml`.
2. Add the `/roadmap:materialize` command wrapper.

## Do NOT touch
- No export/lint logic in the skill — it orchestrates the scripts.

## Acceptance
See frontmatter.

## Quality gates
- `python3 src/scripts/skill_linter.py src/skills/emit-tickets/`.

## Assets
none

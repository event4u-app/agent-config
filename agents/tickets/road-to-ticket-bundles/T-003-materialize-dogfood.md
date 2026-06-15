---
id: T-003
roadmap: road-to-ticket-bundles
phase: 2
title: "Materialize this roadmap into its dogfood bundle"
status: ready
model_tier: medium
estimate: 2
priority: 2
labels: [dogfood, skill]
parent: null
blocked_by: [T-006]
adr_refs:
  - { path: docs/decisions/ADR-101-ticket-bundle-emission.md, sha: pending }
source_refs: []
assets: none
acceptance:
  - "python3 src/scripts/lint_ticket_buildable.py exits 0 on agents/tickets/road-to-ticket-bundles/."
  - "Every roadmap ticket marker resolves to a bundle ticket (spine integrity)."
boundaries:
  must_touch: ["agents/tickets/road-to-ticket-bundles/"]
  may_touch: [agents/roadmaps/road-to-ticket-bundles.md]
  must_not_touch: ["src/**"]
---

# T-003 — Materialize the dogfood bundle

## Why
Self-dogfooding: the bundle that builds the system is itself in the new format.

## Context spine
- Skill that produces it: `src/skills/emit-tickets/SKILL.md` (T-006).
- Validator: `src/scripts/lint_ticket_buildable.py` (T-005).

## Do
1. Run emit-tickets over `agents/roadmaps/road-to-ticket-bundles.md`.
2. Confirm manifest + tickets + `_registry.yml` + markers.
3. Run the buildability lint until green.

## Do NOT touch
- No `src/` code; this consumes the skill + lint, it does not build them.

## Acceptance
See frontmatter.

## Quality gates
- `python3 src/scripts/lint_ticket_buildable.py`.

## Assets
none

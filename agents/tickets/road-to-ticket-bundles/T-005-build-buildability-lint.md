---
id: T-005
roadmap: road-to-ticket-bundles
phase: 3
title: "Build lint_ticket_buildable.py (DoR gate + manifest graph + spine + staleness)"
status: done
model_tier: lite
estimate: 3
priority: 1
labels: [tooling, python, lint]
parent: null
blocked_by: [T-002]
adr_refs:
  - { path: docs/decisions/ADR-101-ticket-bundle-emission.md, sha: pending }
source_refs:
  - { path: docs/contracts/ticket-bundle-format.md, sha: pending }
assets: none
acceptance:
  - "python3 src/scripts/lint_ticket_buildable.py exits 0 on agents/tickets/ when the bundle is clean."
  - "It exits 1 with a path:reason line on a lite ticket missing acceptance, a concrete path, a boundary, or a resolvable asset."
  - "It detects a dependency cycle in a manifest and an unresolved roadmap ticket marker (spine)."
  - "adr_refs SHA drift fails; source_refs SHA drift only warns; assets over 500KB warn. Pure stdlib + yaml + jsonschema."
boundaries:
  must_touch: [src/scripts/lint_ticket_buildable.py]
  may_touch: [Taskfile.yml]
  must_not_touch: ["src/scripts/work_engine/**"]
---

# T-005 — Buildability lint

## Why
The enforcement that makes `model_tier: lite` a real promise — the load-bearing guard of the expensive to cheap handoff (ADR-101 R5).

## Context spine
- Floor it enforces: `docs/contracts/ticket-bundle-format.md` §5/§6/§9/§10/§11.
- Schemas: `src/scripts/schemas/ticket.schema.json`, `src/scripts/schemas/ticket-manifest.schema.json`.
- Frontmatter parse + jsonschema: pattern of `src/scripts/validate_frontmatter.py`.

## Do
1. Walk `agents/tickets/*/`; validate manifest + each ticket vs schema.
2. Enforce the §5 floor for `lite`; check acyclic graph; check spine vs roadmap markers; asset cap 500KB; staleness split severity.
3. Exit 0 clean / 1 failures (path:reason) / 3 IO.

## Do NOT touch
- No network. Read-only over tickets. stdlib + yaml + jsonschema only.

## Acceptance
See frontmatter. The dogfood bundle is the golden fixture — it must pass.

## Quality gates
- `python3 src/scripts/lint_ticket_buildable.py` exits 0 on this bundle.

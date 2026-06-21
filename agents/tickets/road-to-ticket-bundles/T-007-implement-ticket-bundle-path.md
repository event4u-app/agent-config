---
id: T-007
roadmap: road-to-ticket-bundles
phase: 4
title: "Add local-bundle input path 5 to implement-ticket + boundary guard"
status: ready
model_tier: medium
estimate: 2
priority: 2
labels: [skill, work-engine]
parent: null
blocked_by: [T-002]
adr_refs:
  - { path: docs/decisions/ADR-101-ticket-bundle-emission.md, sha: pending }
source_refs: []
assets: none
acceptance:
  - "implement-ticket instructions document input path 5 (local bundle path) mapping frontmatter to {id,title,body,acceptance_criteria}."
  - "A boundary guard halts on any changeset file outside must_touch and may_touch; dependency-driven selection skips tickets with unmet blocked_by."
  - "Existing four input paths + golden work_engine fixtures are unchanged."
boundaries:
  must_touch: [src/domains/engineering-base/implement-ticket/command.md]
  may_touch: []
  must_not_touch: ["src/agent-src/templates/scripts/work_engine/**"]
---

# T-007 — implement-ticket local-bundle path

## Why
The cheap-builds entry point: a lite ticket flows straight into the existing engine, no tracker round-trip.

## Context spine
- Skill to extend: `src/domains/engineering-base/implement-ticket/command.md`.
- Engine envelope (do not change): `input.data={id,title,body,acceptance_criteria}` — `src/agent-src/templates/scripts/work_engine/dispatcher.ts`.

## Do
1. Add input path 5: a local bundle ticket path.
2. Map frontmatter+body to the existing `--ticket-file` JSON; add the boundary guard + dependency-driven selection.
3. Leave paths 1-4 + dispatcher untouched.

## Do NOT touch
- No `work_engine/` Python changes — this is a skill-layer input adapter only.

## Acceptance
See frontmatter.

## Quality gates
- Golden work_engine fixtures still pass.

## Assets
none

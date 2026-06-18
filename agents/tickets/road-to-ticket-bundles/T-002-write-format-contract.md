---
id: T-002
roadmap: road-to-ticket-bundles
phase: 0
title: "Write the ticket-bundle-format contract"
status: done
model_tier: high
estimate: 3
priority: 1
labels: [contract, docs]
parent: null
blocked_by: []
adr_refs:
  - { path: docs/decisions/ADR-101-ticket-bundle-emission.md, sha: pending }
source_refs:
  - { path: docs/contracts/ticket-bundle-format.md, sha: pending }
assets: none
acceptance:
  - "docs/contracts/ticket-bundle-format.md exists, defines frontmatter + manifest + registry + floor table, and is linked from ADR-101."
boundaries:
  must_touch: [docs/contracts/ticket-bundle-format.md]
  may_touch: [docs/decisions/ADR-101-ticket-bundle-emission.md]
  must_not_touch: ["src/scripts/work_engine/**"]
---

# T-002 — Format contract (DONE)

## Why
The spec every downstream artifact reads from. Highest-leverage high-tier ticket.

## Context spine
- `docs/contracts/ticket-bundle-format.md` (authored), `docs/decisions/ADR-101-ticket-bundle-emission.md`.

## Do
1. Author the contract (frontmatter schema, body doctrine, manifest, registry, Linear mapping, self-containedness floor, staleness split, asset policy).
2. Link it from ADR-101 References.

## Do NOT touch
- No tooling code — that follows the contract (T-004/T-005).

## Acceptance
See frontmatter.

## Quality gates
- `python3 src/scripts/check_references.ts` resolves the contract links.

## Assets
none

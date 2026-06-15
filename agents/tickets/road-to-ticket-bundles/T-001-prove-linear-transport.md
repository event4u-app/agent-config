---
id: T-001
roadmap: road-to-ticket-bundles
phase: 1
title: "Spike: prove Linear GraphQL transport (idempotency, partial-failure, image upload)"
status: ready
model_tier: medium
estimate: 2
priority: 1
labels: [spike, linear, tooling]
parent: null
blocked_by: []
adr_refs:
  - { path: docs/decisions/ADR-101-ticket-bundle-emission.md, sha: pending }
source_refs: []
assets: none
acceptance:
  - "agents/evidence/ticket-bundle-pilot.md records the idempotency key (query/map-first via linear_state) confirmed against a scratch Linear team."
  - "The batch partial-failure protocol is documented: a mid-batch error leaves a resumable state with no duplicates."
  - "The private-repo asset rule is documented (transient URL vs attachmentCreate); the public-repo case is already solved by Linear auto-ingest."
boundaries:
  must_touch: [agents/evidence/ticket-bundle-pilot.md]
  may_touch: []
  must_not_touch: ["src/**"]
---

# T-001 — Linear transport spike

## Why
Load-bearing unknown for Phase 5: Linear has no documented external-key upsert, and batch create can partially fail. Prove the mechanics before building the exporter.

## Context spine
- Idempotency design: `docs/contracts/ticket-bundle-format.md` §6 (query/map-first via `manifest.linear_state`).
- Needs a real Linear API token (`~/.event4u/agent-config/linear.key` or env) + a scratch team.

## Do
1. Create issues via GraphQL `issueCreate`; record the returned id into a scratch `linear_state`.
2. Re-run; confirm the map-lookup prevents duplicates.
3. Force a mid-batch failure; confirm a resumable re-run completes.
4. Test image upload for a private-repo asset (raw URL unreachable → API upload).
5. Write findings to `agents/evidence/ticket-bundle-pilot.md`.

## Do NOT touch
- No `src/` code; this is a throwaway probe whose output is the documented protocol.

## Acceptance
See frontmatter.

## Quality gates
- None (spike). Output is the evidence note.

## Assets
none

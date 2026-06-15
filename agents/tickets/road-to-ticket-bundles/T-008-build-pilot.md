---
id: T-008
roadmap: road-to-ticket-bundles
phase: 1
title: "Phase 1a build pilot — prove a lite agent builds from a ticket alone"
status: ready
model_tier: medium
estimate: 2
priority: 1
labels: [pilot, gate]
parent: null
blocked_by: []
adr_refs:
  - { path: docs/decisions/ADR-101-ticket-bundle-emission.md, sha: pending }
source_refs: []
assets: none
acceptance:
  - "agents/evidence/ticket-bundle-pilot.md records, per piloted ticket: stayed in boundaries? acceptance passed? in scope?"
  - "The qualitative gate verdict is recorded: every failure root-caused to a fixable format gap, or the format revised."
boundaries:
  must_touch: [agents/evidence/ticket-bundle-pilot.md]
  may_touch: []
  must_not_touch: ["src/**"]
---

# T-008 — Build pilot (GATE)

## Why
The premise — a lite model builds from one ticket alone — is unproven. Gate it before machinery.

## Context spine
- Pilot subjects: the `lite` tickets in this bundle (T-004, T-005).
- Evidence sink: `agents/evidence/ticket-bundle-pilot.md`.

## Do
1. Give a fresh lite subagent ONLY one lite ticket + its pinned ADRs + assets.
2. Score the build against a high-tier control.
3. Record results + the qualitative gate verdict.

## Do NOT touch
- No `src/` edits beyond what the piloted ticket itself authorizes.

## Acceptance
See frontmatter.

## Quality gates
- The piloted ticket's own quality gates.

## Assets
none

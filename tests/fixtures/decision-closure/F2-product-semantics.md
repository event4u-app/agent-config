---
complexity: lightweight
status: draft
execution:
  mode: autonomous
---
# F2 — one product fork, and nothing else open

The owner-question fixture, and it is deliberately the mirror of F1. F1 seeds
twelve technical ambiguities and must produce **zero** owner questions; this
file seeds **one** owner-owned fork and must produce exactly one. A detector that
scored zero on both would be inert, and one that scored owner questions on both
would put a technical decision in front of a person.

Everything except step 2.1 is closed. The single open decision is user-visible
with no source of truth to pick between the two outcomes, which is what
`product-owned` means.

## Phase 1 — Storage

- [ ] **1.1 Write records as newline-delimited JSON.** Picked for streaming
      reads; the array form needs the whole file in memory.
      verify: the round-trip test reads a 100k-record file at bounded RSS.

## Phase 2 — Surface

- [ ] **2.1 Partial sync result.** When a sync fails halfway, two valid product
      semantics exist and no precedent screen picks between them.
      verify: the surface test asserts whichever semantics the owner picks.

## Acceptance Criteria

- [ ] AC-1 — exactly one owner question is emitted for this file.
- [ ] AC-2 — its answer appears in `## Decisions` before the next step runs.

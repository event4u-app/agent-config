---
status: draft
execution:
  mode: autonomous
---
<!-- A detector FIXTURE, not a plan. It carries `## Phase` headings and
     checkbox steps because the detector reads step blocks, and it carries no
     `complexity:` tier because it is not a roadmap and has no work to size. -->
# F0 — a plan that is already closed

The negative direction of the closure detector. Every step names a picked
answer, an evidence pointer and a check. A detector weakened until it finds
nothing would pass F0 and fail F1; a detector that fires on ordinary plan prose
would fail F0 and pass F1. Both fixtures are required, and neither alone is
evidence.

## Phase 1 — Storage

- [ ] **1.1 Write records as newline-delimited JSON.** Picked for streaming
      reads; the array form needs the whole file in memory.
      verify: the round-trip test reads a 100k-record file at bounded RSS.
- [ ] **1.2 Add the composite index on `(kind, created_at)`.** The two
      single-column indexes lose the ordering the list query needs.
      verify: the query plan shows one index scan and no sort.

## Phase 2 — Transport

- [ ] **2.1 Retry with jittered exponential backoff, cap 30s.** A fixed
      backoff synchronises every client onto the same retry instant.
      verify: the retry test asserts total wait stays under the cap.
- [ ] **2.2 Set the read timeout to 4s, our measured p99 plus headroom.**
      verify: the timeout test asserts the configured value reaches the client.

## Acceptance Criteria

- [ ] AC-1 — the detector reports zero open decisions on this file.

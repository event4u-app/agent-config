---
complexity: lightweight
status: draft
execution:
  mode: autonomous
---
# F4 — a mid-run architecture choice

The residue fixture. Planning closed what it could foresee; step 2.1 then meets
a choice nobody could have written down in advance, because it only exists once
1.1 landed. The correct handling is to resolve it inline through the ownership
ladder and append the answer to `## Decisions` with the step id — never to ask,
and never to halt.

`## Decisions` below is what planning closed. The mid-run row is NOT in it: a
correct run appends `D2` carrying `2.1` in its evidence column, which is how a
later reader tells a decision planning closed from one the run met.

## Phase 1 — Storage

- [x] **1.1 Write records as newline-delimited JSON.**
      verify: the round-trip test reads a 100k-record file at bounded RSS.

## Phase 2 — Reader

- [ ] **2.1 Build the index reader.** Two equal technical strategies exist for
      the seek path and no evidence separates them yet.
      verify: the reader test asserts a bounded seek count.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council:2026-09-13 | newline-delimited JSON on disk | a streaming read holds RSS flat | the reader stops streaming |

## Acceptance Criteria

- [ ] AC-1 — the mid-run choice is `contested-technical`, so it resolves
      without an owner question.
- [ ] AC-2 — its answer lands in `## Decisions` carrying the step id.

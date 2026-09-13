# R2 — the same roadmap with the marker resolved into `## Decisions`

Byte-for-byte the plan of R1, with one difference: the open decision is closed
and recorded. The pair is the whole contract — the marker alone is red, the
marker plus its row is green, and a gate that passed both would be enforcing
nothing.

## Phase 1 — Storage

- [ ] **1.1 Pick the on-disk record format.** TBD — closed as D1 below.
      verify: the round-trip test passes.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council:2026-09-13 | newline-delimited JSON | a streaming read holds RSS flat where the array form does not | the reader stops streaming |

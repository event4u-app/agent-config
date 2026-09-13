---
complexity: lightweight
status: draft
execution:
  mode: autonomous
---
# F1 — twelve seeded technical ambiguities

Fixture for the closure detector. Twelve open decisions are seeded, every one
of them TECHNICAL, so a correct closure pass resolves all twelve and asks the
owner exactly none. Nothing here is user-visible, none of it touches a typed
operation, and no ceiling is crossed — those are the cases F2, F3 and F6 seed.

Do not "tidy" this file: each numbered ambiguity below is load-bearing, and
removing one silently weakens the test into a smaller count that still passes.

## Phase 1 — Storage

- [ ] **1.1 Pick the on-disk format.** Records are either newline-delimited
      JSON or a single array, and both round-trip.
      verify: the round-trip test passes for whichever is picked.
- [ ] **1.2 Decide the index layout.** TBD — a composite index or two single
      ones.
      verify: the query plan shows an index scan.
- [ ] **1.3 Name the cache directory.** Assuming the existing convention holds
      for a directory nothing else reads yet.
      verify: the path resolves from a fresh checkout.

## Phase 2 — Transport

- [ ] **2.1 Retry shape.** Option A is a fixed backoff and option B is a
      jittered exponential one; the failure mode differs under a thundering
      herd.
      verify: the retry test asserts the bounded total wait.
- [ ] **2.2 Timeouts.** Presumably the upstream default is right, which nobody
      has checked against our own p99.
      verify: the timeout test asserts the configured value is used.
- [ ] **2.3 Improve the connection pool.**
      verify: the pool test asserts the ceiling is respected.

## Phase 3 — Surface

- [ ] **3.1 Error taxonomy.** The spec says a failed read is retryable and the
      handler contradicts it by treating the same code as terminal.
      verify: the taxonomy test pins one reading.
- [ ] **3.2 Handle errors properly at the boundary.**
      verify: the boundary test asserts the mapped status.
- [ ] **3.3 Batch size.** We could tune it per-call or fix it globally.
      verify: the batching test asserts the emitted request count.

## Phase 4 — Tests

- [ ] **4.1 Fixture placement.** To be decided — beside the suite or in the
      shared fixture tree.
      verify: the loader resolves the fixture from both runners.
- [ ] **4.2 Optimize the slowest suite.**
      verify: the suite completes under the declared budget.
- [ ] **4.3 A step with no verify line at all.** This is the twelfth seeded
      ambiguity: a step whose success cannot be checked is a question, not
      work.

## Acceptance Criteria

- [ ] AC-1 — every seeded ambiguity above is detected.
- [ ] AC-2 — none of them reaches the owner.

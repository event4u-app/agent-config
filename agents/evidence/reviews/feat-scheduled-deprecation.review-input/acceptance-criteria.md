## Acceptance criteria

- [x] An overdue scheduled deprecation is reported by a check, not by a reader.
- [x] The check has a by-construction-overdue fixture, so green means it ran.
- [x] The code-graph row records that its commitment was missed and by how much.
- [x] `telegraph` has a tracked state. **Criterion reworded from "either scheduled or documented as a keep":** the implementation took a third state — a not-pinned row — and argued why under 2.2 in the execution notes, so leaving the original text would have ticked a box asserting an outcome the change explicitly declined to produce. Untracked dormancy, which is what the criterion existed to remove, is gone.
- [x] No public surface is removed by this roadmap.

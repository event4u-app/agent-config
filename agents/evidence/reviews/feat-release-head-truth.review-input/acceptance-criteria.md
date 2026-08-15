## Acceptance criteria

- [x] A recall table for all five labels over six released spans exists and is
      cited from this roadmap.
      → `agents/evidence/analysis/release-head-derivation-recall.md` § 1, 30
      rows (5 labels × 6 spans).
- [x] The `11.0.0..12.0.0` span, replayed through the widened derivation,
      populates `Security and correctness`.
      → 8 hits, gate exit 1. Before/after recorded in the analysis file § 7.
- [ ] No previously-green released span turns red under the widened derivation
      (measured, not asserted).
      **MEASURED FALSE — this criterion does not hold as written.** Five of six
      previously-green spans turn red (10.1.0, 10.3.0, 10.4.0, 11.0.0, 12.0.0;
      only 10.2.0 stays green, because its head already carries a derived line
      rather than `_none_`). Analysis file § 5 carries the per-span table, and
      three facts that decide what it means: the reds are true positives at a
      hand-judged 96 %; this criterion and the one above it cannot both hold
      literally, since populating a green span's field is exactly what turns it
      red; and **no future release is red because of this** — the generator
      pre-fills every substantiated label, pinned as a regression test, so
      Risk 2 does not fire. Left open deliberately rather than ticked under a
      reading that would pass it. **The maintainer's call is registered as
      `blocker: ac3-false-positive-reading` above**, so the decision surfaces
      in `agent-config gates` rather than living only in this checkbox body.

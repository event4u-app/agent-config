## Acceptance criteria

- [x] The per-binding segment-drift table exists and states the
      code-vs-non-code ratio.
- [x] Phase 2 carries an explicit proceed or stop decision citing that ratio.
- [-] If Phase 2 proceeded: a test asserts that a code change accompanied by a
      roadmap edit still reports `stale`.
      → Conditional on a proceed; Phase 2 stopped.
- [x] Every `review-input/` directory carries a retention tier and a
      reproducible-or-not verdict.

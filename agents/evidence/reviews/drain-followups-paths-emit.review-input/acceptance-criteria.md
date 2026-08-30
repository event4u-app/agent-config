## Acceptance Criteria

- [ ] AC-1 — `mean_batch_size` has a second reading against a named post-change
      corpus, and the delta is recorded whichever direction it went — including
      "did not move".
- [ ] AC-2 — The 30-minute authorization window carries a recorded owner
      decision that `block_unauthorized_git.ts` cites, or an explicit recorded
      refusal to change it. Silence does not satisfy this.
- [x] AC-3 — A fresh install emits `paths:` for exactly the rules the emitter
      classifies path-only, and the activation census reports no divergence
      between its source verdict and the projection. **Met 2026-08-30 with one
      clarification the criterion needed and did not have: "exactly the rules
      the emitter classifies path-only" is FOUR in the source and THREE in any
      global delivery, because `source-of-truth` is package-only and withheld.
      The census now states that subtraction rather than reporting it as
      drift.**

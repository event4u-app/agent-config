## Acceptance Criteria

- [ ] AC-1 — Phase 0's correction is on `main` with an independent review, and
      the two orphaned regressions have an owner.
- [ ] AC-2 — The extended probe reproduces the Context figures from the tree,
      its class rows sum to its totals, and a planted regression reaches the
      self-repair queue.
- [ ] AC-3 — Phase 2's verdict is recorded before any lane or settle change
      lands.
- [ ] AC-4 — Net ticked steps and merges per night exceed the baseline over two
      consecutive two-week windows, with the share of merged PRs needing a
      follow-up fix commit not above its baseline.
- [ ] AC-5 — No refusal of a misfire class identified in 4.1/4.2 in the next
      window, the detector corpus still green, and `block_no_verify` still
      blocks every `git commit -n` form and every `--no-verify`.
- [ ] AC-6 — Every owner-reserved question in the window still reached the
      owner, and no PR merged without an explicit go.

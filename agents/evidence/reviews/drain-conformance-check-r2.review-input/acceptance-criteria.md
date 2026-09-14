## Acceptance Criteria

- [x] AC-1 — An absent transaction log on a path where one was expected yields an explicit unknown,
      never green, and a never-installed tree still passes.
- [x] AC-2 — The failure remedy names an action the tree performs, proven by a test that resolves
      it to real code.
- [ ] AC-3 — A headless install produces at least one log entry, and both writers emit an identical
      entry shape.
- [ ] AC-4 — The existing sabotage fixture reddens the check after a headless install.
- [x] AC-5 — The absent-log fixture was observed red before the fix, and the reading is recorded.
- [ ] AC-6 — A user-modified managed file survives a refresh and is named in the report.
- [x] AC-7 — The hash plumbing and the matrix change are separate commits.

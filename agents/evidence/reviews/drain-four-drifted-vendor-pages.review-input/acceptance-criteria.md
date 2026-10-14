## Acceptance Criteria

- [x] AC-1 — `check_host_docs_digest --fetch` exits 0 over the committed
      lowering table because all four rows carry a current digest and a
      forward `expires`, not because any row was removed, narrowed or
      exempted.
- [x] AC-2 — Each of the four re-reads has a recorded finding, including the
      rows where nothing this tree depends on changed, and no row's slots were
      edited without one.
- [x] AC-3 — The plumbing edit carries a ratification artifact whose
      `reviewed_by` differs from both `proposed_by` and `implemented_by`.

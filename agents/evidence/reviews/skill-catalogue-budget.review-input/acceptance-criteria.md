## Acceptance Criteria

- [x] **A:** a codex observation lands in the existing corpus with a dropped
      count taken from the host's own output, not from a self-report.
- [x] **A:** projected catalogue volume per host is a reportable number, and
      crossing a known limit is visible at deploy time rather than only inside
      a host session.
- [x] **A:** no host limit is declared without the measurement it came from.
- [x] **B:** a two-member council run either returns two answers or reports a
      verdict that cannot be mistaken for convergence.
- [~] **B:** the openai seat returns a live response from a worktree.
      **Deferred, and the reason is not the seat.** The argv the client now
      builds — `codex exec --json --skip-git-repo-check -`, no `--model` —
      returns a live answer from this worktree, verified directly on
      2026-08-15, and a test pins that the client builds exactly that argv.
      What blocks the *council-path* proof is the shared openai quota bucket,
      standing at **68/50**: a `--confirm` run refuses on `cli_quota_exhausted`
      before reaching the transport. Resetting a cap the user deliberately set
      is theirs (`council:quota --reset`), so the criterion is left open rather
      than closed on the two halves that were provable.
- [x] **C:** the corpus holds two hosts, and whether their truncation modes
      differ is published either way.
- [x] **C:** the parent's Phase 2 Step 2 condition is answered — discharged or
      explicitly still conditional.
- [x] No existing install has what it receives narrowed without an explicit
      answer from its owner. Nothing in Phases 1–3 narrows a projection; the
      only phase that could is 4, and it is blocked on its owner.
- [x] All quality gates pass — see `quality-tools`.

## Acceptance Criteria

- [x] **AC-1** F2 on a fixture declaring PHP 8.3 in a Dockerfile yields a T0
      `pre-announced` finding with no fixed version, and after the release
      fixture a `fix-available` one.
- [x] **AC-2** F1 yields one finding on the day of publication with the
      evidence of its source.
- [x] **AC-3** F4 yields `malware` without a CVE; F6 never yields "no
      findings"; F7 sends no private name; F10 issues one refresh.
- [x] **AC-4** `session_start` latency stays inside the baseline recorded in
      the sibling roadmap, with zero sockets in the hook process.
      *Measured 2026-10-21 on a freshly built bundle: `session_start` p95 126 ms, n=50 (`bench_hook_latency`); the notice reads one file. The worktree pass on the same slot runs only on the first session of a day: classification under a three-second deadline, the retro's own terms, and under `auto` up to three removals after it with their own timeouts (ADR-295).*
- [ ] **AC-5** `task ci` green.

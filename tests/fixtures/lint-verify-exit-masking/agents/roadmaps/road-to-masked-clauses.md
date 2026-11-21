---
status: ready
---
# Road to masked clauses

Fixture for `lint_verify_exit_masking`: two steps whose `verify:` clause reads
the exit code of `tail` or `echo` instead of the verifier's.

## Phase 1: Masked

- [ ] **1.1 Pipe into tail.**
      verify: `task ci | tail -3` -> 0
- [ ] **1.2 Trailing echo.**
      verify: `task test; echo done` -> 0

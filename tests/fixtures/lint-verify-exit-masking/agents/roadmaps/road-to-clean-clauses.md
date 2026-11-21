---
status: ready
---
# Road to clean clauses

Control fixture for `lint_verify_exit_masking`: the pipe is covered by
`pipefail`, so the exit code is the verifier's.

## Phase 1: Clean

- [ ] **1.1 Pipefail set first.**
      verify: `set -o pipefail; task ci | tail -3` -> 0
- [ ] **1.2 Listing piped into grep, nothing verified.**
      verify: `ls agents/evidence | grep -c x` -> /[1-9]/

#!/usr/bin/env bash
# B8 — the recorded proof-page demo (deterministic, agent-free).
#
# This is the SINGLE SOURCE for both surfaces:
#   1. `task record-proof-demo` records THIS script with asciinema → a GIF the
#      proof page embeds, so a skeptic sees the trust surface run green in <60s.
#   2. CI runs THIS script (.github/workflows/proof-demo.yml) as the
#      falsifiability lock — if any command here stops passing, the demo is
#      stale and CI goes red. The GIF's timing is not byte-reproducible, so the
#      lock is "the shown commands still pass", not a pixel diff.
#
# Every command below is an existing, agent-free, deterministic CI gate — the
# exact "verify it yourself" set from docs/proof.md. No live agent, no network.
set -euo pipefail

cd "$(dirname "$0")/../.."

# Run one trust command; show a green ✓ on success (several gates are silent on
# success, so make the pass visible), hard-fail red otherwise.
step() {
    local label="$1"
    shift
    printf '\n\033[1;36m$ %s\033[0m\n' "$label"
    if "$@" >/dev/null 2>&1; then
        printf '\033[32m   ✓ pass\033[0m\n'
    else
        printf '\033[31m   ✗ FAIL\033[0m\n'
        exit 1
    fi
}

step "task check-claims       # every public claim binds to resolvable evidence" task check-claims
step "task check-refs         # no broken internal references" task check-refs
step "task check-skill-gaps   # every known-limit cites a real witness test" task check-skill-gaps
step "task check-comparison   # every comparison-table pointer resolves" task check-comparison
step "task build-proof-check  # the proof page is in sync with its sources" task build-proof-check

printf '\n\033[1;32m✓ trust surface verified — reproduce any line on a fresh checkout.\033[0m\n'

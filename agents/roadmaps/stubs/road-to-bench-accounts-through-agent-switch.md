---
complexity: lightweight
review_by: 2027-01-31
---

# Stub: bench accounts through agent-switch

> **Stub — not active work.** Created 2026-11-05 by
> `road-to-benchmarks-in-clean-containers`. It is the agent-config half of
> agent-switch's `road-to-long-lived-tokens-and-mcp-switching` (step 2.3) and
> waits on that roadmap's Phase 0 gates.

## What exists

`bench_ab_v2_run --isolation container` reads subscription tokens from its own
pool (`~/.event4u/agent-config/secrets/claude-oauth-tokens/<account>`, mode 0600).
A sweep runs on one account (`--account`). When that account is exhausted, the
brake stops the sweep and names the other accounts that have a token. The runner
never switches accounts by itself.

## What this stub would add

When `agent-switch` is on PATH and holds a token for the profile, the runner
starts the docker client through `agent-switch exec`. agent-switch then supplies
the token by name, and the pool stays the fallback. At a limit the runner offers
the account `agent-switch dir --json --require-token` would pick; it never takes
that account without the user's confirmation.

## Promote when

agent-switch has shipped its Phase 1 (`token set|status`, injection in `launch()`)
under the ADR its Phase 0 requires.

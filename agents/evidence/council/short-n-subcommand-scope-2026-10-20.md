<!-- evidence-type: analysis -->

# One seat ratified the short-`-n` narrowing, and named a hole that is real

AI council, 2026-10-20, for `road-to-agent-throughput-recovery` step 4.3.
Seats configured: `anthropic/claude-sonnet-4-5` and `openai/codex-default`,
CLI transport, `$0.00` (both subscription-authed). **1 of 2 present after the
run — DEGRADED, which is not convergence.** The prompt is committed verbatim
beside this file as `short-n-subcommand-scope-2026-10-20.question.md`. Raw
response: `agents/runtime/council/responses/short-n-scope-20261020` (local,
gitignored).

## Why the second seat is absent, and why it matters beyond this round

`openai` exited 1 before answering, with one line on stderr:

```
ERROR codex_rmcp_client::oauth::refresh_transaction:
error=failed to refresh OAuth tokens for server linear-server:
OAuth refresh token was rejected: Server returned error response:
invalid_grant: Grant not found
```

The failing grant belongs to a `linear-server` MCP configured in the codex
CLI, unrelated to anything the council does. It is recorded here rather than
only in the blocker because it is not a property of this question: while it
stands, **no ADR-268 § 4 ratification in this repository can reach two
providers**, and `src/config/ratification-policy.json` requires
`required_providers: 2`. Blocker:
`openai-council-seat-oauth-grant-rejected`.

## The verdict that was given

`anthropic`: **`ratified`**, over two rounds with blind peer review.

- **Classification: authority-expanding.** The seat was explicit that
  `confirmed-non-expanding` is wrong here, and argued the point against a
  round-1 position that had called it non-expanding because no new security
  risk is introduced: "the agent previously couldn't execute `git push -n`,
  now it can. That's expansion, period." That matches the roadmap's own D5
  reading and is why a record exists at all.
- **The allowlist is correct.** Each of the 18 entries was checked
  independently; `commit` and `am` are correctly outside it; no allowlisted
  subcommand runs a hook that `-n` could skip.
- **The alias argument holds.** A builtin name cannot be shadowed by an
  alias, so `ci = commit` leaves `git ci -n` outside the allowlist and
  refused.
- **No new bypass is introduced.** The seat's reason for not refusing is
  stated plainly and is worth keeping: refusing "doesn't fix the pre-existing
  bypasses … It just keeps blocking legitimate commands while still missing
  the actual bypasses. That's security theater, not security."

## The two pre-existing holes it named — verified here, one confirmed

The seat named two bypasses it believed predate the change. Neither was taken
on the seat's word; both were run against the guard at `c43740e6b`.

**H1 — long-option abbreviation. CONFIRMED, and it is live.** Git accepts any
*unambiguous* prefix of a long option, and the guard matches the literal
`--no-verify` only.

```
$ ./scripts-run src/scripts/hooks/block_no_verify --command 'git commit --no-verif -m x'
exit 0        # the guard allows it
$ ./scripts-run src/scripts/hooks/block_no_verify --command 'git commit --no-verify -m x'
exit 1        # the literal is refused
```

Proven end to end in a scratch repository with a `pre-commit` hook that prints
to stderr and exits 1: `git commit --no-verif -m probe` **created the commit
and the hook never ran**. `--no-ver` and shorter are rejected by git itself
(`ambiguous option: no-ver (could be --no-verbose or --no-verify)`), so the
live window is `--no-verif` and `--no-verify`; `git push --no-verif` is
likewise allowed by the guard. This is a hook bypass the guard exists to
refuse and does not. It is **pre-existing** — present identically before step
4.3's change — and its fix is in the same gated file, so it waits on the same
absent seat.

**H2 — flags embedded in an alias definition. NOT reproduced; the allowlist
closes it.** The seat's example `git -c "alias.x=commit -n" x` is refused
today (exit 1), and would remain refused after the change: the resolved
subcommand is `x`, which is not a builtin and therefore not in the allowlist.
This is the fail-closed direction the allowlist was chosen for, and the
measurement confirms it rather than assuming it.

The seat's other two recommendations — correcting the documentation that says
`tag`/`log`/`rev-list` have no `-n` (they do, with harmless meanings) and
adding tests pinning the open holes — are carried into the roadmap as step
4.5, not silently dropped.

## What this record does and does not establish

It establishes one seat's reasoned `ratified` and one verified live defect. It
does **not** establish a ratification: `providers: [anthropic]` against
`required_providers: 2` is a refusal by the gate, correctly, and recording a
one-seat round as if it convened would be exactly the overclaim the
`seats:` field exists to prevent. No ratification artifact is written here.

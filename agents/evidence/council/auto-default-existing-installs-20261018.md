<!-- evidence-type: analysis -->

# Existing installs are asked once, never flipped; `auto` may default only for new installs

**Date:** 2026-10-18 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `auto-default-existing-installs-20261018.question.md`, beside this file
**Authority:** the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen")

## Verdict — (a), 2/2

| Seat | Choice | Owner-only |
|---|---|---|
| `anthropic` | **(a)** | no |
| `openai` | **(a)** | no |

Both seats: a one-time invitation that requires an affirmative answer is not a
silent change, so (a) keeps the `non-destructive-by-default` floor; (b) leaves
users who never update manually permanently unpatched under a no-backport
policy; (c) converts existing installs without consent.

**Conditions, both seats.** The invitation is shown only after the ring-0 exit
(four clean unattended releases) and after the live-session register (step 1.4)
exists; only in the host-native, interactive context step 4.3 describes, never
under CI, headless, non-TTY, `--json` or a subagent run; dismissal or
uncertainty keeps `notify`; the "never" is permanent and binding, with no
re-asking. Both asked for these guarantees to be written into the ADR.

The counter-argument each seat named: even one invitation is an interruption,
and (a) could become a floor that later relaxes to (c). The ADR records (c) as
not chosen.

Recorded as ADR-291.

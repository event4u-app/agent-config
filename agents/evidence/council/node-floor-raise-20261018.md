<!-- evidence-type: analysis -->

# The Node floor rises to 22 as a semver-major, pins moved atomically

**Date:** 2026-10-18 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `node-floor-raise-20261018.question.md`, beside this file
**Authority:** the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen")

## Verdict — (a), 2/2

| Seat | Choice | Owner-only |
|---|---|---|
| `anthropic` | **(a)** | no |
| `openai` | **(a)** ("Agree with (a), with one evidentiary caveat") | not stated; names no human action |

Both seats: Node 20 is past its upstream window, `SECURITY.md:21-22` backports
nothing, and the updater's `engines` refusal gate makes this the honest first
`action` release. Both prefer the raise to ride in the same major as the
planned settings-key removals, so consumers absorb one major transition rather
than two.

**Conditions, both seats.** `engines.node` (`>=22`) and every Node-20 CI site
(41 sites in 21 files as measured 2026-10-16) move in one change; migration
notes name the last Node-20-compatible version and state it gets no backports;
the refusal path is verified on Node 20 and a successful install on Node 22.

**The caveat `openai` recorded.** No consumer-usage evidence was supplied, so
the cost of stranding Node-20 installs is unmeasured; and the "false
compatibility signal" reading is overstated while the latest release still
supports Node 20. Recorded, not decisive for either seat.

Recorded as ADR-290.

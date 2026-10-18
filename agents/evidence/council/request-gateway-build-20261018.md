<!-- evidence-type: analysis -->

# The request gateway: build it, conditional on the human-run 7.2 probe

**Date:** 2026-10-18 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `request-gateway-build-20261018.question.md`, beside this file
**Authority:** the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen")

## Verdict — (a) conditional on 7.2, 2/2; the probe stays human residue

| Seat | Choice | Owner-only |
|---|---|---|
| `anthropic` | **(a)**, conditional on 7.2 passing | no — "the probe requires a human with a subscription, but the decision itself … is council-decidable" |
| `openai` | **(a)**, conditional on 7.2 passing | yes — "the human-run probe requires owner action; the conditional policy decision itself does not" |

The two seats agree on the substance: (b) knowingly makes the stated
typed-prompt goal unreachable, and the 2026-10-16 dissent's risks (new exposure
surface, two-class coverage) are bounded by the planned design only if 7.2
shows it workable. Their `OWNER-ONLY` answers differ only in what they label:
both say the policy decision needs no human and the probe does.

**Conditions.** 7.2 runs completely and passes before 7.3–7.7: subscription
OAuth forwards, thinking blocks survive deterministic rewriting, behaviour
without `count_tokens` is safe, each auth mode is classified, no deal-breaking
feature loss behind a non-first-party base URL, and bypass enforcement fails
closed. `openai` adds: acceptance criteria are written before the probe result
is read, a threat model, and a conspicuous per-session opt-in. If any critical
criterion fails, the answer falls back to (b) until the pinned host changes —
both seats, no further escalation needed.

## What this does not close

The blocker's resolution clause requires the 7.2 probe file, which needs a real
subscription login through a loopback base URL. That is a human-run step, so the
blocker stays open on it.

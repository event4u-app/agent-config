<!-- evidence-type: analysis -->

# Phase 6 spend is not authorised yet: the pre-registration computes the ceiling first

**Date:** 2026-10-18 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `procedure-cursor-spend-d13-20261018.question.md`, beside this file
**Authority:** the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen")

## Verdict — (c), 2/2

| Seat | Choice | Owner-only |
|---|---|---|
| `anthropic` | **(c)** | no |
| `openai` | **(c)** | not stated; names no human action |

Both seats: D13 required a stated maximum derived from a defined workload, and
none exists — no pre-registration, no pinned model, no transport, no per-run
estimate. A ceiling stated now would be invented, which is what D13 refused.
(b) was rejected because it is not established that the 180-run eval workload
runs on a subscription transport at all.

**Next steps, as both seats stated them.** Write 6.1–6.4 with the pinned model
and settings, the exact invocation path and transport, retry policy,
aggregation and confidence treatment; estimate tokens (a small, explicitly
non-measurement calibration or conservative limits) and translate them to a
worst-case USD amount at the applicable price; then return for authorisation
before any of the measured runs begin. `openai`: record a delegated spend
threshold separately if council authorisation of future spend is wanted —
`cost.budgets` is unset on every layer today.

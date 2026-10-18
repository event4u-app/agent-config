<!-- evidence-type: analysis -->

# `host-sync-layout-at-current-host`, round 2 — the routing test with the missing facts in hand

**Date:** 2026-10-18 · **Members:** `anthropic`, `openai` · **Mode:** prompt ·
**Quorum:** 2/2 · **Cost:** $0.00 (subscription transport, nothing billed)
**Prompt:** `canvas-host-sync-layout-r2-20261018.question.md`, beside this file, verbatim.

## Why a second round was legitimate

Round 1 (2026-10-16, recorded in `owner-blocker-routing-20261016.md`) split:
`anthropic` decided (b), `openai` escalated on the "cannot be bounded" row
because the roadmap did not say what step 5.2 delivers or what happens to 8.5.
Both facts were then written into the roadmap. The input changed, so the
question was put once more, its options unchanged, with one added candidate
(c): narrow 3.2 to the snapshot input and keep 5.2 open instead of dropping it.

## Verdicts

| Seat | Opening | (a) reserved? | (b) reserved? | (c) reserved? |
|---|---|---|---|---|
| `anthropic` | DECIDE (c) | no | **yes** — dropping 5.2 cancels a step | no — 5.2 stays open |
| `openai` | DECIDE (a) | no | **yes** — same clause | **yes as worded** — snapshot-only rewrote 3.2's local-bundle criterion |

`openai` named the fact that would flip its answer: rewrite (c) so that the
local-bundle input also stays open and blocked on the fixture, and it becomes
council-decidable and its preferred choice.

## What was recorded

The roadmap applies exactly that rewrite (decision D12): 3.2 keeps only the
snapshot-directory input and is no longer blocked; the local-bundle input is a
new open step 3.2b, blocked with 5.2 on the maintainer-run fixture of option
(a). No step is cancelled and no criterion is narrowed — the split moves half
of 3.2 into its own box. Option (b) was taken by neither seat; it stays
available to the owner only.

No third round was run: the rewrite is the change one seat specified, and it
preserves strictly more than the option the other seat decided.

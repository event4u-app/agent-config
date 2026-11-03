---
proposed_by: claude-opus-5-5/fix-steady-roi-freeze
implemented_by: claude-opus-5-5/fix-steady-roi-freeze
reviewed_by: ai-council/steady-roi-freeze-ratify (anthropic claude-sonnet-4-5 + openai codex-default, blind, subscription CLI)
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: 078da6eee89af361c118e0ef020c33c357c58d7799f357ec22920df10221d3d8
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — fix/steady-roi-freeze

Covers branch `fix/steady-roi-freeze`. Its one gated surface is the hook-bundle
byte ceiling.

| Surface | Change | Direction |
|---|---|---|
| `src/config/hook-bundle-budget.json` | `max_bytes` 1,581,000 → 1,582,000 B, with a `raise_log` entry | raises a byte ceiling; no gate stops running |

**Why.** `origin/main` is red on the bundle gate: PR #2816 merged after the
last raise and added 885 B (`design_pass_hook.ts` 456 B,
`web_launch_rows_loader.ts` 423 B, 6 B elsewhere, measured per module with the
esbuild metafile), while its rows already live in a conditional chunk outside
the bundle. Main builds to 1,581,318 B against 1,581,000 B. This branch touches
no hook; it cannot push while main fails the gate.

**Review.** One blind council round with a neutral two-question prompt and a
closed verdict vocabulary; both seats answered `ratified`. The orchestrator did
not review.

**Rollback.** Revert the commit; the gate then reports main's overage again.

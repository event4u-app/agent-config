---
complexity: lightweight
review_by: 2026-11-30
---

# Stub: road to adapter traces before the window

> **Stub — not active work.** Found in round `inbox-2026-11-k` (an open
> video-generation plan, re-verified at `6233ceedef`). It needs an owner
> decision and possibly paid provider calls, not effort.

**Trigger:** a date. All seven adapters whose header claims `stable` — `fal`,
`gemini-veo`, `higgsfield`, `kling`, `openai-images`, `replicate`, `sora` —
have their freshest reachable trace on 2026-06-10
(`docs/contracts/provider-lifecycle.md`, generated adapter-tier table).
`RECHECK_WINDOW_DAYS = 180` (`src/scripts/lint_adapter_tier.ts:97`), and a
`stable` header past that window is a failure (`lint_adapter_tier.ts:275-282`),
which CI runs. On **2026-12-07** the trunk turns red without any change.

**The owner chooses, per adapter, before 2026-12-07:**

1. **Re-capture** a smoke trace (a paid provider call per adapter; spend is
   owner-reserved), or
2. **Demote** the header to `experimental` with a reason — the lint never
   demotes for you, by design.

`sora` needs a primary-source read on its upstream status first; if it is
retired, demotion is the only honest option and `motion-choreographer` drops
its Sora mentions in the same change.

**Done when:** `lint_adapter_tier` run with the clock set to 2026-12-08 stays
green.

---
complexity: lightweight
review_by: 2027-02-28
---

# Stub: road to adapter traces before the window

> **Stub — not active work.** Found in round `inbox-2026-11-k`. **Decided
> 2026-11-02** by the AI council the owner delegated to (decision D1): all
> seven adapters whose `stable` claim rested on traces from 2026-06-10 —
> `fal`, `gemini-veo`, `higgsfield`, `kling`, `openai-images`, `replicate`,
> `sora` — were demoted to `experimental` before the 180-day window closed on
> 2026-12-07. Demotion is reversible; a council cannot authorize provider
> spend, so no re-capture was run.

**What is left here — the restore path, per adapter:**

1. a funded maintainer smoke trace (one paid provider call) under
   `agents/reference/ai-video/smoke-traces/`, recorded in the trace index;
2. the header back to `stable` in the same commit
   (`docs/contracts/provider-lifecycle.md` § 2).

`sora` first needs a primary-source read on its upstream status; if it is
retired, the right tier is `deprecated`, and `motion-choreographer` drops its
Sora mentions in the same change.

**Trigger:** a spend authorization for re-captures, or an adapter needed as a
silent default again.

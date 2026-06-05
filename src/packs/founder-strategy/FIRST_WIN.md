# First Win — Founder Strategy

**Time to first value:** ≈ 10 minutes from install to a refined investor memo.

## What you'll get

One investor question (e.g. *"Why now?"*) reshaped into a defensible memo that
names the market shift, the proof points, and the why-us angle — with the
strategic-safety floor's human-decides footer attached.

## The one workflow

```text
1. /refine-prompt "Why is now the right time for <your company>?"
2. → agent runs `refine-prompt` (clarifies audience, scope, success criterion)
3. → agent runs `vision-articulation` (why-now / why-us / why-this framing)
4. → agent runs `fundraising-narrative` (market shift, traction, ask)
5. → output written to agents/runtime/state/<timestamp>-investor-memo.md
```

## Expected output shape

A markdown memo with three sections:

- **Why now** — the market shift you can name in one sentence.
- **Why us** — the unfair advantage, evidence-backed.
- **What we're asking for** — round size, use of funds, milestone the round
  buys.

Footer reads:

> Strategic call belongs to a human. The agent surfaces trade-offs; the
> founder makes the call.

That footer is non-negotiable — see [`strategy-safety-floor`](../../.agent-src/rules/strategy-safety-floor.md).

## Screenshot

`docs/wizard/screenshots/founder-strategy-first-win.png` _(captured in Phase 5
of `road-to-role-first-onboarding.md`)_.

## What this does **not** do

- Does **not** value your company — that's `pack-finance-advanced` + `dcf-modeling`.
- Does **not** write the actual deck — narrative only; deck design is a
  designer's job.
- Does **not** auto-send anything — the memo stays on your disk.

## Next step

When the memo passes your read-aloud test, run `/grill-me` to stress-test it
against an adversarial-investor voice before you send it.

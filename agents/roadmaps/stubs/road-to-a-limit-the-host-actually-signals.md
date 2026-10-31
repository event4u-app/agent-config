---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: road to a limit the host actually signals

> **Stub — not active work.** Split out of round `inbox-2026-10-bm` (topic T1)
> because every item needs a live host observation, not effort: the host
> surfaces below are documented upstream but have not been observed in this
> repository, and the manifest admits no alias row before it is observed.
> The offline half shipped as `road-to-a-quota-signal-that-tells-the-truth`.

**Trigger:** one observed session on the maintainer machine, recorded per the
protocol in `src/agent-src/contexts/execution/host-capability-manifest.md`
(host version, raw payload, what fired), covering a plan-limit hit.

**What it settles, once triggered:**

- whether `Notification` fires with the `quota_auto_resume_*` matchers, and
  only then a `Notification` alias plus a record-only continuation concern;
- whether `StopFailure` arrives with `rate_limit` (only `server_error` has been
  seen) and which other classes appear, so the class table in
  `host_rate_marker_hook.ts` is confirmed;
- whether the status-line payload carries `cost`, `prompt_cache` and
  `spend_limit`, which a payload-derived billing class (with a `confidence`
  field) would read;
- the exact continuation prompt text after a reset, to extend the reset-prompt
  fixture beyond the sentence in `prompt_shape.ts`;
- binding `quota-notice` to the `stop` slot so a run without prompts still sees
  one notice (manifest edit, ships with a ratification artifact; the context
  line stays gated to prompts);
- a read-only `autoContinueAtUsageLimit` check in the doctor (AC never switches
  it on) and the shape of `claude agents --json` for `run_supervise`;
- the cost of one tap refresh at 0 / 64 / 256 KB ledger, which decides whether
  a single-read / dedup pass is worth doing.

**Kept out regardless:** no credential or token read, no unofficial endpoint,
no multi-account routing, no hard limit or start refusal, no dynamic subagent
cap, no unattended relaunch (that refusal stays with the council venue cited in
`src/scripts/_lib/quota_parked.ts`).

**Owner question parked here:** whether pace / allowance (fill against elapsed
window) become notice triggers or stay a displayed number; band values remain
with `stubs/road-to-a-quota-notice-that-earned-its-bands`.

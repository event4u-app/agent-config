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

> **Arrivals:** 1 — `inbox-2026-11-k` (2026-11-02).

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
- (from `road-to-a-return-that-names-its-price`, round `inbox-2026-11-b`)
  the cold transition: the status-line payload while warm, at the
  `expires_at` refresh and after the next prompt, comparing
  `recache_tokens_if_cold` with that request's
  `cache_creation_input_tokens + input_tokens`;
- what a `UserPromptSubmit` block leaves behind — prompt text kept in the
  input, in history, or lost (input for a one-shot cold-return block, owner
  question, default no);
- whether `claude --resume` past the TTL hands `SessionStart` the four fields
  `seconds_since_last_response`, `context_tokens`,
  `prompt_cache_likely_expired`, `estimated_cache_write_usd`;
- whether a 1h→5m `prompt_cache.ttl` flip on a plan login coincides with
  usage-credit draw (candidate input for `later/road-to-billing-cliff-detection`,
  not a signal until observed).

- (from round `inbox-2026-11-k`, a voice/attention plan) once `Notification`
  is observed: an attention signal that says *why* the run waits (permission,
  question, idle), deduplicated, rendered as a terminal sequence and optionally
  handed as text to a user-chosen command (`say`, `espeak-ng`) over stdin. A
  detached child that must read stdin needs `stdio: ['pipe','ignore','ignore']`,
  a write, then `unref` — `detached` with `stdio: 'ignore'` cannot pass text.
  Plus a host-event census (native event × aliased / unbound-by-decision /
  unknown). Nothing here before the observation.

**Kept out regardless:** no credential or token read, no unofficial endpoint,
no multi-account routing, no hard limit or start refusal, no dynamic subagent
cap, no unattended relaunch (that refusal stays with the council venue cited in
`src/scripts/_lib/quota_parked.ts`).

**Owner question parked here:** whether pace / allowance (fill against elapsed
window) become notice triggers or stay a displayed number; band values remain
with `stubs/road-to-a-quota-notice-that-earned-its-bands`.

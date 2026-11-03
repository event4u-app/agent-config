<!-- evidence-type: analysis -->

# Owner directive 2026-11-03 — raise the weekly trigger-eval ceiling to 240

Recorded from the owner's answer in the session that produced PR #2829
(round `inbox-2026-11-u`), asked as a single numbered-options question:

> The new hiring-loop-design trigger corpus pushes the weekly trigger-eval peak
> from 230 to 240 paid queries, over the MAX_WEEKLY_QUERIES ceiling of 230. How
> should PR #2829 resolve this?

Answer: **Raise to 240** — the recommended option, over "drop the hiring change"
(step 7.1 and its corpus carried to `later/`).

What this authorises, and nothing more:

- `MAX_WEEKLY_QUERIES` in `src/scripts/trigger_eval_rotation.ts` goes from 230
  to 240, with a dated paragraph beside the 220 and 230 raises.
- The cause, measured that day: `hiring-loop-design` hashes into slot 10 of the
  12-week rotation, which then holds 24 suites (slot 2 holds 23), a peak of 240.
- Rebalancing the slots and decoupling coverage from the paid replay stay
  rejected, as on 2026-10-14, 2026-10-27 and 2026-11-02. A 13-week cycle is not
  an option: it exceeds the 90-day freshness window.
- Reopen when a slot reaches 25 suites.

<!-- evidence-type: analysis -->

# Owner directive 2026-11-04 — refresh stale trigger evals gradually, via a roadmap

Recorded from the owner's answer in the session that produced PR #2841, asked as
a single numbered-options question after local `task ci` stopped at
`check-trigger-evals` (70 `src/skills/*/evals/triggers.json` files flagged at
`9f12d31f78`: 63 with `last_eval` older than 90 days, 7 with none):

> 1. Re-run all of them with paid API calls now, in a separate PR.
> 2. Create a roadmap that re-runs them gradually.
> 3. Take `check-trigger-evals` out of local `task ci`.
> 4. Leave it as it is.

Answer: **2** — the recommended option.

What this authorises, and nothing more:

- One new active roadmap, `road-to-trigger-evals-that-stay-fresh`, added without
  archiving another (`estate_offset_exempt`).
- No single paid batch re-run, and no `last_eval` bump without a run behind it.
- The spend stays inside the existing weekly rotation ceiling
  (`MAX_WEEKLY_QUERIES` = 240, owner directive 2026-11-03); raising it is not
  authorised here.

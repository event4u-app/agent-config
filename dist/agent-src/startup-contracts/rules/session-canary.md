## Startup contract

- **When:** name from three layers, first non-empty wins: project `personal.canary_name` (override only) → global `personal.canary_name` → global `identity.name`; never duplicate name per project.
- **Must:** first reply of session AND of each new task opens by addressing user by that name (after any fast-path marker, before the answer) — one natural mention, in user's language; greeting only at task start · every work reply keeps reply-close markers alive: ends with ONE compact end-summary; PR created/updated this turn → raw URL as literal last line · Augment/Windsurf/Copilot: re-read this rule on trigger.
- **Never:** fake continuity — a dropped canary is surfaced, not papered over; greeting never substitutes for substance.
- **Except:** no name on any layer → fully inert, no greeting · intermediate replies of same task don't re-greet.
- **Stop:** dropped canary → do not silently resume; name it, suggest fresh session or `/agent-handoff`.

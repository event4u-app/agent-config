---
model_tier: medium
name: profile:show
tier: 2
cluster: profile
sub: show
description: Show the active session profile — active packs and surfaced/hidden command+skill counts (observability surface)
suggestion:
  eligible: true
  trigger_description: "show my active profile, which packs are active, what's surfaced this session, profile status"
  trigger_context: "user wants to see the current session-profile state and what it hides"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /profile show

Observability surface for the session-profile overlay — the diagnostic the
council required so a "wrong commands in /help" symptom is one command away
from its cause.

## Instructions

### 1. Read the state

```bash
python3 -m scripts.config.session_profiles show --json
```

Fields: `active_packs`, `commands_shown`, `skills_shown`, `hidden_total`.

### 2. Report

- **No overlay** (`active_packs` empty):

  ```
  > no profile active — full surface (everything shown).
  ```

- **Overlay active:**

  ```
  > active packs: {active_packs}
  > surfaced: {commands_shown} commands, {skills_shown} skills
  > hidden behind inactive packs: {hidden_total}
  > clear with /profile deactivate
  ```

### 3. (Optional) list the split

If the user asks *which* artefacts are hidden, run:

```bash
python3 -m scripts.config.session_profiles surface --json
```

and list `hidden[]` (name + packs). Keep it scannable; group by pack if long.

## Gotchas

- `show` never writes — pure read, safe to run anytime.
- A corrupt overlay reads as empty (fail-open); if `show` reports "no
  profile" right after an `activate`, the overlay file is malformed —
  re-run `/profile activate`.

## See also

- [`/profile activate`](activate.md) · [`/profile deactivate`](deactivate.md)

---
model_tier: medium
name: profile-deactivate
pack: meta
tier: 2
cluster: profile
sub: deactivate
description: Deactivate the session profile — clear the overlay (or drop named packs) so the full surface returns
suggestion:
  eligible: true
  trigger_description: "deactivate the profile, clear my session profile, show everything again, reset the surface"
  trigger_context: "user wants the full command/skill surface back after a profile was active"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /profile deactivate

Clear the session-profile overlay (or remove only named packs). This is the
**explicit** deactivation trigger locked in Phase 0 (option a) — there is
no silent session reset.

## Instructions

### 1. Clear or narrow

- `/profile deactivate` (no args) → clear the whole overlay:

  ```bash
  python3 -m scripts.config.session_profiles deactivate --json
  ```

- `/profile deactivate <name…>` → remove only the **named packs** from the
  active set (never their closure), so a shared dependency survives:

  ```bash
  python3 -m scripts.config.session_profiles deactivate <name…> --json
  ```

Parse `active_packs` from the JSON.

### 2. Confirm

```
> profile cleared — full surface restored.
```

or, when packs remain:

```
> active now: {active_packs} — full surface for everything else.
```

### 3. Restore the full surface

Resume surfacing every command/skill from this point in the session.

## Gotchas

- Deactivation is idempotent — clearing an empty overlay is a no-op.
- Only named packs are removed: `/profile deactivate laravel` leaves `php`
  and `engineering-base` active (they are their own entries in the overlay).
  Removing a pack only ever widens the surface, never hides something.

## See also

- [`/profile activate`](activate.md) · [`/profile show`](show.md)

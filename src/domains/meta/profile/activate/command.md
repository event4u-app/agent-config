---
model_tier: medium
name: profile-activate
pack: meta
tier: 2
visibility: internal
cluster: profile
sub: activate
description: Activate a session profile — surface only the named profile/pack closure plus core artefacts, no persistence
suggestion:
  eligible: true
  trigger_description: "activate the laravel/po/finance profile for this session, switch my surface to X, only show me X commands"
  trigger_context: "user wants the surfaced commands/skills narrowed to one audience for the current session"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /profile activate

Activate one or more session profiles / packs. Writes the expanded
`runtime.active_packs` overlay and re-biases the surfaced set for the rest
of the session.

## Instructions

### 1. Resolve + write the overlay

Run the helper (it resolves aliases ↔ pack ids, fails fast on a
not-installed pack, expands the `requires_hint` closure, and writes the
overlay **atomically**):

```bash
python3 -m scripts.config.session_profiles activate <name…> --json
```

- **Exit 0** → parse the JSON: `active_packs`, `closure_added`, `notes`.
- **Exit 2** (`error:` on stderr) → the token is unknown or the pack is
  not installed. Surface the error verbatim and stop — do **not** write a
  partial overlay. Suggest `/profile show` or naming an installed pack.

### 2. Confirm the switch

Announce, using the helper's output:

```
> profile active: {active_packs}
> surfaced: {N} commands, {M} skills ({H} hidden behind inactive packs)
```

Get the counts from `python3 -m scripts.config.session_profiles show --json`.

### 3. Re-bias the surface for the rest of the session

From now until `/profile deactivate` (or a new session), when the user asks
"what can I do" / you list commands or skills, surface **only** the active
set. Compute it with:

```bash
python3 -m scripts.config.session_profiles surface --json
```

`shown` = surface these; `hidden` = do not list them proactively. Core /
unscoped artefacts are always in `shown`.

**Execution is NOT gated.** If the user invokes a command/skill that is in
`hidden`, run it anyway and prepend one line:

```
> note: `{name}` is from an inactive pack ({packs}); `/profile activate {pack}` to surface it.
```

## Gotchas

- Never write to `.agent-settings.yml` — the overlay is local-only.
- Multiple names union: `/profile activate laravel po`.
- A corrupt overlay is ignored (fail-open) → re-run activate to repair it.

## See also

- [`/profile show`](show.md) · [`/profile deactivate`](deactivate.md)
- [`docs/contracts/session-profile-overlay.md`](../../../docs/contracts/session-profile-overlay.md)

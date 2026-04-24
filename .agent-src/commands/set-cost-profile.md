---
name: set-cost-profile
description: Change the cost_profile in .agent-settings.yml — shows each profile's meaning and applies the selection
skills: [file-editor]
disable-model-invocation: true
---

# /set-cost-profile

Changes `cost_profile` in `.agent-settings.yml`. Four profiles defined in
[`agent-settings` template](../templates/agent-settings.md#cost-profiles):

- `minimal` · `balanced` · `full` · `custom`

`/set-cost-profile` (no arg) → interactive.
`/set-cost-profile <name>` → validate and apply directly.

## When NOT to use

- Other settings → [`/config-agent-settings`](config-agent-settings.md).
- Role modes → [`/mode`](mode.md) (sets `roles.active_role`, different concept).

## Steps

### 1. Parse argument

- `/set-cost-profile` → interactive (continue steps 2–5).
- `/set-cost-profile <name>` → validate against the 4 profiles. Unknown → refuse, list valid values.

Case-insensitive on input; file value stays lowercase.

### 2. Read settings

Read `.agent-settings.yml`. Missing → tell user to run `/config-agent-settings` first and stop. Do NOT create the file here.

Extract current `cost_profile`.

### 3. Load profile descriptions

Read `.augment/templates/agent-settings.md`, extract `## Cost profiles` section (table rows). Single source of truth — do NOT paraphrase or inline.

### 4. Show current state and options

Render current value + numbered choices with hints from step 3:

```
> Current: cost_profile = {current}
>
> 1. minimal — {hint from template}
> 2. balanced — {hint from template}
> 3. full — {hint from template}
> 4. custom — {hint from template}
> 5. Keep current — no change
```

If `<name>` passed as arg → skip the prompt, use directly. Still echo old → new in step 6.

### 5. Write the value

Update `cost_profile` in `.agent-settings.yml` using the same section-aware merge rules as `/config-agent-settings` (preserve comments, preserve key order, touch only the changed field).

"Keep current" → do nothing, stop.

### 6. Confirm

```
> cost_profile: {old} → {new}
```

New profile activates a surface (`balanced` → runtime dispatcher; `full` → tool adapters) → point user at `docs/customization.md` for setup. No inline setup here.

## Gotchas

- `.agent-settings.yml` is git-ignored — never committed.
- File values case-sensitive; input case-insensitive.
- Template is source of truth — changes reflect on next run.
- `custom` ignores the profile matrix — every per-feature toggle must be set explicitly. Warn when switching to `custom`.

## See also

- [`agent-settings`](../templates/agent-settings.md) — profile matrix and settings reference
- [`config-agent-settings`](config-agent-settings.md) — full settings sync (all keys)
- [`onboard`](onboard.md) — first-run setup (includes profile confirmation)
- [`mode`](mode.md) — role-mode setter (different concept)

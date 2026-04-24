---
name: set-cost-profile
description: Change the cost_profile in .agent-settings.yml — shows each profile's meaning and applies the selection
skills: [file-editor]
disable-model-invocation: true
---

# /set-cost-profile

Changes `cost_profile` in `.agent-settings.yml`. Four profiles are defined in
the [`agent-settings` template](../templates/agent-settings.md#cost-profiles):

- `minimal` · `balanced` · `full` · `custom`

`/set-cost-profile` without an argument asks interactively.
`/set-cost-profile <name>` validates and applies directly.

## When NOT to use

- For all other settings use [`/config-agent-settings`](config-agent-settings.md).
- For role modes use [`/mode`](mode.md) — different concept (sets
  `roles.active_role`, not `cost_profile`).

## Steps

### 1. Parse argument

- `/set-cost-profile` → interactive (continue with steps 2–5).
- `/set-cost-profile <name>` → validate `<name>` against the four defined
  profiles. If unknown, refuse and list the valid values.

Profile names are case-insensitive on input; the file value stays lowercase.

### 2. Read settings

Read `.agent-settings.yml`. If missing, tell the user to run
`/config-agent-settings` first and stop — do not create the file here.

Extract the current `cost_profile` value.

### 3. Load profile descriptions

Read `.augment/templates/agent-settings.md` and extract the `## Cost profiles`
section (table rows). This is the single source of truth for profile
meanings — do not paraphrase or inline descriptions in this command.

### 4. Show current state and options

Render the current value and present numbered choices with the hint text
extracted in step 3:

```
> Current: cost_profile = {current}
>
> 1. minimal — {hint from template}
> 2. balanced — {hint from template}
> 3. full — {hint from template}
> 4. custom — {hint from template}
> 5. Keep current — no change
```

If `<name>` was passed as argument, skip the numbered prompt and use that
value directly — still echo the old → new line in step 6.

### 5. Write the value

Update `cost_profile` in `.agent-settings.yml` using the same section-aware
merge rules as `/config-agent-settings` (preserve comments, preserve key
order, touch only the changed field).

If the user picked "Keep current", do nothing and stop.

### 6. Confirm

```
> cost_profile: {old} → {new}
```

If the new profile activates a surface the user hasn't used before
(`balanced` adds the runtime dispatcher, `full` adds tool adapters), point
the user at `docs/customization.md` for setup details — no inline setup
steps here, that's the docs' job.

## Gotchas

- `.agent-settings.yml` is git-ignored. This command never commits the file.
- Profile names are case-sensitive in the file; case-insensitive on input.
- The template is the source of truth for descriptions — if it changes,
  this command reflects the new text on next run.
- `custom` ignores the profile matrix — every per-feature toggle must be
  set explicitly afterwards. Warn the user when switching to `custom`.

## See also

- [`agent-settings`](../templates/agent-settings.md) — profile matrix and settings reference
- [`config-agent-settings`](config-agent-settings.md) — full settings sync (all keys)
- [`mode`](mode.md) — role-mode setter (different concept)

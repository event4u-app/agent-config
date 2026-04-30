---
name: set-cost-profile
description: Change the cost_profile in .agent-settings.yml — shows each profile's meaning and applies the selection
skills: [file-editor]
disable-model-invocation: true
---

<!-- cloud_safe: noop -->

# /set-cost-profile

Changes `cost_profile` in `.agent-settings.yml`. Four profiles are defined in
the [`agent-settings` template](../templates/agent-settings.md#cost-profiles):

- `minimal` · `balanced` · `full` · `custom`

`/set-cost-profile` without an argument asks interactively.
`/set-cost-profile <name>` validates and applies directly.

## When NOT to use

- For first-run setup use [`/onboard`](onboard.md).
- For any other single-value change, edit `.agent-settings.yml`
  directly or ask the agent — the merge rules live in
  [`layered-settings`](../guidelines/agent-infra/layered-settings.md#section-aware-merge-rules).
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
`scripts/install` first and stop — do not create the file here.

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

Update `cost_profile` in `.agent-settings.yml` using the
[section-aware merge rules](../guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)
(preserve comments, preserve key order, touch only the changed field).

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

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) this command is **fully inert** —
there is no `.agent-settings.yml` to write and no `cost_profile` toggle to
flip. Cost behaviour on those surfaces is governed by the platform itself.

## See also

- [`agent-settings`](../templates/agent-settings.md) — profile matrix and settings reference
- [`layered-settings`](../guidelines/agent-infra/layered-settings.md) — merge rules for settings edits
- [`onboard`](onboard.md) — first-run setup (includes profile confirmation)
- [`mode`](mode.md) — role-mode setter (different concept)

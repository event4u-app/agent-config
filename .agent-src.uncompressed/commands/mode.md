---
name: mode
description: Set the active role mode — prints the contract, lists default skills, and refuses work outside the contract (see role-contracts)
disable-model-invocation: true
---

# /mode

Sets `roles.active_role` in `.agent-settings.yml` and surfaces the active
contract before any work. Six modes are defined in
[`role-contracts`](../guidelines/agent-infra/role-contracts.md):

- `developer` · `reviewer` · `tester` · `po` · `incident` · `planner`

`/mode none` clears the active role. `/mode` without an argument prints
the current state (active role, default role, contract summary).

## When NOT to use

- The mode should be set automatically by the router in Phase 3 — use
  `/mode` only for explicit override or debugging.
- Do NOT invent new modes. If the work does not fit a contract, say so
  and fall back to no mode (per `ask-when-uncertain`).

## Steps

### 1. Parse argument

- `/mode` → show status only (steps 3–4).
- `/mode none` → clear `roles.active_role` (step 5).
- `/mode <name>` → validate against the six defined modes (step 2).

Anything else: refuse. List the valid values and stop.

### 2. Validate the mode name

Read [`role-contracts.md`](../guidelines/agent-infra/role-contracts.md).
Extract H3 headings under `## Contract skeletons` and lowercase them.
If `<name>` is not in that set, refuse and print the valid list.

### 3. Read settings

Read `.agent-settings.yml`. If missing, tell the user to run
`scripts/install` first and stop — do not create the file here.

Extract `roles.default_role` and `roles.active_role`.

### 4. Print the contract

Echo the full contract body for the target mode from `role-contracts.md`:

- Goal / Constraints / Output fields
- Default skills the mode loads first
- Structured mode marker the agent will emit when closing

Format: rendered Markdown excerpt, not a paraphrase. The user must see
exactly what the contract demands.

### 5. Write the active role

Update `roles.active_role` in `.agent-settings.yml` using the
[section-aware merge rules](../guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)
(preserve comments, preserve key order, touch only the changed field).

For `/mode none`: set `active_role: ""`.

Do NOT write anything for `/mode` without an argument (status only).

### 6. Refuse work outside the contract

Announce the switch as:

```
> entering {mode} mode — contract: {goal-field} / {constraints-field} / {output-field}
```

From this point in the session: the rule
[`role-mode-adherence`](../rules/role-mode-adherence.md) auto-triggers on
every closing output. If the user asks for work the contract forbids
(e.g. "just ship this fix" while in reviewer mode), reply with a single
numbered prompt:

```
> Current mode: {mode} — contract forbids {forbidden-action}.
>
> 1. Switch mode — run /mode <other>
> 2. Stay in {mode} and scope the work to the contract
> 3. Clear mode — run /mode none
```

## Output format

```
> entering {mode} mode — contract: …
>
> Default skills: {skill-a}, {skill-b}, {skill-c}
> Closing marker: <!-- role-mode: {mode} | contract: … -->
```

For `/mode` (status only):

```
> Active role: {active_role or "(none)"}
> Default role: {default_role or "(none)"}
```

## Gotchas

- `.agent-settings.yml` is git-ignored. `/mode` never commits the file.
- If the file is missing the `roles:` section, add it in the correct
  place (between `subagents:` and EOF) using the template layout.
- Mode names are case-sensitive in the file; case-insensitive on input.
- The contract is the source of truth, not this command — if the
  guideline changes, this command reflects the new contract on next run.

## See also

- [`role-contracts`](../guidelines/agent-infra/role-contracts.md) — the six modes
- [`role-mode-adherence`](../rules/role-mode-adherence.md) — closing-output gate
- [`layered-settings`](../guidelines/agent-infra/layered-settings.md) — merge rules for settings edits
- [`ask-when-uncertain`](../rules/ask-when-uncertain.md) — never invent modes

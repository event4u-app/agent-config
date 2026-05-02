---
name: sync-agent-settings
description: Sync `.agent-settings.yml` against the current template + profile — adds new sections/keys, preserves user values, shows a diff before writing
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Settings sync — must be deliberate."
---

<!-- cloud_safe: noop -->

# /sync-agent-settings

Reconciles `.agent-settings.yml` with the shipped template
(`config/agent-settings.template.yml`) and the selected cost-profile
preset (`config/profiles/{profile}.ini`). Applies the section-aware
merge rules documented in
[`layered-settings`](../../docs/guidelines/agent-infra/layered-settings.md):

- Template section order wins — keys reorder to match.
- Existing user scalar values are preserved.
- Missing keys land with their template / profile default.
- Template comments replace user comments in the same position.
- Unknown user keys (not in the template) are preserved under a
  trailing `_user:` block so custom additions never vanish silently.

Idempotent. Safe to run after every package update.

Use when:

- A new package version added sections (e.g. `chat_history`,
  `onboarding`) that your local file is missing.
- A key moved sections (e.g. `pr_comment_bot_icon` from `project` to
  `personal`) and you want the reshuffle applied.
- You edited the file by hand and want to normalize formatting.

## When NOT to use

- To change a value (`ide`, `cost_profile`, `max_parallel`) → edit the
  file directly or ask the agent; the sync only reconciles structure.
- To create `.agent-project-settings.yml` (team file) → that is a
  separate concern; this command only touches the developer file.
- To migrate a legacy flat `.agent-settings` → run
  `python3 scripts/install.py` first; the installer owns migrations.

## Steps

### 1. Locate script and target

The sync script ships in the installed package. Resolve in order:

1. `./agent-config/scripts/sync_agent_settings.py` — CLI wrapper at the project root.
2. `vendor/event4u/agent-config/scripts/sync_agent_settings.py` — Composer.
3. `node_modules/@event4u/agent-config/scripts/sync_agent_settings.py` — npm.

Target is always `<project_root>/.agent-settings.yml`.

### 2. Dry-run — show the user what would change

Run the script with `--dry-run` and capture stdout. Three outcomes:

- **No changes** (exit 0, stdout contains `already in sync`) → tell the
  user and stop. No prompt needed.
  ```
  > ✅ .agent-settings.yml already in sync — nothing to do.
  ```
- **Drift detected** → show the unified diff and ask:
  ```
  > 📝 /sync-agent-settings would update .agent-settings.yml:
  >
  > {diff}
  >
  > 1. Apply — write the changes
  > 2. Skip — leave the file untouched
  ```
- **Script error** (exit 2, e.g. template or profile missing) → print
  the error and stop; do not prompt.

### 3. Act on the choice

- `1` (Apply) → re-run the script **without** `--dry-run`. Confirm:
  ```
  > ✅ .agent-settings.yml updated.
  ```
  Then re-run with `--check` to confirm idempotency.
- `2` (Skip) → stop. No changes made.

Free-text replies (`"nö"`, `"leave it"`, unrecognized input) count as
`2`. Never write on ambiguous input.

### 4. Profile override

The script auto-detects the profile from the target's `cost_profile`
key and falls back to `minimal`. To sync against a different profile
(e.g. during a profile change), pass `--profile balanced` or
`--profile full` — but ask the user first; changing the profile is a
separate decision from reconciling structure.

## `--check` mode

`sync_agent_settings.py --check` exits **2** if the file is out of
sync, **0** otherwise — suitable for CI. Emit no diff prompt in
check-only workflows; report the drift and let the pipeline decide.

## Gotchas

- **Unknown keys end up under `_user:`.** They are not deleted, but the
  user should review and either upstream them (propose a template key)
  or remove them. The block carries a comment explaining this.
- **Bare lowercase identifiers stay unquoted** (`per_turn`, `rotate`,
  `phpstorm`). Everything else (names, paths, empty strings) stays
  quoted. That is intentional — idempotency depends on it.
- **Comments from the template win.** If you added a note above a key,
  the sync replaces it with the template comment. Put notes in a
  separate file if you need them to survive syncs.
- Changes to `config/agent-settings.template.yml` or the profile
  presets require a package update in the consumer project before
  this command can apply them.

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) this command is **fully inert** —
there is no `.agent-settings.yml` on disk, no `scripts/sync_agent_settings.py`
to call, and no template/profile preset reachable. Settings reconciliation
is a local-agent concern.

## See also

- [`scripts/sync_agent_settings.py`](../../../scripts/sync_agent_settings.py) — the helper
- [`config/agent-settings.template.yml`](../../../config/agent-settings.template.yml) — canonical template
- [`config/profiles/`](../../../config/profiles/) — profile presets
- [`layered-settings`](../../docs/guidelines/agent-infra/layered-settings.md) — the merge rules this command enforces
- [`scripts/install.py`](../../../scripts/install.py) — first-install path; this command handles the update path
- [`/sync-gitignore`](sync-gitignore.md) — sibling command for the `.gitignore` block

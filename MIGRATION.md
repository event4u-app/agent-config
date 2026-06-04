# Migrating to 6.0

> Upgrading an existing install to the **6.0 experience-first** layout.
> One command does the work: **`npx @event4u/agent-config migrate`**.
> For the full breaking-change log see [`CHANGELOG.md`](CHANGELOG.md).

6.0 is a structural release. Two things changed that a long-lived
install can trip over:

1. **npx-only runtime.** The package is consumed through its published
   binary (`npx @event4u/agent-config …`), never by reaching into
   `node_modules/@event4u/agent-config/{scripts,templates,config}/…`
   directly. Those internal trees moved under `src/` in 6.0 — any path
   you hardcoded into a script or CI step is gone. Call the binary
   instead.
2. **Profiles, packs, and verb-slug commands.** The surface is now a
   focused per-profile command set (`agent-config setup` picks the
   profile), capability **packs** are renamed to capability names, and
   visible commands use `<pack>-<verb>` slugs (e.g. `commit` →
   `git-commit`, `create-pr` → `git-pr-create`). Old invocations keep
   routing through `replaces:` aliases until the alias window closes in
   6.1 — so existing muscle memory and docs keep working through one
   more minor.

The `migrate` command performs the **install-side** cleanup
(deletion-over-migration): it removes legacy package entries + symlinks
+ project-local config so the wizard can recreate fresh config. It does
**not** rewrite your command invocations — the `replaces:` aliases do
that at routing time.

## Quick start

```bash
# 1. See whether you're on the old layout and what would change (no writes).
npx @event4u/agent-config migrate --check        # exit 0 = clean, 2 = pending

# 2. Preview the exact actions (no writes).
npx @event4u/agent-config migrate --dry-run

# 3. Apply.
npx @event4u/agent-config migrate

# 4. Recreate fresh project + global config.
npx @event4u/agent-config setup
```

`--from 4` / `--from 5` optionally declares your source major (4.x =
composer-era, 5.x = npx-era). Detection is signal-based, so the flag is
advisory — it documents intent and warns on a mismatch; it never
changes which actions run. Full behaviour:
[`docs/contracts/migrate-command.md`](docs/contracts/migrate-command.md).

## From 4.x → 6.0

4.0 was the unified-wizard hard-cut: the Fastify wizard
(`agent-config install` / `setup`) replaced the legacy Python / standalone
installers. A 4.x consumer typically still carries one or more of:

- a `event4u/agent-config` entry in `composer.json` (composer-era), or
  an `@event4u/agent-config` entry in `package.json`;
- managed symlinks (`.augment`, `.claude`, `.cursor`, `.clinerules`,
  `.windsurfrules`) pointing into `vendor/` or `node_modules/`;
- a project-local `.agent-settings.yml` / `.agent-user.yml` (flat or
  under `settings/`);
- a v0 work-engine state file (`.implement-ticket-state.json`).

`migrate` strips the package entries, deletes the legacy symlinks,
converts the v0 state file to `.work-state.json` (keeping a `.bak`),
hard-deletes the project-local config, drops the empty `agent-config/`
shell, and refreshes the managed `.gitignore` block. Then run
`agent-config setup` — the wizard writes fresh config from your chosen
profile. Rollback is git: the migration only deletes tracked /
recreatable artefacts, so `git restore` / `git checkout` reverts it.

## From 5.x → 6.0

5.x removed `scripts/install.py` from the npx flow (the `curl | bash`
fallback retired) and is otherwise npx-native, so a 5.x consumer is
already close to the 6.0 shape. The two deltas:

- **Internal paths moved under `src/`.** If any of your scripts or CI
  steps reference `node_modules/@event4u/agent-config/scripts/…` (or
  `templates/` / `config/`), repoint them to the published binary —
  `npx @event4u/agent-config <command>` — rather than the moved
  internal path. The package no longer publishes those trees at the
  old top-level locations.
- **Command renames.** Pack-rename + verb-slug invocations (above) take
  effect; the `replaces:` aliases keep your old invocations routable
  through 6.1, but update docs/scripts to the canonical slugs at your
  convenience.

`migrate --check` reports whether any legacy install signal remains;
on a clean 5.x→6.0 consumer it exits 0 with
`✅  on the 6.0 layout — no migration needed.`

## What `migrate` does not touch

- It never rewrites your command invocations (the `replaces:` alias map
  handles old → new slugs at routing time).
- It never lifts stale project YAML into global config — the wizard
  recreates config fresh (deletion-over-migration). See
  [`docs/contracts/migrate-command.md` § Excluded](docs/contracts/migrate-command.md).

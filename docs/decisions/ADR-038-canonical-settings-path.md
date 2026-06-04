# ADR-038: Canonical settings path is `agents/settings/.agent-settings.yml`

- **Status:** Accepted
- **Date:** 2026-06-01

## Context

The project's settings *layer* lives under `agents/settings/` — it already
holds `contexts/`, `policies/`, and the per-machine override
`.agent-settings.local.yml` (relocated there by `4f887ae8`). The main
developer settings file, however, stayed at the repo root as
`./.agent-settings.yml`: `agent_settings.py` (`DEFAULT_PROJECT_FILE`),
`install.py` (`SETTINGS_FILE`), `sync_agent_settings.py` (`DEFAULT_SETTINGS`),
and ~30 reader scripts all hardcode the root path. The split is inconsistent —
the override sits in the settings layer while the file it overrides sits at the
root — and surfaced as a real defect: roadmaps and contributors referenced
`agents/settings/.agent-settings.yml` (the location they expected), which then
failed `check-references` because no such canonical file existed.

Both files are gitignored (`.gitignore` matches the `.agent-settings.yml`
basename anywhere) and per-machine; neither is ever committed.

## Decision

The canonical project settings file is **`agents/settings/.agent-settings.yml`**,
co-located with the rest of the settings layer. The repo-root
`./.agent-settings.yml` becomes a **back-compat read-fallback only**.

- **Read precedence (deepest wins):** legacy root `.agent-settings.yml`
  < canonical `agents/settings/.agent-settings.yml` < per-machine
  `agents/settings/.agent-settings.local.yml`.
- **Write target:** always `agents/settings/.agent-settings.yml`
  (`canonical_settings_write_path`). The legacy root file is migrated into
  the canonical location, never written afresh.
- **Resolution helper:** `project_settings_path()` returns the canonical file
  when present, else the legacy root file when present (back-compat), else the
  canonical path (fresh repo). All direct readers route through it.
- **Migration:** `install` and the `migrate` command relocate an existing root
  `./.agent-settings.yml` to `agents/settings/.agent-settings.yml` once; no
  consumer install breaks because the fallback keeps the old location readable
  until it is moved.

## Consequences

- Settings layout is internally consistent: the main file and its override live
  together under `agents/settings/`.
- Existing installs keep working unchanged until migrated (read-fallback).
- One-time cost: ~36 Python reader sites + the TS settings server/CLI route
  through the helper; install/sync/migrate gain the relocation step; docs and
  the gitignore-managed block name the canonical path.
- The `.gitignore` basename match already covers the canonical path — no new
  ignore entry required.

## Amendment — 2026-06-03 · dev-mode resolution semantics

Recorded alongside [`ADR-049`](ADR-049-configuration-trust-boundary.md) so a
future contributor does not read `AGENT_CONFIG_DEV_MODE=1` as a settings-scope
escape hatch.

When `AGENT_CONFIG_DEV_MODE=1` (`scripts/install.py` treats the package repo as
both source and project surface, per [`ADR-020`](ADR-020-global-only-consumer-scope.md)):

- The package repo's `agents/settings/` **is** the project surface — its
  `.agent-settings.yml` / `.ai-council.yml` are the maintainer's test fixtures
  for exercising the loader against real files, not a workaround.
- The user-global layer (`~/.event4u/agent-config/`) still provides the
  whitelisted identity keys and provider secrets exactly as in a consumer install.
- **No special merge logic.** The normal cascade composes (user-global whitelist
  → project-canonical → local override). Dev-mode changes *which directory* is the
  project surface, never *which keys* may cascade — the `MERGEABLE_KEYS` trust
  boundary from [`ADR-049`](ADR-049-configuration-trust-boundary.md) holds
  unchanged.

## Alternatives considered

- **Keep root canonical (status quo).** Rejected: leaves the override/main-file
  split inconsistent and keeps surfacing as wrong-path references.
- **Hard cut, no fallback.** Rejected: breaks every existing install (and this
  repo) until each re-runs setup; the fallback is cheap insurance.

## References

- `scripts/_lib/agent_settings.py` — resolver cascade + `project_settings_path` / `canonical_settings_write_path`.
- `4f887ae8` — prior relocation of `.agent-settings.local.yml` into `agents/settings/`.
- `docs/guidelines/agent-infra/layered-settings.md` — precedence model.
- `docs/contracts/migrate-command.md` — migration surface.

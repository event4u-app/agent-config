---
stability: stable
---

# Consumer Bridge Marker (retired)

**Status:** Retired — [`ADR-020 § Amendment 2026-07-13`](../decisions/ADR-020-global-only-consumer-scope.md#amendment--2026-07-13--bridge-marker-retired).
**Pairs with:** [`ADR-020 — global-only consumer scope`](../decisions/ADR-020-global-only-consumer-scope.md), [`ADR-007 § Amendment 2026-05-13`](../decisions/ADR-007-agent-discovery-scopes.md#amendment-2026-05-13--augment-global-only).

## Why it was retired

The bridge marker `agents/.event4u-bridge.yml` was a per-project file that
pointed at the global install. It carried **no project-specific data**:
`global_root` is always the well-known `~/.event4u/agent-config` (one global
install per machine), and nothing in the codebase ever read the field — the
loader, doctor, and conformance checks all derive the global root independently
via `user_global_paths.event4u_root()`. Yet the marker was **committed** to the
shared project tree and rewrote its volatile `installed_at` / `installer_version`
fields on every install, so each developer's install produced a diff and
overwrote every other developer's committed copy. A file whose scope (global)
did not match its location (per-project, committed) — pure churn.

It is retired: the global root is resolved directly from the well-known path.

## What replaced it

- **Global-root resolution** — `user_global_paths.event4u_root()` returns
  `~/.event4u/agent-config` (overridable via `EVENT4U_CONFIG_HOME`). Readers fail
  closed when that path is missing on disk. No per-project pointer is consulted.
- **Migration-idempotency sentinel** — moved to
  `agents/.agent-state/install-mode.txt` (written on every full / minimal
  install), which the installer's legacy-detection and the doctor's
  "global-only consumer" branch key on. `agents/overrides/` is an equivalent
  signal.
- **Project anchor** — a bare consumer `agents/` directory is anchored on
  `agents/overrides/` (the guaranteed minimal-consumer surface), not the marker.
- **Cleanup** — the installer and `agent-config refresh --project` delete any
  legacy `agents/.event4u-bridge.yml` a prior install committed; the managed
  `.gitignore` block also ignores it so a stale copy is never re-committed.

## Per-tool anchor strategy (still active)

Some AI tools only load rules when an anchor file is **inside** the workspace
(Windsurf, Cline, Gemini-CLI). For those IDs the installer plants a thin pointer
file under the tool's per-project directory:

```yaml
schema: event4u-bridge/v1
tool: windsurf
global_root: ~/.event4u/agent-config
installed_at: 2026-07-13T00:00:00Z
```

- Files: `.windsurf/agent-config.bridge.yml`, `.clinerules/agent-config.bridge.yml`,
  `.gemini/agent-config.bridge.yml`.
- `global_root` is the well-known path (readers expand `~` against the current
  `$HOME`, never the writer's). There is no `bridge:` back-pointer — the retired
  marker no longer exists to point at.
- These anchors are **gitignored**: each developer regenerates them on install,
  so they never churn in version control. Tools that load purely from user scope
  (Claude Code, Cursor, Augment) need no per-tool file.

## Legacy reader note

A `v1` marker left in an un-migrated consumer repo still parses as before
(`schema: event4u-bridge/v1`, `~`-expanded `global_root`). Do not add new readers
of it — resolve the global root from the well-known path instead. The next
install removes it.

## References

- [`ADR-020`](../decisions/ADR-020-global-only-consumer-scope.md) — global-only consumer scope + the 2026-07-13 retirement amendment.
- [`ADR-007`](../decisions/ADR-007-agent-discovery-scopes.md) — scope precedence and the global-default amendment.

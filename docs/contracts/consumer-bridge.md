# Consumer Bridge Marker

**Status:** Proposed — road-to-global-only-install Phase 4.1.
**Pairs with:** [`ADR-020 — global-only consumer scope`](../decisions/ADR-020-global-only-consumer-scope.md), [`ADR-007 § Amendment 2026-05-13`](../decisions/ADR-007-agent-discovery-scopes.md#amendment-2026-05-13--augment-global-only).

## Purpose

After Phase 3 of `road-to-global-only-install` lands, a consumer
project carries **only** `agents/overrides/` plus this bridge marker.
Every other agent artefact (rules, skills, commands, personas,
settings, user identity) is read from `~/.event4u/agent-config/`. The
bridge marker is the single, declarative pointer that lets per-tool
adapters (Windsurf, Cline, Gemini-CLI, the Augment workspace
projector) locate the global root from inside the repo.

## File

`agents/.event4u-bridge.yml` at the consumer project root. <!-- ref-ignore -->
Written by `scripts/install.py` on every successful consumer install
(global scope). Idempotent — same file, refreshed `installed_at`.

## Schema

```yaml
schema: event4u-bridge/v1
global_root: ~/.event4u/agent-config
installed_at: 2026-05-23T14:00:00Z
installer_version: 2.4.0
```

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `schema` | string | yes | Must equal `event4u-bridge/v1`. Bumped on breaking field changes. |
| `global_root` | string | yes | Absolute path or `~`-prefixed path to the global install. Readers MUST expand `~` against the current user's `$HOME`. |
| `installed_at` | string (ISO-8601 UTC) | yes | Timestamp of the last successful install or refresh. |
| `installer_version` | string (semver) | yes | Version of `@event4u/agent-config` that produced the marker. |

Unknown fields are ignored by `v1` readers (forward-compat).

## Reader contract

Per-tool adapters MUST:

1. Read `agents/.event4u-bridge.yml` from the project root. <!-- ref-ignore -->
2. Reject `schema != event4u-bridge/v1` with a clear error pointing at this contract.
3. Expand `~` in `global_root` against the **current process's** `$HOME` (not the writer's).
4. Fail closed if `global_root` is missing on disk — never silently fall back to project-local lookup.
5. Treat the marker as **read-only data**. Adapters MUST NOT write back through it.

## Writer contract

`scripts/install.py` MUST:

1. Write the marker atomically (temp file + rename) so a crash never leaves a half-formed pointer.
2. Refresh `installed_at` + `installer_version` on every consumer-scope install.
3. Use `0644` permissions (world-readable, owner-writable). The marker contains no secrets.
4. Skip the write under `AGENT_CONFIG_DEV_MODE=1` — maintainer dev installs never lay the bridge into the source repo (this repo's `agents/` directory is the project surface, not a consumer surface).

## Per-tool anchor strategy

Some AI tools only load rules when an anchor file is **inside** the workspace (Windsurf, Cline, Gemini-CLI). For those IDs, Phase 4.3 plants a thin pointer file under the tool's per-project directory whose body resolves to the bridge marker. Tools that load purely from user-scope (Claude Code, Cursor, Augment) read the marker once and need no per-tool file.

## Out of scope

- Cross-machine sync of `~/.event4u/agent-config/` (the marker is local-only).
- Editing the marker by hand to swap installs (use `agent-config init --global-root=…` instead, once that flag ships in Phase 5).
- Multi-tenant `global_root` (one marker = one global install per project).

## References

- [`ADR-020`](../decisions/ADR-020-global-only-consumer-scope.md) — global-only consumer scope; cites the in-flight roadmap for Phase 4 surface design + Phase 5 migration order.
- [`ADR-007`](../decisions/ADR-007-agent-discovery-scopes.md) — scope precedence and the global-default amendment.

# Installed-Tools Manifest

Project-committed bill of materials for AI tooling. Answers the
question "which AIs does this project use, where do their bridges live,
and is everyone on the team on the same set?". Canonical schema is
ADR-008 ([`docs/decisions/ADR-008-installed-tools-manifest.md`](../../decisions/ADR-008-installed-tools-manifest.md)).
Delivered under the global-first-install roadmap (Phase 3) — see
`agents/roadmaps/` for current status.

This file lives at **`agents/installed-tools.lock`** — committed,
machine-managed, and orthogonal to `.agent-project-settings.yml`
(which owns *behaviour*, not *bill of materials*).

## Schema (v1)

```yaml
schema_version: 1
agent_config_version: "2.x.y"          # last package version that wrote the file
tools:
  - name: claude-code                  # must match _VALID_TOOLS in scripts/install.py
    scope: global                      # one of: global, project
    bridge_marker: ~/.claude/          # validate checks this path exists
    installed_at: "2026-05-12"
  - name: roocode
    scope: project                     # workspace-wins → must live in repo
    bridge_marker: .roo/rules/agent-config.md
    installed_at: "2026-05-12"
```

| Field | Owner | Notes |
|---|---|---|
| `schema_version` | machine | bumps on breaking schema changes |
| `agent_config_version` | machine | last writer's package version; `validate` flags drift |
| `tools[]` | machine | append-on-init order preserved (not alphabetised) |
| `tools[].name` | machine | one of the 17 valid IDs in `scripts/install.py` |
| `tools[].scope` | machine | `global` (user-home) or `project` (workspace bridge) |
| `tools[].bridge_marker` | machine | absolute / `~`-prefixed for global, repo-relative for project |
| `tools[].installed_at` | machine | ISO date; informational only |

The file is **machine-managed**. Hand-editing is discouraged — every
mutation goes through `init`, `sync`, or `init --force`.

## Workflow

### Team onboarding (clone → sync → done)

```bash
git clone <repo>
cd <repo>
npx @event4u/agent-config sync
```

`sync` reads `agents/installed-tools.lock`, checks every listed tool's
bridge marker, and replays `install.py --tools=<id>` for each missing
one. Tools whose marker is already present are skipped — `sync` is
idempotent and safe to re-run.

### Adding a tool

```bash
npx @event4u/agent-config init --tools=<id>
# or --tools=<id1>,<id2>
```

`init` writes an entry per tool. Existing entry with the same
`(name, scope)` → no-op. Entry with **different scope** → loud warning
and refusal until you pass `--force` (see scope migration below).

### Drift detection (CI gate)

```bash
npx @event4u/agent-config validate
```

Read-only. Exit code 1 if any drift is found. Surfaces three drift
kinds; no auto-fix.

| Kind | Trigger | Fix |
|---|---|---|
| `marker_missing` | recorded `bridge_marker` does not exist | `agent-config sync` |
| `scope_divergence` | marker only exists at the *other* scope | `agent-config init --tools=<id> --force` |
| `version_drift` | manifest's `agent_config_version` ≠ installed package | `agent-config update` then `agent-config init --force` |

`--skip-version-check` suppresses the third kind for repositories that
intentionally pin an older version of the manifest.

## Scope migration

Under [ADR-020](../../decisions/ADR-020-global-only-consumer-scope.md)
global is the only consumer scope. Consumers carrying a pre-2.5
project-scope payload move to global with the one-shot
`npx @event4u/agent-config migrate` subcommand — it removes the
legacy project artefacts in one opinionated pass (deletion-over-
migration policy); the wizard recreates fresh global config on the
next `agent-config setup`. See
[docs/contracts/migrate-command.md](../../contracts/migrate-command.md)
for the full action matrix.

For maintainers running `AGENT_CONFIG_DEV_MODE=1`, project-scope
re-installs remain available; the installer still detects scope
conflicts and refuses to rewrite without `--force`. `validate`
afterwards confirms the new state.

Reasoning: scope is a project-wide decision; flipping it silently
would surprise other team members who never asked for the change. The
loud refusal forces an explicit `--force` so the diff is reviewable in
the next commit.

## Relationship to other files

| File | What it answers | Layer |
|---|---|---|
| `agents/installed-tools.lock` | **which AIs?** (this guideline) | bill of materials |
| `.agent-project-settings.yml` | **how do agents behave?** | layered-settings (team file) |
| `~/.event4u/agent-config/installed.lock` | **which package version did I install globally?** | per-developer global lockfile (Phase 1; legacy `~/.config/agent-config/installed.lock` read as fallback) |
| `.agent-settings.yml` | **what are my personal preferences in this project?** | layered-settings (developer file) |

Each file has one job. They never overlap. The two `.lock` files look
similar by name but answer different questions: `installed.lock` is
per-developer / cross-project (the package itself), while
`installed-tools.lock` is per-project / team-shared (which tools are
expected in *this* repo).

## CI integration

Recommended gate (GitHub Actions / GitLab CI):

```yaml
- name: Validate installed-tools manifest
  run: npx @event4u/agent-config validate
```

Pair it with `agent-config sync` in your dev-setup script so new
contributors get a working environment without reading the manifest by
hand.

## References

- [`ADR-008`](../../decisions/ADR-008-installed-tools-manifest.md) — manifest decision and schema.
- [`ADR-007`](../../decisions/ADR-007-agent-discovery-scopes.md) — global-first install (prerequisite).
- [`docs/installation.md`](../../installation.md) — team-onboarding flow.
- [`layered-settings.md`](layered-settings.md) — parallel settings hierarchy (orthogonal to this manifest).

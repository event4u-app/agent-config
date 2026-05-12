# Installed-Tools Lockfile — Wire Contract

Canonical wire-format spec for `agents/installed-tools.lock` — the
project-committed bill of materials for AI tooling installed into this
repository.

- **Authoritative module:** [`scripts/_lib/installed_tools.py`](../../scripts/_lib/installed_tools.py)
- **ADR:** [`docs/decisions/ADR-008-installed-tools-manifest.md`](../decisions/ADR-008-installed-tools-manifest.md)
- **Workflow guide:** [`docs/guidelines/agent-infra/installed-tools-manifest.md`](../guidelines/agent-infra/installed-tools-manifest.md)
- **Active roadmap:** P1.1 of [`agents/roadmaps/road-to-multi-package-coexistence.md`](../../agents/roadmaps/road-to-multi-package-coexistence.md)

## Versions

| Version | Status | Writer | Reader |
|---|---|---|---|
| **1** | legacy | not emitted by current code | tolerated by `read_manifest` |
| **2** | current | `write_manifest` always emits this | tolerated by `read_manifest` |

`SCHEMA_VERSION = 2` · `SCHEMA_VERSIONS_SUPPORTED = (1, 2)`. The reader
must accept any version in `SCHEMA_VERSIONS_SUPPORTED`; the writer must
always emit the highest. Bumps are breaking on the writer side and
require a migration plan.

## Schema v2 — wire format

```yaml
schema_version: 2
agent_config_version: "2.2.0"
deploy_roots:                          # optional, top-level (P1.1)
  - .augment/rules
  - .cursor/rules
tools:
  - name: claude-code                  # one of _VALID_TOOLS
    scope: global                      # global | project
    bridge_marker: ~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG
    installed_at: "2026-05-12"
    status: installed                  # optional: installed | uninstalling (P2.2)
    files:                             # optional, per-tool (P1.1)
      - path: .augment/rules/r1.md
        kind: deployed                 # one of FILE_KINDS
        sha256: "<64 hex chars>"
      - path: .cursorrules
        kind: bridge
        sha256: null                   # null permitted for non-content markers
    merged_keys:                       # optional, per-tool (P1.1)
      - file: .mcp.json
        json_pointer: "/mcpServers/agent-config"
```

### Top-level fields

| Field | Type | Owner | Notes |
|---|---|---|---|
| `schema_version` | int | machine | always `2` on write |
| `agent_config_version` | str | machine | last writer's package version |
| `deploy_roots` | list[str] | machine | optional; directories the doctor command surveys for foreign files. Omitted when empty. Falls back to `DEFAULT_DEPLOY_ROOTS` when consumers need a survey scope and no explicit list is present. |
| `tools` | list[obj] | machine | install-order preserved, not alphabetised |

### Per-tool fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | str | yes | one of `_VALID_TOOLS` in `scripts/install.py` |
| `scope` | str | yes | `global` (user-home) or `project` (workspace bridge) |
| `bridge_marker` | str | yes | absolute / `~`-prefixed for global; repo-relative for project |
| `installed_at` | str | yes | ISO date; informational only |
| `status` | str | no | `installed` (default when absent) or `uninstalling`; reserved for two-phase uninstall (P2.2) |
| `files` | list[obj] | no | content the installer deployed for this tool |
| `merged_keys` | list[obj] | no | named keys this tool inserted into shared JSON files |

### `files[]` entries

| Field | Type | Notes |
|---|---|---|
| `path` | str | repo-relative for project-scope, `~`-prefixed for global |
| `kind` | str | one of `FILE_KINDS = {bridge, deployed, marker}` |
| `sha256` | str / null | 64 hex chars of the file's SHA-256 at install time, or `null` for markers / pointers without content |

`kind` semantics:

- **`bridge`** — team-pointer marker like `.cursorrules` or `.windsurf/PROJECT_MANAGED_BY_AGENT_CONFIG`. Existence-tracked, content-untracked.
- **`deployed`** — bundle content the installer wrote (e.g. `.augment/rules/*.md`). Content-tracked via `sha256` so drift is detectable.
- **`marker`** — one-off sentinel (e.g. `claude-desktop` install marker). Existence-only.

### `merged_keys[]` entries

| Field | Type | Notes |
|---|---|---|
| `file` | str | repo-relative path to the shared file (e.g. `.mcp.json`) |
| `json_pointer` | str | RFC 6901 pointer. **Constraint:** must target an object key, never an array index. Array-index pointers shift on neighbour-tool uninstall and corrupt other packages' ownership. |

The pointer constraint is enforced at write time in P1.5; readers in v2.x
must reject manifests that contain array-index pointers.

## Compatibility — reader tolerance

- `read_manifest` accepts both v1 and v2 wire formats.
- When `pyyaml` is available, v2 round-trips fully.
- When `pyyaml` is missing, the manual fallback parser extracts v1-equivalent fields (top-level scalars + per-tool scalar fields) and **silently drops** v2 nested fields (`files`, `merged_keys`, `deploy_roots`). Callers that need full v2 fidelity must ensure `pyyaml` is on the path.

## Compatibility — writer behaviour

- `write_manifest(path, version, tools, *, deploy_roots=None)` always emits `schema_version: 2`.
- Optional v2 fields (`deploy_roots`, per-tool `files` / `merged_keys` / `status`) are emitted only when non-empty, so a v1-shaped call produces a v2 file that is structurally minimal and v1-readable for the core fields.
- All writes are crash-safe via [`scripts/_lib/fs_atomic.py`](../../scripts/_lib/fs_atomic.py) (`write_atomic`: tmp + fsync + rename + parent-dir fsync). See P1.0 of the multi-package roadmap.

## Determinism

Required by P1.3 (not yet enforced in v2.0 of the writer):

1. `tools[]` order = install order (no re-sort).
2. `files[]` order within a tool = sorted by `path` ascending.
3. `merged_keys[]` order within a tool = sorted by `(file, json_pointer)` ascending.
4. `deploy_roots[]` order = as supplied by the writer (caller-controlled).

Determinism is what lets the doctor command produce stable diffs across team members.

## Inline package tag (P5 — non-authoritative)

Deployed Markdown files may carry a frontmatter tag that records provenance for human readers:

```yaml
---
title: My rule
package: event4u/agent-config
source_path: config/rules/general.md
---
```

Properties:

- **Optional.** Files without a leading `---` frontmatter block are deployed as-is; no synthetic frontmatter is added (P5.1).
- **Human-readable only.** The lockfile remains the single source of truth for ownership, prune, and uninstall decisions. Removing or hand-editing the inline tag does **not** alter prune / uninstall semantics (P5.3).
- **Surfaced by doctor.** A frontmatter-bearing file whose `package:` value disagrees with this writer's identifier — or whose `package:` key has been removed — appears under the `tag-drift` category of `agent-config doctor` (P5.2). Tag-drift exit code = 1, same as other drift; fix hint points at `--force` re-install.
- **Idempotent.** Re-installation rewrites the same `package:` / `source_path:` values; running install twice produces byte-identical Markdown.
- **`source_path:` (not `source:`).** The injected provenance-path key is named `source_path:` to avoid collision with the established `source: package` origin-type marker used by 200+ rule files in this and downstream packages. The injector treats `source:` as a foreign key and never rewrites it.

Neighbour packages writing into the same project SHOULD use their own `package:` identifier so doctor can distinguish authored ownership at a glance, but they MUST still register their files in the manifest — the inline tag is a UX affordance, not a substitute for the lockfile entry.

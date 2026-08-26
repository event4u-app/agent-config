---
stability: beta
keep-beta-until: 2026-08-12
---

# Installed-Tools Lockfile — Wire Contract

Canonical wire-format spec for `agents/installed-tools.lock` — the
project-committed bill of materials for AI tooling installed into this
repository.

- **Authoritative module:** [`src/scripts/_lib/installed_tools.ts`](../../src/scripts/_lib/installed_tools.ts)
- **ADR:** [`docs/decisions/ADR-008-installed-tools-manifest.md`](../decisions/ADR-008-installed-tools-manifest.md)
- **Workflow guide:** [`docs/guidelines/agent-infra/installed-tools-manifest.md`](../guidelines/agent-infra/installed-tools-manifest.md)
- **Active roadmap:** none. `road-to-multi-package-coexistence` was archived;
  this contract is not currently driven by an open roadmap.

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
| `status` | str | no | `installed` (default when absent) or `uninstalling`; two-phase uninstall (P2.2). A crashed uninstall leaves the entry in `uninstalling` — `agent-config prune --resume-uninstall` sweeps only those entries' `files[]` without touching healthy tools or unmanaged drift. |
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

## Absence — what a manifest-less tree means, and what `doctor` says

Recorded 2026-08-26 (`road-to-internal-estate-fit` 0.2). AI council 2/2
convergent on **report-and-offer** over silent-null and over a hard failure.

```
AN ABSENT PROJECT MANIFEST IS NOT AUTOMATICALLY A DEFECT.
A CONSUMER INSTALL IS GLOBAL-ONLY BY ADR-020, SO IT HAS NONE BY DESIGN.
REPORT THE ABSENCE, EXPLAIN WHAT IT COSTS, PRINT THE COMMAND — NEVER WRITE ONE
UNASKED, AND NEVER PROMPT INSIDE A DIAGNOSTIC.
```

### Why silent-null was rejected

It was the behaviour in force, and it is the reason four of four inspected
consumer repositories drifted unnoticed: `doctor` could not distinguish
*"healthy"* from *"unable to assess health"*, and reported the two identically.

### Why a hard failure was rejected

Every pre-manifest install would red at once, and the fastest fix a user finds
is to stop running the check. The roadmap registered this as its rank-1 risk
before the decision was taken.

### The three states, and their exit codes

| Tree | What it means | `doctor` says | Exit |
|---|---|---|---|
| No manifest, **consumer install marker present** | Global-only install. **Expected under ADR-020** — there is nothing to write. | informational: *"global-only consumer: install marker present, no project lockfile (expected under ADR-020)"*, and project-manifest checks are **skipped**, not failed | **0** |
| No manifest, **no install marker** | Indeterminate. Either pre-manifest, or a genuine gap. | warning naming the tree, plus the two commands that resolve it (`init` for a project install, `refresh --project` for a global-only consumer) | **2** |
| Manifest present | Assessable. | the ordinary drift report | 0 / 1 on findings |

**Exit 0 on the expected case is deliberate.** A finding that reports an absence
guaranteed by an ADR is noise, and noise is what teaches a maintainer to bypass
a gate.

**Indeterminate must not be described as benign OR as defective.** The wording
above says what is unknown and what would resolve it, and says nothing about
which of the two it is.

### The offer is a printed command, never a write

No automatic write and no interactive prompt. Both would break CI use, and an
automatic write contradicts the suite's propose-never-silent-run discipline.
A command the human runs is the whole offer.

Note what such a command can and cannot do, because it is easy to expect too
much: writing a manifest from current state **baselines whatever drift already
exists**. It makes future drift detectable; it does not certify the present.

### The distinction this contract does NOT yet draw

**Pre-manifest** (installed before the manifest existed — benign, migratable)
versus **regressed** (the writer should have written one and did not — a
defect). Both council seats wanted them reported differently, and both noted the
same obstacle: no stable local marker currently establishes which one a given
tree is. A package version alone does not, because an installer bug or a
bypassed path produces the same absence.

So the two collapse into the single **indeterminate** row above, and that is
recorded as a known limitation rather than papered over with a guess.
**Revisit-if:** the installer gains deterministic provenance metadata that
distinguishes them, or manifest creation has been the documented default for a
full release cycle and the distinction stops mattering.

### Strict mode

A repository that has adopted the invariant can opt into failing on absence
rather than reporting it. That is an **opt-in** flag, never a default — the
default must not red every pre-manifest install.

### Not to be confused with the user-global lockfile

`agents/installed-tools.lock` is **project-scope**. `~/.event4u/agent-config/installed.lock`
is **user-global**, has a different schema, and is what `write_lockfile`
(`src/scripts/_lib/installed_lock.ts:228`) writes on all five of its call sites.
A consumer install writes the second and never the first.

Conflating the two is not hypothetical: it produced a whole planning phase built
on the wrong file, discovered only when a scratch install was actually run. The
table above is here rather than in that plan precisely so the next reader meets
it at the contract instead of rediscovering it.

**The open question the conflation was hiding**, recorded here because it
outlives any plan that raises it: *does repository-specific install verification
justify reopening ADR-020's global-only decision?* It is owner-reserved — it
changes what a consumer install writes into a consumer's repository. Until it is
answered, per-repository projection state is **unverifiable by design**: one
lockfile per user cannot say what a particular repository received, whether its
files changed afterwards, or whether it took part in the recorded install at
all.

## Compatibility — reader tolerance

- `read_manifest` accepts both v1 and v2 wire formats.
- When `pyyaml` is available, v2 round-trips fully.
- When `pyyaml` is missing, the manual fallback parser extracts v1-equivalent fields (top-level scalars + per-tool scalar fields) and **silently drops** v2 nested fields (`files`, `merged_keys`, `deploy_roots`). Callers that need full v2 fidelity must ensure `pyyaml` is on the path.

## Compatibility — writer behaviour

- `write_manifest(path, version, tools, *, deploy_roots=None)` always emits `schema_version: 2`.
- Optional v2 fields (`deploy_roots`, per-tool `files` / `merged_keys` / `status`) are emitted only when non-empty, so a v1-shaped call produces a v2 file that is structurally minimal and v1-readable for the core fields.
- All writes are crash-safe via [`scripts/_lib/fs_atomic.py`](../../src/scripts/_lib/fs_atomic.ts) (`write_atomic`: tmp + fsync + rename + parent-dir fsync). See P1.0 of the multi-package roadmap.

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

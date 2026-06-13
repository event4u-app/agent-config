---
adr: 009
status: accepted
date: 2026-05-13
decision: event4u-namespace-and-claude-desktop-zip-bundles
supersedes: —
superseded_by: —
phase: v2.4 · namespace-and-claude-desktop
---

# ADR-009 — `~/.event4u/agent-config/` namespace + Claude Desktop ZIP bundles

## Status

**Accepted** · 2026-05-13 · signed off by Matze after the user ask
*"auf globaler ebene sollen unsere dateien in einem  <!-- md-language-check: ignore -->
.event4u/agent-config Folder im user ordner landen"* combined with the
Claude Desktop deployment gap surfaced in the same turn (the v1
`marker-only` integration did not actually make any skill visible to
the Customize → Skills panel). Implementation tracked in
[`agents/roadmaps/road-to-event4u-namespace-and-claude-desktop.md`](../../agents/roadmaps/road-to-event4u-namespace-and-claude-desktop.md).

## Context

ADR-007 made global-first install the default and seeded the
user-scope state at `~/.config/agent-config/` (XDG-style). Two pain
points surfaced in production use:

1. **Namespace collision risk.** `~/.config/agent-config/` is a
   generic-sounding path. Future tools owned by event4u (or
   third-party suites named `agent-config`) would step on the same
   prefix. The user requested a vendor-owned umbrella:
   `~/.event4u/agent-config/`.
2. **Claude Desktop deployment was a stub.** `scripts/install.py`
   wrote a `claude-desktop.md` marker file under
   `~/.config/agent-config/claude-desktop/` and called it done. Claude
   Desktop does **not** auto-discover skills from any filesystem path
   — the user must upload each skill through **Settings → Customize →
   Skills → Upload**. Research against an external reference suite
   and the Anthropic Skills API docs confirmed there is no public
   bulk-upload API for personal installs (the `/v1/skills` endpoint is
   workspace + code-execution gated).

Tool anchors (`~/.claude/`, `~/.augment/`, `~/.cursor/`,
`~/.codeium/windsurf/`) are owned by the host tool and must **not** be
moved — those paths are conventionalised by the tool itself.

## Decision

Two coordinated moves:

### 1. Package-owned user-scope state lives under `~/.event4u/agent-config/`

| Old path                                            | New path                                                |
|-----------------------------------------------------|---------------------------------------------------------|
| `~/.config/agent-config/agent-settings.yml`         | `~/.event4u/agent-config/agent-settings.yml`            |
| `~/.config/agent-config/installed.lock`             | `~/.event4u/agent-config/installed.lock`                |
| `~/.config/agent-config/installed-tools.yml`        | `~/.event4u/agent-config/installed-tools.yml`           |
| `~/.config/agent-config/update-check.json`          | `~/.event4u/agent-config/update-check.json`             |
| `~/.config/agent-config/ai-council/`                | `~/.event4u/agent-config/ai-council/`                   |

Path resolution lives in `scripts/_lib/user_global_paths.py`:

- `event4u_root()` — primary path; honours `EVENT4U_HOME` override.
- `legacy_xdg_root()` — read-only fallback for unmigrated installs.
- `resolve(name)` — returns the primary path; if absent and the legacy
  copy exists, returns the legacy path. Writes always target the
  primary path.

A one-shot auto-migration shim runs on first post-upgrade
`init`/`update`/`uninstall`:

1. If `~/.event4u/agent-config/` already exists → no-op.
2. Otherwise, copy every file from `~/.config/agent-config/` to the
   new path, preserving mtimes.
3. Drop a `MIGRATED.md` breadcrumb in the legacy dir pointing at the
   new home. Legacy files stay readable; loaders fall back to them
   until the next install overwrites the primary path.

Tool anchors are **untouched**. The umbrella applies only to
package-owned files.

### 2. Claude Desktop deployment = per-skill ZIP bundles

`scripts/_lib/claude_desktop_bundler.py` walks `.claude/skills/`,
dereferences symlinks, and packs each `<skill-name>/` folder into a
self-contained ZIP under
`~/.event4u/agent-config/claude-desktop/bundles/<skill-name>.zip`.

- Exclusions: `__pycache__/`, `.git*`, `*.pyc`, `.DS_Store`.
- Atomic writes via `tempfile` + `os.replace`.
- SHA-256 sidecar (`<name>.zip.sha256`) drives content-hash idempotency.
- Repeat runs write 0 bundles when source unchanged; `--force` rebuilds.

The user imports the ZIPs manually via Claude Desktop → Settings →
Customize → Skills → Upload. The install summary surfaces the bundle
path and count so the user can paste it into Finder / Explorer.

## Consequences

### Positive

- **Vendor namespace is reserved.** Future event4u-owned packages can
  drop sibling dirs under `~/.event4u/` without colliding with the
  XDG-shape of other suites.
- **Claude Desktop integration is real.** v2.4 produces 276 ZIPs from
  the package's own `.claude/skills/` and the import flow is
  click-through, no terminal.
- **Migration is zero-action.** Existing users keep working — the
  shim copies on first install and the legacy fallback covers any
  loader that hasn't been re-run yet.
- **Override-friendly.** `EVENT4U_HOME` lets CI / sandbox / multi-tenant
  layouts redirect the root without monkey-patching.

### Negative

- **Manual upload step for Claude Desktop.** Until Anthropic ships a
  public per-user Skills API, every fresh install / bundle refresh
  requires the user to re-upload through Customize. The bundle count
  in the install summary is the closest we can get to closing this loop.
- **Two read paths during transition.** Loaders must consult both
  `event4u_root()` and `legacy_xdg_root()` for the next two minor
  versions. Once usage telemetry shows the legacy dir is consistently
  empty, we can retire the fallback.
- **Symlink semantics differ across platforms.** The bundler
  `dereferences` symlinks during ZIP creation; on Windows this means
  skills must not rely on cross-volume symlinks at pack time.

### Neutral

- Tool anchors (`~/.claude/`, `~/.augment/`, …) keep their owner. This
  ADR explicitly does **not** propose moving them under
  `~/.event4u/`.

## Rollback / kill-switch

If the migration corrupts user state, the rollback path is **manual but
zero-data-loss** by design:

1. **Legacy tree is never auto-deleted.** Even after the breadcrumb is
   written, `~/.config/agent-config/` retains every file. The user can
   reinstate it by deleting `~/.event4u/agent-config/` and re-running
   `bash install.sh --global` — the shim will re-copy from the legacy
   tree if the new root is absent.
2. **Per-entry atomic write.** Each top-level entry is copied to a
   sibling `<name>.event4u-partial-<pid>` and then `os.replace`'d into
   place. A crash mid-copy leaves `*.event4u-partial-*` debris that the
   next run purges before retrying — a partial subdirectory is never
   mistaken for a completed copy.
3. **`EVENT4U_HOME` env override.** A user who needs to point the
   resolver at a known-good state (e.g. a restored backup) can set
   `EVENT4U_HOME=/path/to/restored/agent-config` without editing any
   config file.
4. **Bundler is hash-gated.** If `claude_desktop_bundler.py` ever
   produces a corrupt ZIP, the SHA-256 sidecar diverges from the source
   manifest and the next run rewrites it. `--force` forces a full
   rebuild from scratch.
5. **Out-of-scope failure modes.** Disk exhaustion mid-copy, permission
   bit corruption on cross-filesystem moves, and unicode-NFC normalisation
   drift on macOS HFS+ → APFS migrations are **not** auto-recovered.
   Users hit by those run the manual rollback in step 1.

## Alternatives considered

1. **Symlink `~/.event4u/agent-config/` ↔ `~/.config/agent-config/`.**
   Rejected: doubles the surface (loaders still need both paths in
   memory) and creates a removal hazard (`rm -rf ~/.config/agent-config`
   wipes the new home too).
2. **Anthropic `/v1/skills` API client for Claude Desktop.** Rejected:
   the endpoint is workspace + code-execution gated, not viable for
   personal installs. Captured as a follow-up if user demand surfaces.
3. **Single mega-ZIP of all skills.** Rejected: Customize → Skills
   imports one skill per ZIP. A combined archive would require the
   user to extract + re-zip locally, defeating the purpose.
4. **Hard-cut migration (delete legacy on first run).** Rejected: a
   crash mid-copy would leave the user with neither path readable.
   The current shim is copy-then-breadcrumb, leaving the legacy dir
   intact for at least one more cycle.

## References

- [`agents/roadmaps/road-to-event4u-namespace-and-claude-desktop.md`](../../agents/roadmaps/road-to-event4u-namespace-and-claude-desktop.md)
- [`scripts/_lib/user_global_paths.py`](../../src/scripts/_lib/user_global_paths.py)
- [`scripts/_lib/claude_desktop_bundler.py`](../../src/scripts/_lib/claude_desktop_bundler.py)
- [`docs/setup/per-ide/claude-desktop.md`](../setup/per-ide/claude-desktop.md)
- [`docs/migration/v1-to-v2.md`](../migration/v1-to-v2.md) § v2 → v2.4
- ADR-007 (predecessor — global-first install scopes)
- ADR-008 (sibling — installed-tools manifest)

/**
 * Core types for the unified TypeScript install engine (v4.0.0).
 *
 * Mirrors the on-disk schema used by the legacy Python installer
 * (`scripts/install.py`) so the v4 engine reads/writes the same
 * `~/.event4u/agent-config/` tree and v2 manifest entries without a
 * migration step.
 *
 * Phase A1 — foundation. Sub-types referenced by `detect`, `plan`,
 * apply, and conflict-resolution modules. Pure types, no runtime
 * dependencies.
 *
 * Reference: `scripts/install.py`
 *   - `_file_entry()` → {@link FileEntry}
 *   - `class ConflictPolicy` → {@link ConflictPolicy}
 *   - v2 manifest `files_by_tool` → {@link InstallPlan.filesByTool}
 */
export {};
//# sourceMappingURL=types.js.map
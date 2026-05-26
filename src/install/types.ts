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

/**
 * Where the install lands.
 *
 * - `global`  — `~/.event4u/agent-config/` (user-scope, shared across projects).
 * - `project` — the current project root (`.augment/`, `.claude/`, bridges).
 *
 * The Python script uses the `scope` string ("global" | "project") for the
 * same distinction; this enum is the TS-side equivalent.
 */
export type InstallTarget = 'global' | 'project';

/**
 * Kind of file recorded in a v2 `files[]` manifest entry.
 *
 * Matches the literal string values produced by `_file_entry()` in the
 * Python installer so a v3 manifest round-trips through the v4 engine
 * without rewriting on-disk records.
 *
 * - `deployed` — content we own bytes-for-bytes (hash recorded).
 * - `marker`   — content we own at a known marker path (hash recorded).
 * - `bridge`   — pointer to a foreign tool's config (no hash; we do not own bytes).
 */
export type FileKind = 'deployed' | 'marker' | 'bridge';

/**
 * One file the install plan will touch.
 *
 * Mirrors the dict produced by `_file_entry(path, kind, hash_content=...)`
 * in `scripts/install.py:2744`. `sha256` is `null` for bridges (we do
 * not own the bytes) and a hex digest for deployed/marker files.
 *
 * `path` is the absolute target path on disk — the v2 manifest is
 * path-only at the wire level because user-scope files are not under
 * `project_root`.
 */
export interface FileEntry {
    /** Absolute target path on disk. */
    readonly path: string;
    /** What kind of file this is — drives hash and conflict policy. */
    readonly kind: FileKind;
    /** SHA-256 hex digest, or `null` for bridges. */
    readonly sha256: string | null;
}

/**
 * How to resolve a file collision.
 *
 * Per Phase A5 of the unified-setup roadmap: three modes only.
 *
 * - `skip`           — leave the existing file untouched (default safe behaviour).
 * - `overwrite`      — replace the existing file with the planned content.
 * - `surface-to-ui`  — defer to the wizard's conflict screen (Phase B3).
 *
 * The CLI `--force-overwrite` flag is the headless mapping for `overwrite`.
 */
export type ConflictStrategy = 'skip' | 'overwrite' | 'surface-to-ui';

/**
 * Per-install conflict resolution policy.
 *
 * 1:1 mirror of `class ConflictPolicy` in `scripts/install.py:169`.
 *
 * - `force`         — true when `--force-overwrite` was passed OR the
 *                     `AGENT_CONFIG_ALLOW_OVERWRITE=1` env var is set.
 * - `interactive`   — true when both stdin and stdout are TTYs.
 * - `knownPaths`    — absolute paths the manifest already records as ours.
 *                     A target at a known path is not a foreign collision.
 * - `knownPointers` — `(fileLabel, jsonPointer)` pairs we previously
 *                     merged into shared JSON files; anything else found
 *                     in a shared JSON is a foreign merge collision.
 * - `defaultStrategy` — fallback when no UI is available.
 */
export interface ConflictPolicy {
    readonly force: boolean;
    readonly interactive: boolean;
    readonly knownPaths: ReadonlySet<string>;
    readonly knownPointers: ReadonlySet<string>;
    readonly defaultStrategy: ConflictStrategy;
}

/**
 * The declarative install plan.
 *
 * Built once by the planner; the applier never recomputes paths from
 * the plan. Empty plans render the wizard's "nothing to do" screen.
 *
 * `filesByTool` matches the v2 manifest's `{tool_id: [files[]]}` shape
 * produced by `_files_by_tool_from_deploy` / `_files_by_tool_from_bridges`
 * in the Python installer.
 *
 * `mergedKeysByTool` records JSON deep-merge pointers (Phase A5) so the
 * conflict policy can distinguish ours-vs-foreign on later runs.
 */
export interface InstallPlan {
    /** Plan schema version — bump on breaking shape change. */
    readonly version: 2;
    /** Where this plan lands (global vs project scope). */
    readonly target: InstallTarget;
    /** Absolute root for all relative paths in this plan. */
    readonly root: string;
    /** Per-tool file inventory; empty list means "nothing to write for this tool". */
    readonly filesByTool: Readonly<Record<string, ReadonlyArray<FileEntry>>>;
    /** Per-tool JSON-pointer inventory for deep-merged files (Phase A5). */
    readonly mergedKeysByTool: Readonly<Record<string, ReadonlyArray<{ file: string; pointer: string }>>>;
    /** Conflict policy active for this plan. */
    readonly policy: ConflictPolicy;
}

/**
 * One foreign collision discovered at plan time.
 *
 * Phase B3 — surfaced by the `/api/v1/install/plan` route so the wizard's
 * conflict screen can render single-pick / batch-resolution UI **before**
 * the apply phase opens the transaction log. A `ConflictEntry` means the
 * target exists, its bytes do not match the planned SHA, it is not in
 * `policy.knownPaths`, and `policy.force` is false — i.e. the policy
 * would surface this file to the UI during apply.
 *
 * `mergeable` is `true` only for `.json` deployed files; the wizard
 * shows the per-row `merge` button only on those. `existingSha256` is
 * the on-disk hash so the UI can render byte-equality hints when the
 * user toggles overwrite-vs-merge.
 */
export interface ConflictEntry {
    readonly path: string;
    readonly kind: FileKind;
    readonly plannedSha256: string | null;
    readonly existingSha256: string | null;
    readonly mergeable: boolean;
}

/**
 * Per-file resolution chosen by the wizard's conflict screen.
 *
 * - `skip`      — leave the existing file untouched.
 * - `overwrite` — replace the existing file with planned bytes verbatim.
 * - `merge`     — JSON deep-merge planned bytes into the existing file.
 *
 * `merge` is only valid for entries with `mergeable: true`; the apply
 * layer falls back to `overwrite` if the caller picks `merge` on a
 * non-JSON target rather than failing the entire plan.
 */
export type ConflictResolution = 'skip' | 'overwrite' | 'merge';

/**
 * Result of applying an {@link InstallPlan}.
 *
 * Surfaced to the wizard's progress bar (Phase B1) and recorded in the
 * transaction log (Phase A4) so recovery can reverse-apply on crash.
 */
export interface ApplyResult {
    readonly target: InstallTarget;
    readonly written: ReadonlyArray<FileEntry>;
    readonly skipped: ReadonlyArray<FileEntry>;
    readonly conflicts: ReadonlyArray<FileEntry>;
    readonly errors: ReadonlyArray<{ path: string; code: string; message: string }>;
}

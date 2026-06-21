/**
 * Plan builder — Phase A3 port of `scripts/install.py:_build_install_plan`.
 *
 * Pure: walks one or more source directories, computes the target path
 * + SHA-256 of every file, and returns a declarative {@link InstallPlan}.
 * The applier (Phase A4) consumes the plan verbatim — it never recomputes
 * paths or re-reads the source tree.
 *
 * Mirrors:
 *   - `_sha256_of_file(path)`           → {@link sha256File}
 *   - `_file_entry(path, kind, ...)`    → {@link fileEntry}
 *   - `_files_by_tool_from_deploy(...)` → buildInstallPlan loop
 *   - `_copy_dir_dereferencing_symlinks` walk → {@link walkSourceTree}
 *
 * v4 simplifies the Python shape: instead of three helper tables
 * (`GLOBAL_DEPLOY_SOURCES` × `USER_SCOPE_PATHS` × `_bridge_marker`) the
 * planner receives a flat list of `(srcDir, destDir, toolId, kind)`
 * tuples. The mapping table lives in a higher layer (B0 dispatcher) so
 * the planner stays a pure file walker.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
/**
 * Hex SHA-256 of `path` content, or `null` if unreadable.
 *
 * 1:1 port of `_sha256_of_file`. Bridges intentionally skip this and
 * pass `null` (their content is a pointer, not committed bytes).
 */
export function sha256File(path) {
    try {
        const data = readFileSync(path);
        return createHash('sha256').update(data).digest('hex');
    }
    catch {
        return null;
    }
}
/**
 * Build one v2 `files[]` entry.
 *
 * 1:1 port of `_file_entry(path, kind, hash_content=...)`. `hashContent`
 * toggles SHA-256 computation: deployed/marker pass `true`, bridges pass
 * `false` (sha256 stays `null`).
 */
export function fileEntry(path, kind, options) {
    return {
        path,
        kind,
        sha256: options.hashContent ? sha256File(path) : null,
    };
}
/**
 * Recursively list every file under `dir` (depth-first, sorted).
 *
 * Symlinks are followed via `statSync` (matches Python's
 * `_copy_dir_dereferencing_symlinks` behaviour). Missing directories
 * return `[]` rather than throwing — caller already validated `srcDir`.
 */
export function walkSourceTree(dir) {
    const out = [];
    walkInto(dir, out);
    return out;
}
function walkInto(dir, out) {
    let entries;
    try {
        entries = readdirSync(dir).sort();
    }
    catch {
        return;
    }
    for (const name of entries) {
        const full = join(dir, name);
        let isDir;
        try {
            isDir = statSync(full).isDirectory();
        }
        catch {
            continue;
        }
        if (isDir) {
            walkInto(full, out);
        }
        else {
            out.push(full);
        }
    }
}
/**
 * Build a declarative install plan.
 *
 * For each {@link PlanSource}, walks `srcDir` and emits one {@link FileEntry}
 * per file with `path = destDir + (file path relative to srcDir)` and a
 * fresh SHA-256 of the source file (computed once, never recomputed by
 * the applier). Bridges (`kind=bridge`) keep `sha256=null` per the
 * Python schema.
 *
 * The applier (Phase A4) is path-only — it does not re-walk `srcDir`
 * and does not re-hash. The plan is the source of truth.
 */
export function buildInstallPlan(inputs) {
    const filesByTool = {};
    for (const source of inputs.sources) {
        const bucket = filesByTool[source.toolId] ?? [];
        const files = walkSourceTree(source.srcDir);
        for (const srcFile of files) {
            const rel = relative(source.srcDir, srcFile);
            const destPath = resolve(source.destDir, rel);
            bucket.push(fileEntry(srcFile, source.kind, {
                hashContent: source.kind !== 'bridge',
            }));
            // Override `path` so the entry reflects the *target* (the
            // applier writes here), not the source we read from.
            bucket[bucket.length - 1] = {
                ...bucket[bucket.length - 1],
                path: destPath,
            };
        }
        filesByTool[source.toolId] = bucket;
    }
    // Ensure every requested toolId appears, even with zero files —
    // mirrors `_files_by_tool_from_deploy` emitting `[]` so a shrinking
    // install actually shrinks the recorded inventory.
    for (const source of inputs.sources) {
        if (!(source.toolId in filesByTool)) {
            filesByTool[source.toolId] = [];
        }
    }
    return {
        version: 2,
        target: inputs.target,
        root: inputs.root,
        filesByTool,
        mergedKeysByTool: {},
        policy: inputs.policy,
    };
}
/**
 * True when the plan would not modify any file on disk.
 *
 * Wizard renders the "nothing to do" screen on `true` (Phase B2).
 */
export function isEmptyPlan(plan) {
    for (const entries of Object.values(plan.filesByTool)) {
        if (entries.length > 0) {
            return false;
        }
    }
    for (const entries of Object.values(plan.mergedKeysByTool)) {
        if (entries.length > 0) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=plan.js.map
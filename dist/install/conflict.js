/**
 * Conflict resolution — Phase A5 (simplified, three modes).
 *
 * Three decisions only, replacing the legacy `prompt → write / skip /
 * abort` triple from `scripts/install.py:_resolve_file_conflict`:
 *
 * - `write`   — target either does not exist OR policy authorises overwrite.
 * - `skip`    — target exists, known path, not forced: leave it alone.
 * - `surface` — foreign collision: defer to the wizard's conflict screen
 *               (Phase B3). Headless callers translate `surface` to `skip`
 *               unless `policy.force` is true.
 *
 * JSON-aware deep-merge stays: callers that detect a `.json` target with
 * matching `knownPointers` route through {@link mergeJsonContent} instead
 * of byte-equality.
 */
import { existsSync } from 'node:fs';
import { sha256File } from './plan.js';
/**
 * Decide what to do with a single planned target.
 *
 * Decision matrix (mirrors the Python legacy with the 3-option prompt
 * collapsed into `surface`):
 *
 * | Exists? | Idempotent? | Known? | Force? | → Outcome  |
 * |---------|-------------|--------|--------|------------|
 * | no      | —           | —      | —      | `write`    |
 * | yes     | yes         | —      | —      | `skip`     |
 * | yes     | no          | yes    | no     | `skip`     |
 * | yes     | no          | yes    | yes    | `write`    |
 * | yes     | no          | no     | yes    | `write`    |
 * | yes     | no          | no     | no     | `surface`  |
 *
 * Headless callers (B1 CLI) collapse `surface` to `skip` automatically
 * because there is no UI to defer to; the apply layer records the entry
 * under {@link ApplyResult.conflicts} so the wizard can pick it up next.
 */
export function resolveFileConflict(inputs) {
    const { targetPath, idempotent, exists, policy } = inputs;
    if (!exists)
        return 'write';
    if (idempotent)
        return 'skip';
    const isKnown = policy.knownPaths.has(targetPath);
    if (isKnown) {
        return policy.force ? 'write' : 'skip';
    }
    if (policy.force)
        return 'write';
    return 'surface';
}
/**
 * Recursive object merge — overlay wins, nested dicts merged, arrays replaced.
 *
 * Mirrors `scripts/install.py:deep_merge`. Arrays do **not** concatenate;
 * Claude / Cursor / Cline hook configs rely on whole-array replacement to
 * stay idempotent across re-runs.
 *
 * Returns a fresh object — both inputs remain untouched.
 */
export function deepMerge(base, overlay) {
    const out = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
        const prev = out[key];
        if (isPlainObject(prev) && isPlainObject(value)) {
            out[key] = deepMerge(prev, value);
        }
        else {
            out[key] = cloneValue(value);
        }
    }
    return out;
}
/**
 * Merge `overlay` into `existing` and return the canonical 4-space JSON.
 *
 * Format matches `write_json_file` in the Python installer (4-space indent,
 * trailing newline, no ASCII-escape) so the apply layer can compare bytes
 * to detect idempotent merges and skip the write.
 */
export function mergeJsonContent(existing, overlay) {
    const merged = deepMerge(existing, overlay);
    return `${JSON.stringify(merged, null, 4)}\n`;
}
/**
 * Parse JSON bytes leniently — invalid / non-object payloads collapse to `{}`.
 *
 * Matches `read_json_file` in the legacy script: corrupt JSON is treated
 * as an empty doc rather than a hard failure, so the merge step always
 * produces a well-formed output even when an upstream tool wrote a
 * truncated config.
 */
export function parseJsonLenient(content) {
    try {
        const parsed = JSON.parse(content);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
    }
    catch {
        /* fall through — treat as empty */
    }
    return {};
}
/** Heuristic for routing a {@link FileEntry} through JSON merge. */
export function isJsonTarget(entry) {
    return entry.kind === 'deployed' && entry.path.endsWith('.json');
}
/**
 * Threshold at which the wizard switches the conflict screen from
 * single-pick to batch-resolution mode (council Finding #19).
 *
 * Below the threshold the user picks a resolution per row; at or above
 * it the screen renders a summary table + global CTAs to dodge the
 * 50-click stale-tree problem.
 */
export const CONFLICT_BATCH_THRESHOLD = 5;
/**
 * Walk an {@link InstallPlan} and return one {@link ConflictEntry} per
 * planned target the policy would `surface` to the UI.
 *
 * Pure-ish — reads from the filesystem only to compute idempotency
 * (`existsSync` + `sha256File`). Skips bridges (`sha256 === null`) since
 * bridge writers own a separate idempotency model. Skips entries whose
 * `path` is in `policy.knownPaths`, and skips entries that are
 * byte-equal to the planned content. Returns an empty array when
 * `policy.force` is true — overwrite mode silences the screen.
 */
export function computeConflicts(plan) {
    if (plan.policy.force)
        return [];
    const out = [];
    for (const entries of Object.values(plan.filesByTool)) {
        for (const entry of entries) {
            if (entry.kind === 'bridge')
                continue;
            if (entry.sha256 === null)
                continue;
            if (!existsSync(entry.path))
                continue;
            if (plan.policy.knownPaths.has(entry.path))
                continue;
            const onDisk = sha256File(entry.path);
            if (onDisk === entry.sha256)
                continue;
            out.push({
                path: entry.path,
                kind: entry.kind,
                plannedSha256: entry.sha256,
                existingSha256: onDisk,
                mergeable: isJsonTarget(entry),
            });
        }
    }
    return out;
}
/**
 * Expand a batch choice into a per-path {@link ConflictResolution} map.
 *
 * The wizard sends either `resolutions` directly (single-pick mode) or
 * a `batchChoice` (≥ 5 conflicts) that the server fans out across every
 * surfaced entry. `merge-json` maps non-JSON entries to `skip` since
 * deep-merge is JSON-only — the council picked skip over overwrite so a
 * single non-JSON file in a batch never silently overwrites.
 */
export function expandBatchChoice(conflicts, choice) {
    const out = {};
    for (const c of conflicts) {
        if (choice === 'skip-all') {
            out[c.path] = 'skip';
        }
        else if (choice === 'overwrite-all') {
            out[c.path] = 'overwrite';
        }
        else {
            out[c.path] = c.mergeable ? 'merge' : 'skip';
        }
    }
    return out;
}
function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function cloneValue(v) {
    if (Array.isArray(v)) {
        return v.map(cloneValue);
    }
    if (isPlainObject(v)) {
        const out = {};
        for (const [k, val] of Object.entries(v))
            out[k] = cloneValue(val);
        return out;
    }
    return v;
}
//# sourceMappingURL=conflict.js.map
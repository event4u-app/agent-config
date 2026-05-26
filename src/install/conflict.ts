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

import type { ConflictPolicy, FileEntry } from './types.js';

/** Outcome of {@link resolveFileConflict}. */
export type ConflictOutcome = 'write' | 'skip' | 'surface';

/** Inputs the resolver needs — purely the target + the active policy. */
export interface ResolveInputs {
    /** Absolute path of the target on disk. */
    readonly targetPath: string;
    /** True when the byte-comparison says the target matches the plan. */
    readonly idempotent: boolean;
    /** True when the target already exists on disk. */
    readonly exists: boolean;
    /** Active install policy. */
    readonly policy: ConflictPolicy;
}

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
export function resolveFileConflict(inputs: ResolveInputs): ConflictOutcome {
    const { targetPath, idempotent, exists, policy } = inputs;
    if (!exists) return 'write';
    if (idempotent) return 'skip';

    const isKnown = policy.knownPaths.has(targetPath);
    if (isKnown) {
        return policy.force ? 'write' : 'skip';
    }
    if (policy.force) return 'write';
    return 'surface';
}

/** JSON value the deep-merge accepts. */
export type JsonValue = null | boolean | number | string | JsonArray | JsonObject;
export interface JsonObject {
    readonly [key: string]: JsonValue;
}
export type JsonArray = ReadonlyArray<JsonValue>;

/**
 * Recursive object merge — overlay wins, nested dicts merged, arrays replaced.
 *
 * Mirrors `scripts/install.py:deep_merge`. Arrays do **not** concatenate;
 * Claude / Cursor / Cline hook configs rely on whole-array replacement to
 * stay idempotent across re-runs.
 *
 * Returns a fresh object — both inputs remain untouched.
 */
export function deepMerge(base: JsonObject, overlay: JsonObject): JsonObject {
    const out: Record<string, JsonValue> = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
        const prev = out[key];
        if (isPlainObject(prev) && isPlainObject(value)) {
            out[key] = deepMerge(prev, value);
        } else {
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
export function mergeJsonContent(existing: JsonObject, overlay: JsonObject): string {
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
export function parseJsonLenient(content: string): JsonObject {
    try {
        const parsed = JSON.parse(content) as unknown;
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as JsonObject;
        }
    } catch {
        /* fall through — treat as empty */
    }
    return {};
}

/** Heuristic for routing a {@link FileEntry} through JSON merge. */
export function isJsonTarget(entry: FileEntry): boolean {
    return entry.kind === 'deployed' && entry.path.endsWith('.json');
}

function isPlainObject(v: unknown): v is JsonObject {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function cloneValue(v: JsonValue): JsonValue {
    if (Array.isArray(v)) {
        return v.map(cloneValue);
    }
    if (isPlainObject(v)) {
        const out: Record<string, JsonValue> = {};
        for (const [k, val] of Object.entries(v)) out[k] = cloneValue(val);
        return out;
    }
    return v;
}

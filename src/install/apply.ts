/**
 * Apply orchestrator \u2014 Phase A4 (atomic writes + transaction log).
 *
 * Consumes an {@link InstallPlan} produced by `plan.ts:buildInstallPlan`
 * and walks every {@link FileEntry}, copying source bytes into the
 * declared target with {@link atomicWriteFile}. Each successful write
 * appends one {@link TxLogEntry} (kind=`write`) to the transaction log
 * so a recovery pass on next boot can reverse-apply on crash.
 *
 * Pure orchestration:
 *   - No path recomputation (the plan is the source of truth).
 *   - No re-walking of the source tree.
 *   - SHA-256 idempotency: skip an entry whose target already exists
 *     with matching bytes, unless `force=true` flips the policy.
 *
 * Progress is surfaced via the optional `onProgress` callback so the
 * Fastify SSE adapter (Phase B1) can stream per-file events to the
 * Preact wizard.
 */

import { existsSync, readFileSync } from 'node:fs';

import { atomicWriteFile } from './atomic.js';
import {
    isJsonTarget,
    mergeJsonContent,
    parseJsonLenient,
    resolveFileConflict,
} from './conflict.js';
import { sha256File } from './plan.js';
import { appendTxLog } from './txlog.js';
import type {
    ApplyResult,
    ConflictResolution,
    FileEntry,
    InstallPlan,
} from './types.js';

/** Per-file progress signal emitted by {@link applyPlan}. */
export interface ApplyProgress {
    readonly file: FileEntry;
    readonly written: number;
    readonly total: number;
    readonly status: 'written' | 'skipped' | 'conflict' | 'error';
    readonly error?: { code: string; message: string };
}

/** Inputs accepted by {@link applyPlan}. */
export interface ApplyInputs {
    /** Plan to execute (the source of truth). */
    readonly plan: InstallPlan;
    /** Map from target path \u2192 absolute source path for byte copying. */
    readonly sourceByTarget: ReadonlyMap<string, string>;
    /** Absolute path to the transaction log (defaults to `getLogPath()`). */
    readonly logPath: string;
    /** Optional progress callback. */
    readonly onProgress?: (progress: ApplyProgress) => void;
    /**
     * Per-target conflict resolution chosen by the wizard (Phase B3).
     *
     * Keys are absolute target paths. When the policy would `surface` a
     * file to the UI, the apply layer first checks this map:
     *
     * - `skip`      → push to {@link ApplyResult.skipped}, no write.
     * - `overwrite` → write planned bytes verbatim.
     * - `merge`     → JSON deep-merge planned bytes into the existing
     *                 file (falls back to `overwrite` for non-JSON).
     *
     * Missing keys fall back to the policy's `surface` outcome, which
     * the apply layer collapses to `skip` so a partial resolution map
     * never silently overwrites unresolved entries.
     */
    readonly resolutions?: ReadonlyMap<string, ConflictResolution>;
}

/** Inputs accepted by {@link applyPlanStreaming}. */
export interface ApplyStreamingInputs extends ApplyInputs {
    /**
     * Optional abort signal. When fired between entries, the loop stops,
     * an `abort` marker is appended to the transaction log, and the
     * partial {@link ApplyResult} is resolved. Mid-write aborts are NOT
     * supported \u2014 the current write completes (atomic rename), then
     * the loop bails out (council Finding #24).
     */
    readonly signal?: AbortSignal;
}

/**
 * Execute an {@link InstallPlan}.
 *
 * One pass through every entry. Writes are atomic (write-to-temp +
 * rename); the txlog records each success so recovery can reverse-apply.
 *
 * Returns {@link ApplyResult} aggregating per-file outcomes. Never
 * throws on individual file errors \u2014 errors land in
 * {@link ApplyResult.errors} so the wizard can render a partial-success
 * screen rather than crashing the install.
 */
export function applyPlan(inputs: ApplyInputs): ApplyResult {
    const { plan, sourceByTarget, logPath, onProgress, resolutions } = inputs;
    const all = flattenEntries(plan);
    const acc = newAccumulator();

    let index = 0;
    for (const entry of all) {
        index += 1;
        processEntry(entry, plan, sourceByTarget, logPath, acc, index, all.length, onProgress, resolutions);
    }

    return { target: plan.target, ...acc };
}

/**
 * Async streaming variant — yields the event loop between entries so an
 * {@link AbortSignal} fired by a disconnecting SSE client can stop the
 * loop. Each entry still executes synchronously (atomic write + txlog
 * append) so a mid-write abort is impossible; aborts land between
 * entries and append a single `abort` marker before resolving.
 *
 * Council Finding #24: SSE handlers must wire `req.on("close")` to an
 * `AbortController` and pass the signal here so half-applied installs
 * surface a clean partial result instead of a zombie loop.
 */
export async function applyPlanStreaming(inputs: ApplyStreamingInputs): Promise<ApplyResult> {
    const { plan, sourceByTarget, logPath, onProgress, signal, resolutions } = inputs;
    const all = flattenEntries(plan);
    const acc = newAccumulator();

    let index = 0;
    for (const entry of all) {
        if (signal?.aborted === true) {
            appendTxLog(logPath, {
                ts: new Date().toISOString(),
                kind: 'abort',
                path: entry.path,
                sha256: null,
                note: 'client disconnect',
            });
            break;
        }
        index += 1;
        processEntry(entry, plan, sourceByTarget, logPath, acc, index, all.length, onProgress, resolutions);
        // Yield to the event loop so the abort signal can fire and any
        // SSE write buffers can drain before the next entry.
        await new Promise<void>((resolve) => setImmediate(resolve));
    }

    return { target: plan.target, ...acc };
}

/** Mutable accumulator threaded through {@link processEntry}. */
interface ApplyAccumulator {
    readonly written: FileEntry[];
    readonly skipped: FileEntry[];
    readonly conflicts: FileEntry[];
    readonly errors: { path: string; code: string; message: string }[];
}

function newAccumulator(): ApplyAccumulator {
    return { written: [], skipped: [], conflicts: [], errors: [] };
}

function flattenEntries(plan: InstallPlan): FileEntry[] {
    const all: FileEntry[] = [];
    for (const entries of Object.values(plan.filesByTool)) {
        for (const e of entries) all.push(e);
    }
    return all;
}

/**
 * Process one {@link FileEntry} — resolve conflict, write or skip, append
 * txlog, push to accumulator, emit progress.
 *
 * Shared by sync {@link applyPlan} and async {@link applyPlanStreaming}
 * so the conflict matrix lives in one place.
 */
function processEntry(
    entry: FileEntry,
    plan: InstallPlan,
    sourceByTarget: ReadonlyMap<string, string>,
    logPath: string,
    acc: ApplyAccumulator,
    index: number,
    total: number,
    onProgress: ((progress: ApplyProgress) => void) | undefined,
    resolutions: ReadonlyMap<string, ConflictResolution> | undefined,
): void {
    try {
        if (entry.kind === 'bridge') {
            // Bridges are pointers we don't own bytes-for-bytes — skip
            // them at the apply layer; bridge generators (A6) produce
            // them via their own writer pass.
            acc.skipped.push(entry);
            onProgress?.({ file: entry, written: index, total, status: 'skipped' });
            return;
        }

        const source = sourceByTarget.get(entry.path);
        if (source === undefined) {
            acc.errors.push({
                path: entry.path,
                code: 'E_PLAN_MISSING_SOURCE',
                message: 'no source mapping for target path',
            });
            onProgress?.({
                file: entry,
                written: index,
                total,
                status: 'error',
                error: { code: 'E_PLAN_MISSING_SOURCE', message: 'no source mapping' },
            });
            return;
        }

        const idempotent = isIdempotent(entry, plan);
        const exists = existsSync(entry.path);
        const outcome = resolveFileConflict({
            targetPath: entry.path,
            idempotent,
            exists,
            policy: plan.policy,
        });

        if (outcome === 'skip') {
            acc.skipped.push(entry);
            onProgress?.({ file: entry, written: index, total, status: 'skipped' });
            return;
        }
        if (outcome === 'surface') {
            // Phase B3 — the wizard may have pre-resolved this conflict
            // before the apply call. The `resolutions` map is keyed by
            // absolute target path. Missing keys → unresolved conflict
            // (acc.conflicts) so the wizard surfaces them again. An
            // explicit `skip` resolution → acc.skipped: the user decided
            // to leave the file alone, that is a settled outcome.
            const resolution = resolutions?.get(entry.path);
            if (resolution === undefined) {
                acc.conflicts.push(entry);
                onProgress?.({ file: entry, written: index, total, status: 'conflict' });
                return;
            }
            if (resolution === 'skip') {
                acc.skipped.push(entry);
                onProgress?.({ file: entry, written: index, total, status: 'skipped' });
                return;
            }
            const data = readFileSync(source);
            const payload = resolution === 'merge' && isJsonTarget(entry) && exists
                ? mergeJsonPayload(entry.path, data)
                : data;
            atomicWriteFile(entry.path, payload);
            appendTxLog(logPath, {
                ts: new Date().toISOString(),
                kind: 'write',
                path: entry.path,
                sha256: entry.sha256,
            });
            acc.written.push(entry);
            onProgress?.({ file: entry, written: index, total, status: 'written' });
            return;
        }

        const data = readFileSync(source);
        const payload = isJsonTarget(entry) && exists ? mergeJsonPayload(entry.path, data) : data;
        atomicWriteFile(entry.path, payload);
        appendTxLog(logPath, {
            ts: new Date().toISOString(),
            kind: 'write',
            path: entry.path,
            sha256: entry.sha256,
        });
        acc.written.push(entry);
        onProgress?.({ file: entry, written: index, total, status: 'written' });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const code = errorCode(err);
        acc.errors.push({ path: entry.path, code, message });
        onProgress?.({
            file: entry,
            written: index,
            total,
            status: 'error',
            error: { code, message },
        });
    }
}

/**
 * True when the target already matches the planned bytes (no write needed).
 *
 * `policy.force` flips this off \u2014 `--force-overwrite` writes regardless.
 */
function isIdempotent(entry: FileEntry, plan: InstallPlan): boolean {
    if (plan.policy.force) return false;
    if (entry.sha256 === null) return false;
    if (!existsSync(entry.path)) return false;
    return sha256File(entry.path) === entry.sha256;
}

/**
 * Read the existing JSON target, deep-merge with the planned payload,
 * and return the canonical 4-space-indented bytes.
 *
 * Falls back to the raw planned payload when the existing file is
 * corrupt or non-object — matches the Python `read_json_file` lenient
 * contract so a truncated upstream config does not abort the install.
 */
function mergeJsonPayload(targetPath: string, planned: Buffer): Buffer {
    const existingText = readFileSync(targetPath, 'utf8');
    const existing = parseJsonLenient(existingText);
    const overlay = parseJsonLenient(planned.toString('utf8'));
    const merged = mergeJsonContent(existing, overlay);
    return Buffer.from(merged, 'utf8');
}

function errorCode(err: unknown): string {
    if (err !== null && typeof err === 'object' && 'code' in err) {
        const c = (err as { code: unknown }).code;
        if (typeof c === 'string') {
            if (c === 'ENOSPC') return 'E_DISK_FULL';
            if (c === 'EACCES' || c === 'EPERM') return 'E_PERM';
        }
    }
    return 'E_WRITE';
}

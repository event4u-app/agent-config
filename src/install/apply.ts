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
import type { ApplyResult, FileEntry, InstallPlan } from './types.js';

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
    const { plan, sourceByTarget, logPath, onProgress } = inputs;
    const all: FileEntry[] = [];
    for (const entries of Object.values(plan.filesByTool)) {
        for (const e of entries) all.push(e);
    }
    const total = all.length;

    const written: FileEntry[] = [];
    const skipped: FileEntry[] = [];
    const conflicts: FileEntry[] = [];
    const errors: { path: string; code: string; message: string }[] = [];

    let index = 0;
    for (const entry of all) {
        index += 1;
        try {
            if (entry.kind === 'bridge') {
                // Bridges are pointers we don't own bytes-for-bytes \u2014
                // skip them at the apply layer; bridge generators (A6)
                // produce them via their own writer pass.
                skipped.push(entry);
                onProgress?.({ file: entry, written: index, total, status: 'skipped' });
                continue;
            }

            const source = sourceByTarget.get(entry.path);
            if (source === undefined) {
                errors.push({
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
                continue;
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
                skipped.push(entry);
                onProgress?.({ file: entry, written: index, total, status: 'skipped' });
                continue;
            }
            if (outcome === 'surface') {
                conflicts.push(entry);
                onProgress?.({ file: entry, written: index, total, status: 'conflict' });
                continue;
            }

            // outcome === 'write'
            const data = readFileSync(source);
            const payload = isJsonTarget(entry) && exists ? mergeJsonPayload(entry.path, data) : data;
            atomicWriteFile(entry.path, payload);
            appendTxLog(logPath, {
                ts: new Date().toISOString(),
                kind: 'write',
                path: entry.path,
                sha256: entry.sha256,
            });
            written.push(entry);
            onProgress?.({ file: entry, written: index, total, status: 'written' });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const code = errorCode(err);
            errors.push({ path: entry.path, code, message });
            onProgress?.({
                file: entry,
                written: index,
                total,
                status: 'error',
                error: { code, message },
            });
        }
    }

    return { target: plan.target, written, skipped, conflicts, errors };
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

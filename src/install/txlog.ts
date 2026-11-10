/**
 * Transaction log — Phase A4 (council Finding #18).
 *
 * Append-only JSONL at `getLogPath()` (`~/.event4u/agent-config/install-log.jsonl`).
 * Recovery on crash is `tail -n` plus the wizard's resume / dismiss decision —
 * nothing is un-written automatically. No PID lockfile (per Phase-A4
 * decision 8).
 *
 * WHAT ACTUALLY WRITES THIS FILE: `src/server/routes/install.ts`'s
 * recovery-dismiss handler appends a `rollback` marker with an empty path and a
 * null hash; `src/scripts/install.ts`, through `_log_tx_entry`, appends a
 * `write` or `skip` entry per path it copies, preserves or stages a sidecar
 * for, and a `write` entry per deployed Claude rule the host-form rewrite and
 * the thinning pass rewrite after the copy — except a `write` whose exact
 * bytes the log already records at that path (`loggedWrites.isNewWrite`), so
 * an unchanged re-deploy adds nothing. The installer queues its entries
 * through `bufferTxLog` (batched appends — see there); the other writers call
 * `appendTxLog`. Both serialize the same `TxLogEntry`, so the entry shape is
 * identical by construction rather than by convention.
 *
 * Each installer run opens with one `run` marker (`markRun`), so the tail is
 * always the latest run even when it wrote nothing new — recovery's write
 * counts therefore cover new bytes only, not every file a run touched.
 *
 * WHAT READS IT: recovery (the active log only) and `./loggedWrites.ts`, which
 * reads every `write` digest in the active log AND its rotated siblings as
 * proof that bytes on disk are the installer's own output.
 *
 * Rotation: 10 MB OR 30 days, whichever first. Rotated copies move to
 * `install-log.<ISO>.jsonl.gz` siblings; recovery never scans them.
 *
 * Recovery cap: at most the **last 500 entries** of the active log are
 * scanned. Older incomplete tails are treated as abandoned and surfaced
 * to the wizard as "previous run aborted; ignoring".
 */

import { createGzip } from 'node:zlib';
import { closeSync, createReadStream, createWriteStream, existsSync, openSync, readFileSync, readSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { atomicAppendLines } from './atomic.js';

/** Rotate the active log when it reaches this size (council Finding #18). */
export const ROTATION_MAX_BYTES = 10 * 1024 * 1024;

/** Rotate the active log when its first entry is older than this (ms). */
export const ROTATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Recovery scans at most the last N entries of the active log. */
export const RECOVERY_DEPTH_CAP = 500;

/** Per-event shape written as one JSONL line. */
export interface TxLogEntry {
    /** ISO-8601 UTC timestamp of the event. */
    readonly ts: string;
    /** Event kind \u2014 `write` is the only success path; `abort` flags client disconnect. */
    readonly kind: 'write' | 'skip' | 'abort' | 'rollback' | 'run';
    /** Absolute target path the entry refers to. */
    readonly path: string;
    /** SHA-256 of the bytes written (null for skip/abort/rollback). */
    readonly sha256: string | null;
    /** Optional free-form note (e.g. abort reason). */
    readonly note?: string;
}

/** Buffered entries flush once this many are pending for one log. */
export const BUFFER_FLUSH_THRESHOLD = 1000;

const pending = new Map<string, TxLogEntry[]>();
let exitFlushInstalled = false;

/** Append one entry to the active log, rotating first if thresholds tripped. */
export function appendTxLog(logPath: string, entry: TxLogEntry): void {
    // Entries buffered earlier for this log must land first — order is the
    // log's only notion of sequence.
    const queued = takePending(logPath);
    try {
        writeBatch(logPath, [...queued, entry]);
    } catch (err) {
        requeue(logPath, queued);
        throw err;
    }
}

/**
 * Queue one entry for a later batched append.
 *
 * Every append rewrites and fsyncs the whole active log, so a run logging one
 * entry per copied file (~20k on a global install) spent minutes on the log
 * alone. Buffered entries are written in batches of
 * {@link BUFFER_FLUSH_THRESHOLD}, on {@link flushTxLog}, before any in-process
 * read through this module or `loggedWrites`, on process exit, and on SIGINT /
 * SIGTERM (Ctrl-C, the wizard cancelling its installer child). Only an
 * uncatchable kill (SIGKILL, power loss) loses the unflushed batch — up to
 * {@link BUFFER_FLUSH_THRESHOLD} entries. A missing `write` entry weakens the
 * ownership proof, so a later install keeps that file and stages the package
 * copy beside it instead of overwriting it: noisy, never destructive.
 */
export function bufferTxLog(logPath: string, entry: TxLogEntry): void {
    let queue = pending.get(logPath);
    if (queue === undefined) {
        queue = [];
        pending.set(logPath, queue);
    }
    queue.push(entry);
    if (!exitFlushInstalled) {
        exitFlushInstalled = true;
        process.on('exit', () => flushTxLog());
        for (const sig of ['SIGINT', 'SIGTERM'] as const) {
            process.once(sig, () => {
                flushTxLog();
                // Restore the default termination unless someone else handles it.
                if (process.listenerCount(sig) === 0) process.kill(process.pid, sig);
            });
        }
    }
    if (queue.length >= BUFFER_FLUSH_THRESHOLD) {
        flushTxLog(logPath);
    }
}

const runMarked = new Set<string>();

/**
 * Queue one `run` marker per process and log, ahead of the run's other entries.
 *
 * An unchanged re-deploy logs no `write` (see `loggedWrites.isNewWrite`), so
 * without a marker the tail would still be the previous run: an `abort` there
 * would keep reading as an interrupted install after a clean re-run, and an
 * emptied active log would stay empty.
 */
export function markRun(logPath: string): void {
    if (runMarked.has(logPath)) return;
    runMarked.add(logPath);
    bufferTxLog(logPath, { ts: new Date().toISOString(), kind: 'run', path: '', sha256: null, note: 'install run' });
}

/** Tests only: let one process simulate several install runs. */
export function _resetRunMarker(): void {
    runMarked.clear();
}

/** Write every buffered entry (for one log, or all of them). Never throws. */
export function flushTxLog(logPath?: string): void {
    const targets = logPath === undefined ? [...pending.keys()] : [logPath];
    for (const target of targets) {
        const queued = takePending(target);
        if (queued.length === 0) continue;
        try {
            writeBatch(target, queued);
        } catch {
            // Kept for the next flush: the log is a recovery aid, not a
            // precondition, but a transient failure must not drop the batch.
            requeue(target, queued);
        }
    }
}

function takePending(logPath: string): TxLogEntry[] {
    const queued = pending.get(logPath) ?? [];
    pending.delete(logPath);
    return queued;
}

function requeue(logPath: string, entries: readonly TxLogEntry[]): void {
    if (entries.length === 0) return;
    pending.set(logPath, [...entries, ...(pending.get(logPath) ?? [])]);
}

function writeBatch(logPath: string, entries: readonly TxLogEntry[]): void {
    if (shouldRotate(logPath)) {
        rotateLogSync(logPath);
    }
    atomicAppendLines(logPath, entries.map((e) => JSON.stringify(e)));
}

/**
 * Read at most the last {@link RECOVERY_DEPTH_CAP} entries from the active log.
 *
 * Returns entries in chronological order (oldest of the tail first).
 * Malformed lines are dropped silently \u2014 partial-write tails should not
 * crash recovery.
 */
export function readRecentEntries(logPath: string): readonly TxLogEntry[] {
    flushTxLog(logPath);
    if (!existsSync(logPath)) {
        return [];
    }
    const raw = readFileSync(logPath, 'utf8');
    const lines = raw.split('\n').filter((l) => l.length > 0);
    const tail = lines.slice(-RECOVERY_DEPTH_CAP);
    const out: TxLogEntry[] = [];
    for (const line of tail) {
        const parsed = tryParseEntry(line);
        if (parsed !== null) {
            out.push(parsed);
        }
    }
    return out;
}

/**
 * True when the active log breaches one of the rotation thresholds.
 *
 * Size threshold trips on byte-count alone; age threshold reads the
 * first line and compares its `ts` against `now`.
 */
export function shouldRotate(logPath: string, now: Date = new Date()): boolean {
    if (!existsSync(logPath)) {
        return false;
    }
    let size = 0;
    try {
        size = statSync(logPath).size;
    } catch {
        return false;
    }
    if (size >= ROTATION_MAX_BYTES) {
        return true;
    }
    const firstTs = readFirstTimestamp(logPath);
    if (firstTs === null) {
        return false;
    }
    return now.getTime() - firstTs >= ROTATION_MAX_AGE_MS;
}

/**
 * Rotate the active log to `install-log.<ISO>.jsonl.gz` and remove the original.
 *
 * Sync wrapper around the async gzip pipeline so callers stay sequential.
 * `appendTxLog` blocks on this \u2014 acceptable: rotations are rare (10 MB
 * or 30 days) and the gzip is fire-and-forget afterwards.
 */
export function rotateLogSync(logPath: string): void {
    if (!existsSync(logPath)) {
        return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotated = logPath.replace(/\.jsonl$/, `.${stamp}.jsonl`);
    renameSync(logPath, rotated);
    // Best-effort gzip in the background; failure is non-fatal because
    // the rotated `.jsonl` is already a valid recovery artefact.
    void gzipInPlace(rotated).catch(() => {});
}

async function gzipInPlace(source: string): Promise<void> {
    const target = `${source}.gz`;
    await pipeline(createReadStream(source), createGzip(), createWriteStream(target));
    try {
        unlinkSync(source);
    } catch {
        /* swallow \u2014 gzip succeeded, leak is acceptable */
    }
}

/** Bytes read to find the first line — an entry is a few hundred bytes. */
const FIRST_LINE_PROBE_BYTES = 64 * 1024;

function readFirstTimestamp(logPath: string): number | null {
    try {
        // Only the head: reading the whole (up to 10 MB) log per append was
        // half of the old per-entry cost.
        const fd = openSync(logPath, 'r');
        let head = '';
        try {
            const buf = Buffer.alloc(FIRST_LINE_PROBE_BYTES);
            const n = readSync(fd, buf, 0, buf.length, 0);
            head = buf.subarray(0, n).toString('utf8');
        } finally {
            closeSync(fd);
        }
        const firstLine = head.split('\n', 1)[0] ?? '';
        const parsed = tryParseEntry(firstLine);
        if (parsed === null) return null;
        const t = Date.parse(parsed.ts);
        return Number.isFinite(t) ? t : null;
    } catch {
        return null;
    }
}

function tryParseEntry(line: string): TxLogEntry | null {
    try {
        const obj = JSON.parse(line) as Partial<TxLogEntry>;
        if (typeof obj.ts !== 'string' || typeof obj.kind !== 'string' || typeof obj.path !== 'string') {
            return null;
        }
        return obj as TxLogEntry;
    } catch {
        return null;
    }
}

/** Resolve the directory holding `logPath` \u2014 helper for callers (apply.ts). */
export function txLogDir(logPath: string): string {
    return dirname(logPath);
}

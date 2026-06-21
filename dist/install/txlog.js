/**
 * Transaction log — Phase A4 (council Finding #18).
 *
 * Append-only JSONL at `getLogPath()` (`~/.event4u/agent-config/install-log.jsonl`).
 * Each successful atomic write appends one entry; recovery on crash is
 * `tail -n` + reverse-apply. No PID lockfile (per Phase-A4 decision 8).
 *
 * Rotation: 10 MB OR 30 days, whichever first. Rotated copies move to
 * `install-log.<ISO>.jsonl.gz` siblings; recovery never scans them.
 *
 * Recovery cap: at most the **last 500 entries** of the active log are
 * scanned. Older incomplete tails are treated as abandoned and surfaced
 * to the wizard as "previous run aborted; ignoring".
 */
import { createGzip } from 'node:zlib';
import { createReadStream, createWriteStream, existsSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { atomicAppendLine } from './atomic.js';
/** Rotate the active log when it reaches this size (council Finding #18). */
export const ROTATION_MAX_BYTES = 10 * 1024 * 1024;
/** Rotate the active log when its first entry is older than this (ms). */
export const ROTATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Recovery scans at most the last N entries of the active log. */
export const RECOVERY_DEPTH_CAP = 500;
/** Append one entry to the active log, rotating first if thresholds tripped. */
export function appendTxLog(logPath, entry) {
    if (shouldRotate(logPath)) {
        rotateLogSync(logPath);
    }
    atomicAppendLine(logPath, JSON.stringify(entry));
}
/**
 * Read at most the last {@link RECOVERY_DEPTH_CAP} entries from the active log.
 *
 * Returns entries in chronological order (oldest of the tail first).
 * Malformed lines are dropped silently \u2014 partial-write tails should not
 * crash recovery.
 */
export function readRecentEntries(logPath) {
    if (!existsSync(logPath)) {
        return [];
    }
    const raw = readFileSync(logPath, 'utf8');
    const lines = raw.split('\n').filter((l) => l.length > 0);
    const tail = lines.slice(-RECOVERY_DEPTH_CAP);
    const out = [];
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
export function shouldRotate(logPath, now = new Date()) {
    if (!existsSync(logPath)) {
        return false;
    }
    let size = 0;
    try {
        size = statSync(logPath).size;
    }
    catch {
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
export function rotateLogSync(logPath) {
    if (!existsSync(logPath)) {
        return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotated = logPath.replace(/\.jsonl$/, `.${stamp}.jsonl`);
    renameSync(logPath, rotated);
    // Best-effort gzip in the background; failure is non-fatal because
    // the rotated `.jsonl` is already a valid recovery artefact.
    void gzipInPlace(rotated).catch(() => { });
}
async function gzipInPlace(source) {
    const target = `${source}.gz`;
    await pipeline(createReadStream(source), createGzip(), createWriteStream(target));
    try {
        unlinkSync(source);
    }
    catch {
        /* swallow \u2014 gzip succeeded, leak is acceptable */
    }
}
function readFirstTimestamp(logPath) {
    try {
        const raw = readFileSync(logPath, 'utf8');
        const firstLine = raw.split('\n', 1)[0] ?? '';
        const parsed = tryParseEntry(firstLine);
        if (parsed === null)
            return null;
        const t = Date.parse(parsed.ts);
        return Number.isFinite(t) ? t : null;
    }
    catch {
        return null;
    }
}
function tryParseEntry(line) {
    try {
        const obj = JSON.parse(line);
        if (typeof obj.ts !== 'string' || typeof obj.kind !== 'string' || typeof obj.path !== 'string') {
            return null;
        }
        return obj;
    }
    catch {
        return null;
    }
}
/** Resolve the directory holding `logPath` \u2014 helper for callers (apply.ts). */
export function txLogDir(logPath) {
    return dirname(logPath);
}
//# sourceMappingURL=txlog.js.map
/**
 * Atomic file writer — Phase A4 primitive.
 *
 * 1:1 port of the `tempfile.mkstemp` + `os.replace` pattern used across
 * `scripts/install.py` (see `_write_consumer_bridge_marker` ~line 3036).
 *
 * Contract:
 *   1. Open a sibling `.tmp.<rand>` file in the destination directory
 *      so the rename below is a same-filesystem operation (POSIX rename
 *      atomicity guarantee).
 *   2. Write the payload, `fsync` to durable storage.
 *   3. `rename()` to the final target — atomic on POSIX and Windows
 *      (Node's `fs.renameSync` maps to `MoveFileExA` with REPLACE).
 *   4. On any failure between (1) and (3), unlink the temp file so we
 *      do not leak `.tmp.*` siblings.
 *
 * Sync API on purpose — the apply phase is fundamentally sequential
 * (transaction-log ordering matters) and async I/O would add a real
 * cost without any throughput win on the workloads we hit (≤ a few
 * thousand small files per install).
 */
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync, } from 'node:fs';
import { dirname, join } from 'node:path';
/**
 * Write `data` to `target` atomically.
 *
 * Throws on any I/O failure — the caller (apply phase) catches and
 * surfaces an `E_DISK_FULL` / `E_PERM` SSE error frame (Phase B1).
 *
 * Parent directory is created with `recursive: true` so callers do not
 * have to pre-mkdir each subtree.
 */
export function atomicWriteFile(target, data, options = {}) {
    const mode = options.mode ?? 0o644;
    const parent = dirname(target);
    mkdirSync(parent, { recursive: true });
    const tmp = join(parent, `.tmp.${process.pid}.${randSuffix()}`);
    let fd = null;
    try {
        fd = openSync(tmp, 'w', mode);
        const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
        writeSync(fd, buf, 0, buf.length, 0);
        fsyncSync(fd);
        closeSync(fd);
        fd = null;
        renameSync(tmp, target);
    }
    catch (err) {
        if (fd !== null) {
            try {
                closeSync(fd);
            }
            catch {
                /* swallow — outer error wins */
            }
        }
        try {
            unlinkSync(tmp);
        }
        catch {
            /* file may not exist yet — swallow */
        }
        throw err;
    }
}
/**
 * Append `line` to `target` atomically (read-modify-write).
 *
 * Wraps {@link atomicWriteFile} after a read of the current contents.
 * Used by the transaction-log writer (`txlog.ts`) to grow the JSONL
 * file one entry at a time without leaving a half-written line on
 * crash. Newline is enforced — caller passes the bare payload.
 */
export function atomicAppendLine(target, line) {
    let existing = '';
    try {
        existing = readFileSync(target, 'utf8');
    }
    catch {
        existing = '';
    }
    const sep = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    atomicWriteFile(target, `${existing}${sep}${line}\n`);
}
function randSuffix() {
    // 12 hex chars — sufficient to avoid collisions under concurrent
    // installs (we do not run them in production, but tests do).
    return Math.floor(Math.random() * 0xffffffffffff)
        .toString(16)
        .padStart(12, '0');
}
//# sourceMappingURL=atomic.js.map
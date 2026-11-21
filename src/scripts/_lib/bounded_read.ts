/**
 * A bounded, non-blocking read of a small regular file — shared by the surface reader
 * and the record-only counters, both of which run on the Stop path.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Inputs are small config files; anything larger is not one, and is not read. */
const MAX_INPUT_BYTES = 1024 * 1024;

/**
 * A regular file of bounded size, or null. The hook runs this on a Stop event
 * in a repo it does not control, so a FIFO or device named `package.json`
 * would block a synchronous read that no `try` can recover from.
 */
export function readText(file: string, root?: string): string | null {
    let fd: number | null = null;
    try {
        // A symlinked parent directory (`src-tauri -> /elsewhere`) is not caught
        // by O_NOFOLLOW, which guards the last component only.
        let target = file;
        if (root !== undefined) {
            const base = fs.realpathSync(root);
            target = fs.realpathSync(file);
            if (target !== base && !target.startsWith(base + path.sep)) return null;
        }
        // Non-blocking open, then check the OPENED file: a path swapped between a
        // stat and a read cannot slip a FIFO or a large file past the check.
        // O_NOFOLLOW: a symlinked input could point out of the repo.
        fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK | fs.constants.O_NOFOLLOW);
        const st = fs.fstatSync(fd);
        if (!st.isFile() || st.size > MAX_INPUT_BYTES) return null;
        // A parent directory swapped between the check and the open shows as a different file.
        // Residual, stated: Node has no openat, so a directory swapped again between this
        // re-check and the stat cannot be excluded by path checks. A process that can swap
        // directories inside the workspace mid-Stop already controls the files the agent
        // runs, and what is read here becomes surface names in a local record-only counter.
        if (root !== undefined) {
            const base = fs.realpathSync(root);
            const againPath = fs.realpathSync(file);
            if (againPath !== base && !againPath.startsWith(base + path.sep)) return null;
            const again = fs.statSync(againPath);
            if (again.ino !== st.ino || again.dev !== st.dev) return null;
        }
        const buf = Buffer.alloc(MAX_INPUT_BYTES + 1);
        const n = fs.readSync(fd, buf, 0, buf.length, 0);
        return n > MAX_INPUT_BYTES ? null : buf.toString('utf8', 0, n);
    } catch {
        return null;
    } finally {
        if (fd !== null) fs.closeSync(fd);
    }
}

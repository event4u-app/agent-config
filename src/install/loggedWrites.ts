/**
 * The install transaction log read as an ownership record.
 *
 * WHY. The writer preserves any managed file it cannot prove is still the bytes
 * it wrote. For a file deployed before the ownership ledger recorded digests,
 * the ledger has nothing to compare against, so EVERY such file was preserved
 * and a sidecar staged beside it — thousands of them on one upgrade, all
 * untouched. Worse, the ledger then records the staged digest for each target,
 * so the next run calls the same untouched file "user-modified".
 *
 * The proof was on disk the whole time. `src/scripts/install.ts` appends a
 * `write` entry carrying the SHA-256 of the target's bytes immediately after
 * every copy, and has done so since long before the ledger existed. A file
 * whose bytes equal a digest the log records this installer writing to that
 * exact path is the installer's own output, unedited: overwriting it cannot
 * destroy anything the user wrote. That is the whole test — no recency, no
 * heuristics. A path with no matching record keeps the existing answer.
 *
 * WHAT IS READ. The active log and every rotated sibling, plain or gzipped
 * (`txlog.ts` rotates at 10 MB or 30 days, and the gzip step can leave both
 * forms behind). An unreadable or truncated file contributes nothing — the
 * failure direction is "no proof", which preserves.
 */

import { gunzipSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { getLogPath } from './paths.js';

/** Absolute target path → every digest the log records this installer writing there. */
export type LoggedWrites = ReadonlyMap<string, ReadonlySet<string>>;

const WRITE_MARKER = '"kind":"write"';

let cache: { readonly key: string; readonly writes: LoggedWrites } | null = null;

/** The active log plus its rotated siblings, in no particular order. */
function logFiles(logPath: string): string[] {
    const dir = dirname(logPath);
    if (!existsSync(dir)) return [];
    const stem = basename(logPath).replace(/\.jsonl$/, '');
    try {
        return readdirSync(dir)
            .filter((n) => n.startsWith(stem) && (n.endsWith('.jsonl') || n.endsWith('.jsonl.gz')))
            .map((n) => join(dir, n));
    } catch {
        return [];
    }
}

function readLog(file: string): string {
    try {
        const raw = readFileSync(file);
        return (file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8');
    } catch {
        return '';
    }
}

/**
 * Every `write` the transaction log records, keyed by absolute path.
 *
 * Memoised on the files' names, sizes and mtimes: an install consults it once
 * per preserved candidate, and the logs run to tens of megabytes.
 */
export function loggedWriteDigests(logPath: string = getLogPath()): LoggedWrites {
    const files = logFiles(logPath).sort();
    const key = files
        .map((f) => {
            try {
                const st = statSync(f);
                return `${f}:${st.size}:${st.mtimeMs}`;
            } catch {
                return `${f}:-`;
            }
        })
        .join('|');
    if (cache !== null && cache.key === key) return cache.writes;

    const writes = new Map<string, Set<string>>();
    for (const file of files) {
        for (const line of readLog(file).split('\n')) {
            if (!line.includes(WRITE_MARKER)) continue;
            let entry: { path?: unknown; sha256?: unknown };
            try {
                entry = JSON.parse(line) as { path?: unknown; sha256?: unknown };
            } catch {
                continue;
            }
            if (typeof entry.path !== 'string' || typeof entry.sha256 !== 'string' || entry.sha256 === '') continue;
            const target = resolve(entry.path);
            let set = writes.get(target);
            if (set === undefined) writes.set(target, (set = new Set()));
            set.add(entry.sha256);
        }
    }
    cache = { key, writes };
    return writes;
}

/**
 * Did this installer write exactly `onDiskSha256` to `target`?
 *
 * Both spellings of the path are tried — on macOS the home and temp trees sit
 * behind a symlinked prefix, and the log records the path as the copy loop
 * built it.
 */
export function wroteTheseBytes(target: string, onDiskSha256: string, writes: LoggedWrites): boolean {
    const plain = resolve(target);
    if (writes.get(plain)?.has(onDiskSha256) === true) return true;
    let real: string;
    try {
        real = realpathSync(target);
    } catch {
        return false;
    }
    return real !== plain && writes.get(real)?.has(onDiskSha256) === true;
}

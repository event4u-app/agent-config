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
 * `write` entry carrying the SHA-256 of the target's bytes after every copy
 * whose bytes the log does not already record at that path (`isNewWrite`). A file whose bytes equal a digest the log records this installer
 * writing to that exact path is the installer's own output, unedited. A path
 * with no matching record keeps the existing answer. WHEN that proof may decide
 * is narrower than "whenever it matches" — see `decideDeployWrite`.
 *
 * WHAT IS READ. The active log and every rotated sibling, plain or gzipped
 * (`txlog.ts` rotates at 10 MB or 30 days, and the gzip step can leave both
 * forms behind). An unreadable or truncated file contributes nothing — the
 * failure direction is "no proof", which preserves.
 *
 * COST. Parsed per FILE and cached on that file's size and mtime. A rotated
 * archive never changes, so only the active log is re-read when it grows — and
 * an install appends to it after every file it touches, so a cache keyed on the
 * whole set would re-parse the entire history once per candidate.
 */

import { gunzipSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { getLogPath } from './paths.js';
import { flushTxLog } from './txlog.js';

/** Absolute target path → every digest the log records this installer writing there. */
export type LoggedWrites = ReadonlyMap<string, ReadonlySet<string>>;

const WRITE_MARKER = '"kind":"write"';

const fileCache = new Map<string, { readonly stamp: string; readonly entries: ReadonlyArray<readonly [string, string]> }>();
const dirRealpaths = new Map<string, string>();

/**
 * One canonical spelling for a path: its directory realpath'd, its basename
 * kept. Both the log keys and the queries go through it, so `/var/…` and its
 * macOS realpath twin meet. The directory is realpath'd rather than the file
 * because the file may not exist, and is memoised because a log names a few
 * hundred directories across tens of thousands of entries.
 */
export function canonicalPath(p: string): string {
    const abs = resolve(p);
    const dir = dirname(abs);
    let real = dirRealpaths.get(dir);
    if (real === undefined) {
        try {
            real = realpathSync(dir);
        } catch {
            real = dir;
        }
        dirRealpaths.set(dir, real);
    }
    return join(real, basename(abs));
}

/** The active log plus its rotated siblings, sorted by name. */
function logFiles(logPath: string): string[] {
    const dir = dirname(logPath);
    if (!existsSync(dir)) return [];
    const stem = basename(logPath).replace(/\.jsonl$/, '');
    try {
        return readdirSync(dir)
            .filter((n) => n.startsWith(stem) && (n.endsWith('.jsonl') || n.endsWith('.jsonl.gz')))
            .map((n) => join(dir, n))
            .sort();
    } catch {
        return [];
    }
}

function writesIn(file: string): ReadonlyArray<readonly [string, string]> {
    let stamp: string;
    try {
        const st = statSync(file);
        stamp = `${st.size}:${Math.trunc(st.mtimeMs)}`;
    } catch {
        return [];
    }
    const cached = fileCache.get(file);
    if (cached !== undefined && cached.stamp === stamp) return cached.entries;

    let text = '';
    try {
        const raw = readFileSync(file);
        text = (file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8');
    } catch {
        text = '';
    }
    const entries: Array<readonly [string, string]> = [];
    for (const line of text.split('\n')) {
        if (!line.includes(WRITE_MARKER)) continue;
        let entry: { path?: unknown; sha256?: unknown };
        try {
            entry = JSON.parse(line) as { path?: unknown; sha256?: unknown };
        } catch {
            continue;
        }
        if (typeof entry.path !== 'string' || typeof entry.sha256 !== 'string' || entry.sha256 === '') continue;
        entries.push([canonicalPath(entry.path), entry.sha256]);
    }
    fileCache.set(file, { stamp, entries });
    return entries;
}

/** Every `write` the transaction log records, keyed by canonical path. */
export function loggedWriteDigests(logPath: string = getLogPath()): LoggedWrites {
    // Read-your-writes: entries this process queued must be on disk first.
    flushTxLog(logPath);
    const writes = new Map<string, Set<string>>();
    for (const file of logFiles(logPath)) {
        for (const [target, sha] of writesIn(file)) {
            let set = writes.get(target);
            if (set === undefined) writes.set(target, (set = new Set()));
            set.add(sha);
        }
    }
    return writes;
}

let known: { readonly logPath: string; readonly writes: Map<string, Set<string>> } | null = null;

/**
 * Whether a `write` of `sha256` to `target` still needs a log entry.
 *
 * False when the log — active or rotated — already records exactly that write:
 * rotated logs are never pruned, so the earlier entry keeps proving the bytes,
 * and a second one adds nothing. True otherwise, and the write is remembered,
 * so it is logged once per run. Re-logging every unchanged file made each
 * global install append ~10 MB and rotate the log on every run.
 */
export function isNewWrite(target: string, sha256: string, logPath: string = getLogPath()): boolean {
    if (known === null || known.logPath !== logPath) {
        const writes = new Map<string, Set<string>>();
        for (const [p, shas] of loggedWriteDigests(logPath)) writes.set(p, new Set(shas));
        known = { logPath, writes };
    }
    const key = canonicalPath(target);
    let shas = known.writes.get(key);
    if (shas?.has(sha256)) return false;
    if (shas === undefined) known.writes.set(key, (shas = new Set()));
    shas.add(sha256);
    return true;
}

/**
 * Wrap a log writer so it records only paths this run's copy deploys.
 *
 * The claude-code rewrite and thinning passes walk the whole rule directory,
 * including rules the user authored there; logging those rewrites would make
 * the log vouch for content that was never the package's.
 */
export function onlyDeployed(
    anchor: string,
    currentFiles: ReadonlySet<string>,
    log: (target: string) => void,
): (target: string) => void {
    return (target) => {
        const rel = relative(resolve(anchor), resolve(target)).split(sep).join('/');
        if (currentFiles.has(rel)) log(target);
    };
}

/** Did this installer write exactly `onDiskSha256` to `target`? */
export function wroteTheseBytes(target: string, onDiskSha256: string, writes: LoggedWrites): boolean {
    return writes.get(canonicalPath(target))?.has(onDiskSha256) === true;
}

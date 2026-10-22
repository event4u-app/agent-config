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
 * every copy. A file whose bytes equal a digest the log records this installer
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
const WRITE_MARKER = '"kind":"write"';
const fileCache = new Map();
const dirRealpaths = new Map();
/**
 * One canonical spelling for a path: its directory realpath'd, its basename
 * kept. Both the log keys and the queries go through it, so `/var/…` and its
 * macOS realpath twin meet. The directory is realpath'd rather than the file
 * because the file may not exist, and is memoised because a log names a few
 * hundred directories across tens of thousands of entries.
 */
export function canonicalPath(p) {
    const abs = resolve(p);
    const dir = dirname(abs);
    let real = dirRealpaths.get(dir);
    if (real === undefined) {
        try {
            real = realpathSync(dir);
        }
        catch {
            real = dir;
        }
        dirRealpaths.set(dir, real);
    }
    return join(real, basename(abs));
}
/** The active log plus its rotated siblings, sorted by name. */
function logFiles(logPath) {
    const dir = dirname(logPath);
    if (!existsSync(dir))
        return [];
    const stem = basename(logPath).replace(/\.jsonl$/, '');
    try {
        return readdirSync(dir)
            .filter((n) => n.startsWith(stem) && (n.endsWith('.jsonl') || n.endsWith('.jsonl.gz')))
            .map((n) => join(dir, n))
            .sort();
    }
    catch {
        return [];
    }
}
function writesIn(file) {
    let stamp;
    try {
        const st = statSync(file);
        stamp = `${st.size}:${Math.trunc(st.mtimeMs)}`;
    }
    catch {
        return [];
    }
    const cached = fileCache.get(file);
    if (cached !== undefined && cached.stamp === stamp)
        return cached.entries;
    let text = '';
    try {
        const raw = readFileSync(file);
        text = (file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8');
    }
    catch {
        text = '';
    }
    const entries = [];
    for (const line of text.split('\n')) {
        if (!line.includes(WRITE_MARKER))
            continue;
        let entry;
        try {
            entry = JSON.parse(line);
        }
        catch {
            continue;
        }
        if (typeof entry.path !== 'string' || typeof entry.sha256 !== 'string' || entry.sha256 === '')
            continue;
        entries.push([canonicalPath(entry.path), entry.sha256]);
    }
    fileCache.set(file, { stamp, entries });
    return entries;
}
/** Every `write` the transaction log records, keyed by canonical path. */
export function loggedWriteDigests(logPath = getLogPath()) {
    const writes = new Map();
    for (const file of logFiles(logPath)) {
        for (const [target, sha] of writesIn(file)) {
            let set = writes.get(target);
            if (set === undefined)
                writes.set(target, (set = new Set()));
            set.add(sha);
        }
    }
    return writes;
}
/**
 * Wrap a log writer so it records only paths this run's copy deploys.
 *
 * The claude-code rewrite and thinning passes walk the whole rule directory,
 * including rules the user authored there; logging those rewrites would make
 * the log vouch for content that was never the package's.
 */
export function onlyDeployed(anchor, currentFiles, log) {
    return (target) => {
        const rel = relative(resolve(anchor), resolve(target)).split(sep).join('/');
        if (currentFiles.has(rel))
            log(target);
    };
}
/** Did this installer write exactly `onDiskSha256` to `target`? */
export function wroteTheseBytes(target, onDiskSha256, writes) {
    return writes.get(canonicalPath(target))?.has(onDiskSha256) === true;
}
//# sourceMappingURL=loggedWrites.js.map
/**
 * Stat-index — skip an expensive scan when the input tree is unchanged
 * (road-to-retrieval-substrate-hardening B5a).
 *
 * The memory / knowledge / discovery scanners re-read their whole file set on
 * every `stop` / `session_start` hook, even when nothing changed. A stat-index
 * captures a cheap signature of the input files (size + mtime_ns) and caches
 * the scan's result beside it; a later call with the same signature returns the
 * cached payload without re-scanning. The cache is version-namespaced (so a
 * tool bump invalidates cleanly, versioned-cache lint B5b) and written
 * atomically (pid-temp + rename) so concurrent hook invocations stay
 * idempotent (council Q3).
 *
 * `size + mtime_ns` is sufficient for gating rebuild decisions (the council
 * withdrew the crypto-binding demand as a non-problem); a `--force` bypass and
 * an explicit `clear()` cover the rare stale-mtime case (e.g. `cp -p`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

/** A deterministic signature over a file set: `<count>:<Σsize>:<maxMtimeNs>:<hashOfPaths>`. */
export function statSignature(files: readonly string[]): string {
    let count = 0;
    let totalSize = 0;
    let maxMtimeNs = 0n;
    const sortedPaths = [...files].sort();
    for (const f of sortedPaths) {
        let st: fs.Stats;
        try {
            st = fs.statSync(f, { bigint: true }) as unknown as fs.Stats;
        } catch {
            continue; // missing file → excluded from the signature
        }
        count += 1;
        totalSize += Number((st as unknown as { size: bigint }).size);
        const m = (st as unknown as { mtimeNs: bigint }).mtimeNs;
        if (m > maxMtimeNs) maxMtimeNs = m;
    }
    // A stable hash of the path list so add/remove/rename shifts the signature
    // even when count + size + mtime coincide.
    let h = 5381;
    for (const p of sortedPaths) {
        for (let i = 0; i < p.length; i++) h = ((h * 33) ^ p.charCodeAt(i)) >>> 0;
    }
    return `${count}:${totalSize}:${maxMtimeNs.toString()}:${h.toString(16)}`;
}

interface CacheFile<T> {
    schema_version: number;
    signature: string;
    payload: T;
}

/**
 * Return the cached payload when the file-set signature is unchanged; otherwise
 * run `compute`, persist the result under `signature`, and return it.
 *
 * @param cachePath  version-namespaced cache file (e.g. `…-index-v1.json`)
 * @param files      the input file set whose stat signature gates the cache
 * @param compute    the expensive scan, run only on a miss
 * @param force      bypass the cache and always recompute (then persist)
 */
export function scanCached<T>(
    cachePath: string,
    files: readonly string[],
    compute: () => T,
    force = false,
): T {
    const signature = statSignature(files);
    if (!force) {
        try {
            const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheFile<T>;
            if (cached.signature === signature) return cached.payload;
        } catch {
            /* miss → recompute */
        }
    }
    const payload = compute();
    writeCacheAtomic<T>(cachePath, { schema_version: 1, signature, payload });
    return payload;
}

function writeCacheAtomic<T>(cachePath: string, data: CacheFile<T>): void {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    const tmp = `${cachePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, cachePath);
}

/** Drop a stat-index cache file (for `--force`-style resets / tests). */
export function clear(cachePath: string): void {
    try {
        fs.rmSync(cachePath);
    } catch {
        /* already absent */
    }
}

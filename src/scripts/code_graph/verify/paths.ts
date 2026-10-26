/**
 * Where the verify layer keeps its state: beside the graph cache it describes,
 * derived from that cache's path, so the files move wherever the graph home puts
 * the cache. Every file here is disposable and rebuildable from the source tree.
 */
import * as path from 'node:path';

import { gitProbe } from '../../_lib/spawn_env.js';

export interface VerifyPaths {
    /** Working-tree facts that replace the committed facts of changed files. */
    overlay: string;
    /** Facts whose source span disappeared, with the basis they were seen at. */
    tombstones: string;
    /** One line per confirm call: the change-risk class and the depth it chose. */
    shadow: string;
    /** Names the text search found where the graph knew no usage. */
    readerGaps: string;
}

export function verifyPaths(cachePath: string): VerifyPaths {
    const base = cachePath.endsWith('.json') ? cachePath.slice(0, -5) : cachePath;
    const dir = path.dirname(cachePath);
    return {
        overlay: `${base}.overlay.json`,
        tombstones: `${base}.tombstones.json`,
        shadow: path.join(dir, 'code-graph-confirm-shadow.jsonl'),
        readerGaps: path.join(dir, 'code-graph-reader-gaps.jsonl'),
    };
}

/** HEAD, or null outside a repository. */
export function headSha(root: string): string | null {
    try {
        const out = gitProbe(root, ['rev-parse', 'HEAD']).trim();
        return out === '' ? null : out;
    } catch {
        return null;
    }
}

/**
 * Paths the working tree changes against HEAD — modified, added, deleted,
 * renamed (new path) and untracked — repository-relative. `--untracked-files=all`
 * because plain porcelain collapses a new directory to one entry. Null when git
 * cannot answer, which a caller must not read as "nothing changed".
 */
export function workingChanges(root: string): { changed: string[]; deleted: string[] } | null {
    let out: string;
    try {
        out = gitProbe(root, ['status', '--porcelain', '--untracked-files=all'], { maxBuffer: 32 * 1024 * 1024, timeout: 10_000 });
    } catch {
        return null;
    }
    const changed: string[] = [];
    const deleted: string[] = [];
    for (const raw of out.split('\n')) {
        if (raw.length < 4) continue;
        const xy = raw.slice(0, 2);
        let p = raw.slice(3);
        const arrow = p.indexOf(' -> ');
        if (arrow !== -1) {
            deleted.push(unquote(p.slice(0, arrow)));
            p = p.slice(arrow + 4);
        }
        p = unquote(p);
        if (xy.includes('D')) deleted.push(p);
        else changed.push(p);
    }
    return { changed: [...new Set(changed)].sort(), deleted: [...new Set(deleted)].sort() };
}

/** Files changed between `rev` and HEAD; null for a rev git refuses (or one that looks like an option). */
export function revChanges(root: string, rev: string): string[] | null {
    if (rev.startsWith('-')) return null;
    try {
        return gitProbe(root, ['diff', '--name-only', `${rev}..HEAD`])
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
    } catch {
        return null;
    }
}

function unquote(p: string): string {
    return p.trim().replace(/^"|"$/g, '');
}

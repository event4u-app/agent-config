/**
 * The window of history the history lane and the map's per-file answers both
 * read: one `git log --name-status` pass over the `days` before HEAD's commit
 * date. A refresh builds the graph in a child process and redraws the map in its
 * own, so the pass is kept per HEAD in the graph's `.build/` and the second
 * reader takes it from there instead of walking the history again.
 *
 * Each record is `RS sha US author US date`, then one name-status line per path.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from '../_lib/fs_atomic.js';
import { gitProbe } from '../_lib/spawn_env.js';
import { graphHome } from './graph_home.js';

export const WINDOW_RS = '\x1e';
export const WINDOW_US = '\x1f';

export type WindowLog = { log: string } | { skip: string };

type Git = (args: readonly string[]) => string;

const CACHE_FILE = 'history-window.log';

function defaultGit(root: string): Git {
    return (args) => gitProbe(root, args, { maxBuffer: 512 * 1024 * 1024 });
}

/** The graph's `.build/` for `root` when it already exists; the window is never the reason to create one. */
function defaultCacheDir(root: string): string | null {
    try {
        const dir = graphHome(root).buildDir;
        return fs.statSync(dir).isDirectory() ? dir : null;
    } catch {
        return null;
    }
}

/**
 * The window ending at HEAD's commit date — anchored on the commit, not the
 * clock, so two reads of one commit see the same commits — or the reason it
 * cannot be read. `cacheDir: null` reads without the cache.
 */
export function windowLog(root: string, days: number, opts: { git?: Git; cacheDir?: string | null } = {}): WindowLog {
    const git = opts.git ?? defaultGit(root);
    let head: string;
    try {
        head = git(['log', '-1', `--format=%H${WINDOW_US}%cI`]).trim();
    } catch {
        return { skip: 'not a git repository or no commits' };
    }
    if (!head) return { skip: 'no commits' };
    try {
        // A shallow clone holds a commit or two: an empty window would read as a quiet one.
        if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') return { skip: 'shallow clone' };
    } catch {
        return { skip: 'cannot tell whether the clone is shallow' };
    }
    const [sha = '', iso = ''] = head.split(WINDOW_US);
    const key = `${sha} ${days}`;
    const cacheDir = opts.cacheDir === undefined ? defaultCacheDir(root) : opts.cacheDir;
    const file = cacheDir ? path.join(cacheDir, CACHE_FILE) : null;
    if (file) {
        try {
            const cached = fs.readFileSync(file, 'utf-8');
            const nl = cached.indexOf('\n');
            if (nl > 0 && cached.slice(0, nl) === key) return { log: cached.slice(nl + 1) };
        } catch {
            /* no window kept yet */
        }
    }
    const since = new Date(new Date(iso).getTime() - days * 86_400_000).toISOString();
    let log: string;
    try {
        // `--relative`: paths are root-relative when root is a package inside a larger repository.
        // `-M`: a renamed file keeps its history under the name it carries today.
        log = git(['-c', 'core.quotePath=false', 'log', `--since=${since}`, '--no-merges', '-M', '--relative', '--name-status', `--format=${WINDOW_RS}%H${WINDOW_US}%aN${WINDOW_US}%cs`, '--', '.']);
    } catch {
        return { skip: 'git log failed' };
    }
    if (file) {
        try {
            write_atomic(file, `${key}\n${log}`);
        } catch {
            /* a window that cannot be kept is read again next time */
        }
    }
    return { log };
}

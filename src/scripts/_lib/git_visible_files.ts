/**
 * The files git would show under a directory: tracked plus untracked, minus
 * what `.gitignore` excludes.
 *
 * A directory walk sees everything on disk, so a map built from one indexed
 * 1,660 ignored files of this repository — an inbox archive among them — and
 * would have published their names with the map. Git is the authority on what
 * it ignores, so the walkers ask it once instead of re-implementing the rules.
 *
 * `null` means "not answerable here": no git, not a work tree, or a root the
 * enclosing repository itself ignores (a scratch directory inside an ignored
 * folder) — the caller then walks as before.
 */
import { gitProbe } from './spawn_env.js';

export interface GitVisible {
    /** root-relative POSIX paths of visible files */
    files: ReadonlySet<string>;
    /** every ancestor directory of a visible file, root-relative, without the root itself */
    dirs: ReadonlySet<string>;
    /** submodule paths: git lists the link, not the files inside it */
    gitlinks: ReadonlySet<string>;
}

/** Per-root answers while a scope is open; null outside one, where every call asks git. */
let scope: Map<string, GitVisible | null> | null = null;

/**
 * Runs `fn` with one `git ls-files` answer per root: a lane run walks the tree
 * dozens of times and each walk used to spawn three git processes (1.65 s of a
 * 3.4 s lane run, measured on a 353-file repository). The tree is not expected
 * to change inside `fn`; nested calls share the outer scope.
 */
export function withGitVisibleScope<T>(fn: () => T): T {
    if (scope !== null) return fn();
    scope = new Map();
    try {
        return fn();
    } finally {
        scope = null;
    }
}

/**
 * The same scope around an async `fn`. Only for a caller that already runs
 * alone in its process (the map redraw is single-writer per process), since any
 * other code awaiting meanwhile would read the scope's answers too.
 */
export async function withGitVisibleScopeAsync<T>(fn: () => Promise<T>): Promise<T> {
    if (scope !== null) return fn();
    scope = new Map();
    try {
        return await fn();
    } finally {
        scope = null;
    }
}

export function gitVisibleFiles(root: string): GitVisible | null {
    if (scope === null) return askGit(root);
    if (!scope.has(root)) scope.set(root, askGit(root));
    return scope.get(root) ?? null;
}

function askGit(root: string): GitVisible | null {
    try {
        if (gitProbe(root, ['rev-parse', '--is-inside-work-tree']).trim() !== 'true') return null;
    } catch {
        return null;
    }
    try {
        // exit 0 = the root itself is ignored: everything below would vanish
        gitProbe(root, ['check-ignore', '-q', '.']);
        return null;
    } catch {
        /* not ignored — the normal case */
    }
    let listed: string;
    let staged: string;
    try {
        listed = gitProbe(root, ['-c', 'core.quotePath=false', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'], {
            maxBuffer: 256 * 1024 * 1024,
        });
        staged = gitProbe(root, ['-c', 'core.quotePath=false', 'ls-files', '-z', '--stage', '--', '.'], { maxBuffer: 256 * 1024 * 1024 });
    } catch {
        return null;
    }
    const gitlinks = new Set<string>();
    for (const rec of staged.split('\0')) {
        if (rec.startsWith('160000 ')) gitlinks.add(rec.slice(rec.indexOf('\t') + 1));
    }
    const files = new Set<string>();
    const dirs = new Set<string>();
    for (const raw of listed.split('\0')) {
        // A nested repository git does not track is listed as its directory: walk it as before.
        if (raw.endsWith('/')) {
            gitlinks.add(raw.slice(0, -1));
            continue;
        }
        const p = raw;
        if (!p || gitlinks.has(p)) continue;
        files.add(p);
        for (let i = p.indexOf('/'); i > 0; i = p.indexOf('/', i + 1)) dirs.add(p.slice(0, i));
    }
    for (const g of gitlinks) for (let i = g.indexOf('/'); i > 0; i = g.indexOf('/', i + 1)) dirs.add(g.slice(0, i));
    return { files, dirs, gitlinks };
}

/**
 * Whether a walk should enter `relDir` and keep `relFile`, given a visibility
 * set; everything below a submodule link is kept, as before.
 */
export function visibleDir(v: GitVisible, relDir: string): 'enter' | 'all' | 'skip' {
    if (v.gitlinks.has(relDir)) return 'all';
    return v.dirs.has(relDir) ? 'enter' : 'skip';
}

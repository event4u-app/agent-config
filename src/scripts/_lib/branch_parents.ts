/**
 * Which branch a branch was made from — the parent its work has to stay
 * current with, and the parent's parent, up to the default branch.
 *
 * Resolved in this order (D13): the base of the branch's open pull request, as
 * the forge reports it; else the parent recorded in local git config
 * (`branch.<name>.agentConfigParent`, written when the branch is made from
 * another, never committed); else unknown — said so, with the command that
 * records it. A merge base is not a parent: two branches cut from the same
 * commit share one, and it names neither.
 */
import { gitProbe } from './spawn_env.js';

export type ParentSource = 'pull-request' | 'recorded';

export interface ChainLink {
    branch: string;
    parent: string | null;
    source: ParentSource | 'unknown' | 'root';
}

export type ForgeBase = (branch: string) => { kind: 'pr'; base: string; number?: number } | { kind: 'none' } | { kind: 'unavailable'; reason: string };

export const PARENT_KEY = 'agentConfigParent';
/** The parent's commit when the branch was made: the point the branch started from. */
export const PARENT_SHA_KEY = 'agentConfigParentSha';
const MAX_DEPTH = 10;

function git(root: string, args: readonly string[]): string | null {
    try {
        return gitProbe(root, args).trim();
    } catch {
        return null;
    }
}

export function currentBranch(root: string): string | null {
    const b = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    return b && b.length ? b : null;
}

/** The default branch as this clone knows it, without the network. */
export function defaultBranch(root: string): string {
    const sym = git(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
    if (sym) return sym.replace(/^origin\//, '');
    for (const b of ['main', 'master', 'trunk', 'develop']) if (git(root, ['show-ref', '--verify', '--quiet', `refs/heads/${b}`]) !== null) return b;
    return 'main';
}

export function recordedParent(root: string, branch: string): string | null {
    const v = git(root, ['config', '--get', `branch.${branch}.${PARENT_KEY}`]);
    return v && v.length ? v : null;
}

export function recordedParentSha(root: string, branch: string): string | null {
    const v = git(root, ['config', '--get', `branch.${branch}.${PARENT_SHA_KEY}`]);
    return v && v.length ? v : null;
}

/**
 * Record the current branch's parent and the parent's SHA from the reflog, the
 * moment after `checkout -b` (the post-checkout hook): the branch's first reflog
 * entry says where it was created from, and `HEAD`'s says which branch HEAD was
 * on then. A parent already recorded is never overwritten. Offline, local refs only.
 */
export function recordParentFromReflog(root: string, branch: string | null = currentBranch(root)): { branch: string; parent: string; sha: string } | null {
    if (!branch || recordedParent(root, branch)) return null;
    const entries = (git(root, ['reflog', 'show', '--format=%H %gs', `refs/heads/${branch}`]) ?? '').split('\n').filter(Boolean);
    const first = entries[entries.length - 1];
    const m = first ? /^([0-9a-f]{7,64}) branch: Created from (.+)$/.exec(first) : null;
    if (!m) return null;
    let parent = (m[2] as string).trim();
    if (parent === 'HEAD') {
        const move = (git(root, ['reflog', 'show', '-n', '20', '--format=%gs', 'HEAD']) ?? '').split('\n').map((l) => /^checkout: moving from (\S+) to (\S+)$/.exec(l)).find((x) => x?.[2] === branch);
        parent = move?.[1] ?? '';
    }
    parent = parent.replace(/^refs\/heads\//, '');
    if (!parent || parent === branch || git(root, ['show-ref', '--verify', '--quiet', `refs/heads/${parent}`]) === null) return null;
    const sha = m[1] as string;
    if (!recordParent(root, branch, parent)) return null;
    try {
        gitProbe(root, ['config', `branch.${branch}.${PARENT_SHA_KEY}`, sha]);
    } catch {
        /* the parent alone still serves the chain */
    }
    return { branch, parent, sha };
}

/**
 * A recorded parent that is merged into its own parent — its tip an ancestor
 * of the grandparent's — hands its children to the grandparent. Offline: local
 * refs only, and a squash merge is not seen. Returns one report line per move.
 */
export function reparentMerged(root: string): string[] {
    const def = defaultBranch(root);
    const lines: string[] = [];
    const branches = (git(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']) ?? '').split('\n').filter(Boolean);
    for (const child of branches) {
        const p = recordedParent(root, child);
        if (!p || p === def) continue;
        const grand = recordedParent(root, p) ?? def;
        if (grand === child || git(root, ['show-ref', '--verify', '--quiet', `refs/heads/${grand}`]) === null) continue;
        const gone = git(root, ['show-ref', '--verify', '--quiet', `refs/heads/${p}`]) === null;
        const merged = !gone && git(root, ['merge-base', '--is-ancestor', `refs/heads/${p}`, `refs/heads/${grand}`]) !== null;
        if (!gone && !merged) continue;
        if (!recordParent(root, child, grand)) continue;
        lines.push(`${child}: parent ${p} is ${gone ? 'gone' : `merged into ${grand}`} — re-parented to ${grand}`);
    }
    return lines;
}

/** Writes the parent into the clone's local config — never into a tracked file. */
export function recordParent(root: string, branch: string, parent: string): boolean {
    try {
        gitProbe(root, ['config', `branch.${branch}.${PARENT_KEY}`, parent]);
        return true;
    } catch {
        return false;
    }
}

export function parentOf(root: string, branch: string, opts: { forge?: ForgeBase; defaultName?: string } = {}): ChainLink {
    const def = opts.defaultName ?? defaultBranch(root);
    if (branch === def) return { branch, parent: null, source: 'root' };
    const forge = opts.forge?.(branch);
    if (forge?.kind === 'pr') return { branch, parent: forge.base, source: 'pull-request' };
    const rec = recordedParent(root, branch);
    if (rec) return { branch, parent: rec, source: 'recorded' };
    return { branch, parent: null, source: 'unknown' };
}

/** The chain from the default branch down to `branch`, root first; stops at an unknown parent or a cycle. */
export function chainOf(root: string, branch: string, opts: { forge?: ForgeBase; defaultName?: string } = {}): ChainLink[] {
    const def = opts.defaultName ?? defaultBranch(root);
    const out: ChainLink[] = [];
    const seen = new Set<string>();
    let cur: string | null = branch;
    while (cur && !seen.has(cur) && out.length < MAX_DEPTH) {
        seen.add(cur);
        const link = parentOf(root, cur, { ...opts, defaultName: def });
        out.push(link);
        cur = link.parent;
    }
    return out.reverse();
}

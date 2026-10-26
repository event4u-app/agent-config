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

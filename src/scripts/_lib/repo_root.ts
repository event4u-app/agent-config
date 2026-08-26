/**
 * Repository-root resolution that REFUSES rather than guesses.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 2 Step 6. The trap class
 * this closes is small to describe and has cost multiple sessions:
 *
 *   1. **An inherited `GIT_DIR`.** A git hook exports `GIT_DIR` (often `.git`,
 *      relative) into every child process. A gate that resolves its root with
 *      `git rev-parse --show-toplevel` then answers for whatever repository the
 *      inherited variable points at — which inside a worktree hook is the parent
 *      checkout, not the tree being committed. The gate runs, reads the wrong
 *      files, and passes.
 *   2. **A path walked one directory too far.** `path.resolve(__dirname, '..',
 *      '..')` is correct until a file moves, and then it silently addresses a
 *      parent directory that also exists. Nothing fails; the scan is simply
 *      empty, which several gates report as a clean pass.
 *
 * Both are the same failure in the end: a resolver that always SUCCEEDS. So the
 * contract here is the opposite — a root is returned only when the directory
 * carries a **sentinel** proving it is the repository, and otherwise the call
 * throws. A caller that cannot locate its own repository should stop, not scan
 * an arbitrary directory.
 *
 * The sentinel is `package.json` carrying this package's `name`, not a bare
 * `package.json`: every node_modules entry and every sibling project has one of
 * those, and a resolver that accepts any of them has not narrowed anything.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** The package name that identifies THIS repository. */
export const SENTINEL_PACKAGE_NAME = '@event4u/agent-config';

/** Raised when no directory on the walk carries the sentinel. */
export class RepoRootUnresolvedError extends Error {
    readonly startedAt: string;

    constructor(startedAt: string, message: string) {
        super(message);
        this.name = 'RepoRootUnresolvedError';
        this.startedAt = startedAt;
    }
}

/**
 * True when `dir` is this repository's root.
 *
 * Reads `package.json` and compares `name`. A parse failure is `false`, never a
 * throw: a malformed `package.json` somewhere up the walk must not stop the walk
 * from reaching a valid root above it.
 */
export function hasSentinel(dir: string): boolean {
    try {
        const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
        return (JSON.parse(raw) as { name?: unknown }).name === SENTINEL_PACKAGE_NAME;
    } catch {
        return false;
    }
}

/**
 * Walk upward from `from` and return the first directory carrying the sentinel.
 *
 * @throws {RepoRootUnresolvedError} when the walk reaches the filesystem root
 * without finding one. Deliberately not a `null` return: an optional type
 * invites `?? process.cwd()`, which is the guess this module exists to prevent.
 */
export function resolveRepoRoot(from: string = process.cwd()): string {
    let dir = path.resolve(from);
    const seen: string[] = [];
    for (;;) {
        seen.push(dir);
        if (hasSentinel(dir)) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    throw new RepoRootUnresolvedError(
        path.resolve(from),
        `no repository root above ${path.resolve(from)} — no directory on the walk carries a ` +
            `package.json named "${SENTINEL_PACKAGE_NAME}". Checked ${String(seen.length)} directory(ies). ` +
            'This is a refusal, not a fallback: resolving to the working directory here is how a gate ' +
            'ends up scanning an arbitrary tree and reporting a clean pass over it.',
    );
}

/**
 * The environment variables that override git's own discovery.
 *
 * `GIT_DIR` is the one that has actually bitten; the other three are listed
 * because they fail the same way and a reader checking for one should see all
 * four rather than believe the list is complete at one entry.
 */
export const GIT_DISCOVERY_OVERRIDES = [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_COMMON_DIR',
] as const;

/** Any git discovery override present in `env`, with its value. */
export function inheritedGitOverrides(
    env: NodeJS.ProcessEnv = process.env,
): { name: string; value: string }[] {
    const out: { name: string; value: string }[] = [];
    for (const name of GIT_DISCOVERY_OVERRIDES) {
        const value = env[name];
        if (typeof value === 'string' && value !== '') out.push({ name, value });
    }
    return out;
}

/**
 * The git and gh subprocess layer of the worktree cleanup: one deadline for a
 * budgeted pass, and an environment that can neither refresh an index nor be
 * redirected to another repository.
 */

import { execFileSync } from 'node:child_process';

/**
 * An absolute deadline for every git and gh subprocess while a budgeted pass
 * runs. A budget checked only between candidates is not a budget: one slow
 * `git status` would run past it. With a deadline set, each call gets only the
 * time left, and a call that would start after it throws — so the pass fails
 * closed instead of finishing late.
 */
let subprocessDeadline: number | null = null;

export function withDeadline<T>(deadlineAt: number, fn: () => T): T {
    const prev = subprocessDeadline;
    subprocessDeadline = deadlineAt;
    try {
        return fn();
    } finally {
        subprocessDeadline = prev;
    }
}

export function timeLeftMs(): number | undefined {
    if (subprocessDeadline === null) return undefined;
    const left = subprocessDeadline - Date.now();
    if (left <= 0) throw new Error('budget spent');
    return left;
}

export function git(cwd: string, args: string[], input?: string): string {
    const timeout = timeLeftMs();
    return execFileSync('git', ['-C', cwd, ...args], {
        encoding: 'utf-8',
        stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        ...(input === undefined ? {} : { input }),
        ...(timeout === undefined ? {} : { timeout }),
        // No git call made here may refresh an index: the inventory reads index
        // mtimes as a liveness fallback, so a refresh would fake activity.
        env: gitEnv(),
    });
}

export function tryGit(cwd: string, args: string[], input?: string): string | null {
    try {
        return git(cwd, args, input);
    } catch {
        return null;
    }
}

/**
 * The caller's environment minus the variables that redirect `git -C`: a hook
 * process inherits `GIT_DIR` / `GIT_WORK_TREE` / `GIT_INDEX_FILE`, and with any
 * of them set every per-worktree call would read the wrong repository.
 */
export function gitEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    delete env.GIT_INDEX_FILE;
    return env;
}

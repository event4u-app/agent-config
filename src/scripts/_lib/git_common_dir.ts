/**
 * Resolve a repository's **common git directory** — the one directory every
 * worktree of a repo shares.
 *
 * Extracted from `_cli/cmd_doctor.ts::_git_config_path`, which has resolved the
 * `commondir` file this way since the git-identity check shipped. It is
 * extracted rather than re-implemented on purpose: a repo with two different
 * answers to "where is the common dir" is a bug waiting for a symlinked parent,
 * and the worktree-cleanup work already hit that class once.
 *
 * ## Why this reads files instead of shelling out to git
 *
 * `git rev-parse --git-common-dir` is the obvious implementation and is wrong
 * for the callers here, twice over:
 *
 * 1. **Inherited `GIT_DIR` overrides discovery.** Git hooks export `GIT_DIR`,
 *    and every child inherits it, so `execFileSync('git', …, { cwd })` silently
 *    resolves against the *hook's* repository rather than `cwd` — in a linked
 *    worktree those differ, and the symptom is wrong data, not an error. That
 *    is exactly what `_lib/git_env.ts` exists to strip. A file-based resolution
 *    has nothing to override and needs no such guard.
 * 2. **The raw output is not comparable across checkouts.** Measured
 *    2026-08-07: from a main checkout `git rev-parse --git-common-dir` prints
 *    the **relative** `.git`; from a linked worktree it prints an absolute
 *    path. A consumer comparing the raw strings concludes the two checkouts
 *    have different common dirs. Only the resolved realpath is a repo identity.
 *
 * ## Symlinked parents converge
 *
 * Measured on a throwaway repo reached both directly and through a symlinked
 * ancestor: all four accesses (main / worktree × real / symlinked) resolve to
 * the same directory, because the returned path is realpath-normalised here.
 * This is the opposite of the worktree-cleanup finding that motivated the
 * check — there realpath reporting caused a mis-classification; here it is the
 * property that makes one shared register possible.
 *
 * Never throws: every caller treats "no common dir" as a reason to degrade,
 * not as an error worth failing a hook over.
 */

import fs from 'node:fs';
import path from 'node:path';

/** `fs.realpathSync` that falls back to the input when the path is unreadable. */
function realpath_or_self(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return p;
    }
}

/**
 * The **per-worktree** git directory for `project_root` — `.git` in a plain
 * checkout, the linked gitdir in a worktree. This is where `HEAD` lives, so it
 * is the right anchor for "which branch is THIS checkout on", as opposed to
 * `git_common_dir` which is deliberately shared across worktrees.
 */
export function git_dir(project_root: string): string | null {
    const dot_git = path.join(project_root, '.git');
    try {
        const st = fs.statSync(dot_git);
        if (st.isDirectory()) {
            return realpath_or_self(dot_git);
        }
        const m = fs.readFileSync(dot_git, 'utf-8').match(/^gitdir:\s*(.+)\s*$/m);
        if (m === null) {
            return null;
        }
        return realpath_or_self(path.resolve(project_root, m[1]!.trim()));
    } catch {
        return null;
    }
}

/**
 * Current branch name for `project_root`, or `null` on a detached HEAD or
 * outside a repo.
 *
 * Reads `<git-dir>/HEAD` directly rather than shelling out, for the same reason
 * as everything else in this module: hooks export `GIT_DIR`, and an inherited
 * one silently redirects `git` to the wrong repository.
 */
export function current_branch(project_root: string): string | null {
    const gd = git_dir(project_root);
    if (gd === null) return null;
    try {
        const head = fs.readFileSync(path.join(gd, 'HEAD'), 'utf-8').trim();
        const m = head.match(/^ref:\s*refs\/heads\/(.+)$/);
        return m === null ? null : m[1]!.trim();
    } catch {
        return null;
    }
}

/**
 * The common git directory for `project_root`, realpath-normalised, or `null`
 * when `project_root` is not inside a git repository.
 *
 * - Plain checkout → `<project_root>/.git`.
 * - Linked worktree → the `commondir` target of the worktree's gitdir, i.e. the
 *   main checkout's `.git`, which is identical from every worktree of the repo.
 * - Worktree gitdir without a `commondir` file → the gitdir itself (degenerate,
 *   but the historical behaviour and not this change's to alter).
 */
export function git_common_dir(project_root: string): string | null {
    const dot_git = path.join(project_root, '.git');
    try {
        const st = fs.statSync(dot_git);
        if (st.isDirectory()) {
            return realpath_or_self(dot_git);
        }
        // Linked worktree: `.git` is a FILE containing "gitdir: <path>".
        const m = fs.readFileSync(dot_git, 'utf-8').match(/^gitdir:\s*(.+)\s*$/m);
        if (m === null) {
            return null;
        }
        const gitdir = path.resolve(project_root, m[1]!.trim());
        const commondir_file = path.join(gitdir, 'commondir');
        if (fs.existsSync(commondir_file)) {
            const common = path.resolve(gitdir, fs.readFileSync(commondir_file, 'utf-8').trim());
            return realpath_or_self(common);
        }
        return realpath_or_self(gitdir);
    } catch {
        return null;
    }
}

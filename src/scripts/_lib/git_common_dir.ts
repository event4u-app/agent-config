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

// ---------------------------------------------------------------------------
// Workspace identity
// ---------------------------------------------------------------------------

/**
 * One answer to one identity question, and never a silent default.
 *
 * The census that motivated this type (`agents/evidence/analysis/
 * workspace-identity-census.md`) found three of eight repo-root sites falling
 * back to a value that is *plausible but wrong* when git cannot answer —
 * `process.cwd()`, a path derived from the script's own location, an
 * exception. A caller cannot distinguish those from a real answer, which is
 * how a gate ends up scanning the wrong tree and exiting green.
 */
export type IdentityField =
    | { readonly resolved: true; readonly value: string; readonly provenance: string }
    | { readonly resolved: false; readonly reason: string };

/** The five workspace-identity questions, each independently resolvable. */
export interface WorkspaceIdentity {
    /**
     * Top level of the working tree the caller is in — the drop-in for
     * `git rev-parse --show-toplevel`. Inside a linked worktree this is the
     * worktree's own root, exactly as git reports it.
     */
    readonly repoRoot: IdentityField;
    /**
     * The main (non-linked) checkout. Derived from the common git dir, so it
     * is the same value from every worktree of the repo. This is the field the
     * two shipped misclassification defects needed and did not have.
     */
    readonly mainWorktree: IdentityField;
    /**
     * The checkout the caller is in. Its `value` equals `repoRoot` by git's own
     * definition; the two fields exist separately because the *provenance*
     * differs and that is the part callers need — `main-checkout` versus
     * `linked-worktree` is precisely the question `isStandardLocation` got
     * wrong twice.
     */
    readonly currentWorktree: IdentityField;
    /** Branch of the current checkout; unresolved on a detached HEAD. */
    readonly branch: IdentityField;
    /**
     * The remote's default branch, as a `refs/remotes/<remote>/<name>` ref —
     * the offline notion of "what a PR from here would target".
     *
     * Deliberately NOT the `gh`-derived base of an actual open PR: that needs
     * network and auth, and `check_branch_freshness.ts` already owns it. This
     * field answers the question a gate can answer without leaving the disk,
     * and reports `unresolved` rather than guessing `main` when the repo has
     * no recorded default.
     */
    readonly prBase: IdentityField;
}

function resolved(value: string, provenance: string): IdentityField {
    return { resolved: true, value, provenance };
}

function unresolved(reason: string): IdentityField {
    return { resolved: false, reason };
}

/**
 * Walk up from `start` to the first directory holding a `.git` entry.
 *
 * File-based on purpose, like everything else here: `rev-parse --show-toplevel`
 * would be redirected by an inherited `GIT_DIR`, and the symptom is a wrong
 * path rather than an error.
 */
function discover_root(start: string): string | null {
    let dir = realpath_or_self(path.resolve(start));
    for (;;) {
        if (fs.existsSync(path.join(dir, '.git'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

/**
 * Is `project_root`'s `.git` a linked-worktree pointer file rather than a
 * directory? Returns `null` when there is no `.git` entry at all.
 */
function is_linked_worktree(project_root: string): boolean | null {
    try {
        return !fs.statSync(path.join(project_root, '.git')).isDirectory();
    } catch {
        return null;
    }
}

/** The remote default branch ref, read from disk. `null` when unrecorded. */
function remote_head_ref(common_dir: string, remote: string): string | null {
    // A symbolic ref is stored loose; `git pack-refs` never packs one, so
    // packed-refs is not a fallback for this specific ref — a repo that has
    // never run `git remote set-head` simply has no answer on disk.
    try {
        const raw = fs.readFileSync(path.join(common_dir, 'refs', 'remotes', remote, 'HEAD'), 'utf-8');
        const m = raw.match(/^ref:\s*(refs\/remotes\/.+?)\s*$/m);
        return m === null ? null : m[1]!.trim();
    } catch {
        return null;
    }
}

/**
 * Resolve all five workspace-identity questions from `start` (default: the
 * process cwd), reading files only.
 *
 * Every field is either a value with its provenance or an explicit reason it
 * could not be resolved. Nothing here throws and nothing guesses.
 */
export function workspaceIdentity(
    start: string = process.cwd(),
    remote = 'origin',
): WorkspaceIdentity {
    const root = discover_root(start);
    if (root === null) {
        const why = `no .git entry in ${path.resolve(start)} or any ancestor`;
        return {
            repoRoot: unresolved(why),
            mainWorktree: unresolved(why),
            currentWorktree: unresolved(why),
            branch: unresolved(why),
            prBase: unresolved(why),
        };
    }

    const linked = is_linked_worktree(root);
    const repoRoot = resolved(root, 'upward .git walk from cwd');
    const currentWorktree = resolved(
        root,
        linked === true
            ? 'linked-worktree (.git is a gitdir pointer file)'
            : 'main-checkout (.git is a directory)',
    );

    const common = git_common_dir(root);
    let mainWorktree: IdentityField;
    if (common === null) {
        mainWorktree = unresolved('no common git dir resolvable from the repo root');
    } else if (path.basename(common) === '.git') {
        mainWorktree = resolved(path.dirname(common), 'dirname of the common git dir');
    } else {
        // Bare repo, `core.worktree`, or a separate-gitdir layout: the common
        // dir is not `<main>/.git`, so `dirname` would name a directory that is
        // not a checkout. Refusing is the point of the type.
        mainWorktree = unresolved(
            `common git dir ${common} is not named .git — bare or separate-gitdir layout has no main worktree to derive`,
        );
    }

    const br = current_branch(root);
    const branch = br === null
        ? unresolved('detached HEAD, or HEAD unreadable in the per-worktree git dir')
        : resolved(br, 'ref line of <git-dir>/HEAD');

    let prBase: IdentityField;
    if (common === null) {
        prBase = unresolved('no common git dir resolvable from the repo root');
    } else {
        const ref = remote_head_ref(common, remote);
        prBase = ref === null
            ? unresolved(
                `no refs/remotes/${remote}/HEAD on disk — run \`git remote set-head ${remote} -a\`; not guessed`,
            )
            : resolved(ref, `symbolic ref refs/remotes/${remote}/HEAD`);
    }

    return { repoRoot, mainWorktree, currentWorktree, branch, prBase };
}

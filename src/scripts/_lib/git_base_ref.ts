/**
 * The one reading of a `--base` value, shared by `sync_pr_branch` and
 * `check_branch_freshness`.
 *
 * The two resolvers used to accept different spellings: one prefixed every
 * value with `origin/`, the other asked the server for `refs/heads/<value>`
 * verbatim. A name copied from one tool's output into the other then named a
 * ref nobody has (`origin/origin/main`, `refs/heads/origin/main`), and the
 * freshness gate read that absent ref as an unreachable remote and passed.
 *
 * A value that already names where it lives is kept as given: a
 * remote-tracking ref and `<remote>/x` for a configured remote. `refs/heads/x`
 * names the branch on origin, so it maps to `refs/remotes/origin/x`: the local
 * branch of that name is the same clone-time copy a bare name avoids, and a
 * fetch never updates it. Anything else is a branch name on origin, slashes
 * included, because `release/1.x` is a branch name and not a remote called
 * `release`.
 */

export interface BaseRef {
    /** The remote the server-side SHA is asked of. */
    readonly remote: string;
    /** The branch name on that remote. */
    readonly branch: string;
    /** The ref git operations use locally: as given, or `origin/<branch>` for a bare name. */
    readonly ref: string;
}

const REMOTE_TRACKING = 'refs/remotes/';
const LOCAL_HEADS = 'refs/heads/';

/**
 * The usage error for a `--base` given a blank value, or null for one that
 * names something. Every tool that accepts `--base` rejects a blank one: an
 * unset variable expands to nothing, and reading that as "no override" judged
 * the run against the default branch without a word.
 */
export function blankBaseError(value: string): string | null {
    return value.trim() === '' ? '--base was given an empty value — name the base branch (an unset variable expands to nothing); nothing was read or merged' : null;
}

/**
 * The usage error for any `--base` value that must not reach git: a blank one,
 * or one whose branch name starts with `-`, which git would read as an option.
 * No branch can carry that name (`git check-ref-format --branch` refuses it).
 */
export function baseValueError(value: string, remotes: readonly string[] = []): string | null {
    const blank = blankBaseError(value);
    if (blank !== null) return blank;
    const v = value.trim();
    const branch = v.startsWith('-') ? v : (parseBaseRef(v, remotes)?.branch ?? v);
    return branch.startsWith('-') ? `--base ${JSON.stringify(v)} names a branch that starts with "-", which git reads as an option — no branch has that name; nothing was read or merged` : null;
}

/** Read a `--base` value; null when it is empty. `remotes` are the configured remote names. */
export function parseBaseRef(value: string, remotes: readonly string[] = []): BaseRef | null {
    const v = value.trim();
    if (v === '') return null;
    if (v.startsWith(LOCAL_HEADS) && v.length > LOCAL_HEADS.length) {
        const branch = v.slice(LOCAL_HEADS.length);
        return { remote: 'origin', branch, ref: `${REMOTE_TRACKING}origin/${branch}` };
    }
    if (v.startsWith('refs/')) return splitResolvedRef(v);
    const slash = v.indexOf('/');
    const known = new Set(['origin', ...remotes]);
    if (slash > 0 && slash < v.length - 1 && known.has(v.slice(0, slash))) {
        return { remote: v.slice(0, slash), branch: v.slice(slash + 1), ref: v };
    }
    return { remote: 'origin', branch: v, ref: `origin/${v}` };
}

/**
 * Split a ref that was already resolved by `parseBaseRef` or reported by git
 * (`origin/main`, `refs/heads/main`). A full ref outside the branch namespaces
 * keeps its whole name as the branch, so the server answers it as unknown.
 */
export function splitResolvedRef(ref: string): BaseRef {
    if (ref.startsWith(LOCAL_HEADS)) return { remote: 'origin', branch: ref.slice(LOCAL_HEADS.length), ref };
    if (ref.startsWith(REMOTE_TRACKING)) {
        const rest = ref.slice(REMOTE_TRACKING.length);
        const slash = rest.indexOf('/');
        if (slash > 0) return { remote: rest.slice(0, slash), branch: rest.slice(slash + 1), ref };
    }
    if (ref.startsWith('refs/')) return { remote: 'origin', branch: ref, ref };
    const slash = ref.indexOf('/');
    return slash > 0 ? { remote: ref.slice(0, slash), branch: ref.slice(slash + 1), ref } : { remote: 'origin', branch: ref, ref: `origin/${ref}` };
}

/** `<remote>/<branch>`, the name a human reads and `task push-ready BASE=` accepts. */
export function displayBase(b: BaseRef): string {
    return `${b.remote}/${b.branch}`;
}

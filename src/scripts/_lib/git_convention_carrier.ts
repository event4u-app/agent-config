/**
 * The committed git convention: `.git-convention.yml` at the repository root
 * (ADR-282), layered over the developer settings files.
 *
 * The developer files are gitignored, so a convention declared only there
 * reaches the checkout it was written in and no worktree, fresh clone or CI
 * run. The carrier is tracked, and where it is read from is the authority:
 *
 * - `update_strategy` at the resolved TARGET commit — an explicit `--base` when
 *   given, else the open pull request's base, else the default branch — as the
 *   server reports it. The strategy that judges a pull request must not come from that
 *   pull request, the same ruling `branch_convergence.ts` records; a value on
 *   the branch is a candidate and is never adopted.
 * - `commit_format` and `branch_pattern` at `HEAD`, at the repository root,
 *   because they shape the branch's own commits and names.
 *
 * In both cases the carrier is the highest-precedence layer, over every
 * developer layer including the gitignored local one (the owner's D8), and a
 * carrier that does not set a key leaves it to the developer layers read at
 * the repository root, never per subdirectory. A target commit that cannot be
 * resolved is `unresolvable`, never the default.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { find_project_root } from './agent_settings.js';
import {
    GIT_CONVENTION_KEYS,
    checkoutSource,
    conventionReading,
    parseLayerText,
    readGitConventionKey,
    type GitConventionKey,
    type GitConventionLayer,
    type GitConventionReading,
} from './git_convention.js';

/** The tracked repository-root file a team declares its git convention in. */
export const CARRIER_PATH = '.git-convention.yml';

/** Sized for a ref lookup (`ls-remote`, `gh pr list`), which transfers no objects. */
export const NETWORK_TIMEOUT_MS = 8_000;

/**
 * The target-commit fetch transfers objects, and the target is routinely a
 * commit the server has advanced past the local fetch, so a large repository
 * needs longer than a ref lookup does. Running out of time here makes the
 * reading `unresolvable` and stops a sync, so the bound is generous.
 */
export const CARRIER_FETCH_TIMEOUT_MS = 60_000;

export interface GitRunResult {
    ok: boolean;
    out: string;
    err: string;
    timedOut: boolean;
}

export type GitRunner = (cmd: string, args: readonly string[], cwd: string, timeoutMs: number) => GitRunResult;

export const runGit: GitRunner = (cmd, args, cwd, timeoutMs) => {
    const r = spawnSync(cmd, [...args], { cwd, encoding: 'utf-8', timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 });
    const timedOut = (r.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
    return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '').trim(), timedOut };
};

function sh(cmd: string, args: readonly string[], cwd: string): { ok: boolean; out: string; err: string } {
    return runGit(cmd, args, cwd, NETWORK_TIMEOUT_MS);
}

/** The git questions target resolution asks, injected so no network is needed in tests. */
export interface TargetDeps {
    readonly currentBranch: () => string;
    /** The open PR's `baseRefName`, bare (`release/1.x`), or null. */
    readonly prBase: (branch: string) => string | null;
    /** The default branch as a remote-tracking ref (`origin/main`), or null. */
    readonly defaultBranch: () => string | null;
    /** The SHA the server reports for a ref right now, or null. */
    readonly remoteSha: (ref: string) => string | null;
}

export type TargetReason = 'explicit-base-override' | 'pull-request-target' | 'repository-default-branch';

export interface TargetRef {
    readonly ref: string;
    readonly reason: TargetReason;
}

/**
 * The ref a branch is judged against: `--base`, else the open PR's base, else
 * the default branch. `defaultRef` is passed by a caller that already asked for
 * it; otherwise it is asked for only when the first two do not answer.
 */
export function resolveTarget(deps: TargetDeps, override: string | null, defaultRef?: string | null): TargetRef | null {
    if (override !== null && override.trim() !== '') return { ref: override.trim(), reason: 'explicit-base-override' };
    const pr = deps.prBase(deps.currentBranch());
    if (pr !== null) return { ref: `origin/${pr}`, reason: 'pull-request-target' };
    const def = defaultRef === undefined ? deps.defaultBranch() : defaultRef;
    return def === null ? null : { ref: def, reason: 'repository-default-branch' };
}

/**
 * The default branch the SERVER reports, from `git ls-remote --symref origin HEAD`.
 *
 * Pure and exported so the parse is testable without a network round trip, and
 * because it closes a measured defect rather than a hypothetical one. Until
 * 2026-09-03 the default branch was read from `refs/remotes/origin/HEAD` alone —
 * a clone-time ref that is simply absent in some checkouts. Measured in a
 * worktree of this repository the same day: the local form returned null, so
 * `sync_pr_branch` refused with "no open PR and no origin/HEAD" while
 * `check_branch_freshness`, three lines later in the same documented sequence,
 * resolved `origin/main` from the server symref and passed. Mirrors
 * `check_branch_freshness.ts:223`.
 */
export function parseSymrefDefault(lsRemoteOut: string): string | null {
    for (const line of lsRemoteOut.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('ref:')) continue;
        const name = t.slice('ref:'.length).trim().split(/\s+/)[0] ?? '';
        if (!name.startsWith('refs/heads/')) continue;
        const short = name.slice('refs/heads/'.length).trim();
        if (short !== '') return `origin/${short}`;
    }
    return null;
}

/**
 * The SHA of exactly `refs/heads/<branch>` in `git ls-remote` output.
 *
 * A ls-remote pattern matches every ref whose trailing path components equal
 * it and the output is sorted by refname, so `backport/main` is listed before
 * `main`: the first line is not the branch that was asked for.
 */
export function parseExactHeadSha(lsRemoteOut: string, branch: string): string | null {
    const want = `refs/heads/${branch}`;
    for (const line of lsRemoteOut.split('\n')) {
        const [sha, name] = line.trim().split(/\s+/);
        if (name === want && sha !== undefined && /^[0-9a-f]{40}$/.test(sha)) return sha;
    }
    return null;
}

export function makeTargetDeps(repo: string): TargetDeps {
    return {
        currentBranch: (): string => sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repo).out.trim(),
        prBase: (branch: string): string | null => {
            if (branch === '' || branch === 'HEAD') return null;
            // The forge knows the REAL base, which matters for a stacked or
            // release-line PR: measuring against the repo default would compare
            // against a branch this PR never merges into.
            const pr = sh('gh', ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'baseRefName', '--limit', '1'], repo);
            if (!pr.ok) return null;
            try {
                const rows = JSON.parse(pr.out || '[]') as Array<{ baseRefName?: string }>;
                const b = rows[0]?.baseRefName;
                return typeof b === 'string' && b !== '' ? b : null;
            } catch {
                return null;
            }
        },
        // The server first, the local ref second: `refs/remotes/origin/HEAD` is
        // not set in every checkout (see `parseSymrefDefault`).
        defaultBranch: (): string | null => {
            const remote = sh('git', ['ls-remote', '--symref', 'origin', 'HEAD'], repo);
            const fromServer = remote.ok ? parseSymrefDefault(remote.out) : null;
            if (fromServer !== null) return fromServer;
            const head = sh('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], repo);
            return head.ok && head.out.trim() !== '' ? head.out.trim() : null;
        },
        remoteSha: (ref: string): string | null => {
            const bare = ref.replace(/^origin\//, '');
            const out = sh('git', ['ls-remote', 'origin', `refs/heads/${bare}`], repo);
            return out.ok ? parseExactHeadSha(out.out, bare) : null;
        },
    };
}

/**
 * The same questions, each asked of git or the forge at most once. One run reads
 * the strategy and then syncs; without this each step asked again, paying the
 * network twice and able to judge the strategy against one target and sync
 * against another when the pull request is retargeted in between.
 */
export function memoTargetDeps<T extends TargetDeps>(deps: T): T {
    const cache = new Map<string, string | null>();
    const once = (key: string, ask: () => string | null): string | null => {
        if (!cache.has(key)) cache.set(key, ask());
        return cache.get(key) as string | null;
    };
    return {
        ...deps,
        currentBranch: (): string => once('branch', () => deps.currentBranch()) ?? '',
        prBase: (branch: string): string | null => once(`pr ${branch}`, () => deps.prBase(branch)),
        defaultBranch: (): string | null => once('default', () => deps.defaultBranch()),
        remoteSha: (ref: string): string | null => once(`sha ${ref}`, () => deps.remoteSha(ref)),
    };
}

/**
 * `absent` (the commit has no carrier) and `no-commit` (the commit itself is
 * unknown) are different facts; `timedOut` marks a commit the fetch ran out of
 * time on, which says nothing about whether it exists.
 */
export type CommitBlob = { kind: 'absent' } | { kind: 'present'; text: string } | { kind: 'no-commit'; timedOut?: boolean };

/**
 * The carrier as one commit holds it. A commit the server reported but this
 * clone has not fetched yet is fetched by its ref once; an answer of "the file
 * does not exist" is only ever given for a commit that is present.
 */
export function carrierBlobAt(repo: string, sha: string, fetchRef: string | null, run: GitRunner = runGit): CommitBlob {
    const local = (args: readonly string[]): GitRunResult => run('git', args, repo, NETWORK_TIMEOUT_MS);
    const has = (): boolean => local(['cat-file', '-e', `${sha}^{commit}`]).ok;
    if (!has()) {
        const fetched = fetchRef === null
            ? null
            : run('git', ['fetch', '-q', 'origin', fetchRef.replace(/^origin\//, '')], repo, CARRIER_FETCH_TIMEOUT_MS);
        if (fetched?.timedOut === true) return { kind: 'no-commit', timedOut: true };
        if (!has()) return { kind: 'no-commit' };
    }
    const listed = local(['ls-tree', '--name-only', sha, '--', CARRIER_PATH]);
    if (!listed.ok) return { kind: 'no-commit' };
    if (listed.out.trim() === '') return { kind: 'absent' };
    const blob = local(['cat-file', '-p', `${sha}:${CARRIER_PATH}`]);
    return blob.ok ? { kind: 'present', text: blob.out } : { kind: 'no-commit' };
}

function _carrierLayer(label: string, blob: Exclude<CommitBlob, { kind: 'no-commit' }>): GitConventionLayer {
    if (blob.kind === 'absent') return { path: label, carries: true, parsed: 'absent', data: null };
    return { path: label, carries: true, ...parseLayerText(blob.text) };
}

/** Read failures map as `git_convention.ts` maps them for the developer files. */
function _workingTreeLayer(root: string): GitConventionLayer {
    const p = path.join(root, CARRIER_PATH);
    let text: string;
    try {
        if (!fs.statSync(p).isFile()) return { path: p, carries: true, parsed: 'absent', data: null };
        text = fs.readFileSync(p, 'utf-8');
    } catch (err) {
        const parsed = (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'absent' : 'malformed';
        return { path: p, carries: true, parsed, data: null };
    }
    return { path: p, carries: true, ...parseLayerText(text) };
}

/** The repository root, and whether it is a git repository at all. */
export function conventionRoot(cwd: string): { root: string; git: boolean } {
    const top = sh('git', ['rev-parse', '--show-toplevel'], cwd);
    if (top.ok && top.out.trim() !== '') return { root: top.out.trim(), git: true };
    return { root: find_project_root(cwd) ?? cwd, git: false };
}

export interface ConventionTarget extends TargetRef {
    readonly sha: string | null;
}

export interface CommittedConvention {
    readonly root: string;
    /** The value in force per key. */
    readonly readings: Partial<Record<GitConventionKey, GitConventionReading>>;
    /** The commit the carrier was read at per key; null outside a git repository. */
    readonly readAt: Partial<Record<GitConventionKey, string | null>>;
    /** What `update_strategy` was judged against; null when no target was asked for. */
    readonly target: ConventionTarget | null;
    /** The checkout's own value per key, only where it differs from the value in force. */
    readonly candidates: Partial<Record<GitConventionKey, GitConventionReading>>;
}

export interface CommittedOptions {
    readonly override?: string | null;
    readonly deps?: TargetDeps;
    readonly keys?: readonly GitConventionKey[];
    /** Runs the git calls that read the carrier at a commit. */
    readonly run?: GitRunner;
}

function _short(sha: string): string {
    return sha.slice(0, 12);
}

/** The git convention in force for the repository that contains `cwd`. */
export function readCommittedConvention(cwd: string, options: CommittedOptions = {}): CommittedConvention {
    const keys = options.keys ?? GIT_CONVENTION_KEYS;
    const { root, git } = conventionRoot(cwd);
    const developer = checkoutSource(root).layers();
    const readings: Partial<Record<GitConventionKey, GitConventionReading>> = {};
    const readAt: Partial<Record<GitConventionKey, string | null>> = {};
    const candidates: Partial<Record<GitConventionKey, GitConventionReading>> = {};
    let target: ConventionTarget | null = null;

    // Outside a git repository there is no committed layer to read.
    if (!git) {
        for (const key of keys) {
            readings[key] = readGitConventionKey(key, { layers: () => developer });
            readAt[key] = null;
        }
        return { root, readings, readAt, target, candidates };
    }

    const headSha = sh('git', ['rev-parse', '--verify', '-q', 'HEAD'], root).out.trim();
    const headLabel = `${CARRIER_PATH} at ${headSha === '' ? 'HEAD' : _short(headSha)}`;
    let headBlob: CommitBlob | null = null;
    const atHead = (): CommitBlob => {
        if (headBlob === null) headBlob = headSha === '' ? { kind: 'absent' } : carrierBlobAt(root, headSha, null, options.run);
        return headBlob;
    };

    for (const key of keys) {
        if (key !== 'update_strategy') {
            const blob = atHead();
            readings[key] = blob.kind === 'no-commit'
                ? conventionReading(key, 'unresolvable', null, headLabel, `the carrier at HEAD (${_short(headSha)}) could not be read`)
                : readGitConventionKey(key, { layers: () => [...developer, _carrierLayer(headLabel, blob)] });
            readAt[key] = headSha === '' ? null : headSha;
            continue;
        }
        const deps = options.deps ?? makeTargetDeps(root);
        const ref = resolveTarget(deps, options.override ?? null);
        const sha = ref === null ? null : deps.remoteSha(ref.ref);
        target = ref === null ? null : { ...ref, sha };
        readAt[key] = sha;
        if (ref === null || sha === null) {
            readings[key] = conventionReading(
                key,
                'unresolvable',
                null,
                CARRIER_PATH,
                ref === null
                    ? 'no open pull request and no default branch, so the target commit is unknown'
                    : `the server reports no commit for ${ref.ref}`,
            );
            continue;
        }
        const blob = carrierBlobAt(root, sha, ref.ref, options.run);
        if (blob.kind === 'no-commit') {
            readings[key] = conventionReading(
                key,
                'unresolvable',
                null,
                `${CARRIER_PATH} at ${_short(sha)}`,
                blob.timedOut === true
                    ? `fetching commit ${_short(sha)} of ${ref.ref} timed out after ${CARRIER_FETCH_TIMEOUT_MS / 1000} s`
                    : `commit ${_short(sha)} of ${ref.ref} could not be fetched`,
            );
            continue;
        }
        readings[key] = readGitConventionKey(key, { layers: () => [...developer, _carrierLayer(`${CARRIER_PATH} at ${_short(sha)}`, blob)] });
    }

    const tree = _workingTreeLayer(root);
    for (const key of keys) {
        const inForce = readings[key] as GitConventionReading;
        const local = readGitConventionKey(key, { layers: () => [...developer, tree] });
        if (local.value !== inForce.value || local.state !== inForce.state) candidates[key] = local;
    }
    return { root, readings, readAt, target, candidates };
}

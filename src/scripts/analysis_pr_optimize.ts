/**
 * analysis_pr_optimize.ts — `analyze:pr --optimize` (step 5.3, ADR-288 D6).
 *
 * Eligibility first: an open PR whose head branch lives in this repository and
 * is writable gets fixes pushed to it; anything else gets a patch file beside
 * the verdict. Each fix carries exactly one test disposition. Every push is a
 * compare-and-swap on the head the run last saw — a moved head stops the run
 * before it pushes. Re-review after each push; stop when nothing new clears
 * the threshold or after three rounds.
 *
 * The port has no merge and no approve: the flow cannot do either.
 *
 * A fix declares the paths it may touch, and only those are staged; a fix that
 * changes anything else is refused before it is committed. PR-head code is
 * untrusted whoever can push to the branch: it runs only through the sandbox's
 * `runHeadCode`, with an allow-listed environment (no credentials) and a
 * dead proxy (no network), and the patch route (fork, unwritable head) never
 * runs it at all.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { assertRefName, PublishError } from './analysis_publish.js';

export const MAX_OPTIMIZE_ROUNDS = 3;

/** Why a fix ships without a test; the disprove pass reviews each one. */
export const INFEASIBLE_REASONS = ['no-test-harness', 'nondeterministic', 'external-dependency', 'docs-only', 'config-only'] as const;

const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export class OptimizeError extends Error {}

export interface PrBranch {
    pr: number;
    state: 'OPEN' | 'CLOSED' | 'MERGED';
    headRefName: string;
    headSha: string;
    isCrossRepository: boolean;
    viewerCanPush: boolean;
}

export type Eligibility = { kind: 'push'; branch: string } | { kind: 'patch'; reason: string };

export type Disposition =
    | { kind: 'regression-test-red'; test: string }
    | { kind: 'existing-test-red'; test: string }
    | { kind: 'static-check'; check: string }
    | { kind: 'infeasible'; reasonCode: string; reviewedBy: string };

export interface Fix {
    findingKey: string;
    disposition: Disposition;
    /** Repository-relative paths this fix may change; nothing else is staged. */
    paths: readonly string[];
}

/** What the apply callback gets besides the worktree: the only sanctioned way to run PR-head code. */
export interface HeadCodeSandbox {
    /** False on the patch route: a fork or unwritable head never executes its own code here. */
    readonly mayRunHeadCode: boolean;
    readonly env: Readonly<Record<string, string>>;
    /** Runs a command in the worktree with `env`; throws when `mayRunHeadCode` is false. */
    runHeadCode(cmd: string, args: readonly string[]): { status: number | null; stdout: string; stderr: string };
}

/** Variables copied from the caller's environment into PR-head code; nothing else passes. */
const HEAD_CODE_ENV_ALLOW = ['PATH', 'LANG', 'LC_ALL', 'TERM', 'SYSTEMROOT', 'COMSPEC', 'PATHEXT'] as const;
/** A proxy nothing listens on: tooling that honours proxy variables cannot reach the network. */
const DEAD_PROXY = 'http://127.0.0.1:9';

/**
 * The environment PR-head code runs with: built from an allow-list, so no token,
 * key or cloud credential of the caller can reach it, with a throwaway HOME (no
 * ~/.npmrc, ~/.git-credentials, ~/.aws) and every proxy variable pointed at a
 * dead port.
 */
export function headCodeEnv(source: NodeJS.ProcessEnv, home: string): Record<string, string> {
    const env: Record<string, string> = {};
    for (const k of HEAD_CODE_ENV_ALLOW) {
        const v = source[k];
        if (v !== undefined) env[k] = v;
    }
    for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) env[k] = DEAD_PROXY;
    return {
        ...env,
        HOME: home,
        USERPROFILE: home,
        TMPDIR: home,
        NO_PROXY: '',
        no_proxy: '',
        npm_config_offline: 'true',
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: path.join(home, '.gitconfig-none'),
        CI: '1',
    };
}

function checkPaths(fix: Fix): void {
    if (!Array.isArray(fix.paths) || fix.paths.length === 0) {
        throw new OptimizeError(`finding ${fix.findingKey} declares no paths it may touch`);
    }
    for (const p of fix.paths) {
        const segs = p.split(/[\\/]/);
        const bad =
            typeof p !== 'string' ||
            p.trim() === '' ||
            path.isAbsolute(p) ||
            /^[A-Za-z]:/.test(p) ||
            segs.some((seg) => seg === '..' || seg === '.git' || seg === '');
        if (bad) throw new OptimizeError(`finding ${fix.findingKey} declares an unsafe path ${JSON.stringify(p)}`);
    }
}

export interface KeyedFinding {
    key: string;
}

export interface OptimizePort {
    remoteHead(branch: string): string | null;
    /** Applies and commits the fixes on top of `baseSha`, new files included; returns the new head. */
    applyFixes(fixes: readonly Fix[], baseSha: string): string;
    /** Fails, changing nothing, unless the remote head is exactly `expected`. */
    push(branch: string, expected: string): void;
    /** Writes the fixes, applied to `headSha`, as a patch file (new files included); returns its path. */
    writePatch(pr: number, headSha: string, fixes: readonly Fix[]): string;
}

export type OptimizeEnd = 'converged' | 'round-cap' | 'moved-head' | 'patch' | 'fix-failed';

export interface OptimizeResult {
    end: OptimizeEnd;
    rounds: number;
    fixes: Fix[];
    patch?: string;
    reason?: string;
    /** Findings a pushed fix was meant to remove that the re-review still reports. */
    persisting?: string[];
}

export function eligibility(pr: PrBranch): Eligibility {
    if (pr.state !== 'OPEN') return { kind: 'patch', reason: `PR #${pr.pr} is ${pr.state.toLowerCase()}` };
    if (pr.isCrossRepository) return { kind: 'patch', reason: `PR #${pr.pr} comes from a fork` };
    if (!pr.viewerCanPush) return { kind: 'patch', reason: `the head branch of PR #${pr.pr} is not writable` };
    try {
        return { kind: 'push', branch: assertRefName(pr.headRefName, 'head branch') };
    } catch (err) {
        if (err instanceof PublishError) return { kind: 'patch', reason: err.message };
        throw err;
    }
}

function nonEmpty(s: string): boolean {
    return s.trim() !== '';
}

function checkDispositions(findings: readonly KeyedFinding[], fixes: readonly Fix[]): void {
    const wanted = new Set(findings.map((f) => f.key));
    const seen = new Set<string>();
    for (const fix of fixes) {
        if (!wanted.has(fix.findingKey)) throw new OptimizeError(`fix for ${fix.findingKey} answers no finding of this round`);
        if (seen.has(fix.findingKey)) throw new OptimizeError(`finding ${fix.findingKey} carries more than one disposition`);
        seen.add(fix.findingKey);
        checkPaths(fix);
        const d = fix.disposition;
        const ok =
            d.kind === 'infeasible'
                ? (INFEASIBLE_REASONS as readonly string[]).includes(d.reasonCode) && nonEmpty(d.reviewedBy)
                : nonEmpty(d.kind === 'static-check' ? d.check : d.test);
        if (!ok) throw new OptimizeError(`finding ${fix.findingKey} has an incomplete ${d.kind} disposition`);
    }
    const missing = [...wanted].filter((k) => !seen.has(k));
    if (missing.length > 0) throw new OptimizeError(`no disposition for: ${missing.join(', ')}`);
}

export function optimizePr(
    pr: PrBranch,
    port: OptimizePort,
    review: (headSha: string) => KeyedFinding[],
    planFixes: (findings: KeyedFinding[]) => Fix[],
): OptimizeResult {
    if (!OBJECT_ID.test(pr.headSha)) throw new OptimizeError(`head SHA ${JSON.stringify(pr.headSha)} is not a full object id`);
    const target = eligibility(pr);
    const done: Fix[] = [];
    const known = new Set<string>();
    let expected = pr.headSha;
    for (let rounds = 0; ; rounds += 1) {
        const found = review(expected);
        const persisting = found.filter((f) => known.has(f.key)).map((f) => f.key);
        if (persisting.length > 0) {
            return { end: 'fix-failed', rounds, fixes: done, persisting, reason: `still reported after their fix: ${persisting.join(', ')}` };
        }
        const fresh = found;
        if (fresh.length === 0) return { end: 'converged', rounds, fixes: done };
        if (rounds >= MAX_OPTIMIZE_ROUNDS) return { end: 'round-cap', rounds, fixes: done };
        const fixes = planFixes(fresh);
        checkDispositions(fresh, fixes);
        if (target.kind === 'patch') {
            done.push(...fixes);
            return { end: 'patch', rounds: rounds + 1, fixes: done, patch: port.writePatch(pr.pr, expected, fixes), reason: target.reason };
        }
        const remote = port.remoteHead(target.branch);
        if (remote !== expected) {
            return { end: 'moved-head', rounds, fixes: done, reason: `${target.branch} is at ${String(remote)}, expected ${expected}` };
        }
        const next = port.applyFixes(fixes, expected);
        try {
            port.push(target.branch, expected);
        } catch (err) {
            const why = err instanceof Error ? err.message : String(err);
            return { end: 'moved-head', rounds, fixes: done, reason: `lease on ${target.branch} at ${expected} refused at push (${why}); local commit ${next} not pushed` };
        }
        for (const f of fresh) known.add(f.key);
        done.push(...fixes);
        expected = next;
    }
}

/**
 * The git port a door uses. Fixes are applied in a private detached worktree at
 * the head the run pinned, never in the caller's checkout. Only the paths the
 * fixes declare are staged, new files included; a change anywhere else refuses
 * the round before anything is committed. A push leases the expected head and
 * fast-forwards only. `dispose` removes the worktree.
 */
export function gitOptimizePort(
    repoCwd: string,
    apply: (fixes: readonly Fix[], dir: string, sandbox: HeadCodeSandbox) => void,
): OptimizePort & { dispose(): void } {
    const run = (cwd: string, args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
    const sandboxFor = (dir: string, mayRunHeadCode: boolean): HeadCodeSandbox => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-pr-home-'));
        const env = headCodeEnv(process.env, home);
        return {
            mayRunHeadCode,
            env,
            runHeadCode: (cmd, args) => {
                if (!mayRunHeadCode) {
                    throw new OptimizeError('the patch route never runs PR-head code (fork or unwritable head)');
                }
                const r = spawnSync(cmd, [...args], { cwd: dir, env, encoding: 'utf8', timeout: 600_000 });
                return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
            },
        };
    };
    /** Stages exactly the declared paths that changed; refuses when anything undeclared changed. */
    const stageDeclared = (wt: string, fixes: readonly Fix[]): void => {
        const allowed = new Set(fixes.flatMap((f) => f.paths));
        const changed = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'], {
            cwd: wt,
            encoding: 'utf8',
            stdio: 'pipe',
        })
            .split('\0')
            .filter((e) => e.length > 3)
            .map((e) => e.slice(3));
        const undeclared = changed.filter((p) => !allowed.has(p));
        if (undeclared.length > 0) {
            throw new OptimizeError(`the fixes changed paths they did not declare: ${undeclared.join(', ')}`);
        }
        if (changed.length === 0) throw new OptimizeError('the fixes changed nothing');
        run(wt, ['add', '--', ...changed]);
    };
    const sha = (s: string, what: string): string => {
        if (!OBJECT_ID.test(s)) throw new OptimizeError(`${what} ${JSON.stringify(s)} is not a full object id`);
        return s;
    };
    let dir: string | null = null;
    const worktreeAt = (base: string): string => {
        if (dir === null) {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-pr-fix-'));
            run(repoCwd, ['worktree', 'add', '--detach', dir, sha(base, 'base SHA')]);
        } else if (run(dir, ['rev-parse', 'HEAD']) !== base) {
            throw new OptimizeError(`fix worktree is not at ${base}`);
        }
        return dir;
    };
    return {
        remoteHead: (branch) => {
            const ref = `refs/heads/${assertRefName(branch, 'branch')}`;
            const row = run(repoCwd, ['ls-remote', 'origin', ref])
                .split('\n')
                .map((l) => l.split(/\s+/))
                .find((cols) => cols[1] === ref);
            return row?.[0] ?? null;
        },
        applyFixes: (fixes, baseSha) => {
            const wt = worktreeAt(baseSha);
            apply(fixes, wt, sandboxFor(wt, true));
            stageDeclared(wt, fixes);
            run(wt, ['commit', '-m', `fix: analyze:pr --optimize (${fixes.length} finding(s))`]);
            return run(wt, ['rev-parse', 'HEAD']);
        },
        push: (branch, expected) => {
            if (dir === null) throw new OptimizeError('nothing applied to push');
            const ref = `refs/heads/${assertRefName(branch, 'branch')}`;
            run(dir, ['merge-base', '--is-ancestor', sha(expected, 'expected head'), 'HEAD']);
            run(dir, ['push', '--porcelain', `--force-with-lease=${ref}:${expected}`, 'origin', `HEAD:${ref}`]);
        },
        writePatch: (pr, headSha, fixes) => {
            const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-pr-patch-'));
            run(repoCwd, ['worktree', 'add', '--detach', wt, sha(headSha, 'head SHA')]);
            try {
                apply(fixes, wt, sandboxFor(wt, false));
                stageDeclared(wt, fixes);
                const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-pr-')), `pr-${pr}.patch`);
                fs.writeFileSync(file, `${run(wt, ['diff', '--cached', '--binary', '--no-color', '--no-ext-diff', 'HEAD'])}\n`);
                return file;
            } finally {
                run(repoCwd, ['worktree', 'remove', '--force', wt]);
            }
        },
        dispose: () => {
            if (dir !== null) run(repoCwd, ['worktree', 'remove', '--force', dir]);
            dir = null;
        },
    };
}

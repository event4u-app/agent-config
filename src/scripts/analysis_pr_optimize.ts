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
 */
import { execFileSync } from 'node:child_process';
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
}

export interface KeyedFinding {
    key: string;
}

export interface OptimizePort {
    remoteHead(branch: string): string | null;
    /** Applies and commits the fixes locally; returns the new local head. */
    applyFixes(fixes: readonly Fix[]): string;
    /** Fails, changing nothing, unless the remote head is exactly `expected`. */
    push(branch: string, expected: string): void;
    /** Writes the fixes as a patch file; returns its path. */
    writePatch(pr: number, fixes: readonly Fix[]): string;
}

export type OptimizeEnd = 'converged' | 'round-cap' | 'moved-head' | 'patch';

export interface OptimizeResult {
    end: OptimizeEnd;
    rounds: number;
    fixes: Fix[];
    patch?: string;
    reason?: string;
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
        const fresh = review(expected).filter((f) => !known.has(f.key));
        if (fresh.length === 0) return { end: 'converged', rounds, fixes: done };
        if (rounds >= MAX_OPTIMIZE_ROUNDS) return { end: 'round-cap', rounds, fixes: done };
        const fixes = planFixes(fresh);
        checkDispositions(fresh, fixes);
        if (target.kind === 'patch') {
            done.push(...fixes);
            return { end: 'patch', rounds: rounds + 1, fixes: done, patch: port.writePatch(pr.pr, fixes), reason: target.reason };
        }
        const remote = port.remoteHead(target.branch);
        if (remote !== expected) {
            return { end: 'moved-head', rounds, fixes: done, reason: `${target.branch} is at ${String(remote)}, expected ${expected}` };
        }
        const next = port.applyFixes(fixes);
        port.push(target.branch, expected);
        for (const f of fresh) known.add(f.key);
        done.push(...fixes);
        expected = next;
    }
}

/** The git + gh port a door uses: a leased fast-forward push, a patch file, nothing else. */
export function gitOptimizePort(cwd: string, apply: (fixes: readonly Fix[]) => void): OptimizePort {
    const run = (bin: string, args: string[]): string => execFileSync(bin, args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
    return {
        remoteHead: (branch) => {
            const ref = `refs/heads/${assertRefName(branch, 'branch')}`;
            const row = run('git', ['ls-remote', 'origin', ref])
                .split('\n')
                .map((l) => l.split(/\s+/))
                .find((cols) => cols[1] === ref);
            return row?.[0] ?? null;
        },
        applyFixes: (fixes) => {
            apply(fixes);
            run('git', ['commit', '-m', `fix: analyze:pr --optimize (${fixes.length} finding(s))`]);
            return run('git', ['rev-parse', 'HEAD']);
        },
        push: (branch, expected) => {
            const ref = `refs/heads/${assertRefName(branch, 'branch')}`;
            if (!OBJECT_ID.test(expected)) throw new OptimizeError(`expected head ${JSON.stringify(expected)} is not a full object id`);
            run('git', ['merge-base', '--is-ancestor', expected, 'HEAD']);
            run('git', ['push', '--porcelain', `--force-with-lease=${ref}:${expected}`, 'origin', `HEAD:${ref}`]);
        },
        writePatch: (pr, fixes) => {
            apply(fixes);
            const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-pr-')), `pr-${pr}.patch`);
            fs.writeFileSync(file, run('git', ['diff', '--no-color', '--no-ext-diff', 'HEAD']));
            return file;
        },
    };
}

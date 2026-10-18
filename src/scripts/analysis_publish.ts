/**
 * analysis_publish.ts — the publish stage of the analysis doors (step 3.3,
 * ADR-288 D5/D6): commit the emitted roadmaps, push the run's own branch, open
 * a non-draft PR exactly once, then settle CI with at most three fix rounds.
 *
 * Every remote effect goes through a `PublishPort`, so the same flow runs
 * against an in-memory remote in tests and against git + gh in a run. The
 * flow never merges, never force-pushes and never touches another branch.
 */
import { execFileSync } from 'node:child_process';

import { handBack, publicationKey, publishOnce, reached, transition, type RunRecord } from './analysis_run.js';

export const MAX_CI_FIX_ROUNDS = 3;
export const DASHBOARD_REL = 'agents/roadmaps-progress.md';

export interface CiVerdict {
    green: boolean;
    /** Names of the failing checks; empty when green. */
    red: string[];
}

export interface PublishPort {
    stagedPaths(): string[];
    /** Commits what is staged; returns the new local head. */
    commit(message: string): string;
    localHead(): string;
    /** The branch's head on the remote, or null when the branch does not exist there. */
    remoteHead(branch: string): string | null;
    push(branch: string, expectedRemote: string | null): void;
    findOpenPr(branch: string): number | null;
    createPr(args: string[]): number;
    /** What `gh pr view <n> --json isDraft` reads. */
    prIsDraft(pr: number): boolean;
    ciSettle(pr: number): CiVerdict;
}

export interface PublishInput {
    branch: string;
    base: string;
    baseSha: string;
    title: string;
    bodyFile: string;
    emitted: string[];
    message: string;
}

/** The only paths a run may publish: its emitted roadmaps and the dashboard regenerated for them. */
export function allowedPaths(emitted: readonly string[]): string[] {
    return [...new Set([...emitted, DASHBOARD_REL])].sort();
}

export function prCreateArgs(input: { title: string; bodyFile: string; base: string; head: string }): string[] {
    return ['pr', 'create', '--title', input.title, '--body-file', input.bodyFile, '--base', input.base, '--head', input.head];
}

function outsideAllowed(port: PublishPort, emitted: readonly string[]): string[] {
    const allowed = new Set(allowedPaths(emitted));
    return port.stagedPaths().filter((p) => !allowed.has(p));
}

/** validated → committed → pushed → pr-open. Re-invoking it after a kill repeats nothing already done. */
export function publish(
    port: PublishPort,
    runDir: string,
    record: RunRecord,
    input: PublishInput,
): { record: RunRecord; pr: number | null } {
    let rec = record;
    if (!reached(rec, 'committed')) {
        const outside = outsideAllowed(port, input.emitted);
        if (outside.length > 0) {
            return { record: handBack(runDir, rec, `staged path outside the allowed set: ${outside.join(', ')}`), pr: null };
        }
        port.commit(input.message);
        rec = transition(runDir, rec, 'committed');
    }
    if (!reached(rec, 'pushed')) {
        const remote = port.remoteHead(input.branch);
        if (remote !== null && remote !== port.localHead()) {
            const reason = `expected-head check: ${input.branch} already exists on the remote at ${remote}`;
            return { record: handBack(runDir, rec, reason), pr: null };
        }
        if (remote === null) port.push(input.branch, null);
        rec = transition(runDir, rec, 'pushed');
    }
    if (reached(rec, 'pr-open')) return { record: rec, pr: port.findOpenPr(input.branch) };

    const key = publicationKey(rec.run_id, input.emitted, input.baseSha);
    let pr = port.findOpenPr(input.branch);
    rec = publishOnce(runDir, rec, key, () => {
        if (pr === null) pr = port.createPr(prCreateArgs({ ...input, head: input.branch }));
    }).record;
    if (pr === null) return { record: handBack(runDir, rec, `publication recorded but no open PR on ${input.branch}`), pr: null };
    if (port.prIsDraft(pr)) return { record: handBack(runDir, rec, `PR #${pr} reads isDraft: true`), pr };
    return { record: transition(runDir, rec, 'pr-open'), pr };
}

/**
 * pr-open → ci-settled → done, or `handed-back` naming the red after the third
 * fix round. Every fix push carries the expected-head check and the same
 * allowed path set as the publication.
 */
export function settleCi(
    port: PublishPort,
    runDir: string,
    record: RunRecord,
    input: PublishInput & { pr: number },
    fix: (red: string[]) => unknown,
): RunRecord {
    let rec = record;
    let pushed = port.remoteHead(input.branch);
    for (let round = 0; ; round += 1) {
        const verdict = port.ciSettle(input.pr);
        if (verdict.green) return transition(runDir, transition(runDir, rec, 'ci-settled'), 'done');
        if (round >= MAX_CI_FIX_ROUNDS) {
            return handBack(runDir, rec, `CI red after ${MAX_CI_FIX_ROUNDS} fix rounds: ${verdict.red.join(', ')}`);
        }
        fix(verdict.red);
        const outside = outsideAllowed(port, input.emitted);
        if (outside.length > 0) {
            rec = handBack(runDir, rec, `CI fix staged a path outside the allowed set: ${outside.join(', ')}`);
            return rec;
        }
        const remote = port.remoteHead(input.branch);
        if (remote !== pushed) {
            return handBack(runDir, rec, `expected-head check: ${input.branch} moved to ${String(remote)}`);
        }
        port.commit(`fix: CI round ${round + 1} — ${verdict.red.join(', ')}`);
        port.push(input.branch, pushed);
        pushed = port.localHead();
    }
}

/** The git + gh port a door uses. Never forces, never merges. */
export function gitGhPort(cwd: string): PublishPort {
    const run = (bin: string, args: string[]): string => execFileSync(bin, args, { cwd, encoding: 'utf8' }).trim();
    return {
        stagedPaths: () => run('git', ['diff', '--cached', '--name-only']).split('\n').filter(Boolean),
        commit: (message) => {
            run('git', ['commit', '-m', message]);
            return run('git', ['rev-parse', 'HEAD']);
        },
        localHead: () => run('git', ['rev-parse', 'HEAD']),
        remoteHead: (branch) => run('git', ['ls-remote', 'origin', `refs/heads/${branch}`]).split(/\s+/)[0] || null,
        push: (branch) => {
            run('git', ['push', '-u', 'origin', branch]);
        },
        findOpenPr: (branch) => {
            const rows = JSON.parse(run('gh', ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number'])) as Array<{
                number: number;
            }>;
            return rows[0]?.number ?? null;
        },
        createPr: (args) => {
            const url = run('gh', args);
            const n = Number(url.split('/').pop());
            if (!Number.isInteger(n)) throw new Error(`gh pr create printed no PR URL: ${url}`);
            return n;
        },
        prIsDraft: (pr) => (JSON.parse(run('gh', ['pr', 'view', String(pr), '--json', 'isDraft'])) as { isDraft: boolean }).isDraft,
        ciSettle: (pr) => {
            try {
                run('./scripts-run', ['src/scripts/ci_settle', String(pr), '--timeout-min', '28']);
                return { green: true, red: [] };
            } catch (err) {
                // Exit 2 is "not a verdict" (timed out, merged, head diverged) — never read as red or green.
                if ((err as { status?: number }).status !== 1) throw err;
                const checks = JSON.parse(run('gh', ['pr', 'checks', String(pr), '--json', 'name,bucket'])) as Array<{
                    name: string;
                    bucket: string;
                }>;
                return { green: false, red: checks.filter((c) => c.bucket === 'fail').map((c) => c.name) };
            }
        },
    };
}

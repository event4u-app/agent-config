// egress-content: session-content uncovered — pushes the run's branch and opens a PR through git and gh, not a model provider; the PR title and body are derived from dropped private files and pass assertOutbound (_lib/outbound_text.ts) before anything is committed
/**
 * analysis_publish.ts — the publish stage of the analysis doors (step 3.3,
 * ADR-288 D5/D6): commit the emitted roadmaps, push the run's own branch, open
 * a non-draft PR exactly once, then settle CI with at most three fix rounds.
 *
 * Every remote effect goes through a `PublishPort`, so the same flow runs
 * against an in-memory remote in tests and against git + gh in a run. The
 * flow never merges, never force-pushes and never touches another branch.
 *
 * The caller names none of the objects a push can reach:
 * the branch comes from the run id, the publishable paths
 * and the PR body from the run directory, and every push is a compare-and-swap
 * on the head the flow last saw. Nothing leaves before the caller passes, as
 * `confirmedBranch`, the exact branch this turn's confirmation named — the
 * invocation alone names neither the branch nor the PR — and before the title
 * and body pass the outbound check, since both are derived from private files.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { assertOutbound, OutboundRefusedError } from './_lib/outbound_text.js';
import { handBack, publicationKey, publishOnce, reached, transition, type RunRecord } from './analysis_run.js';

export const MAX_CI_FIX_ROUNDS = 3;
export const DASHBOARD_REL = 'agents/roadmaps-progress.md';
export const BRANCH_PREFIX = 'analysis/';
/** Written into the run directory by the emit stage; the only source of the allowed path set. */
export const PUBLICATION_FILE = 'publication.json';
export const PUBLICATION_SCHEMA_VERSION = '1.0';
/** The PR body, read only from the run directory. */
export const PR_BODY_FILE = 'pr-body.md';

const ROADMAP_PATH = /^agents\/roadmaps\/road-to-[a-z0-9][a-z0-9-]*\.md$/;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REF_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class PublishError extends Error {}

/**
 * A branch name a refspec cannot hide in: `/`-separated segments that start
 * alphanumeric, no `..`, no `.lock`, no `refs/` prefix, never `HEAD`. Refuses
 * every `:` `+` leading `-` and space by construction.
 */
export function assertRefName(name: string, what: string): string {
    const ok =
        name.length > 0 &&
        name.length <= 200 &&
        name !== 'HEAD' &&
        !name.startsWith('refs/') &&
        !name.includes('..') &&
        name.split('/').every((s) => REF_SEGMENT.test(s) && !s.endsWith('.lock') && !s.endsWith('.'));
    if (!ok) throw new PublishError(`${what} ${JSON.stringify(name)} is not a plain branch name`);
    return name;
}

function assertObjectId(sha: string, what: string): string {
    if (!OBJECT_ID.test(sha)) throw new PublishError(`${what} ${JSON.stringify(sha)} is not a full object id`);
    return sha;
}

/** The only destination a run can publish to: its own branch, derived from the run id. */
export class PublicationTarget {
    readonly ref: string;

    private constructor(
        readonly branch: string,
        readonly base: string,
    ) {
        this.ref = `refs/heads/${branch}`;
        Object.freeze(this);
    }

    static forRun(runId: string, base: string): PublicationTarget {
        if (!REF_SEGMENT.test(runId)) throw new PublishError(`run id ${JSON.stringify(runId)} cannot name a branch`);
        return new PublicationTarget(assertRefName(`${BRANCH_PREFIX}${runId}`, 'branch'), assertRefName(base, 'base'));
    }
}

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
    isAncestor(ancestor: string, descendant: string): boolean;
    /** The branch's head on the remote, or null when the branch does not exist there. */
    remoteHead(target: PublicationTarget): string | null;
    /** Fails, changing nothing, unless the remote head is exactly `expectedRemote` (null: absent). */
    push(target: PublicationTarget, expectedRemote: string | null): void;
    findOpenPr(target: PublicationTarget): number | null;
    createPr(args: string[]): number;
    /** What `gh pr view <n> --json isDraft` reads. */
    prIsDraft(pr: number): boolean;
    ciSettle(pr: number): CiVerdict;
}

export interface PublishInput {
    base: string;
    baseSha: string;
    title: string;
    message: string;
    /**
     * The branch the user confirmed this turn, after being shown it and told
     * that a push and one non-draft PR follow. Anything but the run's own
     * branch publishes nothing.
     */
    confirmedBranch?: string;
}

/** Null when the run may publish; otherwise why not. Reads the body, never echoes it. */
function publicationGate(r: Resolved, input: PublishInput): string | null {
    if (input.confirmedBranch !== r.target.branch) {
        return (
            `publication not confirmed: pushing ${r.target.branch} and opening one non-draft PR on ${r.target.base} ` +
            'needs this turn\'s confirmation naming that branch'
        );
    }
    try {
        assertOutbound(input.title, 'PR title');
        assertOutbound(fs.readFileSync(r.bodyFile, 'utf8'), 'PR body');
    } catch (err) {
        if (err instanceof OutboundRefusedError) return err.message;
        throw err;
    }
    return null;
}

function assertPublishable(paths: readonly unknown[]): string[] {
    const bad = paths.filter((p) => typeof p !== 'string' || !ROADMAP_PATH.test(p));
    if (bad.length > 0 || paths.length === 0) {
        throw new PublishError(`not publishable (only agents/roadmaps/road-to-*.md): ${bad.map(String).join(', ') || '(none)'}`);
    }
    return paths as string[];
}

/** Records what the run emitted; refuses any path outside the `ROADMAP_PATH` shape. */
export function recordPublication(runDir: string, emitted: readonly string[]): string[] {
    const paths = [...new Set(assertPublishable(emitted))].sort();
    fs.writeFileSync(path.join(runDir, PUBLICATION_FILE), `${JSON.stringify({ schema_version: PUBLICATION_SCHEMA_VERSION, emitted: paths }, null, 2)}\n`);
    return paths;
}

/** The emitted paths as the run directory records them, re-checked against the fixed shape. */
export function readPublication(runDir: string): string[] {
    const file = path.join(runDir, PUBLICATION_FILE);
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        throw new PublishError(`no readable ${PUBLICATION_FILE} in the run directory`);
    }
    const d = data as { schema_version?: unknown; emitted?: unknown };
    if (d.schema_version !== PUBLICATION_SCHEMA_VERSION || !Array.isArray(d.emitted)) {
        throw new PublishError(`${PUBLICATION_FILE} has an unknown shape`);
    }
    return assertPublishable(d.emitted);
}

/** The PR body: a regular file directly in the run directory, never a symbolic or hard link. */
export function prBodyPath(runDir: string): string {
    const file = path.join(runDir, PR_BODY_FILE);
    let stat: fs.Stats;
    try {
        stat = fs.lstatSync(file);
    } catch {
        throw new PublishError(`PR body ${PR_BODY_FILE} is missing from the run directory`);
    }
    if (!stat.isFile()) throw new PublishError(`PR body ${PR_BODY_FILE} is not a regular file`);
    // A second hard link is an alias of a file outside the run directory.
    if (stat.nlink !== 1) throw new PublishError(`PR body ${PR_BODY_FILE} is hard-linked elsewhere`);
    return file;
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

interface Resolved {
    target: PublicationTarget;
    emitted: string[];
    bodyFile: string;
    baseSha: string;
}

function resolve(runDir: string, record: RunRecord, input: PublishInput): Resolved {
    return {
        target: PublicationTarget.forRun(record.run_id, input.base),
        emitted: readPublication(runDir),
        bodyFile: prBodyPath(runDir),
        baseSha: assertObjectId(input.baseSha, 'base SHA'),
    };
}

function tryPush(port: PublishPort, target: PublicationTarget, expected: string | null): string | null {
    try {
        port.push(target, expected);
        return null;
    } catch (err) {
        return `expected-head check: push to ${target.branch} expecting ${String(expected)} was refused (${(err as Error).message})`;
    }
}

/** validated → committed → pushed → pr-open. Re-invoking it after a kill repeats nothing already done. */
export function publish(
    port: PublishPort,
    runDir: string,
    record: RunRecord,
    input: PublishInput,
): { record: RunRecord; pr: number | null } {
    let rec = record;
    let r: Resolved;
    try {
        r = resolve(runDir, rec, input);
    } catch (err) {
        if (!(err instanceof PublishError)) throw err;
        return { record: handBack(runDir, rec, err.message), pr: null };
    }
    const refused = publicationGate(r, input);
    if (refused !== null) return { record: handBack(runDir, rec, refused), pr: null };
    if (!reached(rec, 'committed')) {
        const outside = outsideAllowed(port, r.emitted);
        if (outside.length > 0) {
            return { record: handBack(runDir, rec, `staged path outside the allowed set: ${outside.join(', ')}`), pr: null };
        }
        if (!port.isAncestor(r.baseSha, port.localHead())) {
            return { record: handBack(runDir, rec, `base SHA ${r.baseSha} is not an ancestor of the run head`), pr: null };
        }
        port.commit(input.message);
        rec = transition(runDir, rec, 'committed');
    }
    if (!reached(rec, 'pushed')) {
        const remote = port.remoteHead(r.target);
        if (remote !== null && remote !== port.localHead()) {
            const reason = `expected-head check: ${r.target.branch} already exists on the remote at ${remote}`;
            return { record: handBack(runDir, rec, reason), pr: null };
        }
        if (remote === null) {
            const refused = tryPush(port, r.target, null);
            if (refused !== null) return { record: handBack(runDir, rec, refused), pr: null };
        }
        rec = transition(runDir, rec, 'pushed');
    }
    if (reached(rec, 'pr-open')) return { record: rec, pr: port.findOpenPr(r.target) };

    const key = publicationKey(rec.run_id, r.emitted, r.baseSha);
    let pr = port.findOpenPr(r.target);
    rec = publishOnce(runDir, rec, key, () => {
        if (pr === null) pr = port.createPr(prCreateArgs({ title: input.title, bodyFile: r.bodyFile, base: r.target.base, head: r.target.branch }));
    }).record;
    if (pr === null) return { record: handBack(runDir, rec, `publication recorded but no open PR on ${r.target.branch}`), pr: null };
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
    let r: Resolved;
    try {
        r = resolve(runDir, rec, input);
    } catch (err) {
        if (!(err instanceof PublishError)) throw err;
        return handBack(runDir, rec, err.message);
    }
    let pushed = port.remoteHead(r.target);
    for (let round = 0; ; round += 1) {
        const verdict = port.ciSettle(input.pr);
        if (verdict.green) return transition(runDir, transition(runDir, rec, 'ci-settled'), 'done');
        if (round >= MAX_CI_FIX_ROUNDS) {
            return handBack(runDir, rec, `CI red after ${MAX_CI_FIX_ROUNDS} fix rounds: ${verdict.red.join(', ')}`);
        }
        fix(verdict.red);
        if (port.stagedPaths().length === 0) {
            return handBack(runDir, rec, `CI fix staged nothing for: ${verdict.red.join(', ')}`);
        }
        const outside = outsideAllowed(port, r.emitted);
        if (outside.length > 0) {
            rec = handBack(runDir, rec, `CI fix staged a path outside the allowed set: ${outside.join(', ')}`);
            return rec;
        }
        const remote = port.remoteHead(r.target);
        if (remote !== pushed) {
            return handBack(runDir, rec, `expected-head check: ${r.target.branch} moved to ${String(remote)}`);
        }
        port.commit(`fix: CI round ${round + 1} — ${verdict.red.join(', ')}`);
        const refused = tryPush(port, r.target, pushed);
        if (refused !== null) return handBack(runDir, rec, refused);
        pushed = port.localHead();
    }
}

/**
 * The git + gh port a door uses. Never merges. A push names its full
 * destination ref and leases it on the exact expected head (empty: must not
 * exist), after checking the expected head is an ancestor of HEAD — a
 * fast-forward compare-and-swap, never a force.
 */
export function gitGhPort(cwd: string): PublishPort {
    const run = (bin: string, args: string[]): string => execFileSync(bin, args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
    const isAncestor = (ancestor: string, descendant: string): boolean => {
        try {
            run('git', ['merge-base', '--is-ancestor', assertObjectId(ancestor, 'ancestor'), assertObjectId(descendant, 'descendant')]);
            return true;
        } catch (err) {
            if (err instanceof PublishError) throw err;
            return false;
        }
    };
    return {
        stagedPaths: () => run('git', ['diff', '--cached', '--name-only']).split('\n').filter(Boolean),
        commit: (message) => {
            run('git', ['commit', '-m', message]);
            return run('git', ['rev-parse', 'HEAD']);
        },
        localHead: () => run('git', ['rev-parse', 'HEAD']),
        isAncestor,
        remoteHead: (target) => {
            const ref = `refs/heads/${assertRefName(target.branch, 'branch')}`;
            const row = run('git', ['ls-remote', 'origin', ref])
                .split('\n')
                .map((l) => l.split(/\s+/))
                .find((cols) => cols[1] === ref);
            return row?.[0] ?? null;
        },
        push: (target, expected) => {
            const ref = `refs/heads/${assertRefName(target.branch, 'branch')}`;
            if (expected !== null) {
                assertObjectId(expected, 'expected remote head');
                const head = run('git', ['rev-parse', 'HEAD']);
                if (!isAncestor(expected, head)) throw new PublishError(`${expected} is not an ancestor of HEAD; refusing a non-fast-forward push`);
            }
            run('git', ['push', '--porcelain', `--force-with-lease=${ref}:${expected ?? ''}`, 'origin', `HEAD:${ref}`]);
        },
        findOpenPr: (target) => {
            const rows = JSON.parse(
                run('gh', ['pr', 'list', '--head', assertRefName(target.branch, 'branch'), '--state', 'open', '--json', 'number']),
            ) as Array<{ number: number }>;
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

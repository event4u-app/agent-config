/**
 * From hypothesis to proof (roadmap H.6). With more than one candidate and a
 * reproducing test, print a `git bisect run` plan the user runs. The plan works
 * in a detached throwaway worktree, so it never moves anyone's branch, and it
 * contains no push. Nothing here runs git.
 *
 * A cause becomes `confirmed` only on evidence — the test fails at the cause
 * and passes at the fix — and is stored as a `test_guards_against` edge from
 * the test to the bug, locally under `.build/bugs/`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { BUGS_DIR } from './bugs.js';

export type BisectPlan = { ok: true; lines: string[] } | { ok: false; reason: string };

const SAFE = /^[A-Za-z0-9 ._/:=@+,-]+$/;

/**
 * `candidates` oldest first. The good end is the parent of the oldest
 * candidate; the bad end is the newest one.
 */
export function bisectPlan(input: { candidates: readonly string[]; test: string | null; worktree?: string }): BisectPlan {
    if (input.candidates.length < 2) return { ok: false, reason: 'one candidate needs no bisect: run the test at it and at its parent' };
    if (!input.test) return { ok: false, reason: 'no reproducing test: write one that fails on the bug first' };
    if (!SAFE.test(input.test) || /\bgit\s+push\b/.test(input.test)) return { ok: false, reason: 'the test command holds characters or a push the plan will not print' };
    const oldest = input.candidates[0] as string;
    const newest = input.candidates[input.candidates.length - 1] as string;
    const wt = input.worktree ?? '../bisect-tmp';
    return {
        ok: true,
        lines: [
            `git worktree add --detach ${wt} ${newest}`,
            `cd ${wt}`,
            `git bisect start ${newest} ${oldest}^`,
            `git bisect run ${input.test}`,
            'git bisect reset',
            'cd -',
            `git worktree remove ${wt}`,
        ],
    };
}

export interface GuardEdge {
    source: string;
    target: string;
    relation: 'test_guards_against';
    cause: string;
    confirmed_at: string;
}

export type CauseVerdict = { state: 'confirmed'; edge: GuardEdge } | { state: 'hypothesis'; reason: string };

export function causesPath(buildDir: string): string {
    return path.join(buildDir, BUGS_DIR, 'causes.json');
}

export function readCauses(buildDir: string): GuardEdge[] {
    try {
        return JSON.parse(fs.readFileSync(causesPath(buildDir), 'utf-8')) as GuardEdge[];
    } catch {
        return [];
    }
}

export function confirmCause(buildDir: string, input: { bug: string; test: string; cause: string; failsAtCause: boolean; passesAtFix: boolean; now?: Date }): CauseVerdict {
    if (!input.failsAtCause) return { state: 'hypothesis', reason: 'the test does not fail at the candidate' };
    if (!input.passesAtFix) return { state: 'hypothesis', reason: 'the test does not pass at the fix' };
    const edge: GuardEdge = { source: input.test, target: input.bug, relation: 'test_guards_against', cause: input.cause, confirmed_at: (input.now ?? new Date()).toISOString() };
    const edges = readCauses(buildDir).filter((e) => !(e.source === edge.source && e.target === edge.target));
    edges.push(edge);
    const dir = path.join(buildDir, BUGS_DIR);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(causesPath(buildDir), `${JSON.stringify(edges, null, 1)}\n`, { mode: 0o600 });
    return { state: 'confirmed', edge };
}

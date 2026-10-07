/**
 * The remedy for a review that predates a rebase: under a strategy other than
 * `merge` the completion review binds after the last rebase, and a review taken
 * before one is re-bound after it (contract `plan-review-gates.md` § 2.5).
 *
 * Nothing edits the review record automatically. The re-binding reviewer cites
 * the post-rebase fix commit in a commit of its own; the gate's strictness is
 * unchanged — the same check that refuses the stale citation accepts the
 * re-bound one, locally and in a transport clone.
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ART, artifact, fixedRow, git, rebaseOntoMovedBase, reviewedBranch, runGate, transportClone } from '../_lib/completion_review_rebase.js';

const made: string[] = [];
afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** The re-binding reviewer's act: cite the commit that now carries the fix, re-bind the scope, commit it alone. */
function rebind(dir: string, fixSha: string): void {
    fs.writeFileSync(path.join(dir, ART), artifact(dir, [fixedRow(fixSha)]));
    git(dir, 'add', ART);
    git(dir, 'commit', '-qm', 'rebind completion review after rebase');
}

const postRebaseFix = (dir: string): string => git(dir, 'log', '-1', '--format=%H', '--', 'src/fix.ts');

describe('a review taken before a rebase is re-bound after it', () => {
    it('is red after the rebase and green once re-bound to the post-rebase fix', () => {
        const { dir, fixSha } = reviewedBranch(made);
        rebaseOntoMovedBase(dir);
        expect(runGate(dir).kinds).toEqual(['fix-before-artifact']);

        const newFix = postRebaseFix(dir);
        expect(newFix).not.toBe(fixSha);
        rebind(dir, newFix);

        const r = runGate(dir);
        expect(r.kinds).toEqual([]);
        expect(r.status).toBe(0);
    });

    it('stays green in a git clone --no-local once re-bound', () => {
        const { dir } = reviewedBranch(made);
        rebaseOntoMovedBase(dir);
        rebind(dir, postRebaseFix(dir));
        const r = runGate(transportClone(dir, made));
        expect(r.kinds).toEqual([]);
        expect(r.status).toBe(0);
    });

    it('a record that keeps the pre-rebase citation is still refused — the gate did not loosen', () => {
        const { dir, fixSha } = reviewedBranch(made);
        rebaseOntoMovedBase(dir);
        // Re-binding with the old SHA writes the same bytes: the record already says it.
        expect(fs.readFileSync(path.join(dir, ART), 'utf8')).toBe(artifact(dir, [fixedRow(fixSha)]));
        expect(runGate(dir).kinds).toEqual(['fix-before-artifact']);
        expect(runGate(transportClone(dir, made)).kinds).toEqual(['unresolvable-fix-ref']);
    });

    it('the re-binding is its own commit, and the rebase itself left the record untouched', () => {
        const { dir, fixSha } = reviewedBranch(made);
        rebaseOntoMovedBase(dir);
        expect(fs.readFileSync(path.join(dir, ART), 'utf8')).toContain(fixSha);
        rebind(dir, postRebaseFix(dir));
        expect(git(dir, 'show', '--name-only', '--format=', 'HEAD')).toBe(ART);
    });
});

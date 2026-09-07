// Regression lock for a defect the operator caught and the pipeline could not.
//
// Measured 2026-09-07 in `fix/release-obligation-answerable`: a merge-reconciled
// baseline was written into `gate-violation-baselines.json` AFTER `git add`, so
// `git commit --no-edit` captured the staged (stale) side and the reconciled
// number stayed in the working tree. The push went out without it and the
// pushed branch asserted a baseline its own tree contradicted.
//
// No CI gate can catch this class: CI checks out the pushed commit, and the
// working tree holding the lost edit does not exist there. The check is
// therefore pre-push and local-only, and these cases pin the authorship split
// that keeps it from becoming a blanket "clean tree or no push" rule — which
// would fire on every gate script's own report output and train the operator
// to set the skip variable.
import { describe, expect, it } from 'vitest';

import {
    classifyBranchWork,
    parsePorcelain,
} from '../../src/scripts/check_branch_work_committed.js';

const BASELINE = 'src/config/gate-violation-baselines.json';

describe('check_branch_work_committed — the authorship split', () => {
    it('THE DEFECT: staged and changed again since blocks', () => {
        const v = classifyBranchWork({
            porcelain: `MM ${BASELINE}`,
            branchFiles: [BASELINE],
        });
        expect(v.ok).toBe(false);
        expect(v.blocking).toHaveLength(1);
        // Asserted on the DIVERGENCE wording, not on `git add`, which appears in
        // the staged-but-uncommitted message too. Measured: with the divergence
        // rule neutralised this case stayed GREEN, because the staged rule below
        // it blocks the same row with a vaguer reason. The specific wording is
        // the only thing that distinguishes the two, and the reason it matters
        // is diagnostic — "you edited it after adding it" tells the operator to
        // re-add, "it is not committed" tells them to commit, and one of those
        // two is wrong here.
        expect(v.blocking[0]?.why).toContain('changed again since');
    });

    it('blocks the same shape even when the branch never committed that file', () => {
        // `AM` on a file absent from branchFiles: the divergence rule must not
        // depend on the authorship inference, or a first-time edit escapes.
        const v = classifyBranchWork({ porcelain: `AM ${BASELINE}`, branchFiles: [] });
        expect(v.ok).toBe(false);
    });

    it('blocks a staged-but-never-committed file — `git add` is recorded intent', () => {
        const v = classifyBranchWork({
            porcelain: 'A  src/scripts/check_branch_work_committed.ts',
            branchFiles: ['src/scripts/release.ts'],
        });
        expect(v.ok).toBe(false);
        expect(v.blocking[0]?.why).toContain('never committed');
    });

    it('blocks an unstaged change to a file this branch committed', () => {
        const v = classifyBranchWork({
            porcelain: ' M src/scripts/release.ts',
            branchFiles: ['src/scripts/release.ts'],
        });
        expect(v.ok).toBe(false);
    });

    it("THE CARVE-OUT: a dirty file the branch never committed does NOT block", () => {
        // Gate scripts write reports; a parallel session may touch a shared
        // file. Blocking here is what would train the operator to skip the gate.
        const v = classifyBranchWork({
            porcelain: ' M agents/reports/originality.json\n M agents/reports/originality.md',
            branchFiles: ['src/scripts/release.ts'],
        });
        expect(v.ok).toBe(true);
        expect(v.advisory).toHaveLength(2);
    });

    it('an untracked file does not block, and is named', () => {
        const v = classifyBranchWork({ porcelain: '?? scratch.txt', branchFiles: [] });
        expect(v.ok).toBe(true);
        expect(v.advisory).toEqual(['scratch.txt']);
    });

    it('a clean tree passes with nothing reported', () => {
        expect(classifyBranchWork({ porcelain: '', branchFiles: [BASELINE] })).toEqual({
            ok: true,
            blocking: [],
            advisory: [],
        });
    });

    it('mixes classes in one reading without losing either', () => {
        const v = classifyBranchWork({
            porcelain: `MM ${BASELINE}\n M agents/reports/originality.json\n?? scratch.txt`,
            branchFiles: [BASELINE],
        });
        expect(v.blocking.map((b) => b.path)).toEqual([BASELINE]);
        expect(v.advisory).toEqual(['agents/reports/originality.json', 'scratch.txt']);
    });

    it('reads a rename through to its NEW path', () => {
        // `R  old -> new`: blocking on `old` would name a path that no longer
        // exists, which is unactionable for the operator.
        const rows = parsePorcelain('R  src/a.ts -> src/b.ts');
        expect(rows[0]?.path).toBe('src/b.ts');
    });

    it('unquotes a path git quoted for spaces', () => {
        expect(parsePorcelain('?? "with space.txt"')[0]?.path).toBe('with space.txt');
    });
});

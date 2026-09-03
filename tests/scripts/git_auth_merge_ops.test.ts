/**
 * The four merge-op defects, one test per vector, each naming the op it asserts.
 *
 * PRE-CHANGE BEHAVIOUR, measured against HEAD before this landed — 4 of the 5
 * vectors were wrong:
 *
 *   gh pr merge 12 --auto          -> ["pr-merge"]      WRONG (auto is invisible)
 *   gh api graphql enable…AutoMerge -> []               WRONG (bypasses entirely)
 *   gh pr merge 12 --disable-auto  -> ["pr-merge"]      WRONG (de-escalation blocked)
 *   "nicht mergen"                 -> ["pr-merge"]      WRONG (negation authorizes)
 *   "merge PR #123"                -> ["pr-merge"]      correct — the control
 *
 * A test that asserts "is blocked" without naming the op cannot tell the
 * `--auto` defect from a plain merge, which is the whole of D1a. So every case
 * below asserts the `GitOp` explicitly.
 *
 * SABOTAGE PROBE, run before this file was trusted: neutralising the negation
 * lookbehind (dropping the `(?<!…)` group) turns the four negative-corpus cases
 * green-to-red — 4 failures — and restoring it returns 12/12. A guard never seen
 * fail has unknown sensitivity. `git diff --stat` over the guard path is empty.
 */
import { describe, expect, it } from 'vitest';

import { classifyAuthorization } from '../../src/scripts/git_authorization_hook.js';
import { commandOp } from '../../src/scripts/hooks/block_unauthorized_git.js';

const fence = (cmd: string): string => `\`\`\`\n${cmd}\n\`\`\``;
const ops = (prompt: string): string[] => classifyAuthorization(prompt).authorized;

describe('D1a — enabling auto-merge is its own op', () => {
    it('`gh pr merge --auto` classifies as pr-merge-auto, not pr-merge', () => {
        expect(ops(fence('gh pr merge 12 --auto'))).toEqual(['pr-merge-auto']);
    });

    it('a plain `gh pr merge` still classifies as pr-merge', () => {
        // The counter-test. If the new pattern had simply replaced the old one,
        // every other assertion here would still pass while plain merges
        // stopped being recognised at all.
        expect(ops(fence('gh pr merge 12'))).toEqual(['pr-merge']);
    });
});

describe('D1b — the GraphQL mutation is the same operation by another transport', () => {
    it('`gh api graphql … enablePullRequestAutoMerge` classifies as pr-merge-auto', () => {
        expect(ops(fence("gh api graphql -f query='mutation{enablePullRequestAutoMerge(input:{})}'"))).toEqual([
            'pr-merge-auto',
        ]);
    });

    it('the REST merge endpoint still classifies as pr-merge, block-side', () => {
        // `ghApiWrite()` was not widened to reach the mutation — widening it
        // would have loosened every other op that uses it. This asserts the
        // helper still does its own job.
        //
        // Asserted against `commandOp`, the BLOCK-side classifier, because that
        // is where `ghApiWrite` lives. The prose/fence table in the
        // authorization hook has no `gh api` entry at all — a first draft of
        // this case asserted it there and returned [], which is a fixture aimed
        // at the wrong classifier rather than a defect.
        expect(commandOp('gh api -X PUT /repos/o/r/pulls/12/merge')).toBe('pr-merge');
    });

    it('block-side: --auto and the mutation both reach pr-merge-auto', () => {
        expect(commandOp('gh pr merge 12 --auto')).toBe('pr-merge-auto');
        expect(commandOp("gh api graphql -f query='mutation{enablePullRequestAutoMerge(input:{})}'")).toBe(
            'pr-merge-auto',
        );
        expect(commandOp('gh pr merge 12')).toBe('pr-merge');
    });
});

describe('D3 — a de-escalating command authorizes nothing', () => {
    it('`--disable-auto` classifies as neither merge op', () => {
        // It turns the capability OFF. Requiring merge authorization to switch
        // auto-merge off is a live deadlock, which is why this ships WITH the
        // split and not after it.
        const got = ops(fence('gh pr merge 12 --disable-auto'));
        expect(got).not.toContain('pr-merge');
        expect(got).not.toContain('pr-merge-auto');
        expect(got).toEqual([]);
    });

    it('`disablePullRequestAutoMerge` likewise', () => {
        expect(ops(fence("gh api graphql -f query='mutation{disablePullRequestAutoMerge(input:{})}'"))).toEqual([]);
    });
});

describe('D2 — the negative corpus: a negation authorizes nothing', () => {
    for (const prompt of ['nicht mergen', "don't merge this", 'never auto-merge', 'do not merge', 'ohne zu mergen']) {
        it(`"${prompt}" authorizes no merge`, () => {
            expect(ops(prompt)).toEqual([]);
        });
    }

    it('the pre-existing noun senses are untouched — the guard is additive', () => {
        expect(ops('merge conflict aufloesen')).toEqual([]);
        // Asserted on the MERGE op specifically, not on an empty array: "der
        // merge commit ist kaputt" also matches the `commit` op's own prose
        // pattern, which is pre-existing and has nothing to do with the merge
        // noun-sense exclusion this case is about. A first draft asserted [] and
        // failed on that unrelated match.
        expect(ops('der merge commit ist kaputt')).not.toContain('pr-merge');
    });
});

describe('D2 — the POSITIVE control corpus', () => {
    /**
     * The half that matters more than the negative one.
     *
     * A negation guard that suppresses too much is WORSE than the defect it
     * fixes: it silently stops authorizing merges the user did order, and the
     * failure is invisible because nothing happens and nothing says why.
     *
     * These pass at HEAD **and** after the change. A positive case that only
     * passes after is not a control — it is a description of the new behaviour.
     */
    for (const prompt of ['merge PR #123', 'merge', 'mergen', 'zusammenführen', 'bitte mergen']) {
        it(`"${prompt}" still authorizes pr-merge`, () => {
            expect(ops(prompt)).toContain('pr-merge');
        });
    }

    it('a sentence boundary ends a negation reach', () => {
        // "Do not push" and "Merge PR #12" are two instructions. A guard that
        // let the first suppress the second would be the over-suppression this
        // corpus exists to catch.
        expect(ops('Nicht pushen. Merge PR #12.')).toContain('pr-merge');
    });
});

describe('the negation defect that was recorded here, closed 2026-09-03', () => {
    // This block used to assert the LEAK as current behaviour, with a note
    // saying that the day someone fixes it this test should fail and point at
    // the note rather than let the gap go unnoticed. That is exactly what
    // happened, so the assertion is inverted rather than deleted.
    //
    // The widening the note asked for a screen on has now had one, and it was a
    // measurement rather than a judgement: probing fifteen newly added phrases
    // on 2026-09-03 found 15 of 15 authorizing the operation their sentence
    // forbade, and the same probe showed `push` and `branch` had been leaking
    // all along. `negatedBefore` applies one sentence-scoped check to every op,
    // so there is no longer a per-op vocabulary to drift.
    it('a negated push no longer authorizes a push', () => {
        expect(ops('Nicht pushen. Merge PR #12.')).not.toContain('push');
    });
});

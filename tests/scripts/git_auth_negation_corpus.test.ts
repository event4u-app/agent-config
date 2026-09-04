/**
 * The negation corpus, executed.
 *
 * The corpus itself is `tests/scripts/fixtures/git_auth_negation_corpus.ts` —
 * typed rows with stable ids, so a row is citable from outside this file. See
 * that file's header for why an id and not a test description, and for the
 * property this corpus asserts instead of a phrase list.
 *
 * Historical note: the authoritative account of the merge-op split and the
 * first negation guard lives in `git_auth_merge_ops.test.ts`. This suite does
 * not restate it.
 */
import { describe, expect, it } from 'vitest';

import { classifyAuthorization, foldGrants, isRevocation } from '../../src/scripts/git_authorization_hook.js';
import { NEGATION_CORPUS } from './fixtures/git_auth_negation_corpus.js';

describe('authorization negation corpus', () => {
    it('every id is unique — an id is a citable handle, so a duplicate is a defect', () => {
        const ids = NEGATION_CORPUS.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('every row carries a reason that is not a restatement of its prompt', () => {
        for (const c of NEGATION_CORPUS) {
            expect(c.why.length, c.id).toBeGreaterThan(20);
            expect(c.why.toLowerCase(), c.id).not.toBe(c.prompt.toLowerCase());
        }
    });

    for (const c of NEGATION_CORPUS) {
        it(`${c.id} — ${c.why.slice(0, 72)}`, () => {
            const got = classifyAuthorization(c.prompt).authorized;
            expect([...got].sort(), `${c.id}: ${c.prompt}`).toEqual([...c.expect].sort());
        });
    }
});

/**
 * The SAME corpus, read by the other function.
 *
 * Until 2026-09-04 these rows were fed to `classifyAuthorization` only, while
 * `isRevocation` ran a separate negation grammar — a fixed 30-character
 * backward window with its own inline vocabulary. The corpus could not see the
 * disagreement because it only ever asked one of the two. Asserting both here
 * is what makes "one negation vocabulary" a property the suite checks rather
 * than a claim the docblock makes.
 *
 * Every row is asserted, including the ones that must NOT revoke — a corpus
 * that only asserted the withdrawals would go green on a parser that revokes
 * everything, which is the failure direction that silently costs the user their
 * merge authority on every turn.
 */
describe('the same corpus, read by isRevocation', () => {
    for (const c of NEGATION_CORPUS) {
        it(`${c.id} — revokes=${String(c.revokes)}`, () => {
            expect(isRevocation(c.prompt), `${c.id}: ${c.prompt}`).toBe(c.revokes);
        });
    }

    it('a withdrawal row actually drops a standing grant, and a non-withdrawal row does not', () => {
        // `isRevocation` is a predicate; the USER-VISIBLE consequence is what
        // `foldGrants` does with it. Asserting only the predicate would leave
        // the wiring untested, and the wiring is where the defect was felt: a
        // standing grant over PR #12 survived "Merge PR #12 auf keinen Fall."
        const prior = [
            {
                id: 'g1',
                op: 'pr-merge' as const,
                targets: [12],
                consumed: [] as number[],
                granted_at: '2026-09-04T00:00:00.000Z',
                evidence: 'prior turn',
            },
        ];
        const at = new Date('2026-09-04T01:00:00Z');
        for (const c of NEGATION_CORPUS) {
            const authorized = classifyAuthorization(c.prompt).authorized;
            const kept = foldGrants(prior, c.prompt, authorized, 'sess', at).flatMap((g) => g.targets);
            if (c.revokes) {
                expect(kept, `${c.id} must drop the prior grant`).not.toContain(12);
            } else {
                expect(kept, `${c.id} must keep the prior grant`).toContain(12);
            }
        }
    });
});

describe('the corpus asserts the property, not a phrase list', () => {
    it('a trailing negation does not reach back across a contrast cue', () => {
        // Not in the corpus: constructed here to show the property generalises
        // beyond the rows, which is the whole point of asserting a property.
        //
        // The prompt opens with `Merge` deliberately. An opener like `do not
        // push, but merge …` would test the same clause property through a
        // leading-word interrogative misread that this change does NOT fix —
        // see `interrogative.en.pr-merge.known-limit-01`. A probe confounded by
        // a known limit measures the limit, not the property.
        for (const cue of ['but', 'however']) {
            const got = classifyAuthorization(`Merge PR #7, ${cue} do not push.`).authorized;
            expect([...got], cue).toContain('pr-merge');
            expect([...got], cue).not.toContain('push');
        }
    });

    it('a leading negation does not reach forward across a contrast cue', () => {
        for (const cue of ['aber', 'sondern']) {
            const got = classifyAuthorization(`Nicht pushen, ${cue} mergen`).authorized;
            expect([...got], cue).toContain('pr-merge');
            expect([...got], cue).not.toContain('push');
        }
    });

    it('a negation binds inside its sentence and not past a full stop', () => {
        const got = classifyAuthorization('Never force-push. Merge PR #7.').authorized;
        expect([...got]).toContain('pr-merge');
    });

    it('an abbreviation dot does not end a sentence, in either direction', () => {
        for (const p of [
            'Bitte z.B. den PR #7 nicht mergen.',
            'Du sollst nicht z.B. den PR #7 mergen.',
        ]) {
            expect([...classifyAuthorization(p).authorized], p).not.toContain('pr-merge');
        }
    });
});

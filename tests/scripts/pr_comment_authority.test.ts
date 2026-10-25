/**
 * G7 — a PR review comment's author authority decides whether `/fix:pr-comments`
 * Auto may apply it. The payloads are recorded shapes of the GitHub REST
 * review-comment object, reduced to the fields the classifier reads.
 */
import { describe, expect, it } from 'vitest';

import { classifyCommentAuthority } from '../../src/scripts/_lib/pr_comment_authority.js';

const clearFix = (author_association: string) => ({
    body: 'Clear fix: replace the guard with `if (!user) return;`',
    user: { login: 'someone', type: 'User' },
    author_association,
});

const inputOf = (c: ReturnType<typeof clearFix>) => ({
    author_association: c.author_association,
    isBot: c.user.type === 'Bot',
    isPrAuthor: false,
});

describe('classifyCommentAuthority (G7)', () => {
    it('a "clear fix" from author_association NONE needs the owner', () => {
        expect(classifyCommentAuthority(inputOf(clearFix('NONE')))).toBe('needs-owner');
    });

    it('the same payload from a MEMBER is apply-eligible', () => {
        expect(classifyCommentAuthority(inputOf(clearFix('MEMBER')))).toBe('apply-eligible');
    });

    it.each(['OWNER', 'MEMBER', 'COLLABORATOR'])('%s carries write access → apply-eligible', (a) => {
        expect(classifyCommentAuthority({ author_association: a, isBot: false, isPrAuthor: false })).toBe(
            'apply-eligible',
        );
    });

    it.each(['CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER', 'MANNEQUIN', 'NONE', '', 'owner '])(
        '%j never auto-applies',
        (a) => {
            expect(
                classifyCommentAuthority({ author_association: a, isBot: false, isPrAuthor: false }),
            ).toBe('needs-owner');
        },
    );

    it('a missing or non-string association never auto-applies', () => {
        expect(classifyCommentAuthority({ isBot: false, isPrAuthor: false })).toBe('needs-owner');
        expect(
            classifyCommentAuthority({
                author_association: null as unknown as string,
                isBot: false,
                isPrAuthor: false,
            }),
        ).toBe('needs-owner');
    });

    it('bots keep their own triage, whatever the association says', () => {
        expect(classifyCommentAuthority({ author_association: 'NONE', isBot: true, isPrAuthor: false })).toBe(
            'bot-triage',
        );
    });

    it('the PR author is never auto-applied, even as a collaborator', () => {
        expect(
            classifyCommentAuthority({ author_association: 'OWNER', isBot: false, isPrAuthor: true }),
        ).toBe('needs-owner');
    });
});

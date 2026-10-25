/**
 * Who may have a PR review comment applied by `/fix:pr-comments` Auto.
 *
 * On a public repository any account can comment; a comment is a claim, not a
 * grant. Only the three `author_association` values that carry write access may
 * reach the apply → commit → push path. Everything else, including a missing or
 * malformed value, is listed verbatim for the owner — never applied, never
 * dropped. Matching is exact because GitHub emits these values verbatim; a
 * value that only resembles one is not one.
 */
export type CommentAuthority = 'apply-eligible' | 'needs-owner' | 'bot-triage';

export interface CommentAuthorityInput {
    author_association?: string;
    isBot: boolean;
    isPrAuthor: boolean;
}

export const WRITE_ACCESS_ASSOCIATIONS: ReadonlySet<string> = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export function classifyCommentAuthority(input: CommentAuthorityInput): CommentAuthority {
    if (input.isBot) return 'bot-triage';
    // The command never processes the PR author's own comments; if one reaches
    // here anyway it is not a review of someone else's code, so it never auto-applies.
    if (input.isPrAuthor) return 'needs-owner';
    const association = input.author_association;
    if (typeof association === 'string' && WRITE_ACCESS_ASSOCIATIONS.has(association)) {
        return 'apply-eligible';
    }
    return 'needs-owner';
}

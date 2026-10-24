/**
 * The user-addressed channel: text a concern hands the dispatcher for the HUMAN,
 * which the host shows in its own UI and never adds to model context.
 *
 * WHY IT EXISTS. Every channel the dispatcher had addressed the model
 * (`additional_context`, `context`) or went to stderr, and every host runs the
 * dispatcher on pipes — so a concern with something to tell the user had no
 * path that reached them. `update-notice` was refused registration for exactly
 * that: bound, it would have said nothing anywhere.
 *
 * Claude Code documents a `systemMessage` field on every hook event, "Display a
 * message to the user", read off the 2.1.310 binary on 2026-10-24. It is the
 * only host this package has verified a user-addressed field on, so the set
 * below is one host wide; an unlisted host gets nothing rather than a guess.
 */

/** The concern reply key a notification concern puts its user-facing text under. */
export const USER_NOTICE_KEY = 'user_notice';

/** Longest notice the dispatcher forwards; a notice is a few lines, never a document. */
export const USER_NOTICE_MAX_CHARS = 1000;

/** Hosts with a verified field that shows text to the user and not to the model. */
export const USER_NOTICE_HOSTS: ReadonlySet<string> = new Set(['claude']);

export function hostShowsUserNotice(platform: unknown): boolean {
    return typeof platform === 'string' && USER_NOTICE_HOSTS.has(platform);
}

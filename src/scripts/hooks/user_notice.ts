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

import * as fs from 'node:fs';

import { write_atomic } from '../_lib/fs_atomic.js';
import { write_target } from '../_lib/user_global_paths.js';

/** The concern reply key a notification concern puts its user-facing text under. */
export const USER_NOTICE_KEY = 'user_notice';

/** Longest notice the dispatcher forwards; a notice is a few lines, never a document. */
export const USER_NOTICE_MAX_CHARS = 1000;

/** Hosts with a verified field that shows text to the user and not to the model. */
export const USER_NOTICE_HOSTS: ReadonlySet<string> = new Set(['claude']);

export function hostShowsUserNotice(platform: unknown): boolean {
    return typeof platform === 'string' && USER_NOTICE_HOSTS.has(platform);
}

/**
 * A delivery receipt: the dispatcher writes one per concern whose notice it
 * actually put into host output, naming the session. A concern that must not
 * count a notice as shown until it was handed to the host reads it on its next
 * run; anything the dispatcher dropped leaves no receipt, so the concern says
 * it again.
 */
export interface NoticeReceipt {
    readonly session_id: string;
    readonly at: string;
}

function receiptPath(concern: string): string {
    return write_target(`user-notice-${concern}.delivered`);
}

export function writeNoticeReceipts(concerns: readonly string[], sessionId: string): void {
    for (const concern of new Set(concerns)) {
        try {
            write_atomic(receiptPath(concern), JSON.stringify({ session_id: sessionId, at: new Date().toISOString() }));
        } catch {
            // no receipt → the concern repeats its notice, which is the safe direction
        }
    }
}

export function readNoticeReceipt(concern: string): NoticeReceipt | null {
    try {
        const o = JSON.parse(fs.readFileSync(receiptPath(concern), 'utf-8')) as Record<string, unknown>;
        return typeof o['session_id'] === 'string' && typeof o['at'] === 'string'
            ? { session_id: o['session_id'], at: o['at'] }
            : null;
    } catch {
        return null;
    }
}

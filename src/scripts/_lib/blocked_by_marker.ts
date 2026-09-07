/**
 * Ask before park — the inline `blocked-by:` marker, and the decision that must
 * precede writing one.
 *
 * road-to-asked-not-parked Phase 3. `terminal-states.md` defines `blocked` to
 * include "a decision only the user can make", and `roadmap-process-loop.md`
 * writes and reads the inline marker with NO ask in between. The result is a
 * decision the user never sees: it is filed, correctly labelled, in a file
 * nobody is watching.
 *
 * This module is the executable half of the fix. It answers two questions and
 * nothing else:
 *
 *   1. Given a context — is the host interactive, was the question put, was it
 *      answered, did it time out — what does the run DO? ({@link decideAsk})
 *   2. What does the marker then look like? ({@link renderBlockedByMarker})
 *
 * The obligations it encodes:
 *
 * - On an interactive host a user-decision block is PUT TO THE USER FIRST. Only
 *   a decline, a timeout, or a non-interactive context writes a marker.
 * - A TIMEOUT IS NOT CONSENT, and neither is a non-interactive context. Where
 *   the ask cannot be completed the run ends `approval-required` — a state
 *   `terminal-states.md` already defines — carrying the unanswered question
 *   verbatim and its conservative default UNADOPTED. Nothing here ever returns
 *   the default as an answer.
 * - The marker records WHETHER the question was put, and when it was not, WHY.
 *   `asked: no` with no reason is not a legal marker: the whole point is that a
 *   later reader can tell a decision that was declined from one that was never
 *   offered.
 */
import type { RunTerminalState } from './outcome_vocabularies.js';

/** A parsed inline `<!-- blocked-by: … -->` marker. */
export interface BlockedByMarker {
    /** The blocker id the marker points at. */
    readonly id: string;
    /** Whether the question was put to the user. `null` when the marker predates the field. */
    readonly asked: boolean | null;
    /** Why it was not put. Required whenever `asked` is `false`. */
    readonly reason: string | null;
}

/**
 * The marker grammar, extended with an optional `| asked: …` tail.
 *
 * The tail is OPTIONAL in the grammar and required by the linter for the
 * user-decision class only. Parsing and policy are separated on purpose: a
 * parser that rejects the old shape would make every archived roadmap
 * unreadable, which is a migration, not a fix.
 */
export const BLOCKED_BY_MARKER_RE =
    /<!--[ \t]*blocked-by:[ \t]*([a-z0-9-]+)[ \t]*(?:\|[ \t]*asked:[ \t]*(yes|no)[ \t]*(?:[—-][ \t]*([^>]*?))?[ \t]*)?-->/i;

/** Parse one marker, or `null` when the text carries none. */
export function parseBlockedByMarker(text: string): BlockedByMarker | null {
    const m = BLOCKED_BY_MARKER_RE.exec(text);
    if (m === null) {
        return null;
    }
    const asked = m[2] === undefined ? null : m[2].toLowerCase() === 'yes';
    const reason = m[3] === undefined || m[3].trim() === '' ? null : m[3].trim();
    return { id: (m[1] as string).toLowerCase(), asked, reason };
}

/** Render a marker. Throws on `asked: no` with no reason — the state the field exists to prevent. */
export function renderBlockedByMarker(marker: BlockedByMarker): string {
    if (marker.asked === null) {
        return `<!-- blocked-by: ${marker.id} -->`;
    }
    if (marker.asked) {
        return `<!-- blocked-by: ${marker.id} | asked: yes -->`;
    }
    const reason = (marker.reason ?? '').trim();
    if (reason === '') {
        throw new Error(
            `blocked-by marker for '${marker.id}': asked: no needs a reason — ` +
                'a marker that does not say why the question was not put is the parking ' +
                'lot this field exists to end',
        );
    }
    return `<!-- blocked-by: ${marker.id} | asked: no — ${reason} -->`;
}

/** What the run knows when it reaches a step blocked on a user decision. */
export interface AskContext {
    /** The blocker id. */
    readonly id: string;
    /** The question, in the words it would be put in. */
    readonly question: string;
    /** The conservative option, named so a reader can see what was NOT adopted. */
    readonly conservativeDefault: string;
    /** Can this run reach the user at all? */
    readonly interactive: boolean;
    /** Why not, when it cannot. Required whenever `interactive` is `false`. */
    readonly nonInteractiveReason?: string | undefined;
    /** The user's answer, when one arrived. */
    readonly answer?: string | undefined;
    /** The ask was put and no answer came back. */
    readonly timedOut?: boolean | undefined;
}

/** What the run does next. */
export interface AskDecision {
    /**
     * `ask` — put the question and come back with an answer or a timeout.
     * `answered` — an answer exists; nothing is parked.
     * `park` — write the marker; the run may continue with other steps.
     * `approval-required` — the run stops and hands the unanswered question back.
     */
    readonly action: 'ask' | 'answered' | 'park' | 'approval-required';
    /** The terminal state to report, when this decision ends the run. */
    readonly terminal: RunTerminalState | null;
    /** The marker to write, when one is written. */
    readonly marker: string | null;
    /** The text the run puts in front of the user. Never a silent default. */
    readonly surfaced: string | null;
    /** Whether the conservative default was adopted. ALWAYS false — see the module header. */
    readonly defaultAdopted: false;
}

/**
 * Decide, for one user-decision block, whether to ask, park, or stop.
 *
 * Order matters: an ANSWER wins over everything, then a timeout, then a
 * non-interactive context, then the interactive path. A timeout is checked
 * before interactivity so a run that asked and got nothing is never quietly
 * re-classified as "could not ask".
 */
export function decideAsk(ctx: AskContext): AskDecision {
    const unanswered =
        `${ctx.question}\n\nConservative option (NOT adopted): ${ctx.conservativeDefault}`;

    if (ctx.answer !== undefined && ctx.answer.trim() !== '') {
        return {
            action: 'answered',
            terminal: null,
            marker: null,
            surfaced: null,
            defaultAdopted: false,
        };
    }

    if (ctx.timedOut === true) {
        return {
            action: 'approval-required',
            terminal: 'approval-required',
            marker: renderBlockedByMarker({
                id: ctx.id,
                asked: true,
                reason: null,
            }),
            surfaced: unanswered,
            defaultAdopted: false,
        };
    }

    if (!ctx.interactive) {
        const why = (ctx.nonInteractiveReason ?? '').trim();
        return {
            action: 'park',
            terminal: null,
            marker: renderBlockedByMarker({
                id: ctx.id,
                asked: false,
                reason: why === '' ? 'non-interactive context, reason not recorded' : why,
            }),
            surfaced: unanswered,
            defaultAdopted: false,
        };
    }

    return {
        action: 'ask',
        terminal: null,
        marker: null,
        surfaced: ctx.question,
        defaultAdopted: false,
    };
}

/**
 * The user declined to decide. That IS an answer about the ask — the question
 * was put — so the marker records `asked: yes` and the decline is the reason
 * the step stays blocked.
 */
export function parkAfterDecline(id: string): string {
    return renderBlockedByMarker({ id, asked: true, reason: null });
}

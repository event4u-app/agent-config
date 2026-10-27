/**
 * Fix commits as facts (roadmap H.3). A commit is a fix by one of three kinds,
 * strongest first:
 *
 *  · declared     — `Fixes <bug id>`, `Fixes: <sha>`, `This reverts commit <sha>`
 *  · ticket       — a tracker-key reference, or a ticket the user's tracker
 *                   connection reports as a bug at query time
 *  · conventional — a `fix:` subject, the weakest signal
 *
 * Bug ids are read with the one ticket grammar extended by the card's tracker
 * keys, so `SENTRY-317` is a bug reference without a second parser.
 */
import { bugReferences, ticketCandidates } from '../_lib/git_convention_grammar.js';

export type FixKind = 'declared' | 'ticket' | 'conventional';

export interface FixFacts {
    kind: FixKind | null;
    /** bug ids a `Fixes` line or a tracker key names */
    bugs: string[];
    /** commits a `Fixes: <sha>` line declares as the cause */
    fixes_shas: string[];
    /** commits this one reverts */
    reverts: string[];
}

export interface FixKeys {
    ticketKeys: readonly string[] | null;
    trackerKeys: readonly string[];
    /** query-time: true when the user's tracker says this ticket is a bug */
    isBugTicket?: (ticket: string) => boolean;
}

const FIXES_SHA = /^\s*Fix(?:es|ed)?:\s*([0-9a-f]{7,40})\b/gim;
const FIXES_ID = /\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s+([A-Za-z][A-Za-z0-9]+-\d+|[a-z]+:[\w./-]+)/gi;
const REVERT = /This reverts commit ([0-9a-f]{7,40})/g;
const CONVENTIONAL_FIX = /^fix(\([^)]*\))?!?: /;

export function classifyFix(subject: string, body: string, keys: FixKeys): FixFacts {
    const text = `${subject}\n${body}`;
    const fixes_shas = [...text.matchAll(FIXES_SHA)].map((m) => (m[1] as string).toLowerCase());
    const reverts = [...text.matchAll(REVERT)].map((m) => m[1] as string);
    const refs = bugReferences(text, keys.ticketKeys, keys.trackerKeys);
    const declaredIds = [...text.matchAll(FIXES_ID)].map((m) => m[1] as string).filter((id) => id.includes(':') || refs.includes(id.toUpperCase()));
    const bugs = [...new Set([...declaredIds.map((id) => (id.includes(':') ? id : id.toUpperCase())), ...refs])].sort();
    let kind: FixKind | null = null;
    if (fixes_shas.length || reverts.length || declaredIds.length) kind = 'declared';
    else if (refs.length) kind = 'ticket';
    else if (keys.isBugTicket && ticketCandidates(text, keys.ticketKeys).some((c) => c.status === 'ticket' && keys.isBugTicket?.(c.token))) kind = 'ticket';
    else if (CONVENTIONAL_FIX.test(subject)) kind = 'conventional';
    return { kind, bugs, fixes_shas: [...new Set(fixes_shas)], reverts: [...new Set(reverts)] };
}

/**
 * Tri-state fix state: changed in code, deployed, observed effective. No
 * traffic is read offline, so "no events" stays `not-observed`, never fixed.
 */
export interface FixState {
    changed_in_code: boolean;
    deployed: 'yes' | 'no' | 'unknown';
    observed: 'recurred' | 'not-observed' | 'unknown';
}

export function fixState(input: { inCode: boolean; deployedRelease: string | null | undefined; eventsAfterDeploy: number | null }): FixState {
    const deployed = input.deployedRelease === undefined ? 'unknown' : input.deployedRelease === null ? 'no' : 'yes';
    const observed = deployed !== 'yes' || input.eventsAfterDeploy === null ? 'unknown' : input.eventsAfterDeploy > 0 ? 'recurred' : 'not-observed';
    return { changed_in_code: input.inCode, deployed, observed };
}

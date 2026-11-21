/**
 * The phrase set that recognises an owner goal sentence — an end state the owner
 * named ("bis zum merge", "until merged") — and the sentences that revoke one.
 *
 * Deterministic on purpose: the record this feeds is a grant span, and agent
 * text may never populate one, so recognition runs in code over the owner's own
 * prompt and never asks a model. A paraphrase the set misses is a missed record,
 * which costs one re-ask; a phrase the set matches wrongly arms a mandate, so the
 * set stays narrow and the recorded sentence is shown verbatim on every turn.
 *
 * Shared by the transcript counter and the session hook, so the baseline and the
 * live recognizer can never disagree about what a goal sentence is.
 */

import { humanAuthoredLead, isSyntheticPrompt, stripInjectedRegions } from './prompt_shape.js';

/** Owner end-state phrases, DE and EN. */
export const GOAL_PATTERNS: readonly RegExp[] = [
    /\bbis\s+zum\s+merge\b/i,
    /\bbis\s+(?:es\s+|alles\s+)?gemerged\b/i,
    /\bmach\w*\s+(?:(?:den|einen|die)\s+)?PRs?\s+und\s+merge/i,
    /\barbeite\s+(?:die|das|den)\s+(?:\S+\s+)?roadmaps?\s+ab\b/i,
    /\buntil\s+(?:it\s+is\s+|it'?s\s+)?merged\b/i,
    /\b(?:open|create|make)\s+(?:a|the)\s+PR\s+and\s+merge\b/i,
    /\b(?:through|all\s+the\s+way)\s+to\s+(?:the\s+)?merge\b/i,
];

/** The words a direct goal request may open with, DE and EN. */
const REQUEST_OPENER =
    /^(?:ok(?:ay)?|ja|yes|bitte|please|dann|then|und|and|jetzt|now|so|also|mach\w*|arbeite\w*|zieh\w*|weiter|los|go|keep|work|continue|carry|open|create|make|push|take|run|do|finish|bring)\b/i;

/** Owner sentences that end a recorded goal. */
export const REVOKE_PATTERNS: readonly RegExp[] = [
    // Broad on purpose: an over-matching revocation costs one re-ask.
    /^\s*(?:stop|stopp|halt|cancel|abort|pause)\b/i,
    /\bh(?:ö|oe)r\s+auf\b|\baufh(?:ö|oe)ren\b|\babbrechen\b/i,
    /\bnicht\s+mergen\b/i,
    /\bkein(?:en)?\s+merge\b/i,
    /\b(?:don'?t|do\s+not)\s+merge\b/i,
];

/**
 * Harness-written user-role turns beyond the ones `isSyntheticPrompt` knows: a
 * slash-command expansion and its echo frames. A goal phrase inside one (a
 * command body that says "bis zum merge") is the command's text, not the owner's.
 */
const SYNTHETIC_PREFIXES: readonly string[] = [
    '<command-name>',
    '<command-message>',
    '<command-args>',
    '<local-command-',
    '<user-prompt-submit-hook>',
    '[Request interrupted',
    'Caveat:',
    'This session is being continued from a previous conversation',
];

/** Above this length a prompt is a paste with a remark, not a goal sentence. */
export const MAX_GOAL_PROMPT_CHARS = 1500;

/**
 * Above this length a line is prose about something else that happens to carry
 * the phrase. It also bounds the per-prompt line under the session-register
 * concern's registered byte budget, so a long line is skipped, never truncated.
 */
export const MAX_GOAL_LINE_CHARS = 300;

export function isSyntheticTurn(text: string): boolean {
    const head = text.trimStart();
    return isSyntheticPrompt(text) || SYNTHETIC_PREFIXES.some((p) => head.startsWith(p));
}

/**
 * The owner's own prose lines: the human-authored lead (host regions stripped,
 * cut at the first pasted document), without fenced blocks, quoted lines and
 * indented lines — pasted material such as logs, tool output or a quoted chat.
 */
export function ownerProseLines(text: string): string[] {
    const out: string[] = [];
    let inFence = false;
    for (const line of humanAuthoredLead(stripInjectedRegions(text)).split('\n')) {
        if (/^\s*(?:```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        if (/^\s*>/.test(line)) continue;
        if (/^(?: {4}|\t)/.test(line)) continue;
        if (line.trim() === '') continue;
        out.push(line);
    }
    return out;
}

/**
 * A goal line read as an instruction, not a mention: a question or a negated
 * line is dropped, and quoted or backticked spans are removed before matching. Only the goal side
 * filters — a revocation that over-matches ends a goal and costs a re-ask, the
 * safe direction, so revocations match on the whole line.
 */
function instructionText(line: string): string | null {
    // A question, a negated line ("don't keep working until merged") or reported
    // speech ("the docs say …") is not the owner's request; a goal missed this
    // way costs one re-ask.
    if (line.endsWith('?')) return null;
    if (/\b(?:nicht|kein\w*|nie|niemals|never|not|says?|said|sagt|sagte|schreibt|schrieb|meint|meinte|wrote|writes|according)\b|\bdon['’]?t\b/i.test(line)) return null;
    const probe = line.replace(/"[^"]*"|“[^”]*”|„[^“”]*[“”]|`[^`]*`/g, ' ').replace(/^[^A-Za-zÄÖÜäöü]+/, '');
    // A direct request opens with the goal phrase itself or a request word; a
    // mention opens with its subject ("the checklist mentions …").
    return GOAL_PATTERNS.some((re) => probe.search(re) === 0) || REQUEST_OPENER.test(probe) ? probe : null;
}

function proseMatches(text: string, patterns: readonly RegExp[], asInstruction: boolean): string | null {
    // The paste cap binds the goal side only: a `stop` above a long paste is
    // still the owner's revocation.
    if (isSyntheticTurn(text) || (asInstruction && text.length > MAX_GOAL_PROMPT_CHARS)) return null;
    for (const line of ownerProseLines(text)) {
        const trimmed = line.trim();
        // The line cap binds the goal side only; a long stop line still revokes
        // and is kept to the cap's length.
        if (asInstruction && trimmed.length > MAX_GOAL_LINE_CHARS) continue;
        const probe = asInstruction ? instructionText(trimmed) : trimmed;
        if (probe !== null && patterns.some((re) => re.test(probe))) return trimmed.slice(0, MAX_GOAL_LINE_CHARS);
    }
    return null;
}

/** The owner prose line carrying a goal phrase as an instruction, or null. */
export function goalSentenceIn(text: string): string | null {
    return proseMatches(text, GOAL_PATTERNS, true);
}

/** The owner prose line revoking a goal, or null. */
export function revocationIn(text: string): string | null {
    return proseMatches(text, REVOKE_PATTERNS, false);
}

export function isGoalSentence(text: string): boolean {
    return goalSentenceIn(text) !== null;
}

export function isRevocation(text: string): boolean {
    return revocationIn(text) !== null;
}

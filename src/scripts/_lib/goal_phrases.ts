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

/** Owner sentences that end a recorded goal. */
export const REVOKE_PATTERNS: readonly RegExp[] = [
    /^\s*(?:stop|stopp|halt)\s*(?:[.!,;:]|$)/i,
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
 * A goal line read as an instruction, not a mention: a question is dropped, and
 * quoted or backticked spans are removed before matching. Only the goal side
 * filters — a revocation that over-matches ends a goal and costs a re-ask, the
 * safe direction, so revocations match on the whole line.
 */
function instructionText(line: string): string | null {
    if (line.endsWith('?')) return null;
    return line.replace(/"[^"]*"|“[^”]*”|„[^“”]*[“”]|`[^`]*`/g, ' ');
}

function proseMatches(text: string, patterns: readonly RegExp[], asInstruction: boolean): string | null {
    if (isSyntheticTurn(text) || text.length > MAX_GOAL_PROMPT_CHARS) return null;
    for (const line of ownerProseLines(text)) {
        const trimmed = line.trim();
        if (trimmed.length > MAX_GOAL_LINE_CHARS) continue;
        const probe = asInstruction ? instructionText(trimmed) : trimmed;
        if (probe !== null && patterns.some((re) => re.test(probe))) return trimmed;
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

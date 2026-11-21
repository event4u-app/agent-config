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
    /^\s*(?:stop|stopp|halt)\b/i,
    /\bnicht\s+mergen\b/i,
    /\bkein(?:en)?\s+merge\b/i,
    /\b(?:don'?t|do\s+not)\s+merge\b/i,
];

/**
 * Harness-written user-role turns. They are not the owner typing, so a goal
 * phrase inside one (a slash-command body, a task notification) records nothing.
 */
const SYNTHETIC_PREFIXES: readonly string[] = [
    '<command-name>',
    '<command-message>',
    '<command-args>',
    '<task-notification>',
    '<system-reminder>',
    '<local-command-',
    '<bash-input>',
    '<bash-stdout>',
    '<bash-stderr>',
    '<user-prompt-submit-hook>',
    '[Request interrupted',
    'Caveat:',
    'This session is being continued from a previous conversation',
];

/** Above this length a prompt is a paste with a remark, not a goal sentence. */
export const MAX_GOAL_PROMPT_CHARS = 1500;

export function isSyntheticTurn(text: string): boolean {
    const head = text.trimStart();
    return SYNTHETIC_PREFIXES.some((p) => head.startsWith(p));
}

/**
 * The owner's own prose lines: fenced blocks, quoted lines and indented lines
 * are pasted material (logs, tool output, a quoted chat) and are dropped.
 */
export function ownerProseLines(text: string): string[] {
    const out: string[] = [];
    let inFence = false;
    for (const line of text.split('\n')) {
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

function proseMatches(text: string, patterns: readonly RegExp[]): string | null {
    if (isSyntheticTurn(text) || text.length > MAX_GOAL_PROMPT_CHARS) return null;
    for (const line of ownerProseLines(text)) {
        if (patterns.some((re) => re.test(line))) return line.trim();
    }
    return null;
}

/** The owner prose line carrying a goal phrase, or null. */
export function goalSentenceIn(text: string): string | null {
    return proseMatches(text, GOAL_PATTERNS);
}

/** The owner prose line revoking a goal, or null. */
export function revocationIn(text: string): string | null {
    return proseMatches(text, REVOKE_PATTERNS);
}

export function isGoalSentence(text: string): boolean {
    return goalSentenceIn(text) !== null;
}

export function isRevocation(text: string): boolean {
    return revocationIn(text) !== null;
}

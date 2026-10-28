/**
 * Detector `capitulation` for `turn-end-gate` (road-to-a-challenge-the-bench-has-measured
 * 3.2). It fires when the user's prompt is a bare challenge carrying no new
 * material, the closing reply concedes the stance of the reply before that
 * prompt, and the turn made no tool call: an answer changed with nothing
 * checked.
 *
 * Advisory, counts-only and default-off (decision H1, AI council 2026-10-27,
 * 2/2: counting firings cannot establish precision, so it runs only where
 * `AGENT_CONFIG_CAPITULATION_COUNT=1` is set). The gate never refuses on it; a
 * firing appends one line to a local per-session file beside the refusal
 * records, which the refusal-state pruner ages out, and no prompt or reply text
 * is stored. Promotion goes through `docs/contracts/turn-end-detector-demotion.md`.
 *
 * It fires on NOT CHECKING, never on changing: a reply that keeps its answer,
 * and a reply that changes it after a tool call, are both silent. Its remedy,
 * stated in the demotion contract, names both outcomes ("check first, then keep
 * or change the answer and say why") so the count is never a push toward holding.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Bare pushback: short, opening on a challenge word, with no code, link, digit
 * or quotation. The closing check is lexical — it detects an unchecked
 * concession phrase, not a proven change of stance; "you're right to ask" is
 * excluded, a concession on a detail is not, and that is a known false positive.
 */
const CHALLENGE = /^\W*(no|nope|nein|wrong|incorrect|are you sure|falsch|stimmt nicht|bist du sicher)\b/i;
const CONCESSION = /\b(you'?re (absolutely )?right|you are right|du hast recht)\b(?! to)|\b(i apologi[sz]e|my (mistake|apologies)|i was wrong|i stand corrected)\b/i;

export function detectCapitulation(prompt: string, previousAssistant: string, closing: string, toolCalls: number): boolean {
    return toolCalls === 0 && previousAssistant !== '' && prompt.length <= 200 && !/`|https?:|\d|"/.test(prompt) && CHALLENGE.test(prompt) && CONCESSION.test(closing);
}

/**
 * The gate's one call. Opt-in via `AGENT_CONFIG_CAPITULATION_COUNT=1`; a firing
 * appends `{"turn":N}` to `<session>.advisory.jsonl` beside the refusal record.
 * Append-only, so two concurrent stops cannot lose each other's line; a repeat
 * of the turn already last in the file is skipped, and a reader counts DISTINCT
 * turns, so a duplicate written by a race still counts once. `turnOrdinal` is
 * counted over the whole transcript (a transcript over the read cap yields no
 * tail at all, and so no firing). Never throws.
 */
export function maybeCountCapitulation(
    refusalFile: string,
    t: { lastUserPrompt: string; previousAssistant: string; lastAssistant: string; toolCalls: readonly unknown[]; turnOrdinal: number },
): void {
    if (process.env['AGENT_CONFIG_CAPITULATION_COUNT'] !== '1') return;
    if (!detectCapitulation(t.lastUserPrompt.trim(), t.previousAssistant, t.lastAssistant, t.toolCalls.length)) return;
    const file = refusalFile.replace(/\.json$/, '.advisory.jsonl');
    const line = `{"turn":${String(t.turnOrdinal)}}`;
    try {
        let prev = '';
        try {
            prev = fs.readFileSync(file, 'utf-8');
        } catch {
            // absent: the first line
        }
        if (prev.trimEnd().endsWith(line)) return;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, `${line}\n`);
    } catch {
        // an instrument never changes what the gate does
    }
}

/** Distinct turns recorded in an advisory file — the count a reader reports. */
export function countedTurns(text: string): number {
    return new Set(text.split('\n').filter((l) => l.trim() !== '')).size;
}

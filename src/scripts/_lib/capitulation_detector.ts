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
 * firing adds one to a local per-session counter beside the refusal records,
 * which the refusal-state pruner ages out, and no prompt or reply text is
 * stored. Promotion goes through `docs/contracts/turn-end-detector-demotion.md`.
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
 * adds one to `<session>.advisory.json` beside the refusal record. Never throws.
 */
export function maybeCountCapitulation(
    refusalFile: string,
    t: { lastUserPrompt: string; previousAssistant: string; lastAssistant: string; toolCalls: readonly unknown[]; turnOrdinal: number },
): void {
    if (process.env['AGENT_CONFIG_CAPITULATION_COUNT'] !== '1') return;
    if (!detectCapitulation(t.lastUserPrompt.trim(), t.previousAssistant, t.lastAssistant, t.toolCalls.length)) return;
    const file = refusalFile.replace(/\.json$/, '.advisory.json');
    try {
        let prev: { capitulation?: number; last_turn?: number } = {};
        try {
            prev = JSON.parse(fs.readFileSync(file, 'utf-8')) as typeof prev;
        } catch {
            // absent or unreadable: a fresh count
        }
        // One count per turn: a repeated stop delivery for the same turn adds nothing.
        if (prev.last_turn === t.turnOrdinal) return;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        // Write-then-rename, so a reader never sees a half-written file.
        fs.writeFileSync(`${file}.tmp`, `${JSON.stringify({ capitulation: (prev.capitulation ?? 0) + 1, last_turn: t.turnOrdinal })}\n`);
        fs.renameSync(`${file}.tmp`, file);
    } catch {
        // an instrument never changes what the gate does
    }
}

/**
 * Detector `capitulation` for `turn-end-gate` (road-to-a-challenge-the-bench-has-measured
 * 3.2). It fires when the user's prompt is a bare challenge carrying no new
 * material, the closing reply concedes the stance of the reply before that
 * prompt, and the turn made no tool call: an answer changed with nothing
 * checked.
 *
 * Advisory, counts-only and default-off (decision H1, AI council 2026-10-27,
 * 2/2): it runs only where `AGENT_CONFIG_CAPITULATION_COUNT=1` is set, and it
 * ships in its own chunk, read through `loadLazyExport` (`hooks/lazy_concern.ts`),
 * so the dispatch bundle every hook event loads carries the opt-in check and one
 * table row. The
 * gate never refuses on it; a firing appends one line to a local per-session
 * file beside the refusal records, which the refusal-state pruner ages out, and
 * no prompt or reply text is stored.
 *
 * It fires on NOT CHECKING, never on changing: a reply that keeps its answer,
 * and a reply that changes it after a tool call, are both silent. Its remedy,
 * stated in `docs/contracts/turn-end-detector-demotion.md`, names both outcomes
 * ("check first, then keep or change the answer and say why").
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { readPromptPair } from './turn_end_transcript.js';

/**
 * The date by which G is promoted with a registered bar or removed. Mirrors the
 * roadmap's `review_by`; `tests/scripts/capitulation_detector.test.ts` fails
 * after it unless `CAPITULATION_BAR` is set, so the cost cannot outlive the
 * decision silently.
 */
export const CAPITULATION_SUNSET = '2027-01-31';

/** A registered precision bar, once a promotion sets one. `null`: none yet. */
export const CAPITULATION_BAR: number | null = null;

const CHALLENGE = /^(no|nope|nah|nein|wrong|incorrect|false|falsch|are you sure|bist du sicher|stimmt nicht|that's wrong|that is wrong|das stimmt nicht)\b/;

/**
 * The only words a bare challenge may carry after its opening phrase. A closed
 * set, not a length limit: round 4 of the bundle ratification refused a
 * predicate that let a claim follow the challenge word ("no, the capital is
 * Canberra"), which is new material and so not bare pushback.
 */
const TAIL_WORDS = new Set([
    'i', 'think', 'dont', 'don', 't', 'believe', 'so', 'that', 'thats', 'is', 'its', 'it', 'not', 'right', 'correct',
    'wrong', 'incorrect', 'false', 'you', 'youre', 're', 'are', 'sure', 'really', 'please', 'check', 'again',
    'about', 'reconsider', 'try', 'ich', 'glaube', 'nicht', 'das', 'ist', 'falsch', 'stimmt', 'du', 'bist', 'sicher',
    'wirklich', 'nochmal', 'bitte', 'überleg', 'ueberleg', 'nein', 'no', 'nope', 'hmm', 'hm', 'what', 'was',
]);
const MAX_TAIL_WORDS = 8;

/** Any link form, digit, code span or quotation mark; an apostrophe inside a word is allowed. */
const MATERIAL = /https?:|:\/\/|www\.|mailto:|\]\(|[`\d"“”„‘’«»]|(^|[^\p{L}])'|'(?![\p{L}])/u;

export const CONCESSION = /\b(you'?re (absolutely )?right|you are right|du hast recht)\b(?! to)|\b(i apologi[sz]e|my (mistake|apologies)|i was wrong|i stand corrected)\b/i;

/** Whether a prompt is bare pushback: a challenge phrase, a short tail from the closed set, no material. */
export function isBareChallenge(prompt: string): boolean {
    const p = prompt.trim().toLowerCase();
    if (p === '' || p.length > 120 || MATERIAL.test(p)) return false;
    const opened = p.replace(/^[^\p{L}]+/u, '');
    const m = CHALLENGE.exec(opened);
    if (!m) return false;
    const tail = opened.slice(m[0].length).replace(/'/g, '').split(/[^\p{L}]+/u).filter((w) => w !== '');
    return tail.length <= MAX_TAIL_WORDS && tail.every((w) => TAIL_WORDS.has(w));
}

export function detectCapitulation(prompt: string, previousAssistant: string, closing: string, toolCalls: number): boolean {
    return toolCalls === 0 && previousAssistant !== '' && isBareChallenge(prompt) && CONCESSION.test(closing);
}

/**
 * The gate's one call, reached only through `loadLazyExport` and only when the
 * env flag is set. It reads the prompt pair itself (`readPromptPair`), so the
 * bundle carries neither the reader nor the two fields. A firing appends `{"turn":N}` to `<session>.advisory.jsonl`
 * beside the refusal record. Append-only, so two concurrent stops cannot lose
 * each other's line; a repeat of the turn already last in the file is skipped,
 * and a reader counts DISTINCT turns, so a duplicate written by a race still
 * counts once. Never throws.
 */
export function maybeCountCapitulation(
    refusalFile: string,
    t: { transcriptPath: string; lastAssistant: string; toolCalls: readonly unknown[]; turnOrdinal: number },
    maxBytes: number,
): void {
    // A turn with a tool call cannot fire, so the transcript is read only when it might.
    if (t.toolCalls.length > 0) return;
    const pair = readPromptPair(t.transcriptPath, { maxBytes });
    if (!detectCapitulation(pair.lastUserPrompt, pair.previousAssistant, t.lastAssistant, 0)) return;
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
    const turns = new Set<number>();
    for (const line of text.split('\n')) {
        try {
            const turn = (JSON.parse(line) as { turn?: unknown }).turn;
            if (typeof turn === 'number' && Number.isInteger(turn)) turns.add(turn);
        } catch {
            // not a record line
        }
    }
    return turns.size;
}

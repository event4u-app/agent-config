/**
 * Ratification prompts, checked before a single seat is paid. The record writer
 * (`_lib/ratification_record_writer.ts`) derives each seat's verdict from its
 * closing stance line only; 24 rounds on PR #3005 asked for `VERDICT:` instead
 * and produced no record. Kept out of `council_cli.ts`, which is over the source
 * size ceiling.
 */
import * as fs from 'node:fs';

/** The record writer's own subject declaration: one line, the digest alone. */
const RATIFICATION_SUBJECT_LINE = /^`?subject: [0-9a-f]{64}`?\s*$/gmu;
export const RATIFICATION_LABELS = ['ratified', 'confirmed-non-expanding', 'refused'] as const;
export const RATIFICATION_STANCE_CONTRACT = `Close your reply with EXACTLY this line, and nothing after it:
STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no
Use one of the three labels exactly as written; no other label is recorded.
This line replaces any other closing format named earlier (APPROVE / REQUEST_CHANGES, a Top-N list, a findings block).`;

/** A prompt that declares exactly one `subject:` line is a ratification prompt (ratification_record_writer.ts). */
export function isRatificationPrompt(text: string): boolean {
    return [...text.matchAll(RATIFICATION_SUBJECT_LINE)].length === 1;
}

/**
 * Why a ratification prompt cannot produce a record, or null. The record writer
 * derives each seat's verdict from its closing stance line only; 24 rounds that
 * asked for `VERDICT:` instead produced no record at all (PR #3005).
 */
export function ratificationPromptProblem(text: string): string | null {
    if (!isRatificationPrompt(text)) return null;
    const stance = text.split('\n').find((l) => /STANCE:/u.test(l) && /DEALBREAKER:/u.test(l));
    if (stance === undefined) {
        return 'a ratification prompt (it declares a `subject:` line) must ask every seat to close on ' +
            '`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>` — ' +
            'the record writer reads nothing else, so any other closing line yields no record';
    }
    const missing = RATIFICATION_LABELS.filter((l) => !new RegExp(`(^|[^a-z-])${l}([^a-z-]|$)`, 'u').test(stance));
    if (missing.length > 0) return `the stance line of this ratification prompt does not offer ${missing.map((m) => `\`${m}\``).join(', ')}`;
    return null;
}

/** Read a `--input-mode prompt` question once: is it a ratification prompt, and can it produce a record. */
export function readRatificationPrompt(inputMode: unknown, questionPath: unknown): { problem: string | null; ratification: boolean } {
    const text = inputMode === 'prompt' && typeof questionPath === 'string' ? fs.readFileSync(questionPath, 'utf-8') : '';
    return { problem: ratificationPromptProblem(text), ratification: isRatificationPrompt(text) };
}

/**
 * The consult options a ratification run adds: a seat must close on one of the
 * record writer's labels, because `abstain` or an invented label is a paid round
 * that yields no record. The same contract closes the final round, so the seat
 * is handed one closing format (2026-11-23: the codex seat closed on
 * `REQUEST_CHANGES`); see also `ratificationInlineFindings`.
 */
export function ratificationRepairOptions(ratification: boolean): {
    stance_repair_contract: string | null;
    stance_label_accepted: ((label: string) => boolean) | null;
} {
    if (!ratification) return { stance_repair_contract: null, stance_label_accepted: null };
    return {
        stance_repair_contract: RATIFICATION_STANCE_CONTRACT,
        stance_label_accepted: (label) => (RATIFICATION_LABELS as readonly string[]).includes(label.trim().toLowerCase()),
    };
}

/**
 * The one inline-findings predicate for a run: the prompt asks for the block
 * and the harvest reads it exactly when this is true. A ratification run drops
 * the block, which would otherwise be a second closing format after the stance.
 */
export function ratificationInlineFindings(active: boolean, ratification: boolean): boolean {
    return active && !ratification;
}

/**
 * Phase 1 stance repair, out of `orchestrator.ts` so that file does not grow:
 * one bounded stance-line-only re-prompt per member whose final reply lacks a
 * usable STANCE line. The re-prompt goes through the caller's `runOne`, which is
 * `_run_round` (spend gate, ledger and stamping unchanged). A repaired line is
 * APPENDED to the member's final text so the deterministic tally can read it.
 */
import type { CliClient, CouncilResponse, ExternalAIClient } from './clients.js';
import { CouncilQuestion } from './orchestrator_results.js';
import { STANCE_LINE_CONTRACT } from './prompts.js';
import { QUOTA_EXHAUSTED, QUOTA_EXHAUSTED_MARK } from './quota_carry.js';
import { parse_stance_line } from './stance_tally.js';

export interface StanceRepairOptions {
    /**
     * Phase 1 stance-repair transport (2026-07-12 council policy): confirm per
     * member in interactive runs; `null`/absent → a missing/unparseable stance
     * stays a repair-marker in the tally, never an unplanned billable call.
     */
    on_stance_repair?: ((member: string) => boolean) | null;
    /** Receives each stance-repair response so the caller can account its cost. */
    on_stance_repair_result?: ((r: CouncilResponse) => void) | null;
    /** The contract a repair re-prompt asks for; absent → the generic `STANCE_LINE_CONTRACT`. */
    stance_repair_contract?: string | null;
    /**
     * Which stance labels count as an answer. A parseable line whose label this
     * rejects is repaired like a missing one, and a repair that returns such a
     * label is not appended. Absent → every parseable label counts.
     */
    stance_label_accepted?: ((label: string) => boolean) | null;
}

export function repairStances(
    results: CouncilResponse[],
    members: readonly ExternalAIClient[],
    question: CouncilQuestion,
    opts: StanceRepairOptions,
    exhausted: ReadonlySet<string>,
    runOne: (member: ExternalAIClient, q: CouncilQuestion) => CouncilResponse[],
): void {
    const on_stance_repair = opts.on_stance_repair ?? null;
    if (on_stance_repair === null) return;
    const accepted = opts.stance_label_accepted ?? null;
    const usable = (text: string): boolean => {
        const line = parse_stance_line(text);
        return line !== null && (accepted === null || accepted(line.label));
    };
    for (let i = 0; i < results.length; i++) {
        const r = results[i] as CouncilResponse;
        if (r.error !== null || r.text.trim() === '' || usable(r.text)) continue;
        const member = members[i];
        if (member === undefined || exhausted.has(member.name) || !on_stance_repair(member.name)) continue;
        const repairQ = new CouncilQuestion({
            mode: question.mode,
            user_prompt:
                `Your reply is missing the mandatory closing stance line. ` +
                `Reply with ONLY that single line for your final position.\n\n${opts.stance_repair_contract ?? STANCE_LINE_CONTRACT}`,
            max_tokens: question.max_tokens,
        });
        // Stance repair shares the invocation-wide ledger: transport health and
        // structural validity are INDEPENDENT failure modes, so refusing the retry
        // would discard salvageable work for an unrelated reason. Bounded by the
        // retry's own spend gate. Non-blind: the seat is asked about its own reply,
        // so it continues the session that wrote it.
        const seat = member as Partial<Pick<CliClient, 'lastSession' | 'resumeNext'>>;
        if (seat.lastSession !== undefined) seat.resumeNext = seat.lastSession;
        let rr: CouncilResponse[];
        try {
            rr = runOne(member, repairQ);
        } finally {
            if (seat.resumeNext !== undefined) seat.resumeNext = null; // a quota gate or refusal returns before the seat clears it
        }
        const rep = rr[0];
        if (rep?.error === QUOTA_EXHAUSTED) r.metadata[QUOTA_EXHAUSTED_MARK] = true; // answer stands; peer review skips the seat
        if (rep !== undefined) {
            opts.on_stance_repair_result?.(rep);
            if (rep.error === null && usable(rep.text)) r.text = `${r.text.trim()}\n\n${rep.text.trim()}`;
        }
    }
}

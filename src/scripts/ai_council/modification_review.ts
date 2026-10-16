/**
 * modification_review — the review verb for a diff whose bundle contains a
 * gated path: how a seat closes, and how the record's verdict follows.
 *
 * `road-to-self-modification-that-a-council-must-pass` steps 3.2 and 3.3.
 *
 * WHY THE EXISTING STANCE PARSER AND NOT A NEW ONE. Seats already close on a
 * `STANCE: … | CONFIDENCE: … | DEALBREAKER: …` line, and `stance_tally` already
 * parses it — including the two cosmetic defects it forgives. A second grammar
 * for the same closing line would be a second thing to keep in step with the
 * prompt, and the first time they diverged a seat's verdict would be read by
 * one and dropped by the other.
 *
 * WHAT IS DELIBERATELY NOT USED. Not the option tally, and not the synthesis
 * verdict line. Both answer which OPTION wins a deliberation; this review asks
 * whether each SEAT passed a change, which is a different question over the
 * same replies. Nor is the diff lens's own closing line asked for — a lens is
 * not a seat.
 *
 * WHY A VERB OF ITS OWN HERE RATHER THAN AN `agent-config` COMMAND. The CLI
 * help-count budget is at its maximum (`cli_help_command_count` in
 * `src/config/evaluator-budgets.json`), so a new top-level verb would spend a
 * ratchet this change has no claim on. It dispatches inside `council_cli`.
 */

import { parse_stance_line } from './stance_tally.js';
import {
    SEAT_NO_FINAL_VERDICT,
    deriveRatificationHeader,
    type RatificationVerdict,
    type SeatVerdict,
} from '../_lib/ratification_artifact.js';

/**
 * The closed vocabulary a seat may close on. Open it and a grep for a passing
 * verdict starts reading words nobody adjudicated — the failure
 * `ratification-artifact.md` names for its own `verdict` field.
 */
export const MODIFICATION_VERDICT_LABELS = [
    'ratified',
    'confirmed-non-expanding',
    'refused',
] as const;

export type ModificationVerdictLabel = (typeof MODIFICATION_VERDICT_LABELS)[number];

/** The record's verdict: a seat label, or the one value no seat may utter. */
export type ModificationVerdict = ModificationVerdictLabel | 'non-convergent';

/**
 * Read ONE seat's reply. Returns its label when the seat concluded, `null`
 * otherwise — a missing line, an abstention, or any other label.
 *
 * `null` is never inferred from surrounding prose: a seat that writes
 * "I would call this ratified" has not closed on a stance line, and reading it
 * as a conclusion is how a review starts reporting verdicts nobody gave.
 */
export function seatConclusion(text: string): ModificationVerdictLabel | null {
    const line = parse_stance_line(text);
    if (line === null) return null;
    const label = line.label.trim().toLowerCase();
    return (MODIFICATION_VERDICT_LABELS as readonly string[]).includes(label)
        ? (label as ModificationVerdictLabel)
        : null;
}

/**
 * Read every seat, keeping the non-concluding ones present and `null` rather
 * than dropping them. A dropped seat is indistinguishable from a seat that was
 * never asked, and the quorum rule below has to tell those apart.
 */
export function readSeatConclusions(
    replies: Readonly<Record<string, string>>,
): Record<string, ModificationVerdictLabel | null> {
    const out: Record<string, ModificationVerdictLabel | null> = {};
    for (const [seat, text] of Object.entries(replies)) {
        out[seat] = seatConclusion(text);
    }
    return out;
}

/**
 * Derive the review's DISPOSITION — never the artifact's `verdict` field.
 *
 * For one seat `ratified` and another without a final verdict this returns
 * `non-convergent`, while the reader's `deriveRatificationHeader` returns
 * `ratified` with one provider — and a record carrying this answer is refused by
 * the reader's `header-not-derived` check. `seats:` is evidence and the header is
 * derived from it, so a policy count must not relabel it: the reader alone
 * decides what a record SAYS, quorum stays a separate validation, and this result
 * decides what the run does next. {@link deriveModificationOutcome} returns both
 * under different names.
 *
 * ONE rule, and the ORDER is the rule:
 *
 *   1. any concluding seat on `refused`  → `refused`
 *   2. concluding providers < required   → `non-convergent`
 *   3. any concluding seat on `ratified` → `ratified`
 *   4. otherwise (all concluded, all non-expanding) → `confirmed-non-expanding`
 *
 * Step 1 precedes step 2 on purpose. A single refusing seat is a refusal even
 * when it is the only seat that concluded: letting the quorum rule fire first
 * would turn "one reviewer said no" into "not enough reviewers answered", which
 * reads as a retryable condition rather than as the objection it is.
 */
export function deriveModificationVerdict(
    seats: Readonly<Record<string, ModificationVerdictLabel | null>>,
    requiredProviders: number,
): ModificationVerdict {
    const concluded = Object.values(seats).filter(
        (v): v is ModificationVerdictLabel => v !== null,
    );
    if (concluded.includes('refused')) return 'refused';
    if (concluded.length < requiredProviders) return 'non-convergent';
    if (concluded.includes('ratified')) return 'ratified';
    return 'confirmed-non-expanding';
}

/**
 * What a run does next. Never written into the artifact. A refusal and a short
 * quorum stay apart because only the second is cured by asking again.
 */
export type ModificationDisposition = 'accepted' | 'refused' | 'quorum-short';

export interface ModificationOutcome {
    /** The header the record carries, from the one canonical derivation. */
    header: { providers: string[]; verdict: RatificationVerdict };
    /** Whether enough distinct providers concluded. */
    quorumSatisfied: boolean;
    disposition: ModificationDisposition;
}

/**
 * Both answers from one call, so a caller cannot take the orchestration answer
 * and write it into the record.
 */
export function deriveModificationOutcome(
    seats: Readonly<Record<string, ModificationVerdictLabel | null>>,
    requiredProviders: number,
): ModificationOutcome {
    const asSeatVerdicts: Record<string, SeatVerdict> = {};
    for (const [seat, label] of Object.entries(seats)) {
        asSeatVerdicts[seat] = label ?? SEAT_NO_FINAL_VERDICT;
    }
    const header = deriveRatificationHeader(asSeatVerdicts);
    const quorumSatisfied = new Set(header.providers).size >= requiredProviders;
    const verdict = deriveModificationVerdict(seats, requiredProviders);
    let disposition: ModificationDisposition;
    if (verdict === 'refused') disposition = 'refused';
    else if (!quorumSatisfied || verdict === 'non-convergent') disposition = 'quorum-short';
    else disposition = 'accepted';
    return { header, quorumSatisfied, disposition };
}

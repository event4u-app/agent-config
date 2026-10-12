/**
 * ratification_record_writer — turn the session record of a modification review
 * into the ratification artifact, rather than letting an agent type one.
 *
 * `road-to-self-modification-that-a-council-must-pass` step 3.4. Before this,
 * every field of a record was prose: `reviewed_by` appeared in 19 spellings
 * across 22 records, `providers` was whoever the author listed, and the verdict
 * was typed by the agent that wrote the diff. The six fields were a FORM, and a
 * form is filled in by the party it exists to constrain.
 *
 * WHAT THIS DOES NOT CLAIM, first, because the rest reads stronger than it is.
 * The seats this is handed are themselves supplied by the caller, and council
 * responses are gitignored and pruned, so nothing on a runner can check that a
 * review happened at all. What derivation buys is narrower and real: given the
 * seats, no field is a judgement the writer could shade — the header is
 * computed, the digest is computed, the reviewer's spelling is fixed, and a
 * record this writer produces is read back through the canonical reader before
 * it is returned.
 *
 * THE HEADER COMES FROM ONE PLACE, AND WHICH PLACE WAS A COUNCIL DECISION.
 * A 2/2 convergent council (anthropic + openai, 2026-10-12, design mode,
 * 2 rounds, blind peer review, $0.00 on subscription seats) settled the
 * contradiction step 3.4 stopped on: `deriveRatificationHeader` is the sole
 * authority over what a record SAYS, quorum stays a separate validation, and
 * the review's own `deriveModificationVerdict` drives orchestration instead.
 * Both seats then asked for the same safeguard, which is the round-trip below:
 * a writer that emits a record the canonical reader refuses must halt rather
 * than hand back a file somebody will later try to land.
 */

import {
    RATIFICATION_FIELDS,
    SEAT_NO_FINAL_VERDICT,
    deriveRatificationHeader,
    isRatified,
    readRatification,
    renderRatificationHeader,
    type SeatVerdict,
} from './ratification_artifact.js';
import {
    MODIFICATION_REVIEW_QUESTIONS,
    type ModificationReviewQuestion,
} from '../ai_council/modification_review_questions.js';

/** One seat's contribution: its final verdict and its answers, keyed by id. */
export interface ReviewSeat {
    verdict: SeatVerdict;
    /** Answer text per `MODIFICATION_REVIEW_QUESTIONS` id. */
    answers: Readonly<Record<string, string>>;
}

export interface ReviewSession {
    /** Seat provider id → that seat's final verdict and answers. */
    seats: Readonly<Record<string, ReviewSeat>>;
    proposed_by: string;
    implemented_by: string;
    /**
     * The digest of the gated content reviewed, from
     * `check_kernel_edit_ratified.expectedSubjectFor`.
     *
     * Passed IN rather than computed here: the writer must not become a second
     * place that decides which files are gated, and asking the gate is the
     * whole point of that helper being exported.
     */
    subject: string;
    /** `merge`, or an ISO-8601 instant. */
    effective_after?: string;
    /** What the change is, for the record's body. One or two sentences. */
    summary: string;
}

/**
 * The ONE spelling of the reviewer.
 *
 * 22 of 23 records on the trunk name a council in `reviewed_by`, in 19
 * different spellings — which makes the field unreadable by anything but a
 * human, and unsearchable even by one. The seats that answered are already in
 * `providers` and `seats:`, so this field carries the KIND of reviewer and
 * nothing that is recorded elsewhere.
 */
export const REVIEWER_SPELLING = 'ai-council';

export class RatificationWriteRefused extends Error {}

/** `verdict` → the line a reader meets first in the body. */
function verdictGloss(verdict: string): string {
    switch (verdict) {
        case 'ratified':
            return 'An authority-expanding change, approved by the seats that concluded.';
        case 'confirmed-non-expanding':
            return 'Every concluding seat found no authority expansion in this change.';
        case 'refused':
            return 'At least one seat refused the change. This record does not let it land.';
        default:
            return 'The review did not converge. This record does not let the change land.';
    }
}

function answerBlock(
    seatId: string,
    seat: ReviewSeat,
    questions: readonly ModificationReviewQuestion[],
): string[] {
    const lines = [`### ${seatId} — \`${seat.verdict}\``, ''];
    for (const q of questions) {
        const answer = seat.answers[q.id];
        lines.push(`**${q.id}** — ${q.text}`);
        lines.push('');
        // A question a seat did not answer is RECORDED as unanswered rather
        // than omitted. Omission makes a nine-question review and a
        // three-question one look identical to a later reader, which is the
        // "the questions become a form the seats fill" risk the roadmap names.
        lines.push(
            answer === undefined || answer.trim() === ''
                ? '> _(no answer recorded for this question)_'
                : answer.trim(),
        );
        lines.push('');
    }
    return lines;
}

/**
 * Render the artifact. Throws {@link RatificationWriteRefused} when the result
 * would not read back as a valid record for `subject`.
 *
 * `requiredProviders` is the policy's count, used only for the round-trip: the
 * writer never withholds a record because quorum was short. A quorum-short
 * review produces a record that says what the seats said and fails the gate's
 * diversity rule, which is the council's resolution and is also the only shape
 * in which the owner can see WHAT the one seat concluded.
 */
export function renderRatificationRecord(
    session: ReviewSession,
    requiredProviders: number,
    questions: readonly ModificationReviewQuestion[] = MODIFICATION_REVIEW_QUESTIONS,
): string {
    const seatVerdicts: Record<string, SeatVerdict> = {};
    for (const [id, seat] of Object.entries(session.seats)) {
        seatVerdicts[id] = seat.verdict;
    }
    if (Object.keys(seatVerdicts).length === 0) {
        throw new RatificationWriteRefused(
            'a review with no seats is not a review — nothing to derive a header from',
        );
    }

    const { verdict } = deriveRatificationHeader(seatVerdicts);
    const effective = session.effective_after ?? 'merge';

    const body = [
        '---',
        `proposed_by: ${session.proposed_by}`,
        `implemented_by: ${session.implemented_by}`,
        `reviewed_by: ${REVIEWER_SPELLING}`,
        `subject: ${session.subject}`,
        renderRatificationHeader(seatVerdicts),
        `effective_after: ${effective}`,
        '---',
        '',
        '<!-- evidence-type: ratification -->',
        '',
        '# Modification review',
        '',
        session.summary.trim(),
        '',
        verdictGloss(verdict),
        '',
        `Derived, not typed: \`providers\`, \`verdict\` and \`seats:\` come from `
            + `\`deriveRatificationHeader\`, and \`subject\` from the gate's own `
            + '`expectedSubjectFor`. What this does not establish is that the review '
            + 'happened — the seats below are the caller’s, and council responses are '
            + 'gitignored and pruned, so no runner can check them.',
        '',
        '## What each seat answered',
        '',
    ];

    for (const [id, seat] of Object.entries(session.seats)) {
        body.push(...answerBlock(id, seat, questions));
    }

    const text = `${body.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;

    // The round trip both council seats asked for. A writer that emits a record
    // the canonical reader refuses has produced a file somebody will try to
    // land; failing here costs one exception and failing there costs a red CI
    // run on a record nobody can tell apart from a stale one.
    const reading = readRatification(text, requiredProviders, session.subject);
    const structural = reading.problems.filter(
        (p) => p.code !== 'diversity-required' && p.code !== 'diversity-unverifiable',
    );
    if (structural.length > 0) {
        throw new RatificationWriteRefused(
            `the record this writer produced does not read back as valid: ${structural
                .map((p) => `${p.code} (${p.message})`)
                .join('; ')}`,
        );
    }
    return text;
}

/**
 * Would the record this session produces let the change land?
 *
 * Separate from {@link renderRatificationRecord} on purpose: a non-passing
 * record is still WRITTEN, because the escalation the owner answers needs the
 * record in front of it. This is the question "may it land", never "may it be
 * written".
 */
export function recordWouldPass(session: ReviewSession, requiredProviders: number): boolean {
    const text = renderRatificationRecord(session, requiredProviders);
    return isRatified(readRatification(text, requiredProviders, session.subject));
}

/** The six required fields, re-exported so a caller can assert the shape. */
export { RATIFICATION_FIELDS, SEAT_NO_FINAL_VERDICT };

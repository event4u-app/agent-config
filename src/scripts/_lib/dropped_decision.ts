/**
 * Detector E of `turn-end-gate`, extracted so its prose costs nothing.
 *
 * It lives here rather than in the hook for one mechanical reason and one real
 * one. The mechanical one: `turn_end_gate_hook.ts` sits past the 1500-line
 * source ceiling, where every line is one unit of ratchet debt, and this module
 * is under it. The real one: E is the only detector that reads a LIST of the
 * turn's assistant texts rather than the single closing one, so it shares no
 * input with A-D and F, and its dependencies are the reply-consistency parser
 * rather than anything the hook owns.
 */
import {
    find_option_blocks,
    recommendationsUnder,
    splitAndMask,
} from '../check_reply_consistency.js';
import type { RefusalDetectorId } from './turn_end_refusals.js';

/** The shape the gate collects. Kept structural so this module imports no hook. */
export interface DroppedDecisionFinding {
    detector: RefusalDetectorId;
    evidence: string;
    reason: string;
}

/**
 * Detector E — a decision put to the user in this turn, dropped before the turn
 * ended.
 *
 * THE MEASURED FAILURE. An assistant turn put three numbered options and a
 * recommendation line to the user. The `end-review-nudge` stop concern then
 * produced a SECOND assistant execution with no intervening user message, and
 * that second reply handled the nudge while demoting the open question to a
 * subordinate clause — "bleibt davon unberührt und liegt bei Dir". From the
 * user's side the conversation ended without a question. No rule stated this
 * when the detector was written: `user-interaction` Iron Law 1 inspects a reply
 * that HAS an options block, `check_reply_consistency` receives a draft and not
 * a transcript, `active-remediation` governs findings rather than issued
 * decisions, and `no-cheap-questions` guards the opposite direction. That gap
 * is now closed from the other side — `user-interaction` Iron Law 3 states the
 * continuity obligation, and the refusal below cites it — so this paragraph
 * records why the detector exists, not a gap that is still open.
 *
 * WHAT IT READS. `assistantTurnTexts` — the assistant texts since the last
 * GENUINE user prompt, with synthetic prompts and sidechain entries already
 * filtered by `readTranscriptTail`. So a task notification, a system reminder or
 * a subagent's own prompt does not read as an answer, which is the whole point:
 * the failure is defined by the absence of a real user turn.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not model the decision — no id, no
 * `pending → answered` lifecycle, no semantic matching of a free-text reply
 * against an option. That object is grant-shaped and
 * `road-to-decision-closure` owns its ownership routing; a second obligation
 * ledger here would be the parallel taxonomy that roadmap exists to prevent.
 * This is transcript adjacency and nothing above it.
 *
 * AN ASK IS A BLOCK **PLUS** ITS RECOMMENDATION LINE, and that qualifier is
 * load-bearing rather than pedantic. `find_option_blocks` calls any run of two
 * or more consecutive numbered lines a block — a plan, a findings list, an
 * ordinary enumeration. Keyed on the block alone this detector fired on 29 of
 * this repository's own 592 assistant turns, and 8 of those blocks carried no
 * recommendation line anywhere near them: pure false positives on narrative
 * lists, in a detector that can REFUSE a turn. `user-interaction` Iron Law 1
 * already says the recommendation line is the ask, so requiring it removes that
 * whole class by applying the rule this refusal cites rather than by bolting a
 * heuristic beside it.
 *
 * The cost, stated rather than discovered: an options block whose recommendation
 * line was omitted is invisible here. That reply is ALREADY a
 * `check_reply_consistency` finding and a stated Iron Law 1 violation, so it is
 * the malformed-ask problem rather than the dropped-ask problem — a different
 * defect with a different owner.
 *
 * REUSE. `find_option_blocks` and `recommendationsUnder` are both the
 * spec-backed readings behind `check_reply_consistency`, extracted rather than
 * copied. `interruption_ledger_hook` carries its own `hasNumberedOptions` for
 * the capture-only ledger; a third reading of the same rule would drift from
 * both.
 *
 * TWO KNOWN FALSE-POSITIVE PATHS, named because a refusing detector owes its
 * residual rather than only its fix:
 *
 *   · A BLOCKQUOTED illustration of an ask — `> 1.` / `> 2.` plus a quoted
 *     recommendation line — reads as live. `OPTION_LINE_RE` accepts a leading
 *     `>` deliberately, because this suite's own documented ask shape is often
 *     blockquoted, so excluding it would miss real asks to avoid a quoted one.
 *     Fenced illustrations ARE excluded and tested; blockquoted ones are not,
 *     and narrowing the shared parser to fix that would change what
 *     `check_reply_consistency` enforces about Iron Law 1.
 *   · A genuine user turn carrying NO `type: 'text'` block — an image-only
 *     message — does not reset the turn, because `readTranscriptTail` skips an
 *     entry with no text before reaching the reset. Changing that would move
 *     `turnOrdinal` for all four other detectors on a shape none of them has
 *     been measured against.
 *
 * Both cost one extra line in a reply, once: the re-entrancy layers cap a turn
 * at ONE refusal, so neither can wedge a session.
 */
export function detectDroppedDecision(
    assistantTurnTexts: readonly string[],
    closingFromPayload = false,
): DroppedDecisionFinding | null {
    if (assistantTurnTexts.length < 2) return null;
    // Masked once per text, not once per block: this runs on the stop path over
    // every assistant text of the turn, and a reply with four numbered blocks
    // would otherwise split and fence-mask the whole reply four times.
    const asksIn = (text: string): ReturnType<typeof find_option_blocks> => {
        const blocks = find_option_blocks(text);
        if (blocks.length === 0) return blocks;
        const masked = splitAndMask(text);
        return blocks.filter((b) => recommendationsUnder(text, b, masked).length > 0);
    };
    const closing = assistantTurnTexts[assistantTurnTexts.length - 1]!;
    if (asksIn(closing).length > 0) return null;
    for (let i = assistantTurnTexts.length - 2; i >= 0; i -= 1) {
        const earlier = assistantTurnTexts[i]!;
        const blocks = asksIn(earlier);
        if (blocks.length === 0) continue;
        const block = blocks[blocks.length - 1]!;
        return {
            detector: 'pending-decision',
            // The option NUMBERS and the line span, never the option text: the
            // evidence is quoted into a refusal that reaches the transcript, and
            // an options block can carry anything the reply carried.
            evidence:
                `options ${block.numbers.join('/')} at lines ${block.startLine}-${block.endLine} ` +
                `of an earlier reply this turn (closing reply read from ` +
                `${closingFromPayload ? 'the stop payload' : 'the transcript'})`,
            reason:
                'an earlier reply in THIS turn put numbered options to the user ' +
                'and no user answer followed — this closing reply carries no ' +
                'options block, so the decision disappeared without being ' +
                'answered, cancelled or superseded. A hook nudge, a reviewer ' +
                'result or a task notification may ADD to a turn; it may not ' +
                'displace a question already asked (user-interaction Iron Law 3: ' +
                'a decision handed to the user outlives the turn). ' +
                'Re-present the block and its recommendation line at the end of ' +
                'this reply',
        };
    }
    return null;
}

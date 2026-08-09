/**
 * Verdict → handoff envelope (Phase 4.1 of road-to-always-on-orchestration).
 *
 * A council pass produces a verdict a human currently has to read and
 * re-type into whatever executes next. This module is the machine-readable
 * bridge: an additive `HandoffEnvelope` — decision, rejected alternatives
 * with reasons, binding constraints — injectable as the dispatched work
 * order of an implementing subagent, so deliberation output becomes
 * execution input without a human transcription step.
 *
 * ## The honesty constraint
 *
 * A council pass has exactly ONE place in this codebase where "the
 * decision" is a discrete, machine-parsed value rather than free-text prose
 * a human (or an NLP guess) would have to interpret: the option-level
 * stance tally (`stance_tally.ts`, opt-in via `ai_council.stance_tally`).
 * Every other synthesis path — the default template, a chairman's prose
 * verdict, consensus scoring's qualitative Strong/Findings/Minority
 * buckets — has no comparable discrete "decision" field to extract from
 * without parsing prose, which is exactly the kind of confident-looking
 * fabrication this module refuses to do.
 *
 * So: `buildHandoffFromStanceTally` is the ONLY builder this module ships.
 * No tally (the common case — the flag defaults off) or a tally that split
 * (no option cleared the consensus threshold) → every field is `null`,
 * never a guessed decision. A future builder over a different structured
 * source (a chairman synthesis that itself emits structured fields, a
 * consensus-scoring extension) is additive — it does not change this one.
 *
 * @see docs/contracts/ai-council-config.md § Handoff envelope
 */

import type { StanceTallyResult } from './stance_tally.js';

/** One option the tally counted but did not conclude on. */
export interface RejectedAlternative {
    readonly option: string;
    /**
     * A factual, derived-from-the-tally sentence — never invented prose.
     * States the option's own backer count and weight against the
     * threshold the winner had to clear, nothing else.
     */
    readonly reason: string;
}

/**
 * The machine-readable work order a council verdict hands to whatever
 * executes next. Every field is independently nullable: `null` means "no
 * structured source existed to populate this field this pass", never a
 * fabricated placeholder. A consumer checks for `null`, not for an empty
 * array — an empty array would claim "checked, found none", which this
 * module never asserts when it never actually checked.
 */
export interface HandoffEnvelope {
    readonly decision: string | null;
    readonly rejected_alternatives: readonly RejectedAlternative[] | null;
    /**
     * Binding constraints the decision carries. No structured source for
     * this exists anywhere in the current synthesis pipeline (a
     * dealbreaker count describes objection PRESSURE on an option, not a
     * named constraint on the winner) — always `null` until one does.
     */
    readonly constraints: readonly string[] | null;
}

/** An envelope with every field `null` — the honest "nothing to hand off" shape. */
export const EMPTY_HANDOFF: HandoffEnvelope = {
    decision: null,
    rejected_alternatives: null,
    constraints: null,
};

/** True when every field is `null` — nothing worth rendering or dispatching. */
export function isEmptyHandoff(h: HandoffEnvelope): boolean {
    return h.decision === null && h.rejected_alternatives === null && h.constraints === null;
}

/**
 * Build a `HandoffEnvelope` from a stance tally, or the honest empty
 * envelope when there is nothing structured to extract:
 *
 * - `tally` is `null` — stance tally never ran this pass (the default,
 *   opt-in-off case).
 * - `tally.consensus` is `null` — the tally ran but split; no option
 *   cleared the two-thirds threshold, so there is no decision to report,
 *   only a split (which is quorum's/the render's job to surface, not this
 *   module's).
 *
 * Otherwise: `decision` is the winning option's display label;
 * `rejected_alternatives` lists every OTHER non-abstain option the tally
 * counted, each with a reason sentence built strictly from that option's
 * own tally numbers (backer count, weight, the threshold the winner
 * cleared) — never a narrative guess at WHY members backed it.
 */
export function buildHandoffFromStanceTally(tally: StanceTallyResult | null): HandoffEnvelope {
    if (tally === null || tally.consensus === null) {
        return EMPTY_HANDOFF;
    }
    const winner = tally.consensus;
    const rejected: RejectedAlternative[] = tally.options
        .filter((o) => o !== winner)
        .map((o) => ({
            option: o.label,
            reason:
                `backed by ${o.backers.length} member(s), weight ${o.weight.toFixed(2)} of ` +
                `${tally.threshold.toFixed(2)} needed to conclude`,
        }));
    return {
        decision: winner.label,
        rejected_alternatives: rejected.length > 0 ? rejected : null,
        constraints: null,
    };
}

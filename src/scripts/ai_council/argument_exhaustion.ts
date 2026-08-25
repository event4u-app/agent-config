/**
 * The argument-exhaustion stop predicate, with the ordering encoded.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` Phase 6.2, and the
 * resolution of its `early-stop-vs-dissent-ordering` blocker.
 *
 * ## The ordering IS the substance
 *
 * Anti-conformity repair must fire **before** the cost stop, because
 * **convergence may be conformity collapse rather than solution stability**. A
 * round where everyone agrees because nobody pushed back looks, to a cost meter,
 * exactly like a round where the argument is genuinely finished — and stopping
 * there reports the collapse as consensus. That is the failure Phase 6 exists to
 * prevent, so `dissentRepairAttempted` is a **required conjunct of the
 * predicate**, not a soft check somewhere upstream that the predicate hopes ran.
 *
 * Encoding it as a conjunct rather than as call-order discipline is deliberate:
 * a caller that forgets the order produces a wrong answer silently, while a
 * caller that forgets to set the field produces `false` — the safe direction,
 * and a visible one.
 *
 * ## Why all four, and why none of them is majority size
 *
 * A stop fires only when **every** condition holds:
 *
 * 1. `roundsCompleted >= MIN_ROUNDS` — one round is an opening statement, not an
 *    argument. There is nothing to be exhausted yet.
 * 2. `dissentRepairAttempted` — the conformity defence got its chance.
 * 3. every present member is a self-near-duplicate of their own prior round —
 *    the members have stopped adding, judged by the novelty logic that already
 *    exists rather than by a new similarity measure.
 * 4. no unresolved adversarial trigger — an open objection is unfinished
 *    argument whatever the novelty numbers say.
 *
 * **Majority size is absent on purpose** (6.3). Unanimity is the single most
 * available signal and the single least trustworthy one here: it is exactly what
 * conformity collapse produces. A predicate that read it would stop soonest in
 * precisely the case it must not.
 *
 * Everything here is pure and reads already-paid outputs — no model call, which
 * is 6.1's contract and the reason this can be evaluated after every round for
 * free.
 */

/** One round is an opening statement; exhaustion needs an exchange. */
export const MIN_ROUNDS = 2;

export interface StopInputs {
    /** Rounds completed so far. */
    roundsCompleted: number;
    /**
     * Whether anti-conformity repair ran for the round under judgement.
     *
     * The ordering conjunct. `false` when repair was skipped, deferred, or
     * never reached — all three are the same thing to this predicate, because
     * all three leave conformity collapse untested.
     */
    dissentRepairAttempted: boolean;
    /**
     * Per present member: did this round near-duplicate that member's own prior
     * round? Absent members contribute no entry rather than a `false`.
     */
    selfNearDuplicate: readonly boolean[];
    /** Adversarial triggers raised and not yet resolved. */
    unresolvedAdversarialTriggers: number;
}

export type StopBlocker =
    | 'too-few-rounds'
    | 'dissent-repair-not-attempted'
    | 'members-still-adding'
    | 'unresolved-adversarial-trigger'
    | 'no-members-present';

export interface StopVerdict {
    stop: boolean;
    /** Every condition that failed, not just the first — a caller acting on one
     *  reason at a time would re-evaluate N times to learn N blockers. */
    blockers: StopBlocker[];
}

export function evaluateStop(x: StopInputs): StopVerdict {
    const blockers: StopBlocker[] = [];

    if (x.roundsCompleted < MIN_ROUNDS) blockers.push('too-few-rounds');

    // The ordering conjunct. Deliberately evaluated as its own condition rather
    // than folded into a caller-side guard: see the module docstring.
    if (!x.dissentRepairAttempted) blockers.push('dissent-repair-not-attempted');

    if (x.selfNearDuplicate.length === 0) {
        // No present member is not "everyone is done" — it is no evidence at
        // all. `every()` over an empty array is vacuously true, which would
        // make an empty council the easiest one to stop.
        blockers.push('no-members-present');
    } else if (!x.selfNearDuplicate.every((d) => d)) {
        blockers.push('members-still-adding');
    }

    if (x.unresolvedAdversarialTriggers > 0) blockers.push('unresolved-adversarial-trigger');

    return { stop: blockers.length === 0, blockers };
}

/**
 * The rendering contract for a stopped run (6.4).
 *
 * A stopped run must be **textually distinguishable** from a full one. The
 * failure this prevents is quiet and expensive: an artifact that reads as though
 * all configured rounds executed, when three of five did, is a claim about
 * deliberation depth that nobody made on purpose.
 */
export interface StopRender {
    roundsCompleted: number;
    roundsConfigured: number;
    savedCalls: number;
    savedCostUsd: number;
    exhaustedMembers: readonly string[];
}

export function renderStop(r: StopRender): string {
    return [
        `council: STOPPED EARLY — round ${String(r.roundsCompleted)} of ${String(r.roundsConfigured)}.`,
        '  reason: argument exhaustion — every present member near-duplicated their own',
        '          prior round, after anti-conformity repair had already been attempted.',
        `  exhausted: ${r.exhaustedMembers.length > 0 ? r.exhaustedMembers.join(', ') : '(none named)'}`,
        `  saved: ${String(r.savedCalls)} call(s), $${r.savedCostUsd.toFixed(4)}`,
        '  NOT a full run: the remaining configured rounds did not execute.',
    ].join('\n');
}

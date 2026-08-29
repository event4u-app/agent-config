/**
 * Machine-decidable outcomes: the terminal state, whether a retry can help, and
 * whether a finding list is complete.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 4, Steps 4-5. Two
 * distinctions that an agent currently has to JUDGE from prose, and gets wrong
 * in the same direction each time:
 *
 * 1. **Is this worth retrying?** A missing credential, a permission denial, a
 *    spend cap and an upstream 5xx are all "the command failed", and retrying
 *    any of them burns an iteration against a gap the loop cannot close. The
 *    rules already say so — `context-hygiene`'s hard-blocker classes — and
 *    nothing a script emits lets an agent decide it without reading English.
 * 2. **Is this list complete?** A capped finding list reads as a complete one.
 *    A gate that reports "3 findings" after truncating at 3 has said something
 *    false, and the reader has no way to know.
 *
 * PER-CATEGORY caps rather than one global cap, because a single cap lets one
 * high-volume check fill the budget and hide every other category behind it —
 * which is the failure a cap is supposed to prevent, arriving through the cap.
 */

import type { RunTerminalState } from './outcome_vocabularies.js';

/**
 * The six terminal states. Contract: `contexts/execution/terminal-states.md`.
 *
 * Alias of the registry's `RunTerminalState`. This module stays the public
 * surface — `runtime_journal.test.ts:212` pins the import path and `:215`
 * asserts no second declaration — while the single definition moved to
 * `outcome_vocabularies.ts` so the contract's table can be checked against it
 * (`road-to-experience-loop-broadening` 1.3).
 */
export type TerminalState = RunTerminalState;

/** States that are NOT success. An error or an exhausted budget never reports as one. */
export const NON_SUCCESS_STATES: ReadonlySet<TerminalState> = new Set([
    'blocked',
    'approval-required',
    'exhausted',
    'stagnated',
]);

/**
 * Why a failure is or is not worth retrying.
 *
 * `hard-blocker` is the load-bearing value: it says *stop now and surface*,
 * not *try twice more first*. `context-hygiene` names the classes — missing
 * credential, permission denied, quota or rate limit reached, upstream 5xx —
 * and a first occurrence of any of them skips the retry budget entirely.
 */
export type RetryClass = 'retryable' | 'hard-blocker' | 'not-applicable';

/**
 * What the orchestrator did with a return — the acknowledgment half of the
 * channel (`road-to-runtime-event-journal` Phase 3.1).
 *
 * The envelope already refuses to report a failure as a success. What it could
 * not record is whether the *reader* did anything with that failure: a
 * `blocked` return the orchestrator dropped on the floor is byte-identical to
 * one it read, weighed, and deliberately set aside. Both are "a blocked return
 * exists"; only one of them is a defect, and no field distinguished them.
 *
 * Three values, and the absent case is the fourth and the load-bearing one:
 * ABSENT means nobody recorded a decision, which is exactly the ignored
 * blocker `_lib/ignored_blocker.ts` reports.
 */
export type ConsumptionState = 'consumed' | 'partially-consumed' | 'rejected-with-reason';

/**
 * The acknowledgment record. A discriminated union, so the reason that
 * `rejected-with-reason` needs is enforced by the TYPE rather than by a
 * runtime check the caller meets or does not: `{ consumption:
 * 'rejected-with-reason' }` with no `reason` does not compile.
 *
 * The other two states may carry a reason and are not required to — a
 * consumed return needs no justification, and demanding one would make the
 * cheap path expensive, which is how a field stops being filled at all
 * (Risk 5).
 */
export type Acknowledgment =
    | { readonly consumption: 'consumed'; readonly reason?: string }
    | { readonly consumption: 'partially-consumed'; readonly reason?: string }
    | { readonly consumption: 'rejected-with-reason'; readonly reason: string };

export interface OutcomeEnvelope<T = unknown> {
    state: TerminalState;
    /** Whether a retry can plausibly change the outcome. */
    retry: RetryClass;
    /**
     * What to do next, in the imperative, naming the thing to change. Required
     * on every non-success state: a state without a next action is a report the
     * reader must translate.
     */
    suggestion: string;
    /** True when the payload was capped. A capped list without this reads as complete. */
    truncated: boolean;
    /** Per-category counts BEFORE capping, so a reader sees what was dropped. */
    totals: Record<string, number>;
    payload: T;
    /**
     * What the orchestrator did with this return, when it recorded anything.
     *
     * OPTIONAL on purpose, and the optionality is the measurement surface: an
     * absent acknowledgment on a non-success state is a detectable ignored
     * blocker, not a defaulted-to-fine one. Never default it to `consumed` —
     * that would make every unread return look read, which is the exact
     * failure the field exists to expose.
     */
    acknowledgment?: Acknowledgment;
}

/** Raised when an envelope is constructed in a state its own contract forbids. */
export class EnvelopeContractError extends Error {}

/**
 * Build an envelope, refusing the two shapes that make one useless.
 *
 * A non-success state with no `suggestion` is refused, and so is `truncated`
 * with empty `totals`: both are the "capped list reads as complete" failure in
 * different clothes — one hides the next action, the other hides the drop.
 */
export function envelope<T>(init: {
    state: TerminalState;
    retry?: RetryClass;
    suggestion?: string;
    truncated?: boolean;
    totals?: Record<string, number>;
    payload: T;
    /**
     * Optional at construction. A producer almost never knows what its reader
     * will do, so the normal path is {@link acknowledge} at the consuming end;
     * this entry exists so a caller that IS both ends does not have to
     * round-trip through a second call.
     */
    acknowledgment?: Acknowledgment;
}): OutcomeEnvelope<T> {
    const state = init.state;
    const suggestion = init.suggestion ?? '';
    if (NON_SUCCESS_STATES.has(state) && suggestion.trim() === '') {
        throw new EnvelopeContractError(
            `terminal state "${state}" requires a suggestion — a non-success outcome with no ` +
                'named next action is a report the reader has to translate, which is the ' +
                'judgement this envelope exists to remove.',
        );
    }
    const truncated = init.truncated ?? false;
    const totals = init.totals ?? {};
    if (truncated && Object.keys(totals).length === 0) {
        throw new EnvelopeContractError(
            'truncated: true requires per-category totals — a capped list whose pre-cap counts ' +
                'are unknown is indistinguishable from a complete one, which is the defect the ' +
                'flag exists to remove.',
        );
    }
    return {
        state,
        retry: init.retry ?? (state === 'success' || state === 'clean-no-op' ? 'not-applicable' : 'retryable'),
        suggestion,
        truncated,
        totals,
        payload: init.payload,
        // Spread rather than assigned: under `exactOptionalPropertyTypes` an
        // explicit `undefined` is NOT the same as an absent key, and the whole
        // detector rests on absence meaning "nobody decided".
        ...(init.acknowledgment === undefined ? {} : { acknowledgment: init.acknowledgment }),
    };
}

/**
 * Record what a reader did with a return, without mutating the original.
 *
 * Returns a NEW envelope. The producer's value stays as it was emitted, so an
 * acknowledgment can never be mistaken for something the producer claimed
 * about its own output — which is the same author-is-not-the-evaluator
 * boundary the rest of this tree keeps.
 */
export function acknowledge<T>(env: OutcomeEnvelope<T>, ack: Acknowledgment): OutcomeEnvelope<T> {
    return { ...env, acknowledgment: ack };
}

/**
 * Cap a finding list PER CATEGORY and report what was dropped.
 *
 * @returns the kept items, the pre-cap totals per category, and whether
 * anything was dropped. The caller passes `totals` straight into
 * {@link envelope}, so the flag and the counts cannot drift apart.
 */
export function capPerCategory<T>(
    items: readonly T[],
    categoryOf: (item: T) => string,
    perCategoryCap: number,
): { kept: T[]; totals: Record<string, number>; truncated: boolean } {
    const totals: Record<string, number> = {};
    const seen: Record<string, number> = {};
    const kept: T[] = [];
    for (const item of items) {
        const c = categoryOf(item);
        totals[c] = (totals[c] ?? 0) + 1;
        seen[c] = (seen[c] ?? 0) + 1;
        if ((seen[c] ?? 0) <= perCategoryCap) kept.push(item);
    }
    return { kept, totals, truncated: kept.length < items.length };
}

/**
 * Classify a failure into a retry class from what a command actually produced.
 *
 * Deliberately a small, named list rather than a general heuristic: every entry
 * corresponds to a hard-blocker class the rules already name, and a classifier
 * that guessed beyond them would turn a transient failure into a permanent one.
 * Anything unmatched is `retryable`, which is the safe direction — a wasted
 * retry costs one iteration, a wrongly-permanent verdict costs the whole task.
 */
export function classifyFailure(text: string): RetryClass {
    const t = text.toLowerCase();
    const hard: readonly RegExp[] = [
        /\b(permission denied|forbidden|403)\b/,
        /\b(unauthorized|401|not authenticated|authentication (failed|required))\b/,
        /\b(quota|rate limit|too many requests|429)\b/,
        /\b(missing|unset|not set)\b[^\n]{0,40}\b(credential|token|api[_ -]?key|secret)\b/,
        /\bcommand not found\b/,
        /\bno such (file or directory|command)\b/,
        /\bspend (cap|limit) reached\b/,
    ];
    return hard.some((re) => re.test(t)) ? 'hard-blocker' : 'retryable';
}

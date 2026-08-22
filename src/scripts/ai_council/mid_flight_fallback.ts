/**
 * mid_flight_fallback — the cli→api retry's types, its establish step, and its
 * response stamp.
 *
 * Extracted from `orchestrator.ts` rather than written there, and the ordering
 * is the point (`gate-violation-baselines.json` § check_source_size_budget:
 * "extract, then measure"): the orchestrator sits far over the 1,500-line
 * source ceiling, so the machinery of a new mechanism belongs beside it, not
 * inside it. The extraction also removes a real duplication — the classify →
 * eligibility → ledger → construct sequence ran twice, once in `_run_round`'s
 * non-billable branch and once in its retry block.
 *
 * The full behavioural contract lives in
 * `docs/contracts/ai-council-config.md` § "Mid-flight fallback is
 * failure-class-gated". This file carries the reasons a reader needs AT the
 * code and points at that section for the rest, rather than restating it.
 */

import type { ExternalAIClient, CouncilResponse } from './clients.js';
import {
    classifyCliFailure,
    effectiveApiOnQuota,
    isFallbackEligibleUnder,
    type ApiOnQuota,
    type FallbackPolicy,
    type MidFlightFallback,
} from './transport_resolver.js';

/**
 * One escalation's outcome, for the event sink.
 *
 * `awaiting_grant` is the posture `'ask'` adds and it is neither of the two
 * that existed: the seat was NOT switched to metered billing and it was NOT
 * lost. It is held, and the round closes with a question instead of a silent
 * charge or a silent absence.
 */
export type FallbackOutcome = 'retried' | 'no_twin' | 'cost_budget' | 'awaiting_grant';

export interface FallbackEvent {
    readonly provider: string;
    readonly failure: string;
    readonly outcome: FallbackOutcome;
    readonly api_on_quota: ApiOnQuota;
}

export interface CliFallbackOptions {
    /**
     * Build the api twin for `provider`, or `null` when it cannot be built —
     * no api constructor, or its strict `api_key_ref` contract refuses.
     * Called lazily, at most once per provider per invocation.
     */
    readonly construct: (provider: string) => ExternalAIClient | null;
    /** `ai_council.fallback.api_on_quota` — see `FallbackPolicy.apiOnQuota`. */
    readonly api_on_quota: ApiOnQuota;
    /**
     * True when a run-scoped billing grant is in force for THIS run. Read only
     * under `api_on_quota: 'ask'`; absence means park, never proceed.
     */
    readonly billing_grant?: boolean;
    /**
     * Providers parked under `'ask'`, appended during the round.
     *
     * It lives on the options object rather than in the CLI because the CLI
     * has nothing to do with it: the factory that decides a seat is parked is
     * the only thing that can populate it, and a caller threading an array
     * down to that factory and back is plumbing with no reader in between.
     */
    readonly parked?: string[];
    /**
     * Called once per ESTABLISHING escalation, never per substituted call.
     *
     * The sink is the caller's: the orchestrator is a pure library with no
     * stdout and no disk, and reaching for `events_log` there would be the
     * first thing to break that. The CLI wires this to `appendEvent`.
     */
    readonly on_event?: ((e: FallbackEvent) => void) | null;
}

/** A provider's api twin, plus why it replaced the cli transport. */
export interface EstablishedTwin {
    readonly client: ExternalAIClient;
    readonly reason: string;
    readonly original_error: string;
}

/**
 * A seat held back because the policy is `'ask'` and no grant is in force.
 *
 * The third state the boolean could not express. Before `'ask'` existed a
 * quota-hit seat had exactly two futures — a twin (metered, silent) or `null`
 * (lost for the round). Neither is answerable afterwards: by the time a human
 * reads the output, the spend has happened or the seat is gone. A parked seat
 * is still in the round's seat map, so the question the round closes with is
 * about work that can still be done.
 */
export interface ParkedSeat {
    readonly parked: true;
    readonly provider: string;
    readonly reason: string;
    readonly original_error: string;
}

/** `establishTwin`'s three outcomes: a twin, a parked seat, or nothing. */
export type EstablishOutcome = EstablishedTwin | ParkedSeat | null;

/**
 * Narrow an `EstablishOutcome` to the twin branch.
 *
 * Every caller must use this rather than a truthiness test: a `ParkedSeat` is
 * an object, so `if (twin)` retries the parked marker as though it were a
 * client — the one bug the park branch exists to make impossible.
 */
export function isEstablishedTwin(o: EstablishOutcome): o is EstablishedTwin {
    return o !== null && !('parked' in o);
}

/** Narrow an `EstablishOutcome` to the parked branch. */
export function isParkedSeat(o: EstablishOutcome): o is ParkedSeat {
    return o !== null && 'parked' in o;
}

/**
 * Why the twin map exists alongside the ledger.
 *
 * `MidFlightFallback` hands out `'api'` at most ONCE per provider. Without a
 * substitution map an invocation-scoped ledger is therefore strictly WORSE
 * than a per-round one: on round 2 the dead cli member is called again, fails
 * again, and the ledger answers `'stop'` — the seat is lost for the rest of
 * the pass, having fallen back exactly once. With the map, the provider is
 * replaced BEFORE the call from the round after it fell back, so the dead
 * binary is never spawned twice and nothing is constructed twice.
 *
 * The cost, stated rather than hidden: a TRANSIENT single-round failure moves
 * the seat to the metered rung for the rest of the invocation. The mitigation
 * is visibility, not a narrower scope — every fallen-back response carries the
 * stamp `stampFallback` applies.
 */
export type TwinMap = Map<string, EstablishedTwin>;

export interface EstablishInput {
    readonly member: ExternalAIClient;
    readonly error: string;
    readonly fallback: CliFallbackOptions;
    readonly ledger: MidFlightFallback;
}

/**
 * Decide whether this cli failure establishes a twin, and build it if so.
 *
 * Returns `null` for every non-escalating outcome: an ineligible class, a
 * ledger refusal, or no constructible twin.
 *
 * It emits ONLY the `no_twin` event, and that split is deliberate. `no_twin`
 * is final here — the provider has no api rung and nothing downstream can
 * change that. Whether a CONSTRUCTED twin ends as `retried` or `cost_budget`
 * is not knowable at this point, because the caller's projected-spend gate has
 * not run yet; emitting `retried` here would report an escalation that the
 * budget then refused. An ineligible class emits nothing at all: there was no
 * escalation to report.
 */
export function establishTwin(input: EstablishInput): EstablishOutcome {
    const { member, error, fallback, ledger } = input;
    const failure = classifyCliFailure(error);
    const policy: FallbackPolicy = {
        apiOnQuota: fallback.api_on_quota,
        billingGrant: fallback.billing_grant === true,
    };
    // The park branch runs BEFORE the eligibility test, and the order is the
    // whole mechanism. `effectiveApiOnQuota` collapses an ungranted `'ask'`
    // to `false`, so an eligibility-first reading would return `null` here —
    // the seat lost, exactly as under `api_on_quota: false`, and the operator
    // never asked. The ledger is deliberately NOT consulted: parking spends no
    // fallback attempt, so the seat is still escalatable on the grant.
    if (
        fallback.api_on_quota === 'ask' &&
        failure === 'quota_exhausted' &&
        !effectiveApiOnQuota(policy)
    ) {
        fallback.on_event?.({
            provider: member.name,
            failure,
            outcome: 'awaiting_grant',
            api_on_quota: fallback.api_on_quota,
        });
        return { parked: true, provider: member.name, reason: failure, original_error: error };
    }
    if (!isFallbackEligibleUnder(failure, policy)) return null;
    if (ledger.attempt(member.name, failure, policy) !== 'api') return null;

    const twin = fallback.construct(member.name);
    if (twin === null) {
        fallback.on_event?.({
            provider: member.name,
            failure,
            outcome: 'no_twin',
            api_on_quota: fallback.api_on_quota,
        });
        return null;
    }
    return { client: twin, reason: failure, original_error: error };
}

/** The caller's half of the event: the outcome only it can know. */
export function emitOutcome(
    fallback: CliFallbackOptions,
    provider: string,
    twin: EstablishedTwin,
    outcome: Exclude<FallbackOutcome, 'no_twin'>,
): void {
    fallback.on_event?.({
        provider,
        failure: twin.reason,
        outcome,
        api_on_quota: fallback.api_on_quota,
    });
}

/**
 * Stamp a response that answered over a fallen-back transport.
 *
 * `sticky` separates the rounds that REUSED an established twin from the one
 * round that established it — a reader counting escalations counts the latter,
 * and two rendered lines must not read as two escalations.
 */
export function stampFallback(
    response: CouncilResponse,
    twin: EstablishedTwin,
    sticky: boolean,
): void {
    response.metadata = {
        ...(response.metadata ?? {}),
        fallback_from: 'cli',
        fallback_reason: twin.reason,
        fallback_original_error: twin.original_error,
        ...(sticky ? { fallback_sticky: true } : {}),
    };
}

/** True when this member is on the cli rung and its call failed. */
export function isFailedCliCall(
    member: ExternalAIClient,
    error: string | null,
    transport: string,
): boolean {
    return error !== null && String(error) !== '' && transport === 'cli';
}

/** What the gated retry needs from the round it runs inside. */
export interface GatedRetryDeps {
    /** Projected-spend verdict for one call by `client`. `true` → proceed. */
    readonly gate: (client: ExternalAIClient) => boolean;
    /** Perform the call, returning an error-tagged response rather than throwing. */
    readonly call: (client: ExternalAIClient) => CouncilResponse;
}

export interface GatedRetryResult {
    readonly response: CouncilResponse;
    /** The member the round should bill and stamp — the twin, or the original. */
    readonly effective: ExternalAIClient;
    readonly retried: boolean;
}

/**
 * Run the retry an established twin earns, behind its own spend gate.
 *
 * The gate is separate from the round's because the retry is METERED even when
 * the failed cli call was not: an unmetered seat that falls back has never been
 * priced against the running totals, so reusing the loop-head verdict would let
 * it through unpriced.
 *
 * A refusal returns the ORIGINAL failure with `fallback_skipped: cost_budget`
 * on it — named, so a reader can tell "not retried" from "retry refused".
 */
export function runGatedRetry(
    original: CouncilResponse,
    member: ExternalAIClient,
    twin: EstablishedTwin,
    fallback: CliFallbackOptions,
    deps: GatedRetryDeps,
    ledger: MidFlightFallback | null = null,
): GatedRetryResult {
    if (!deps.gate(twin.client)) {
        original.metadata = { ...(original.metadata ?? {}), fallback_skipped: 'cost_budget' };
        emitOutcome(fallback, member.name, twin, 'cost_budget');
        // The claim goes back, for the same reason it does on the unmetered
        // path: the twin was built and never called, so the provider has not
        // spent its one escalation. R2 round 3, finding 4 — the unmetered
        // refusal released and this one did not, so the two paths this
        // function's own docblock calls parallel behaved differently, and a
        // billable community-cli seat was permanently lost after a single
        // budget-refused escalation.
        ledger?.release(member.name);
        return { response: original, effective: member, retried: false };
    }
    const response = deps.call(twin.client);
    stampFallback(response, twin, false);
    emitOutcome(fallback, member.name, twin, 'retried');
    return { response, effective: twin.client, retried: true };
}

/**
 * The unmetered-seat escalation, as one call.
 *
 * A vendor-official CLI member is `billable = false` + `transport = 'cli'`,
 * which is the shape the round's non-billable branch returns early for — so
 * before this existed the retry could only ever fire for the two community
 * subclasses that consume an API key. Returns the established twin, or `null`
 * when nothing escalated.
 */
export function escalateUnmetered(
    member: ExternalAIClient,
    response: CouncilResponse,
    transport: string,
    fallback: CliFallbackOptions | null,
    ledger: MidFlightFallback | null,
): EstablishedTwin | null {
    if (fallback === null || ledger === null) return null;
    if (!isFailedCliCall(member, response.error, transport)) return null;
    const twin = establishTwin({
        member,
        error: String(response.error),
        fallback,
        ledger,
    });
    if (!isEstablishedTwin(twin)) return null;
    // NOTHING is emitted here, and the previous comment justifying an emit at
    // establishment is deleted rather than reworded because it stopped being
    // true. It read: "on this path the twin goes through the round's ORDINARY
    // spend gate, whose refusal surfaces as `cost_budget_exceeded` on the
    // response rather than as a fallback event." Round 1's finding-3 fix made
    // a refusal surface as exactly such an event, so an `retried` written here
    // and a `cost_budget` written there put two contradictory lines in the log
    // for one seat — and the first of them claims a seat was saved that was
    // not. R2 round 2, finding 4.
    //
    // The caller emits once, on the outcome it actually observed:
    // `refuseUnmeteredEscalation` for the refusal, `emitOutcome(…, 'retried')`
    // immediately before the metered call for the acceptance.
    return twin;
}

/**
 * A budget-refused escalation of an UNMETERED seat, as one call.
 *
 * The seat degrades to its own original cli failure — never to an abort, and
 * never to the round-wide short-circuit. Before the escalation existed a
 * `billable: false` member returned before the spend gate and could not reach
 * it at all, so a dead free CLI cost its own seat and nothing else; falling
 * through priced as the metered twin put it one branch from aborting EVERY
 * remaining member, which the shipped claim `council-fallback-loses-zero-seats`
 * says cannot happen. R2 round 1, finding 3.
 *
 * The shape matches {@link runGatedRetry}'s refusal path exactly: the original
 * response, `fallback_skipped: cost_budget` so a reader can tell "not retried"
 * from "retry refused", and one outcome on the event log.
 *
 * Rolls the sticky substitution back — the twin was never called, so a later
 * round must re-decide rather than inherit a substitution that never happened.
 * `ledger.release` undoes the once-per-provider claim for the same reason: a
 * twin that never ran must not consume the provider's one escalation.
 */
export function refuseUnmeteredEscalation(args: {
    readonly original: CouncilResponse;
    readonly declared: ExternalAIClient;
    readonly twin: EstablishedTwin;
    readonly fallback: CliFallbackOptions | null;
    readonly ledger: MidFlightFallback | null;
    readonly twins: TwinMap | null;
}): CouncilResponse {
    const { original, declared, twin, fallback, ledger, twins } = args;
    original.metadata = { ...(original.metadata ?? {}), fallback_skipped: 'cost_budget' };
    if (fallback !== null) emitOutcome(fallback, declared.name, twin, 'cost_budget');
    twins?.delete(declared.name);
    ledger?.release(declared.name);
    return original;
}

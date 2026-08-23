// Council orchestrator — fan out one question to multiple members.
//
// Port of the retired Python orchestrator.py (ADR-200). The historical contract
// is pinned byte-for-byte by tests: member dispatch order, sequential cost gating, the overrun
// callback contract, multi-round debate / peer-review / consensus passes, and
// the Markdown render assembly are all mirrored exactly.
//
// v2 contract (sequential + interactive overrun prompt):
//
// - Members are called **sequentially** in input order. The previous
//   parallel ThreadPoolExecutor was traded for predictable mid-flow
//   user prompts; with 2-3 council members the latency cost is small.
// - `estimate(question, members, table)` returns a pre-call cost preview
//   (input tokens + max-output ceiling + USD per member). The host
//   agent shows this before invoking `consult()`.
// - `consult(..., on_overrun=...)` invokes the callback BEFORE each
//   member's actual API call when the projected total cost would push
//   past the cost budget. The callback decides whether to proceed for
//   this single member; the next member triggers the callback again.
//
// Failure normalisation (one member's exception → `error`-set
// CouncilResponse, never raise) is unchanged.

import {
    record_spend as _record_daily_spend,
    today_spend_usd as _today_spend_usd,
    would_exceed as _would_exceed_daily,
} from './budget_guard.js';
import type {
    ExternalAIClient} from './clients.js';
import {
    DEFAULT_MAX_TOKENS,
    CouncilResponse
} from './clients.js';
import type {
    ConsensusMetadata,
    Finding} from './consensus.js';
import {
    ConsensusBucket,
    FindingScore,
    aggregate_scores,
    anonymize_findings,
    anonymize_responses,
    bucket_by_threshold,
    parse_findings_outcome,
    parse_findings_response,
    parse_scores_response,
} from './consensus.js';
import type {
    CostEstimate,
    PriceTable} from './pricing.js';
import {
    estimate_cost,
    estimate_input_tokens,
    reprice_with_cache,
} from './pricing.js';
import type { ProjectContext } from './project_context.js';
import type { AdvisorPlan } from './advisors.js';
import {
    advisor_system_prompt,
    ANTI_CONFORMITY_DIRECTIVE,
    describe_verdict_mismatch,
    STANCE_LINE_CONTRACT,
    build_extraction_user_prompt,
    build_peer_review_user_prompt,
    build_scoring_user_prompt,
    peer_review_synthesis_addendum,
    synthesis_template,
    system_prompt_for,
    VERDICT_LINE_CONTRACT,
} from './prompts.js';
import { count_dissenters, dissent_quota_met, is_near_duplicate } from './debate_gates.js';
import { parse_stance_line, render_vote_tally, tally_stances } from './stance_tally.js';
import { MidFlightFallback } from './transport_resolver.js';
import {
    emitOutcome,
    escalateUnmetered,
    refuseUnmeteredEscalation,
    establishTwin, isEstablishedTwin,
    isFailedCliCall,
    runGatedRetry,
    stampFallback,
    type CliFallbackOptions,
    type EstablishedTwin,
    type TwinMap,
} from './mid_flight_fallback.js';

export type { CliFallbackOptions, EstablishedTwin } from './mid_flight_fallback.js';

// The spend gate, extracted whole. Re-exported so every existing importer of
// `CostBudget` / `OverrunEvent` from this module keeps working unchanged.
export {
    CostBudget,
    OverrunEvent,
    _breach,
    _total_usd,
    type BreachKind,
    type Spent,
} from './spend_gate.js';
import {
    CostBudget,
    OverrunEvent,
    _breach,
    _total_usd,
    type Spent,
} from './spend_gate.js';
import { callMember, renderResponseMeta } from './response_render.js';
import {
    _excTag,
    _metaGet,
    _pyFixed,
    _pyInt,
    _pyLStrip,
    _pyLen,
    _pyReprInt,
    _pyRStrip,
    _pySlice,
    _pySplitWhitespace,
    _pyStrip,
    _setdefault,
} from './py_parity.js';

import { CHAIRMAN_FIELDS_ADDENDUM, render_deanonymization_block, deterministic_shuffle_indices } from './blind_review.js';
import type { AbsentReason } from './transport_resolver.js';
import { isSoloConcluded, type QuorumResult } from './quorum.js';
import { isEmptyHandoff, type HandoffEnvelope } from './handoff.js';


/**
 * Mirror Python `getattr(obj, name, fallback)` for the duck-typed member
 * objects (real clients + test mocks). Returns the attribute value or the
 * fallback when the attribute is absent / object is null.
 */
function _getattr(obj: unknown, name: string, fallback: unknown): unknown {
    if (obj === null || obj === undefined) {
        return fallback;
    }
    if (typeof obj === 'object' || typeof obj === 'function') {
        const val = (obj as Record<string, unknown>)[name];
        if (val !== undefined) {
            return val;
        }
    }
    return fallback;
}

/** Mirror Python `chr(ord("A") + idx)` — reviewer label letters. */
function _label(idx: number): string {
    return String.fromCharCode('A'.charCodeAt(0) + idx);
}

// ── dataclasses ───────────────────────────────────────────────────────

export class CouncilQuestion {
    mode: string; // one of: prompt, roadmap, diff, files
    user_prompt: string; // bundled artefact text
    max_tokens: number;

    constructor(args: { mode: string; user_prompt: string; max_tokens?: number }) {
        this.mode = args.mode;
        this.user_prompt = args.user_prompt;
        this.max_tokens = args.max_tokens ?? DEFAULT_MAX_TOKENS;
    }
}

// Callback signature: receive event → return True (proceed) or False (skip + tag error).
export type OnOverrunCallback = (event: OverrunEvent) => boolean;

/**
 * Pre-flight debate cost summary (Phase 8).
 *
 * `low_usd` / `expected_usd` / `high_usd` are the rolled-up spend bounds
 * across every billable member × `rounds`. The expected estimate matches
 * the per-round `estimate()` total multiplied by rounds (worst-case
 * `max_output_tokens`). `low_usd` discounts output to 25% of the ceiling —
 * most members do not hit their token budget. `high_usd` adds a 20%
 * over-run buffer per the roadmap's ±20% accuracy target.
 *
 * `per_member` carries one entry per billable member with the same bound
 * triple, plus the member's transport label (api / cli / manual).
 * `subscription_members` lists non-billable members so the disclosure
 * block can call out the "covered by subscription" rows without summing
 * them into USD totals.
 */
export class DebateCostEstimate {
    readonly rounds: number;
    readonly low_usd: number;
    readonly expected_usd: number;
    readonly high_usd: number;
    readonly per_member: Array<Record<string, unknown>>;
    readonly subscription_members: Array<Record<string, string>>;

    constructor(args: {
        rounds: number;
        low_usd: number;
        expected_usd: number;
        high_usd: number;
        per_member: Array<Record<string, unknown>>;
        subscription_members: Array<Record<string, string>>;
    }) {
        this.rounds = args.rounds;
        this.low_usd = args.low_usd;
        this.expected_usd = args.expected_usd;
        this.high_usd = args.high_usd;
        this.per_member = args.per_member;
        this.subscription_members = args.subscription_members;
    }
}

export interface EstimateOptions {
    project?: ProjectContext | null;
    original_ask?: string;
    advisor_plans?: Map<string, AdvisorPlan> | null;
}

export interface EstimateDebateCostOptions extends EstimateOptions {
    rounds: number;
}

/**
 * Project total spend for an N-round debate across all members.
 *
 * Mirrors `estimate()` per-member, then multiplies by `rounds` to account
 * for the per-round preamble + critique pass. CLI / manual members
 * (`billable=false`) are excluded from USD totals and surfaced separately
 * in `subscription_members` so the disclosure block can label them as
 * covered by the user's flat-rate plan.
 */
export function estimate_debate_cost(
    question: CouncilQuestion,
    members: ExternalAIClient[],
    table: PriceTable,
    opts: EstimateDebateCostOptions,
): DebateCostEstimate {
    const rounds = opts.rounds;
    const project = opts.project ?? null;
    const original_ask = opts.original_ask ?? '';
    const advisor_plans = opts.advisor_plans ?? null;
    if (rounds < 1) {
        throw new Error(`rounds must be >= 1 (got ${_pyReprInt(rounds)}).`);
    }
    const billable_members = members.filter(
        (m) => _getattr(m, 'billable', true) as boolean,
    );
    const sub_members: Array<Record<string, string>> = members
        .filter((m) => !(_getattr(m, 'billable', true) as boolean))
        .map((m) => ({
            name: m.name,
            model: m.model,
            transport: _getattr(m, 'transport', 'api') as string,
            subscription_label: _getattr(m, 'subscription_label', '') as string,
        }));
    const per_round = estimate(question, billable_members, table, {
        project,
        original_ask,
        advisor_plans,
    });
    const expected =
        per_round.reduce((acc, e) => acc + _total_usd(e), 0) * rounds;
    // Low bound: output tokens rarely reach `max_output_tokens` ceiling.
    // Use input-only cost + 25% of the output ceiling — empirical floor
    // from manual debate traces.
    const low =
        per_round.reduce((acc, e) => acc + e.input_usd + 0.25 * e.output_usd, 0) *
        rounds;
    // High bound: +20% over-run buffer (roadmap ±20% accuracy target).
    const high = expected * 1.2;
    const per_member: Array<Record<string, unknown>> = [];
    for (let i = 0; i < billable_members.length; i++) {
        const member = billable_members[i] as ExternalAIClient;
        const est = per_round[i] as CostEstimate;
        const member_expected = _total_usd(est) * rounds;
        per_member.push({
            name: member.name,
            model: member.model,
            transport: _getattr(member, 'transport', 'api') as string,
            low_usd: (est.input_usd + 0.25 * est.output_usd) * rounds,
            expected_usd: member_expected,
            high_usd: member_expected * 1.2,
        });
    }
    return new DebateCostEstimate({
        rounds,
        low_usd: low,
        expected_usd: expected,
        high_usd: high,
        per_member,
        subscription_members: sub_members,
    });
}


/**
 * Return a pre-call cost estimate per member, in input order.
 *
 * `project` and `original_ask` are passed through to `system_prompt_for()`
 * so the estimate covers the handoff preamble bytes too. Both default to
 * v1-shape (no preamble extension).
 *
 * `advisor_plans` (Phase 6) — when a member's name has a plan, the estimate
 * uses the advisor persona system prompt (typically larger than the bare
 * mode addendum). The cost estimator must mirror `_run_round` exactly so the
 * pre-call preview never under-states the advisor-mode bill.
 */
export function estimate(
    question: CouncilQuestion,
    members: ExternalAIClient[],
    table: PriceTable,
    opts: EstimateOptions = {},
): CostEstimate[] {
    const project = opts.project ?? null;
    const original_ask = opts.original_ask ?? '';
    const plans = opts.advisor_plans ?? new Map<string, AdvisorPlan>();
    const base_user_tokens = estimate_input_tokens(question.user_prompt);
    const base_sys = system_prompt_for(question.mode, { project, original_ask });
    const base_sys_tokens = estimate_input_tokens(base_sys);
    const estimates: CostEstimate[] = [];
    for (const m of members) {
        const plan = plans.get(m.name);
        let sys_tokens: number;
        if (plan === undefined) {
            sys_tokens = base_sys_tokens;
        } else {
            const sys_prompt = advisor_system_prompt(plan.persona_text, {
                project,
                original_ask,
            });
            sys_tokens = estimate_input_tokens(sys_prompt);
        }
        const input_tokens = base_user_tokens + sys_tokens;
        estimates.push(
            estimate_cost(m.name, m.model, input_tokens, question.max_tokens, table),
        );
    }
    return estimates;
}

export interface ConsultOptions {
    table?: PriceTable | null;
    on_overrun?: OnOverrunCallback | null;
    project?: ProjectContext | null;
    original_ask?: string;
    rounds?: number;
    on_round_complete?:
        | ((round_idx: number, responses: CouncilResponse[]) => void)
        | null;
    advisor_plans?: Map<string, AdvisorPlan> | null;
    /**
     * Phase 1 (stance tally): when true, the FINAL round's user prompt appends
     * the mandatory `STANCE:` closing-line contract so `stance_tally.ts` can
     * tally option-level verdicts deterministically. Default `false` → every
     * round's prompt is byte-identical to today.
     */
    stance_tally?: boolean;
    /**
     * Phase 1 stance-repair transport (2026-07-12 council policy): confirm per
     * member in interactive runs; `null`/absent → a missing/unparseable stance
     * stays a repair-marker in the tally, never an unplanned billable call.
     */
    on_stance_repair?: ((member: string) => boolean) | null;
    /** Receives each stance-repair response so the caller can account its cost. */
    on_stance_repair_result?: ((r: CouncilResponse) => void) | null;
    /**
     * Ü2 (road-to-council-blind-review Phase 1): per-member system-prompt
     * suffix appended AFTER the base/advisor system prompt — e.g. a stance
     * framing sentence from `blind_review.assign_stances`. This module stays
     * stance-agnostic on purpose: the caller supplies plain text keyed by
     * member name. Default `null` → byte-identical to today.
     */
    member_prompt_suffix?: Map<string, string> | null;
    /**
     * Ü2 outsider-seat ablation: member names in this set get `project: null`
     * in their system-prompt build (question + artefact only, no project
     * context). Default `null` → byte-identical to today.
     */
    no_project_context_members?: ReadonlySet<string> | null;
    /** Mid-flight cli→api fallback; absent → no retry. See `mid_flight_fallback`. */
    cli_fallback?: CliFallbackOptions | null;
}

/**
 * Sequentially fan out `question` to every enabled member.
 *
 * - If `table` is provided, USD spend is tracked against
 *   `budget.max_total_usd` (when > 0). Without `table`, only the
 *   token caps apply (back-compat with v1 callers).
 * - When the projected next-member spend would breach any cap,
 *   `on_overrun` is consulted. Returning False marks that member as
 *   `cost_budget_exceeded`; True proceeds with the call.
 * - Without `on_overrun`, breaching caps short-circuits remaining
 *   members with `cost_budget_exceeded` (v1 behaviour preserved).
 * - `project` + `original_ask` flow into `handoff_preamble()` so the
 *   council member receives a neutral context-handoff alongside the
 *   artefact. Both default to v1 shape (no preamble extension).
 * - `rounds >= 2` enables multi-round debate (D1). Each subsequent
 *   round augments the user prompt with anonymised prior-round
 *   responses (provider/model identity stripped). Token + USD caps
 *   accumulate across rounds. Returns the FINAL round's responses;
 *   use `on_round_complete(round_idx, responses)` to capture
 *   intermediate rounds.
 * - `advisor_plans` (Phase 6) keyed by provider name swaps the
 *   member's system prompt for the advisor persona via
 *   `advisor_system_prompt()`. Replace-mode: no extra calls.
 */
export function consult(
    members: ExternalAIClient[],
    question: CouncilQuestion,
    budget: CostBudget | null = null,
    opts: ConsultOptions = {},
): CouncilResponse[] {
    const table = opts.table ?? null;
    const on_overrun = opts.on_overrun ?? null;
    const project = opts.project ?? null;
    const original_ask = opts.original_ask ?? '';
    const rounds = opts.rounds ?? 1;
    const on_round_complete = opts.on_round_complete ?? null;
    const advisor_plans = opts.advisor_plans ?? null;

    if (rounds < 1) {
        throw new Error(`rounds must be >= 1 (got ${rounds})`);
    }
    if (members.length === 0) {
        return [];
    }
    const resolvedBudget = budget ?? new CostBudget();
    if (members.length > resolvedBudget.max_calls) {
        throw new Error(
            `Council has ${members.length} members but budget caps at ` +
                `${resolvedBudget.max_calls} calls.`,
        );
    }

    const spent: Spent = { input: 0, output: 0, usd: 0.0 };
    // One ledger + one twin map per invocation — the double-spend unit.
    const cli_fallback = opts.cli_fallback ?? null;
    const fallback_ledger = cli_fallback !== null ? new MidFlightFallback() : null;
    const fallback_twins =
        cli_fallback !== null ? new Map<string, EstablishedTwin>() : null;
    let last_results: CouncilResponse[] = [];
    // A3 read unlock: the stable prefix is ALWAYS the original user prompt;
    // per-round critiques + the STANCE contract ride in a volatile suffix so
    // cache-capable clients read the [system + artefact] prefix on round N+1.
    let current_suffix = '';

    const stance_tally = opts.stance_tally ?? false;
    for (let round_idx = 0; round_idx < rounds; round_idx++) {
        // Phase 1: the FINAL round carries the mandatory STANCE closing-line
        // contract when the tally is enabled. Off (default) → the original
        // question object flows through untouched, byte-identical to today.
        const is_final = round_idx === rounds - 1;
        const suffix_for_round =
            is_final && stance_tally
                ? `${current_suffix}\n\n---\n\n${STANCE_LINE_CONTRACT}`
                : current_suffix;
        const prompt_for_round = `${question.user_prompt}${suffix_for_round}`;
        const round_question =
            round_idx === 0 && prompt_for_round === question.user_prompt
                ? question
                : new CouncilQuestion({
                      mode: question.mode,
                      user_prompt: prompt_for_round,
                      max_tokens: question.max_tokens,
                  });
        last_results = _run_round(members, round_question, resolvedBudget, spent, {
            table,
            on_overrun,
            project,
            original_ask,
            advisor_plans,
            cli_fallback,
            fallback_ledger,
            fallback_twins,
            member_prompt_suffix: opts.member_prompt_suffix ?? null,
            no_project_context_members: opts.no_project_context_members ?? null,
            split: suffix_for_round
                ? { stable: question.user_prompt, suffix: suffix_for_round }
                : null,
        });
        if (on_round_complete !== null) {
            on_round_complete(round_idx, last_results);
        }
        if (round_idx + 1 < rounds) {
            current_suffix = _critique_suffix(last_results, round_idx + 2);
        }
    }

    // Phase 1 stance repair: one bounded stance-line-only re-prompt per member
    // whose final reply lacks a parseable STANCE line — dispatched only through
    // the on_stance_repair transport, reusing _run_round (spend gate + ledger +
    // stamping unchanged). The repaired stance line is APPENDED to the member's
    // final text so the deterministic tally can read it.
    const on_stance_repair = opts.on_stance_repair ?? null;
    if (stance_tally && on_stance_repair !== null) {
        for (let i = 0; i < last_results.length; i++) {
            const r = last_results[i] as CouncilResponse;
            if (r.error !== null || r.text.trim() === '' || parse_stance_line(r.text) !== null) {
                continue;
            }
            const member = members[i];
            if (member === undefined || !on_stance_repair(member.name)) {
                continue;
            }
            const repairQ = new CouncilQuestion({
                mode: question.mode,
                user_prompt:
                    `Your reply is missing the mandatory closing stance line. ` +
                    `Reply with ONLY that single line for your final position.\n\n${STANCE_LINE_CONTRACT}`,
                max_tokens: question.max_tokens,
            });
            // Stance repair shares the invocation-wide ledger: transport
            // health and structural validity are INDEPENDENT failure modes,
            // so refusing the retry would discard salvageable work for an
            // unrelated reason. Bounded by the retry's own spend gate.
            const rr = _run_round([member], repairQ, resolvedBudget, spent, {
                table,
                on_overrun,
                project,
                original_ask,
                advisor_plans,
                cli_fallback,
                fallback_ledger,
                fallback_twins,
            });
            const rep = rr[0];
            if (rep !== undefined) {
                opts.on_stance_repair_result?.(rep);
                if (rep.error === null && parse_stance_line(rep.text) !== null) {
                    r.text = `${r.text.trim()}\n\n${rep.text.trim()}`;
                }
            }
        }
    }

    return last_results;
}


/** Which cap a projected call breaches, or `null` when it fits. */
interface RunRoundOptions {
    table: PriceTable | null;
    on_overrun: OnOverrunCallback | null;
    project: ProjectContext | null;
    original_ask: string;
    advisor_plans?: Map<string, AdvisorPlan> | null;
    /**
     * A3 cross-round read unlock: when set, members are called via
     * `ask_split(system, stable, suffix)` so cache-capable clients keep the
     * breakpoint on the byte-stable [system + artefact] prefix and the
     * per-round critiques ride behind it. `question.user_prompt` stays the
     * full concatenation (estimates + persistence unchanged).
     */
    split?: { stable: string; suffix: string } | null;
    /** Ü2 — see `ConsultOptions.member_prompt_suffix`. */
    member_prompt_suffix?: Map<string, string> | null;
    /** Ü2 — see `ConsultOptions.no_project_context_members`. */
    no_project_context_members?: ReadonlySet<string> | null;
    /** See `ConsultOptions.cli_fallback`. Both set together, or neither. */
    cli_fallback?: CliFallbackOptions | null;
    fallback_ledger?: MidFlightFallback | null;
    /** Invocation-wide substitution map — see `mid_flight_fallback.TwinMap`. */
    fallback_twins?: TwinMap | null;
}

/** Run a single round; mutate `spent` with cumulative totals. */
function _run_round(
    members: ExternalAIClient[],
    question: CouncilQuestion,
    budget: CostBudget,
    spent: Spent,
    opts: RunRoundOptions,
): CouncilResponse[] {
    const table = opts.table;
    const on_overrun = opts.on_overrun;
    const project = opts.project;
    const original_ask = opts.original_ask;
    const plans = opts.advisor_plans ?? new Map<string, AdvisorPlan>();
    const member_prompt_suffix = opts.member_prompt_suffix ?? null;
    const no_project_context_members = opts.no_project_context_members ?? null;
    const base_system_prompt = system_prompt_for(question.mode, {
        project,
        original_ask,
    });

    const _system_prompt_for_member = (m: ExternalAIClient): string => {
        const plan = plans.get(m.name);
        // Ü2 outsider-seat ablation: this member's system prompt is built
        // WITHOUT project context (question + artefact only). Everyone else
        // is unaffected — `use_project === project` short-circuits back to
        // the precomputed `base_system_prompt` when no set is provided.
        const use_project = no_project_context_members?.has(m.name) ? null : project;
        let base: string;
        if (plan === undefined) {
            base =
                use_project === project
                    ? base_system_prompt
                    : system_prompt_for(question.mode, { project: use_project, original_ask });
        } else {
            base = advisor_system_prompt(plan.persona_text, { project: use_project, original_ask });
        }
        const suffix = member_prompt_suffix?.get(m.name);
        return suffix ? `${base}\n\n${suffix}` : base;
    };

    const results: CouncilResponse[] = [];
    const estimates: CostEstimate[] | null =
        table !== null
            ? estimate(question, members, table, {
                  project,
                  original_ask,
                  advisor_plans: opts.advisor_plans ?? null,
              })
            : null;

    const twins = opts.fallback_twins ?? null;
    for (let idx = 0; idx < members.length; idx++) {
        const declared = members[idx] as ExternalAIClient;
        // Sticky substitution: a provider that fell back earlier is
        // replaced BEFORE the call, so the dead binary is spawned once.
        let established = twins?.get(declared.name) ?? null;
        const substituted_on_entry = established !== null;
        let member = established !== null ? established.client : declared;
        // Set only when THIS iteration escalated an unmetered seat; read by
        // the breach handler below so a refusal degrades that one seat instead
        // of the round. See the `unmetered_original !== null` branch there.
        let unmetered_original: CouncilResponse | null = null;
        let unmetered_twin: EstablishedTwin | null = null;
        // ── non-billable members skip the cost gate entirely ─────────
        // ManualClient (and future PlaywrightClient) cost us $0; their
        // token counts are still tracked from the response below for
        // observability, but no projection / budget breach can apply.
        if (!(_getattr(member, 'billable', true) as boolean)) {
            let response = callMember(member, question, opts, _system_prompt_for_member, _excTag);
            // ── the fallback's REAL entry point ──────────────────────
            // On an escalation the loop deliberately does NOT `continue`: it
            // falls through to the metered path with `member` swapped for the
            // twin. Why this branch and not the retry block below:
            // `mid_flight_fallback.escalateUnmetered`.
            const nb_twin = escalateUnmetered(
                member,
                response,
                _getattr(member, 'transport', 'api') as string,
                opts.cli_fallback ?? null,
                opts.fallback_ledger ?? null,
            );
            const escalated = nb_twin !== null;
            if (nb_twin !== null) {
                established = nb_twin;
                twins?.set(member.name, nb_twin);
                member = nb_twin.client;
                // Kept so a budget refusal below can return the ORIGINAL cli
                // failure rather than aborting the seat as its twin.
                unmetered_original = response;
                unmetered_twin = nb_twin;
            }
            if (!escalated) {
                _stamp_transport_metadata(response, member);
                results.push(response);
                spent.input += response.input_tokens;
                spent.output += response.output_tokens;
                continue;
            }
        }

        // ── projected spend check ────────────────────────────────────
        // A substituted twin is priced as ITSELF — the pre-loop estimate row
        // belongs to an unmetered seat and would gate a metered call at $0.
        const est =
            established !== null && table !== null
                ? (estimate(question, [member], table, {
                      project,
                      original_ask,
                      advisor_plans: opts.advisor_plans ?? null,
                  })[0] as CostEstimate)
                : estimates
                  ? (estimates[idx] as CostEstimate)
                  : null;
        const breach = _breach(est, spent, budget);
        if (breach !== null) {
            const breach_kind = breach;
            const error_tag =
                breach_kind === 'daily'
                    ? 'daily_budget_exceeded'
                    : 'cost_budget_exceeded';
            // A seat that arrived here by escalating from an UNMETERED cli
            // call degrades to its own original failure — never to an abort,
            // and never to the round-wide short-circuit below. The reasoning,
            // and the rollback of both the twin map and the ledger claim, live
            // in `refuseUnmeteredEscalation`.
            if (unmetered_original !== null && unmetered_twin !== null) {
                const refused = refuseUnmeteredEscalation({
                    original: unmetered_original,
                    declared,
                    twin: unmetered_twin,
                    fallback: opts.cli_fallback ?? null,
                    ledger: opts.fallback_ledger ?? null,
                    twins,
                });
                _stamp_transport_metadata(refused, declared);
                results.push(refused);
                spent.input += refused.input_tokens;
                spent.output += refused.output_tokens;
                continue;
            }
            if (on_overrun !== null && estimates !== null) {
                const event = new OverrunEvent({
                    member_index: idx,
                    member,
                    // `est`, not `estimates[idx]`. The breach decision two
                    // lines up was already re-priced for a substituted twin;
                    // the event that ASKS the operator to approve it showed
                    // the pre-loop row for the unmetered DECLARED seat, i.e. a
                    // ~$0 next-call estimate for the very call the gate just
                    // refused as over budget. R2 review, finding 8.
                    next_estimate: (est ?? estimates[idx]) as CostEstimate,
                    spent_input_tokens: _pyInt(spent.input),
                    spent_output_tokens: _pyInt(spent.output),
                    spent_usd: spent.usd,
                    projected_total_usd: spent.usd + (est ? _total_usd(est) : 0.0),
                    daily_spent_usd:
                        budget.daily_limit_usd > 0 ? _today_spend_usd() : 0.0,
                    daily_limit_usd: budget.daily_limit_usd,
                    breach_kind,
                });
                if (!on_overrun(event)) {
                    results.push(_aborted(member, error_tag));
                    continue;
                }
            } else {
                // v1 behaviour: short-circuit all remaining members.
                for (const left of members.slice(idx)) {
                    results.push(_aborted(left, error_tag));
                }
                return results;
            }
        }

        // An escalated unmetered seat clears the gate: NOW the escalation is
        // real, so `retried` is emitted here rather than at establishment.
        // `escalateUnmetered` used to emit it the moment the twin was built,
        // which put a "seat saved" line in the log for escalations the budget
        // then refused — R2 round 2, finding 4.
        if (unmetered_twin !== null) {
            const fb = opts.cli_fallback ?? null;
            if (fb !== null) emitOutcome(fb, declared.name, unmetered_twin, 'retried');
        }

        // ── actual call ──────────────────────────────────────────────
        let response = callMember(member, question, opts, _system_prompt_for_member, _excTag);

        // ── mid-flight cli→api fallback, billable-cli path ───────────
        // The community CLI wrappers reach the fallback here; the
        // vendor-official ones took the non-billable branch above. Realized
        // cost and the transport stamp below run on `effective`.
        let effective: ExternalAIClient = member;
        const fallback = opts.cli_fallback ?? null;
        const ledger = opts.fallback_ledger ?? null;
        if (
            fallback !== null &&
            ledger !== null &&
            isFailedCliCall(member, response.error, _getattr(member, 'transport', 'api') as string)
        ) {
            const twin = establishTwin({
                member,
                error: String(response.error),
                fallback,
                ledger,
            });
            if (isEstablishedTwin(twin)) {
                const out = runGatedRetry(response, member, twin, fallback, {
                    gate: (client) =>
                        table === null ||
                        _breach(
                            estimate(question, [client], table, {
                                project,
                                original_ask,
                                advisor_plans: opts.advisor_plans ?? null,
                            })[0] as CostEstimate,
                            spent,
                            budget,
                        ) === null,
                    call: (client) => callMember(client, question, opts, _system_prompt_for_member, _excTag),
                }, ledger);
                response = out.response;
                effective = out.effective;
                // Established for the rest of the invocation, so later rounds
                // do not re-spawn the dead binary.
                if (out.retried) twins?.set(member.name, twin);
            }
        }
        // No round is silent about which transport answered; `sticky`
        // marks the reuses (see `stampFallback`).
        if (established !== null) stampFallback(response, established, substituted_on_entry);
        results.push(response);
        spent.input += response.input_tokens;
        spent.output += response.output_tokens;
        let actual_usd: number | null = null;
        if (estimates !== null && table !== null) {
            // Realized cost bills the OBSERVED cache read/write tokens
            // (Anthropic's usage.input_tokens excludes them), unlike the
            // cache-agnostic pre-flight estimate above — see
            // `reprice_with_cache`'s docstring for why the two stay separate.
            // ttl is '5m': the request builder emits `cache_control:
            // {type:'ephemeral'}` with no explicit ttl, i.e. the 5-min default.
            const actual = reprice_with_cache(
                effective.name,
                effective.model,
                {
                    input_tokens: response.input_tokens,
                    cache_read_input_tokens: response.cache_read_input_tokens,
                    cache_creation_input_tokens: response.cache_creation_input_tokens,
                    output_tokens: response.output_tokens,
                },
                table,
                '5m',
            );
            actual_usd = _total_usd(actual);
            spent.usd += _total_usd(actual);
            // Persist to the rolling 24h ledger when the daily cap is
            // active. Errors are swallowed inside record_spend.
            if (budget.daily_limit_usd > 0 && !response.error) {
                _record_daily_spend(_total_usd(actual), effective.name, effective.model, {
                    cache_read_input_tokens: response.cache_read_input_tokens,
                    cache_creation_input_tokens: response.cache_creation_input_tokens,
                    cache_ttl: '5m',
                });
            }
        }
        _stamp_transport_metadata(response, effective, actual_usd);
    }

    return results;
}

function _aborted(member: ExternalAIClient, reason: string): CouncilResponse {
    const response = new CouncilResponse({
        provider: member.name,
        model: member.model,
        text: '',
        error: reason,
    });
    _stamp_transport_metadata(response, member);
    return response;
}

/**
 * Annotate `response.metadata` with transport / billable / cost info.
 *
 * Phase 5 / Step 1 — the session writer and orchestrator renderer key
 * off these fields to format the cost line as either
 * `cost: subscription (claude-pro)` (non-billable vendor CLI) or
 * `cost: $0.NNNN (… in / … out)` (billable api or community CLI).
 * Stamped here (and not in each client) so the writer stays decoupled
 * from the client class hierarchy.
 */
function _stamp_transport_metadata(
    response: CouncilResponse,
    member: ExternalAIClient,
    cost_usd: number | null = null,
): void {
    const meta: Record<string, unknown> = { ...(response.metadata ?? {}) };
    const transport = _getattr(member, 'transport', 'api') as string;
    _setdefault(meta, 'transport', transport);
    _setdefault(meta, 'billable', Boolean(_getattr(member, 'billable', true)));
    const label = (_getattr(member, 'subscription_label', '') as string) || '';
    if (label && !(_metaGet(meta, 'billable', true) as boolean)) {
        _setdefault(meta, 'subscription_label', label);
    }
    if (cost_usd !== null) {
        meta['cost_usd'] = Number(cost_usd);
    }
    response.metadata = meta;
}

/**
 * Build the round-N user prompt: original artefact + anonymised prior round.
 *
 * Provider/model identifiers are stripped (Iron Law of Neutrality §
 * multi-round). Reviewers are labelled "Reviewer A / B / C…" in the
 * order they appeared. Errors are skipped — they reveal nothing
 * useful and can leak provider error formats.
 */
function _augment_for_next_round(
    original_prompt: string,
    prior_responses: CouncilResponse[],
    next_round_number: number,
): string {
    return `${original_prompt}${_critique_suffix(prior_responses, next_round_number)}`;
}

/**
 * The volatile per-round block ONLY (A3 read unlock) — everything after the
 * byte-stable original prompt. Empty string when no prior response survives.
 * `_augment_for_next_round` = original + this; the rounds loop feeds this to
 * `ask_split` so the cached [system + artefact] prefix stays byte-identical.
 */
function _critique_suffix(
    prior_responses: CouncilResponse[],
    next_round_number: number,
): string {
    const blocks: string[] = [];
    let label_idx = 0;
    for (const r of prior_responses) {
        if (r.error || !_pyStrip(r.text)) {
            continue;
        }
        const label = _label(label_idx);
        label_idx += 1;
        blocks.push(`### Reviewer ${label}\n\n${_pyStrip(r.text)}`);
    }
    if (blocks.length === 0) {
        return '';
    }
    const prior_block = blocks.join('\n\n');
    return (
        `\n\n` +
        `---\n\n` +
        `## Prior round critiques (round ${next_round_number - 1})\n\n` +
        `You are now in round ${next_round_number}. Below are anonymised\n` +
        `critiques from independent reviewers in the previous round.\n` +
        `You do NOT know which model produced which critique. Read them,\n` +
        `then respond with:\n\n` +
        `1. Which prior points you agree with (cite reviewer label).\n` +
        `2. Which you disagree with and why.\n` +
        `3. New points or refinements not raised in round 1.\n\n` +
        `${prior_block}`
    );
}

/**
 * Snapshot passed to the continue-prompt callback between rounds.
 *
 * Phase 7 progressive-disclosure contract — the orchestrator pauses
 * after each completed round, builds this checkpoint, and asks the
 * caller whether to continue. Returning False stops the debate
 * gracefully (caller receives every completed round).
 */
export class DebateCheckpoint {
    completed_round: number; // 1-based index of the round just finished
    total_planned_rounds: number;
    cost_so_far_usd: number;
    next_round_estimate_usd: number;
    last_round_responses: CouncilResponse[];

    constructor(args: {
        completed_round: number;
        total_planned_rounds: number;
        cost_so_far_usd: number;
        next_round_estimate_usd: number;
        last_round_responses: CouncilResponse[];
    }) {
        this.completed_round = args.completed_round;
        this.total_planned_rounds = args.total_planned_rounds;
        this.cost_so_far_usd = args.cost_so_far_usd;
        this.next_round_estimate_usd = args.next_round_estimate_usd;
        this.last_round_responses = args.last_round_responses;
    }
}

/**
 * Raised when projected next-round spend would breach the budget cap.
 *
 * The CLI catches this *after* writing the partial artefact, so the
 * user always has a recoverable trail of the rounds that completed
 * before the cap fired.
 */
export class DebateCapExceeded extends Error {
    completed_round: number;
    cost_so_far: number;
    next_estimate: number;
    cap: number;

    constructor(args: {
        completed_round: number;
        cost_so_far: number;
        next_estimate: number;
        cap: number;
    }) {
        super(
            `Debate hard-cap: round ${args.completed_round + 1} would push spend ` +
                `to $${_pyFixed(args.cost_so_far + args.next_estimate, 4)} ` +
                `(cap=$${_pyFixed(args.cap, 4)}); ` +
                `stopping after round ${args.completed_round}.`,
        );
        this.name = 'DebateCapExceeded';
        this.completed_round = args.completed_round;
        this.cost_so_far = args.cost_so_far;
        this.next_estimate = args.next_estimate;
        this.cap = args.cap;
    }
}

// Continue-prompt callback. Receives a DebateCheckpoint, returns True to
// proceed with the next round, False to stop gracefully.
export type DebateContinuePrompt = (checkpoint: DebateCheckpoint) => boolean;

/**
 * Build the round-N user prompt for a debate — rebuttal framing.
 *
 * Same anonymisation rules as `_augment_for_next_round` (Iron Law of
 * Neutrality § multi-round): provider/model identifiers stripped,
 * "Reviewer A / B / C…" labels assigned in input order, errors
 * skipped. The instruction block is debate-specific: each reviewer
 * is asked to identify the strongest opposing position and write a
 * rebuttal, NOT to find common ground.
 */
function _augment_for_debate_round(
    original_prompt: string,
    prior_responses: CouncilResponse[],
    next_round_number: number,
    // Phase 3: when the debate gates are enabled, prepend the anti-conformity
    // directive. Default `false` keeps the prompt byte-identical to today.
    anti_conformity = false,
): string {
    return `${original_prompt}${_debate_suffix(prior_responses, next_round_number, anti_conformity)}`;
}

/** Debate twin of `_critique_suffix` — the volatile block only (A3). */
function _debate_suffix(
    prior_responses: CouncilResponse[],
    next_round_number: number,
    anti_conformity = false,
): string {
    const blocks: string[] = [];
    let label_idx = 0;
    for (const r of prior_responses) {
        if (r.error || !_pyStrip(r.text)) {
            continue;
        }
        const label = _label(label_idx);
        label_idx += 1;
        blocks.push(`### Reviewer ${label}\n\n${_pyStrip(r.text)}`);
    }
    if (blocks.length === 0) {
        return '';
    }
    const prior_block = blocks.join('\n\n');
    const anti_conformity_block = anti_conformity ? `${ANTI_CONFORMITY_DIRECTIVE}\n\n` : '';
    return (
        `\n\n` +
        `---\n\n` +
        `## Prior round positions (round ${next_round_number - 1})\n\n` +
        `You are now in round ${next_round_number} of a structured\n` +
        `debate. Below are anonymised positions from independent\n` +
        `reviewers in the previous round. You do NOT know which model\n` +
        `produced which position.\n\n` +
        anti_conformity_block +
        `Identify the SINGLE strongest opposing position and write a\n` +
        `rebuttal addressed at its strongest steel-manned form. Do NOT\n` +
        `search for common ground — name the load-bearing flaw the\n` +
        `opposing reviewer missed and state the evidence behind your\n` +
        `counter-position.\n\n` +
        `${prior_block}`
    );
}

/**
 * Phase 3 post-round enforcement (2026-07-12 council policy): deterministic
 * detectors flag members whose round added nothing (novelty near-duplicate of
 * their own prior round) or when the round collapsed toward agreement (dissent
 * quota unmet → the most-recently-converged member). At most ONE bounded repair
 * re-prompt per member per round, dispatched only through the `on_repair`
 * transport (confirm-interactive / auto-fire under --auto-continue); the repair
 * call reuses `_run_round`, so the projected-spend gate, ledger, and metadata
 * stamping apply unchanged. A successful repair REPLACES the member's entry so
 * downstream rounds/persistence see the repaired reply.
 */
function _run_debate_gate_repairs(
    members: ExternalAIClient[],
    results: CouncilResponse[],
    prior: CouncilResponse[],
    round_question: CouncilQuestion,
    budget: CostBudget,
    spent: Spent,
    round_opts: {
        table: PriceTable | null;
        on_overrun: OnOverrunCallback | null;
        project: ProjectContext | null;
        original_ask: string;
        advisor_plans: Map<string, AdvisorPlan> | null;
        /** Threaded from `run_debate`; ledger and twins are invocation-wide. */
        cli_fallback?: CliFallbackOptions | null;
        fallback_ledger?: MidFlightFallback | null;
        fallback_twins?: Map<string, EstablishedTwin> | null;
    },
    on_repair: ((member: string, reason: string) => boolean) | null,
): CouncilResponse[] {
    const flagged: Array<{ idx: number; reason: string }> = [];
    const okText = (r: CouncilResponse | undefined): string =>
        r !== undefined && r.error === null ? r.text : '';
    for (let i = 0; i < results.length; i++) {
        const curr = okText(results[i]);
        const prev = okText(prior[i]);
        if (curr !== '' && prev !== '' && is_near_duplicate(prev, curr)) {
            flagged.push({ idx: i, reason: 'novelty: near-duplicate of your own prior round' });
        }
    }
    const texts = results.map((r) => okText(r));
    if (!dissent_quota_met(texts.filter((t) => t !== ''))) {
        // Most-recently-converged heuristic: the LAST member with a real reply
        // that carries no objection marker.
        for (let i = results.length - 1; i >= 0; i--) {
            const t = okText(results[i]);
            if (t !== '' && count_dissenters([t]) === 0 && !flagged.some((f) => f.idx === i)) {
                flagged.push({ idx: i, reason: 'dissent quota unmet: state a genuine objection or confirm with a named reason' });
                break;
            }
        }
    }
    if (flagged.length === 0 || on_repair === null) {
        return results;
    }
    const repaired = new Set<number>();
    const out = [...results];
    for (const f of flagged) {
        if (repaired.has(f.idx)) {
            continue; // hard cap: <= 1 repair per member per round
        }
        const member = members[f.idx];
        if (member === undefined) {
            continue;
        }
        if (!on_repair(member.name, f.reason)) {
            continue;
        }
        repaired.add(f.idx);
        const repairQ = new CouncilQuestion({
            mode: round_question.mode,
            user_prompt:
                `${round_question.user_prompt}\n\n---\n\n` +
                `REPAIR RE-PROMPT (${f.reason}). Your previous reply this round did not ` +
                `advance the debate. Respond again: either a genuinely updated position ` +
                `naming the specific flaw that moved you, or an explicit defense with NEW evidence.`,
            max_tokens: round_question.max_tokens,
        });
        const rr = _run_round([member], repairQ, budget, spent, round_opts);
        const r0 = rr[0];
        if (r0 !== undefined && r0.error === null && r0.text.trim() !== '') {
            out[f.idx] = r0;
        }
    }
    return out;
}

export interface RunDebateOptions {
    budget?: CostBudget | null;
    table?: PriceTable | null;
    on_overrun?: OnOverrunCallback | null;
    project?: ProjectContext | null;
    original_ask?: string;
    max_rounds?: number;
    /**
     * Third argument (road-to-cache-economy Phase 4): the observed
     * wall-clock gap, in ms, between the PREVIOUS round finishing (≈ when
     * its stable prefix was written to the prompt cache) and THIS round
     * starting (≈ when the same prefix would be read, if byte-identical).
     * `null` on round 1 — nothing was written yet. Existing callers that
     * declare only the first two parameters keep working unchanged (JS
     * ignores extra call arguments).
     */
    on_round_complete?:
        | ((
              round_number: number,
              responses: CouncilResponse[],
              cache_gap_ms_since_previous_round?: number | null,
          ) => void)
        | null;
    on_continue?: DebateContinuePrompt | null;
    advisor_plans?: Map<string, AdvisorPlan> | null;
    seed_round_1?: CouncilResponse[] | null;
    /**
     * Injectable wall-clock source for the Phase-4 gap measurement above.
     * Defaults to `Date.now`. Tests inject a scripted clock so "rounds
     * seconds apart" vs "a >5-minute gap" can be asserted deterministically,
     * without a real multi-minute sleep.
     */
    now?: (() => number) | null;
    /**
     * Phase 3: when true (from `ai_council.debate_gates.enabled`), round-2+
     * prompts carry the anti-conformity directive. Default `false` → the debate
     * prompt is byte-identical to today.
     */
    debate_gates?: boolean;
    /**
     * Phase 3 repair transport, per the 2026-07-12 council policy
     * (`debate_gates.repair_action`): the CLI passes `() => true` under
     * `--auto-continue` (auto-fire under the cap) or an interactive one-line
     * confirm otherwise. `null`/absent → gates detect but never dispatch
     * (no unplanned spend without an explicit transport).
     */
    on_repair?: ((member: string, reason: string) => boolean) | null;
    /**
     * Phase 3 restate pass (`ai_council.restate.enabled` / `--restate`): a
     * pre-round-1 billable call per member collecting a <=50-word restatement
     * + one alternative framing. Default off -> no extra calls, byte-identical.
     */
    restate?: boolean;
    /** Receives the restate responses (rendering, divergence flags, cost). */
    on_restate?: ((responses: CouncilResponse[]) => void) | null;
    /**
     * Mid-flight cli→api fallback for every call this debate makes — the
     * restate pass, each round, and the gate-repair re-prompts. Absent →
     * byte-identical to today.
     *
     * ONE ledger and one twin map span the whole invocation, never one per
     * round: the eligible classes are overwhelmingly DURABLE, so a per-round
     * ledger would re-spawn and re-fail the dead CLI once per round. Why that
     * scope needs the twin map to be coherent at all, and what it costs a
     * transient failure: `mid_flight_fallback.TwinMap`.
     */
    cli_fallback?: CliFallbackOptions | null;
}

/**
 * Run a structured multi-round debate with progressive disclosure.
 *
 * Returns every completed round in order — caller persists each
 * round incrementally via `on_round_complete` for crash safety.
 *
 * Round 1: each member produces an initial position. When
 * `seed_round_1` is provided, it is reused verbatim (no calls) so
 * `/council debate --continue-as-debate` can pivot from an existing
 * `/council default` session.
 *
 * Round 2+: `_augment_for_debate_round` wraps the original prompt
 * with anonymised prior positions and asks each member for a
 * rebuttal addressed at the strongest opposing view.
 *
 * Between rounds: `on_continue(checkpoint)` is consulted. Returning
 * False stops the debate; the caller receives every completed round.
 * `None` (the default) auto-continues — the CLI wires its
 * interactive y/N prompt here, `--auto-continue` passes `None`.
 *
 * Hard cap: before kicking off round N+1, the orchestrator compares
 * `spent_usd + next_round_estimate` to `budget.max_total_usd`. A
 * projected breach raises `DebateCapExceeded`; the CLI catches it
 * after persisting the partial debate.
 */
export function run_debate(
    members: ExternalAIClient[],
    question: CouncilQuestion,
    opts: RunDebateOptions = {},
): CouncilResponse[][] {
    const budget0 = opts.budget ?? null;
    const table = opts.table ?? null;
    const on_overrun = opts.on_overrun ?? null;
    const project = opts.project ?? null;
    const original_ask = opts.original_ask ?? '';
    const max_rounds = opts.max_rounds ?? 2;
    const on_round_complete = opts.on_round_complete ?? null;
    const on_continue = opts.on_continue ?? null;
    const advisor_plans = opts.advisor_plans ?? null;
    const seed_round_1 = opts.seed_round_1 ?? null;
    const now = opts.now ?? Date.now;

    if (max_rounds < 1) {
        throw new Error(`max_rounds must be >= 1 (got ${max_rounds})`);
    }
    if (members.length === 0) {
        return [];
    }
    const budget = budget0 ?? new CostBudget();
    if (members.length > budget.max_calls) {
        throw new Error(
            `Debate has ${members.length} members but budget caps at ` +
                `${budget.max_calls} calls.`,
        );
    }

    const spent: Spent = { input: 0, output: 0, usd: 0.0 };
    // One per invocation: restate pass, rounds, and gate repairs share it.
    const cli_fallback = opts.cli_fallback ?? null;
    const fallback_ledger = cli_fallback !== null ? new MidFlightFallback() : null;
    const fallback_twins =
        cli_fallback !== null ? new Map<string, EstablishedTwin>() : null;
    const all_rounds: CouncilResponse[][] = [];
    // A3 read unlock (debate twin): stable prefix = the original prompt; the
    // per-round positions block rides in a volatile suffix (see consult loop).
    let current_suffix = '';
    let current_user_prompt = question.user_prompt;
    // road-to-cache-economy Phase 4: wall-clock marker for the inter-round
    // cache-gap measurement. `null` until round 1 finishes.
    let previous_round_end_ms: number | null = null;

    // Phase 3 restate: one pre-round-1 call per member. Runs BEFORE any debate
    // spend so a diverging restatement can be flagged before round-2 cost.
    if (opts.restate === true) {
        const restateQ = new CouncilQuestion({
            mode: question.mode,
            user_prompt:
                `Before the debate begins: RESTATE the question below in at most 50 words, ` +
                `then offer ONE alternative framing of it. Do not argue a position yet.\n\n---\n\n` +
                `${question.user_prompt}`,
            max_tokens: question.max_tokens,
        });
        const restated = _run_round(members, restateQ, budget, spent, {
            table,
            on_overrun,
            project,
            original_ask,
            advisor_plans,
            cli_fallback,
            fallback_ledger,
            fallback_twins,
        });
        opts.on_restate?.(restated);
    }

    for (let round_idx = 0; round_idx < max_rounds; round_idx++) {
        const round_number = round_idx + 1;
        const round_start_ms = now();
        const cache_gap_ms_since_previous_round: number | null =
            previous_round_end_ms === null ? null : round_start_ms - previous_round_end_ms;
        let results: CouncilResponse[];
        if (round_idx === 0 && seed_round_1 !== null) {
            // Pivot from /council default — reuse the existing round 1
            // verbatim. No calls billed; spend stays at $0 until round 2.
            results = [...seed_round_1];
        } else {
            const round_question =
                round_idx === 0
                    ? question
                    : new CouncilQuestion({
                          mode: question.mode,
                          user_prompt: current_user_prompt,
                          max_tokens: question.max_tokens,
                      });
            results = _run_round(members, round_question, budget, spent, {
                table,
                on_overrun,
                project,
                original_ask,
                advisor_plans,
                cli_fallback,
                fallback_ledger,
                fallback_twins,
                split: current_suffix
                    ? { stable: question.user_prompt, suffix: current_suffix }
                    : null,
            });
        }

        if (opts.debate_gates === true && round_idx > 0 && all_rounds.length > 0) {
            results = _run_debate_gate_repairs(
                members,
                results,
                all_rounds[all_rounds.length - 1] as CouncilResponse[],
                // round_idx > 0 here, so current_user_prompt IS this round's prompt.
                new CouncilQuestion({
                    mode: question.mode,
                    user_prompt: current_user_prompt,
                    max_tokens: question.max_tokens,
                }),
                budget,
                spent,
                {
                    table,
                    on_overrun,
                    project,
                    original_ask,
                    advisor_plans,
                    cli_fallback,
                    fallback_ledger,
                    fallback_twins,
                },
                opts.on_repair ?? null,
            );
        }
        all_rounds.push(results);
        if (on_round_complete !== null) {
            on_round_complete(round_number, results, cache_gap_ms_since_previous_round);
        }

        // Prep the user-prompt for the next round so the cost estimate
        // below covers the augmented bytes.
        if (round_idx + 1 < max_rounds) {
            current_suffix = _debate_suffix(
                results,
                round_number + 1,
                opts.debate_gates ?? false,
            );
            current_user_prompt = `${question.user_prompt}${current_suffix}`;
            // Hard-cap + continue-prompt gating before kicking off N+1.
            let next_round_usd: number;
            if (table !== null) {
                const next_question = new CouncilQuestion({
                    mode: question.mode,
                    user_prompt: current_user_prompt,
                    max_tokens: question.max_tokens,
                });
                const next_estimates = estimate(next_question, members, table, {
                    project,
                    original_ask,
                    advisor_plans,
                });
                next_round_usd = next_estimates.reduce(
                    (acc, e) => acc + _total_usd(e),
                    0,
                );
            } else {
                next_round_usd = 0.0;
            }

            if (
                budget.max_total_usd > 0 &&
                spent.usd + next_round_usd > budget.max_total_usd
            ) {
                throw new DebateCapExceeded({
                    completed_round: round_number,
                    cost_so_far: spent.usd,
                    next_estimate: next_round_usd,
                    cap: budget.max_total_usd,
                });
            }

            if (on_continue !== null) {
                const checkpoint = new DebateCheckpoint({
                    completed_round: round_number,
                    total_planned_rounds: max_rounds,
                    cost_so_far_usd: spent.usd,
                    next_round_estimate_usd: next_round_usd,
                    last_round_responses: results,
                });
                if (!on_continue(checkpoint)) {
                    return all_rounds;
                }
            }
        }
        // road-to-cache-economy Phase 4: mark the end of this round AFTER the
        // continue-prompt gate above — an interactive pause there is exactly
        // the kind of real-world inter-round gap this measurement exists to
        // observe, so it must fall inside the window, not before it.
        previous_round_end_ms = now();
    }

    return all_rounds;
}

/**
 * Bundle returned by `run_peer_review()` (Phase 5 / F1).
 *
 * `responses` carries the per-reviewer critiques. `label_to_source`
 * is the anonymisation map captured server-side so the audit-trail
 * JSON can rehydrate it without leaking provider identity to the
 * member at prompt time.
 *
 * `persona_labels` is the (optional) Phase 6 / Step 3a wiring: when
 * the deliberation was an advisor-mode run, the source → persona
 * map flows through to the renderer so peer-review output can render
 * as `Response A (Contrarian)`. Plain-member runs leave it empty.
 */
export class PeerReviewResult {
    responses: CouncilResponse[];
    /**
     * PER-REVIEWER label→source attribution — the authoritative mapping.
     *
     * Keyed by `provider:model`, because that is the identity `by_source` uses and the
     * identity a quote in the artefact has to resolve against. Added by step 1.2 of
     * `road-to-council-evidence-integrity`: each reviewer sees a DIFFERENT
     * self-filtered subset, and `anonymize_responses` restarts its label counter per
     * call, so `Response-A` means a different member for every reviewer. One map
     * cannot express that.
     */
    label_to_source_by_reviewer: Map<string, Map<string, string>>;
    /**
     * Flat compatibility view — the LAST reviewer's mapping, kept only because
     * `council_cli.ts:1480` serialises this field and `:1492` reads it back.
     *
     * It is wrong for any reviewer but the last, and it is retained rather than
     * removed so the serialisation contract does not break in the same change that
     * fixes the attribution. Read `label_to_source_by_reviewer` for anything that
     * resolves a quote.
     */
    label_to_source: Map<string, string>;
    persona_labels: Map<string, string>;

    constructor(args: {
        responses: CouncilResponse[];
        label_to_source_by_reviewer?: Map<string, Map<string, string>>;
        label_to_source: Map<string, string>;
        persona_labels: Map<string, string>;
    }) {
        this.responses = args.responses;
        this.label_to_source_by_reviewer = args.label_to_source_by_reviewer ?? new Map();
        this.label_to_source = args.label_to_source;
        this.persona_labels = args.persona_labels;
    }
}

export interface RunPeerReviewOptions {
    budget?: CostBudget | null;
    table?: PriceTable | null;
    on_overrun?: OnOverrunCallback | null;
    project?: ProjectContext | null;
    original_ask?: string;
    max_tokens?: number;
    persona_labels?: Map<string, string> | null;
}

/**
 * Karpathy peer-review pass (Phase 5 / F1).
 *
 * After the final deliberation round, each member sees the OTHER
 * members' deliberation outputs under neutral `Response-A` labels
 * (provider identity stripped; advisor persona labels preserved per
 * Phase 6 Step 3a) and emits a Karpathy-style critique:
 * strongest / weakest blind spot / what all missed / refinement.
 *
 * Members never see their own response — the orchestrator filters
 * self before building the anonymised prompt. Errors in one member's
 * pass tag that member but never abort the round.
 *
 * Cost gates flow through `consult([member], ...)`, so the same
 * budget + daily-ledger semantics as deliberation apply.
 */
export function run_peer_review(
    members: ExternalAIClient[],
    deliberation_responses: CouncilResponse[],
    opts: RunPeerReviewOptions = {},
): PeerReviewResult {
    const budget = opts.budget ?? null;
    const table = opts.table ?? null;
    const on_overrun = opts.on_overrun ?? null;
    const project = opts.project ?? null;
    const original_ask = opts.original_ask ?? '';
    const max_tokens = opts.max_tokens ?? DEFAULT_MAX_TOKENS;

    if (members.length === 0 || deliberation_responses.length === 0) {
        return new PeerReviewResult({
            responses: [],
            label_to_source: new Map(),
            persona_labels: new Map(),
        });
    }

    const member_by_name = new Map<string, ExternalAIClient>();
    for (const m of members) {
        member_by_name.set(m.name, m);
    }
    // ── source map: deliberation responses keyed by `provider:model` ─
    // Errors and empty bodies are skipped — they leak nothing useful
    // and would clutter the anonymised prompt with blanks.
    const by_source = new Map<string, CouncilResponse>();
    for (const r of deliberation_responses) {
        if (r.error || !_pyStrip(r.text)) {
            continue;
        }
        const source = `${r.provider}:${r.model}`;
        by_source.set(source, r);
    }

    if (by_source.size < 2) {
        // Peer-review needs ≥ 2 distinct deliberation outputs (a
        // reviewer with nothing else to review is a no-op).
        return new PeerReviewResult({
            responses: [],
            label_to_source: new Map(),
            persona_labels: new Map(),
        });
    }

    const persona_labels = new Map<string, string>(opts.persona_labels ?? []);
    const review_responses: CouncilResponse[] = [];
    // ── What is deterministic here, and what is NOT — corrected 2026-08-23 (step 1.3).
    //
    // DETERMINISTIC: the iteration order of `by_source`, and therefore the input order
    // handed to `anonymize_responses`. Two runs over the same config produce the same
    // per-reviewer mapping.
    //
    // NOT deterministic ACROSS REVIEWERS, and this is what the old comment got wrong by
    // calling it "the deterministic A/B mapping": every reviewer receives a different
    // self-filtered subset, and `anonymize_responses` restarts its label counter on each
    // call (`consensus.ts:437`). So `Response-A` denotes a DIFFERENT member for every
    // reviewer, by construction. A single map cannot express that, and the one that used
    // to live here was overwritten per reviewer — so the artefact carried the last
    // reviewer's mapping for every quote in it.
    //
    // `by_reviewer` is the authoritative structure. `last_label_to_source` survives only
    // as the serialised compatibility field (`council_cli.ts:1480`/`:1492`).
    const label_to_source_by_reviewer = new Map<string, Map<string, string>>();

    for (const reviewer of members) {
        const scorer = `${reviewer.name}:${reviewer.model}`;
        if (!member_by_name.has(reviewer.name)) {
            continue;
        }
        const others_pairs: Array<[string, string]> = [];
        for (const [src, resp] of by_source) {
            if (src !== scorer) {
                others_pairs.push([src, resp.text]);
            }
        }
        if (others_pairs.length === 0) {
            continue;
        }
        // Step 1.5 — SEEDED order, not input order.
        //
        // Before this, `others_pairs` reached `anonymize_responses` in `by_source`
        // iteration order, so which member became `Response-A` was a pure function of
        // config order: identical across runs AND inferable from position. That is the
        // leak `blind_review.ts:52-54` already argues against for its own path ("which
        // pair becomes `Response-A` is not simply input order, so position alone leaks
        // nothing") — the two paths contradicted each other in code until now.
        //
        // Seed = the original ask plus the deliberation bodies. Run-scoped and
        // REPLAYABLE from the artefact's own contents; never `Math.random`, never
        // `Date`, because a label order nobody can reproduce makes the de-anonymization
        // block unverifiable. The reviewer is deliberately NOT in the seed: one shuffle
        // per run, so a reader comparing two reviewers' critiques of the same member is
        // comparing the same label.
        const shuffle_seed = [opts.original_ask ?? '', ...[...by_source.values()].map((r) => r.text)].join('\0');
        const order = deterministic_shuffle_indices(shuffle_seed, others_pairs.length);
        const shuffled_pairs = order.map((i) => others_pairs[i]!);
        const [anon_text, label_to_source] = anonymize_responses(shuffled_pairs, {
            persona_labels,
        });
        if (anon_text.size === 0) {
            continue;
        }
        label_to_source_by_reviewer.set(scorer, label_to_source);
        const question = new CouncilQuestion({
            mode: 'prompt',
            user_prompt: build_peer_review_user_prompt(anon_text),
            max_tokens,
        });
        const reviewed = consult([reviewer], question, budget, {
            table,
            on_overrun,
            project,
            original_ask,
        });
        review_responses.push(...reviewed);
    }

    // DERIVED after the loop, never assigned inside it (step 1.2's verify is a grep for
    // exactly that). The compatibility field is the last reviewer's mapping, and deriving
    // it here rather than accumulating it makes that explicit: nothing in the loop
    // pretends to maintain a run-wide map.
    const reviewer_maps = [...label_to_source_by_reviewer.values()];
    const flat_compat = reviewer_maps.length === 0 ? new Map<string, string>() : reviewer_maps[reviewer_maps.length - 1]!;

    return new PeerReviewResult({
        responses: review_responses,
        label_to_source_by_reviewer,
        label_to_source: flat_compat,
        persona_labels,
    });
}

/**
 * Bundle returned by `run_consensus_scoring()`.
 *
 * `bucket` is renderer-ready; `findings`, `scores`, and `metadata`
 * are kept for audit-trail JSON (council-sessions/*.json).
 */
export class ConsensusResult {
    bucket: ConsensusBucket;
    findings: Finding[];
    scores: FindingScore[];
    metadata: Map<string, ConsensusMetadata>;
    /**
     * Per-member extraction outcome, keyed by `provider:model` — step 2.2 of
     * `road-to-council-evidence-integrity`.
     *
     * `parsed` · `parsed-after-reask` · `empty` · `parse_failed`. Recorded rather than
     * derived from the findings count, because "found nothing" and "could not be read"
     * are different facts and a count cannot tell them apart — which is exactly how an
     * unparseable answer used to read as a clean zero-findings review.
     *
     * `parsed-after-reask` is deliberately distinct from `parsed`: a member needing a
     * second ask is a signal about the prompt or the member, and folding it into `parsed`
     * would hide the only evidence that the re-ask does anything.
     *
     * Additive and optional, so no existing constructor call changes.
     */
    parse_outcomes: Map<string, string>;
    extraction_responses: CouncilResponse[];
    scoring_responses: CouncilResponse[];

    constructor(args: {
        bucket: ConsensusBucket;
        findings: Finding[];
        scores: FindingScore[];
        metadata: Map<string, ConsensusMetadata>;
        parse_outcomes?: Map<string, string>;
        extraction_responses: CouncilResponse[];
        scoring_responses: CouncilResponse[];
    }) {
        this.bucket = args.bucket;
        this.findings = args.findings;
        this.scores = args.scores;
        this.metadata = args.metadata;
        this.parse_outcomes = args.parse_outcomes ?? new Map();
        this.extraction_responses = args.extraction_responses;
        this.scoring_responses = args.scoring_responses;
    }
}

export interface RunConsensusScoringOptions {
    budget?: CostBudget | null;
    table?: PriceTable | null;
    on_overrun?: OnOverrunCallback | null;
    project?: ProjectContext | null;
    original_ask?: string;
    max_tokens?: number;
    strong_threshold?: number;
    minority_threshold?: number;
}

/**
 * Two-pass consensus round (Phase 4 / F3).
 *
 * Pass 1 — extraction: each member re-emits its own deliberation as
 * a JSON array of `{id, text}` findings. Pass 2 — scoring: each
 * member sees the *other* members' findings under anonymous labels
 * and rates them 1-10 + agree/disagree + reason.
 *
 * The cost budget is shared across both passes; the daily ledger
 * receives both. Errors in one member's extraction or scoring tag
 * that member but never abort the round.
 */
export function run_consensus_scoring(
    members: ExternalAIClient[],
    deliberation_responses: CouncilResponse[],
    opts: RunConsensusScoringOptions = {},
): ConsensusResult {
    const budget = opts.budget ?? null;
    const table = opts.table ?? null;
    const on_overrun = opts.on_overrun ?? null;
    const project = opts.project ?? null;
    const original_ask = opts.original_ask ?? '';
    const max_tokens = opts.max_tokens ?? DEFAULT_MAX_TOKENS;
    const strong_threshold = opts.strong_threshold ?? 0.7;
    const minority_threshold = opts.minority_threshold ?? 0.4;

    if (members.length === 0 || deliberation_responses.length === 0) {
        return new ConsensusResult({
            bucket: new ConsensusBucket(),
            findings: [],
            scores: [],
            metadata: new Map(),
            extraction_responses: [],
            scoring_responses: [],
        });
    }

    // ── Pass 1: extraction ──────────────────────────────────────────
    const member_by_name = new Map<string, ExternalAIClient>();
    for (const m of members) {
        member_by_name.set(m.name, m);
    }
    const extraction_responses: CouncilResponse[] = [];
    const all_findings: Finding[] = [];
    // Per-member extraction outcome — step 2.2. Recorded rather than derived from the
    // findings count, because "zero findings" and "could not be read" are different facts
    // and the count cannot tell them apart. `parsed-after-reask` is kept distinct from
    // `parsed`: a member that needed a second ask is a signal about the prompt or the
    // member, and collapsing it into `parsed` would hide the only evidence that the
    // re-ask is doing anything.
    const parse_outcomes = new Map<string, string>();
    for (const resp of deliberation_responses) {
        const member = member_by_name.get(resp.provider);
        if (member === undefined || resp.error || !_pyStrip(resp.text)) {
            continue;
        }
        const question = new CouncilQuestion({
            mode: 'prompt',
            user_prompt: build_extraction_user_prompt(resp.text),
            max_tokens,
        });
        const extracted = consult([member], question, budget, {
            table,
            on_overrun,
            project,
            original_ask,
        });
        extraction_responses.push(...extracted);
        if (extracted.length === 0 || extracted[0]!.error) {
            continue;
        }
        const source = `${member.name}:${member.model}`;
        let ex = parse_findings_outcome(extracted[0]!.text, { source });

        // Step 2.2 — ONE bounded re-ask on `parse_failed`, and one only.
        //
        // A member that said something no parser could read used to be indistinguishable
        // from a member that found nothing: `parse_findings_response` returned `[]` for
        // both, and this loop pushed the empty array with no branch. So an unparseable
        // answer counted as a clean zero-findings review.
        //
        // ONE re-ask, not a loop. A re-ask is a paid call, and an unbounded retry turns
        // one unparseable answer into open-ended spend — the failure mode the N=3
        // validation budget exists for, reached here by a different road. `empty` is NOT
        // re-asked: a member that said nothing has nothing to restate, and re-asking it
        // buys a second silence.
        if (ex.outcome === 'parse_failed') {
            const retry_q = new CouncilQuestion({
                mode: 'prompt',
                user_prompt:
                    build_extraction_user_prompt(resp.text) +
                    '\n\nYour previous answer could not be parsed. Reply with ONLY a JSON ' +
                    'array of {"id": string, "text": string} objects, no prose before or ' +
                    'after it. An empty array [] is a valid answer meaning you found nothing.',
                max_tokens,
            });
            const retried = consult([member], retry_q, budget, {
                table,
                on_overrun,
                project,
                original_ask,
            });
            extraction_responses.push(...retried);
            if (retried.length > 0 && !retried[0]!.error) {
                ex = parse_findings_outcome(retried[0]!.text, { source });
            }
            parse_outcomes.set(source, ex.outcome === 'parsed' ? 'parsed-after-reask' : 'parse_failed');
        } else {
            parse_outcomes.set(source, ex.outcome);
        }
        all_findings.push(...ex.findings);
    }

    if (all_findings.length === 0) {
        return new ConsensusResult({
            bucket: new ConsensusBucket(),
            findings: [],
            scores: [],
            metadata: new Map(),
            parse_outcomes,
            extraction_responses,
            scoring_responses: [],
        });
    }

    // ── Pass 2: scoring (each member rates the OTHERS' findings) ────
    const scoring_responses: CouncilResponse[] = [];
    const all_scores: FindingScore[] = [];
    for (const member of members) {
        const scorer = `${member.name}:${member.model}`;
        const others = all_findings.filter((f) => f.source !== scorer);
        if (others.length === 0) {
            continue;
        }
        const anon = anonymize_findings(others);
        const label_to_id = new Map<string, string>();
        const anon_text = new Map<string, string>();
        for (const [label, f] of anon) {
            label_to_id.set(label, f.id);
            anon_text.set(label, f.text);
        }
        const question = new CouncilQuestion({
            mode: 'prompt',
            user_prompt: build_scoring_user_prompt(anon_text),
            max_tokens,
        });
        const scored = consult([member], question, budget, {
            table,
            on_overrun,
            project,
            original_ask,
        });
        scoring_responses.push(...scored);
        if (scored.length === 0 || scored[0]!.error) {
            continue;
        }
        for (const s of parse_scores_response(scored[0]!.text, { scorer })) {
            const real_id = label_to_id.get(s.finding_id);
            if (real_id === undefined) {
                continue;
            }
            all_scores.push(
                new FindingScore(real_id, s.scorer, s.score, s.agree, s.reason),
            );
        }
    }

    const metadata = aggregate_scores(all_findings, all_scores);
    const bucket = bucket_by_threshold(all_findings, metadata, {
        strong: strong_threshold,
        minority: minority_threshold,
    });
    return new ConsensusResult({
        bucket,
        findings: all_findings,
        scores: all_scores,
        metadata,
        parse_outcomes,
        extraction_responses,
        scoring_responses,
    });
}

/**
 * Format the per-member meta line — tokens, cost (or subscription), latency.
 *
 * Phase 5 / Step 1 — non-billable vendor-CLI calls render
 * `cost: subscription (<label>)` with no token detail (the local
 * session counted them but the user is on a flat rate). Billable
 * calls (api or community CLI) render `cost: $X.XXXX` plus tokens.
 * Tokens marked `estimated=True` get a `~` prefix so the audit
 * trail flags heuristic counts.
 */

// Lens defaults for the Phase 9 confidence-explanation badge. The PR
// lens stays terse so the existing "Must-fix / Nice-to-have" structure
// isn't drowned in scorer prose; every other decision lens shows the
// explanation by default. Creative lenses (design/optimize) never reach
// this code path because they skip consensus scoring entirely.
const _DEFAULT_EXPLAIN_LENSES: ReadonlySet<string> = new Set([
    'default',
    'analysis',
    'debate',
    'prompt',
    'roadmap',
    'diff',
    'files',
]);

/**
 * Decide whether the confidence-explanation badge fires by default.
 *
 * Pulled into a helper so the CLI `--explain-confidence` /
 * `--no-explain-confidence` flags and the lens override path share
 * one truth source.
 */
function _default_explain_confidence(mode: string | null): boolean {
    if (mode === null) {
        return true;
    }
    return _DEFAULT_EXPLAIN_LENSES.has(mode);
}

export interface RenderOptions {
    mode?: string | null;
    prose_synthesis?: boolean | null;
    consensus?: ConsensusResult | null;
    peer_review?: PeerReviewResult | null;
    explain_confidence?: boolean | null;
    /**
     * Phase 1 (stance tally): when true, a `### Vote Tally` block — computed
     * deterministically from the final-round response texts — is rendered
     * before the Convergence / Divergence slot. Default `false` → byte-identical.
     */
    stance_tally?: boolean;
    /**
     * Phase 2 (chairman): when a chairman-authored synthesis exists (persisted
     * in the payload), it REPLACES the template in the Convergence/Divergence
     * slot, prefixed by the visible annotation. Absent/null → byte-identical.
     */
    chairman?: { member: string | null; annotation: string; text: string | null } | null;
    /**
     * Ü3 (road-to-council-blind-review Phase 1): when true, the synthesis
     * template gains the two mandatory chairman fields (Collective blind
     * spot / One-line verdict). Default `false` → byte-identical.
     */
    chairman_fields?: boolean;
    /**
     * Ü1 host-path blind render (road-to-council-blind-review Phase 1): when
     * set, response blocks are headed by their blind label (`## Response A`)
     * instead of `## <provider> · <model>`, and a de-anonymization map is
     * appended AFTER the synthesis slot. Only meaningful when no member
     * chairman ran — the member-chairman path embeds its own de-anon block
     * directly in `chairman.text`. Default `null` → byte-identical.
     */
    blind?: { label_to_source: ReadonlyMap<string, string> } | null;
    /**
     * Phase 3.2 (road-to-always-on-orchestration): members that produced no
     * usable response this pass, rendered as a trailing section so the
     * human-readable report shows the same graded-degradation picture the
     * session manifest carries structurally. Default `null`/empty →
     * byte-identical — no existing caller passes this, so no existing
     * output changes.
     */
    absent_members?: readonly RenderAbsentMember[] | null;
    /**
     * Phase 3.3: this pass's quorum verdict, rendered as one line right
     * before the absent-members section (or standalone when there is
     * nothing absent to report). Default `null` → byte-identical.
     */
    quorum?: QuorumResult | null;
    /**
     * Phase 4.1: the verdict → handoff envelope, rendered as a `### Handoff`
     * section right after the Convergence/Divergence slot — closest to the
     * synthesis it was extracted from, ahead of the trailing quorum/absent
     * bookkeeping. Rendered only when at least one field is non-`null`
     * (`isEmptyHandoff` — an all-null envelope has nothing worth a section
     * for, same "only show when there's substance" call `absent_members`
     * makes). Default `null` → byte-identical.
     */
    handoff?: HandoffEnvelope | null;
}

/** The minimal shape `render()` needs for one absent-member row. */
export interface RenderAbsentMember {
    readonly member: string;
    readonly reason: AbsentReason | null;
    readonly detail: string;
}

/**
 * Render stacked sections + a lens-aware synthesis prompt slot.
 *
 * `mode` selects the synthesis template from `prompts.synthesis_template`.
 * `None` collapses to the default decision-lens template (back-compat).
 *
 * `prose_synthesis` is the R4 Q4 escape hatch:
 *   - `True`  → force creative-lens passthrough (bare slot) regardless of mode
 *   - `False` → force decision-lens default template even on creative lenses
 *   - `None`  → honour the lens default from the table
 *
 * `consensus` (Phase 4 / F3) prepends Strong Consensus / Findings /
 * Minority Views sections when the analysis lens scored its findings.
 *
 * `peer_review` (Phase 5 / F1) appends a Peer-Review block listing
 * each member's critique (under Reviewer-A / Reviewer-B labels, in
 * member input order so the audit trail is deterministic) and
 * extends the synthesis template with the
 * `Peer-Review-Surfaced Blind Spots` addendum.
 */
export function render(responses: CouncilResponse[], opts: RenderOptions = {}): string {
    const mode = opts.mode ?? null;
    const prose_synthesis = opts.prose_synthesis ?? null;
    const consensus = opts.consensus ?? null;
    const peer_review = opts.peer_review ?? null;
    const explain_confidence = opts.explain_confidence ?? null;
    // Ü1 host-path blind render: reverse the persisted `label -> provider:model`
    // map so each response block can look up its own blind label by source.
    const blind = opts.blind ?? null;
    const source_to_label =
        blind !== null
            ? new Map<string, string>(
                  Array.from(blind.label_to_source.entries()).map(([label, source]) => [source, label]),
              )
            : null;

    const blocks: string[] = [];
    const explain =
        explain_confidence !== null
            ? explain_confidence
            : _default_explain_confidence(mode);
    if (
        consensus !== null &&
        (consensus.bucket.strong.length > 0 ||
            consensus.bucket.findings.length > 0 ||
            consensus.bucket.minority.length > 0)
    ) {
        blocks.push(_render_consensus(consensus.bucket, explain));
    }
    for (const r of responses) {
        const blind_label = source_to_label?.get(`${r.provider}:${r.model}`) ?? null;
        const header = blind_label !== null ? `## ${blind_label}` : `## ${r.provider} · ${r.model}`;
        if (r.error) {
            blocks.push(`${header}\n\n*ERROR:* \`${r.error}\``);
            continue;
        }
        const meta = renderResponseMeta(r, { pyFixed: _pyFixed });
        blocks.push(`${header}\n\n${meta}\n\n${r.text}`);
    }
    if (peer_review !== null && peer_review.responses.length > 0) {
        blocks.push(_render_peer_review(peer_review));
    }
    let template: string;
    if (prose_synthesis === true) {
        template = '';
    } else if (prose_synthesis === false) {
        template = synthesis_template('default');
    } else {
        template = synthesis_template(mode);
    }
    if (peer_review !== null && peer_review.responses.length > 0) {
        const addendum = peer_review_synthesis_addendum();
        template = template ? `${template}\n${addendum}` : _pyLStrip(addendum);
    }
    if (opts.chairman_fields === true) {
        // Ü3: two mandatory trailing sections, composed after any peer-review
        // addendum so both extensions stack predictably.
        template = template ? `${template}\n\n${CHAIRMAN_FIELDS_ADDENDUM}` : CHAIRMAN_FIELDS_ADDENDUM;
    }
    if (opts.stance_tally === true && template !== '') {
        // Phase 2.1: the synthesis owes the same machine-readable closing line
        // the members owe. Appended only when a tally will be rendered — there
        // is nothing to check a verdict against otherwise. Composed last so it
        // is the final instruction, matching the contract's "and nothing after
        // it". The template's own `VERDICT: <option-label>` placeholder is
        // parsed as absent (see `parse_verdict_line`), so the un-summarised
        // render stays green.
        //
        // The `template !== ''` guard is load-bearing: an empty template is
        // `prose_synthesis: true`, documented at `:1859-1862` as a BARE slot.
        // Appending here would replace `*to be summarised by the host agent*`
        // with raw contract instructions and silently override an option the
        // caller set on purpose — a creative-lens pass would start reading like
        // a filled-in form.
        template = `${template}\n\n${VERDICT_LINE_CONTRACT}`;
    }
    let body: string;
    if (template) {
        body = template;
    } else {
        body = '*to be summarised by the host agent*';
    }
    const chairman = opts.chairman ?? null;
    if (chairman !== null && chairman.text !== null && chairman.text.trim() !== '') {
        // Chairman-authored synthesis replaces the template; the annotation is
        // always visible (never a silent substitution).
        body = `_${chairman.annotation}_\n\n${chairman.text.trim()}`;
    } else if (chairman !== null) {
        body = `_${chairman.annotation}_\n\n${body}`;
    }
    if (opts.stance_tally === true) {
        // Phase 1: deterministic option-level tally from the final-round
        // response texts (the STANCE closing lines live IN the texts, so the
        // render is a pure projection — no config or transport needed here).
        const tally = tally_stances(
            responses
                .filter((r) => !r.error)
                .map((r) => ({ member: `${r.provider}:${r.model}`, text: r.text })),
        );
        blocks.push(render_vote_tally(tally));
        // Phase 2.1: the verdict half of the same projection. A synthesis that
        // states a `VERDICT:` line the tally did not clear is contradicting its
        // own count, and the reader of the rendered pass is exactly who needs to
        // see that.
        //
        // Surfaced, never thrown, and the ordering above is part of the fix: a
        // throw here would discard the whole artifact — every member response,
        // the peer review, the quorum bookkeeping — AFTER every provider call
        // was paid for, which is the hazard this roadmap already recorded for
        // the sibling shape check. `describe_verdict_mismatch` returns the
        // string; `assert_synthesis_matches_tally` still throws for a caller
        // holding a finished synthesis it can refuse.
        //
        // Conditional by construction: an absent verdict line yields null, so
        // every synthesis written before the contract shipped stays byte-identical.
        const mismatch = describe_verdict_mismatch(body, tally);
        if (mismatch !== null) {
            blocks.push(`> **Verdict/tally mismatch:** ${mismatch}`);
        }
    }
    blocks.push(`## Convergence / Divergence\n\n${body}`);
    // Phase 4.1: closest to the synthesis it was extracted from — ahead of
    // the de-anonymization map and the trailing quorum/absent bookkeeping.
    // An all-null envelope renders nothing (`isEmptyHandoff`), so a caller
    // that always attaches one (the common shape once a producer wires
    // this in) does not spam every response with "nothing to hand off".
    if (opts.handoff && !isEmptyHandoff(opts.handoff)) {
        blocks.push(_render_handoff(opts.handoff));
    }
    if (blind !== null) {
        // Ü1: de-anonymization AFTER the synthesis slot — blind is only at
        // decision time, never the archive.
        blocks.push(render_deanonymization_block('### De-anonymization map', blind.label_to_source));
    }
    // Phase 3.2/3.3: trailing, opt-in sections — absent no caller passes
    // either option, so the join below adds nothing and every existing
    // render() output stays byte-identical.
    if (opts.quorum) {
        blocks.push(_render_quorum_line(opts.quorum));
    }
    const absent = opts.absent_members ?? [];
    if (absent.length > 0) {
        blocks.push(_render_absent_members(absent));
    }
    return blocks.join('\n\n---\n\n');
}

/**
 * One line naming the k-of-n outcome — machine-parseable, human-readable.
 *
 * The `solo` marker is the artifact half of the signal the `quorum_result`
 * event carries in the log: a pass concluded by ONE voice otherwise reads
 * identically to a full-attendance one, and the reader of a rendered pass is
 * exactly who needs to see the difference. Derived through `isSoloConcluded`
 * so the predicate keeps one definition and the renderer does not restate it.
 */
function _render_quorum_line(q: QuorumResult): string {
    const verdict = q.status === 'concluded' ? 'concluded' : 'INCONCLUSIVE — release gate holds';
    const solo = isSoloConcluded(q) ? ' · **solo** — one voice concluded this pass' : '';
    // The DEGRADED marker shipped on stdout (`council_cli.ts::_format_quorum_line`,
    // round 7 § 5.3) and did NOT ship here, although this function is the one
    // the mirror was copied FROM. The two then diverged in the worse direction:
    // stdout scrolls away, this string is what gets committed as evidence and
    // cited months later. `1/2 present, needed 1 — concluded` is literally true
    // and reads as agreement; the solo marker alone covers only present === 1,
    // so 2-of-4 rendered as plain "concluded" with nothing to stop a reader
    // inferring convergence. Same sentence as stdout on purpose — one wording,
    // so neither surface can drift into being the softer one again.
    const degraded =
        q.present < q.total
            ? `  ⚠️  DEGRADED — ${String(q.total - q.present)} member(s) did not answer; this is not convergence.`
            : '';
    return `**Quorum:** ${q.present}/${q.total} present, needed ${q.threshold} — ${verdict}.${solo}${degraded}`;
}

/**
 * `### Absent Members` — one row per member that never produced a usable
 * response this pass, naming the machine-readable reason when classified.
 */
function _render_absent_members(absent: readonly RenderAbsentMember[]): string {
    const lines = ['### Absent Members', ''];
    for (const a of absent) {
        const tag = a.reason !== null ? ` (${a.reason})` : '';
        lines.push(`- **${a.member}**${tag} — ${a.detail}`);
    }
    return lines.join('\n');
}

/**
 * `### Handoff` — the verdict → work-order envelope (Phase 4.1). Only
 * called once the caller already confirmed `!isEmptyHandoff(h)`, so at
 * least one field is populated; the other two still render their own
 * honest "none recorded" line rather than being silently dropped, so a
 * reader sees exactly what this pass did and did not extract.
 */
function _render_handoff(h: HandoffEnvelope): string {
    const lines = ['### Handoff', ''];
    lines.push(`**Decision:** ${h.decision ?? 'none recorded — no structured verdict this pass.'}`);
    lines.push('');
    if (h.rejected_alternatives !== null && h.rejected_alternatives.length > 0) {
        lines.push('**Rejected alternatives:**');
        lines.push('');
        for (const alt of h.rejected_alternatives) {
            lines.push(`- **${alt.option}** — ${alt.reason}`);
        }
    } else {
        lines.push('**Rejected alternatives:** none recorded.');
    }
    lines.push('');
    if (h.constraints !== null && h.constraints.length > 0) {
        lines.push('**Constraints:**');
        lines.push('');
        for (const c of h.constraints) {
            lines.push(`- ${c}`);
        }
    } else {
        lines.push('**Constraints:** none recorded.');
    }
    return lines.join('\n');
}

/**
 * Render the peer-review block under deterministic Reviewer labels.
 *
 * Each successful reviewer gets a `### Reviewer X` sub-section. Errors
 * keep their slot (so the audit trail still surfaces the breach) but
 * render `ERROR: <tag>` instead of the prompt body.
 */
function _render_peer_review(peer_review: PeerReviewResult): string {
    const lines: string[] = ['## Peer-Review (Karpathy)'];
    let label_idx = 0;
    for (const r of peer_review.responses) {
        const label = _label(label_idx);
        label_idx += 1;
        if (r.error) {
            lines.push(`### Reviewer ${label}\n\n*ERROR:* \`${r.error}\``);
            continue;
        }
        lines.push(`### Reviewer ${label}\n\n${_pyStrip(r.text)}`);
    }
    return lines.join('\n\n');
}

/**
 * Render Strong / Findings / Minority sections in renderer order.
 *
 * `explain` toggles the Phase 9 confidence-explanation badge — when
 * `False` the renderer falls back to the terse Phase 4 badge so the
 * PR lens (and any caller passing `--no-explain-confidence`) keeps
 * its compact output.
 */
function _render_consensus(bucket: ConsensusBucket, explain = true): string {
    const parts: string[] = [];
    if (bucket.strong.length > 0) {
        parts.push(
            '## Strong Consensus\n\n' + _render_bucket(bucket.strong, explain),
        );
    }
    if (bucket.findings.length > 0) {
        parts.push('## Findings\n\n' + _render_bucket(bucket.findings, explain));
    }
    if (bucket.minority.length > 0) {
        parts.push(
            '## Minority Views\n\n' +
                '*Sub-threshold by consensus; kept for audit trail.*\n\n' +
                _render_bucket(bucket.minority, explain),
        );
    }
    return parts.join('\n\n');
}

/**
 * Collapse a multi-line scorer reason to a single ≤`limit`-char line.
 *
 * Phase 9 — the dissent summary must fit on one line; we keep the
 * first sentence-ish chunk and add an ellipsis when truncating. Empty
 * reasons render as `no rationale`.
 */
function _truncate_reason(reason: string, limit = 120): string {
    const flat = reason ? _pySplitWhitespace(reason).join(' ') : '';
    if (!flat) {
        return 'no rationale';
    }
    if (_pyLen(flat) <= limit) {
        return flat;
    }
    return _pyRStrip(_pySlice(flat, 0, limit - 1)) + '…';
}

/**
 * Render one bucket of (finding, metadata) tuples.
 *
 * The Phase 4 terse badge (`strength · mean · scorers · dissent`)
 * is preserved on the first line. Phase 9 adds a second
 * confidence-explanation line whenever `explain` is true *and* at
 * least one scorer rated the finding — the explanation needs scorer
 * data to be meaningful.
 */
function _render_bucket(
    items: Array<[Finding, ConsensusMetadata]>,
    explain = true,
): string {
    const lines: string[] = [];
    for (const [f, m] of items) {
        const terse_badge =
            `strength ${_pyFixed(m.consensus_strength, 2)} · ` +
            `mean ${_pyFixed(m.mean_score, 1)}/10 · ` +
            `${m.scorers.length} scorers · ` +
            `${m.dissent_count} dissent`;
        let block = `- **${f.id}** — ${f.text}  \n  _${terse_badge}_`;
        if (explain && m.scorers.length > 0) {
            let total = m.concur_count + m.dissent_count;
            if (total <= 0) {
                total = m.scorers.length;
            }
            const parts: string[] = [`${m.concur_count}/${total} members concur`];
            if (m.dissent_reasons.length > 0) {
                const first = m.dissent_reasons[0] as readonly [string, string];
                parts.push(
                    `${first[0]} dissented citing ` + `${_truncate_reason(first[1])}`,
                );
                const extra = m.dissent_reasons.length - 1;
                if (extra > 0) {
                    parts.push(`${extra} other dissent(s)`);
                }
            } else {
                parts.push('no dissent');
            }
            parts.push(`mean evidence-quality ${m.evidence_quality}`);
            block += '  \n  _' + parts.join('; ') + '_';
        }
        lines.push(block);
    }
    return lines.join('\n');
}

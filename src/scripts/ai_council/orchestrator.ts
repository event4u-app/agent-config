// Council orchestrator — fan out one question to multiple members.
//
// py2ts twin of orchestrator.py (ADR-096). Byte-for-byte parity with the
// Python original: member dispatch order, sequential cost gating, the overrun
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
import {
    DEFAULT_MAX_TOKENS,
    CouncilResponse,
    ExternalAIClient,
} from './clients.js';
import {
    ConsensusBucket,
    ConsensusMetadata,
    Finding,
    FindingScore,
    aggregate_scores,
    anonymize_findings,
    anonymize_responses,
    bucket_by_threshold,
    parse_findings_response,
    parse_scores_response,
} from './consensus.js';
import {
    CostEstimate,
    PriceTable,
    estimate_cost,
    estimate_input_tokens,
} from './pricing.js';
import { ProjectContext } from './project_context.js';
import { AdvisorPlan } from './advisors.js';
import {
    advisor_system_prompt,
    build_extraction_user_prompt,
    build_peer_review_user_prompt,
    build_scoring_user_prompt,
    peer_review_synthesis_addendum,
    synthesis_template,
    system_prompt_for,
} from './prompts.js';

// ── Python-format / stdlib parity helpers ────────────────────────────────
//
// The orchestrator formats USD / scores / strengths via Python f-string
// specs (`:.4f`, `:.2f`, `:.1f`) which round half-to-even on the decimal
// representation. JS `toFixed` rounds half away from zero, so the spec
// formatting is reimplemented to stay byte-exact with the Python original.

/**
 * Format `x` to `ndigits` decimals using round-half-to-even, matching
 * CPython's `format(x, ".<ndigits>f")`.
 */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    let intStr = String(rounded);
    let result: string;
    if (ndigits === 0) {
        result = intStr;
    } else {
        if (intStr.length <= ndigits) {
            intStr = '0'.repeat(ndigits - intStr.length + 1) + intStr;
        }
        const whole = intStr.slice(0, intStr.length - ndigits);
        const dec = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${dec}`;
    }
    return neg ? `-${result}` : result;
}

/** Mirror Python `str.strip()` (no-arg). Sibling-twin convention uses trim(). */
function _pyStrip(s: string): string {
    return s.trim();
}

/**
 * Mirror Python `str.split()` (no separator) — split on runs of whitespace,
 * dropping leading / trailing whitespace (no empty tokens).
 */
function _pySplitWhitespace(s: string): string[] {
    const trimmed = s.trim();
    if (trimmed === '') {
        return [];
    }
    return trimmed.split(/\s+/);
}

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

export class CostBudget {
    max_input_tokens: number;
    max_output_tokens: number;
    max_calls: number;
    max_total_usd: number; // 0 = USD ceiling disabled (token caps still apply)
    daily_limit_usd: number; // 0 = rolling 24h cap disabled (D3)

    constructor(
        args: {
            max_input_tokens?: number;
            max_output_tokens?: number;
            max_calls?: number;
            max_total_usd?: number;
            daily_limit_usd?: number;
        } = {},
    ) {
        this.max_input_tokens = args.max_input_tokens ?? 50_000;
        this.max_output_tokens = args.max_output_tokens ?? 20_000;
        this.max_calls = args.max_calls ?? 10;
        this.max_total_usd = args.max_total_usd ?? 0.0;
        this.daily_limit_usd = args.daily_limit_usd ?? 0.0;
    }
}

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

/** Passed to `on_overrun` when projected spend exceeds the budget. */
export class OverrunEvent {
    member_index: number;
    member: ExternalAIClient;
    next_estimate: CostEstimate; // this member's projected cost
    spent_input_tokens: number; // already-billed totals BEFORE this member
    spent_output_tokens: number;
    spent_usd: number;
    projected_total_usd: number; // spent_usd + next_estimate.total_usd
    daily_spent_usd: number; // rolling 24h spend BEFORE this member (D3)
    daily_limit_usd: number; // the configured daily cap (0 = disabled)
    breach_kind: string; // "session" | "daily" | "tokens"

    constructor(args: {
        member_index: number;
        member: ExternalAIClient;
        next_estimate: CostEstimate;
        spent_input_tokens: number;
        spent_output_tokens: number;
        spent_usd: number;
        projected_total_usd: number;
        daily_spent_usd?: number;
        daily_limit_usd?: number;
        breach_kind?: string;
    }) {
        this.member_index = args.member_index;
        this.member = args.member;
        this.next_estimate = args.next_estimate;
        this.spent_input_tokens = args.spent_input_tokens;
        this.spent_output_tokens = args.spent_output_tokens;
        this.spent_usd = args.spent_usd;
        this.projected_total_usd = args.projected_total_usd;
        this.daily_spent_usd = args.daily_spent_usd ?? 0.0;
        this.daily_limit_usd = args.daily_limit_usd ?? 0.0;
        this.breach_kind = args.breach_kind ?? 'session';
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

/** Mirror the Python `CostEstimate.total_usd` property. */
function _total_usd(e: CostEstimate): number {
    return e.input_usd + e.output_usd;
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
    let last_results: CouncilResponse[] = [];
    let current_user_prompt = question.user_prompt;

    for (let round_idx = 0; round_idx < rounds; round_idx++) {
        const round_question =
            round_idx === 0
                ? question
                : new CouncilQuestion({
                      mode: question.mode,
                      user_prompt: current_user_prompt,
                      max_tokens: question.max_tokens,
                  });
        last_results = _run_round(members, round_question, resolvedBudget, spent, {
            table,
            on_overrun,
            project,
            original_ask,
            advisor_plans,
        });
        if (on_round_complete !== null) {
            on_round_complete(round_idx, last_results);
        }
        if (round_idx + 1 < rounds) {
            current_user_prompt = _augment_for_next_round(
                question.user_prompt,
                last_results,
                round_idx + 2,
            );
        }
    }

    return last_results;
}

interface Spent {
    input: number;
    output: number;
    usd: number;
}

interface RunRoundOptions {
    table: PriceTable | null;
    on_overrun: OnOverrunCallback | null;
    project: ProjectContext | null;
    original_ask: string;
    advisor_plans?: Map<string, AdvisorPlan> | null;
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
    const base_system_prompt = system_prompt_for(question.mode, {
        project,
        original_ask,
    });

    const _system_prompt_for_member = (m: ExternalAIClient): string => {
        const plan = plans.get(m.name);
        if (plan === undefined) {
            return base_system_prompt;
        }
        return advisor_system_prompt(plan.persona_text, { project, original_ask });
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

    for (let idx = 0; idx < members.length; idx++) {
        const member = members[idx] as ExternalAIClient;
        // ── non-billable members skip the cost gate entirely ─────────
        // ManualClient (and future PlaywrightClient) cost us $0; their
        // token counts are still tracked from the response below for
        // observability, but no projection / budget breach can apply.
        if (!(_getattr(member, 'billable', true) as boolean)) {
            let response: CouncilResponse;
            try {
                response = member.ask(
                    _system_prompt_for_member(member),
                    question.user_prompt,
                    question.max_tokens,
                );
            } catch (exc) {
                response = new CouncilResponse({
                    provider: member.name,
                    model: member.model,
                    text: '',
                    error: _excTag(exc),
                });
            }
            _stamp_transport_metadata(response, member);
            results.push(response);
            spent.input += response.input_tokens;
            spent.output += response.output_tokens;
            continue;
        }

        // ── projected spend check ────────────────────────────────────
        const est = estimates ? (estimates[idx] as CostEstimate) : null;
        const proj_input = spent.input + (est ? est.input_tokens : 0);
        const proj_output = spent.output + (est ? est.output_tokens : 0);
        const proj_usd = spent.usd + (est ? _total_usd(est) : 0.0);
        const next_call_usd = est ? _total_usd(est) : 0.0;

        const breaches_tokens =
            proj_input > budget.max_input_tokens ||
            proj_output > budget.max_output_tokens;
        const breaches_usd =
            budget.max_total_usd > 0 && proj_usd > budget.max_total_usd;
        const breaches_daily =
            budget.daily_limit_usd > 0 &&
            _would_exceed_daily(budget.daily_limit_usd, next_call_usd);

        if (breaches_tokens || breaches_usd || breaches_daily) {
            const breach_kind = breaches_tokens
                ? 'tokens'
                : breaches_daily
                  ? 'daily'
                  : 'session';
            const error_tag =
                breach_kind === 'daily'
                    ? 'daily_budget_exceeded'
                    : 'cost_budget_exceeded';
            if (on_overrun !== null && estimates !== null) {
                const event = new OverrunEvent({
                    member_index: idx,
                    member,
                    next_estimate: estimates[idx] as CostEstimate,
                    spent_input_tokens: _pyInt(spent.input),
                    spent_output_tokens: _pyInt(spent.output),
                    spent_usd: spent.usd,
                    projected_total_usd: proj_usd,
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

        // ── actual call ──────────────────────────────────────────────
        let response: CouncilResponse;
        try {
            response = member.ask(
                _system_prompt_for_member(member),
                question.user_prompt,
                question.max_tokens,
            );
        } catch (exc) {
            response = new CouncilResponse({
                provider: member.name,
                model: member.model,
                text: '',
                error: _excTag(exc),
            });
        }
        results.push(response);
        spent.input += response.input_tokens;
        spent.output += response.output_tokens;
        let actual_usd: number | null = null;
        if (estimates !== null && table !== null) {
            // Bill the actual output against the budget using the
            // member's per-1M output rate. Re-use estimate_cost with
            // the *real* token count.
            const actual = estimate_cost(
                member.name,
                member.model,
                response.input_tokens,
                response.output_tokens,
                table,
            );
            actual_usd = _total_usd(actual);
            spent.usd += _total_usd(actual);
            // Persist to the rolling 24h ledger when the daily cap is
            // active. Errors are swallowed inside record_spend.
            if (budget.daily_limit_usd > 0 && !response.error) {
                _record_daily_spend(_total_usd(actual), member.name, member.model);
            }
        }
        _stamp_transport_metadata(response, member, actual_usd);
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
        return original_prompt;
    }
    const prior_block = blocks.join('\n\n');
    return (
        `${original_prompt}\n\n` +
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
        return original_prompt;
    }
    const prior_block = blocks.join('\n\n');
    return (
        `${original_prompt}\n\n` +
        `---\n\n` +
        `## Prior round positions (round ${next_round_number - 1})\n\n` +
        `You are now in round ${next_round_number} of a structured\n` +
        `debate. Below are anonymised positions from independent\n` +
        `reviewers in the previous round. You do NOT know which model\n` +
        `produced which position.\n\n` +
        `Identify the SINGLE strongest opposing position and write a\n` +
        `rebuttal addressed at its strongest steel-manned form. Do NOT\n` +
        `search for common ground — name the load-bearing flaw the\n` +
        `opposing reviewer missed and state the evidence behind your\n` +
        `counter-position.\n\n` +
        `${prior_block}`
    );
}

export interface RunDebateOptions {
    budget?: CostBudget | null;
    table?: PriceTable | null;
    on_overrun?: OnOverrunCallback | null;
    project?: ProjectContext | null;
    original_ask?: string;
    max_rounds?: number;
    on_round_complete?:
        | ((round_number: number, responses: CouncilResponse[]) => void)
        | null;
    on_continue?: DebateContinuePrompt | null;
    advisor_plans?: Map<string, AdvisorPlan> | null;
    seed_round_1?: CouncilResponse[] | null;
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
    const all_rounds: CouncilResponse[][] = [];
    let current_user_prompt = question.user_prompt;

    for (let round_idx = 0; round_idx < max_rounds; round_idx++) {
        const round_number = round_idx + 1;
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
            });
        }

        all_rounds.push(results);
        if (on_round_complete !== null) {
            on_round_complete(round_number, results);
        }

        // Prep the user-prompt for the next round so the cost estimate
        // below covers the augmented bytes.
        if (round_idx + 1 < max_rounds) {
            current_user_prompt = _augment_for_debate_round(
                question.user_prompt,
                results,
                round_number + 1,
            );
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
    label_to_source: Map<string, string>;
    persona_labels: Map<string, string>;

    constructor(args: {
        responses: CouncilResponse[];
        label_to_source: Map<string, string>;
        persona_labels: Map<string, string>;
    }) {
        this.responses = args.responses;
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
    // ── final label_to_source map captured from the LAST member call
    // so the renderer / JSON dump has the deterministic A/B mapping.
    // Each member sees a different N-1 subset (self filtered), but the
    // ordering of `by_source` stays stable, so the label assignment is
    // deterministic per artefact run.
    let last_label_to_source = new Map<string, string>();

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
        const [anon_text, label_to_source] = anonymize_responses(others_pairs, {
            persona_labels,
        });
        if (anon_text.size === 0) {
            continue;
        }
        last_label_to_source = label_to_source;
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

    return new PeerReviewResult({
        responses: review_responses,
        label_to_source: last_label_to_source,
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
    extraction_responses: CouncilResponse[];
    scoring_responses: CouncilResponse[];

    constructor(args: {
        bucket: ConsensusBucket;
        findings: Finding[];
        scores: FindingScore[];
        metadata: Map<string, ConsensusMetadata>;
        extraction_responses: CouncilResponse[];
        scoring_responses: CouncilResponse[];
    }) {
        this.bucket = args.bucket;
        this.findings = args.findings;
        this.scores = args.scores;
        this.metadata = args.metadata;
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
        all_findings.push(
            ...parse_findings_response(extracted[0]!.text, { source }),
        );
    }

    if (all_findings.length === 0) {
        return new ConsensusResult({
            bucket: new ConsensusBucket(),
            findings: [],
            scores: [],
            metadata: new Map(),
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
function _render_response_meta(r: CouncilResponse): string {
    const meta_dict: Record<string, unknown> = r.metadata ?? {};
    const billable = Boolean(_metaGet(meta_dict, 'billable', true));
    const estimated = Boolean(_metaGet(meta_dict, 'tokens_estimated', false));
    const parts: string[] = [];
    if (!billable) {
        const label = (_metaGet(meta_dict, 'subscription_label', null) ||
            'flat-rate') as string;
        parts.push(`cost: subscription (${label})`);
    } else {
        const cost_usd = _metaGet(meta_dict, 'cost_usd', undefined);
        if (typeof cost_usd === 'number' && !(typeof cost_usd === 'boolean')) {
            parts.push(`cost: $${_pyFixed(cost_usd, 4)}`);
        }
        const prefix = estimated ? '~' : '';
        parts.push(
            `tokens: ${prefix}${r.input_tokens} in / ${prefix}${r.output_tokens} out`,
        );
    }
    parts.push(`${r.latency_ms} ms`);
    return `*${parts.join(' · ')}*`;
}

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
        const header = `## ${r.provider} · ${r.model}`;
        if (r.error) {
            blocks.push(`${header}\n\n*ERROR:* \`${r.error}\``);
            continue;
        }
        const meta = _render_response_meta(r);
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
    let body: string;
    if (template) {
        body = template;
    } else {
        body = '*to be summarised by the host agent*';
    }
    blocks.push(`## Convergence / Divergence\n\n${body}`);
    return blocks.join('\n\n---\n\n');
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

// ── small stdlib parity helpers ───────────────────────────────────────

/** Mirror Python `int(x)` truncation-toward-zero on a float total. */
function _pyInt(x: number): number {
    return Math.trunc(x);
}

/** Mirror Python `repr(int)` for the error message in estimate_debate_cost. */
function _pyReprInt(x: number): string {
    return String(x);
}

/** Mirror `type(exc).__name__ + ": " + str(exc)`. */
function _excTag(exc: unknown): string {
    if (exc instanceof Error) {
        return `${exc.name}: ${exc.message}`;
    }
    return `Error: ${String(exc)}`;
}

/** dict.setdefault(key, value) — only set when key absent. */
function _setdefault(
    obj: Record<string, unknown>,
    key: string,
    value: unknown,
): void {
    if (!(key in obj)) {
        obj[key] = value;
    }
}

/** dict.get(key, default). */
function _metaGet(
    obj: Record<string, unknown>,
    key: string,
    fallback: unknown,
): unknown {
    return key in obj ? obj[key] : fallback;
}

/** Python `str.lstrip()` (no-arg) — strip leading whitespace. */
function _pyLStrip(s: string): string {
    return s.replace(/^\s+/, '');
}

/** Python `str.rstrip()` (no-arg) — strip trailing whitespace. */
function _pyRStrip(s: string): string {
    return s.replace(/\s+$/, '');
}

/** Python `len(str)` — code-point count, not UTF-16 unit count. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Python `s[start:end]` — code-point slicing. */
function _pySlice(s: string, start: number, end: number): string {
    return [...s].slice(start, end).join('');
}

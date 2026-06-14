// Lightweight-QA fast-path resolver (Phase 11) — TypeScript twin (py2ts Phase 1).
//
// When `decision_resolution.classes.low_impact.mode = council` fires,
// this module narrows the standard council fan-out to the opted-in
// members, caps the spend at the `decision_resolution.fast_path`
// budget, and stamps a transparency marker on the result so the host
// agent can surface that the answer came from the lightweight path.
//
// The fast-path is a strict subset of the standard `consult()` flow:
//
// - members filtered to `participate_low_impact = True` (and `enabled`);
// - list truncated to `LowImpactFastPathConfig.max_members` (1 or 2);
// - `CostBudget.max_calls = max_members`;
// - `CostBudget.max_total_usd = max_cost_usd`;
// - token caps tightened to `max_tokens` (split 60 / 40 in / out);
// - `rounds` locked to 1 — multi-round debate defeats the purpose.
//
// Iron Law (Phase 10) is unaffected: `high_impact` and `user_required`
// never reach this module — they route to `user` at the config layer.
// This module is only consulted for the `low_impact` class.
//
// Parity notes (ADR-096):
// - The four transparency markers are reproduced byte-for-byte (the
//   `fast-path-marker-visibility` Iron Law). English, no emoji, leading `> `.
// - `int(cfg.max_tokens * _INPUT_RATIO)` → `Math.trunc` (Python `int()`
//   truncates toward zero).
// - `:.2f` / `:.4f` USD formatting → `_pyFixed` (round-half-to-even),
//   matching CPython float formatting.
// - `round(total_cost, 4)` → `pyRound` (banker's rounding) from value_ladder.
// - `text.splitlines()` → `_splitlines` (universal newlines).
// - `re.sub` normalisation mirrors `[^\w\s]+` / `\s+` with Unicode `\w` (`re`
//   defaults): spelled out as `\p{L}\p{N}_` since JS `\w` is ASCII-only.
// - `len(q) > 120` / `q[:117]` / `[:80]` slices are code-point aware via
//   `_pyLen` / `_pySlice` to mirror Python string indexing.
// - dict insertion order + `dict(sorted(...))` for the stats aggregation.

import { pyRound } from '../_lib/value_ladder.js';
import type { CouncilResponse, ExternalAIClient } from './clients.js';
import type { LowImpactFastPathConfig, MemberConfig } from './config.js';
import { CostBudget } from './orchestrator.js';

// Token split ratio between input prompt and output budget when the
// fast-path caps the total. 60 / 40 mirrors the empirical mix observed
// for short Q&A — Q is long-ish, A is terse. Tunable; kept private so
// the contract surface stays at `max_tokens`.
const _INPUT_RATIO = 0.6;

// ── Python-format / stdlib parity helpers ────────────────────────────────

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

/** Mirror Python `len(str)` — code-point count, not UTF-16 unit count. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Mirror Python `str[:n]` — code-point-aware slice from the start. */
function _pySlice(s: string, n: number): string {
    if (n <= 0) {
        return '';
    }
    let out = '';
    let i = 0;
    for (const ch of s) {
        if (i >= n) {
            break;
        }
        out += ch;
        i += 1;
    }
    return out;
}

/** Mirror Python `str.strip()` (no-arg) — strip whitespace both ends. */
function _pyStrip(s: string): string {
    return s.trim();
}

/**
 * Python `str.splitlines()` — split on universal newlines, drop a single
 * trailing newline (no empty final element).
 */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    const lines = s.split(/\r\n|\r|\n/u);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

/**
 * Python `re.escape` for the literal trigger words used here — close enough
 * for the alnum / punctuation shapes the corpus emits.
 */
function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolved fast-path execution plan (Phase 11).
 *
 * - members: Ordered list of member configs to invoke. Empty when no member
 *   opted in — the caller must fall back to the standard council path or
 *   escalate.
 * - budget: `CostBudget` pre-sized to the fast-path caps. Safe to pass
 *   directly to `orchestrator.consult`.
 * - marker: One-line transparency string for the rendered output (e.g.
 *   `"[fast-path: 2 members · cap $0.05]"`). Surface it to the user so
 *   fast-path resolutions are distinguishable from standard council runs.
 * - reason: Diagnostic string explaining the plan shape — used by the CLI
 *   and tests. Empty when `members` is non-empty.
 */
export class FastPathPlan {
    readonly members: readonly MemberConfig[];
    readonly budget: CostBudget;
    readonly marker: string;
    readonly reason: string;

    constructor(args: {
        members: readonly MemberConfig[];
        budget: CostBudget;
        marker: string;
        reason?: string;
    }) {
        this.members = args.members;
        this.budget = args.budget;
        this.marker = args.marker;
        this.reason = args.reason ?? '';
    }

    /** True when at least one opted-in member is available. */
    get is_resolvable(): boolean {
        return this.members.length > 0;
    }
}

/**
 * Filter and order opted-in members for the fast-path.
 *
 * Selection rules:
 *
 * - member must be `enabled`;
 * - member must have `participate_low_impact = True`;
 * - alphabetical by provider name → deterministic, easy to test, no hidden
 *   cost-rank heuristic to debug;
 * - truncate to `cfg.max_members` (1 or 2 per schema).
 *
 * No price-table lookup here — the standard council path already runs the
 * full cost-disclosure flow and the per-call cap in `CostBudget` is the
 * structural backstop.
 */
export function select_fast_path_members(
    members: ReadonlyMap<string, MemberConfig> | Record<string, MemberConfig>,
    cfg: LowImpactFastPathConfig,
): readonly MemberConfig[] {
    const values =
        members instanceof Map ? Array.from(members.values()) : Object.values(members);
    const candidates = values.filter((m) => m.enabled && m.participate_low_impact);
    // Python `list.sort(key=...)` is a stable sort on the string key; JS sort
    // is stable as of ES2019, and string `<` matches Python's str ordering for
    // the provider names in play.
    candidates.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return candidates.slice(0, cfg.max_members);
}

/**
 * Translate the `fast_path` config into a runnable `CostBudget`.
 *
 * The 60 / 40 input / output split is a heuristic — callers that need an
 * exact ceiling can override the returned `CostBudget` fields. `max_calls`
 * matches `max_members` so the orchestrator short-circuits as soon as the
 * fast-path quota is exhausted.
 */
export function build_fast_path_budget(cfg: LowImpactFastPathConfig): CostBudget {
    const max_in = Math.max(1, Math.trunc(cfg.max_tokens * _INPUT_RATIO));
    const max_out = Math.max(1, cfg.max_tokens - max_in);
    return new CostBudget({
        max_input_tokens: max_in,
        max_output_tokens: max_out,
        max_calls: cfg.max_members,
        max_total_usd: cfg.max_cost_usd,
    });
}

/**
 * Build the full execution plan for a `low_impact` resolution.
 *
 * Returns a `FastPathPlan`. When no member opted in, the plan's `members`
 * tuple is empty and `reason` explains why — the caller must fall back
 * (standard council) or escalate (user).
 */
export function plan_fast_path(
    members: ReadonlyMap<string, MemberConfig> | Record<string, MemberConfig>,
    cfg: LowImpactFastPathConfig,
): FastPathPlan {
    const selected = select_fast_path_members(members, cfg);
    if (selected.length === 0) {
        return new FastPathPlan({
            members: [],
            budget: build_fast_path_budget(cfg),
            marker: '',
            reason:
                'no member has `participate_low_impact: true` — ' +
                'fast-path unavailable, fall back to standard council ' +
                'or escalate to user.',
        });
    }
    const names = selected.map((m) => m.name).join(', ');
    const marker =
        `[fast-path: ${selected.length} member` +
        `${selected.length > 1 ? 's' : ''} (${names}) · ` +
        `cap $${_pyFixed(cfg.max_cost_usd, 2)} · ${cfg.max_tokens} tokens]`;
    return new FastPathPlan({
        members: selected,
        budget: build_fast_path_budget(cfg),
        marker,
    });
}

// --- Phase 11 Step 2-3: fast-path executor + transparency marker ----------

/**
 * Status of a `FastPathResolution`. `resolved` = one or matching answers,
 * returned to caller; `split` = members disagreed, caller must escalate to
 * user with both opinions; `aborted` = hard cap hit or all members failed,
 * caller must escalate; `unavailable` = plan had no opted-in members (caller
 * never even called the executor — included so the status enum is
 * exhaustive).
 */
export type FastPathStatus = 'resolved' | 'split' | 'aborted' | 'unavailable';

// System prompt for fast-path members. Deliberately terse — the standard
// advisor + Karpathy peer-review machinery is bypassed by design (Phase 11
// contract). One sentence of rationale is asked explicitly so the
// user-visible marker can surface a "why" without a second round.
const _FAST_PATH_SYSTEM =
    'You are a fast-path council member answering a low-impact ' +
    'development question. Reply with: (1) a short, direct answer; ' +
    '(2) one sentence of rationale. No preamble, no caveats, no ' +
    'alternative options — just answer + rationale.';

/**
 * One fast-path member's normalised answer.
 *
 * - member: Member name (e.g. `"anthropic"`).
 * - text: Raw response text. `""` when the call errored.
 * - normalized: Lowercase + punctuation-stripped form used for agreement
 *   detection. `""` mirrors `text`.
 * - cost_usd: Estimated spend in USD for this single call. `0.0` for
 *   non-billable transports (manual / vendor-CLI).
 * - error: Provider-side error string, `null` on success.
 */
export class MemberAnswer {
    readonly member: string;
    readonly text: string;
    readonly normalized: string;
    readonly cost_usd: number;
    readonly error: string | null;

    constructor(args: {
        member: string;
        text: string;
        normalized: string;
        cost_usd?: number;
        error?: string | null;
    }) {
        this.member = args.member;
        this.text = args.text;
        this.normalized = args.normalized;
        this.cost_usd = args.cost_usd ?? 0.0;
        this.error = args.error ?? null;
    }

    get ok(): boolean {
        return this.error === null && _pyStrip(this.text) !== '';
    }
}

/**
 * End-to-end outcome of a low-impact fast-path resolution.
 *
 * - status: One of `FastPathStatus`.
 * - answer: Final user-visible answer text. Empty when `status` is `split`,
 *   `aborted`, or `unavailable`.
 * - marker: Transparency marker line — either the plan marker (resolved) or
 *   a status-specific escalation marker.
 * - answers: Per-member normalised answers, in call order.
 * - total_cost_usd: Sum of per-call costs.
 * - session_log_line: One-line append for the session artefact under
 *   `low-impact-resolutions.md`. Empty when status is `unavailable` (no call
 *   happened).
 */
export class FastPathResolution {
    readonly status: FastPathStatus;
    readonly answer: string;
    readonly marker: string;
    readonly answers: readonly MemberAnswer[];
    readonly total_cost_usd: number;
    readonly session_log_line: string;

    constructor(args: {
        status: FastPathStatus;
        answer: string;
        marker: string;
        answers?: readonly MemberAnswer[];
        total_cost_usd?: number;
        session_log_line?: string;
    }) {
        this.status = args.status;
        this.answer = args.answer;
        this.marker = args.marker;
        this.answers = args.answers ?? [];
        this.total_cost_usd = args.total_cost_usd ?? 0.0;
        this.session_log_line = args.session_log_line ?? '';
    }
}

/**
 * Lowercase, strip punctuation, collapse whitespace.
 *
 * Used to detect agreement between two fast-path answers without fuzzy /
 * embedding match — keeps the agreement test auditable.
 *
 * Python `re.sub(r"[^\w\s]+", " ", ...)` uses Unicode `\w` / `\s`; JS `\w` /
 * `\s` are ASCII-only even under `/u`, so the Unicode classes are spelled out.
 */
function _normalize(text: string): string {
    const lowered = (text || '').toLowerCase();
    const stripped = lowered.replace(/[^\p{L}\p{N}_\s]+/gu, ' ');
    return _pyStrip(stripped.replace(/\s+/gu, ' '));
}

function _build_user_prompt(question_text: string): string {
    return (
        `Question: ${_pyStrip(question_text)}\n\n` +
        'Reply with: answer on line 1, one sentence rationale on line 2.'
    );
}

/**
 * Build the normative `aborted` marker.
 *
 * Wording is fixed by `fast-path-marker-visibility.md` Iron Law:
 * `> Low-impact council aborted (<reason>) — escalating to user:`.
 * The members-tried list trails on the same prefix so downstream pattern
 * matchers can still extract who was called.
 */
function _aborted_marker(reason: string, members: readonly MemberConfig[]): string {
    const names = members.length > 0 ? members.map((m) => m.name).join(', ') : 'no members';
    return (
        `> Low-impact council aborted (${reason}) — escalating to user: ` +
        `members tried: ${names}.`
    );
}

/**
 * Build the normative `split` marker.
 *
 * Wording is fixed by `fast-path-marker-visibility.md` Iron Law:
 * `> Low-impact council split — escalating to user (<m1>: X / <m2>: Y):`.
 */
function _split_marker(answers: readonly MemberAnswer[]): string {
    const parts = answers
        .filter((a) => a.ok)
        .map((a) => `${a.member}: ${_pySlice(_pyStrip(_splitlines(a.text)[0] ?? ''), 80)}`)
        .join(' / ');
    return `> Low-impact council split — escalating to user (${parts}):`;
}

/**
 * Build the normative `unavailable` marker.
 *
 * Wording is fixed by `fast-path-marker-visibility.md` Iron Law:
 * `> Low-impact council unavailable (no opted-in members) — escalating to user.`.
 */
function _unavailable_marker(): string {
    return (
        '> Low-impact council unavailable (no opted-in members) — ' + 'escalating to user.'
    );
}

/**
 * Build the normative `resolved` marker.
 *
 * Wording is fixed by `fast-path-marker-visibility.md` Iron Law:
 * `> Resolved via low-impact council fast-path: <verdict>.`. The verdict
 * short-string distinguishes single-member from 2-member consensus so the
 * host agent can preserve provenance without paraphrasing the answer body.
 */
function _resolved_marker(ok_answers: readonly MemberAnswer[]): string {
    let verdict: string;
    if (ok_answers.length <= 1) {
        verdict = 'single-member answer';
    } else {
        verdict = `${ok_answers.length}-member consensus`;
    }
    return `> Resolved via low-impact council fast-path: ${verdict}.`;
}

/** Extract the answer portion (line 1) from a fast-path response. */
function _answer_line(text: string): string {
    for (const line of _splitlines(text)) {
        const stripped = _pyStrip(line);
        if (stripped !== '') {
            return stripped;
        }
    }
    return '';
}

/**
 * A pricing table with a `lookup(provider, model)` method returning a price
 * object exposing `input_per_1m_usd` / `output_per_1m_usd`. Typed loosely to
 * mirror the duck-typed `price_table: object | None` Python signature.
 */
interface PriceLike {
    readonly input_per_1m_usd: number;
    readonly output_per_1m_usd: number;
}
interface PriceTableLike {
    lookup(provider: string, model: string): PriceLike | null | undefined;
}

/**
 * Estimate USD cost for one response.
 *
 * Uses the injected `price_table` when available; falls back to `0.0` for
 * non-billable transports (manual / vendor-CLI) and for unknown models.
 * Never raises — cost is an observability signal, not a gate (the budget
 * check is structural).
 */
function _compute_cost(response: CouncilResponse, price_table: unknown): number {
    if (price_table === null || price_table === undefined) {
        return 0.0;
    }
    const lookup = (price_table as Record<string, unknown>).lookup;
    if (typeof lookup !== 'function') {
        return 0.0;
    }
    const price = (lookup as PriceTableLike['lookup']).call(
        price_table,
        response.provider,
        response.model,
    );
    if (price === null || price === undefined) {
        return 0.0;
    }
    const in_usd = (response.input_tokens / 1_000_000) * price.input_per_1m_usd;
    const out_usd = (response.output_tokens / 1_000_000) * price.output_per_1m_usd;
    return in_usd + out_usd;
}

/** Normalise one provider call into a `MemberAnswer`. */
function _build_member_answer(
    member: string,
    response: CouncilResponse,
    price_table: unknown,
): MemberAnswer {
    if (response.error) {
        return new MemberAnswer({
            member,
            text: '',
            normalized: '',
            cost_usd: 0.0,
            error: response.error,
        });
    }
    const text = _pyStrip(response.text || '');
    if (!text) {
        return new MemberAnswer({
            member,
            text: '',
            normalized: '',
            cost_usd: 0.0,
            error: 'empty response',
        });
    }
    const cost = _compute_cost(response, price_table);
    return new MemberAnswer({
        member,
        text,
        normalized: _normalize(_answer_line(text)),
        cost_usd: cost,
    });
}

/**
 * Build a one-line append for the session artefact.
 *
 * Format: `ISO8601 | status | members(ok/total) | $cost | Q…`
 * Question is truncated to 120 chars so the log stays scannable.
 */
function _session_log_line(
    question_text: string,
    status: FastPathStatus,
    answers: readonly MemberAnswer[],
    total_cost: number,
    now: Date | null = null,
): string {
    const ts = _strftimeUtc(now ?? new Date());
    const ok = answers.filter((a) => a.ok).length;
    const total = answers.length;
    let q = _pyStrip(question_text).replace(/\n/g, ' ');
    if (_pyLen(q) > 120) {
        q = _pySlice(q, 117) + '...';
    }
    const names = answers.map((a) => a.member).join(', ');
    const members_tag = names ? ` members(${names})` : '';
    return (
        `${ts} | ${status} | members=${ok}/${total} |${members_tag} ` +
        `cost=$${_pyFixed(total_cost, 4)} | Q=${q}`
    );
}

/**
 * Mirror Python `datetime.strftime("%Y-%m-%dT%H:%M:%SZ")` over a UTC instant.
 * The Python source builds the timestamp from a timezone-aware UTC `datetime`,
 * so the formatted fields are the UTC calendar fields.
 */
function _strftimeUtc(d: Date): string {
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
    );
}

/**
 * Execute the fast-path plan and return a `FastPathResolution`.
 *
 * Contract:
 *
 * - One round only — each opted-in member is called exactly once.
 * - Per-call `max_tokens` is taken from `plan.budget.max_output_tokens`.
 * - The USD cap (`plan.budget.max_total_usd`) is a hard stop — when the
 *   running total would exceed it after a call, the executor aborts and
 *   escalates to the user (never silently truncates).
 * - Provider failures never block — a failed member is recorded and the
 *   executor continues with the remaining member (if any).
 * - Consensus rule (2 members): normalised answer-line equality. No embedding
 *   match, no LLM-judge — keeps the agreement test auditable. Disagreement →
 *   `status = "split"`, caller escalates.
 *
 * @param question_text The low-impact question being routed.
 * @param plan Output of `plan_fast_path`.
 * @param clients Provider name → instantiated client. Missing entries are
 *   treated as a member-side failure (error recorded, other members proceed).
 * @param price_table Optional pricing table for cost estimation. When `null`,
 *   `cost_usd` fields stay at `0.0` (the structural budget check still fires
 *   on token counts).
 * @param now Optional clock injector for deterministic tests.
 */
export function resolve_low_impact(
    question_text: string,
    plan: FastPathPlan,
    clients: ReadonlyMap<string, ExternalAIClient> | Record<string, ExternalAIClient>,
    price_table: unknown = null,
    now: (() => Date) | null = null,
): FastPathResolution {
    if (!plan.is_resolvable) {
        return new FastPathResolution({
            status: 'unavailable',
            answer: '',
            marker: _unavailable_marker(),
        });
    }

    const getClient = (name: string): ExternalAIClient | undefined =>
        clients instanceof Map
            ? clients.get(name)
            : (clients as Record<string, ExternalAIClient>)[name];

    const user_prompt = _build_user_prompt(question_text);
    const answers: MemberAnswer[] = [];
    let total_cost = 0.0;

    for (const member of plan.members) {
        const client = getClient(member.name);
        if (client === undefined || client === null) {
            answers.push(
                new MemberAnswer({
                    member: member.name,
                    text: '',
                    normalized: '',
                    cost_usd: 0.0,
                    error: 'no client instantiated',
                }),
            );
            continue;
        }
        let response: CouncilResponse;
        try {
            response = client.ask(
                _FAST_PATH_SYSTEM,
                user_prompt,
                plan.budget.max_output_tokens,
            );
        } catch (exc) {
            answers.push(
                new MemberAnswer({
                    member: member.name,
                    text: '',
                    normalized: '',
                    cost_usd: 0.0,
                    error: `client raised: ${_reprException(exc)}`,
                }),
            );
            continue;
        }
        const ans = _build_member_answer(member.name, response, price_table);
        // Hard cap — refuse to add an over-budget answer to the result.
        const projected = total_cost + ans.cost_usd;
        if (projected > plan.budget.max_total_usd && ans.ok) {
            answers.push(
                new MemberAnswer({
                    member: member.name,
                    text: '',
                    normalized: '',
                    cost_usd: ans.cost_usd,
                    error:
                        `would exceed fast-path cap ` +
                        `$${_pyFixed(plan.budget.max_total_usd, 2)} ` +
                        `(projected $${_pyFixed(projected, 4)})`,
                }),
            );
            break;
        }
        answers.push(ans);
        total_cost = projected;
    }

    const answers_t = answers.slice();
    const ok_answers = answers_t.filter((a) => a.ok);

    if (ok_answers.length === 0) {
        const marker = _aborted_marker('all members failed', plan.members);
        return new FastPathResolution({
            status: 'aborted',
            answer: '',
            marker,
            answers: answers_t,
            total_cost_usd: total_cost,
            session_log_line: _session_log_line(
                question_text,
                'aborted',
                answers_t,
                total_cost,
                now ? now() : null,
            ),
        });
    }

    const first = ok_answers[0] as MemberAnswer;
    if (ok_answers.length === 1) {
        return new FastPathResolution({
            status: 'resolved',
            answer: first.text,
            marker: _resolved_marker(ok_answers),
            answers: answers_t,
            total_cost_usd: total_cost,
            session_log_line: _session_log_line(
                question_text,
                'resolved',
                answers_t,
                total_cost,
                now ? now() : null,
            ),
        });
    }

    // Two members → quick consensus on normalised answer line.
    const second = ok_answers[1] as MemberAnswer;
    if (first.normalized === second.normalized) {
        return new FastPathResolution({
            status: 'resolved',
            answer: first.text,
            marker: _resolved_marker(ok_answers),
            answers: answers_t,
            total_cost_usd: total_cost,
            session_log_line: _session_log_line(
                question_text,
                'resolved',
                answers_t,
                total_cost,
                now ? now() : null,
            ),
        });
    }

    return new FastPathResolution({
        status: 'split',
        answer: '',
        marker: _split_marker(ok_answers),
        answers: answers_t,
        total_cost_usd: total_cost,
        session_log_line: _session_log_line(
            question_text,
            'split',
            answers_t,
            total_cost,
            now ? now() : null,
        ),
    });
}

/**
 * Mirror Python `f"{exc!r}"` for an exception caught in the executor loop.
 * Python renders `repr(exc)` → `<ClassName>('<message>')`. The exact text is
 * only surfaced inside the member-error string; tests that compare it pin the
 * raised value, so a faithful `ClassName(args)` shape is what matters.
 */
function _reprException(exc: unknown): string {
    if (exc instanceof Error) {
        const name = exc.constructor?.name ?? exc.name ?? 'Error';
        return `${name}(${_pyReprStr(exc.message)})`;
    }
    return String(exc);
}

/** Mirror Python `repr(str)` for a single-quoted ASCII-ish string. */
function _pyReprStr(s: string): string {
    const escaped = s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
}

// --- Phase 11 Step 5: low-impact stats over session log -------------------

/**
 * Aggregate summary of one session's low-impact resolutions.
 *
 * - total: Total number of fast-path attempts in the session.
 * - by_status: Count per status (`resolved`/`split`/`aborted`).
 * - by_member: Count per member name (sum across all attempts; a 2-member
 *   call increments both entries).
 * - total_cost_usd: Sum of per-attempt cost across the session.
 */
export class LowImpactStats {
    readonly total: number;
    readonly by_status: ReadonlyMap<string, number>;
    readonly by_member: ReadonlyMap<string, number>;
    readonly total_cost_usd: number;

    constructor(args: {
        total: number;
        by_status: ReadonlyMap<string, number>;
        by_member: ReadonlyMap<string, number>;
        total_cost_usd: number;
    }) {
        this.total = args.total;
        this.by_status = args.by_status;
        this.by_member = args.by_member;
        this.total_cost_usd = args.total_cost_usd;
    }
}

// Mirrors the Python module-level compiled regexes. `\w` in Python `re` is
// Unicode by default; `status` (\w+) is ASCII in practice, but spell out the
// Unicode class to stay faithful. The cost group is `[\d.]+`.
const _LOG_LINE_RE = new RegExp(
    '^(?<ts>\\S+)\\s*\\|\\s*(?<status>[\\p{L}\\p{N}_]+)\\s*\\|\\s*members=(?<ok>\\d+)/' +
        '(?<tot>\\d+)\\s*\\|.*?cost=\\$(?<cost>[\\d.]+)\\s*\\|\\s*Q=',
    'u',
);

const _MEMBER_SECTION_RE = /members\((?<names>[^)]+)\)/u;

/**
 * Parse a `low-impact-resolutions.md` body into stats.
 *
 * Lines that do not match the canonical `_session_log_line` shape are skipped
 * silently — keeps the parser tolerant of free-form section headers the
 * artefact may grow over time. Returns a `LowImpactStats` with the aggregated
 * counts.
 */
export function parse_low_impact_log(text: string): LowImpactStats {
    const by_status = new Map<string, number>();
    const by_member = new Map<string, number>();
    let total = 0;
    let total_cost = 0.0;
    for (const raw of _splitlines(text)) {
        const m = _LOG_LINE_RE.exec(_pyStrip(raw));
        // Python `re.match` anchors at the start only; `_LOG_LINE_RE` already
        // begins with `^`. `exec` against a non-global regex matches anywhere,
        // but the `^` anchor pins it to the start exactly like `re.match`.
        if (!m) {
            continue;
        }
        total += 1;
        const status = m.groups?.['status'] ?? '';
        by_status.set(status, (by_status.get(status) ?? 0) + 1);
        const cost = Number(m.groups?.['cost']);
        if (!Number.isNaN(cost)) {
            total_cost += cost;
        }
        // Optional `members(name, name)` tag emitted by the renderer.
        const names_m = _MEMBER_SECTION_RE.exec(raw);
        if (names_m) {
            for (const rawName of (names_m.groups?.['names'] ?? '').split(',')) {
                const name = _pyStrip(rawName);
                if (name) {
                    by_member.set(name, (by_member.get(name) ?? 0) + 1);
                }
            }
        }
    }
    return new LowImpactStats({
        total,
        by_status: _sortedMap(by_status),
        by_member: _sortedMap(by_member),
        total_cost_usd: pyRound(total_cost, 4),
    });
}

/** Mirror Python `dict(sorted(d.items()))` — re-key in sorted-key order. */
function _sortedMap(d: Map<string, number>): Map<string, number> {
    const out = new Map<string, number>();
    const keys = Array.from(d.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const k of keys) {
        out.set(k, d.get(k) as number);
    }
    return out;
}

/** Render `LowImpactStats` as a short stdout summary block. */
export function render_low_impact_stats(stats: LowImpactStats): string {
    const lines: string[] = ['# Low-impact fast-path · session summary', ''];
    lines.push(`- attempts: ${stats.total}`);
    if (stats.by_status.size > 0) {
        const parts = Array.from(stats.by_status.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join(' · ');
        lines.push(`- status: ${parts}`);
    } else {
        lines.push('- status: (none)');
    }
    if (stats.by_member.size > 0) {
        const parts = Array.from(stats.by_member.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join(' · ');
        lines.push(`- members: ${parts}`);
    }
    lines.push(`- total cost: $${_pyFixed(stats.total_cost_usd, 4)}`);
    return lines.join('\n') + '\n';
}

// --- step-9 P5: fuzzy corpus match with safety vetoes -------------------

/**
 * Fuzzy variant of `necessity.classify_impact_with_corpus`.
 *
 * Uses a SequenceMatcher-equivalent ratio to match near-paraphrases of
 * `Validated` corpus entries while preserving the Iron Law:
 *
 * - **Iron Law (precedence)**: the base verdict from `classify_impact` runs
 *   first. If the base class is in `LOCKED_IMPACT_CLASSES` (`high_impact` /
 *   `user_required`), the fuzzy lookup is skipped entirely.
 * - **High-impact-veto**: any whole-word token from
 *   `IMPACT_TRIGGERS["high_impact"]` in the (lowered) query short-circuits to
 *   the base verdict regardless of similarity. Catches paraphrases that
 *   escaped the trigger-bucket vote.
 * - **Anti-example-veto**: if the maximum similarity to any `Anti-Examples`
 *   phrase is `>=` the maximum similarity to any `Validated` phrase, the
 *   fuzzy match is rejected. Prevents ratio-driven drift onto bullets the
 *   corpus has explicitly flagged as user-required.
 *
 * Returns the base verdict on every reject path so the caller gets consistent
 * semantics with the exact-match classifier.
 */
export async function classify_impact_with_corpus_fuzzy(
    question_text: string,
    corpus_paths: readonly string[] | null = null,
    opts: { threshold?: number } = {},
): Promise<import('./necessity.js').ImpactVerdict> {
    const threshold = opts.threshold ?? 0.92;

    const { load_anti_example_phrases, load_validated_phrases } = await import(
        './low_impact_corpus.js'
    );
    const { IMPACT_TRIGGERS, ImpactVerdict, LOCKED_IMPACT_CLASSES, classify_impact } =
        await import('./necessity.js');

    const base = classify_impact(question_text);
    if (LOCKED_IMPACT_CLASSES.has(base.impact_class)) {
        return base;
    }
    if (!corpus_paths || corpus_paths.length === 0 || !(threshold > 0.0 && threshold <= 1.0)) {
        return base;
    }

    let norm_q = (question_text || '').toLowerCase().replace(/[^\p{L}\p{N}_\s]/gu, ' ');
    norm_q = _pyStrip(norm_q.replace(/\s+/gu, ' '));
    if (!norm_q) {
        return base;
    }

    // High-impact-veto: a paraphrase carrying a security-class trigger wins
    // the Iron Law regardless of corpus similarity. Whole-word match against
    // the lowered query, mirroring `_count_matches`.
    const high_triggers = IMPACT_TRIGGERS['high_impact'] ?? [];
    const lowered_q = (question_text || '').toLowerCase();
    for (const trig of high_triggers) {
        const pattern = new RegExp(`\\b${_reEscape(trig.toLowerCase())}\\b`, 'u');
        if (pattern.test(lowered_q)) {
            return base;
        }
    }

    const validated: string[] = [];
    const anti: string[] = [];
    for (const p of corpus_paths) {
        validated.push(...load_validated_phrases(p));
        anti.push(...load_anti_example_phrases(p));
    }

    if (validated.length === 0) {
        return base;
    }

    const _ratio = (a: string, b: string): number => _sequenceMatcherRatio(a, b);

    const best_validated = validated.reduce((mx, p) => Math.max(mx, _ratio(norm_q, p)), 0.0);
    if (best_validated < threshold) {
        return base;
    }

    const best_anti = anti.reduce((mx, p) => Math.max(mx, _ratio(norm_q, p)), 0.0);
    // Anti-example-veto: if the query is at least as close to an anti-example
    // as to a validated phrase, the corpus has actively flagged this shape —
    // don't shortcut.
    if (anti.length > 0 && best_anti >= best_validated) {
        return base;
    }

    return new ImpactVerdict({
        impact_class: 'low_impact',
        confidence: pyRound(Math.min(0.9, best_validated), 4),
        rationale:
            `Fuzzy match against Validated corpus ` +
            `(ratio=${_pyFixed(best_validated, 3)} ≥ ${_pyFixed(threshold, 2)}) — routing ` +
            'as `low_impact` (step-9 P5).',
        category: 'corpus_validated_fuzzy',
    });
}

/**
 * Mirror Python `difflib.SequenceMatcher(a, b).ratio()`.
 *
 * `ratio = 2.0 * M / T`, where `T` is the total length of both sequences and
 * `M` is the number of matches as computed by the recursive
 * longest-matching-block algorithm (no autojunk for these short phrase
 * inputs). This is a faithful port of the `get_matching_blocks` /
 * `find_longest_match` core of CPython's `difflib`.
 */
function _sequenceMatcherRatio(a: string, b: string): number {
    const aChars = Array.from(a);
    const bChars = Array.from(b);
    const lenA = aChars.length;
    const lenB = bChars.length;
    const total = lenA + lenB;
    if (total === 0) {
        return 1.0;
    }
    // b2j: char -> list of indices in b (difflib's reverse index).
    const b2j = new Map<string, number[]>();
    for (let i = 0; i < lenB; i += 1) {
        const ch = bChars[i] as string;
        let arr = b2j.get(ch);
        if (arr === undefined) {
            arr = [];
            b2j.set(ch, arr);
        }
        arr.push(i);
    }

    const findLongestMatch = (
        alo: number,
        ahi: number,
        blo: number,
        bhi: number,
    ): [number, number, number] => {
        let besti = alo;
        let bestj = blo;
        let bestsize = 0;
        let j2len = new Map<number, number>();
        for (let i = alo; i < ahi; i += 1) {
            const newj2len = new Map<number, number>();
            const indices = b2j.get(aChars[i] as string) ?? [];
            for (const j of indices) {
                if (j < blo) {
                    continue;
                }
                if (j >= bhi) {
                    break;
                }
                const k = (j2len.get(j - 1) ?? 0) + 1;
                newj2len.set(j, k);
                if (k > bestsize) {
                    besti = i - k + 1;
                    bestj = j - k + 1;
                    bestsize = k;
                }
            }
            j2len = newj2len;
        }
        return [besti, bestj, bestsize];
    };

    // Iteratively accumulate matched-character count over the recursive block
    // decomposition (matches CPython's get_matching_blocks queue walk).
    let matches = 0;
    const queue: Array<[number, number, number, number]> = [[0, lenA, 0, lenB]];
    while (queue.length > 0) {
        const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number];
        const [i, j, k] = findLongestMatch(alo, ahi, blo, bhi);
        if (k > 0) {
            matches += k;
            if (alo < i && blo < j) {
                queue.push([alo, i, blo, j]);
            }
            if (i + k < ahi && j + k < bhi) {
                queue.push([i + k, ahi, j + k, bhi]);
            }
        }
    }

    return (2.0 * matches) / total;
}

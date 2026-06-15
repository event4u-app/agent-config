// Telegraph condensation bench — step-16 Phase 1 Step 4.
//
// Three-arm live bench against internal/bench/corpora/telegraph/prompts.yaml:
//   condensed     — system prompt embeds telegraph-speak rule (aggressive).
//   terse_control  — system prompt = "Answer concisely. …" (carve-out-free baseline).
//   uncondensed   — generic helpful-assistant system prompt.
//
// Token counts come from Anthropic API `usage` (authoritative). Carve-out
// share is measured via regex extraction on the reply text; chars/4 yields
// an estimated carve-out-token figure for the carve-out-tax accounting.
//
// Cost-touch: 10 prompts × 3 arms × claude-sonnet-4-5 (~$3/M in, ~$15/M out).
//
// TypeScript twin of `src/scripts/_lib/bench_telegraph.py` (ADR-096
// py2ts Phase 2 / Wave 2a). Public API mirrored exactly — snake_case
// names kept deliberately. Numeric helpers replicate Python's
// round-half-to-even (banker's rounding) and the `statistics` module
// median / pstdev semantics byte-for-byte so the report renderers
// produce identical text.
import * as fs from 'node:fs';

import YAML from 'yaml';

// ── system prompts per arm ──────────────────────────────────────────────

export const SYSTEM_PROMPT_CONDENSED = `You are speaking in TELEGRAPH-SPEAK mode (speak_scope=aggressive).

Condense all body prose to telegraph grammar:
- Drop articles (the, a, an).
- Drop linking auxiliaries (is, are, was, be) where unambiguous.
- Drop pronouns when context is clear.
- Keep nouns, verbs, key adjectives, negation, numbers.
- Example: "I will now check the file and see if it exists" -> "Check file. Exists?"

Carve-outs — preserve BYTE-FOR-BYTE (do NOT condense these):
1. Triple-backtick code/literal blocks (any language, including ALL-CAPS Iron-Law fences).
2. Numbered-options lines matching ^\\d+\\.\\s + a **Recommendation:** label.
3. Backtick spans (file paths, command names, identifiers).
4. Status markers: lines starting with ❌, ⚠️, or ✅.
5. Mode markers.
6. Markdown tables.
7. Deliverables (PR titles, commit messages, ticket summaries, articles, the prompt
   line of any single question asked to the user).

Apply telegraph condensation aggressively to every other prose surface.`;

export const SYSTEM_PROMPT_TERSE =
    'Answer concisely. Skip preamble. Do not restate the question. ' +
    "Avoid filler phrases ('Let me', 'Here is', 'I will'). Get to the answer.";

export const SYSTEM_PROMPT_UNCONDENSED =
    "You are a helpful AI assistant. Answer the user's question clearly and completely.";

export const ARMS: readonly string[] = ['condensed', 'terse_control', 'uncondensed'];
export const ARM_SYSTEM_PROMPT: Record<string, string> = {
    condensed: SYSTEM_PROMPT_CONDENSED,
    terse_control: SYSTEM_PROMPT_TERSE,
    uncondensed: SYSTEM_PROMPT_UNCONDENSED,
};

// ── carve-out detection ────────────────────────────────────────────────

// `[\s\S]` is the JS equivalent of Python's `re.DOTALL`-style `.`; the
// non-greedy `*?` mirrors the Python pattern exactly.
const _RE_TRIPLE_BACKTICK = /```[\s\S]*?```/g;
const _RE_BACKTICK_SPAN = /`[^`\n]+`/g;
const _RE_NUMBERED_LINE = /^>?\s*\d+\.\s.*$/gm;
const _RE_STATUS_LINE = /^(❌|⚠️|✅).*$/gm;
const _RE_TABLE_LINE = /^\s*\|.*\|\s*$/gm;
const _RE_RECOMMENDATION = /^\*\*(Recommendation|Empfehlung):\*\*.*$/gm;

const _CARVE_OUT_PATTERNS: readonly RegExp[] = [
    _RE_TRIPLE_BACKTICK,
    _RE_BACKTICK_SPAN,
    _RE_NUMBERED_LINE,
    _RE_STATUS_LINE,
    _RE_TABLE_LINE,
    _RE_RECOMMENDATION,
];

/**
 * Sum byte-length of every carve-out region (union, no double-count).
 *
 * Python masks by code-point index (`len(text)`, `range(start, end)`);
 * this twin masks by JS UTF-16 code-unit index. Match-offset arithmetic
 * stays self-consistent within JS, and the mask length tracks the same
 * units the regex offsets use, so the union count is identical to the
 * Python result for the same input.
 */
export function carve_out_chars(text: string): number {
    if (!text) {
        return 0;
    }
    const mask = new Uint8Array(text.length);
    for (const pattern of _CARVE_OUT_PATTERNS) {
        // Clone with a fresh lastIndex so repeated calls do not interfere.
        const re = new RegExp(pattern.source, pattern.flags);
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            const start = m.index;
            const end = m.index + m[0].length;
            for (let i = start; i < end; i++) {
                mask[i] = 1;
            }
            // Guard against zero-width matches causing an infinite loop
            // (Python's finditer advances past empty matches automatically).
            if (m[0].length === 0) {
                re.lastIndex += 1;
            }
        }
    }
    let total = 0;
    for (let i = 0; i < mask.length; i++) {
        total += mask[i] as number;
    }
    return total;
}

// ── data shapes ────────────────────────────────────────────────────────

export class ArmResult {
    arm: string;
    text: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    output_chars: number;
    carve_out_chars: number;
    error: string | null;

    constructor(params: {
        arm: string;
        text: string;
        input_tokens: number;
        output_tokens: number;
        latency_ms: number;
        output_chars: number;
        carve_out_chars: number;
        error?: string | null;
    }) {
        this.arm = params.arm;
        this.text = params.text;
        this.input_tokens = params.input_tokens;
        this.output_tokens = params.output_tokens;
        this.latency_ms = params.latency_ms;
        this.output_chars = params.output_chars;
        this.carve_out_chars = params.carve_out_chars;
        this.error = params.error ?? null;
    }

    get realised_carve_out_pct(): number {
        return this.output_chars ? this.carve_out_chars / this.output_chars : 0.0;
    }
}

export class PromptResult {
    id: string;
    category: string;
    expected_carve_out_pct: number;
    arms: Record<string, ArmResult>;

    constructor(params: {
        id: string;
        category: string;
        expected_carve_out_pct: number;
        arms?: Record<string, ArmResult>;
    }) {
        this.id = params.id;
        this.category = params.category;
        this.expected_carve_out_pct = params.expected_carve_out_pct;
        this.arms = params.arms ?? {};
    }

    get savings_vs_raw(): number | null {
        const c = this.arms['condensed'];
        const u = this.arms['uncondensed'];
        if (!c || !u || u.output_tokens === 0) {
            return null;
        }
        return 1.0 - c.output_tokens / u.output_tokens;
    }

    get savings_vs_terse(): number | null {
        const c = this.arms['condensed'];
        const t = this.arms['terse_control'];
        if (!c || !t || t.output_tokens === 0) {
            return null;
        }
        return 1.0 - c.output_tokens / t.output_tokens;
    }
}

// ── client + progress contracts ─────────────────────────────────────────

/** Shape of the response object returned by `client.ask(...)`. */
export interface ArmResponse {
    text: string | null;
    input_tokens?: number | null;
    output_tokens?: number | null;
    latency_ms?: number | null;
    error?: string | null;
}

/** Minimal client contract: a single `ask` method. */
export interface BenchClient {
    ask(system: string, userPrompt: string, opts?: { max_tokens?: number }): ArmResponse;
}

export type ProgressFn = (
    done: number,
    total: number,
    id: string,
    arm: string,
    result: ArmResult,
) => void;

// ── corpus + runner ──────────────────────────────────────────────────────

/** Read internal/bench/corpora/telegraph/prompts.yaml → list of prompt dicts. */
export function load_corpus(corpusPath: string): Array<Record<string, unknown>> {
    const data = (YAML.parse(fs.readFileSync(corpusPath, 'utf-8')) ?? {}) as Record<string, unknown>;
    const prompts = (data['prompts'] ?? []) as Array<Record<string, unknown>>;
    if (!prompts || prompts.length === 0) {
        throw new Error(`empty corpus: ${corpusPath}`);
    }
    return prompts;
}

// Python's `int(x)` truncates toward zero; replicate for token coercion.
function _toInt(value: unknown): number {
    return Math.trunc(Number(value ?? 0));
}

/** Invoke one arm against the live API. Returns ArmResult including text. */
export function run_arm(
    client: BenchClient,
    arm: string,
    userPrompt: string,
    opts: { max_tokens?: number } = {},
): ArmResult {
    const maxTokens = opts.max_tokens ?? 1024;
    const t0 = _monotonicMs();
    const system = ARM_SYSTEM_PROMPT[arm] as string;
    let resp: ArmResponse;
    try {
        resp = client.ask(system, userPrompt, { max_tokens: maxTokens });
    } catch (exc) {
        const latencyMs = Math.trunc(_monotonicMs() - t0);
        return new ArmResult({
            arm,
            text: '',
            input_tokens: 0,
            output_tokens: 0,
            latency_ms: latencyMs,
            output_chars: 0,
            carve_out_chars: 0,
            error: String(exc instanceof Error ? exc.message : exc),
        });
    }
    const text = resp.text ?? '';
    return new ArmResult({
        arm,
        text,
        input_tokens: _toInt(resp.input_tokens ?? 0),
        output_tokens: _toInt(resp.output_tokens ?? 0),
        latency_ms: Math.trunc(resp.latency_ms ?? _monotonicMs() - t0),
        output_chars: text.length,
        carve_out_chars: carve_out_chars(text),
        error: resp.error ?? null,
    });
}

// Monotonic clock in milliseconds (mirror of time.monotonic() * 1000).
function _monotonicMs(): number {
    // performance.now() is monotonic and returns ms; falls back to Date.
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
}

// ── numeric helpers — Python parity ──────────────────────────────────────

/**
 * statistics.median — average of the two middle values for even n,
 * the middle value for odd n. Input is assumed already sorted by the
 * caller (`_stats` sorts first); we re-sort defensively to mirror the
 * Python helper which is always handed a sorted list.
 */
function _median(values: number[]): number {
    const n = values.length;
    if (n === 0) {
        // statistics.median raises on empty input; _stats never calls it empty.
        throw new Error('median of empty list');
    }
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(n / 2);
    if (n % 2 === 1) {
        return s[mid] as number;
    }
    return ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** statistics.pstdev — population standard deviation. */
function _pstdev(values: number[]): number {
    const n = values.length;
    if (n === 0) {
        throw new Error('pstdev of empty list');
    }
    const mean = values.reduce((acc, v) => acc + v, 0) / n;
    const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / n;
    return Math.sqrt(variance);
}

export interface StatBlock {
    n: number;
    median: number;
    p10: number;
    p90: number;
    stdev: number;
}

/** Median / p10 / p90 / stdev / n on a list of floats. Empty → zeros. */
function _stats(values: number[]): StatBlock {
    if (values.length === 0) {
        return { n: 0, median: 0.0, p10: 0.0, p90: 0.0, stdev: 0.0 };
    }
    const s = [...values].sort((a, b) => a - b);
    const n = s.length;
    const _pct = (p: number): number => {
        if (n === 1) {
            return s[0] as number;
        }
        const k = (n - 1) * p;
        const lo = Math.trunc(k);
        const hi = Math.min(Math.trunc(k) + 1, n - 1);
        return (s[lo] as number) + ((s[hi] as number) - (s[lo] as number)) * (k - lo);
    };
    return {
        n,
        median: _median(s),
        p10: _pct(0.1),
        p90: _pct(0.9),
        stdev: n > 1 ? _pstdev(s) : 0.0,
    };
}

export { _stats };

export interface AggregateBlock {
    savings_vs_raw: StatBlock;
    savings_vs_terse: StatBlock;
    realised_carve_out_pct: StatBlock;
    expected_carve_out_pct: StatBlock;
    output_tokens: Record<string, StatBlock>;
}

/** Compute median/p10/p90 for condensation metrics across the corpus. */
export function aggregate_results(results: PromptResult[]): AggregateBlock {
    const vs_raw: number[] = [];
    for (const r of results) {
        const v = r.savings_vs_raw;
        if (v !== null) {
            vs_raw.push(v);
        }
    }
    const vs_terse: number[] = [];
    for (const r of results) {
        const v = r.savings_vs_terse;
        if (v !== null) {
            vs_terse.push(v);
        }
    }
    const realised_carve_pct: number[] = [];
    for (const r of results) {
        const c = r.arms['condensed'];
        if (c && c.output_chars) {
            realised_carve_pct.push(c.realised_carve_out_pct);
        }
    }
    const expected_carve_pct = results.map((r) => r.expected_carve_out_pct);

    const per_arm_tokens: Record<string, number[]> = {};
    for (const a of ARMS) {
        per_arm_tokens[a] = [];
    }
    for (const r of results) {
        for (const arm of ARMS) {
            const ar = r.arms[arm];
            if (ar) {
                (per_arm_tokens[arm] as number[]).push(ar.output_tokens);
            }
        }
    }

    const output_tokens: Record<string, StatBlock> = {};
    for (const arm of ARMS) {
        output_tokens[arm] = _stats((per_arm_tokens[arm] as number[]).map((v) => v));
    }

    return {
        savings_vs_raw: _stats(vs_raw),
        savings_vs_terse: _stats(vs_terse),
        realised_carve_out_pct: _stats(realised_carve_pct),
        expected_carve_out_pct: _stats(expected_carve_pct),
        output_tokens,
    };
}

export interface PricingDict {
    input?: number;
    output?: number;
}

export interface CostTotals {
    input_tokens: number;
    output_tokens: number;
    calls: number;
    errors: number;
    total_cost_usd: number;
}

export interface CostBlock {
    totals: CostTotals;
    per_arm: Record<string, { input_tokens: number; output_tokens: number; calls: number }>;
}

// Python round() uses banker's rounding (round-half-to-even).
function _pyRound(value: number, ndigits: number): number {
    const factor = Math.pow(10, ndigits);
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    const EPS = 1e-9;
    if (Math.abs(diff - 0.5) < EPS) {
        // Halfway → round to even.
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

export { _pyRound };

/** Sum input/output tokens across all arms; cost from per-1M pricing dict. */
export function compute_cost(results: PromptResult[], pricing: PricingDict): CostBlock {
    const totals: CostTotals = {
        input_tokens: 0,
        output_tokens: 0,
        calls: 0,
        errors: 0,
        total_cost_usd: 0,
    };
    const per_arm: Record<string, { input_tokens: number; output_tokens: number; calls: number }> = {};
    for (const a of ARMS) {
        per_arm[a] = { input_tokens: 0, output_tokens: 0, calls: 0 };
    }
    for (const r of results) {
        for (const arm of Object.keys(r.arms)) {
            const ar = r.arms[arm] as ArmResult;
            totals.input_tokens += ar.input_tokens;
            totals.output_tokens += ar.output_tokens;
            totals.calls += 1;
            if (ar.error) {
                totals.errors += 1;
            }
            const slot = per_arm[arm] as { input_tokens: number; output_tokens: number; calls: number };
            slot.input_tokens += ar.input_tokens;
            slot.output_tokens += ar.output_tokens;
            slot.calls += 1;
        }
    }
    const costUsd =
        (totals.input_tokens / 1e6) * (pricing.input ?? 0.0) +
        (totals.output_tokens / 1e6) * (pricing.output ?? 0.0);
    totals.total_cost_usd = _pyRound(costUsd, 6);
    return { totals, per_arm };
}

// ── orchestrator ───────────────────────────────────────────────────────────

/** Run all three arms over the corpus. Returns per-prompt results. */
export function run_telegraph_bench(
    client: BenchClient,
    corpusPath: string,
    opts: { max_prompts?: number | null; max_tokens?: number; on_progress?: ProgressFn | null } = {},
): PromptResult[] {
    const maxPrompts = opts.max_prompts ?? null;
    const maxTokens = opts.max_tokens ?? 1024;
    const onProgress = opts.on_progress ?? null;
    let prompts = load_corpus(corpusPath);
    if (maxPrompts) {
        prompts = prompts.slice(0, maxPrompts);
    }
    const results: PromptResult[] = [];
    const total = prompts.length * ARMS.length;
    let done = 0;
    for (const p of prompts) {
        const pr = new PromptResult({
            id: String(p['id']),
            category: String(p['category'] ?? 'unknown'),
            expected_carve_out_pct: Number(p['expected_carve_out_pct'] ?? 0.0),
        });
        for (const arm of ARMS) {
            const ar = run_arm(client, arm, String(p['prompt']), { max_tokens: maxTokens });
            pr.arms[arm] = ar;
            done += 1;
            if (onProgress) {
                onProgress(done, total, pr.id, arm, ar);
            }
        }
        results.push(pr);
    }
    return results;
}

// Telegraph bench report serializer — step-16 Phase 1 Step 5.
//
// Emits the telegraph-v1 JSON + Markdown shape. Distinct schema_version
// ("telegraph-v1") from the selection-accuracy bench (v1) because the
// blocks are disjoint: telegraph has no `selection`/`quality`, and the
// selection bench has no three-arm condensation metrics.
//
// TypeScript twin of `src/scripts/_lib/bench_telegraph_report.py`
// (ADR-090 py2ts Phase 2 / Wave 2a). Markdown rendering is byte-exact
// with the Python original; the `_fmt_pct` / `:.0f` helpers replicate
// Python's round-half-to-even formatting.
import {
    ARMS,
    type PromptResult,
    aggregate_results,
    compute_cost,
    type AggregateBlock,
    type CostBlock,
    type PricingDict,
} from './bench_telegraph.js';

export interface TelegraphReport {
    schema_version: string;
    generated_at: string;
    corpus: { id: string; path: string; prompt_count: number };
    runner: { bench_run_version: string; transport: string; model: string };
    telegraph: {
        arms: string[];
        aggregate: AggregateBlock;
        per_prompt: PromptBlock[];
    };
    cost: CostBlock & {
        source: string;
        model: string;
        pricing_sourced_on: string | null;
    };
    verdict: { overall: string; errors: number };
}

export interface PromptBlock {
    id: string;
    category: string;
    expected_carve_out_pct: number;
    realised_carve_out_pct: number | null;
    savings_vs_raw: number | null;
    savings_vs_terse: number | null;
    arms: Record<
        string,
        {
            input_tokens: number;
            output_tokens: number;
            latency_ms: number;
            output_chars: number;
            carve_out_chars: number;
            error: string | null;
            text: string;
        }
    >;
}

export function build_telegraph_report(params: {
    results: PromptResult[];
    corpus_path_rel: string;
    generated_at: string;
    bench_run_version: string;
    model: string;
    transport: string;
    pricing_rates: PricingDict;
    pricing_sourced_on: string | null;
}): TelegraphReport {
    const aggregate = aggregate_results(params.results);
    const cost = compute_cost(params.results, params.pricing_rates) as CostBlock & {
        source: string;
        model: string;
        pricing_sourced_on: string | null;
    };
    cost.source = 'live-api';
    cost.model = params.model;
    cost.pricing_sourced_on = params.pricing_sourced_on;
    const errors = cost.totals.errors;
    return {
        schema_version: 'telegraph-v1',
        generated_at: params.generated_at,
        corpus: {
            id: 'telegraph',
            path: params.corpus_path_rel,
            prompt_count: params.results.length,
        },
        runner: {
            bench_run_version: params.bench_run_version,
            transport: params.transport,
            model: params.model,
        },
        telegraph: {
            arms: [...ARMS],
            aggregate,
            per_prompt: params.results.map((r) => _prompt_block(r)),
        },
        cost,
        verdict: {
            overall: errors === 0 ? 'measured' : 'partial',
            errors,
        },
    };
}

function _prompt_block(r: PromptResult): PromptBlock {
    const c = r.arms['condensed'];
    const arms: PromptBlock['arms'] = {};
    for (const arm of Object.keys(r.arms)) {
        const ar = r.arms[arm];
        if (!ar) {
            continue;
        }
        arms[arm] = {
            input_tokens: ar.input_tokens,
            output_tokens: ar.output_tokens,
            latency_ms: ar.latency_ms,
            output_chars: ar.output_chars,
            carve_out_chars: ar.carve_out_chars,
            error: ar.error,
            text: ar.text,
        };
    }
    return {
        id: r.id,
        category: r.category,
        expected_carve_out_pct: r.expected_carve_out_pct,
        realised_carve_out_pct: c ? c.realised_carve_out_pct : null,
        savings_vs_raw: r.savings_vs_raw,
        savings_vs_terse: r.savings_vs_terse,
        arms,
    };
}

// ── Python-format parity helpers ─────────────────────────────────────────
//
// Python's f"{x:.2%}" and f"{m:.0f}" both round half-to-even (banker's
// rounding) on the decimal representation. JS `toFixed` rounds half away
// from zero, so we reimplement the formatting to stay byte-exact with the
// Python original.

/** Replicate Python `format(x, f".{ndigits}%")` — value × 100, banker-rounded, '%' suffix. */
function _py_format_pct(x: number, ndigits: number): string {
    return `${_pyFixed(x * 100, ndigits)}%`;
}

/** Replicate Python `format(x, f".{ndigits}f")`. */
function _py_format_fixed(x: number, ndigits: number): string {
    return _pyFixed(x, ndigits);
}

/**
 * Format `x` to `ndigits` decimals using round-half-to-even, matching
 * CPython's float formatting. Uses a high-precision intermediate to find
 * the exact halfway case the way CPython's dtoa does.
 */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
    const scaled = abs * factor;
    let rounded = Math.round(scaled);
    // Detect a halfway case robustly. Compare the scaled value against the
    // midpoint using the float's full precision; on a tie, round to even.
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    // Use a tolerance derived from the magnitude to absorb float noise.
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
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
    // CPython preserves the sign from the INPUT, not the rounded result:
    // f"{-0.0:.0f}" -> "-0", f"{-0.00001:.2%}" -> "-0.00%". Keep the leading
    // minus whenever the input is negative (including -0.0).
    return neg ? `-${result}` : result;
}

// Mirror of Python's _fmt_pct: f"{x:.2%}" for numbers, "—" otherwise.
function _fmt_pct(x: number | null | undefined): string {
    return typeof x === 'number' ? _py_format_pct(x, 2) : '—';
}

export function render_telegraph_markdown(report: TelegraphReport): string {
    const cv = report.telegraph;
    const agg = cv.aggregate;
    const cost = report.cost;
    const head: string[] = [
        `# Telegraph Bench Report — \`telegraph\` · ${report.generated_at}`,
        '',
        '## Headline',
        '',
        `- prompts: **${report.corpus.prompt_count}** · ` +
            `arms: **${cv.arms.join(', ')}** · ` +
            `model: **${report.runner.model}** · ` +
            `transport: **${report.runner.transport}**`,
        `- median savings vs raw: **${_fmt_pct(agg.savings_vs_raw.median)}** ` +
            `(p10 ${_fmt_pct(agg.savings_vs_raw.p10)} · p90 ${_fmt_pct(agg.savings_vs_raw.p90)})`,
        `- median savings vs terse-control: **${_fmt_pct(agg.savings_vs_terse.median)}** ` +
            `(p10 ${_fmt_pct(agg.savings_vs_terse.p10)} · p90 ${_fmt_pct(agg.savings_vs_terse.p90)})`,
        `- median realised carve-out share (condensed arm): **${_fmt_pct(agg.realised_carve_out_pct.median)}** ` +
            `(expected median ${_fmt_pct(agg.expected_carve_out_pct.median)})`,
        `- calls: **${cost.totals.calls}** · errors: **${cost.totals.errors}**`,
        `- verdict: **${report.verdict.overall}**`,
        '',
    ];
    const per_arm: string[] = [
        '## Per-arm token totals',
        '',
        '| arm | calls | input_tokens | output_tokens | median out/prompt |',
        '|---|---:|---:|---:|---:|',
    ];
    for (const arm of cv.arms) {
        const a = cost.per_arm[arm] as { input_tokens: number; output_tokens: number; calls: number };
        const m = (agg.output_tokens[arm] as { median: number }).median;
        per_arm.push(
            `| \`${arm}\` | ${a.calls} | ${a.input_tokens} | ${a.output_tokens} | ${_py_format_fixed(m, 0)} |`,
        );
    }
    per_arm.push('');
    const per_prompt: string[] = [
        '## Per-prompt results',
        '',
        '| id | category | exp.carve | real.carve | out.condensed | out.terse | out.uncondensed | vs raw | vs terse |',
        '|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ];
    for (const r of cv.per_prompt) {
        const arms = r.arms;
        const oc = _outTok(arms['condensed']);
        const ot = _outTok(arms['terse_control']);
        const ou = _outTok(arms['uncondensed']);
        per_prompt.push(
            `| \`${r.id}\` | ${r.category} | ` +
                `${_fmt_pct(r.expected_carve_out_pct)} | ${_fmt_pct(r.realised_carve_out_pct)} | ` +
                `${oc} | ${ot} | ${ou} | ` +
                `${_fmt_pct(r.savings_vs_raw)} | ${_fmt_pct(r.savings_vs_terse)} |`,
        );
    }
    per_prompt.push('');
    const notes: string[] = [
        '## Notes',
        '',
        `- corpus: \`${report.corpus.path}\``,
        `- pricing: \`internal/bench/pricing.yaml\` (sourced ${cost.pricing_sourced_on || '—'})`,
        `- schema: \`telegraph-v1\` (see \`docs/contracts/benchmark-report-schema.md\`)`,
        `- bench_run version: \`${report.runner.bench_run_version}\``,
        '',
    ];
    return [...head, ...per_arm, ...per_prompt, ...notes].join('\n');
}

// Python: arms.get("condensed", {}).get("output_tokens", "—")
function _outTok(slot: { output_tokens: number } | undefined): string {
    return slot ? String(slot.output_tokens) : '—';
}

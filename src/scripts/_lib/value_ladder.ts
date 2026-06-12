/**
 * Pure normaliser: raw bench reports → `value-v1` rung dicts.
 *
 * TypeScript twin of `src/scripts/_lib/value_ladder.py` (ADR-090 py2ts
 * Phase 2 / Wave 2a). Phase 1 Step 2 of the readable-value-dashboard roadmap.
 *
 * This module is **pure** — no I/O, no file reads, no clock. Inputs are
 * already-loaded dicts; outputs are rung dicts conforming to
 * `docs/contracts/value-report-schema.md`. The companion
 * `src/scripts/_lib/value_report.ts` owns the I/O wrapper that loads the raw
 * reports, calls these functions, and writes the assembled JSON.
 *
 * Rung dict shape (see `value-report-schema.md` for the full contract):
 *
 *     {
 *         "id": "<kebab-case>",
 *         "label": "<German + English>",
 *         "what_it_does": "<= 80 char phrase>",
 *         "token_delta": <signed int>,
 *         "eur_delta": <float>,
 *         "cumulative_pct": <signed float>,   // filled in by assemble_ladder
 *         "confidence": "measured" | "estimated" | "vendor-claim" | "pending",
 *         "source_report": "<relative path>",
 *         "footnote": "<optional caveat>",    // omitted when no caveat
 *     }
 *
 * The public API deliberately keeps snake_case names to mirror the Python
 * module 1:1 (per ADR-090 — Python style is part of the contract).
 */

// ── Shared dict types ───────────────────────────────────────────────────
//
// Python dicts are heterogeneous; the rungs / metrics carry a mix of
// strings, numbers, null, and (in inputs) nested structure. We model them
// as index signatures over a value union so the snake_case keys and the
// any-missing-key access pattern survive without `any`.

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export type Dict = Record<string, JsonValue>;

/** A cost-ladder rung. Heterogeneous to mirror the Python dict shape. */
export type Rung = Record<string, JsonValue>;

/** A behaviour metric dict. */
export type Metric = Record<string, JsonValue>;

// ── Python-parity numeric helpers ───────────────────────────────────────

/**
 * Python 3 `round(x)` / `round(x, ndigits)` — round-half-to-even
 * (banker's rounding). JS `Math.round` rounds half-away-from-zero for
 * positives and half-up generally, so we cannot use it directly.
 */
export function pyRound(value: number, ndigits = 0): number {
    if (!Number.isFinite(value) || value === 0) {
        return value;
    }
    // CPython's round(x, n) does correct decimal rounding of the *exact*
    // IEEE-754 value, half-to-even. The naive `Math.round(x * 10**n) / 10**n`
    // trick diverges because the multiply itself snaps a sub-half residue
    // up to an exact half (e.g. 741.9875 stored as 741.98749999… becomes
    // 741987.5 after ×1000, then rounds to even → 741.988, but Python keeps
    // 741.987). Instead, round the 17-significant-digit decimal expansion of
    // the double, which faithfully encodes whether the true value sits below
    // or above the half. 17 sig digits round-trips every double uniquely.
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    // toPrecision(17) → full-precision decimal (may be exponential for very
    // large / small magnitudes; the dashboard never hits those, but guard).
    let str = abs.toPrecision(17);
    if (str.includes('e') || str.includes('E')) {
        // Fall back to the naive path for out-of-range magnitudes — these do
        // not occur in the value-ladder inputs.
        const factor = 10 ** ndigits;
        return value > 0
            ? Math.round(abs * factor) / factor * sign
            : -Math.round(abs * factor) / factor;
    }
    let [intPart, fracPart = ''] = str.split('.');
    // Pad the fractional part so position `ndigits` and the deciding digit
    // both exist.
    while (fracPart.length <= ndigits) {
        fracPart += '0';
    }
    const keepFrac = fracPart.slice(0, ndigits);
    const deciderStr = fracPart.slice(ndigits);
    // Build the integer formed by intPart + keepFrac (the value scaled by
    // 10**ndigits, as an exact decimal string — no FP).
    const scaledIntStr = intPart + keepFrac;
    let scaledInt = BigInt(scaledIntStr === '' ? '0' : scaledIntStr);
    // Decide rounding direction from the decider digits (everything after
    // the kept fraction).
    const firstDecider = deciderStr.charAt(0);
    const restNonZero = /[1-9]/u.test(deciderStr.slice(1));
    let roundUp = false;
    if (firstDecider > '5' || (firstDecider === '5' && restNonZero)) {
        roundUp = true;
    } else if (firstDecider === '5' && !restNonZero) {
        // Exactly halfway → round half to even.
        roundUp = scaledInt % 2n === 1n;
    }
    if (roundUp) {
        scaledInt += 1n;
    }
    const factor = 10 ** ndigits;
    return (Number(scaledInt) / factor) * sign;
}

/** Python `int(x)` truncation toward zero. */
function pyInt(value: number): number {
    return Math.trunc(value);
}

/** Python `a // b` floor division for the integer cases this module uses. */
function floorDiv(numerator: number, denominator: number): number {
    return Math.floor(numerator / denominator);
}

/** Coerce a possibly-missing dict value to a number, mirroring `int(x.get(k, d))`. */
function asInt(value: JsonValue | undefined, fallback: number): number {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value === 'number') {
        return pyInt(value);
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : pyInt(parsed);
}

/** Coerce a possibly-missing dict value to a float, mirroring `float(x.get(k, d))`. */
function asFloat(value: JsonValue | undefined, fallback: number): number {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Mirror of `dict.get(key)` for a value that is either a number or `None`.
 * Returns the number, or `null` when missing / null / non-numeric — so the
 * `is None` checks in the Python source map to `=== null` here.
 */
function getNullableNumber(obj: Dict, key: string): number | null {
    const v = obj[key];
    if (typeof v === 'number') {
        return v;
    }
    return null;
}

/** Mirror of `dict.get(key)` returning a possibly-nested dict, else `{}`. */
function getDict(obj: Dict | null | undefined, key: string): Dict {
    if (!obj) {
        return {};
    }
    const v = obj[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
        return v as Dict;
    }
    return {};
}

// ── Reference scale defaults ────────────────────────────────────────────

export const DEFAULT_REFERENCE_SCALE: Dict = {
    requests: 1000,
    avg_input_tokens: 8000,
    avg_output_tokens: 600,
    model_tier: 'sonnet',
};

// Confidence levels that contribute to the cumulative / NETTO headline.
// `pending` (not yet measured) and `available` (measured but behind a
// default-off kill-switch, e.g. the thin projection) are shown with their
// token_delta but excluded from the default cumulative — the headline must
// reflect what actually ships by default.
const _COUNTING_CONFIDENCES = ['measured', 'estimated', 'vendor-claim'];

// ── Pricing ─────────────────────────────────────────────────────────────

/**
 * Convert (input, output) token counts to EUR using a pricing.yaml row.
 *
 * `pricing_row` is one entry from `internal/bench/pricing.yaml::models`
 * (the row with the matching tier). USD/1M token rates are converted to
 * EUR via `eur_per_usd` (default 0.92 — adjust at the call site if
 * `pricing.yaml` ever carries a EUR rate directly).
 */
export function price_tokens_eur(
    input_tokens: number,
    output_tokens: number,
    pricing_row: Dict,
    eur_per_usd = 0.92,
): number {
    const input_usd = (input_tokens / 1_000_000.0) * asFloat(pricing_row['input'], 0.0);
    const output_usd = (output_tokens / 1_000_000.0) * asFloat(pricing_row['output'], 0.0);
    return (input_usd + output_usd) * eur_per_usd;
}

/** Price a per-request *input* token delta at the reference scale. */
export function price_input_delta_eur(
    token_delta_per_request: number,
    reference_scale: Dict,
    pricing_row: Dict,
): number {
    const requests = asInt(reference_scale['requests'], 1000);
    const total_input_tokens = token_delta_per_request * requests;
    return price_tokens_eur(total_input_tokens, 0, pricing_row);
}

/** Price a per-request *output* token delta at the reference scale. */
export function price_output_delta_eur(
    token_delta_per_request: number,
    reference_scale: Dict,
    pricing_row: Dict,
): number {
    const requests = asInt(reference_scale['requests'], 1000);
    const total_output_tokens = token_delta_per_request * requests;
    return price_tokens_eur(0, total_output_tokens, pricing_row);
}

// ── Pending-rung factory ────────────────────────────────────────────────

/** Emit a `pending` rung — measurement not yet available. */
export function pending_rung(
    rung_id: string,
    label: string,
    what_it_does: string,
    source_report: string,
    footnote: string | null = null,
): Rung {
    const rung: Rung = {
        id: rung_id,
        label,
        what_it_does,
        token_delta: 0,
        eur_delta: 0.0,
        cumulative_pct: 0.0, // filled in by assemble_ladder
        confidence: 'pending',
        source_report,
    };
    if (footnote) {
        rung['footnote'] = footnote;
    }
    return rung;
}

// ── Rung extractors ─────────────────────────────────────────────────────

/** The zero-point rung. token_delta = 0 by construction. */
export function baseline_rung(_reference_scale: Dict): Rung {
    return {
        id: 'baseline',
        label: 'Without package',
        what_it_does: 'Baseline — the bare request without package rules.',
        token_delta: 0,
        eur_delta: 0.0,
        cumulative_pct: 0.0,
        confidence: 'measured',
        source_report: 'n/a',
    };
}

/**
 * Build the Paket-load rung from the canonical kernel list.
 *
 * Reads `dist/router.json::kernel` and sums per-file char counts to
 * compute the real always-loaded footprint.
 *
 * `router` is the decoded `dist/router.json` dict.
 * `rule_chars` is a `{rule_id: char_count}` mapping.
 * `charter_chars` is the always-loaded charter footprint.
 *
 * Returns a `pending` rung when the router is missing or has no kernel
 * entry; the rung's `source_report` cites the missing input.
 */
export function load_rung_from_router(
    router: Dict | null,
    rule_chars: Record<string, number> | null,
    charter_chars: number,
    reference_scale: Dict,
    pricing_row: Dict,
): Rung {
    if (!router || !('kernel' in router)) {
        return pending_rung(
            'load',
            'With package (rule load)',
            'The always-active rules land in the context of every request.',
            'dist/router.json',
            'Run scripts/compile_router.py to generate the router.',
        );
    }
    const charsMap = rule_chars || {};
    const kernelRaw = router['kernel'];
    const kernel_ids: JsonValue[] = Array.isArray(kernelRaw) ? kernelRaw : [];
    let kernel_total = 0;
    for (const rid of kernel_ids) {
        const key = String(rid);
        kernel_total += pyInt(charsMap[key] ?? 0);
    }
    const total_chars = kernel_total + pyInt(charter_chars);
    // 4 chars/token approximation, consistent with measure_frugality_savings.py.
    const token_delta = floorDiv(total_chars, 4);
    return {
        id: 'load',
        label: 'With package (rule load)',
        what_it_does: 'The always-active rules land in the context of every request.',
        token_delta,
        eur_delta: price_input_delta_eur(token_delta, reference_scale, pricing_row),
        cumulative_pct: 0.0,
        confidence: 'measured',
        source_report: 'dist/router.json',
        footnote:
            `Kernel = ${kernel_ids.length} rules (${kernel_total} chars) ` +
            `+ charter (${pyInt(charter_chars)} chars); tokens ≈ chars / 4.`,
    };
}

/**
 * Build the Paket-load rung from a frugality baseline.jsonl record.
 *
 * **Deprecated** — measures a hardcoded 6-rule canon, not the actual
 * always-loaded kernel. Kept as a back-compat fallback when
 * `dist/router.json` is missing. New callers should prefer
 * `load_rung_from_router()`.
 *
 * Returns a `pending` rung when the record is missing or malformed.
 */
export function load_rung_from_frugality(
    frugality_record: Dict | null,
    reference_scale: Dict,
    pricing_row: Dict,
): Rung {
    if (!frugality_record) {
        return pending_rung(
            'load',
            'With package (rule load)',
            'The always-active rules land in the context of every request.',
            'agents/runtime/frugality/baseline.jsonl',
            'Run scripts/measure_frugality_savings.py to populate.',
        );
    }
    const footprint = getDict(frugality_record, 'metric_a_footprint');
    const kernel = asInt(footprint['kernel_total_chars'], 0);
    const tier_1 = asInt(footprint['tier_1_total_chars'], 0);
    const tier_2 = asInt(footprint['tier_2_total_chars'], 0);
    const charter = asInt(footprint['charter_chars'], 0);
    const total_chars = kernel + tier_1 + tier_2 + charter;
    // 4 chars/token approximation, consistent with measure_frugality_savings.py.
    const token_delta = floorDiv(total_chars, 4);
    return {
        id: 'load',
        label: 'With package (rule load)',
        what_it_does: 'The always-active rules land in the context of every request.',
        token_delta,
        eur_delta: price_input_delta_eur(token_delta, reference_scale, pricing_row),
        cumulative_pct: 0.0,
        confidence: 'measured',
        source_report: 'agents/runtime/frugality/baseline.jsonl',
        footnote:
            'Always-loaded footprint = kernel + tier_1 + tier_2 + charter; ' +
            'tokens ≈ chars / 4.',
    };
}

/**
 * Build the load rung from the REAL eager always-on footprint.
 *
 * Reads the measured footprint from
 * `internal/bench/reports/projection-cost.json::rule_footprint[<tool>]`
 * so Panel A reflects what actually lands in context per request.
 *
 * Returns null when the projection report lacks the footprint, so the
 * caller can fall back to the router/frugality rung.
 */
export function load_rung_from_projection(
    projection: Dict | null,
    reference_scale: Dict,
    pricing_row: Dict,
    tool = '.claude',
): Rung | null {
    const rf = getDict(projection, 'rule_footprint');
    let entry: Dict | undefined;
    const direct = rf[tool];
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
        entry = direct as Dict;
    } else {
        // next(iter(rf.values()), None) — first value in insertion order.
        const firstKey = Object.keys(rf)[0];
        if (firstKey !== undefined) {
            const v = rf[firstKey];
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                entry = v as Dict;
            }
        }
    }
    if (!entry || !('tokens_gpt' in entry)) {
        return null;
    }
    const token_delta = asInt(entry['tokens_gpt'], 0);
    const files = asInt(entry['files'], 0);
    return {
        id: 'load',
        label: 'With package (rule load)',
        what_it_does: 'The always-active rules land in the context of every request.',
        token_delta,
        eur_delta: price_input_delta_eur(token_delta, reference_scale, pricing_row),
        cumulative_pct: 0.0,
        confidence: 'measured',
        source_report: 'internal/bench/reports/projection-cost.json',
        footnote:
            `Eager default: all ${files} rule files always-on in the ` +
            `\`${tool}\` projection path (0B.6-confirmed for the primary tool). ` +
            'Not just the kernel — this is the honest up-front load; ' +
            'tokens ≈ chars / 4.',
    };
}

/**
 * Build the thin-projection rung (Phase 3.1 lever).
 *
 * The thin projection keeps the kernel full-bodied and demotes every
 * non-kernel rule body to a router-resolved pointer, measured at
 * −`saved_gpt` tokens. It ships **behind a kill-switch**, so this rung is
 * `confidence: available` — its measured delta is shown but does NOT enter
 * the default cumulative.
 */
export function thin_rung_from_projection(
    projection: Dict | null,
    reference_scale: Dict,
    pricing_row: Dict,
): Rung {
    const tp = getDict(projection, 'thin_projection');
    if (Object.keys(tp).length === 0 || !('saved_gpt' in tp)) {
        return pending_rung(
            'thin',
            '+ thin (rules as pointers)',
            'Non-kernel rule bodies become router-resolved pointers.',
            'internal/bench/reports/projection-cost.json',
            'Run scripts/project_thin_rules.py --measure to populate.',
        );
    }
    const saved = asInt(tp['saved_gpt'], 0);
    const thin_total = asInt(tp['thin_gpt'], 0);
    const eager_total = asInt(tp['eager_gpt'], 0);
    // Python: pct = tp.get("saved_pct", 0) — passed through to the f-string
    // unmodified, so render it exactly as Python's str() would.
    const pct = tp['saved_pct'] !== undefined && tp['saved_pct'] !== null ? tp['saved_pct'] : 0;
    return {
        id: 'thin',
        label: '+ thin (rules as pointers)',
        what_it_does: 'Non-kernel rule bodies become router-resolved pointers.',
        token_delta: -saved,
        eur_delta: price_input_delta_eur(-saved, reference_scale, pricing_row),
        cumulative_pct: 0.0,
        confidence: 'available',
        source_report: 'internal/bench/reports/projection-cost.json',
        footnote:
            `Available behind \`lean_projection.mode=thin\` (default \`eager-all\` ` +
            `— hence NOT in the default NET). With thin active: rule layer ` +
            `${eager_total} → ${thin_total} GPT tok (−${saved}, −${pyStr(pct)}%). ` +
            'MUST-LOAD floor `task trigger-coverage` 26/26 green; ' +
            'live A/B validation pending (harness declined). ' +
            'Rollback = one flip.',
    };
}

/**
 * Build the condense rung from telegraph-v2 aggregate.
 *
 * Excludes Thin-Root files (per the spec); aggregates the
 * prose-heavy-contract + rule-classification categories. The rung is a
 * *saving* (negative token_delta) when the median is positive.
 */
export function condense_rung_from_telegraph_v2(
    telegraph_v2: Dict | null,
    baseline_input_tokens: number,
    reference_scale: Dict,
    pricing_row: Dict,
): Rung {
    if (!telegraph_v2 || !('aggregate' in telegraph_v2)) {
        return pending_rung(
            'condense',
            '+ condense (rule shrink)',
            'Build step shrinks rule files before shipping.',
            'internal/bench/reports/telegraph-v2.json',
            'Run scripts/bench_telegraph.py to populate.',
        );
    }
    const aggregate = getDict(telegraph_v2, 'aggregate');
    const by_cat = getDict(aggregate, 'by_category_median_pct');
    // Non-Thin-Root categories only.
    const non_thin_root: Record<string, number> = {};
    for (const [k, v] of Object.entries(by_cat)) {
        if (!k.startsWith('thin-root-')) {
            non_thin_root[k] = asFloat(v, 0.0);
        }
    }
    let median_saving_pct: number;
    if (Object.keys(non_thin_root).length === 0) {
        median_saving_pct = asFloat(aggregate['median_saving_pct'], 0.0);
    } else {
        // Simple mean across non-Thin-Root category medians.
        const values = Object.values(non_thin_root);
        const sum = values.reduce((acc, x) => acc + x, 0);
        median_saving_pct = sum / values.length;
    }
    // Saving % is the % of baseline_input_tokens that condense claws back.
    // Positive saving % → negative token_delta (we save tokens).
    const token_delta = -pyInt(pyRound((baseline_input_tokens * median_saving_pct) / 100.0));
    return {
        id: 'condense',
        label: '+ condense (rule shrink)',
        what_it_does: 'Build step shrinks rule files before shipping.',
        token_delta,
        eur_delta: price_input_delta_eur(token_delta, reference_scale, pricing_row),
        cumulative_pct: 0.0,
        confidence: 'measured',
        source_report: 'internal/bench/reports/telegraph-v2.json',
        footnote:
            'Aggregate across non-Thin-Root categories; Thin-Root files ' +
            '(AGENTS.md variants) net negative (~−4%) and are excluded ' +
            'from the rung — surfaced separately.',
    };
}

/**
 * Build the rtk rung from `internal/bench/reports/rtk/latest.json`.
 *
 * The rtk report carries the per-command corpus result + an aggregate
 * `tokens_saved_per_request` (output-side savings on tool calls). If
 * missing → `pending`.
 */
export function rtk_rung_from_report(
    rtk_report: Dict | null,
    reference_scale: Dict,
    pricing_row: Dict,
): Rung {
    if (!rtk_report) {
        return pending_rung(
            'rtk',
            '+ rtk (filter CLI output)',
            'rtk cuts verbose CLI output before the model input.',
            'internal/bench/reports/rtk/latest.json',
            'Install rtk and run scripts/bench_rtk_savings.py.',
        );
    }
    const aggregate = getDict(rtk_report, 'aggregate');
    const tokens_saved = asInt(aggregate['tokens_saved_per_request'], 0);
    if (tokens_saved <= 0) {
        return pending_rung(
            'rtk',
            '+ rtk (filter CLI output)',
            'rtk cuts verbose CLI output before the model input.',
            'internal/bench/reports/rtk/latest.json',
            'Report present but aggregate.tokens_saved_per_request ' +
                'is 0 — re-run scripts/bench_rtk_savings.py with the full ' +
                'corpus.',
        );
    }
    // Savings → negative token_delta.
    const token_delta = -tokens_saved;
    return {
        id: 'rtk',
        label: '+ rtk (filter CLI output)',
        what_it_does: 'rtk cuts verbose CLI output before the model input.',
        token_delta,
        eur_delta: price_input_delta_eur(token_delta, reference_scale, pricing_row),
        cumulative_pct: 0.0,
        confidence: 'measured',
        source_report: 'internal/bench/reports/rtk/latest.json',
    };
}

/**
 * Build the terse rung from telegraph-v1 vs_terse aggregate.
 *
 * The measured median is negative (~ −9.27% in the canonical report).
 * We render this honestly per the spec: a rung with the real value + a
 * footnote, never a "saving" label on a negative.
 */
export function terse_rung_from_telegraph_v1(
    telegraph_v1: Dict | null,
    reference_scale: Dict,
    pricing_row: Dict,
): Rung {
    if (!telegraph_v1 || !('telegraph' in telegraph_v1)) {
        return pending_rung(
            'terse',
            '+ terse (shorter replies)',
            'Telegraph style aims at terser model replies.',
            'internal/bench/reports/telegraph-v1.json',
            'Run scripts/bench_telegraph.py to populate.',
        );
    }
    const arms = getDict(getDict(telegraph_v1, 'telegraph'), 'aggregate');
    const vs_terse = getDict(arms, 'savings_vs_terse');
    const median = asFloat(vs_terse['median'], 0.0);
    // Output-side: positive median → fewer output tokens than terse control.
    // The measured median in the canonical report is negative (~ -0.0927).
    const avg_output = asInt(reference_scale['avg_output_tokens'], 600);
    const token_delta = -pyInt(pyRound(avg_output * median));
    const note =
        'Honest: measured median = ' +
        `${formatSignedPct(median * 100)}% against 'be terse' — telegraph delivers ` +
        'more tokens here, not fewer. We measure, we do not hide.';
    return {
        id: 'terse',
        label: '+ terse (shorter replies)',
        what_it_does: 'Telegraph style aims at terser model replies.',
        token_delta,
        eur_delta: price_output_delta_eur(token_delta, reference_scale, pricing_row),
        cumulative_pct: 0.0,
        confidence: 'measured',
        source_report: 'internal/bench/reports/telegraph-v1.json',
        footnote: note,
    };
}

// ── Behaviour-metric extractors ─────────────────────────────────────────

/** Right-skill selection: top-K hit rate with vs. without. */
export function selection_metric_from_dev_reports(
    with_report: Dict | null,
    without_report: Dict | null,
): Metric {
    if (!with_report && !without_report) {
        return {
            id: 'selection',
            label: 'Right-skill selection',
            what_this_means: 'How often the right skill activates (top-K hit).',
            with: null,
            without: null,
            delta: null,
            unit: 'pct',
            mode: 'dry-run',
            source_report: 'internal/bench/reports/ab/<dev-corpus-pair>.json',
        };
    }
    const w = getNullableNumber(getDict(with_report, 'selection'), 'selection_accuracy');
    const wo = getNullableNumber(getDict(without_report, 'selection'), 'selection_accuracy');
    let delta: number | null = null;
    if (w !== null && wo !== null) {
        delta = pyRound(w - wo, 4);
    }
    // mode = ((with_report or {}).get("results") or {}).get("mode") or "live"
    const results = getDict(with_report, 'results');
    const modeRaw = results['mode'];
    const mode = modeRaw !== undefined && modeRaw !== null && modeRaw !== '' ? String(modeRaw) : 'live';
    return {
        id: 'selection',
        label: 'Right-skill selection',
        what_this_means: 'How often the right skill activates (top-K hit).',
        with: w,
        without: wo,
        delta,
        unit: 'pct',
        mode,
        source_report: 'internal/bench/reports/ab/',
    };
}

/** Destructive-op stops: N/5 vs M/5 — counts, not pct. */
export function destructive_stops_metric(
    with_stops: number | null,
    without_stops: number | null,
    total = 5,
): Metric {
    if (with_stops === null && without_stops === null) {
        return {
            id: 'destructive-stops',
            label: 'Destructive-op stops',
            what_this_means:
                'How often the agent stops / asks before destructive ops ' + `(of ${total}).`,
            with: null,
            without: null,
            delta: null,
            unit: 'count',
            mode: 'dry-run',
            source_report: 'internal/bench/reports/ab/<destructive-corpus-pair>.json',
        };
    }
    let delta: number | null = null;
    if (with_stops !== null && without_stops !== null) {
        delta = with_stops - without_stops;
    }
    return {
        id: 'destructive-stops',
        label: 'Destructive-op stops',
        what_this_means:
            'How often the agent stops / asks before destructive ops ' + `(of ${total}).`,
        with: with_stops,
        without: without_stops,
        delta,
        unit: 'count',
        mode: 'live',
        source_report: 'internal/bench/reports/ab/',
    };
}

/** Ask-vs-act ratio: lower = more decisive under autonomy mandate. */
export function ask_vs_act_metric(
    with_ratio: number | null,
    without_ratio: number | null,
    mode = 'live',
): Metric {
    if (with_ratio === null && without_ratio === null) {
        return {
            id: 'ask-vs-act',
            label: 'Ask-vs-act ratio',
            what_this_means:
                'Ratio of clarifying questions to actions — lower = more decisive.',
            with: null,
            without: null,
            delta: null,
            unit: 'ratio',
            mode: 'dry-run',
            source_report: 'internal/bench/reports/ab/',
        };
    }
    let delta: number | null = null;
    if (with_ratio !== null && without_ratio !== null) {
        delta = pyRound(with_ratio - without_ratio, 4);
    }
    return {
        id: 'ask-vs-act',
        label: 'Ask-vs-act ratio',
        what_this_means: 'Ratio of clarifying questions to actions — lower = more decisive.',
        with: with_ratio,
        without: without_ratio,
        delta,
        unit: 'ratio',
        mode,
        source_report: 'internal/bench/reports/ab/',
    };
}

/** Task completion rate from A/B Track B. */
export function completion_metric(
    with_rate: number | null,
    without_rate: number | null,
    mode = 'live',
): Metric {
    if (with_rate === null && without_rate === null) {
        return {
            id: 'completion',
            label: 'Task completion rate',
            what_this_means: 'Share of tasks the agent completes fully.',
            with: null,
            without: null,
            delta: null,
            unit: 'pct',
            mode: 'dry-run',
            source_report: 'internal/bench/reports/ab/<trackb-pair>.json',
        };
    }
    let delta: number | null = null;
    if (with_rate !== null && without_rate !== null) {
        delta = pyRound(with_rate - without_rate, 4);
    }
    return {
        id: 'completion',
        label: 'Task completion rate',
        what_this_means: 'Share of tasks the agent completes fully.',
        with: with_rate,
        without: without_rate,
        delta,
        unit: 'pct',
        mode,
        source_report: 'internal/bench/reports/ab/',
    };
}

// ── Assembler ───────────────────────────────────────────────────────────

/**
 * Fill in `cumulative_pct` for every rung in order.
 *
 * Mutates copies (does not modify input dicts). Returns the new list.
 * A `pending` rung contributes 0 to the cumulative (its token_delta must
 * NOT influence the headline until it flips to `measured`).
 */
export function assemble_ladder(rungs: Rung[], baseline_input_tokens: number): Rung[] {
    const out: Rung[] = [];
    let running = 0;
    for (const rung of rungs) {
        const rung_copy: Rung = { ...rung };
        const counts = _COUNTING_CONFIDENCES.includes(String(rung_copy['confidence']));
        const delta = counts ? asInt(rung_copy['token_delta'], 0) : 0;
        running += delta;
        if (baseline_input_tokens > 0) {
            rung_copy['cumulative_pct'] = pyRound((100.0 * running) / baseline_input_tokens, 3);
        } else {
            rung_copy['cumulative_pct'] = 0.0;
        }
        out.push(rung_copy);
    }
    return out;
}

/** Compute the totals block from the assembled ladder. */
export function compute_totals(
    rungs: Rung[],
    baseline_input_tokens: number,
    reference_scale: Dict,
    pricing_row: Dict,
): Dict {
    let cumulative_token_delta = 0;
    for (const r of rungs) {
        if (_COUNTING_CONFIDENCES.includes(String(r['confidence']))) {
            cumulative_token_delta += asInt(r['token_delta'], 0);
        }
    }
    let cumulative_pct = 0.0;
    if (baseline_input_tokens > 0) {
        cumulative_pct = pyRound((100.0 * cumulative_token_delta) / baseline_input_tokens, 3);
    }
    const cumulative_eur = price_input_delta_eur(
        cumulative_token_delta,
        reference_scale,
        pricing_row,
    );
    let verdict: string;
    if (cumulative_token_delta < 0) {
        verdict = 'net-saving';
    } else if (cumulative_token_delta > 0) {
        verdict = 'net-cost';
    } else {
        verdict = 'break-even';
    }
    return {
        cumulative_token_delta,
        cumulative_eur_delta: pyRound(cumulative_eur, 4),
        cumulative_pct,
        net_verdict: verdict,
    };
}

// ── Render helpers (Python f-string format parity) ───────────────────────

/**
 * Python `f"{x:+.2f}"` — always-signed, 2 decimal places.
 * Used by the terse rung footnote. `-0.00` is possible in Python for
 * tiny negatives, so we mirror that: format magnitude then prepend sign.
 */
function formatSignedPct(value: number): string {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${Math.abs(value).toFixed(2)}`;
}

/**
 * Python `str(x)` for a JSON value as embedded in an f-string. Numbers
 * render without trailing-zero stripping concerns here because the only
 * caller passes `saved_pct` straight through (an int or float from JSON).
 * Mirrors Python's repr for the int / float cases this module sees.
 */
function pyStr(value: JsonValue): string {
    if (typeof value === 'number') {
        // Python str(77.3) -> "77.3"; str(77) -> "77". JS String() already
        // matches for these; integers print without a decimal point.
        return String(value);
    }
    return String(value);
}

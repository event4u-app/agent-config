/**
 * Runtime pricing layer for the AI Council.
 *
 * Ported from the retired Python `src/scripts/ai_council/pricing.py` (ADR-200 —
 * Python→TS migration, Phase 8 / Wave 8g; ported as a prerequisite of
 * `update_prices.ts`). Mirrors the Python public surface used by the
 * caller: `PRICES_FILE`, `load_prices`, `is_stale`, `_render_markdown`,
 * plus `bootstrap_from_defaults` / `last_monday_utc` for completeness.
 *
 * Reads `agents/runtime/.agent-prices.md`, parses YAML frontmatter + the
 * Markdown table. Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.,
 * including the byte-identical `{x:>6.2f}` row formatting.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PRICES, LAST_UPDATED, as_rows, priceKey } from './_default_prices.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/ai_council/pricing.ts → parents[3] == PACKAGE root. Correct
// only when the council runs inside the agent-config source repo; from an
// installed package this points INTO the npm prefix — callers that operate
// on a consumer project must anchor via `prices_file_for(<project root>)`
// instead (writing into the installed package pollutes it and EACCES-crashes
// on root-owned npm prefixes).
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const PRICES_FILE = path.join(REPO_ROOT, 'agents', 'runtime', '.agent-prices.md');

/** Prices file anchored to the PROJECT the council operates on. */
export function prices_file_for(repo_root: string): string {
    return path.join(repo_root, 'agents', 'runtime', '.agent-prices.md');
}

const _CHARS_PER_TOKEN = 4;

export interface Price {
    provider: string;
    model: string;
    input_per_1m_usd: number;
    output_per_1m_usd: number;
}

export interface PriceTable {
    last_updated: string; // YYYY-MM-DD
    currency: string;
    unit: string; // "per_1M_tokens"
    source: string;
    prices: Map<string, Price>; // keyed by priceKey(provider, model)
}

/**
 * Price for (provider, model) — exact key first, then the longest matching
 * key PREFIX within the same provider.
 *
 * Exact match stays the first hit, so no call that resolves today changes
 * path or price. The fallback exists because vendors ship dated aliases:
 * `claude-sonnet-4-5-20260101` missed a `claude-sonnet-4-5` row and priced at
 * **nothing** — a silent zero, not an error. Longest-first means a more
 * specific row always wins over a shorter one that also prefixes the id
 * (`claude-opus-4-1` over a hypothetical `claude-opus`).
 *
 * The prefix must be followed by a separator (`-`, `.`, `:`, `@`) or end the
 * id, so `claude-opus-4-1` never matches a `claude-opus-4-15` row: a bare
 * `startsWith` would price one model at another's rate, which is worse than
 * the zero it replaces because it looks correct.
 *
 * Provider is part of the composite key, so cross-provider bleed is
 * impossible by construction.
 */
export function lookup(table: PriceTable, provider: string, model: string): Price | null {
    const exact = table.prices.get(priceKey(provider, model));
    if (exact !== undefined) {
        return exact;
    }
    // Derived from `priceKey`, never hand-rebuilt: it owns the composite-key
    // encoding, and a second copy here would let a separator change follow the
    // exact-match path while this loop silently matched nothing — regressing to
    // the very silent zero the fallback exists to remove.
    const prefix = priceKey(provider, '');
    let best: Price | null = null;
    let bestLen = -1;
    for (const [key, price] of table.prices) {
        if (!key.startsWith(prefix)) {
            continue;
        }
        const candidate = key.slice(prefix.length);
        if (!candidate || !model.startsWith(candidate)) {
            continue;
        }
        const next = model.charAt(candidate.length);
        if (next !== '' && next !== '-' && next !== '.' && next !== ':' && next !== '@') {
            continue;
        }
        if (candidate.length > bestLen) {
            best = price;
            bestLen = candidate.length;
        }
    }
    return best;
}

// ── token + cost arithmetic ────────────────────────────────────────

export function estimate_input_tokens(text: string): number {
    if (!text) {
        return 0;
    }
    return Math.max(1, Math.floor(text.length / _CHARS_PER_TOKEN));
}

export interface CostEstimate {
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    input_usd: number;
    output_usd: number;
}

export function estimate_cost(
    provider: string,
    model: string,
    inputTokens: number,
    maxOutputTokens: number,
    table: PriceTable,
): CostEstimate {
    const price = lookup(table, provider, model);
    if (price === null) {
        return {
            provider,
            model,
            input_tokens: inputTokens,
            output_tokens: maxOutputTokens,
            input_usd: 0.0,
            output_usd: 0.0,
        };
    }
    const inputUsd = (inputTokens / 1_000_000) * price.input_per_1m_usd;
    const outputUsd = (maxOutputTokens / 1_000_000) * price.output_per_1m_usd;
    return {
        provider,
        model,
        input_tokens: inputTokens,
        output_tokens: maxOutputTokens,
        input_usd: inputUsd,
        output_usd: outputUsd,
    };
}

// ── billable-aware aggregation ─────────────────────────────────────
//
// A vendor-official CLI seat (anthropic / openai / gemini) runs under the
// user's subscription auth and is `billable = false`; the contract states it
// in as many words (`docs/contracts/ai-council-config.md:173`). Pricing such
// an answer at API rates and reporting the figure as spend is the defect these
// two helpers exist to close, found 2026-08-27: `council_cli.ts` ran
// `estimate_cost` over every non-errored response with no `billable` check, so
// one run printed `TOTAL: $0.0000` from the pre-run path (which filters) and
// `actual $0.1055` from the post-run path, two lines apart.
//
// Why the coercion below is not paranoia: `_serialise_responses` stringifies
// every metadata value with `String(v)`, so a persisted artefact carries
// `"billable": "false"` — and `Boolean("false")` is `true` in JavaScript. A
// consumer reading the field back with a bare `Boolean()` sees a subscription
// seat as billable, which is the same wrong answer arrived at from the other
// direction.

/** The subset of a `CouncilResponse` the cost aggregation reads. */
export interface BillableCostInput {
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    error?: string | null;
    metadata?: Record<string, unknown> | null;
}

/**
 * Does this response represent money actually spent?
 *
 * ABSENT means billable. A missing flag is not evidence of a free call, and
 * defaulting the other way would let a client that forgot to stamp its
 * transport silently zero its own spend.
 */
export function isBillableResponse(r: BillableCostInput): boolean {
    const raw = (r.metadata ?? {})['billable'];
    if (raw === undefined || raw === null) {
        return true;
    }
    if (typeof raw === 'boolean') {
        return raw;
    }
    if (typeof raw === 'string') {
        // The persisted form. Only the two literals a `String(v)` round-trip
        // can produce are interpreted; anything else falls through to the
        // conservative default rather than being guessed at.
        const t = raw.trim().toLowerCase();
        if (t === 'false') {
            return false;
        }
        return true;
    }
    // Every other type is BILLABLE, not truthiness-of-value. The first draft of
    // this function ended `return Boolean(raw)` while its own comment promised a
    // conservative default, and a council review (2/2) caught the contradiction:
    // `Boolean(0)` and `Boolean([])` are `false`, so a numeric or empty-array
    // value would have zeroed a billable seat's spend. The serialiser should
    // never emit those, which is exactly why guessing at them is wrong.
    return true;
}

/**
 * Did every answered response come from a non-billable transport?
 *
 * Exported because the CLI's output line needs it and must NOT infer it from a
 * zero total. A council review (2/2) rated that inference the highest-severity
 * finding in the first draft, and the reasoning is concrete: `estimate_cost`
 * returns `0.0` when `lookup` finds no price row, so an unpriced BILLABLE model
 * produces a zero total. So do a billable seat that errored and one that
 * reported zero tokens. All three would have printed "all seats
 * subscription-authed" over real spend.
 *
 * Vacuously false on an empty or all-errored set: with nothing answered there is
 * no transport to make a claim about, and silence is the honest output.
 */
export function allSeatsNonBillable(responses: BillableCostInput[]): boolean {
    const answered = responses.filter((r) => !r.error);
    if (answered.length === 0) {
        return false;
    }
    return answered.every((r) => !isBillableResponse(r));
}

/**
 * Total USD actually spent across a set of responses.
 *
 * Errored responses contribute nothing (no tokens were billed for an answer
 * that never arrived), and non-billable transports contribute nothing (the
 * subscription already paid). What remains is spend.
 */
export function sumBillableCost(responses: BillableCostInput[], table: PriceTable): number {
    let total = 0.0;
    for (const r of responses) {
        if (r.error) {
            continue;
        }
        if (!isBillableResponse(r)) {
            continue;
        }
        const ce = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table);
        total += ce.input_usd + ce.output_usd;
    }
    return total;
}

// ── prompt-cache repricing ─────────────────────────────────────────
//
// Prompt-cache multipliers derived from the base input rate (Anthropic, GA —
// no beta header): cache reads bill at ~0.1× input; cache writes at 1.25×
// (5-min TTL) / 2× (1-h TTL). Kept as CONSTANTS, not columns in
// `.agent-prices.md`, because that table's row format is byte-frozen (see the
// file header) and downstream tests pin it.
export const CACHE_READ_MULTIPLIER = 0.1;
export const CACHE_WRITE_MULTIPLIER_5M = 1.25;
export const CACHE_WRITE_MULTIPLIER_1H = 2.0;

export interface CacheTokenBreakdown {
    input_tokens: number; // uncached input, billed at the full rate
    cache_read_input_tokens?: number; // billed at CACHE_READ_MULTIPLIER × input
    cache_creation_input_tokens?: number; // billed at the write multiplier
    output_tokens: number;
}

/** A1↔A3 coupling verdict for a proposed model downgrade (Phase A3). */
export interface DowngradeCoupling {
    /** Full-rate cost delta per call: estimate(current) − estimate(suggested). */
    downgrade_savings_usd: number;
    /**
     * Cache value forfeited by leaving the current model: the prompt cache is
     * model-scoped, so a downgraded member re-pays the full input rate on the
     * span that would have been read back at CACHE_READ_MULTIPLIER.
     */
    lost_cache_savings_usd: number;
    /** True iff downgrade_savings_usd > lost_cache_savings_usd. */
    net_positive: boolean;
}

/**
 * Decide whether a suggested downgrade is net-positive AFTER accounting for
 * the model-scoped prompt cache (roadmap A3 gate: downgrade only when
 * `downgrade_savings > lost_cache_savings`).
 *
 * `cache.expected_reads` is the number of same-model cache reads the run
 * would plausibly realize at the CURRENT model (rounds − 1 on multi-round
 * runs, 0 on one-shot paths like the low-impact fast-path). With caching
 * disabled the lost term is 0 and any cheaper model wins.
 */
export function downgrade_coupling(
    provider: string,
    current_model: string,
    suggested_model: string,
    input_tokens: number,
    max_output_tokens: number,
    cache: {
        enabled: boolean;
        cacheable_prefix_tokens: number;
        expected_reads: number;
    },
    table: PriceTable,
): DowngradeCoupling {
    const cur = estimate_cost(provider, current_model, input_tokens, max_output_tokens, table);
    const sug = estimate_cost(provider, suggested_model, input_tokens, max_output_tokens, table);
    const downgrade_savings_usd =
        cur.input_usd + cur.output_usd - (sug.input_usd + sug.output_usd);
    let lost_cache_savings_usd = 0;
    if (cache.enabled && cache.expected_reads > 0 && cache.cacheable_prefix_tokens > 0) {
        const cur_rates = lookup(table, provider, current_model);
        if (cur_rates !== null) {
            lost_cache_savings_usd =
                (cache.cacheable_prefix_tokens / 1_000_000) *
                cur_rates.input_per_1m_usd *
                (1 - CACHE_READ_MULTIPLIER) *
                cache.expected_reads;
        }
    }
    return {
        downgrade_savings_usd,
        lost_cache_savings_usd,
        net_positive: downgrade_savings_usd > lost_cache_savings_usd,
    };
}

/**
 * Realized cost of a call given OBSERVED cache-token counts (from
 * `CouncilResponse.usage`). Deliberately separate from `estimate_cost`, which
 * stays cache-agnostic (a conservative 0%-cache-hit pre-flight) so the budget
 * gate never under-predicts. This function is the post-hoc actual that surfaces
 * the saving. `ttl` selects the write multiplier (default 5-min).
 */
export function reprice_with_cache(
    provider: string,
    model: string,
    tokens: CacheTokenBreakdown,
    table: PriceTable,
    ttl: '5m' | '1h' = '5m',
): CostEstimate {
    const price = lookup(table, provider, model);
    const read = tokens.cache_read_input_tokens ?? 0;
    const write = tokens.cache_creation_input_tokens ?? 0;
    const totalInput = tokens.input_tokens + read + write;
    if (price === null) {
        return {
            provider,
            model,
            input_tokens: totalInput,
            output_tokens: tokens.output_tokens,
            input_usd: 0.0,
            output_usd: 0.0,
        };
    }
    const writeMult = ttl === '1h' ? CACHE_WRITE_MULTIPLIER_1H : CACHE_WRITE_MULTIPLIER_5M;
    const inputUsd =
        (tokens.input_tokens / 1_000_000) * price.input_per_1m_usd +
        (read / 1_000_000) * price.input_per_1m_usd * CACHE_READ_MULTIPLIER +
        (write / 1_000_000) * price.input_per_1m_usd * writeMult;
    const outputUsd = (tokens.output_tokens / 1_000_000) * price.output_per_1m_usd;
    return {
        provider,
        model,
        input_tokens: totalInput,
        output_tokens: tokens.output_tokens,
        input_usd: inputUsd,
        output_usd: outputUsd,
    };
}

// ── staleness ──────────────────────────────────────────────────────

/** Return the most recent Monday 00:00 UTC as a date (YYYY-MM-DD). */
export function last_monday_utc(now?: Date): string {
    const n = now ?? new Date();
    // Python weekday(): Mon=0..Sun=6. JS getUTCDay(): Sun=0..Sat=6.
    const jsDay = n.getUTCDay();
    const weekday = (jsDay + 6) % 7; // → Mon=0..Sun=6
    const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - weekday);
    return d.toISOString().slice(0, 10);
}

/** True if `last_updated` is older than the most recent UTC Monday. */
export function is_stale(table: PriceTable, now?: Date): boolean {
    // date.fromisoformat — must be exactly YYYY-MM-DD; else ValueError → True.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(table.last_updated)) {
        return true;
    }
    const last = table.last_updated;
    return last < last_monday_utc(now);
}

// ── parser + bootstrap ─────────────────────────────────────────────

export function load_prices(p: string = PRICES_FILE): PriceTable {
    if (!fs.existsSync(p)) {
        bootstrap_from_defaults(p);
    }
    return _parse(fs.readFileSync(p, 'utf-8'));
}

export function bootstrap_from_defaults(p: string = PRICES_FILE): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const rows = as_rows();
    const body = _render_markdown(LAST_UPDATED, 'shipped-default', rows);
    fs.writeFileSync(p, body, 'utf-8');
}

/** Mirror Python `{x:>6.2f}` — 2 decimals, right-justified to width 6. */
function _fmt62f(x: number): string {
    const s = x.toFixed(2);
    return s.length >= 6 ? s : ' '.repeat(6 - s.length) + s;
}

/** Mirror Python `{s:<N}` left-justify (space pad). */
function _ljust(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

export function _render_markdown(
    lastUpdated: string,
    source: string,
    rows: Array<[string, string, number, number]>,
): string {
    const lines = [
        '---',
        `last_updated: ${lastUpdated}`,
        'currency: USD',
        'unit: per_1M_tokens',
        `source: ${source}`,
        '---',
        '',
        '# Agent prices',
        '',
        '| provider  | model               | input  | output |',
        '|-----------|---------------------|--------|--------|',
    ];
    for (const [provider, model, inp, outp] of rows) {
        lines.push(`| ${_ljust(provider, 9)} | ${_ljust(model, 19)} | ${_fmt62f(inp)} | ${_fmt62f(outp)} |`);
    }
    lines.push('');
    return lines.join('\n');
}

function _parse(text: string): PriceTable {
    const [front, body] = _split_frontmatter(text);
    const meta = _parse_frontmatter(front);
    const prices = _parse_table(body);
    return {
        last_updated: meta.last_updated ?? '1970-01-01',
        currency: meta.currency ?? 'USD',
        unit: meta.unit ?? 'per_1M_tokens',
        source: meta.source ?? 'unknown',
        prices,
    };
}

function _split_frontmatter(text: string): [string, string] {
    if (!text.startsWith('---')) {
        return ['', text];
    }
    // text.split("---", 2) — Python: at most 2 splits → 3 parts max.
    const parts = _pySplit(text, '---', 2);
    if (parts.length < 3) {
        return ['', text];
    }
    return [parts[1] as string, parts[2] as string];
}

/** Python str.split(sep, maxsplit) semantics. */
function _pySplit(s: string, sep: string, maxsplit: number): string[] {
    const out: string[] = [];
    let rest = s;
    let n = 0;
    while (n < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx === -1) {
            break;
        }
        out.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        n++;
    }
    out.push(rest);
    return out;
}

function _parse_frontmatter(front: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (let line of front.split('\n')) {
        line = line.trim();
        if (!line || !line.includes(':')) {
            continue;
        }
        const idx = line.indexOf(':');
        out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return out;
}

function _parse_table(body: string): Map<string, Price> {
    const out = new Map<string, Price>();
    for (let line of body.split('\n')) {
        line = line.trim();
        if (!line.startsWith('|') || line.startsWith('|--') || line.startsWith('|-')) {
            continue;
        }
        // line.strip("|").split("|")
        const stripped = line.replace(/^\|+/, '').replace(/\|+$/, '');
        const cells = stripped.split('|').map((c) => c.trim());
        if (cells.length !== 4) {
            continue;
        }
        const [provider, model, inp, outp] = cells as [string, string, string, string];
        if (provider === 'provider') {
            continue; // header row
        }
        const inV = _pyFloat(inp);
        const outV = _pyFloat(outp);
        if (inV === null || outV === null) {
            continue; // ValueError → skip
        }
        out.set(priceKey(provider, model), {
            provider,
            model,
            input_per_1m_usd: inV,
            output_per_1m_usd: outV,
        });
    }
    return out;
}

/** Python float(str) — returns null on ValueError. */
function _pyFloat(s: string): number | null {
    const t = s.trim();
    if (t === '') {
        return null;
    }
    const n = Number(t);
    return Number.isNaN(n) ? null : n;
}

export { DEFAULT_PRICES, as_rows };

/**
 * Runtime pricing layer for the AI Council.
 *
 * TypeScript twin of `src/scripts/ai_council/pricing.py` (ADR-096 —
 * Python→TS migration, Phase 8 / Wave 8g; ported as a prerequisite of
 * `update_prices.ts`). Mirrors the Python public surface used by the
 * caller: `PRICES_FILE`, `load_prices`, `is_stale`, `_render_markdown`,
 * plus `bootstrap_from_defaults` / `last_monday_utc` for completeness.
 *
 * Reads `agents/runtime/.agent-prices.md`, parses YAML frontmatter + the
 * Markdown table. No behaviour changes — latent Python quirks replicated,
 * including the byte-identical `{x:>6.2f}` row formatting.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PRICES, LAST_UPDATED, as_rows, priceKey } from './_default_prices.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/ai_council/pricing.py → parents[3] == repo root.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const PRICES_FILE = path.join(REPO_ROOT, 'agents', 'runtime', '.agent-prices.md');

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

export function lookup(table: PriceTable, provider: string, model: string): Price | null {
    return table.prices.get(priceKey(provider, model)) ?? null;
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

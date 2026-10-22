/**
 * A price row is evidence with a date, and it expires.
 *
 * `internal/bench/pricing.yaml` priced a `claude-haiku-5-5` leg with a row sourced
 * 2026-05-14 for a former Haiku generation at 2.5x the served model's rate, and the
 * cost verdict read it without complaint. A row now refuses to price when it is
 * older than PRICE_MAX_AGE_DAYS, when it names no source model (nothing vouches for
 * its generation), when its source model is an older generation than the served
 * one, or when it belongs to another model family. A refusal is a reason string,
 * never a zero price.
 */
import { load as yamlLoad } from 'js-yaml';

export const PRICE_MAX_AGE_DAYS = 120;

const FAMILIES = ['haiku', 'sonnet', 'opus', 'fable', 'mythos'] as const;

/** USD per million tokens. */
export interface Rates {
    input: number;
    output: number;
    cache_write: number;
    cache_read: number;
}

export interface PriceRow extends Rates {
    /** Lookup key: a family (`haiku`) or a full model id (`claude-haiku-5-5`). */
    tier: string;
    /** ISO date the rates were read from `source`. */
    sourced_on: string;
    source?: string;
    /** The model whose published rates these are. */
    model?: string;
}

function familyOf(id: string): string | null {
    const m = id.toLowerCase();
    return FAMILIES.find((f) => m.includes(f)) ?? null;
}

/** `claude-haiku-5-5` → 5.5, `claude-fable-5` → 5; a trailing 8-digit date is not a minor. */
export function modelGeneration(id: string): number | null {
    const m = id.toLowerCase().match(/(?:haiku|sonnet|opus|fable|mythos)-(\d{1,2})(?:-(\d{1,2}))?(?![0-9])/);
    if (!m) return null;
    return Number(m[1]) + (m[2] === undefined ? 0 : Number(m[2]) / 10);
}

const DAY_MS = 86_400_000;

export function priceRefusal(row: PriceRow, servedModel: string, asOf: Date): string | null {
    const sourced = /^\d{4}-\d{2}-\d{2}$/.test(row.sourced_on) ? Date.parse(`${row.sourced_on}T00:00:00Z`) : Number.NaN;
    if (Number.isNaN(sourced)) return `price row ${row.tier} carries no readable sourced_on date`;
    const ageDays = Math.floor((asOf.getTime() - sourced) / DAY_MS);
    if (ageDays > PRICE_MAX_AGE_DAYS) {
        return `price row ${row.tier} is ${ageDays} days old (sourced ${row.sourced_on}), beyond the ${PRICE_MAX_AGE_DAYS}-day bound`;
    }
    const servedFamily = familyOf(servedModel);
    if (servedFamily === null || familyOf(row.model ?? row.tier) !== servedFamily) {
        return `price row ${row.tier} is not of the family of served model ${servedModel}`;
    }
    if (!row.model) return `price row ${row.tier} names no source model, so nothing vouches for its generation`;
    const rowGen = modelGeneration(row.model);
    const servedGen = modelGeneration(servedModel);
    if (rowGen === null || servedGen === null) return `cannot read the generation of ${row.model} or ${servedModel}`;
    if (servedGen > rowGen) {
        return `price row ${row.tier} is sourced for generation ${rowGen} (${row.model}); served model ${servedModel} is generation ${servedGen}`;
    }
    return null;
}

/** The served model's own row first, then its family's; the first refusal is reported. */
export function selectPrice(rows: readonly PriceRow[], servedModel: string, asOf: Date): { price: Rates; row: PriceRow } | { refusal: string } {
    const id = servedModel.toLowerCase();
    const family = familyOf(id);
    const candidates = [...rows.filter((r) => r.tier.toLowerCase() === id), ...rows.filter((r) => family !== null && r.tier.toLowerCase() === family)];
    if (candidates.length === 0) return { refusal: `no price row for served model ${servedModel}` };
    let first: string | null = null;
    for (const row of candidates) {
        const why = priceRefusal(row, servedModel, asOf);
        if (why === null) {
            return { price: { input: row.input, output: row.output, cache_write: row.cache_write, cache_read: row.cache_read }, row };
        }
        first ??= why;
    }
    return { refusal: first! };
}

function isoDate(v: unknown): string {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return typeof v === 'string' ? v : '';
}

/** Rows of a `pricing.yaml` document; a row without a tier is skipped. */
export function parsePriceRows(yamlText: string): PriceRow[] {
    const doc = yamlLoad(yamlText) as { models?: unknown } | null;
    const models = Array.isArray(doc?.models) ? (doc.models as Record<string, unknown>[]) : [];
    const rows: PriceRow[] = [];
    for (const m of models) {
        if (!m || typeof m['tier'] !== 'string') continue;
        rows.push({
            tier: m['tier'],
            ...(typeof m['model'] === 'string' ? { model: m['model'] } : {}),
            sourced_on: isoDate(m['sourced_on']),
            ...(typeof m['source'] === 'string' ? { source: m['source'] } : {}),
            input: Number(m['input']),
            output: Number(m['output']),
            cache_write: Number(m['cache_write']),
            cache_read: Number(m['cache_read']),
        });
    }
    return rows;
}

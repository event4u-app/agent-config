/**
 * The pre-registered analysis in `internal/bench/headroom-17-PREREG.md`.
 *
 * Reads one paired report and prints the endpoints exactly as registered:
 * capability C vs B, paired by (task, seed), one-sided exact sign test on the
 * discordant pairs, α = 0.05; a budget stop or any other errored run counts as
 * a FAIL (the stats module drops errored pairs instead, which is why this is a
 * separate reader); per cluster; arm C's false-positive rate; priced cost per arm.
 *
 * Kept apart from `bench_ab_v2_stats` on purpose: adding the 1.7 comparisons to
 * its table would change what a stored evidence bundle re-scores to.
 *
 *   ./scripts-run src/scripts/bench_headroom_17_report <report.json> [--json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { cost_usd, type TierRates } from './_lib/bench_ab_activation.js';
import { load_pricing } from './_lib/bench_cost.js';
import { PRICING_PATH, cost_by_arm, price_row_for } from './bench_ab_v2_stats.js';

type Dict = Record<string, unknown>;

export const HOLDOUT = new Set(['hdhB-boundary-01', 'hdhI-invalidation-01', 'hdhS-sentinel-01']);
export const FP_CEILING = 0.25;
export const ALPHA = 0.05;

function binom(n: number, k: number): number {
    let r = 1;
    for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
    return r;
}

/** One-sided exact sign test: P(X ≥ wins) for X ~ Bin(wins + losses, 1/2). */
export function sign_test_p(wins: number, losses: number): number {
    const n = wins + losses;
    if (n === 0) return 1;
    let p = 0;
    for (let k = wins; k <= n; k += 1) p += binom(n, k);
    return p / 2 ** n;
}

/** Registered pass: capability landed and the run did not error (budget stop = fail). */
export function passed(run: Dict): boolean {
    return Boolean(run['capability_pass']) && !run['errored'];
}

export interface PairedResult {
    pairs: number;
    t_pass: number;
    b_pass: number;
    t_only: number;
    b_only: number;
    p: number;
}

export function paired(records: Dict[], arm_t: string, arm_b: string, keep: (id: string) => boolean = () => true): PairedResult {
    const out: PairedResult = { pairs: 0, t_pass: 0, b_pass: 0, t_only: 0, b_only: 0, p: 1 };
    for (const rec of records) {
        const id = String(rec['id']);
        if (!keep(id)) continue;
        const arms = (rec['arms'] ?? {}) as Record<string, Dict[]>;
        const t = arms[arm_t] ?? [];
        const b = arms[arm_b] ?? [];
        for (let i = 0; i < Math.min(t.length, b.length); i += 1) {
            const tp = passed(t[i] as Dict);
            const bp = passed(b[i] as Dict);
            out.pairs += 1;
            out.t_pass += tp ? 1 : 0;
            out.b_pass += bp ? 1 : 0;
            if (tp && !bp) out.t_only += 1;
            if (bp && !tp) out.b_only += 1;
        }
    }
    out.p = sign_test_p(out.t_only, out.b_only);
    return out;
}

export function c_false_positive_rate(records: Dict[]): { with_tests: number; fp: number; rate: number | null } {
    let with_tests = 0;
    let fp = 0;
    for (const rec of records) {
        for (const run of ((rec['arms'] ?? {}) as Record<string, Dict[]>)['h17-c'] ?? []) {
            const o = (run['orchestration'] ?? {}) as Dict;
            if (o['tests_fp'] === null || o['tests_fp'] === undefined) continue;
            with_tests += 1;
            fp += o['tests_fp'] === true ? 1 : 0;
        }
    }
    return { with_tests, fp, rate: with_tests === 0 ? null : fp / with_tests };
}

/** Nearest-rank percentile; null on an empty sample. */
export function percentile(values: number[], q: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] as number;
}

/**
 * Priced cost per run, p50 and p95 per arm. Unlike `cost_by_arm`, an errored run
 * is kept: the registered endpoint is what a run costs, and a budget stop spent
 * its budget.
 */
export function cost_percentiles(records: Dict[], arms: string[], rates: TierRates): Dict {
    const out: Dict = {};
    for (const arm of arms) {
        const costs: number[] = [];
        let errored = 0;
        for (const rec of records) {
            for (const run of ((rec['arms'] ?? {}) as Record<string, Dict[]>)[arm] ?? []) {
                costs.push(cost_usd((run['tokens_breakdown'] ?? {}) as never, rates));
                errored += run['errored'] ? 1 : 0;
            }
        }
        out[arm] = { n: costs.length, p50_usd: percentile(costs, 0.5), p95_usd: percentile(costs, 0.95), errored };
    }
    return out;
}

/** D4 net value of a treatment against B, per run: p_catch·D − C_extra − r_FP·C_FP. */
export function net_value(i: { p_catch: number; r_fp: number; p50_a: number; p50_b: number; p50_t: number }): {
    D: number;
    C_FP: number;
    C_extra: number;
    net_usd_per_run: number;
} {
    const D = 10 * i.p50_a;
    const C_FP = i.p50_a;
    const C_extra = i.p50_t - i.p50_b;
    return { D, C_FP, C_extra, net_usd_per_run: i.p_catch * D - C_extra - i.r_fp * C_FP };
}

export function analyse_17(payload: Dict, pricingPath: string = PRICING_PATH): Dict {
    const records = (payload['records'] ?? []) as Dict[];
    const arms = ((payload['arms'] ?? []) as string[]).filter((a) => a.startsWith('h17-'));
    const primary = paired(records, 'h17-c', 'h17-b');
    const fp = c_false_positive_rate(records);
    const [rates] = load_pricing(pricingPath);
    const model = (payload['model'] as string | null) ?? null;
    const row = model ? price_row_for(model, rates) : { tier: null, priced_by: null };
    const tierRates = row.priced_by !== null && row.tier ? (rates[row.tier] as TierRates) : null;
    const per_run = tierRates ? cost_percentiles(records, arms, tierRates) : null;
    const p50 = (arm: string): number | null => ((per_run?.[arm] as Dict | undefined)?.['p50_usd'] as number | null) ?? null;
    const [pa, pb, pc] = [p50('h17-a'), p50('h17-b'), p50('h17-c')];
    const net =
        pa !== null && pb !== null && pc !== null && fp.rate !== null && primary.pairs > 0
            ? net_value({ p_catch: primary.t_only / primary.pairs, r_fp: fp.rate, p50_a: pa, p50_b: pb, p50_t: pc })
            : null;
    return {
        report: payload['stamp'] ?? null,
        model: payload['model'] ?? null,
        spend_usd: payload['sweep_spend_usd'] ?? null,
        aborted: payload['aborted'] ?? null,
        primary_c_vs_b: { ...primary, significant: primary.p < ALPHA },
        c_vs_b_headroom: paired(records, 'h17-c', 'h17-b', (id) => !HOLDOUT.has(id)),
        c_vs_b_holdout: paired(records, 'h17-c', 'h17-b', (id) => HOLDOUT.has(id)),
        descriptive_b_vs_a: paired(records, 'h17-b', 'h17-a'),
        descriptive_c_vs_a: paired(records, 'h17-c', 'h17-a'),
        c_false_positives: { ...fp, ceiling: FP_CEILING, holds: fp.rate === null ? null : fp.rate <= FP_CEILING },
        cost: cost_by_arm(records, arms, model, pricingPath),
        cost_per_run: per_run,
        net_value_c_vs_b: net,
    };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const file = argv.find((a) => !a.startsWith('--'));
    if (!file) {
        process.stderr.write('usage: bench_headroom_17_report <report.json> [--json]\n');
        return 2;
    }
    const payload = JSON.parse(fs.readFileSync(path.resolve(file), 'utf-8')) as Dict;
    process.stdout.write(`${JSON.stringify(analyse_17(payload), null, 2)}\n`);
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main());
}

/**
 * How many pairs a paired ab-v2 sweep needs before it is paid for.
 *
 * Uses the same one-sided exact sign test `paired_verdict` decides with, so the
 * plan and the verdict answer to one bar. Two inputs drive it: how often a pair
 * is discordant at all (the noise the A/A control measured), and what share of
 * discordant pairs is expected to favour the treatment. A share at or below one
 * half has no sample size — the test cannot clear it however long the sweep runs.
 *
 *   ./scripts-run src/scripts/bench_ab_power --aa 2/12 --share 0.9
 *   ./scripts-run src/scripts/bench_ab_power --discordance 0.17 --share 1 --power 0.8
 */
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';

import { ALPHA, exactOneSidedP } from './_lib/paired_verdict.js';

export interface PowerInput {
    /** Probability that a pair is discordant at all. */
    discordance: number;
    /** Share of discordant pairs expected to favour the treatment. */
    share: number;
    alpha?: number;
    /** Target probability of reaching significance. */
    power?: number;
    /** Largest sweep the plan will consider, per arm. */
    maxPairs?: number;
}

export interface PowerPlan {
    reachable: boolean;
    alpha: number;
    power: number;
    discordant_required: number | null;
    pairs_required: number | null;
    power_at_required: number | null;
    power_one_fewer: number | null;
    reason: string;
}

/** `discordant/pairs` as published for an A/A control, e.g. `2/12`. */
export function parseAa(text: string): number {
    const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(text);
    if (!m) throw new Error(`--aa expects <discordant>/<pairs>, got ${JSON.stringify(text)}`);
    const d = Number(m[1]);
    const n = Number(m[2]);
    if (n === 0 || d > n) throw new Error(`--aa ${text}: discordant must be between 0 and pairs`);
    return d / n;
}

function logFactorials(n: number): number[] {
    const out = [0];
    for (let i = 1; i <= n; i += 1) out.push((out[i - 1] as number) + Math.log(i));
    return out;
}

function binomPmf(lf: number[], n: number, k: number, p: number): number {
    if (p <= 0) return k === 0 ? 1 : 0;
    if (p >= 1) return k === n ? 1 : 0;
    const logC = (lf[n] as number) - (lf[k] as number) - (lf[n - k] as number);
    return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/**
 * Smallest win count that clears `alpha` on `d` discordant pairs, or null.
 * The same tail `exactOneSidedP` sums, accumulated in log space from the top
 * so a large `d` stays linear; the test pins agreement with `exactOneSidedP`.
 */
export function criticalWins(d: number, alpha: number, lf: number[] = logFactorials(d)): number | null {
    let tail = 0;
    let k: number | null = null;
    for (let w = d; w >= 0; w -= 1) {
        tail += binomPmf(lf, d, w, 0.5);
        if (tail > alpha * (1 + 1e-12)) break;
        k = w;
    }
    return k;
}

/** The exact reference, for small `d` only. */
export function criticalWinsExact(d: number, alpha: number): number | null {
    for (let w = 0; w <= d; w += 1) if (exactOneSidedP(w, d) <= alpha) return w;
    return null;
}

export function planPower(input: PowerInput): PowerPlan {
    const alpha = input.alpha ?? ALPHA;
    const target = input.power ?? 0.8;
    const max = input.maxPairs ?? 2000;
    const base = { alpha, power: target };
    const none = { discordant_required: null, pairs_required: null, power_at_required: null, power_one_fewer: null };
    if (!(input.discordance >= 0 && input.discordance <= 1)) {
        return { ...base, ...none, reachable: false, reason: 'discordance must be in [0, 1]' };
    }
    if (input.discordance === 0) {
        return { ...base, ...none, reachable: false, reason: 'a discordance of 0 means no pair ever differs; no sample size can show a direction' };
    }
    if (!(input.share >= 0 && input.share <= 1)) {
        return { ...base, ...none, reachable: false, reason: 'share must be in [0, 1]' };
    }
    if (input.share <= 0.5) {
        return { ...base, ...none, reachable: false, reason: 'a share at or below one half cannot clear a one-sided sign test at any size' };
    }
    const lf = logFactorials(max);
    // Probability of significance given d discordant pairs.
    const cond: number[] = [];
    for (let d = 0; d <= max; d += 1) {
        const k = criticalWins(d, alpha, lf);
        let p = 0;
        if (k !== null) for (let w = k; w <= d; w += 1) p += binomPmf(lf, d, w, input.share);
        cond.push(Math.min(1, p));
    }
    const discordant = cond.findIndex((p) => p >= target);
    const powerAt = (n: number): number => {
        let p = 0;
        for (let d = 0; d <= n; d += 1) p += binomPmf(lf, n, d, input.discordance) * (cond[d] as number);
        return Math.min(1, p);
    };
    let pairs: number | null = null;
    for (let n = 1; n <= max; n += 1) {
        if (powerAt(n) >= target) {
            pairs = n;
            break;
        }
    }
    if (discordant < 0 || pairs === null) {
        return { ...base, ...none, reachable: false, reason: `target power not reached within ${max} pairs` };
    }
    return {
        ...base,
        reachable: true,
        discordant_required: discordant,
        pairs_required: pairs,
        power_at_required: powerAt(pairs),
        power_one_fewer: pairs > 1 ? powerAt(pairs - 1) : 0,
        reason: 'exact one-sided sign test, same bar as paired_verdict',
    };
}

function flag(argv: readonly string[], name: string): string | null {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const aa = flag(argv, 'aa');
    const disc = flag(argv, 'discordance');
    const share = flag(argv, 'share');
    if ((aa === null) === (disc === null) || share === null) {
        process.stderr.write('usage: bench_ab_power (--aa <discordant>/<pairs> | --discordance <rate>) --share <0..1> [--power 0.8] [--alpha 0.05] [--max-pairs 2000]\n');
        return 2;
    }
    let discordance: number;
    try {
        discordance = aa !== null ? parseAa(aa) : Number(disc);
    } catch (err) {
        process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    const num = (name: string): number | undefined => {
        const v = flag(argv, name);
        return v === null ? undefined : Number(v);
    };
    const plan = planPower({
        discordance,
        share: Number(share),
        power: num('power'),
        alpha: num('alpha'),
        maxPairs: num('max-pairs'),
    });
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ discordance, ...plan }, null, 2)}\n`);
        return plan.reachable ? 0 : 1;
    }
    process.stdout.write(`discordance: ${discordance.toFixed(3)} · share: ${share} · alpha: ${plan.alpha} · target power: ${plan.power}\n`);
    if (!plan.reachable) {
        process.stdout.write(`not reachable: ${plan.reason}\n`);
        return 1;
    }
    process.stdout.write(`discordant pairs required: ${plan.discordant_required}\n`);
    process.stdout.write(`pairs per arm required: ${plan.pairs_required} (power ${(plan.power_at_required as number).toFixed(3)})\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}

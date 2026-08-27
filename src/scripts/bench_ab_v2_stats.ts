#!/usr/bin/env node
/**
 * bench:ab v2 — paired statistics (Phase 3).
 *
 * Ported from the retired Python `src/scripts/bench_ab_v2_stats.py` (ADR-200 Python→TS
 * migration). Mirrors the CLI contract EXACTLY: positional `report` arg, the
 * `--json` / `--markdown PATH` flags, exit codes (0 ok / 1 no report found), and
 * byte-identical stdout/stderr.
 *
 * The port itself introduced no behaviour change. Since then ONE additive change
 * has landed, named here so the paragraph above stops reading as a standing
 * promise it no longer keeps: S0.3 **delta #6** adds a `cost` block to the
 * analysis JSON and a `Table 3b` to the rendered markdown (see `cost_by_arm`).
 * Both are additions — every pre-existing key and table is untouched, and
 * consumers that read named keys (`render_benchmark_composite`,
 * `render_benchmark_md`, `bench_ab_diff`) are unaffected.
 *
 * Reads a v2 paired report (bench_ab_v2_run.py output) and computes, for each
 * arm comparison, paired significance + effect size on:
 *
 * - capability axis (binary)  -> McNemar exact test + Cohen's h
 * - discipline axis ([0,1])    -> Wilcoxon signed-rank + rank-biserial
 * - status buckets             -> error/undisciplined-rate per arm
 *
 * Pairing: each (task, seed) is one pair, seen under every arm. Pooled across all
 * task×seed pairs. Dependency-free (stdlib math only) so the benchmark stays
 * portable. Errored runs are EXCLUDED from a pair (per-axis) so a quota trip is
 * never read as a content/discipline fail.
 *
 * Float parity: `math.erf` is ported from CPython's `m_erf` series and `math.comb`
 * from an exact BigInt computation, so every `round(p, 4)` / `round(h, 4)` output
 * is byte-stable — downstream consumers and checksum gates pin these bytes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// `mcnemar_exact` and `cohens_h` live in `_lib/paired_stats.ts` and are
// re-exported here, so every existing importer of this module is unchanged.
// Extracted rather than left in place: this file sits above the 1500-line
// ceiling `check_source_size_budget` charges, so lines added to it are paid
// back by extraction rather than by raising a baseline.
import { cohens_h, mcnemar_exact, _pyRound, _pyRoundNoArg, wilcoxon } from './_lib/paired_stats.js';

export { cohens_h, mcnemar_exact, wilcoxon };

import { cost_usd, tier_for_model, type TierRates } from './_lib/bench_ab_activation.js';
import { load_pricing } from './_lib/bench_cost.js';

const _HERE = fileURLToPath(import.meta.url);

// bench_ab_v2_stats.ts → parents[2] is repo root (script lives in src/scripts/).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab-v2');
const PRICING_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'pricing.yaml');

import { addPair, newPairedSample, searchClaimSection, searchClaimVerdict } from './_lib/bench_ab_search_adherence.js';
import {
    evaluateSizeClaim,
    renderSizeClaimSection,
    type PairedContinuous,
    type PairedRate,
    type SizeClaimVerdict,
} from './_lib/bench_ab_size_claim.js';

type Dict = Record<string, unknown>;

const COMPARISONS: Array<[string, string, string]> = [
    ['package', 'vanilla', 'package lift'],
    ['package-rdp', 'package', 'RDP lift'],
    ['package', 'placebo', 'attribution (content vs length)'],
    // ADR-106: recursion's NOVEL lift over rules-only (D₂ − D₁). The analyse()
    // loop is arm-guarded (`arms.includes(t) && arms.includes(b)`), so this row
    // renders ONLY when a `package-recursive` arm is present — existing runs
    // (no such arm) are byte-identical, golden parity preserved.
    ['package-recursive', 'package', 'recursion novel lift (D₂ − D₁)'],
    // Cost-factor sweep (2026-07): trimmed rule-subset arms vs vanilla — how
    // much of the weak-host lift survives at a fraction of the loaded-context
    // cost. Arm-guarded like the rows above: rendered only when present.
    ['rules-kernel-dc', 'vanilla', 'kernel+downstream rules lift'],
    ['rules-balanced', 'vanilla', 'balanced-profile rules lift'],
    ['package', 'rules-kernel-dc', 'full package residual over kernel+downstream'],
    // Phase-3 T1: the size claim is `package-ladder` vs `package`, and it is a
    // metric PAIR — see `size_claim_verdict`. Arm-guarded like every row above,
    // so a run without the ladder arm renders exactly as before.
    ['package-ladder', 'package', 'ladder size claim (T1/T2 pair)'],
];

// ── CPython math.erf / math.comb ports ────────────────────────────────────
//
// The erf/normal-CDF port and `wilcoxon` live in `_lib/paired_stats.ts`,
// re-exported above. Same reason as the two functions beside them: this file
// is over the 1500-line ceiling, so additions are paid back by extraction.


/** Wrap a `round(...)`/float result so it renders `1.0` not `1` (Python float). */
function PF(x: number): PyFloat {
    return new PyFloat(x);
}

/**
 * Did the JSON source literal for `key` carry a decimal point / exponent?
 * Mirrors `json.loads` keeping `1.0` a float vs `1` an int — `JSON.parse`
 * collapses both to the JS number `1`, losing the distinction.
 */
function _jsonFieldIsFloat(raw: string, key: string): boolean {
    const re = new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)`);
    const m = re.exec(raw);
    if (!m) {
        return false;
    }
    const lit = m[1] as string;
    return lit.includes('.') || lit.includes('e') || lit.includes('E');
}

interface Pair {
    id: unknown;
    seed: unknown;
    rt: Dict;
    rb: Dict;
}

function* _pairs(records: Dict[], arm_t: string, arm_b: string): Generator<Pair> {
    // Yield (task, seed, run_t, run_b) for each paired (task,seed).
    for (const rec of records) {
        const arms = _dictOr(rec['arms']);
        const runs_t = Array.isArray(arms[arm_t]) ? (arms[arm_t] as Dict[]) : [];
        const runs_b = Array.isArray(arms[arm_b]) ? (arms[arm_b] as Dict[]) : [];
        const by_seed_b = new Map<unknown, Dict>();
        for (const r of runs_b) {
            by_seed_b.set(r['seed'], r);
        }
        for (const r_t of runs_t) {
            const r_b = by_seed_b.get(r_t['seed']);
            if (r_b !== undefined) {
                yield { id: rec['id'], seed: r_t['seed'], rt: r_t, rb: r_b };
            }
        }
    }
}

export function compare(records: Dict[], arm_t: string, arm_b: string): Dict {
    // Capability (binary, McNemar) — exclude pairs where either side errored.
    let b = 0;
    let c = 0;
    let both1 = 0;
    let both0 = 0;
    let cap_t = 0;
    let cap_b = 0;
    let capn = 0;
    // Discipline (continuous, Wilcoxon)
    const diffs: number[] = [];
    let dis_t_sum = 0.0;
    let dis_b_sum = 0.0;
    let disn = 0.0;
    // Delta #5 — attrition. A dropped pair is not missing-at-random: a budget
    // cap or a timeout fires preferentially on the arm doing MORE work, so
    // silently excluding those pairs biases the surviving sample toward the
    // baseline. Report which side died and in which status bucket, so a reader
    // can see whether the drops are balanced before trusting the estimate.
    let pairs_seen = 0;
    let dropped_treatment_only = 0;
    let dropped_baseline_only = 0;
    let dropped_both = 0;
    const dropped_buckets: Record<string, number> = {};
    // Delta #11 — the metric PAIR (T1 size, T2 complexity) and the T4 safety
    // disqualifier. Each is collected pair-wise and independently: a pair that
    // carries added lines but no complexity contributes to T1's sample and not
    // to T2's, which is what keeps an absent endpoint reported as absent rather
    // than as a value.
    const size_t: number[] = [];
    const size_b: number[] = [];
    const size_diffs: number[] = [];
    const cx_t: number[] = [];
    const cx_b: number[] = [];
    const cx_diffs: number[] = [];
    let saf_n = 0;
    let saf_t = 0;
    let saf_bl = 0;
    let saf_disc_t = 0;
    let saf_disc_b = 0;
    const sea = newPairedSample(); // T5 — continuous in [0,1], collects like complexity.
    for (const { rt, rb } of _pairs(records, arm_t, arm_b)) {
        pairs_seen += 1;
        const t_err = _pyTruthy(rt['errored']);
        const b_err = _pyTruthy(rb['errored']);
        if (t_err || b_err) {
            if (t_err && b_err) {
                dropped_both += 1;
            } else if (t_err) {
                dropped_treatment_only += 1;
            } else {
                dropped_baseline_only += 1;
            }
            for (const r of [t_err ? rt : null, b_err ? rb : null]) {
                if (r === null) {
                    continue;
                }
                const bucket = _strOr(_dictOr(r['metrics'])['status_bucket'], 'unknown');
                dropped_buckets[bucket] = (dropped_buckets[bucket] ?? 0) + 1;
            }
        }
        if (!t_err && !b_err) {
            const t = _pyTruthy(rt['capability_pass']);
            const bb = _pyTruthy(rb['capability_pass']);
            capn += 1;
            cap_t += t ? 1 : 0;
            cap_b += bb ? 1 : 0;
            if (t && !bb) {
                b += 1;
            } else if (bb && !t) {
                c += 1;
            } else if (t && bb) {
                both1 += 1;
            } else {
                both0 += 1;
            }
            const dt = _pyFloat(rt['discipline_score']);
            const db = _pyFloat(rb['discipline_score']);
            diffs.push(dt - db);
            dis_t_sum += dt;
            dis_b_sum += db;
            disn += 1;

            const mt = _dictOr(rt['metrics']);
            const mb = _dictOr(rb['metrics']);

            const at = _numOrNull(mt['added_lines']);
            const ab = _numOrNull(mb['added_lines']);
            if (at !== null && ab !== null) {
                size_t.push(at);
                size_b.push(ab);
                size_diffs.push(at - ab);
            }

            const ct = _numOrNull(mt['median_cognitive_complexity']);
            const cb = _numOrNull(mb['median_cognitive_complexity']);
            if (ct !== null && cb !== null) {
                cx_t.push(ct);
                cx_b.push(cb);
                cx_diffs.push(ct - cb);
            }

            const st = _boolOrNull(mt['safety_tier_pass']);
            const sb2 = _boolOrNull(mb['safety_tier_pass']);
            if (st !== null && sb2 !== null) {
                saf_n += 1;
                saf_t += st ? 1 : 0;
                saf_bl += sb2 ? 1 : 0;
                if (st && !sb2) saf_disc_t += 1;
                else if (sb2 && !st) saf_disc_b += 1;
            }
            addPair(sea, mt['search_adherence'], mb['search_adherence']);
        }
    }
    void both1;
    void both0;
    const p1 = capn ? cap_t / capn : 0;
    const p2 = capn ? cap_b / capn : 0;
    const wil = wilcoxon(diffs);
    return {
        arm_treatment: arm_t,
        arm_baseline: arm_b,
        n_pairs: capn,
        capability: {
            rate_treatment: PF(_pyRound(p1, 4)),
            rate_baseline: PF(_pyRound(p2, 4)),
            discordant_b_only_treatment: b,
            discordant_c_only_baseline: c,
            mcnemar_p: PF(_pyRound(mcnemar_exact(b, c), 4)),
            cohens_h: PF(_pyRound(cohens_h(p1, p2), 4)),
        },
        discipline: {
            // round(...) → float; the `else 0` fallback is an int (disn == 0).
            mean_treatment: disn ? PF(_pyRound(dis_t_sum / disn, 4)) : 0,
            mean_baseline: disn ? PF(_pyRound(dis_b_sum / disn, 4)) : 0,
            mean_delta: disn ? PF(_pyRound((dis_t_sum - dis_b_sum) / disn, 4)) : 0,
            wilcoxon_p: PF(wil.p),
            rank_biserial: PF(wil.rank_biserial),
            n_nonzero: wil.n,
        },
        attrition: {
            pairs_seen,
            pairs_analysed: capn,
            pairs_dropped: pairs_seen - capn,
            dropped_treatment_only,
            dropped_baseline_only,
            dropped_both,
            // Positive = the treatment arm died more often than the baseline,
            // i.e. the surviving sample is biased toward the baseline.
            drop_asymmetry: dropped_treatment_only - dropped_baseline_only,
            dropped_by_status_bucket: dropped_buckets,
        },
        size: _paired_median_block(size_t, size_b, size_diffs),
        complexity: _paired_median_block(cx_t, cx_b, cx_diffs),
        safety: _paired_rate_block(saf_n, saf_t, saf_bl, saf_disc_t, saf_disc_b),
        search: _paired_median_block(sea.t, sea.b, sea.diffs),
    };
}

/**
 * A paired continuous endpoint (added lines, cognitive complexity).
 *
 * `measured: false` when no analysed pair carried the metric on BOTH sides. It
 * is not a zero and not a neutral value: `size_claim_verdict` reads it as
 * "unmeasured" and refuses to report a win, which is the whole point of shipping
 * the endpoint rather than defaulting it.
 */
function _paired_median_block(t: number[], b: number[], diffs: number[]): Dict {
    if (diffs.length === 0) {
        return { measured: false, n_pairs: 0 };
    }
    const mt = _median(t);
    const mb = _median(b);
    const wil = wilcoxon(diffs);
    // Percent change of the medians. A zero baseline has no percent change —
    // report null rather than Infinity, which would render as a win.
    const pct = mb === 0 ? null : PF(_pyRound(((mt - mb) / Math.abs(mb)) * 100, 4));
    // Direction counts, ADDITIVE (Phase-3 PREREG amendment v2, 2026-08-26).
    // The significance half of the size verdict now reads these rather than
    // `wilcoxon_p`; every pre-existing key is untouched, so a consumer reading
    // named keys is unaffected. Tie epsilon matches `wilcoxon`'s own 1e-9 zero
    // drop, so "non-tied" means the same thing to both tests — two definitions
    // of a tie in one report is how the numbers start disagreeing.
    const wins = diffs.filter((d) => d < -1e-9).length;
    const losses = diffs.filter((d) => d > 1e-9).length;
    return {
        measured: true,
        n_pairs: diffs.length,
        median_treatment: PF(_pyRound(mt, 4)),
        median_baseline: PF(_pyRound(mb, 4)),
        median_delta: PF(_pyRound(mt - mb, 4)),
        median_delta_pct: pct,
        wilcoxon_p: PF(wil.p),
        rank_biserial: PF(wil.rank_biserial),
        n_nonzero: wil.n,
        // "Win" is DIRECTION-OF-INTEREST, not sign: for added lines and for
        // cognitive complexity a NEGATIVE delta is the improvement. Naming them
        // wins/losses here rather than positive/negative keeps the verdict from
        // having to know which endpoint it is looking at.
        direction_wins: wins,
        direction_losses: losses,
        direction_ties: diffs.length - wins - losses,
    };
}

/** A paired binary endpoint (the safety tier). Same `measured` contract. */
function _paired_rate_block(n: number, t: number, b: number, disc_t: number, disc_b: number): Dict {
    if (n === 0) {
        return { measured: false, n_pairs: 0 };
    }
    const p1 = t / n;
    const p2 = b / n;
    return {
        measured: true,
        n_pairs: n,
        rate_treatment: PF(_pyRound(p1, 4)),
        rate_baseline: PF(_pyRound(p2, 4)),
        discordant_b_only_treatment: disc_t,
        discordant_c_only_baseline: disc_b,
        mcnemar_p: PF(_pyRound(mcnemar_exact(disc_t, disc_b), 4)),
    };
}

/** Median over an already-collected sample; mean of the two middles when even. */
function _median(values: readonly number[]): number {
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    if (s.length % 2 === 1) return s[mid] as number;
    return ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

function _numOrNull(v: unknown): number | null {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    return null;
}

function _boolOrNull(v: unknown): boolean | null {
    if (typeof v === 'boolean') return v;
    return null;
}

/**
 * Recursion's NOVEL discipline lift over rules-only (ADR-106).
 *
 * Compares the `package-recursive` arm (D₂ = rules + recursion) against
 * `package` (D₁ = rules only) via the existing pure `compare()`, so recursion's
 * marginal lift `D₂ − D₁` is a measured fact, never an assumed redundancy.
 *
 * ADDITIVE: does NOT touch the rendered COMPARISONS path — existing CLI output
 * (and its golden-parity tests) are unaffected. Returns `null` when no
 * `package-recursive` arm is present in the records, so a future renderer can
 * skip the block cleanly for non-recursion runs.
 *
 * NOTE (Phase 2b live-integration, NOT done here): wiring this into the rendered
 * stats output (a guarded COMPARISONS entry + a golden-parity fixture refresh)
 * and producing the `package-recursive` arm itself (a multi-call recursion loop
 * the single-`--print` runner does not yet support) require the live bench and
 * are deferred to the supervised Phase 3 session.
 */
export const RECURSIVE_ARM = 'package-recursive';
export const RECURSIVE_BASELINE_ARM = 'package';

export function recursiveNovelLift(records: Dict[]): Dict | null {
    const hasRecursion = records.some((rec) => {
        const runs = _dictOr(rec['arms'])[RECURSIVE_ARM];
        return Array.isArray(runs) && runs.length > 0;
    });
    if (!hasRecursion) return null;
    return {
        label: 'recursion novel lift (D₂ − D₁)',
        arms: [RECURSIVE_ARM, RECURSIVE_BASELINE_ARM],
        ...compare(records, RECURSIVE_ARM, RECURSIVE_BASELINE_ARM),
    };
}

export function mean_tokens_by_arm(records: Dict[], arms: string[]): Dict {
    // Mean total tokens per arm over non-errored runs (the cost axis, L10).
    // Truncated/errored runs are excluded — their token count is capped by the
    // budget, not representative of the work done.
    const out: Dict = {};
    for (const arm of arms) {
        const toks: number[] = [];
        for (const rec of records) {
            const armRuns = _dictOr(rec['arms'])[arm];
            for (const r of Array.isArray(armRuns) ? (armRuns as Dict[]) : []) {
                if (!_pyTruthy(r['errored'])) {
                    toks.push(_orZero(_dictOr(r['metrics'])['tokens']));
                }
            }
        }
        out[arm] = {
            n: toks.length,
            mean_tokens: toks.length ? _pyRoundNoArg(toks.reduce((s, x) => s + x, 0) / toks.length) : 0,
        };
    }
    return out;
}

// ── delta #6 — the cost sheet ───────────────────────────────────────────────
//
// Table 3 reports mean TOKENS, which is not a cost: the four usage buckets differ
// in price by up to 125×, so a run that is mostly cache-read and a run that is
// mostly output can share a token total and differ in dollars by two orders of
// magnitude. S0.3's own estimate carries a ~10× spread on the treatment arm for
// exactly this reason, and it names closing that spread as this delta.
//
// The inputs already exist and are reused rather than rebuilt: `tokens_breakdown`
// on every trial (delta #2), `cost_usd` which prices the buckets separately, and
// `tier_for_model` (both delta #4). What was missing was wiring them into the
// REPORT, so the cost axis was priceable per run and unpriced per arm.

/** Per-arm cost, priced bucket-by-bucket, plus the provenance of the prices. */
export function cost_by_arm(records: Dict[], arms: string[], model: string | null, pricingPath: string): Dict {
    const [rates, sourced_on] = load_pricing(pricingPath);
    const tier = model ? tier_for_model(model) : null;
    const tier_rates: TierRates | null = tier && rates[tier] ? (rates[tier] as TierRates) : null;

    const per_arm: Dict = {};
    for (const arm of arms) {
        let n = 0;
        let total = 0;
        const buckets = { input: 0, output: 0, cache_write: 0, cache_read: 0 };
        for (const rec of records) {
            const armRuns = _dictOr(rec['arms'])[arm];
            for (const r of Array.isArray(armRuns) ? (armRuns as Dict[]) : []) {
                // Same exclusion as the token axis: an errored or truncated run's
                // usage is capped by the budget, not representative of the work.
                if (_pyTruthy(r['errored'])) {
                    continue;
                }
                n += 1;
                const b = (r['tokens_breakdown'] ?? {}) as Record<string, unknown>;
                buckets.input += _orZero(b['input_tokens']);
                buckets.output += _orZero(b['output_tokens']);
                buckets.cache_write += _orZero(b['cache_creation_input_tokens']);
                buckets.cache_read += _orZero(b['cache_read_input_tokens']);
                if (tier_rates) {
                    total += cost_usd(b as never, tier_rates);
                }
            }
        }
        per_arm[arm] = {
            n,
            // `null` rather than 0 when the model is unpriceable: a zero would
            // read as "this arm was free", which is a different claim from "we
            // cannot price it". pricing.yaml's own contract says surface the gap.
            total_usd: tier_rates ? PF(_pyRound(total, 4)) : null,
            mean_usd: tier_rates && n ? PF(_pyRound(total / n, 4)) : null,
            tokens_by_bucket: buckets,
        };
    }

    return {
        tier: tier ?? 'unknown',
        priced: tier_rates !== null,
        pricing_sourced_on: sourced_on,
        per_arm,
    };
}

/**
 * Whole days between the price sourcing date and the report's own stamp.
 *
 * Measured against the STAMP, not against today: a report is a fixed artefact, so
 * re-rendering it must not change the number. Returns null when either date is
 * unreadable — an invented age would be worse than an absent one.
 */
export function pricing_age_days(sourced_on: string | null, stamp: string | null): number | null {
    if (!sourced_on || !stamp) {
        return null;
    }
    const src = Date.parse(sourced_on.slice(0, 10));
    // Report stamps are `YYYY-MM-DDTHH-MM-SSZ` — the time separators are dashes,
    // so only the date half is parseable without rewriting it.
    const rep = Date.parse(stamp.slice(0, 10));
    if (Number.isNaN(src) || Number.isNaN(rep)) {
        return null;
    }
    return Math.floor((rep - src) / 86_400_000);
}

export function bucket_rates(records: Dict[], arms: string[]): Dict {
    const out: Dict = {};
    for (const arm of arms) {
        const buckets: Record<string, number> = {};
        let total = 0;
        for (const rec of records) {
            const armRuns = _dictOr(rec['arms'])[arm];
            for (const r of Array.isArray(armRuns) ? (armRuns as Dict[]) : []) {
                total += 1;
                const bk = _strOr(_dictOr(r['metrics'])['status_bucket'], 'completed');
                buckets[bk] = (buckets[bk] ?? 0) + 1;
            }
        }
        out[arm] = {
            total,
            buckets,
            error_rate: total ? PF(_pyRound(1 - (buckets['completed'] ?? 0) / total, 4)) : 0,
        };
    }
    return out;
}

export function analyse(payload: Dict): Dict {
    const records = Array.isArray(payload['records']) ? (payload['records'] as Dict[]) : [];
    const arms = Array.isArray(payload['arms']) ? (payload['arms'] as string[]) : [];
    const comps: Dict[] = [];
    for (const [t, b, lbl] of COMPARISONS) {
        if (arms.includes(t) && arms.includes(b)) {
            // compare(...) | {"label": lbl} — label appended at the end.
            comps.push({ ...compare(records, t, b), label: lbl });
        }
    }
    return {
        stamp: payload['stamp'] ?? null,
        model: payload['model'] ?? null,
        seeds: payload['seeds'] ?? null,
        n_tasks: records.length,
        comparisons: comps,
        // One verdict per rendered comparison. Present even when every endpoint
        // is absent — an `INCONCLUSIVE` row naming the missing endpoint is the
        // reportable fact; omitting the block would read as "no size question
        // was asked", which is a different claim.
        size_claims: comps.map((c) => size_claim_verdict(c)),
        search_claims: comps.map((c) => searchClaimVerdict(c)), // separate on purpose — see the T5 lib
        status_buckets: bucket_rates(records, arms),
        mean_tokens: mean_tokens_by_arm(records, arms),
        cost: cost_by_arm(records, arms, payload['model'] ? String(payload['model']) : null, PRICING_PATH),
    };
}

// ── the size claim is a PAIR, and safety is a disqualifier ─────────────────
//
// The verdict itself lives in `_lib/bench_ab_size_claim.ts`: it is decision
// logic over already-computed blocks, not statistics, and keeping it there makes
// it a pure function with no dependency on this pipeline. What stays here is the
// adapter — the `Dict`-shaped report objects this module speaks are coerced into
// the typed input that module takes.

/** Coerce one `compare()` block into the typed paired-continuous input. */
function _toContinuous(block: Dict): PairedContinuous {
    return {
        measured: block['measured'] === true,
        n_pairs: _pyFloat(block['n_pairs']),
        median_delta_pct: block['median_delta_pct'] == null ? null : _pyFloat(block['median_delta_pct']),
        median_delta: _pyFloat(block['median_delta']),
        wilcoxon_p: _pyFloat(block['wilcoxon_p']),
        // Optional-absent rather than defaulted to 0: an older report carries
        // no direction counts, and zeroing them would read as "no trial went
        // either way", which is a measurement rather than a missing field.
        ...(block['direction_wins'] === undefined
            ? {}
            : {
                  direction_wins: _pyFloat(block['direction_wins']),
                  direction_losses: _pyFloat(block['direction_losses']),
              }),
    };
}

function _toRate(block: Dict): PairedRate {
    return {
        measured: block['measured'] === true,
        n_pairs: _pyFloat(block['n_pairs']),
        rate_treatment: _pyFloat(block['rate_treatment']),
        rate_baseline: _pyFloat(block['rate_baseline']),
        mcnemar_p: _pyFloat(block['mcnemar_p']),
    };
}

/** The Phase-3 size claim for one comparison. Contract: `evaluateSizeClaim`. */
export function size_claim_verdict(comparison: Dict): Dict {
    return evaluateSizeClaim({
        arm_treatment: comparison['arm_treatment'] == null ? null : String(comparison['arm_treatment']),
        arm_baseline: comparison['arm_baseline'] == null ? null : String(comparison['arm_baseline']),
        size: _toContinuous(_dictOr(comparison['size'])),
        complexity: _toContinuous(_dictOr(comparison['complexity'])),
        safety: _toRate(_dictOr(comparison['safety'])),
    }) as unknown as Dict;
}

function _size_claim_section(a: Dict): string[] {
    const claims = Array.isArray(a['size_claims']) ? (a['size_claims'] as unknown as SizeClaimVerdict[]) : [];
    return renderSizeClaimSection(claims);
}


export function gate_verdict(analysis: Dict): Dict {
    // L4 gate: PASS if ANY axis shows significant paired lift for package vs
    // vanilla (McNemar p<0.05 OR Wilcoxon p<0.05 OR a status-bucket reduction).
    const comparisons = Array.isArray(analysis['comparisons']) ? (analysis['comparisons'] as Dict[]) : [];
    const pkg = comparisons.find(
        (cc) => cc['arm_treatment'] === 'package' && cc['arm_baseline'] === 'vanilla',
    );
    if (!pkg) {
        return { verdict: 'INCONCLUSIVE', reason: 'no package-vs-vanilla comparison' };
    }
    const cap = _dictOr(pkg['capability']);
    const dis = _dictOr(pkg['discipline']);
    const cap_sig =
        _pyFloat(cap['mcnemar_p']) < 0.05 && _pyFloat(cap['rate_treatment']) > _pyFloat(cap['rate_baseline']);
    const dis_sig = _pyFloat(dis['wilcoxon_p']) < 0.05 && _pyFloat(dis['mean_delta']) > 0;
    const sb = _dictOr(analysis['status_buckets']);
    const bucket_better =
        _errorRate(sb['package']) < _errorRate(sb['vanilla']);
    const passed = cap_sig || dis_sig;
    return {
        verdict: passed ? 'PASS' : 'FALSIFIED-OR-INCONCLUSIVE',
        capability_significant: cap_sig,
        discipline_significant: dis_sig,
        status_bucket_better: bucket_better,
        // Goodhart guard, structural: this gate reads capability, discipline and
        // status buckets ONLY. Size never enters it, so no arm can be ranked
        // above another here by producing a smaller diff. The size question has
        // exactly one home — `size_claim_verdict` — and that function refuses a
        // win whenever the safety tier regressed or is unmeasured.
        size_considered: false,
        size_claim_owner: 'size_claim_verdict',
        note:
            'PASS = significant paired discipline/capability lift; ' +
            'FALSIFIED only if also trivial across seeds (inspect n_pairs).',
    };
}

/** `sb.get(arm, {}).get("error_rate", 1)`. */
function _errorRate(arm: unknown): number {
    const d = _dictOr(arm);
    return 'error_rate' in d ? _pyFloat(d['error_rate']) : 1;
}

export function to_markdown(analysis: Dict, payload: Dict): string {
    const a = analysis;
    const g = _dictOr(a['gate']);
    const L: string[] = [];
    L.push('# Discipline-Axis Wrapper-Lift Benchmark (v2)');
    L.push('');
    L.push(
        '> Generated by `bench_ab_v2_stats --markdown`. Do not edit. Source: ' +
            '`internal/bench/reports/ab-v2/`. Re-render with `task bench:ab:v2:diff`.',
    );
    L.push('');
    L.push('## Honesty labels (read first)');
    L.push('');
    L.push(
        `> 1. **Wrapper-lift on a fixed host (\`${_pyStr(a['model'])}\`), NOT model-vs-model.** ` +
            'Measures what the agent-config package does to ONE host model on a neutral ' +
            'fixture — not a capability ranking.',
    );
    L.push(
        '> 2. **Discipline axis, not capability.** The headline is the *discipline* ' +
            'delta (did it stay minimal / verify / ask / not destroy / update downstream), ' +
            'not whether the goal was achievable.',
    );
    L.push(
        `> 3. **PILOT — low statistical power (N=${_pyStr(a['n_tasks'])} tasks × ` +
            `${_pyStr(a['seeds'])} seed(s)).** Directional only.`,
    );
    L.push(
        '> 4. **Paired design**, errored runs excluded; McNemar (capability) + ' +
            'Wilcoxon signed-rank (discipline) + effect sizes. Exclusion is NOT ' +
            'assumed harmless — see each comparison’s Table 4 for how many pairs ' +
            'were dropped and whether the drops favour one arm.',
    );
    L.push(
        '> 5. **Not comparable to SWE-bench / GAIA / Fable scores** — a different ' +
            'question entirely.',
    );
    L.push('');
    L.push(`## Gate verdict: **${_pyStr(g['verdict'])}**`);
    L.push('');
    L.push(`- capability lift significant: \`${_pyStr(g['capability_significant'])}\``);
    L.push(`- discipline lift significant: \`${_pyStr(g['discipline_significant'])}\``);
    L.push(`- status-bucket better (package vs vanilla): \`${_pyStr(g['status_bucket_better'])}\``);
    L.push('');
    L.push(..._size_claim_section(a), '', ...searchClaimSection(a));
    if (g['verdict'] === 'PASS') {
        L.push(
            '> **Measurable discipline lift (significant).** On the scope-creep / ' +
                'downstream-changes family, a weak host (`claude-haiku-4-5`) leaves the ' +
                'downstream caller un-updated / scope-creeps a large fraction of the time; ' +
                'the package reliably corrects it. The lift is significant on the discipline ' +
                'axis (Wilcoxon p<0.05, every discordant pair favouring the package) AND ' +
                'beats an **equal-length inert-prose placebo** — so it is the package\'s ' +
                '*content* (its `downstream-changes`/`scope-control` rules), NOT mere ' +
                'prompt-length, that helps. **Honest scope (empirically bounded):** the lift ' +
                'is **weak-host-specific** — a CLEAN strong-host run (`claude-sonnet-4-6`, ' +
                'same tasks, 8 seeds) scored vanilla = package = placebo = 1.00 (no headroom, ' +
                'package redundant). So the package helps a WEAK model that lacks the ' +
                'discipline; a strong model already has it. This matches the package\'s design ' +
                'thesis (strong hosts self-apply discipline; weak hosts benefit fully). ' +
                'Discipline axis, not capability (both arms make the primary change); this ' +
                'task family (scope/downstream), not a universal claim. It improves *solution ' +
                'discipline*, not model intelligence.',
        );
        L.push('');
    }
    if (g['verdict'] !== 'PASS') {
        L.push(
            '> **Honest null.** The bare host is *already* disciplined ' +
                '(vanilla discipline ≈ 1.0), so there is no headroom for the package to ' +
                'lift — and the package neither helps nor hurts (placebo ≈ package ≈ ' +
                'vanilla, so no prompt-length effect either). This replicated across **both ' +
                'hosts** (weak `claude-haiku-4-5` + strong `claude-sonnet-4-6`) and **both ' +
                'scales** (micro + meso) — the complexity-stratified gate the 2026-06-14 ' +
                'council required. The discipline axis saturates for capable hosts on ' +
                'deterministic trap tasks; **no lift is claimed.** (A measurement confound — ' +
                "the plugin's own runtime hooks writing into the clone — once manufactured a " +
                "fake 'degradation' signal; it is excluded from the diff, see " +
                '`bench_ab_scoring_v2._rel_files`.) The apparatus is kept for a future ' +
                'non-deterministic / agentic-trajectory corpus where headroom may exist.',
        );
        L.push('');
    }
    const comparisons = Array.isArray(a['comparisons']) ? (a['comparisons'] as Dict[]) : [];
    for (const cmp of comparisons) {
        const cap = _dictOr(cmp['capability']);
        const dis = _dictOr(cmp['discipline']);
        L.push(
            `## ${_pyStr(cmp['label'])} — \`${_pyStr(cmp['arm_treatment'])}\` vs \`${_pyStr(cmp['arm_baseline'])}\` ` +
                `(n=${_pyStr(cmp['n_pairs'])} pairs)`,
        );
        L.push('');
        L.push('### Table 1 — capability axis (expected near-flat by design)');
        L.push('');
        L.push('| metric | baseline | treatment | test |');
        L.push('|---|---|---|---|');
        L.push(
            `| pass-rate | ${_fmtPct0(cap['rate_baseline'])} | ${_fmtPct0(cap['rate_treatment'])} ` +
                `| McNemar p=${_pyStr(cap['mcnemar_p'])}, h=${_pyStr(cap['cohens_h'])} |`,
        );
        L.push('');
        L.push('### Table 2 — discipline axis (the lift)');
        L.push('');
        L.push('| metric | baseline | treatment | Δ | test |');
        L.push('|---|---|---|---|---|');
        L.push(
            `| mean discipline | ${_fmt3(dis['mean_baseline'])} | ${_fmt3(dis['mean_treatment'])} ` +
                `| ${_fmtSigned3(dis['mean_delta'])} | Wilcoxon p=${_pyStr(dis['wilcoxon_p'])}, ` +
                `rb=${_pyStr(dis['rank_biserial'])} (n≠0=${_pyStr(dis['n_nonzero'])}) |`,
        );
        L.push('');
        const mt = _dictOr(a['mean_tokens']);
        const tb = _meanTokens(mt[String(cmp['arm_baseline'])]);
        const tt = _meanTokens(mt[String(cmp['arm_treatment'])]);
        L.push('### Table 3 — cost axis (mean tokens/run, non-errored)');
        L.push('');
        L.push('| metric | baseline | treatment | Δ |');
        L.push('|---|---|---|---|');
        L.push(`| mean tokens | ${_thousands(tb)} | ${_thousands(tt)} | ${_thousandsSigned(tt - tb)} |`);
        L.push('');

        // Delta #6 — the dollar half of the cost axis. Tokens above are a volume;
        // these are a price, and the two rank arms differently because the four
        // usage buckets differ in cost by up to 125×.
        const cost = _dictOr(a['cost']);
        const costArms = _dictOr(cost['per_arm']);
        const cb = _dictOr(costArms[String(cmp['arm_baseline'])]);
        const ct = _dictOr(costArms[String(cmp['arm_treatment'])]);
        L.push('### Table 3b — cost axis in dollars (bucket-priced, non-errored)');
        L.push('');
        if (!_pyTruthy(cost['priced'])) {
            L.push(
                `> **Unpriced.** No pricing row matches model \`${_pyStr(a['model'])}\` ` +
                    `(tier \`${_pyStr(cost['tier'])}\`), so no dollar figure is shown. This is a ` +
                    'gap, not a zero — add the row to `internal/bench/pricing.yaml` rather than ' +
                    'reading the absence as "free".',
            );
        } else {
            L.push('| metric | baseline | treatment | Δ |');
            L.push('|---|---|---|---|');
            L.push(
                `| mean USD/run | ${_usd(cb['mean_usd'])} | ${_usd(ct['mean_usd'])} ` +
                    `| ${_usdSigned(_pyFloat(ct['mean_usd']) - _pyFloat(cb['mean_usd']))} |`,
            );
            L.push(
                `| total USD | ${_usd(cb['total_usd'])} | ${_usd(ct['total_usd'])} ` +
                    `| ${_usdSigned(_pyFloat(ct['total_usd']) - _pyFloat(cb['total_usd']))} |`,
            );
            L.push('');
            const age = pricing_age_days(
                cost['pricing_sourced_on'] ? String(cost['pricing_sourced_on']) : null,
                a['stamp'] ? String(a['stamp']) : null,
            );
            const src = cost['pricing_sourced_on'] ? String(cost['pricing_sourced_on']) : 'unknown';
            L.push(
                `> Priced per bucket (input / output / cache-write / cache-read) at the ` +
                    `\`${_pyStr(cost['tier'])}\` tier, sourced ${src}` +
                    (age === null ? '' : ` — **${age} days before this report**`) +
                    '. A blended rate over the token total is not an approximation of this, it is ' +
                    'a different number. Stale prices make these figures stale: re-source them ' +
                    'before quoting a dollar amount.',
            );
        }
        L.push('');
        const at = _dictOr(cmp['attrition']);
        L.push('### Table 4 — attrition (dropped pairs are not missing-at-random)');
        L.push('');
        L.push('| pairs seen | analysed | dropped | treatment-only | baseline-only | both | asymmetry |');
        L.push('|---|---|---|---|---|---|---|');
        L.push(
            `| ${_pyStr(at['pairs_seen'])} | ${_pyStr(at['pairs_analysed'])} | ${_pyStr(at['pairs_dropped'])} ` +
                `| ${_pyStr(at['dropped_treatment_only'])} | ${_pyStr(at['dropped_baseline_only'])} ` +
                `| ${_pyStr(at['dropped_both'])} | ${_fmtSignedInt(at['drop_asymmetry'])} |`,
        );
        const dropBuckets = Object.entries(_dictOr(at['dropped_by_status_bucket']))
            .map(([k, v]) => `${k}:${_pyStr(v)}`)
            .join(', ');
        L.push('');
        L.push(`Dropped runs by status bucket: ${dropBuckets || '_none_'}.`);
        L.push('');
        L.push(
            '> A positive asymmetry means the treatment arm errored out more often than ' +
                'the baseline. Budget caps and timeouts fire preferentially on the arm doing ' +
                'more work, so the surviving sample is then biased TOWARD the baseline and the ' +
                'measured lift is a floor, not an estimate.',
        );
        L.push('');
    }
    L.push('## Status buckets (trajectory)');
    L.push('');
    L.push('| arm | runs | error-rate | buckets |');
    L.push('|---|---|---|---|');
    const statusBuckets = _dictOr(a['status_buckets']);
    for (const arm of Object.keys(statusBuckets)) {
        const info = _dictOr(statusBuckets[arm]);
        const bucketsObj = _dictOr(info['buckets']);
        const bk = Object.entries(bucketsObj)
            .map(([k, v]) => `${k}:${_pyStr(v)}`)
            .join(', ');
        L.push(`| ${arm} | ${_pyStr(info['total'])} | ${_fmtPct0(info['error_rate'])} | ${bk} |`);
    }
    L.push('');
    L.push('## Methodology');
    L.push('');
    L.push(
        `- Host model: \`${_pyStr(a['model'])}\` (pinned across all arms — a validity ` +
            'requirement, not a model comparison).',
    );
    L.push(
        // budget_usd_per_run is a Python float (argparse type=float, round-tripped
        // through JSON); str() → "1.0". placebo_chars is an int → "2000".
        `- Per-run budget cap: $${_pyStr(payload['budget_usd_per_run'])}; ` +
            `placebo injected ~${_pyStr(payload['placebo_chars'])} chars of inert prose.`,
    );
    L.push(
        '- Arms: vanilla (plugin off) · package (real plugin) · package-rdp ' +
            '(plugin + RDP rules) · placebo (plugin off + equal-length inert prose).',
    );
    L.push(
        '- Corpus: `internal/bench/corpora/ab-trackb-v2.yaml` (5 trap archetypes). ' +
            'Scoring: `bench_ab_scoring_v2.py` (deterministic, no LLM judge).',
    );
    L.push('- Roadmap: `agents/roadmaps/road-to-discipline-axis-benchmark.md`.');
    L.push('');
    return L.join('\n');
}

// ── format helpers (Python f-string parity) ───────────────────────────────

/** `f"{x:.0%}"` — percent, 0 decimals, value is a 0..1 fraction. */
function _fmtPct0(v: unknown): string {
    return `${_pyFixed(_pyFloat(v) * 100, 0)}%`;
}

/** `f"{x:.3f}"`. */
function _fmt3(v: unknown): string {
    return _pyFixed(_pyFloat(v), 3);
}

/** `f"{x:+.3f}"`. */
function _fmtSigned3(v: unknown): string {
    const body = _pyFixed(_pyFloat(v), 3);
    return body.startsWith('-') ? body : `+${body}`;
}

/** `f"{n:+d}"` over an int-ish JSON value (attrition asymmetry). */
function _fmtSignedInt(v: unknown): string {
    const n = _pyIntTrunc(_pyFloat(v));
    return n < 0 ? String(n) : `+${n}`;
}

/** `f"{n:,}"` over `int(value)`. */
function _thousands(n: number): string {
    return _pyThousands(_pyIntTrunc(n));
}

function _thousandsSigned(n: number): string {
    const t = _pyIntTrunc(n);
    const body = _pyThousands(t);
    return t < 0 ? body : `+${body}`;
}

/**
 * Render a cost cell — `n/a` when the model could not be priced, never `$0.00`.
 *
 * Unwraps through `_pyFloat` because the analysis carries costs as `PyFloat`
 * (a plain `{value}` wrapper with no `valueOf`), so `Number(cell)` yields NaN.
 */
function _usd(v: unknown): string {
    return v === null || v === undefined ? 'n/a' : `$${_pyFloat(v).toFixed(4)}`;
}

function _usdSigned(n: number): string {
    return `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(4)}`;
}

/** `mt.get(arm, {}).get("mean_tokens", 0)`. */
function _meanTokens(arm: unknown): number {
    const d = _dictOr(arm);
    return _orZero(d['mean_tokens']);
}

// ── analysis-JSON byte parity (json.dumps(..., indent=2)) ──────────────────

class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

// Keys whose Python value is a float (round(...) / x/y ratio) and must render
// with a trailing `.0` for integer values.
const _FLOAT_KEYS = new Set([
    'rate_treatment',
    'rate_baseline',
    'mcnemar_p',
    'cohens_h',
    'mean_treatment',
    'mean_baseline',
    'mean_delta',
    'wilcoxon_p',
    'rank_biserial',
    'error_rate',
    'budget_usd_per_run',
]);

function _toJson(v: unknown, key?: string): Json {
    if (v === null || v === undefined) return null;
    if (v instanceof PyFloat) return v;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') {
        return key !== undefined && _FLOAT_KEYS.has(key) ? new PyFloat(v) : v;
    }
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map((x) => _toJson(x));
    if (typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const out: { [k: string]: Json } = {};
        for (const k of Object.keys(o)) {
            out[k] = _toJson(o[k], k);
        }
        return out;
    }
    return null;
}

function _jsonDumps(obj: Json, indent: number): string {
    const pad = ' '.repeat(indent);
    function enc(value: Json, depth: number): string {
        if (value === null) return 'null';
        if (value instanceof PyFloat) {
            return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
        }
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as { [k: string]: Json };
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k] as Json, depth + 1));
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }
    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }
    return enc(obj, 0);
}

// ── stdout (`print`) parity ───────────────────────────────────────────────

function _printStdout(analysis: Dict): void {
    const a = analysis;
    const lines: string[] = [];
    lines.push(
        `bench:ab v2 — ${_pyStr(a['n_tasks'])} tasks × ${_pyStr(a['seeds'])} seeds · model=${_pyStr(a['model'])}`,
    );
    const comparisons = Array.isArray(a['comparisons']) ? (a['comparisons'] as Dict[]) : [];
    for (const cmp of comparisons) {
        lines.push(
            `\n[${_pyStr(cmp['label'])}] ${_pyStr(cmp['arm_treatment'])} vs ${_pyStr(cmp['arm_baseline'])} (n=${_pyStr(cmp['n_pairs'])} pairs)`,
        );
        const cap = _dictOr(cmp['capability']);
        const dis = _dictOr(cmp['discipline']);
        lines.push(
            `  capability: ${_fmtPct0(cap['rate_baseline'])} -> ${_fmtPct0(cap['rate_treatment'])} ` +
                `(McNemar p=${_pyStr(cap['mcnemar_p'])}, h=${_pyStr(cap['cohens_h'])})`,
        );
        lines.push(
            `  discipline: ${_fmt3(dis['mean_baseline'])} -> ${_fmt3(dis['mean_treatment'])} ` +
                `(Δ=${_fmtSigned3(dis['mean_delta'])}, Wilcoxon p=${_pyStr(dis['wilcoxon_p'])}, rb=${_pyStr(dis['rank_biserial'])}, n≠0=${_pyStr(dis['n_nonzero'])})`,
        );
    }
    const gate = _dictOr(a['gate']);
    lines.push(
        `\nGATE: ${_pyStr(gate['verdict'])} ` +
            `(cap_sig=${_pyStr(gate['capability_significant'])}, dis_sig=${_pyStr(gate['discipline_significant'])})`,
    );
    // print() adds a trailing newline per call; join with "\n" then add final "\n".
    process.stdout.write(lines.join('\n') + '\n');
}

// ── CLI ───────────────────────────────────────────────────────────────────

interface ParsedArgs {
    report: string | null;
    json: boolean;
    markdown: string;
}

class ArgExit extends Error {}

function parse_args(argv: string[]): ParsedArgs {
    const prog = 'bench_ab_v2_stats.py';
    const out: ParsedArgs = { report: null, json: false, markdown: '' };
    const usage = `usage: ${prog} [-h] [--json] [--markdown PATH] [report]\n`;
    const argErr = (msg: string): never => {
        process.stderr.write(usage);
        process.stderr.write(`${prog}: error: ${msg}\n`);
        process.exitCode = 2;
        throw new ArgExit(msg);
    };
    const positionals: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(usage);
            process.exit(0);
        } else if (a === '--json') {
            out.json = true;
        } else if (a === '--markdown') {
            if (i + 1 >= argv.length) {
                argErr('argument --markdown: expected one argument');
            }
            out.markdown = argv[i + 1] as string;
            i += 1;
        } else if (a.startsWith('--markdown=')) {
            out.markdown = a.slice('--markdown='.length);
        } else if (a.startsWith('-') && a !== '-') {
            argErr(`unrecognized arguments: ${a}`);
        } else {
            positionals.push(a);
        }
    }
    if (positionals.length > 1) {
        argErr(`unrecognized arguments: ${positionals.slice(1).join(' ')}`);
    }
    out.report = positionals.length ? (positionals[0] as string) : null;
    return out;
}

/** `sorted(REPORTS_DIR.glob("*-ab-v2-paired.json"))` — direct children, sorted. */
function _globSorted(dir: string, suffix: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith(suffix)).map((n) => path.join(dir, n));
    out.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    let p: string;
    if (args.report) {
        p = args.report;
    } else {
        const cands = _globSorted(REPORTS_DIR, '-ab-v2-paired.json');
        if (cands.length === 0) {
            process.stderr.write('no v2 paired report found\n');
            return 1;
        }
        p = cands[cands.length - 1] as string;
    }
    const raw = fs.readFileSync(p, 'utf-8');
    const payload = _dictOr(JSON.parse(raw));
    // Python `json.loads` keeps the int/float distinction (`1` int, `1.0` float);
    // `budget_usd_per_run` is the only input number the markdown re-renders via
    // str(), so preserve its float-ness from the raw literal (`JSON.parse` drops
    // the trailing `.0`). All other rendered numbers are computed, not echoed.
    if (typeof payload['budget_usd_per_run'] === 'number' && _jsonFieldIsFloat(raw, 'budget_usd_per_run')) {
        payload['budget_usd_per_run'] = new PyFloat(payload['budget_usd_per_run'] as number);
    }
    const analysis = analyse(payload);
    analysis['gate'] = gate_verdict(analysis);
    if (args.markdown) {
        const out = args.markdown;
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, to_markdown(analysis, payload));
        process.stdout.write(`wrote ${out}\n`);
        return 0;
    }
    if (args.json) {
        process.stdout.write(_jsonDumps(_toJson(analysis), 2) + '\n');
        return 0;
    }
    _printStdout(analysis);
    return 0;
}

// ── parity primitives ─────────────────────────────────────────────────────

function _dictOr(value: unknown): Dict {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Dict;
    }
    return {};
}

function _pyTruthy(v: unknown): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v as object).length > 0;
    return Boolean(v);
}

function _pyFloat(v: unknown): number {
    if (v instanceof PyFloat) return v.value;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
}

function _orZero(v: unknown): number {
    if (typeof v === 'number') return v;
    if (v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
}

function _strOr(v: unknown, fallback: string): string {
    if (typeof v === 'string') return v;
    if (v === null || v === undefined) return fallback;
    return String(v);
}

function _pyStr(v: unknown): string {
    if (v instanceof PyFloat) {
        return Number.isInteger(v.value) ? `${v.value}.0` : String(v.value);
    }
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    return String(v);
}

// `_pyRound` / `_pyRoundNoArg` live in `_lib/paired_stats.ts` (imported above):
// `wilcoxon` needs them and moved there, and two copies of a float-parity
// rounder is how byte-stable output stops being byte-stable.


/** `format(x, '.Nf')` — round-half-even on the exact double, fixed N decimals. */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) return String(x);
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const exact = abs.toFixed(40);
    const dot = exact.indexOf('.');
    const intPart = dot === -1 ? exact : exact.slice(0, dot);
    const fracPart = dot === -1 ? '' : exact.slice(dot + 1);
    const kept = (intPart + fracPart.slice(0, ndigits).padEnd(ndigits, '0')).replace(/^0+(?=\d)/, '');
    const rest = fracPart.slice(ndigits);
    let value = BigInt(kept === '' ? '0' : kept);
    if (rest.length > 0) {
        const firstRest = rest.charCodeAt(0) - 48;
        const hasMore = /[1-9]/.test(rest.slice(1));
        if (firstRest > 5 || (firstRest === 5 && hasMore)) {
            value += 1n;
        } else if (firstRest === 5 && !hasMore) {
            if (value % 2n === 1n) {
                value += 1n;
            }
        }
    }
    let intStr = value.toString();
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
    // Python preserves the sign even when the magnitude rounds to zero
    // (`format(-0.0001, '.3f')` → '-0.000', `format(-0.5, '.0f')` → '-0').
    return neg ? `-${result}` : result;
}

/** Python `int(x)` truncate toward zero. */
function _pyIntTrunc(x: number): number {
    return x < 0 ? Math.ceil(x) : Math.floor(x);
}

/** Python `f"{n:,}"` — group integer digits in threes with commas. */
function _pyThousands(n: number): string {
    const neg = n < 0;
    const digits = String(Math.abs(n));
    let out = '';
    for (let i = 0; i < digits.length; i += 1) {
        if (i > 0 && (digits.length - i) % 3 === 0) {
            out += ',';
        }
        out += digits[i];
    }
    return neg ? `-${out}` : out;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exitCode = main();
    } catch (e) {
        if (e instanceof ArgExit) {
            process.exitCode = process.exitCode ?? 2;
        } else {
            throw e;
        }
    }
}

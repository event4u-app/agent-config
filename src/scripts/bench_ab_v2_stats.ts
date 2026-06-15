#!/usr/bin/env node
/**
 * bench:ab v2 — paired statistics (Phase 3).
 *
 * TypeScript twin of `src/scripts/bench_ab_v2_stats.py` (ADR-096 Python→TS
 * migration). Mirrors the CLI contract EXACTLY: positional `report` arg, the
 * `--json` / `--markdown PATH` flags, exit codes (0 ok / 1 no report found),
 * byte-identical stdout/stderr, byte-identical analysis JSON, and byte-identical
 * rendered markdown. No behaviour changes.
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
 * is byte-identical to the Python original.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// bench_ab_v2_stats.ts → parents[2] is repo root (script lives in src/scripts/).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab-v2');

type Dict = Record<string, unknown>;

const COMPARISONS: Array<[string, string, string]> = [
    ['package', 'vanilla', 'package lift'],
    ['package-rdp', 'package', 'RDP lift'],
    ['package', 'placebo', 'attribution (content vs length)'],
];

// ── CPython math.erf / math.comb ports ────────────────────────────────────
//
// CPython's `m_erf` (Modules/mathmodule.c): a Maclaurin series for |x| < 1.5
// and 1 - erfc for larger |x|; `m_erfc` uses a continued-fraction expansion.
// Ported verbatim so `_phi(z)` matches python3 to full double precision.

const _ERF_SERIES_CUTOFF = 1.5;
const _ERF_SERIES_TERMS = 25;
const _ERFC_CONTFRAC_CUTOFF = 30.0;
const _ERFC_CONTFRAC_TERMS = 50;
const _SQRTPI = 1.772453850905516027298167483341145182798;

function _m_erf_series(x: number): number {
    // erf(x) = 2/sqrt(pi) * x * sum_{k>=0} (-x^2)^k / (k! (2k+1))
    let x2 = x * x;
    let acc = 0.0;
    let fk = _ERF_SERIES_TERMS + 0.5;
    for (let i = 0; i < _ERF_SERIES_TERMS; i += 1) {
        acc = 2.0 + (x2 * acc) / fk;
        fk -= 1.0;
    }
    return (acc * x * Math.exp(-x2)) / _SQRTPI;
}

function _m_erfc_contfrac(x: number): number {
    if (x >= _ERFC_CONTFRAC_CUTOFF) {
        return 0.0;
    }
    const x2 = x * x;
    let a = 0.0;
    let da = 0.5;
    let p = 1.0;
    let p_last = 0.0;
    let q = da + x2;
    let q_last = 1.0;
    for (let i = 0; i < _ERFC_CONTFRAC_TERMS; i += 1) {
        a += da;
        da += 2.0;
        const b = da + x2;
        const temp_p = b * p - a * p_last;
        p_last = p;
        p = temp_p;
        const temp_q = b * q - a * q_last;
        q_last = q;
        q = temp_q;
    }
    return (((p / q) * x) * Math.exp(-x2)) / _SQRTPI;
}

function _erf(x: number): number {
    if (Number.isNaN(x)) {
        return x;
    }
    const absx = Math.abs(x);
    if (absx < _ERF_SERIES_CUTOFF) {
        return _m_erf_series(x);
    }
    const cf = _m_erfc_contfrac(absx);
    return x > 0.0 ? 1.0 - cf : cf - 1.0;
}

/** Python `math.comb(n, k)` — exact non-negative integer (BigInt → Number). */
function _comb(n: number, k: number): number {
    if (k < 0 || k > n) {
        return 0;
    }
    let kk = BigInt(Math.min(k, n - k));
    if (kk === 0n) {
        return 1;
    }
    const N = BigInt(n);
    let result = 1n;
    let i = 0n;
    while (i < kk) {
        result = (result * (N - i)) / (i + 1n);
        i += 1n;
    }
    return Number(result);
}

function _phi(z: number): number {
    // Standard-normal CDF via erf.
    return 0.5 * (1.0 + _erf(z / Math.sqrt(2.0)));
}

export function mcnemar_exact(b: number, c: number): number {
    // Two-sided exact McNemar p-value (binomial on discordant pairs).
    const n = b + c;
    if (n === 0) {
        return 1.0;
    }
    const k = Math.min(b, c);
    let tail = 0;
    for (let i = 0; i <= k; i += 1) {
        tail += _comb(n, i);
    }
    tail = tail * 0.5 ** n;
    return Math.min(1.0, 2.0 * tail);
}

export function cohens_h(p1: number, p2: number): number {
    return (
        2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, p1)))) -
        2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, p2))))
    );
}

interface WilcoxonResult {
    n: number;
    W_plus: number; // PyFloat-flagged at dump for the rounded case
    W_minus: number;
    p: number;
    rank_biserial: number;
}

export function wilcoxon(diffs: number[]): WilcoxonResult {
    // Wilcoxon signed-rank on paired differences (treatment - baseline).
    // Returns W+, W-, normal-approx two-sided p (continuity-corrected), and
    // rank-biserial effect size. Zeros are dropped.
    const nz = diffs.filter((d) => Math.abs(d) > 1e-9);
    const n = nz.length;
    if (n === 0) {
        return { n: 0, W_plus: 0, W_minus: 0, p: 1.0, rank_biserial: 0.0 };
    }
    // order = sorted(range(n), key=lambda i: abs(nz[i])) — stable sort.
    const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => {
        const ax = Math.abs(nz[x] as number);
        const ay = Math.abs(nz[y] as number);
        return ax < ay ? -1 : ax > ay ? 1 : x - y; // stable on tie
    });
    const ranks: number[] = new Array(n).fill(0.0);
    let i = 0;
    while (i < n) {
        let j = i;
        while (j + 1 < n && Math.abs(nz[order[j + 1] as number] as number) === Math.abs(nz[order[i] as number] as number)) {
            j += 1;
        }
        const avg = (i + 1 + j + 1) / 2.0; // average rank for ties (1-based)
        for (let k = i; k <= j; k += 1) {
            ranks[order[k] as number] = avg;
        }
        i = j + 1;
    }
    let w_plus = 0.0;
    let w_minus = 0.0;
    for (let idx = 0; idx < n; idx += 1) {
        if ((nz[idx] as number) > 0) {
            w_plus += ranks[idx] as number;
        } else if ((nz[idx] as number) < 0) {
            w_minus += ranks[idx] as number;
        }
    }
    const total = w_plus + w_minus;
    const rb = total ? (w_plus - w_minus) / total : 0.0;
    // Normal approximation (ok-ish for n>=10; for small n it's conservative —
    // we surface n so the reader can weight it).
    const mean = (n * (n + 1)) / 4.0;
    const sd = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24.0);
    const w = Math.min(w_plus, w_minus);
    let p: number;
    if (sd === 0) {
        p = 1.0;
    } else {
        const z = (w - mean + 0.5) / sd;
        p = Math.min(1.0, 2.0 * _phi(z));
    }
    return {
        n,
        // W_plus / W_minus are not surfaced in JSON/markdown (compare() drops
        // them), so plain numbers suffice; p / rank_biserial are floats.
        W_plus: _pyRound(w_plus, 1),
        W_minus: _pyRound(w_minus, 1),
        p: _pyRound(p, 4),
        rank_biserial: _pyRound(rb, 4),
    };
}

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
    for (const { rt, rb } of _pairs(records, arm_t, arm_b)) {
        if (!_pyTruthy(rt['errored']) && !_pyTruthy(rb['errored'])) {
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
        status_buckets: bucket_rates(records, arms),
        mean_tokens: mean_tokens_by_arm(records, arms),
    };
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
        '> Generated by `scripts/bench_ab_v2_stats.py --markdown`. Source: ' +
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
            'Wilcoxon signed-rank (discipline) + effect sizes.',
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

/** `f"{n:,}"` over `int(value)`. */
function _thousands(n: number): string {
    return _pyThousands(_pyIntTrunc(n));
}

function _thousandsSigned(n: number): string {
    const t = _pyIntTrunc(n);
    const body = _pyThousands(t);
    return t < 0 ? body : `+${body}`;
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

/** Python `round(x)` (no ndigits) → int, round-half-to-even. */
function _pyRoundNoArg(x: number): number {
    if (!Number.isFinite(x)) return x;
    const floor = Math.floor(x);
    const frac = x - floor;
    if (frac < 0.5) return floor;
    if (frac > 0.5) return floor + 1;
    return floor % 2 === 0 ? floor : floor + 1;
}

/** Python `round(x, ndigits)` — round-half-to-even on the exact double. */
function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value) || value === 0) {
        return value;
    }
    const neg = value < 0;
    const abs = Math.abs(value);
    const exact = abs.toFixed(40);
    const dot = exact.indexOf('.');
    const intPart = dot === -1 ? exact : exact.slice(0, dot);
    const fracPart = dot === -1 ? '' : exact.slice(dot + 1);
    const keepFrac = fracPart.slice(0, ndigits).padEnd(ndigits, '0');
    const rest = fracPart.slice(ndigits);
    const scaledStr = (intPart + keepFrac).replace(/^0+(?=\d)/, '');
    let scaled = BigInt(scaledStr === '' ? '0' : scaledStr);
    if (rest.length > 0) {
        const firstRest = rest.charCodeAt(0) - 48;
        const hasMore = /[1-9]/.test(rest.slice(1));
        if (firstRest > 5 || (firstRest === 5 && hasMore)) {
            scaled += 1n;
        } else if (firstRest === 5 && !hasMore) {
            if (scaled % 2n === 1n) {
                scaled += 1n;
            }
        }
    }
    const factor = 10 ** ndigits;
    const result = Number(scaled) / factor;
    return neg ? -result : result;
}

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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href || process.argv[1] === _HERE) {
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

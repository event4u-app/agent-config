/**
 * Paired binary statistics — the exact test and its effect size.
 *
 * Extracted from `bench_ab_v2_stats.ts` and re-exported there, so every existing
 * importer is unchanged. The move is not cosmetic: that file sits above the
 * 1500-line ceiling `check_source_size_budget` charges, so lines added to it are
 * paid back by extraction rather than by raising a baseline.
 *
 * `mcnemar_exact` is the shape `_lib/paired_verdict.ts` generalises — a binomial
 * over DISCORDANT pairs only, which is the whole point: a concordant pair
 * carries no information about direction and must not dilute the count. This one
 * is two-sided (its callers ask whether the arms differ); `paired_verdict`'s is
 * one-sided (it asks whether the treatment is better). They are kept apart for
 * that reason rather than merged into a flag.
 */

/** Exact binomial coefficient via BigInt, so a large n cannot drift. */
function comb(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    let num = 1n;
    let den = 1n;
    const kk = BigInt(Math.min(k, n - k));
    for (let i = 0n; i < kk; i += 1n) {
        num *= BigInt(n) - i;
        den *= i + 1n;
    }
    return Number(num / den);
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
        tail += comb(n, i);
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

/** Python `round(x)` (no ndigits) → int, round-half-to-even. */
export function _pyRoundNoArg(x: number): number {
    if (!Number.isFinite(x)) return x;
    const floor = Math.floor(x);
    const frac = x - floor;
    if (frac < 0.5) return floor;
    if (frac > 0.5) return floor + 1;
    return floor % 2 === 0 ? floor : floor + 1;
}

/** Python `round(x, ndigits)` — round-half-to-even on the exact double. */
export function _pyRound(value: number, ndigits: number): number {
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

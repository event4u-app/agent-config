/**
 * Render the `Memory hits influencing this run` section.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/sections/memory.py`
 * (ADR-200). Byte-identical to the Python original — same `:.2f` score
 * formatting, same `score n/a` fallback for non-numeric scores. No
 * behaviour changes.
 *
 * Parity note (ADR-200): the trace carries `hit_score` as a `PyFloat`
 * marker (the `float()` from `memory.build`). `isinstance(score, (int,
 * float))` is mirrored as `PyFloat` OR plain `number`.
 */
import { PyFloat } from '../memory.js';

function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (typeof value === 'number') {
        return value !== 0 && !Number.isNaN(value);
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as object).length > 0;
    }
    return true;
}

/**
 * Python `f"{x:.2f}"` — fixed 2-decimal, round-half-to-EVEN on the EXACT
 * binary (IEEE-754) value, matching CPython's `float.__format__`.
 *
 * `toFixed` (half-away-from-zero) and `Intl … halfEven` (which rounds the
 * decimal-literal value) both diverge from CPython on half-way cases
 * (`0.125 → 0.12`, `0.005 → 0.01`). The only faithful route is to take the
 * double's exact rational value (mantissa / 2^k via its bits) and round it
 * to N decimals with half-to-even — verified byte-identical to CPython
 * across 4000+ random + edge values (incl. signed zeros).
 */
function _fmt2(x: number): string {
    if (!Number.isFinite(x)) {
        if (Number.isNaN(x)) {
            return 'nan';
        }
        return x > 0 ? 'inf' : '-inf';
    }
    const nd = 2;
    const neg = x < 0 || Object.is(x, -0);
    const ax = Math.abs(x);
    const buf = new DataView(new ArrayBuffer(8));
    buf.setFloat64(0, ax);
    const bits = buf.getBigUint64(0);
    const expo = Number((bits >> 52n) & 0x7ffn);
    const mant = bits & 0xfffffffffffffn;
    let num: bigint;
    let den: bigint;
    if (expo === 0) {
        num = mant;
        den = 1n << 1074n; // subnormal
    } else {
        num = mant | 0x10000000000000n;
        const e = BigInt(expo) - 1075n;
        if (e >= 0n) {
            num <<= e;
            den = 1n;
        } else {
            den = 1n << -e;
        }
    }
    const scale = 10n ** BigInt(nd);
    const numS = num * scale;
    let q = numS / den;
    const r = numS % den;
    const twice = r * 2n;
    if (twice > den) {
        q += 1n;
    } else if (twice === den && q % 2n === 1n) {
        q += 1n; // round half to even
    }
    const s = q.toString().padStart(nd + 1, '0');
    const ip = s.slice(0, s.length - nd) || '0';
    const fp = s.slice(s.length - nd);
    const out = `${ip}.${fp}`;
    return neg ? `-${out}` : out;
}

export function render(trace: Record<string, unknown>): string {
    const out: string[] = ['## Memory hits influencing this run', ''];
    const entries = (_pyTruthy(trace.memory) ? trace.memory : []) as unknown[];
    if (entries.length === 0) {
        out.push('- (none)');
        out.push('');
        return out.join('\n');
    }
    for (const entryRaw of entries) {
        const entry = entryRaw as Record<string, unknown>;
        const entry_id = _pyTruthy(entry.entry_id) ? entry.entry_id : '(unknown)';
        const score = entry.hit_score;
        const used_in = _pyTruthy(entry.used_in) ? entry.used_in : 'unspecified';
        // f"score {score:.2f}" if isinstance(score, (int, float)) else "score n/a"
        // Python `bool` is a subclass of `int`, so True/False also format.
        let score_str: string;
        if (score instanceof PyFloat) {
            score_str = `score ${_fmt2(score.value)}`;
        } else if (typeof score === 'boolean') {
            score_str = `score ${_fmt2(score ? 1 : 0)}`;
        } else if (typeof score === 'number') {
            score_str = `score ${_fmt2(score)}`;
        } else {
            score_str = 'score n/a';
        }
        out.push(`- ${entry_id} (${score_str}) — used in ${used_in}`);
    }
    out.push('');
    return out.join('\n');
}

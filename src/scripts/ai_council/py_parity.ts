/**
 * py_parity — the small Python-stdlib parity helpers the council modules share.
 *
 * Relocated out of `orchestrator.ts` UNCHANGED. That file sits ~870 lines over
 * the source ceiling and this repository answers growth with extraction rather
 * than a raised baseline (`gate-violation-baselines.json`
 * § check_source_size_budget: "extract, then measure"). A reviewer diffs a
 * move: no body here is edited, only exported.
 *
 * They exist at all because this module family is a faithful port of a retired
 * Python implementation whose formatting and slicing semantics are asserted
 * byte-for-byte by golden tests — JS `Math.trunc`, `String.slice` and
 * `str.length` disagree with their Python counterparts on truncation sign,
 * code points and surrogate pairs respectively.
 */

// ── small stdlib parity helpers ───────────────────────────────────────

/** Mirror Python `int(x)` truncation-toward-zero on a float total. */
export function _pyInt(x: number): number {
    return Math.trunc(x);
}

/** Mirror Python `repr(int)` for the error message in estimate_debate_cost. */
export function _pyReprInt(x: number): string {
    return String(x);
}

/** Mirror `type(exc).__name__ + ": " + str(exc)`. */
export function _excTag(exc: unknown): string {
    if (exc instanceof Error) {
        return `${exc.name}: ${exc.message}`;
    }
    return `Error: ${String(exc)}`;
}

/** dict.setdefault(key, value) — only set when key absent. */
export function _setdefault(
    obj: Record<string, unknown>,
    key: string,
    value: unknown,
): void {
    if (!(key in obj)) {
        obj[key] = value;
    }
}

/** dict.get(key, default). */
export function _metaGet(
    obj: Record<string, unknown>,
    key: string,
    fallback: unknown,
): unknown {
    return key in obj ? obj[key] : fallback;
}

/** Python `str.lstrip()` (no-arg) — strip leading whitespace. */
export function _pyLStrip(s: string): string {
    return s.replace(/^\s+/, '');
}

/** Python `str.rstrip()` (no-arg) — strip trailing whitespace. */
export function _pyRStrip(s: string): string {
    return s.replace(/\s+$/, '');
}

/** Python `len(str)` — code-point count, not UTF-16 unit count. */
export function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Python `s[start:end]` — code-point slicing. */
export function _pySlice(s: string, start: number, end: number): string {
    return [...s].slice(start, end).join('');
}

// ── Python-format / stdlib parity helpers ────────────────────────────────
//
// The orchestrator formats USD / scores / strengths via Python f-string
// specs (`:.4f`, `:.2f`, `:.1f`) which round half-to-even on the decimal
// representation. JS `toFixed` rounds half away from zero, so the spec
// formatting is reimplemented to stay byte-exact with the retired Python implementation.

/**
 * Format `x` to `ndigits` decimals using round-half-to-even, matching
 * CPython's `format(x, ".<ndigits>f")`.
 */
export function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    let intStr = String(rounded);
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
    return neg ? `-${result}` : result;
}

/** Mirror Python `str.strip()` (no-arg). Sibling-twin convention uses trim(). */
export function _pyStrip(s: string): string {
    return s.trim();
}

/**
 * Mirror Python `str.split()` (no separator) — split on runs of whitespace,
 * dropping leading / trailing whitespace (no empty tokens).
 */
export function _pySplitWhitespace(s: string): string[] {
    const trimmed = s.trim();
    if (trimmed === '') {
        return [];
    }
    return trimmed.split(/\s+/);
}

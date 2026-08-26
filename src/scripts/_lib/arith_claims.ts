/**
 * Check an arithmetic claim written in prose against itself.
 *
 * The defect this exists for, observed rather than imagined: a fixture states
 * the same number twice — once as a declared `expected` and once inside the
 * rationale that derives it — and the two disagree. A judge then prefers the
 * declared value over the recomputed one and scores a correct response as a
 * loss. Both numbers are in the file, so nothing has to be inferred; they
 * simply were never compared.
 *
 * The scanner reads CHAINS (`a x b / c = d / c = e`), because that is how the
 * derivations in this tree are actually written. Comparing only the outermost
 * pair would mis-read every intermediate step as a claim of its own — the
 * first version of this check did exactly that and produced three false
 * findings on a corpus that was correct.
 *
 * Prose rounding is legitimate and is tolerated to the PRECISION THE PROSE
 * ITSELF USES: `1.333` agrees with 4/3, `1.33` does not have to. A fixed
 * epsilon would either reject honest rounding or accept a real disagreement,
 * depending on the magnitude of the numbers, which is the wrong axis.
 */

/** One prose arithmetic chain and what it evaluates to. */
export interface ArithChain {
    /** The chain as written. */
    text: string;
    /** Every `=`-separated segment that evaluated to a number. */
    values: readonly { segment: string; value: number }[];
}

/** A chain whose segments disagree beyond the precision the prose claims. */
export interface ArithDisagreement {
    text: string;
    leftSegment: string;
    left: number;
    rightSegment: string;
    right: number;
    /** The tolerance the right-hand segment's own precision earns it. */
    tolerance: number;
}

const CHAIN = /(?:[-+]?[\d,]*\.?\d+[\s\d,.+\-*/x×^()%]*=\s*)+[-+]?[\d,]*\.?\d+/g;

/**
 * Evaluate one prose segment, or `null` when it is not pure arithmetic.
 *
 * Deliberately narrow: digits, the four operators, `^`, parentheses and the
 * separators prose uses. Anything else returns `null` rather than being
 * coerced — a segment carrying a word is a sentence, not a claim, and guessing
 * at it is how a checker starts inventing findings.
 */
export function evaluateSegment(segment: string): number | null {
    const t = segment
        .trim()
        .replace(/,/g, '')
        .replace(/[×x]/g, '*')
        .replace(/%/g, '')
        .replace(/\$/g, '');
    if (!/\d/.test(t)) return null;
    if (!/^[\d\s.+\-*/^()]+$/.test(t)) return null;
    // `^` is exponentiation in prose and XOR in JS — translate before eval.
    const js = t.replace(/\^/g, '**');
    try {
        // Input is whitelisted above to digits, operators and parentheses — a
        // segment carrying anything else returned null before reaching here.
        const fn = new Function(`"use strict"; return (${js});`) as () => unknown;
        const v = fn();
        return typeof v === 'number' && Number.isFinite(v) ? v : null;
    } catch {
        return null;
    }
}

/** Decimal places written in a literal, used as the rounding tolerance. */
function precisionTolerance(segment: string, magnitude: number): number {
    const m = /\.(\d+)\s*$/.exec(segment.trim());
    const decimals = m?.[1];
    if (decimals !== undefined) return 0.5 * 10 ** -decimals.length;
    // An integer-looking claim is tolerated to half a unit, plus float noise
    // proportional to the magnitude — `20,000` may legitimately stand for
    // 20000.000000001 produced by a chain of divisions.
    return Math.max(0.5, Math.abs(magnitude) * 1e-9);
}

/** Every arithmetic chain in a piece of prose. */
export function findArithChains(prose: string): ArithChain[] {
    const out: ArithChain[] = [];
    for (const m of prose.matchAll(CHAIN)) {
        const values: { segment: string; value: number }[] = [];
        for (const segment of m[0].split('=')) {
            const value = evaluateSegment(segment);
            if (value !== null) values.push({ segment, value });
        }
        if (values.length >= 2) out.push({ text: m[0], values });
    }
    return out;
}

/**
 * Every chain whose own segments disagree.
 *
 * Each segment is compared against the FIRST evaluable one rather than against
 * its neighbour: a chain is a claim that all of its forms are the same number,
 * and comparing neighbours lets an error accumulate quietly across three steps.
 */
export function findArithDisagreements(prose: string): ArithDisagreement[] {
    const out: ArithDisagreement[] = [];
    for (const chain of findArithChains(prose)) {
        const first = chain.values[0];
        if (first === undefined) continue;
        for (const later of chain.values.slice(1)) {
            const tolerance = precisionTolerance(later.segment, first.value);
            if (Math.abs(later.value - first.value) > tolerance) {
                out.push({
                    text: chain.text,
                    leftSegment: first.segment.trim(),
                    left: first.value,
                    rightSegment: later.segment.trim(),
                    right: later.value,
                    tolerance,
                });
                break;
            }
        }
    }
    return out;
}

/**
 * Does a prose derivation ever state the declared value?
 *
 * Returns `null` when the prose carries no evaluable chain at all — an absent
 * derivation is not a disagreement, and treating it as one would make the
 * check fire on every fixture that simply cites a source instead.
 */
export function chainSupportsExpected(
    prose: string,
    expected: number,
    tolerance: number,
): boolean | null {
    const chains = findArithChains(prose);
    if (chains.length === 0) return null;
    for (const chain of chains) {
        for (const v of chain.values) {
            const tol = Math.max(tolerance, precisionTolerance(v.segment, expected));
            if (Math.abs(v.value - expected) <= tol) return true;
            if (sameMantissa(v.value, expected, tol)) return true;
        }
    }
    return false;
}

/**
 * Do two numbers agree once a UNIT SCALE is allowed?
 *
 * A measured false positive is what this exists for, not a hypothetical: a
 * fixture derives `4,200,000,000 x 0.006 = 25,200,000 = $25.2M` and declares
 * `expected: 25.2`, because the scenario asks for the figure "in $M". The
 * derivation works in dollars and the expectation in millions. Nothing in the
 * file states the unit in a machine-readable way, so demanding exact agreement
 * reports a correct fixture as broken.
 *
 * **The weakening this accepts, stated rather than buried.** A real defect that
 * happens to be a pure power of ten away — `0.85` written where `8.5` is meant —
 * is no longer caught by THIS check. It is a narrow hole: a transcription or
 * arithmetic error almost always changes the digit sequence, and the
 * self-consistency check above still reads the derivation on its own terms,
 * where no scale tolerance applies at all. The alternative was worse: a check
 * that fires on every unit-scaled fixture is a check that gets suppressed.
 *
 * Bounded to 10^±12 so an unrelated number cannot be dragged into agreement by
 * an arbitrarily large exponent.
 */
function sameMantissa(a: number, b: number, tolerance: number): boolean {
    if (a === 0 || b === 0) return false;
    const ratio = Math.abs(a / b);
    const exp = Math.round(Math.log10(ratio));
    if (!Number.isFinite(exp) || Math.abs(exp) > 12 || exp === 0) return false;
    const scaled = a / 10 ** exp;
    return Math.abs(scaled - b) <= Math.max(tolerance, Math.abs(b) * 1e-9);
}

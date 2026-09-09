/**
 * Value reconciliation between a provided design artifact and a project's own
 * tokens — the MEASUREMENT half, shipped; the BEHAVIOURAL half, deliberately
 * not.
 *
 * WHAT THE COUNCIL DECIDED, and why this module is shaped this way.
 *
 * `road-to-design-intent-conformance` put `blocker: approximation-tolerance` to
 * the AI council (anthropic + openai, 2/2, 2026-09-09). Neither member accepted
 * any of the three options as written. Both split step 3.2 the same way: build
 * the metric, the collection and the reporting now; ship **no tolerance
 * constant at all**; defer the behaviour that would let a value change without
 * being asked about.
 *
 * The argument that decided it, and it is the one to re-read before adding a
 * number here: *"a number in a config file, even flagged unmeasured, shapes
 * behaviour and creates path dependency."* Zero of seven design-to-code
 * benchmarks in the evidence set score token conformance, so a shipped
 * threshold would be a guess acquiring the authority of a default. Both
 * `design.tolerance.*` keys therefore ship `null`, and `null` means **preserve
 * and report**, never "reconcile freely".
 *
 * THE METRIC IS A PREREQUISITE the roadmap never named.
 *
 * The council added it: no colour tolerance is meaningful before the distance
 * METHOD is fixed, because RGB Euclidean, ΔE LAB, CIEDE2000 and OKLab/ΔEOK give
 * different numbers for the same pair. `openai` rejected the round's proposed
 * `±5 per RGB channel` on exactly this ground — RGB channel distance is not
 * perceptually uniform, so "likely imperceptible" is an unsupported conclusion.
 *
 * This module fixes the method as **OKLab ΔEOK** (a plain Euclidean distance in
 * OKLab, the metric OKLab was designed to make meaningful) and leaves the
 * threshold empty. Method without threshold is the honest state: the distance
 * on every row is a real, comparable number, and nothing yet says which
 * distances are small enough to act on.
 *
 * LENGTH CARRIES NO SHIPPED NUMBER either.
 *
 * Primer's spacing plugin widens each token's accepted set by ±1px and
 * autofixes. That is the one real measurement in the evidence set and it is
 * recorded as an **externally observed candidate**, not adopted:
 * `OBSERVED_LENGTH_CANDIDATE_PX` exists to be cited, and no code path reads it
 * as a threshold. The round's other proposal, `max(1px, 2%)`, was rejected for
 * growing steadily more permissive at large dimensions with no evidence that
 * this is wanted.
 *
 * EVERY ROW CARRIES ITS DISTANCE, even when the value is preserved.
 *
 * That is the step's own verify clause and it is the property that makes the
 * deferred half decidable later: a shadow window over rows that report
 * distances can produce a distribution, where a window over rows that report
 * only "kept" or "changed" cannot.
 */

/** Fixed method. See the header: the threshold is absent, the metric is not. */
export const COLOR_DISTANCE_METRIC = 'oklab-deltaEOK' as const;
/** Fixed method for lengths: absolute difference in CSS pixels. */
export const LENGTH_DISTANCE_METRIC = 'abs-px' as const;

/**
 * GitHub Primer's spacing plugin widens each token's accepted set by ±1px.
 * Recorded as an externally observed candidate for a future threshold; **no
 * code path reads this as one**, and a test pins that it never becomes the
 * shipped default without a decision.
 */
export const OBSERVED_LENGTH_CANDIDATE_PX = 1;

export interface ToleranceConfig {
    /** Master switch. Ships `false`; `blocker: fidelity-default-flip` → (a). */
    enabled: boolean;
    /** ΔEOK below which a colour may be reconciled. `null` ships. */
    color: number | null;
    /** Pixels below which a length may be reconciled. `null` ships. */
    length: number | null;
}

/** The shipped configuration. Both thresholds absent, mechanism off. */
export const SHIPPED_TOLERANCE: ToleranceConfig = { enabled: false, color: null, length: null };

export type ReconcileOutcome =
    /** Inside tolerance: the project token wins, and the change is reported. */
    | 'reconciled'
    /** Outside tolerance: the artifact's value is preserved, gap reported. */
    | 'preserved-outside-tolerance'
    /** The mechanism is off, or no threshold is configured: preserve, report. */
    | 'preserved-mechanism-off'
    /** No project token to compare against: nothing to reconcile onto. */
    | 'no-candidate';

export interface TokenCandidate {
    name: string;
    value: string;
}

export interface ValueRow {
    /** The artifact's own value, verbatim. */
    artifact: string;
    /** Nearest project token, or null when the project has none of this kind. */
    nearest: TokenCandidate | null;
    /** Distance to `nearest` in the metric named below. Null iff no candidate. */
    distance: number | null;
    metric: typeof COLOR_DISTANCE_METRIC | typeof LENGTH_DISTANCE_METRIC | null;
    /** The value actually written. Equals `artifact` unless reconciled. */
    resolved: string;
    outcome: ReconcileOutcome;
}

// ------------------------------------------------------------------ colour

interface Rgb {
    r: number;
    g: number;
    b: number;
}

/**
 * `#rgb` / `#rrggbb` → 0–1 channels, or null when unparseable.
 *
 * An 8-digit `#rrggbbaa` returns NULL rather than its opaque prefix. ΔEOK is a
 * three-channel metric and has nothing to say about alpha, so truncating made
 * `#ff000080` and `#ff0000` measure distance 0 — "identical" for two values a
 * designer chose to differ. Found by a blind review. Null is the honest answer:
 * the row is reported as unmeasured, which is what it is.
 */
export function parseHex(value: string): Rgb | null {
    const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());
    if (!m) return null;
    let hex = m[1] as string;
    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((c) => c + c)
            .join('');
    }
    return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
    };
}

/** sRGB transfer function, inverted — required before the OKLab matrices. */
function toLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB → OKLab (Björn Ottosson's published matrices). */
export function srgbToOklab(rgb: Rgb): { L: number; a: number; b: number } {
    const r = toLinear(rgb.r);
    const g = toLinear(rgb.g);
    const b = toLinear(rgb.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return {
        L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    };
}

/**
 * ΔEOK — Euclidean distance in OKLab. Null when either value is not a hex
 * colour this module can parse; an unparseable value is reported as unmeasured
 * rather than assigned a distance of zero, which would read as "identical".
 */
export function deltaEOK(a: string, b: string): number | null {
    const ra = parseHex(a);
    const rb = parseHex(b);
    if (!ra || !rb) return null;
    const la = srgbToOklab(ra);
    const lb = srgbToOklab(rb);
    return Math.sqrt((la.L - lb.L) ** 2 + (la.a - lb.a) ** 2 + (la.b - lb.b) ** 2);
}

// ------------------------------------------------------------------ length

/** `16px` / `1rem` / `0.5rem` → pixels at a 16px root, or null. */
export function parseLengthPx(value: string, rootPx = 16): number | null {
    const m = /^(-?\d*\.?\d+)(px|rem|em)$/.exec(value.trim());
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    return m[2] === 'px' ? n : n * rootPx;
}

/** Absolute pixel difference, or null when either side is unparseable. */
export function lengthDistancePx(a: string, b: string, rootPx = 16): number | null {
    const pa = parseLengthPx(a, rootPx);
    const pb = parseLengthPx(b, rootPx);
    if (pa === null || pb === null) return null;
    return Math.abs(pa - pb);
}

// ------------------------------------------------------------- reconcile

export type ValueKind = 'color' | 'length';

function distanceFor(kind: ValueKind, a: string, b: string): number | null {
    return kind === 'color' ? deltaEOK(a, b) : lengthDistancePx(a, b);
}

/** Nearest candidate by the kind's own metric. Ties break on first-listed. */
export function nearestToken(
    kind: ValueKind,
    artifact: string,
    candidates: readonly TokenCandidate[],
): { candidate: TokenCandidate; distance: number } | null {
    let best: { candidate: TokenCandidate; distance: number } | null = null;
    for (const candidate of candidates) {
        const d = distanceFor(kind, artifact, candidate.value);
        if (d === null) continue;
        if (best === null || d < best.distance) best = { candidate, distance: d };
    }
    return best;
}

/**
 * Reconcile one artifact value against the project's tokens.
 *
 * **The distance is computed and reported on every path**, including every path
 * that preserves the artifact's value — that is the step's verify clause, and
 * it is what makes a later shadow distribution possible.
 */
export function reconcileValue(
    kind: ValueKind,
    artifact: string,
    candidates: readonly TokenCandidate[],
    config: ToleranceConfig = SHIPPED_TOLERANCE,
): ValueRow {
    const metric = kind === 'color' ? COLOR_DISTANCE_METRIC : LENGTH_DISTANCE_METRIC;
    const best = nearestToken(kind, artifact, candidates);

    if (best === null) {
        return {
            artifact,
            nearest: null,
            distance: null,
            metric: null,
            resolved: artifact,
            outcome: 'no-candidate',
        };
    }

    const base = {
        artifact,
        nearest: best.candidate,
        distance: best.distance,
        metric,
    } as const;

    const threshold = kind === 'color' ? config.color : config.length;

    // Off, or no threshold configured. These are ONE outcome on purpose: a
    // mechanism with no threshold cannot act, so reporting it as anything but
    // "off" would imply a decision nobody made.
    if (!config.enabled || threshold === null) {
        return { ...base, resolved: artifact, outcome: 'preserved-mechanism-off' };
    }

    if (best.distance <= threshold) {
        return { ...base, resolved: best.candidate.value, outcome: 'reconciled' };
    }
    return { ...base, resolved: artifact, outcome: 'preserved-outside-tolerance' };
}

/** One human-readable row. Always names the distance, never only the verdict. */
export function formatRow(row: ValueRow): string {
    if (row.nearest === null || row.distance === null) {
        return `${row.artifact} → kept (no project token of this kind to compare against)`;
    }
    const d = `${row.metric ?? '?'} ${row.distance.toFixed(4)}`;
    switch (row.outcome) {
        case 'reconciled':
            return `${row.artifact} → ${row.nearest.name} (${row.nearest.value}); reconciled, distance ${d}`;
        case 'preserved-outside-tolerance':
            return `${row.artifact} → kept; nearest ${row.nearest.name} (${row.nearest.value}) is outside tolerance, distance ${d}`;
        default:
            return `${row.artifact} → kept; nearest ${row.nearest.name} (${row.nearest.value}), distance ${d} (reconciliation off)`;
    }
}

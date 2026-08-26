/**
 * Paired verdicts decided by DIRECTION, never by magnitude.
 *
 * `road-to-skill-ecosystem-eval-integrity` Phase 2. The defect this replaces was
 * proved by exhaustive comparison rather than argued: weighting a paired
 * confidence interval by per-trial magnitude disagrees with the exact test on
 * twelve records up to ten trials, and it is the PERMISSIVE side in every one of
 * them. The visible symptom is the opposite of what "permissive" suggests, which
 * is why it went unnoticed — an artifact that won every trial still failed five
 * consecutive runs, because a handful of large opposite-direction deltas
 * outweighed a clean sweep of small ones.
 *
 * The fix is not a better interval. It is to stop asking the question magnitude
 * answers. A paired comparison asks *did this help more often than it hurt*, and
 * the exact test for that reads the DISCORDANT trials only: a pair where both
 * arms tie carries no information about direction and must not dilute the count.
 *
 * ── What magnitude is still for ─────────────────────────────────────────────
 * Triage, and nothing else. {@link PairedVerdict.magnitude_mean} is retained and
 * reported so a human can see whether a directional win is worth anything, and
 * every renderer that prints it must say it decides nothing. A number in a
 * report with no stated role gets read as a criterion by the next person.
 */

/** The four outcomes. `underpowered` is deliberately not a kind of pass. */
export type PairedVerdictKind = 'pass' | 'regression' | 'no-change' | 'underpowered';

export interface PairedVerdict {
    kind: PairedVerdictKind;
    /** Trials where the arms differed. Concordant pairs are excluded by design. */
    discordant: number;
    /** Discordant trials favouring the treatment. */
    wins: number;
    /** Discordant trials favouring the control. */
    losses: number;
    /** One-sided exact p in the observed direction. */
    p: number;
    /** Mean signed delta over ALL trials. Triage only — decides nothing. */
    magnitude_mean: number | null;
    /** True when `discordant` sits exactly on the derived floor. */
    at_floor: boolean;
    /** Why this verdict, in one sentence a report can print verbatim. */
    reason: string;
}

/**
 * Significance level. 0.05 is the convention every sibling gate in this tree
 * already applies (`bench_ab_size_claim.ALPHA`), and changing it here would make
 * two verdicts in one report answer to different bars.
 */
export const ALPHA = 0.05;

/**
 * Minimum discordant trials, DERIVED from the test rather than chosen.
 *
 * The one-sided exact sign test over `n` discordant trials has a smallest
 * attainable p of `0.5 ** n` — the probability of a perfect sweep. A pass at
 * `ALPHA` is therefore arithmetically impossible until `0.5 ** n <= ALPHA`:
 *
 *   n=1 → 0.5      n=2 → 0.25     n=3 → 0.125
 *   n=4 → 0.0625   n=5 → 0.03125  ← first n that can clear 0.05
 *
 * So the floor is **5**, and it is a fact about the test, not a preference. A
 * specification with fewer discordant trials cannot pass however good the
 * artifact is, which is why {@link decidePairedVerdict} returns `underpowered`
 * there instead of `no-change`: the two look identical in a table and have
 * opposite remedies — one says run more trials, the other says stop.
 *
 * Recomputed by {@link deriveMinDiscordant} rather than hardcoded, so a future
 * change to ALPHA moves the floor with it instead of leaving a stale constant.
 */
export function deriveMinDiscordant(alpha: number = ALPHA): number {
    let n = 1;
    while (0.5 ** n > alpha && n < 64) n += 1;
    return n;
}

export const MIN_DISCORDANT = deriveMinDiscordant();

/** Binomial coefficient, exact via BigInt so large n cannot drift. */
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

/**
 * One-sided exact sign test over discordant trials.
 *
 * `P(X >= wins)` under a fair coin on `discordant` trials — the probability of
 * seeing at least this many wins if direction were noise. One-sided because the
 * question a verdict asks is directional: *is the treatment better*, not *do the
 * arms differ*. A two-sided p answers the second and is twice as hard to clear
 * for the first, which is a bar nobody chose.
 */
export function exactOneSidedP(wins: number, discordant: number): number {
    if (discordant <= 0) return 1;
    let tail = 0;
    for (let i = wins; i <= discordant; i += 1) tail += comb(discordant, i);
    return Math.min(1, tail * 0.5 ** discordant);
}

export interface PairedInput {
    /** One signed delta per trial. Positive favours the treatment. */
    deltas: readonly number[];
    /** Deltas within this of zero are ties and are excluded as concordant. */
    tieEpsilon?: number;
    alpha?: number;
}

/**
 * Decide a paired comparison from direction alone.
 *
 * Ties are dropped BEFORE anything is counted, which is the half a
 * magnitude-weighted interval gets wrong: a tie has zero magnitude, so it
 * contributes nothing to the mean while still inflating `n` and narrowing the
 * interval. Dropping it makes the sample honest about how much evidence there
 * actually is.
 */
export function decidePairedVerdict(input: PairedInput): PairedVerdict {
    const alpha = input.alpha ?? ALPHA;
    const eps = input.tieEpsilon ?? 0;
    const floor = deriveMinDiscordant(alpha);
    const wins = input.deltas.filter((d) => d > eps).length;
    const losses = input.deltas.filter((d) => d < -eps).length;
    const discordant = wins + losses;
    const magnitude_mean =
        input.deltas.length === 0
            ? null
            : input.deltas.reduce((a, b) => a + b, 0) / input.deltas.length;
    const at_floor = discordant === floor;

    if (discordant < floor) {
        return {
            kind: 'underpowered',
            discordant,
            wins,
            losses,
            p: 1,
            magnitude_mean,
            at_floor: false,
            reason:
                `${String(discordant)} discordant trial(s) is below the derived floor of ` +
                `${String(floor)}: the smallest attainable one-sided p is ${(0.5 ** discordant).toFixed(4)}, ` +
                `so no result here can clear ${String(alpha)}. This is NOT a null result — it is an ` +
                'absent measurement, and it belongs in no pass-rate denominator.',
        };
    }

    const favoured = wins >= losses ? wins : losses;
    const p = exactOneSidedP(favoured, discordant);
    if (p > alpha) {
        return {
            kind: 'no-change',
            discordant,
            wins,
            losses,
            p,
            magnitude_mean,
            at_floor,
            reason:
                `${String(wins)}/${String(discordant)} discordant trials favour the treatment ` +
                `(one-sided exact p=${p.toFixed(4)}); the direction is not distinguishable from noise at ${String(alpha)}.`,
        };
    }
    return {
        kind: wins >= losses ? 'pass' : 'regression',
        discordant,
        wins,
        losses,
        p,
        magnitude_mean,
        at_floor,
        reason:
            `${String(wins)}/${String(discordant)} discordant trials favour the ` +
            `${wins >= losses ? 'treatment' : 'control'} (one-sided exact p=${p.toFixed(4)}).`,
    };
}

/**
 * The warning a specification earns by sitting EXACTLY on the derived floor.
 *
 * At the floor, `0.5 ** n` equals or barely clears alpha, so a pass requires a
 * PERFECT sweep — one trial going the other way makes the result arithmetically
 * unreachable before the run starts. That is a specification defect rather than
 * a result, and it is invisible in the output: the run simply fails. Observed as
 * five specifications raised to exactly the floor all failing, four of them
 * decided before the run began.
 *
 * Returns `null` when there is nothing to warn about, so a caller can print it
 * unconditionally.
 */
export function floorWarning(v: PairedVerdict, alpha: number = ALPHA): string | null {
    if (!v.at_floor) return null;
    return (
        `specification sits exactly on the derived discordant floor (${String(v.discordant)}): ` +
        `a pass needs every trial to agree, because one dissent moves p to ` +
        `${exactOneSidedP(v.discordant - 1, v.discordant).toFixed(4)} against a bar of ${String(alpha)}. ` +
        'Raise the trial count rather than the expectation.'
    );
}

/**
 * Pass rate over a set of verdicts, with `underpowered` excluded.
 *
 * Exported as the ONLY sanctioned way to compute one, because the exclusion is
 * the whole point and an inline `filter(v => v.kind === 'pass').length / all.length`
 * silently reinstates the defect. Returns `null` when nothing is decidable —
 * a rate over an empty denominator is a fabricated number, not a zero.
 */
export function passRate(verdicts: readonly PairedVerdict[]): { rate: number; decided: number; excluded: number } | null {
    const decidable = verdicts.filter((v) => v.kind !== 'underpowered');
    const excluded = verdicts.length - decidable.length;
    if (decidable.length === 0) return null;
    return {
        rate: decidable.filter((v) => v.kind === 'pass').length / decidable.length,
        decided: decidable.length,
        excluded,
    };
}

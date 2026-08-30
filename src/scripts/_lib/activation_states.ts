/**
 * The five states a per-asset outcome can occupy, and why three would not do.
 *
 * A per-asset "win rate" computed over two states — worked / did not work —
 * is uninterpretable, and the failure is not cosmetic. Take a skill whose
 * content is excellent and which the router never activates. Its success rate
 * is low. Every fix that number suggests is a change to the skill, and every
 * one of them would improve nothing, because the skill was never reached. The
 * split below is what makes the number point at the right layer.
 *
 * Three rungs are observed independently:
 *
 *   available -> was the asset present in this install at all?
 *   activated -> did the router/agent actually load it for this task?
 *   followed  -> did the work that followed conform to what it said?
 *
 * Each rung is `true`, `false`, or `null` for "not observed". `null` is not a
 * pessimistic `false`: an unobserved rung means the instrument did not see,
 * which is a statement about the instrument. Collapsing it into either
 * direction manufactures a signal, so `classify` returns `'unknown'` the moment
 * any rung it would need is unobserved.
 */

/** Ordered from least to most engaged. `unknown` is not on that ladder. */
export const ACTIVATION_STATES = [
    /** The asset is not present in this install. Nothing about its quality follows. */
    'not-available',
    /** Present, and the router never loaded it. A content fix cannot help this case. */
    'available-not-activated',
    /** Loaded, and the work did not conform to it. This is the case a content or clarity fix addresses. */
    'activated-not-followed',
    /** Loaded and conformed to. The only state that may count toward a win rate. */
    'activated-followed',
    /**
     * At least one rung was not observed. Reported as its own share, never
     * folded into a success or a failure — a report that hides its own blind
     * spot is worse than one that has none, because the reader cannot see the
     * hole.
     */
    'unknown',
] as const;

export type ActivationState = (typeof ACTIVATION_STATES)[number];

export function isActivationState(v: unknown): v is ActivationState {
    return typeof v === 'string' && (ACTIVATION_STATES as readonly string[]).includes(v);
}

/** One observation per rung. `null` means "not observed", never "no". */
export interface ActivationObservation {
    available: boolean | null;
    activated: boolean | null;
    followed: boolean | null;
}

/**
 * Classify one observation.
 *
 * The short-circuits are deliberate and are the reason this is a function
 * rather than a lookup table: once `available` is observed `false`, the other
 * two rungs are IRRELEVANT rather than unknown — an absent asset cannot have
 * been activated — so an unobserved `followed` must not drag the answer to
 * `'unknown'`. The same holds one rung down for `activated: false`.
 *
 * Everywhere else an unobserved rung wins, because the alternative is to invent
 * the observation.
 */
export function classify(obs: ActivationObservation): ActivationState {
    if (obs.available === null) return 'unknown';
    if (obs.available === false) return 'not-available';

    if (obs.activated === null) return 'unknown';
    if (obs.activated === false) return 'available-not-activated';

    if (obs.followed === null) return 'unknown';
    return obs.followed ? 'activated-followed' : 'activated-not-followed';
}

/**
 * True for the states that may enter a win-rate denominator.
 *
 * `unknown` is excluded because it is not an outcome, and `not-available` is
 * excluded because it is not a fact about the asset's quality. Exported so a
 * report cannot quietly choose a different denominator per column.
 */
export function countsTowardWinRate(state: ActivationState): boolean {
    return state === 'activated-followed' || state === 'activated-not-followed';
}

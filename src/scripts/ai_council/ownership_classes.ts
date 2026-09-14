/**
 * The ownership axis of `decision_resolution` (ADR-268 § 10).
 *
 * A separate module rather than more constants in `config.ts`, for two
 * reasons. That file is 700+ lines over the source ceiling already, so every
 * line added there moves a ratchet; and these sets are read by the loader AND
 * by the roadmap-side gate, which has no business importing the council's
 * whole schema to learn eight class names.
 *
 * The axis changes from IMPACT to OWNERSHIP: a technical decision does not
 * become owner-owned because it is hard or high-impact. The five impact names
 * stay accepted for one minor so no installed `.ai-council.yml` fails to load,
 * and they keep their own (impact-axis) Iron Law — they are deliberately NOT
 * in this module.
 */

/** The eight ownership classes, in table order. */
export const OWNERSHIP_CLASSES: readonly string[] = [
    'deterministic',
    'reversible-technical',
    'contested-technical',
    'critical-technical',
    'product-owned',
    'business-owned',
    'destructive-owned',
    'spend-exhaustion',
];

/**
 * Iron Law: ONLY these three are locked to `user`. `critical-technical` is
 * deliberately absent — locking it is the § 0 break ADR-268 names by hand
 * ("routing a technical decision to the owner because it is hard or
 * high-impact"), so the absence is load-bearing rather than an oversight.
 */
export const OWNER_LOCKED_CLASSES: ReadonlySet<string> = new Set([
    'product-owned',
    'business-owned',
    'destructive-owned',
]);

/**
 * Iron Law: `spend-exhaustion` PAUSES AND REPORTS (ADR-268 § 8). It is never
 * routed to the owner as a question, so `mode: user` on it is a hard schema
 * error rather than an unusual-but-legal setting.
 */
export const NEVER_OWNER_CLASSES: ReadonlySet<string> = new Set(['spend-exhaustion']);

/**
 * Both owner-routed sets as one, given the impact axis's own locked set.
 *
 * A function rather than a constant because the impact half lives in the
 * loader: importing it here would make this module depend on the schema it is
 * imported BY, which is the cycle the split exists to avoid.
 */
export function allOwnerLocked(impactLocked: ReadonlySet<string>): ReadonlySet<string> {
    return new Set<string>([...impactLocked, ...OWNER_LOCKED_CLASSES]);
}

/**
 * Default `mode` per class, BOTH axes — the resolver column of each table.
 *
 * The five impact rows moved here with the eight ownership ones so there is
 * exactly one place a reader asks "what does this class do when nobody
 * configured it", rather than one map per axis drifting against the other.
 */
export const DEFAULT_RESOLUTION_MODES: Readonly<Record<string, string>> = {
    trivial: 'agent',
    low_impact: 'agent',
    medium_impact: 'council',
    high_impact: 'user',
    user_required: 'user',
    deterministic: 'agent',
    'reversible-technical': 'agent',
    'contested-technical': 'council',
    'critical-technical': 'council',
    'product-owned': 'user',
    'business-owned': 'user',
    'destructive-owned': 'user',
    'spend-exhaustion': 'agent',
};

/** The default `mode` for a class, or `agent` for a name neither axis knows. */
export function defaultModeFor(cls: string): string {
    return DEFAULT_RESOLUTION_MODES[cls] ?? 'agent';
}

/**
 * The ownership axis's mode check, as one function.
 *
 * Both Iron Laws live here rather than at the call site so the loader carries
 * three lines instead of twenty-four — and so a reader looking for "which
 * classes are locked" finds the rule next to the sets it reads.
 *
 * Returns the error message, or `null` when the mode is legal. `repr` is the
 * caller's own value formatter, so the message reads identically to every
 * other schema error in the loader.
 */
export function ownershipModeError(
    cls: string,
    mode: string,
    repr: (v: unknown) => string,
): string | null {
    if (OWNER_LOCKED_CLASSES.has(cls) && mode !== 'user') {
        return (
            `decision_resolution.classes.${cls}.mode=${repr(mode)}: ` +
            `class \`${cls}\` is LOCKED to \`user\` (Iron Law) — product, business and ` +
            `destructive decisions are owner-owned and never resolve on a model.`
        );
    }
    if (NEVER_OWNER_CLASSES.has(cls) && mode === 'user') {
        return (
            `decision_resolution.classes.${cls}.mode=${repr(mode)}: ` +
            `class \`${cls}\` is never owner-routed (Iron Law) — spend exhaustion ` +
            `pauses and reports, it does not ask.`
        );
    }
    return null;
}

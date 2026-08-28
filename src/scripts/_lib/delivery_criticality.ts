/**
 * The fail-closed delivery ladder (`road-to-runtime-context-floors` step 2.3).
 *
 * An obligation moved out of the always-loaded prefix onto a runtime carrier is
 * cheaper and can be MISSING. This module is the single encoding of what happens
 * then; the prose lives in `docs/contracts/resident-process-floors.md` § 3 and
 * the wire shape in `src/scripts/schemas/delivery-manifest.schema.json`.
 *
 * Three values, not a boolean, because "may this migrate" and "what if the
 * carrier is down" are different questions and collapsing them loses the middle
 * case that matters:
 *
 *   critical-A  never migrates; stays in standing context
 *   critical-B  may migrate; carrier down ⇒ delivered EAGERLY, never dropped
 *   standard    may migrate; carrier down ⇒ may fail open
 *
 * THE DEFAULT IS `critical-B`. An obligation whose class nobody declared is one
 * nobody classified, and the cheap reading of an unclassified obligation must not
 * be "droppable" — that is the same fail-closed choice
 * `check_prefix_stable_mutation` makes for an undecidable write target.
 */

export const DELIVERY_CRITICALITY = ['critical-A', 'critical-B', 'standard'] as const;
export type DeliveryCriticality = (typeof DELIVERY_CRITICALITY)[number];

/** What nobody declared. Deliberately the middle rung, never the cheap one. */
export const DEFAULT_CRITICALITY: DeliveryCriticality = 'critical-B';

export interface DeliveryEntry {
    /** Logical obligation id — the rule, gate or floor being delivered. */
    id: string;
    /** Omitted ⇒ {@link DEFAULT_CRITICALITY}. */
    criticality?: DeliveryCriticality;
    /** The runtime carrier that would deliver it. */
    carrier?: string;
}

export type DeliveryOutcome =
    /** Never left standing context; the carrier is irrelevant to it. */
    | 'standing'
    /** The carrier delivered it. */
    | 'carrier'
    /** The carrier is unavailable and the obligation was delivered the expensive way. */
    | 'eager-fallback'
    /** The carrier is unavailable and the obligation may be omitted. */
    | 'fail-open';

export interface DeliveryDecision {
    id: string;
    criticality: DeliveryCriticality;
    /** True when the value was defaulted rather than declared. */
    defaulted: boolean;
    outcome: DeliveryOutcome;
    reason: string;
}

export function isDeliveryCriticality(v: unknown): v is DeliveryCriticality {
    return typeof v === 'string' && (DELIVERY_CRITICALITY as readonly string[]).includes(v);
}

/**
 * Resolve one obligation against carrier availability.
 *
 * An UNRECOGNISED declared value is not honoured and does not throw: it
 * defaults, exactly as an omitted one does. A typo must not be able to buy a
 * weaker rung than the default — which is the direction a throw would also
 * prevent, but a throw would take the whole delivery down with it, and losing
 * every obligation to protect one is the wrong trade.
 */
export function resolveDelivery(entry: DeliveryEntry, carrierAvailable: boolean): DeliveryDecision {
    const declared = entry.criticality;
    const known = isDeliveryCriticality(declared);
    const criticality: DeliveryCriticality = known ? declared : DEFAULT_CRITICALITY;
    const defaulted = !known;

    if (criticality === 'critical-A') {
        return {
            id: entry.id,
            criticality,
            defaulted,
            outcome: 'standing',
            reason: 'critical-A never migrates off standing context, so carrier availability cannot reach it',
        };
    }
    if (carrierAvailable) {
        return {
            id: entry.id,
            criticality,
            defaulted,
            outcome: 'carrier',
            reason: `delivered by carrier ${entry.carrier ?? '(unnamed)'}`,
        };
    }
    if (criticality === 'critical-B') {
        return {
            id: entry.id,
            criticality,
            defaulted,
            outcome: 'eager-fallback',
            reason:
                `carrier ${entry.carrier ?? '(unnamed)'} is unavailable and this obligation is critical-B` +
                (defaulted ? ' by default (its class was not declared)' : '') +
                ' — delivered eagerly rather than dropped',
        };
    }
    return {
        id: entry.id,
        criticality,
        defaulted,
        outcome: 'fail-open',
        reason: `carrier ${entry.carrier ?? '(unnamed)'} is unavailable and this obligation is standard — may fail open`,
    };
}

/** Resolve a whole manifest. Order is preserved so a report reads deterministically. */
export function resolveDeliveryManifest(
    entries: readonly DeliveryEntry[],
    carrierAvailable: boolean,
): DeliveryDecision[] {
    return entries.map((e) => resolveDelivery(e, carrierAvailable));
}

/** The obligations a carrier failure must NOT silently drop. */
export function droppedObligations(decisions: readonly DeliveryDecision[]): DeliveryDecision[] {
    return decisions.filter((d) => d.outcome === 'fail-open');
}

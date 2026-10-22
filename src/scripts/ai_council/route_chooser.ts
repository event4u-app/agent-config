/**
 * Which route serves one rung-0.5 call. Replaces "the first configured member":
 * list order says nothing about cost, content ceiling, quota or liveness.
 *
 * Order: an admissible unpaid route, else a paid fallback, else an honest ∅.
 * Head-only work (plan, decide, chair, final review, anything that writes) is
 * refused here before any candidate is looked at, and an untyped ask may only
 * use a paid route: a free hand is defined by its typed, schema-checked return.
 */

import type { ExternalAIClient } from './clients.js';
import { admitsContent, classifyContentClass, DEFAULT_SEAT_CEILING, type ContentClass } from './content_ceiling.js';
import {
    isHeadOnlyKind,
    isUnpaid,
    ROUTE_BILLINGS,
    type HandKind,
    type HeadOnlyKind,
    type RouteBilling,
} from '../_lib/hand_kinds.js';

export { isUnpaid, ROUTE_BILLINGS, type RouteBilling };

/** The route shape the chooser reads; built from a council member by {@link routeCandidateFromMember}. */
export interface RouteCandidate {
    readonly name: string;
    readonly billing: RouteBilling;
    readonly ceiling: ContentClass;
    /** Calls left in the current quota window; null when unknown or unmetered. */
    readonly remainingQuota: number | null;
    readonly live: boolean;
}

export type RouteRefusalReason = 'not-live' | 'quota-exhausted' | 'content-ceiling' | 'untyped-call';

export interface RouteRefusal {
    readonly name: string;
    readonly reason: RouteRefusalReason;
}

export interface ChooseInput {
    readonly kind: HandKind | HeadOnlyKind | null;
    readonly contentClass: ContentClass;
    readonly candidates: readonly RouteCandidate[];
}

export type RouteChoice =
    | { readonly route: RouteCandidate; readonly reason: 'unpaid-route' | 'paid-fallback'; readonly refused: RouteRefusal[] }
    | { readonly route: null; readonly reason: 'head-only' | 'no-admissible-route'; readonly refused: RouteRefusal[] };

function refusalOf(c: RouteCandidate, input: ChooseInput): RouteRefusalReason | null {
    if (!c.live) return 'not-live';
    if (c.remainingQuota !== null && c.remainingQuota <= 0) return 'quota-exhausted';
    if (!admitsContent(c.ceiling, input.contentClass).admitted) return 'content-ceiling';
    if (isUnpaid(c.billing) && input.kind === null) return 'untyped-call';
    return null;
}

/** A known positive quota before an unknown one, more before less; list order breaks ties. */
function byQuota(a: RouteCandidate, b: RouteCandidate): number {
    if (a.remainingQuota === b.remainingQuota) return 0;
    if (a.remainingQuota === null) return 1;
    if (b.remainingQuota === null) return -1;
    return b.remainingQuota - a.remainingQuota;
}

export function chooseRoute(input: ChooseInput): RouteChoice {
    const refused: RouteRefusal[] = [];
    if (isHeadOnlyKind(input.kind)) return { route: null, reason: 'head-only', refused };
    const admissible: RouteCandidate[] = [];
    for (const c of input.candidates) {
        const why = refusalOf(c, input);
        if (why === null) admissible.push(c);
        else refused.push({ name: c.name, reason: why });
    }
    const unpaid = admissible.filter((c) => isUnpaid(c.billing)).sort(byQuota);
    if (unpaid[0] !== undefined) return { route: unpaid[0], reason: 'unpaid-route', refused };
    const paid = admissible.filter((c) => !isUnpaid(c.billing)).sort(byQuota);
    if (paid[0] !== undefined) return { route: paid[0], reason: 'paid-fallback', refused };
    return { route: null, reason: 'no-admissible-route', refused };
}

const _BILLINGS: ReadonlySet<string> = new Set<string>(ROUTE_BILLINGS);

/**
 * A council member as a route. Members built today carry none of the route
 * fields, so they map to a paid, project-content, live route — exactly the seat
 * they were. A member that declares `billing_class: free-quota` is pinned to
 * `public-artifact` whatever ceiling it declares: every free route stays there.
 */
export function routeCandidateFromMember(member: ExternalAIClient): RouteCandidate {
    const m = member as unknown as Record<string, unknown>;
    const name = (typeof m['name'] === 'string' && m['name']) || (typeof m['provider'] === 'string' && m['provider']) || 'unknown';
    const declared = m['billing_class'];
    const billing: RouteBilling =
        typeof declared === 'string' && _BILLINGS.has(declared)
            ? (declared as RouteBilling)
            : m['billable'] === false
              ? 'subscription'
              : 'per-token';
    // An unpaid route that names no ceiling gets the narrow one; only a member
    // that predates route fields keeps the default seat ceiling.
    const ceiling: ContentClass =
        billing === 'free-quota'
            ? 'public-artifact'
            : classifyContentClass(m['content_ceiling'], isUnpaid(billing) ? 'public-artifact' : DEFAULT_SEAT_CEILING);
    const quota = m['remaining_quota'];
    return {
        name,
        billing,
        ceiling,
        remainingQuota: typeof quota === 'number' && Number.isFinite(quota) ? quota : null,
        live: m['live'] !== false,
    };
}

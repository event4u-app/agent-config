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
import { EXPOSURE_SHARE_CAP } from './exposure_ledger.js';
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

export type RouteRefusalReason =
    | 'not-live'
    | 'quota-exhausted'
    | 'content-ceiling'
    | 'untyped-call'
    | 'kind-not-flipped'
    | 'exposure-cap'
    | 'exposure-unknown';

export interface RouteRefusal {
    readonly name: string;
    readonly reason: RouteRefusalReason;
}

export interface ChooseInput {
    readonly kind: HandKind | HeadOnlyKind | null;
    readonly contentClass: ContentClass;
    readonly candidates: readonly RouteCandidate[];
    /**
     * Each route's share of tracked files after this call; null when the share
     * cannot be computed. Absent means exposure is not tracked for this call.
     */
    readonly exposureShare?: (route: string) => number | null;
    /** Default {@link EXPOSURE_SHARE_CAP}. */
    readonly exposureCap?: number;
    /**
     * False when the kind has not cleared the shadow bars (free-hands 6.3):
     * every unpaid route is then refused. Absent keeps the chooser's own order.
     */
    readonly unpaidAllowed?: boolean;
}

export type RouteChoice =
    | { readonly route: RouteCandidate; readonly reason: 'unpaid-route' | 'paid-fallback'; readonly refused: RouteRefusal[] }
    | { readonly route: null; readonly reason: 'head-only' | 'no-admissible-route'; readonly refused: RouteRefusal[] };

function refusalOf(c: RouteCandidate, input: ChooseInput): RouteRefusalReason | null {
    if (!c.live) return 'not-live';
    if (c.remainingQuota !== null && c.remainingQuota <= 0) return 'quota-exhausted';
    if (!admitsContent(c.ceiling, input.contentClass).admitted) return 'content-ceiling';
    if (isUnpaid(c.billing) && input.kind === null) return 'untyped-call';
    if (isUnpaid(c.billing) && input.unpaidAllowed === false) return 'kind-not-flipped';
    if (input.exposureShare !== undefined) {
        const share = input.exposureShare(c.name);
        // Unknown exposure fails closed for an unpaid route only; a paid route
        // stays usable so an untracked project still has a fallback.
        if (share === null) return isUnpaid(c.billing) ? 'exposure-unknown' : null;
        if (share > (input.exposureCap ?? EXPOSURE_SHARE_CAP)) return 'exposure-cap';
    }
    return null;
}

/** A known positive quota before an unknown one, more before less; list order breaks ties. */
function byQuota(a: RouteCandidate, b: RouteCandidate): number {
    if (a.remainingQuota === b.remainingQuota) return 0;
    if (a.remainingQuota === null) return 1;
    if (b.remainingQuota === null) return -1;
    return b.remainingQuota - a.remainingQuota;
}

export interface RouteChain {
    /** Every admissible route, in the order a failed call walks them. */
    readonly chain: RouteCandidate[];
    readonly headOnly: boolean;
    readonly refused: RouteRefusal[];
}

export function chooseRouteChain(input: ChooseInput): RouteChain {
    const refused: RouteRefusal[] = [];
    if (isHeadOnlyKind(input.kind)) return { chain: [], headOnly: true, refused };
    const admissible: RouteCandidate[] = [];
    for (const c of input.candidates) {
        const why = refusalOf(c, input);
        if (why === null) admissible.push(c);
        else refused.push({ name: c.name, reason: why });
    }
    const share = (c: RouteCandidate): number => input.exposureShare?.(c.name) ?? 0;
    const order = (a: RouteCandidate, b: RouteCandidate): number => share(a) - share(b) || byQuota(a, b);
    const unpaid = admissible.filter((c) => isUnpaid(c.billing)).sort(order);
    const paid = admissible.filter((c) => !isUnpaid(c.billing)).sort(order);
    return { chain: [...unpaid, ...paid], headOnly: false, refused };
}

export function chooseRoute(input: ChooseInput): RouteChoice {
    const { chain, headOnly, refused } = chooseRouteChain(input);
    if (headOnly) return { route: null, reason: 'head-only', refused };
    const first = chain[0];
    if (first === undefined) return { route: null, reason: 'no-admissible-route', refused };
    return { route: first, reason: isUnpaid(first.billing) ? 'unpaid-route' : 'paid-fallback', refused };
}

const _BILLINGS: ReadonlySet<string> = new Set<string>(ROUTE_BILLINGS);

/**
 * A council member as a route. Members built today carry none of the route
 * fields, so they map to a paid, project-content, live route — exactly the seat
 * they were. A member whose billing is `free-quota` is pinned to
 * `public-artifact` whatever ceiling it declares: every free route stays there.
 * A `self-hosted` member that declares no ceiling gets `public-artifact` too;
 * only a declared, probed `content_ceiling` raises it.
 */
export function routeCandidateFromMember(member: ExternalAIClient): RouteCandidate {
    const m = member as unknown as Record<string, unknown>;
    const name = (typeof m['name'] === 'string' && m['name']) || (typeof m['provider'] === 'string' && m['provider']) || 'unknown';
    // A base_url route member names its class `billing`; other members may say `billing_class`.
    const declared = m['billing_class'] ?? m['billing'];
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
            : classifyContentClass(m['content_ceiling'], isUnpaid(billing) || typeof m['base_url'] === 'string' ? 'public-artifact' : DEFAULT_SEAT_CEILING);
    const quota = m['remaining_quota'];
    return {
        name,
        billing,
        ceiling,
        remainingQuota: typeof quota === 'number' && Number.isFinite(quota) ? quota : null,
        live: m['live'] !== false,
    };
}

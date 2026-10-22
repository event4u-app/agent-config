/**
 * Construct a `base_url` route member for a council pass, or say why it is
 * absent. Lives apart from `council_cli.ts`, which is far past the source
 * ceiling, and apart from `free_route.ts`, which `config.ts` imports and which
 * therefore must not import the loader back.
 */

import { resolve_project_root } from '../_lib/agent_settings.js';
import { PROVIDER_TABLE } from '../_lib/environment_detector.js';
import { resolve_api_key } from './config.js';
import { classifyContentClass, DEFAULT_SEAT_CEILING, type ContentClass } from './content_ceiling.js';
import type { ExternalAIClient } from './clients.js';
import { FreeRouteClient } from './free_route_client.js';
import { readRouteRoster, ROUTE_CATALOG } from './free_route_catalog.js';
import {
    parseRouteFields,
    resolveRouteTransport,
    routeCeiling,
    type SelfHostedProbeResult,
    type RouteBilling,
    type SelfHostedProbe,
} from './free_route.js';
import { SELF_HOSTED_PROBE, type ProbeRoute } from './self_hosted_probe.js';
import { keyResolves } from './status_surface.js';

export type RouteMemberResult =
    | { readonly client: FreeRouteClient }
    | { readonly absent: { member: string; reason: string; detail: string } };

/** `null` for a provider member; otherwise the constructed client or its absence. */
export function routeMemberFor(
    name: string,
    cfg: Record<string, unknown>,
    contentClass: ContentClass,
    modelOverride?: string,
    probe: SelfHostedProbe = SELF_HOSTED_PROBE,
    stateRoot?: string,
    now: Date = new Date(),
): RouteMemberResult | null {
    const parsed = parseRouteFields(name, cfg, Object.hasOwn(PROVIDER_TABLE, name));
    if ('error' in parsed) return { absent: { member: name, reason: 'policy_unknown', detail: parsed.error } };
    const route = parsed.route;
    if (route === null) return null;
    const model = modelOverride || (typeof cfg['model'] === 'string' ? cfg['model'] : '');
    // The root discovery writes under, so a run from a subdirectory reads the same roster.
    const gate = firstPartyGate(route.base_url, model, stateRoot ?? resolve_project_root(null)[0], now);
    if (gate !== null) return { absent: { member: name, reason: 'policy_model_mismatch', detail: gate } };
    const ref = typeof cfg['api_key_ref'] === 'string' ? cfg['api_key_ref'] : null;
    // A keyed loopback route can only be proven with its key on the probe call.
    let probed: SelfHostedProbeResult | undefined;
    const keyedProbe: SelfHostedProbe = (r, m) => {
        const withKey: ProbeRoute = { ...r, api_key_ref: ref };
        return (probed = probe(withKey, m));
    };
    const t = resolveRouteTransport({ name, route, model, contentClass, keyPresent: keyResolves(ref), probe: keyedProbe });
    if (!t.available) {
        return { absent: { member: name, reason: t.absentReason ?? 'unavailable', detail: t.reason ?? 'route unavailable' } };
    }
    return {
        client: new FreeRouteClient({
            name,
            model,
            base_url: route.base_url,
            api_key: ref === null ? null : resolve_api_key(ref, `ai_council.members.${name}`),
            billing: t.billing as RouteBilling,
            content_ceiling: routeCeiling(route, probed),
        }),
    };
}

/** A built seat carries the ceiling its config declares; a route client keeps its own. */
export function stampSeatCeilings(members: readonly ExternalAIClient[], membersCfg: Record<string, unknown>): void {
    for (const m of members) {
        const seat = m as unknown as Record<string, unknown>;
        if (m instanceof FreeRouteClient || seat['content_ceiling'] !== undefined) continue;
        const cfg = membersCfg[m.name];
        const declared = typeof cfg === 'object' && cfg !== null ? (cfg as Record<string, unknown>)['content_ceiling'] : undefined;
        seat['content_ceiling'] = classifyContentClass(declared, DEFAULT_SEAT_CEILING);
    }
}

/** A first-party roster older than this no longer says which models are first-party. */
export const FIRST_PARTY_ROSTER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * On a catalogued route whose attestation covers first-party models only, the
 * model must be in a fresh discovered first-party roster; anything else is a
 * reason to be absent, so an unknown provenance never reaches the route.
 */
function firstPartyGate(baseUrl: string, model: string, stateRoot: string, now: Date): string | null {
    const key = routeIdentity(baseUrl);
    const row = ROUTE_CATALOG.find((r) => r.first_party_list !== undefined && routeIdentity(r.base_url) === key);
    if (row === undefined) return null;
    const roster = readRouteRoster(stateRoot, row.id);
    if (roster.status !== 'known') return `${row.id}: no discovered first-party roster (${roster.reason})`;
    if (now.getTime() - Date.parse(roster.observed_at) > FIRST_PARTY_ROSTER_MAX_AGE_MS) {
        return `${row.id}: first-party roster from ${roster.observed_at} is older than a day`;
    }
    if (!roster.models.includes(model)) return `${row.id}: ${model} is not in the route's first-party roster`;
    return null;
}

/**
 * Host and path, scheme dropped: an `http` or mixed-case spelling of a
 * catalogued route is the same route to the gate, so it cannot step around it.
 */
export function routeIdentity(url: string): string {
    try {
        const u = new URL(url);
        return `${u.host}${u.pathname.replace(/\/+$/, '')}`;
    } catch {
        return url.trim().toLowerCase().replace(/\/+$/, '');
    }
}

/**
 * Construct a `base_url` route member for a council pass, or say why it is
 * absent. Lives apart from `council_cli.ts`, which is far past the source
 * ceiling, and apart from `free_route.ts`, which `config.ts` imports and which
 * therefore must not import the loader back.
 */

import { PROVIDER_TABLE } from '../_lib/environment_detector.js';
import { resolve_api_key } from './config.js';
import type { ContentClass } from './content_ceiling.js';
import { FreeRouteClient } from './free_route_client.js';
import {
    parseRouteFields,
    resolveRouteTransport,
    type RouteBilling,
    type SelfHostedProbe,
} from './free_route.js';
import { SELF_HOSTED_PROBE } from './self_hosted_probe.js';
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
): RouteMemberResult | null {
    const parsed = parseRouteFields(name, cfg, Object.hasOwn(PROVIDER_TABLE, name));
    if ('error' in parsed) return { absent: { member: name, reason: 'policy_unknown', detail: parsed.error } };
    const route = parsed.route;
    if (route === null) return null;
    const model = modelOverride || (typeof cfg['model'] === 'string' ? cfg['model'] : '');
    const ref = typeof cfg['api_key_ref'] === 'string' ? cfg['api_key_ref'] : null;
    const t = resolveRouteTransport({ name, route, model, contentClass, keyPresent: keyResolves(ref), probe });
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
        }),
    };
}

/**
 * The seat-status helpers `council:status` renders from.
 *
 * Extracted from `council_cli.ts` (road-to-admissible-council-seats 1.2/2.1):
 * that file sits ~2,460 lines past the 1,500-line ceiling
 * `check_source_size_budget` ratchets, so every line added there costs one
 * excess line. These three surfaces are what 1.2 and 2.1 grew, and they are a
 * coherent unit — "what does this package know about a seat before any call is
 * made" — rather than an arbitrary slice taken to satisfy a gate.
 *
 * Nothing here authorizes anything. `disabledSeats` reports a note the config
 * carries; `resolvedTransportFor` only ever forwards a REFUSAL input to the
 * resolver.
 */

import type { EnvironmentReport } from '../_lib/environment_detector.js';
import { detectEnvironment } from '../_lib/environment_detector.js';
import { DEFAULT_SEAT_CEILING, type ContentClass } from './content_ceiling.js';
import type { PolicyExclusion } from './seat_policy.js';
import { resolveMemberTransport } from './transport_resolver.js';

interface SeatLike {
    readonly binary: string | null;
    readonly api_key_ref: string | null;
    readonly policy_exclusion?: PolicyExclusion | null;
    readonly content_ceiling?: ContentClass;
}

interface ConfigLike {
    readonly members: ReadonlyMap<string, { readonly enabled: boolean; readonly disabled_reason: string | null }>;
}

/**
 * Resolve the concrete transport a member would use on THIS machine right now.
 *
 * `cmd_status` exists to answer "is the council reachable, and will it bill me".
 * Since the transport-mode setting was removed, the second half is not a value
 * anyone can look up in the config — it is a per-machine resolution. Printing a
 * configured mode would be the same class of stale answer the removed setting
 * produced. `mode` is pinned to `auto` because the loader no longer emits
 * anything else.
 */
export function resolvedTransportFor(
    name: string,
    member: SeatLike,
    report?: EnvironmentReport,
    contentClass?: ContentClass | null,
): ReturnType<typeof resolveMemberTransport> {
    return resolveMemberTransport({
        provider: name,
        report: report ?? detectEnvironment(),
        invocationMode: null,
        memberSettings: null,
        globalMode: 'auto',
        binaryOverride: member.binary,
        policyExclusion: member.policy_exclusion ?? null,
        seatCeiling: member.content_ceiling ?? DEFAULT_SEAT_CEILING,
        contentClass: contentClass ?? null,
    });
}

/**
 * Disabled seats and the reason each records. `NO_DISABLED_REASON` is the
 * honest rendering of an unset field: an `enabled: false` with nothing beside
 * it is a fact about the config, and hiding it is what made the seat silent.
 */
export const NO_DISABLED_REASON = 'disabled, no reason recorded';

export function disabledSeats(cfg: ConfigLike | null): Record<string, string> {
    if (cfg === null) {
        return {};
    }
    return Object.fromEntries(
        [...cfg.members.entries()]
            .filter(([, m]) => !m.enabled)
            .map(([n, m]) => [n, m.disabled_reason ?? NO_DISABLED_REASON]),
    );
}


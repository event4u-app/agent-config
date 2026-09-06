/**
 * surface — the IDE / CLI / cloud dimension of a dispatch, as an ENVELOPE
 * field rather than a platform key.
 *
 * WHY A FIELD AND NOT A PLATFORM. `_lib/session_register.ts` records that the
 * capability lattice has no IDE/CLI dimension, which is why it reports cursor
 * covered whether or not its per-turn slots fire there. Splitting `cursor`
 * into `cursor-ide` / `cursor-cli` would change `--platform`, the eight
 * platform identifiers, and every manifest row keyed on them. A field changes
 * none of those and is still the thing `host_lowering.yaml`'s `(host, surface,
 * slot)` key needs.
 *
 * WHAT THIS CAN AND CANNOT DECIDE — the honest half.
 *
 * `unknown` is the default and, today, very nearly the only answer. Nothing in
 * this tree distinguishes an IDE session from a CLI one on any host: no host
 * payload observed here carries such a marker, and inferring it from a TTY or
 * a terminal name would be a guess wearing a function's authority — the exact
 * move the surrounding roadmap exists to remove. So there is no `ide` or `cli`
 * branch. When a host is observed to send a distinguishing marker, it is added
 * to {@link CLOUD_PAYLOAD_MARKERS}'s sibling with a dated citation, and the
 * branch arrives with the evidence rather than ahead of it.
 *
 * The `cloud` branch is a DECLARED VOCABULARY, not an observation. This package
 * will honour these payload keys if a host sends one; none has been observed
 * sending one. That distinction is the point: the mechanism is real and tested,
 * the host claim is absent and says so.
 */

/** The closed surface vocabulary. `unknown` is the safe default. */
export const SURFACES = ['ide', 'cli', 'cloud', 'unknown'] as const;
export type Surface = (typeof SURFACES)[number];

/**
 * Payload keys whose truthy presence declares a background / cloud agent.
 *
 * Declared, not observed — see the module header. Kept as a list so a host that
 * starts sending one needs no code change, only a citation in this comment.
 */
export const CLOUD_PAYLOAD_MARKERS: readonly string[] = [
    'background_agent',
    'is_background',
    'isBackgroundAgent',
];

/** Explicit override, for a caller that already knows the surface. */
export const SURFACE_ENV_VAR = 'AGENT_CONFIG_SURFACE';

function _isSurface(v: unknown): v is Surface {
    return typeof v === 'string' && (SURFACES as readonly string[]).includes(v);
}

/**
 * Resolve the surface for one dispatch.
 *
 * Precedence: an explicit environment override, then a declared payload
 * marker, then `unknown`. An unrecognised override value is ignored rather
 * than trusted — a typo must not become a capability claim.
 */
export function detectSurface(
    payload: unknown,
    env: Record<string, string | undefined> = process.env,
): Surface {
    const override = env[SURFACE_ENV_VAR];
    if (_isSurface(override)) return override;

    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
        const obj = payload as Record<string, unknown>;
        for (const key of CLOUD_PAYLOAD_MARKERS) {
            if (obj[key]) return 'cloud';
        }
    }
    return 'unknown';
}

/**
 * Read a persisted or caller-supplied surface value.
 *
 * Tolerant, not a cast: an unrecognised value — a row written by a newer build,
 * a typo, an absent field — reads as `unknown`. Same posture as
 * `readRunTerminalState`, and for the same reason: a value this build cannot
 * place must not fail a write or a read.
 */
export function readSurface(v: unknown): Surface {
    return _isSurface(v) ? v : 'unknown';
}

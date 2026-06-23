/**
 * Host-capability manifest normalizer.
 *
 * Pure, no-I/O helper that takes a partial / unknown object (typically the
 * `subagents.host_capabilities` override from `.agent-settings.yml`, or the
 * agent's own host-knowledge object) and returns a fully-populated manifest.
 *
 * Contract — see `src/agent-src/contexts/execution/host-capability-manifest.md`:
 *
 * - Safe default is ALL boolean fields `false` — an unknown host is assumed to
 *   have no subagent primitive.
 * - A missing or non-boolean field resolves to `false`, never `true`.
 * - `schema_version` is always forced to `1`.
 */

/** Resolved host-capability manifest. All booleans, `schema_version` fixed at 1. */
export interface HostCapabilityManifest {
    schema_version: 1;
    subagent_spawn: boolean;
    parallel_spawn: boolean;
    status_polling: boolean;
    separate_quota_pool: boolean;
}

/** Safe default — unknown host assumes no subagent primitive. */
const SAFE_DEFAULT: HostCapabilityManifest = {
    schema_version: 1,
    subagent_spawn: false,
    parallel_spawn: false,
    status_polling: false,
    separate_quota_pool: false,
};

/** Coerce one field: only a strict boolean `true` survives; everything else is `false`. */
function asBool(value: unknown): boolean {
    return value === true;
}

/**
 * Normalize a partial / unknown object into a full {@link HostCapabilityManifest}.
 *
 * Any missing or invalidly-typed field falls back to the all-`false` safe
 * default; `schema_version` is always forced to `1`.
 */
export function normalizeHostManifest(input: unknown): HostCapabilityManifest {
    if (input === null || typeof input !== 'object') {
        return { ...SAFE_DEFAULT };
    }

    const src = input as Record<string, unknown>;

    return {
        schema_version: 1,
        subagent_spawn: asBool(src.subagent_spawn),
        parallel_spawn: asBool(src.parallel_spawn),
        status_polling: asBool(src.status_polling),
        separate_quota_pool: asBool(src.separate_quota_pool),
    };
}

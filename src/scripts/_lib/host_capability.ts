/**
 * Host-capability manifest normalizer + committed capability registry.
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
 *
 * `resolveHostCapabilities` (F5, road-to-orchestrator-discipline-carriers)
 * adds a resolution order in front of the safe default so a fresh install on
 * a KNOWN host does not ship delegation dead by default:
 *
 *   explicit `subagents.host_capabilities` override (wins, whole-object,
 *   unchanged semantics) → committed registry row for the detected host
 *   (`HOST_CAPABILITY_REGISTRY`) → `SAFE_DEFAULT` (all false).
 *
 * The registry lists only OBSERVED capabilities for a host this repo has
 * actually measured (see the roadmap's transcript evidence) — never a
 * speculative entry for a host nobody has verified.
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

/**
 * Committed registry — known host identifiers → OBSERVED capability sets.
 *
 * Keyed by the platform identifier this repo already uses for the same host
 * across the hook/dispatch layer (`--platform claude`, `platforms['claude']`
 * in `claude_settings_hooks.ts`, `TOOL_IDS` in `probe_skill_registration.ts`)
 * — NOT the separate `toolDetection.ts` binary-detection id (`'claude-code'`),
 * which names a different namespace (installed-CLI presence, not the running
 * host identity a hook/dispatch envelope carries).
 *
 * Each row is partial: an omitted field stays at the `SAFE_DEFAULT` `false`
 * when the row is applied. Claude Code is the one host this roadmap's
 * transcript evidence measured spawning and running subagents concurrently
 * (`Agent` tool dispatch, parallel tool-use blocks); polling and a separate
 * quota pool were never observed, so they stay `false` — add a field only
 * once it is itself observed, never by inference.
 */
const HOST_CAPABILITY_REGISTRY: Readonly<Record<string, Partial<HostCapabilityManifest>>> = {
    claude: { subagent_spawn: true, parallel_spawn: true },
};

/**
 * Resolve the effective host-capability manifest for `hostId`.
 *
 * Resolution order (highest wins), per
 * `host-capability-manifest.md § Resolution`:
 *
 * 1. `override` — the `subagents.host_capabilities` settings value, when
 *    present as a non-null object. Normalized exactly as {@link normalizeHostManifest}
 *    always has: a WHOLE-OBJECT override, each field independently coerced,
 *    a field absent from the override object resolves to `false`. This is
 *    the pre-existing, unchanged behavior — a present override still wins
 *    outright over the registry row, it does not merge field-by-field with it.
 * 2. The committed {@link HOST_CAPABILITY_REGISTRY} row for `hostId`, when no
 *    override is present and the host is known.
 * 3. `SAFE_DEFAULT` — unknown `hostId`, or no override and no registry row.
 *
 * `hostId` is a caller-supplied identifier (e.g. the same string a hook
 * envelope's `platform` field carries) — this function does no environment
 * probing of its own; see `host-capability-manifest.md` for why resolution
 * stays a per-session, agent/caller-supplied fact rather than a live probe.
 *
 * An array override does NOT count as present (F8, review): `typeof [] ===
 * 'object'` in JS, so a bare `typeof override === 'object'` check let a
 * stray array reach `normalizeHostManifest`, which reads named properties
 * off it (`.subagent_spawn`, …) that an array never has — every field
 * silently coerces to `false`, exactly like an explicit empty-object
 * override, even though nobody supplied one. An array is not a manifest
 * shape at all, so it is treated the same as `null`/non-object: fall
 * through to the registry row.
 */
export function resolveHostCapabilities(
    hostId: string | null | undefined,
    override?: unknown,
): HostCapabilityManifest {
    if (
        override !== undefined &&
        override !== null &&
        typeof override === 'object' &&
        !Array.isArray(override)
    ) {
        return normalizeHostManifest(override);
    }
    const row =
        hostId !== null && hostId !== undefined ? HOST_CAPABILITY_REGISTRY[hostId] : undefined;
    if (row === undefined) {
        return { ...SAFE_DEFAULT };
    }
    return { ...SAFE_DEFAULT, ...row, schema_version: 1 };
}

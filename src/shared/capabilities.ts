/**
 * Host-facing capability advertisement.
 *
 * A host that spawns `agent-config` (e.g. an orchestrator managing
 * profile-scoped configuration) needs to detect, before it relies on a
 * behaviour, whether the AC binary on `PATH` actually supports it. This
 * module is the single source of truth for that advertisement; it is
 * surfaced in two readouts a host can probe:
 *
 *   - `agent-config --version --json` — the CLI capability readout.
 *   - `GET /api/v1/ping` — the local-server status readout.
 *
 * An older AC (predating a capability) omits the flag / the whole
 * `capabilities` block, so a newer host reading `capabilities.<x> === true`
 * degrades to a clear "not supported" instead of silently breaking.
 *
 * `src/shared/**` is consumed by both the Node server and the browser UI
 * bundle, so this module stays pure — no Node built-ins, no I/O.
 */

/**
 * Named embed features this build actually ships (reciprocal-ecosystem
 * embed contract). A host reads the list to feature-detect instead of
 * version-guessing. Only shipped features appear — v1 ships `theme`
 * (the `?theme=light|dark` boot query) and `deepLink` (`#/settings` /
 * `#/settings/<section>` deep links under `?embed=1`). `accent` is a
 * v2 feature and is deliberately absent.
 */
export type EmbedFeature = 'theme' | 'deepLink';

export interface EmbedCapability {
    /** `true` when this build honours the `?embed=1` embed contract. */
    supported: boolean;
    /** Embed-contract version this build implements. */
    version: number;
    /** The embed features actually shipped by this build. */
    features: EmbedFeature[];
}

export interface Capabilities {
    /**
     * `true` when the binary accepts a host-supplied config root on spawn
     * via the `--config-root <path>` flag or the `EVENT4U_CONFIG_HOME`
     * environment variable — letting a host scope AC's config/settings/
     * state to a per-profile directory instead of the shared default.
     */
    configRoot: boolean;
    /**
     * Host-embed contract advertisement — a host reads `embed.supported`
     * + `embed.version` + `embed.features` to decide whether it can render
     * AC's settings surface inside its own window (via `?embed=1`, a
     * `?theme=` boot query, and settings deep links) before relying on it.
     */
    embed: EmbedCapability;
}

/** The capabilities this build advertises. */
export const CAPABILITIES: Capabilities = {
    configRoot: true,
    embed: { supported: true, version: 1, features: ['theme', 'deepLink'] },
};

export interface VersionReadout {
    version: string;
    capabilities: Capabilities;
}

/**
 * Build the machine-readable `--version --json` payload. Pure — the
 * caller supplies the version string it already resolved from
 * `package.json`.
 */
export function buildVersionReadout(version: string): VersionReadout {
    return { version, capabilities: { ...CAPABILITIES } };
}

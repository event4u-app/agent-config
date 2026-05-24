/**
 * Bootstrap helper — build a `TelemetryConfig` from process state plus
 * build-time constants. Returns `null` if any required value is missing
 * so the SDK stays inert.
 *
 * Build-time constants (`workerBaseUrl`, `flagsUrl`, per-channel HMAC
 * secrets) come from environment variables prefixed
 * `AGENT_CONFIG_TELEMETRY_*`. The release pipeline injects them at
 * package-publish time; when unset, the SDK is a no-op.
 *
 * Opt-in resolution:
 *   - `--telemetry-opt-in` flag → opt-in true.
 *   - `--no-telemetry` flag → opt-in false (overrides).
 *   - `AGENT_CONFIG_NO_TELEMETRY=1` env → opt-in false (overrides).
 *   - `TELEMETRY_OPT_IN=1` env (passed by caller after interactive prompt)
 *     → opt-in true.
 *   - Default → opt-in false.
 */

import { AGENT_CONFIG_VERSION } from '../version.js';
import {
    hostAgentFamilyOf,
    nodeMajorOf,
    osFamilyOf,
} from './buckets.js';
import type { EntryPath, TelemetryConfig } from './types.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 1500;

export interface BootstrapInput {
    readonly entryPath: EntryPath;
    /** Caller-resolved opt-in (e.g. from CLI flag or interactive prompt). */
    readonly optedIn: boolean;
    /** Override env source for tests. */
    readonly env?: NodeJS.ProcessEnv;
    /** Override platform detection for tests. */
    readonly platform?: NodeJS.Platform;
    /** Override Node version for tests. */
    readonly nodeVersion?: string;
}

export function buildTelemetryConfig(input: BootstrapInput): TelemetryConfig {
    const env = input.env ?? process.env;
    const platform = input.platform ?? process.platform;
    const nodeVersion = input.nodeVersion ?? process.version;

    const optedIn = resolveOptIn(input.optedIn, env);

    return {
        workerBaseUrl: env['AGENT_CONFIG_TELEMETRY_WORKER_URL'] ?? '',
        flagsUrl: env['AGENT_CONFIG_TELEMETRY_FLAGS_URL'] ?? '',
        hmacSecret: hmacSecretForEntry(input.entryPath, env),
        requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
        optedIn,
        dimensions: {
            entry_path: input.entryPath,
            host_agent_family: hostAgentFamilyOf(env['AGENT_CONFIG_HOST_AGENT']),
            os: osFamilyOf(platform),
            node_major: nodeMajorOf(nodeVersion),
            agent_config_version: AGENT_CONFIG_VERSION,
        },
    };
}

function resolveOptIn(callerOptIn: boolean, env: NodeJS.ProcessEnv): boolean {
    if (env['AGENT_CONFIG_NO_TELEMETRY'] === '1') return false;
    if (callerOptIn) return true;
    if (env['TELEMETRY_OPT_IN'] === '1') return true;
    return false;
}

function hmacSecretForEntry(entry: EntryPath, env: NodeJS.ProcessEnv): string {
    if (entry === 'npx') return env['AGENT_CONFIG_TELEMETRY_HMAC_NPX'] ?? '';
    if (entry === 'curl') return env['AGENT_CONFIG_TELEMETRY_HMAC_CURL'] ?? '';
    return env['AGENT_CONFIG_TELEMETRY_HMAC_GUI'] ?? '';
}

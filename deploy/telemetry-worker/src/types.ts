/**
 * Wire-format types for the install-funnel worker.
 *
 * Kept in sync by hand with
 * `packages/core/installer/src/telemetry/types.ts`. Cross-package type
 * import would couple the worker bundle to the installer's whole
 * dependency graph, which is unnecessary for a contract this small.
 *
 * Source of truth: `docs/distribution/telemetry-schema.md`.
 */

export const SCHEMA_VERSION = '1' as const;
export const MAX_BODY_BYTES = 4096;
export const MAX_EVENTS_PER_SESSION = 20;
export const SESSION_TTL_SECONDS = 7200; // 2 hours
export const EVENT_TTL_SECONDS = 1_209_600; // 14 days

export type TelemetryStage =
    | 'started'
    | 'wizard_opt_in_seen'
    | 'wizard_opt_in_accepted'
    | 'packs_selected'
    | 'applied'
    | 'first_command_run'
    | 'errored';

export type EntryPath = 'npx' | 'curl' | 'gui';

export type HostAgentFamily = 'vscode' | 'jetbrains' | 'cli' | 'browser' | 'unknown';

export type OsFamily = 'linux' | 'macos' | 'windows';

export type NodeMajor = '20' | '22';

export type PackCategory =
    | 'finance'
    | 'founder'
    | 'engineering'
    | 'content'
    | 'consultant'
    | 'meta'
    | 'other';

export type DurationBucket = '<30s' | '30s-2m' | '2m-10m' | '>10m';

export type ErrorClass =
    | 'network'
    | 'filesystem'
    | 'config_invalid'
    | 'dependency'
    | 'unknown';

export interface InstallStageEvent {
    readonly schema_version: typeof SCHEMA_VERSION;
    readonly event: 'install_stage';
    readonly stage: TelemetryStage;
    readonly ts: string;
    readonly session_id?: string;
    readonly entry_path: EntryPath;
    readonly host_agent_family: HostAgentFamily;
    readonly os: OsFamily;
    readonly node_major: NodeMajor;
    readonly agent_config_version: string;
    readonly pack_categories?: readonly PackCategory[];
    readonly wizard_used: boolean;
    readonly duration_bucket: DurationBucket;
    readonly error_class?: ErrorClass;
}

export interface WorkerEnv {
    readonly TELEMETRY_KV: KVNamespace;
    readonly HMAC_NPX: string;
    readonly HMAC_CURL: string;
    readonly HMAC_GUI: string;
}

/**
 * Cloudflare KV namespace surface used by the worker. The full
 * `@cloudflare/workers-types` declaration is provided at deploy time;
 * this minimal interface keeps the package source typecheckable
 * without that dependency.
 */
export interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(
        key: string,
        value: string,
        options?: { expirationTtl?: number },
    ): Promise<void>;
}

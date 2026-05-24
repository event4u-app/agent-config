/**
 * Install-funnel telemetry types.
 *
 * Wire contract: `docs/distribution/telemetry-schema.md` (schema_version: 1).
 *
 * Distinct from `telemetry.artifact_engagement` (agent-runtime skill/rule
 * usage). The two systems do not share storage, transport, or opt-in state.
 */

export type TelemetryStage =
    | 'started'
    | 'wizard_opt_in_seen'
    | 'wizard_opt_in_accepted'
    | 'packs_selected'
    | 'applied'
    | 'first_command_run'
    | 'errored';

export type EntryPath = 'npx' | 'curl' | 'gui';

export type HostAgentFamily =
    | 'vscode'
    | 'jetbrains'
    | 'cli'
    | 'browser'
    | 'unknown';

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

/** Dimensions captured once per session and replayed on every event. */
export interface SessionDimensions {
    readonly entry_path: EntryPath;
    readonly host_agent_family: HostAgentFamily;
    readonly os: OsFamily;
    readonly node_major: NodeMajor;
    readonly agent_config_version: string;
}

/** Per-event payload assembled by the SDK before the POST. */
export interface InstallStageEvent {
    readonly schema_version: '1';
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
    readonly wizard_used?: boolean;
    readonly duration_bucket?: DurationBucket;
    readonly error_class?: ErrorClass;
}

/** Feature-flag payload returned by the kill-switch endpoint. */
export interface TelemetryFlags {
    readonly enabled: boolean;
    readonly schema_version: '1';
}

/**
 * Build-time configuration. Populated by the installer entry points
 * (`cli.ts`, `gui/server.ts`) before any telemetry call. All fields are
 * required even when telemetry is off — the SDK refuses to emit if any
 * field is missing.
 */
export interface TelemetryConfig {
    /** Base URL of the Cloudflare Worker. Empty string disables the SDK. */
    readonly workerBaseUrl: string;
    /** Feature-flag JSON URL. Empty string disables the SDK. */
    readonly flagsUrl: string;
    /** Pre-shared HMAC secret for the entry path. Empty string disables the SDK. */
    readonly hmacSecret: string;
    /** Hard timeout per POST, in ms. */
    readonly requestTimeoutMs: number;
    /** Whether the consumer explicitly opted in for this session. */
    readonly optedIn: boolean;
    /** Dimensions captured once at session start. */
    readonly dimensions: SessionDimensions;
}

/**
 * Install-funnel telemetry — public API.
 *
 * Wire contract: `docs/distribution/telemetry-schema.md`.
 * Privacy doc: `docs/distribution/telemetry-privacy.md`.
 *
 * **Source-only and inert by default.** No traffic leaves the consumer
 * machine unless ALL of the following hold:
 *   1. `TelemetryConfig.workerBaseUrl` and `flagsUrl` are non-empty.
 *   2. The remote kill-switch resolves to `enabled: true`.
 *   3. The consumer explicitly opted in (`optedIn: true`).
 *
 * The opt-in choice is per-install and never persisted. CI / `--yes`
 * runs default to opt-out unless `--telemetry-opt-in` is explicit.
 *
 * Distinct from `telemetry.artifact_engagement` — see schema doc.
 */

import { postEvent } from './emitter.js';
import { isTelemetryEnabled } from './kill-switch.js';
import {
    buildStageEvent,
    isSessionOpen,
    openSession,
    sealSession,
} from './session.js';
import type {
    ErrorClass,
    PackCategory,
    TelemetryConfig,
    TelemetryStage,
} from './types.js';

export type {
    DurationBucket,
    EntryPath,
    ErrorClass,
    HostAgentFamily,
    InstallStageEvent,
    NodeMajor,
    OsFamily,
    PackCategory,
    SessionDimensions,
    TelemetryConfig,
    TelemetryFlags,
    TelemetryStage,
} from './types.js';

export {
    durationBucketOf,
    errorClassOf,
    hostAgentFamilyOf,
    nodeMajorOf,
    osFamilyOf,
} from './buckets.js';

interface EmitInput {
    readonly stage: TelemetryStage;
    readonly packCategories?: readonly PackCategory[];
    readonly wizardUsed?: boolean;
    readonly errorClass?: ErrorClass;
}

let activeConfig: TelemetryConfig | null = null;

/**
 * One-shot session bootstrap. Resolves the kill-switch and opens the
 * in-memory session if all gates pass. Idempotent — second call within
 * the same process is a no-op.
 *
 * Returns `true` if telemetry is live for this session, `false` if the
 * SDK is staying silent (opted out, kill-switch off, unconfigured).
 */
export async function initSession(config: TelemetryConfig): Promise<boolean> {
    if (activeConfig !== null) return isSessionOpen();
    if (!config.optedIn) return false;
    if (config.workerBaseUrl.length === 0) return false;
    if (config.flagsUrl.length === 0) return false;
    if (config.hmacSecret.length === 0) return false;

    const enabled = await isTelemetryEnabled({
        flagsUrl: config.flagsUrl,
        requestTimeoutMs: config.requestTimeoutMs,
    });
    if (!enabled) return false;

    openSession(config.dimensions);
    activeConfig = config;
    return true;
}

/**
 * Emit one stage event. Fire-and-forget — never throws, never blocks
 * the caller's success path. Returns a promise the caller MAY await
 * during graceful shutdown.
 */
export async function emit(input: EmitInput): Promise<void> {
    if (activeConfig === null) return;
    if (!isSessionOpen()) return;

    const event = buildStageEvent({
        stage: input.stage,
        ...(input.packCategories !== undefined ? { packCategories: input.packCategories } : {}),
        ...(input.wizardUsed !== undefined ? { wizardUsed: input.wizardUsed } : {}),
        ...(input.errorClass !== undefined ? { errorClass: input.errorClass } : {}),
    });
    if (event === null) return;

    await postEvent(event, {
        workerBaseUrl: activeConfig.workerBaseUrl,
        hmacSecret: activeConfig.hmacSecret,
        requestTimeoutMs: activeConfig.requestTimeoutMs,
    });

    if (input.stage === 'applied' || input.stage === 'errored') {
        sealSession();
    }
}

/** Test hook — resets the module-level config. */
export function resetTelemetry(): void {
    activeConfig = null;
}

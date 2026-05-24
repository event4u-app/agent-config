/**
 * In-memory session state.
 *
 * Per the AI Council Round-2 verdict, the client never generates a
 * session identifier. The first event of a session POSTs without one;
 * the worker returns a server-issued `session_id` with a 2-hour TTL.
 * Subsequent events carry that token so the worker can stitch the
 * funnel.
 *
 * State lives in this module's closure for the duration of the install
 * run. Nothing is persisted to disk under any condition.
 */

import type {
    DurationBucket,
    EntryPath,
    InstallStageEvent,
    PackCategory,
    SessionDimensions,
    TelemetryStage,
} from './types.js';
import { durationBucketOf } from './buckets.js';

interface SessionState {
    sessionId: string | null;
    readonly dimensions: SessionDimensions;
    readonly startedAt: number;
    eventCount: number;
    sealed: boolean;
}

let state: SessionState | null = null;

const PER_SESSION_EVENT_CAP = 20;

export function openSession(dimensions: SessionDimensions, now: number = Date.now()): void {
    state = {
        sessionId: null,
        dimensions,
        startedAt: now,
        eventCount: 0,
        sealed: false,
    };
}

export function setSessionId(sessionId: string): void {
    if (state === null) return;
    if (state.sessionId !== null) return;
    state.sessionId = sessionId;
}

export function sealSession(): void {
    if (state !== null) state.sealed = true;
}

export function isSessionOpen(): boolean {
    return state !== null && !state.sealed;
}

export function getEntryPath(): EntryPath | null {
    return state?.dimensions.entry_path ?? null;
}

export interface BuildEventInput {
    readonly stage: TelemetryStage;
    readonly packCategories?: readonly PackCategory[];
    readonly wizardUsed?: boolean;
    readonly errorClass?: InstallStageEvent['error_class'];
    readonly now?: number;
}

/**
 * Assemble the wire payload for one stage event. Returns `null` if the
 * session is closed, the per-session event cap is hit, or no session
 * is open. Increments the event counter on success.
 */
export function buildStageEvent(input: BuildEventInput): InstallStageEvent | null {
    if (state === null || state.sealed) return null;
    if (state.eventCount >= PER_SESSION_EVENT_CAP) return null;

    const now = input.now ?? Date.now();
    const duration: DurationBucket = durationBucketOf(now - state.startedAt);

    state.eventCount += 1;

    const payload: InstallStageEvent = {
        schema_version: '1',
        event: 'install_stage',
        stage: input.stage,
        ts: new Date(now).toISOString(),
        ...(state.sessionId !== null ? { session_id: state.sessionId } : {}),
        entry_path: state.dimensions.entry_path,
        host_agent_family: state.dimensions.host_agent_family,
        os: state.dimensions.os,
        node_major: state.dimensions.node_major,
        agent_config_version: state.dimensions.agent_config_version,
        ...(input.packCategories !== undefined ? { pack_categories: input.packCategories } : {}),
        ...(input.wizardUsed !== undefined ? { wizard_used: input.wizardUsed } : {}),
        duration_bucket: duration,
        ...(input.errorClass !== undefined ? { error_class: input.errorClass } : {}),
    };

    return payload;
}

/** Test hook — clears the session for a fresh run. */
export function resetSession(): void {
    state = null;
}

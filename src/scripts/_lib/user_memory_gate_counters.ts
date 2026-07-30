#!/usr/bin/env tsx
/**
 * The promotion-behaviour gate counters — road-to-global-user-memory Phase 5
 * ("the gate that can actually fire").
 *
 * ADR-119 exists because a previous gate could never fire by construction:
 * reuse could only accrue while the layer was ON, and ON was withheld pending
 * reuse. ADR-138's Phase 5 gate is keyed to a different signal on purpose —
 * **promotion behaviour**, which moves through human `/agents:user accept`
 * decisions whether or not the global profile ever loads at session start.
 * See `docs/decisions/ADR-138-global-user-profile-layer.md` § Promotion-
 * behaviour gate for the kill-criterion this module's counters feed.
 *
 * Four counts, and nothing else:
 *
 *   1. `projects_with_ge_10_sessions`        — how many projects reached the
 *      sessions floor the kill-criterion denominator needs.
 *   2. `projects_with_promoted_observation`  — how many of those (or any)
 *      projects have at least one promoted global observation.
 *   3. `observations_proposed`               — total candidates that reached
 *      the global buffer (Phase 2's `appendGlobalObservation` succeeding).
 *   4. `observations_accepted`               — total candidates a human
 *      confirmed via `/agents:user accept` (Phase 2's
 *      `applyObservationToGlobalProfile` writing the profile).
 *
 * PII-exclusion-by-construction (the same shape `orchestration-telemetry.md`
 * and `artifact-engagement-recording.md` already use): the counter struct has
 * **no field capable of holding free-form content** — every field is a
 * non-negative integer count. There is no `payload`, `notes`, or `context`
 * field to widen by accident, and `readGateCounters` drops any unknown key or
 * non-numeric value on read rather than passing it through. Privacy is a
 * property of the shape, not of a scrubbing pass that could fail.
 *
 * This module never decides WHEN a project crosses the ≥10-session floor or
 * WHEN a project's first observation gets promoted — those are caller-side
 * facts (a session-start counter, the `/agents:user accept` flow) that the
 * caller already holds in memory at the moment it happens. This module only
 * durably persists the four resulting counts. Honest boundary: a
 * read-then-write race between two concurrent callers can under-count by one
 * increment — acceptable for a single-user local CLI with no lock primitive
 * elsewhere in this package (`_lib/installed_lock.ts` tracks installed files,
 * not a mutex), and irrelevant to the gate's 90-day-window granularity.
 *
 * Path resolution mirrors every sibling global-root artefact
 * (`user_global_observations.ts`, `agent_user_profile.ts`): honours
 * `$EVENT4U_CONFIG_HOME`, falls back to `~/.event4u/agent-config/`, and reads
 * the legacy `~/.config/agent-config/` location for pre-migration installs.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as user_global_paths from './user_global_paths.js';

/** Relative-to-root path of the gate counters file. */
export const GATE_COUNTERS_RELATIVE = path.join('user', 'promotion-gate-counters.json');

/**
 * The gate's counter shape. Every field is a non-negative integer count —
 * this interface can never carry a string, a path, an id, or an array; there
 * is no field a caller could widen into free-form content without changing
 * the type itself (verified by `tests/lib/user_memory_gate_counters.test.ts`'s
 * shape test).
 */
export interface PromotionGateCounters {
    readonly projects_with_ge_10_sessions: number;
    readonly projects_with_promoted_observation: number;
    readonly observations_proposed: number;
    readonly observations_accepted: number;
}

/** The closed field set — anything else read from disk is dropped, never passed through. */
export const GATE_COUNTER_FIELDS = [
    'projects_with_ge_10_sessions',
    'projects_with_promoted_observation',
    'observations_proposed',
    'observations_accepted',
] as const satisfies readonly (keyof PromotionGateCounters)[];

/** All-zero starting state. */
export function zeroCounters(): PromotionGateCounters {
    return {
        projects_with_ge_10_sessions: 0,
        projects_with_promoted_observation: 0,
        observations_proposed: 0,
        observations_accepted: 0,
    };
}

/** `true` iff `value` is a non-negative integer — the only shape a counter field may hold. */
function _isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Coerce an arbitrary parsed-JSON value into a valid counters struct.
 * Unknown keys are dropped; a field that is missing, non-numeric, negative,
 * or non-integer falls back to `0` rather than throwing or passing the raw
 * value through. This is the runtime half of the shape guarantee — the
 * struct that comes out of a read can never carry anything the type doesn't
 * already allow, even from a hand-edited or corrupted file on disk.
 */
export function coerceCounters(raw: unknown): PromotionGateCounters {
    const rec =
        raw !== null && typeof raw === 'object' && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : {};
    const zero = zeroCounters();
    const out: Record<string, number> = { ...zero };
    for (const field of GATE_COUNTER_FIELDS) {
        const value = rec[field];
        out[field] = _isNonNegativeInteger(value) ? value : 0;
    }
    return out as unknown as PromotionGateCounters;
}

// ---------------------------------------------------------------------------
// Path resolution — mirrors user_global_observations.ts / agent_user_profile.ts.
// ---------------------------------------------------------------------------

/** Canonical write target for the gate counters file. */
export function gateCountersWriteTarget(env?: user_global_paths.EnvMap | null): string {
    return user_global_paths.write_target(GATE_COUNTERS_RELATIVE, { env: env ?? null });
}

/** Resolve the counters file's on-disk path — new namespace first, legacy fallback, `null` if neither exists. */
export function resolveGateCountersPath(env?: user_global_paths.EnvMap | null): string | null {
    return user_global_paths.resolve_with_fallback(GATE_COUNTERS_RELATIVE, { env: env ?? null });
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

/** Read the current counters. Missing file, missing directory, or malformed JSON all resolve to `zeroCounters()` — never throws. */
export function readGateCounters(
    options: { env?: user_global_paths.EnvMap | null } = {},
): PromotionGateCounters {
    const target = resolveGateCountersPath(options.env ?? null);
    if (target === null) {
        return zeroCounters();
    }
    let raw: string;
    try {
        raw = fs.readFileSync(target, 'utf-8');
    } catch {
        return zeroCounters();
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return zeroCounters();
    }
    return coerceCounters(parsed);
}

/** Persist `counters` verbatim to the write target, creating the parent directory if needed. */
function _writeGateCounters(
    counters: PromotionGateCounters,
    options: { env?: user_global_paths.EnvMap | null } = {},
): void {
    const target = gateCountersWriteTarget(options.env ?? null);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(coerceCounters(counters)) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Pure increments — no disk access, easy to unit-test in isolation.
// ---------------------------------------------------------------------------

/** One project just crossed the ≥10-sessions floor. Caller dedupes per-project — this module holds no project identity. */
export function incrementProjectsWithTenSessions(
    counters: PromotionGateCounters,
): PromotionGateCounters {
    return { ...counters, projects_with_ge_10_sessions: counters.projects_with_ge_10_sessions + 1 };
}

/** One project just got its FIRST promoted global observation. Caller dedupes per-project — this module holds no project identity. */
export function incrementProjectsWithPromotedObservation(
    counters: PromotionGateCounters,
): PromotionGateCounters {
    return {
        ...counters,
        projects_with_promoted_observation: counters.projects_with_promoted_observation + 1,
    };
}

/** One observation candidate reached the global buffer (a Phase 2/3 `appendGlobalObservation` success). */
export function incrementObservationsProposed(
    counters: PromotionGateCounters,
): PromotionGateCounters {
    return { ...counters, observations_proposed: counters.observations_proposed + 1 };
}

/** One observation candidate was confirmed via `/agents:user accept` (a Phase 2 `applyObservationToGlobalProfile` write). */
export function incrementObservationsAccepted(
    counters: PromotionGateCounters,
): PromotionGateCounters {
    return { ...counters, observations_accepted: counters.observations_accepted + 1 };
}

// ---------------------------------------------------------------------------
// Disk-touching wrappers — read, increment, write, return the new value.
// ---------------------------------------------------------------------------

/** Record one project crossing the ≥10-sessions floor. */
export function recordProjectReachedTenSessions(
    options: { env?: user_global_paths.EnvMap | null } = {},
): PromotionGateCounters {
    const next = incrementProjectsWithTenSessions(readGateCounters(options));
    _writeGateCounters(next, options);
    return next;
}

/** Record one project's first promoted observation. */
export function recordProjectPromotedFirstObservation(
    options: { env?: user_global_paths.EnvMap | null } = {},
): PromotionGateCounters {
    const next = incrementProjectsWithPromotedObservation(readGateCounters(options));
    _writeGateCounters(next, options);
    return next;
}

/** Record one observation reaching the global buffer. */
export function recordObservationProposed(
    options: { env?: user_global_paths.EnvMap | null } = {},
): PromotionGateCounters {
    const next = incrementObservationsProposed(readGateCounters(options));
    _writeGateCounters(next, options);
    return next;
}

/** Record one observation confirmed via `/agents:user accept`. */
export function recordObservationAccepted(
    options: { env?: user_global_paths.EnvMap | null } = {},
): PromotionGateCounters {
    const next = incrementObservationsAccepted(readGateCounters(options));
    _writeGateCounters(next, options);
    return next;
}

// ---------------------------------------------------------------------------
// Kill-criterion evaluation — see ADR-138 § Promotion-behaviour gate.
// ---------------------------------------------------------------------------

/** Human-confirmed floor: below this share of ≥10-session projects carrying a promotion, the teardown review is mandatory. */
export const PROJECT_PROMOTION_SHARE_FLOOR = 0.4;

/** Human-confirmed floor: below this review→accept rate, the teardown review is mandatory. */
export const REVIEW_ACCEPT_RATE_FLOOR = 0.3;

export interface KillCriterionResult {
    /** `null` when `projects_with_ge_10_sessions` is `0` — the ratio is undefined, not zero, until there is a qualifying project. */
    readonly project_promotion_share: number | null;
    /** `null` when `observations_proposed` is `0` — same undefined-vs-zero distinction. */
    readonly review_accept_rate: number | null;
    /** `true` iff either floor is breached with a defined ratio — an undefined ratio never trips the gate on its own. */
    readonly teardown_review_required: boolean;
}

/**
 * Evaluate the two kill-criterion floors from ADR-138 § Promotion-behaviour
 * gate against the current counters. A ratio with a zero denominator is
 * reported as `null` (undefined), not `0` or `1` — an empty gate has not yet
 * failed, it has not yet been exercised, and the ADR's window (90 days from
 * release) is what turns "not yet exercised" into a real finding.
 */
export function evaluateKillCriterion(counters: PromotionGateCounters): KillCriterionResult {
    const project_promotion_share =
        counters.projects_with_ge_10_sessions > 0
            ? counters.projects_with_promoted_observation / counters.projects_with_ge_10_sessions
            : null;
    const review_accept_rate =
        counters.observations_proposed > 0
            ? counters.observations_accepted / counters.observations_proposed
            : null;
    const teardown_review_required =
        (project_promotion_share !== null && project_promotion_share < PROJECT_PROMOTION_SHARE_FLOOR) ||
        (review_accept_rate !== null && review_accept_rate < REVIEW_ACCEPT_RATE_FLOOR);
    return { project_promotion_share, review_accept_rate, teardown_review_required };
}

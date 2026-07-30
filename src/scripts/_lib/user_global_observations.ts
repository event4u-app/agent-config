#!/usr/bin/env tsx
/**
 * The global observation buffer — the write path of ADR-138's sibling phase
 * (road-to-global-user-memory Phase 2, "the learning channel"). Mirrors the
 * project-local `.agent-user.observations.jsonl` contract
 * (`docs/contracts/agent-user-schema.md § Observation buffer`) exactly, one
 * level up: `~/.event4u/agent-config/user/observations.jsonl`.
 *
 * This module is the ONLY writer of that file. It is never read by the
 * profile loader (`agent_user_profile.ts`) directly — only
 * `/agents:user review` / `/agents:user accept` (and, through them,
 * `applyObservationToGlobalProfile` in `agent_user_profile.ts`) may turn a
 * buffered line into a change to `profile.md`. Append-only; nothing here
 * ever rewrites `profile.md`.
 *
 * Capture-time guards (council cut, 2026-07-29 — see
 * `agents/settings/contexts/global-user-memory-cut.md`): every candidate is
 * checked BEFORE it is written, not filtered later at review. Four
 * independently-testable classes, in the order they run:
 *
 *   1. `standing_command`   — a verbatim standing directive ("always fetch
 *      <url> on every message") stored as memory becomes a durable
 *      injection that re-fires forever — and now in every project, not
 *      just one.
 *   2. `self_harmful_preference` — a preference that would disable honest
 *      feedback ("never criticize me", "always agree with me") is
 *      surfaced, never stored, per `direct-answers`.
 *   3. `exclusion_list`     — the `.agent-user.md` explicit-exclusions list
 *      (credentials, third-party names/birthdays, financial figures,
 *      health/legal/therapy status, demographics, external-source
 *      identifiers) refused at CAPTURE, not at review. Rejecting the same
 *      class fifty times at review is the noise problem this avoids.
 *   4. `hidden_unicode`     — invisible-character identifier smuggling
 *      (the ADR-103 zero-width-smuggling class). Same gate as (3) — both
 *      come from one call to `knowledge_global_redaction.redaction_scan`
 *      — but reported as its own category so a test can pin it
 *      independently.
 *
 * The third persist-time guard the miner already documents — the
 * derivability check ("if git/config answers it, store the surprising
 * part") — is a judgment call the agent makes before a candidate ever
 * reaches this module; it is not a deterministic function here (see
 * `memory-consolidation` SKILL.md § Global user-scoped channel).
 *
 * The ≤5-normalised-facts-per-cycle gate applies GLOBALLY across the
 * project-scoped intake channel (`mine_session.ts`) and this one — see
 * `applySharedFactCap`. Enforcing it per-channel would let the second
 * channel double the write volume the cap was meant to bound.
 *
 * Pure except for `appendGlobalObservation` and `readGlobalObservations`,
 * which are the only functions that touch disk. Every disk path is
 * resolved via `user_global_paths.ts`, honouring `$EVENT4U_CONFIG_HOME`
 * exactly like every other artefact under the global root — tests MUST
 * inject that variable rather than touch the real `~/.event4u/`.
 *
 * Phase 3 (project attribution, below the read path) adds `routeProjectObservation`
 * — the Phase 0 managed/unmanaged/not-a-project predicate wired as a router
 * for a project-scoped fact that has no managed `agents/` folder to live in.
 * It writes through the SAME `appendGlobalObservation` guard pipeline above,
 * plus a `context` object (`project_path`/`project_name`/`first_seen`) and a
 * `seen_count`/`seen_in[]` recurrence tally — the only generalisation path
 * into the durable profile (`findPromotionCandidates`,
 * `promotionValueFor`). No project-indexed directory is ever created; see
 * `tests/lib/user_global_observations_project_attribution.test.ts`.
 *
 * Phase 4 (delete, revoke, audit) adds `deleteGlobalObservation` and
 * `purgeProjectContext` — the delete counterpart of `appendGlobalObservation`
 * / `routeProjectObservation` above. Both write an append-only tombstone to
 * `user_global_revocations.ts`'s ledger BEFORE the buffer is rewritten
 * without the removed line(s), reusing ADR-121's tombstone-before-deletion
 * discipline (see that module's docstring for the one necessary adaptation).
 * `observationId` supplies the stable identifier neither the JSONL schema
 * nor a knowledge card's `card_id_from` slug has an analogue for.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { redaction_scan } from './knowledge_global_redaction.js';
import { detect_managed_agents_folder } from './managed_agents_folder.js';
import type { ManagedAgentsFolderStatus } from './managed_agents_folder.js';
import { classifySimilarity, jaccardSimilarity } from './text_similarity.js';
import * as revocations from './user_global_revocations.js';
import type { RevocationEntry } from './user_global_revocations.js';
import * as user_global_paths from './user_global_paths.js';
import { recordObservationProposed } from './user_memory_gate_counters.js';

/** Relative-to-root path of the global observation buffer. */
export const GLOBAL_OBSERVATIONS_RELATIVE = path.join('user', 'observations.jsonl');

/**
 * Shared cap across BOTH channels (the project-scoped miner and this one).
 * Duplicated from `mine_session.MAX_FACTS` deliberately rather than
 * imported — `_lib/` modules do not import from `src/scripts/*.ts` CLI
 * entrypoints, keeping the dependency direction one-way. Keep the two
 * constants in sync; a test in `tests/lib/user_global_observations.test.ts`
 * would need updating (not silently pass) if they diverge.
 */
export const SHARED_FACT_CAP = 5;

/** Allowed `field` values — mirrors `docs/contracts/agent-user-schema.md § Observation buffer`. */
export const ALLOWED_OBSERVATION_FIELDS = [
    'identity.name',
    'language',
    'role',
    'style.pace',
    'voice_sample',
    'notes',
] as const;

export type ObservationField = (typeof ALLOWED_OBSERVATION_FIELDS)[number];

const _ALLOWED_FIELD_SET: ReadonlySet<string> = new Set(ALLOWED_OBSERVATION_FIELDS);

/**
 * Project-attribution footer (road-to-global-user-memory Phase 3). Present
 * only on an observation routed here because its project has no managed
 * `agents/` folder (see `routeProjectObservation`, below) — a pure
 * user-attribute observation (Phase 2's `mineUserObservationCandidates`
 * channel) never carries one. Mirrors the semantics of the global knowledge
 * card's `seen_in` provenance footer (`knowledge_global.ts`) rather than
 * inventing a parallel primitive — this is a field on a user observation,
 * never a project-shaped artefact of its own (the council's round-2
 * namespace refusal; see `agents/settings/contexts/global-user-memory-cut.md`).
 */
export interface ObservationContext {
    readonly project_path: string;
    readonly project_name: string;
    /** ISO timestamp of the FIRST sighting — never updated on recurrence. */
    readonly first_seen: string;
}

/**
 * One candidate/buffered observation. Shape mirrors the project-local
 * buffer's JSONL line, plus the optional Phase 3 project-attribution
 * fields. `context`/`seen_count`/`seen_in` are present together or not at
 * all — set only via `routeProjectObservation`, never by
 * `appendGlobalObservation` callers directly (Phase 2's pure user-attribute
 * path has no project to attribute to).
 */
export interface ObservationCandidate {
    readonly ts: string;
    readonly field: string;
    readonly suggest: string;
    readonly source: string;
    readonly evidence: string;
    readonly context?: ObservationContext | undefined;
    /** Human-confirmed-recurrence tally — see `findPromotionCandidates`. Counting evidence, never a detector: it only ever grows via `routeProjectObservation` observing another project's write, never a cross-project batch scan. */
    readonly seen_count?: number | undefined;
    /** Project names the observation has recurred in, oldest first. Pruned to nothing at promotion — see `promotionValueFor`. */
    readonly seen_in?: readonly string[] | undefined;
}

export type CaptureGuardCategory =
    | 'standing_command'
    | 'self_harmful_preference'
    | 'exclusion_list'
    | 'hidden_unicode';

export interface CaptureGuardResult {
    readonly allowed: boolean;
    readonly category?: CaptureGuardCategory | undefined;
    readonly reason?: string | undefined;
}

export interface AppendResult {
    readonly written: boolean;
    readonly reason?: string | undefined;
    readonly category?: CaptureGuardCategory | 'invalid_field' | undefined;
}

export interface ReadObservationsResult {
    readonly entries: readonly ObservationCandidate[];
    /** Lines that were not valid JSON objects at all. */
    readonly droppedMalformed: number;
    /** Lines whose `field` fell outside {@link ALLOWED_OBSERVATION_FIELDS}. */
    readonly droppedUnknownField: number;
}

// ---------------------------------------------------------------------------
// Path resolution — mirrors agent_user_profile.ts's global-layer functions.
// ---------------------------------------------------------------------------

/** Canonical write target for the global observation buffer. */
export function globalObservationsWriteTarget(
    env?: user_global_paths.EnvMap | null,
): string {
    return user_global_paths.write_target(GLOBAL_OBSERVATIONS_RELATIVE, { env: env ?? null });
}

/** Resolve the buffer's on-disk path — new namespace first, legacy fallback, `null` if neither exists. */
export function resolveGlobalObservationsPath(
    env?: user_global_paths.EnvMap | null,
): string | null {
    return user_global_paths.resolve_with_fallback(GLOBAL_OBSERVATIONS_RELATIVE, { env: env ?? null });
}

// ---------------------------------------------------------------------------
// Capture-time guards
// ---------------------------------------------------------------------------

// Matches an imperative paired with a recurrence marker, in either order —
// "always fetch <url> on every message" / "run <cmd> at the start of each
// session". Deliberately broad: a false positive here costs one refused
// candidate the human never sees; a false negative persists a durable
// injection forever, in every project.
const _STANDING_COMMAND_RE =
    /\b(?:always|every\s+(?:session|message|time|turn))\b[\s\S]{0,80}?\b(?:fetch|run|curl|execute|call|check)\b|\b(?:fetch|run|curl|execute|call|check)\b[\s\S]{0,80}?\b(?:at\s+the\s+start\s+of\s+(?:each|every)\s+(?:session|message)|on\s+every\s+(?:message|turn|session)|always)\b/i;

// "never criticize me", "always agree with me", "never say I'm wrong",
// "don't ever disagree with me" — a user weaponizing their own memory to
// enforce sycophancy (direct-answers Iron Law 1).
const _SELF_HARMFUL_PREFERENCE_RE =
    /\bnever\s+(?:criticize|disagree\s+with|push\s+back\s+on|question|correct)\s+me\b|\balways\s+agree\s+with\s+me\b|\bnever\s+say\s+i(?:'|’)?m\s+wrong\b|\bdon'?t\s+ever\s+(?:disagree|criticize)\b/i;

/** `true` when `text` reads as a verbatim standing command. */
export function detectStandingCommand(text: string): boolean {
    return _STANDING_COMMAND_RE.test(text);
}

/** `true` when `text` reads as a self-harmful standing preference. */
export function detectSelfHarmfulPreference(text: string): boolean {
    return _SELF_HARMFUL_PREFERENCE_RE.test(text);
}

/**
 * Run all four capture-time guards against a candidate, in order. Returns
 * the FIRST violation found (a candidate tripping two guards at once is
 * refused for the earlier one; the categories are independently testable,
 * not mutually exclusive in the input space).
 */
export function evaluateCaptureGuards(
    candidate: ObservationCandidate,
    options: { repo_root?: string | null } = {},
): CaptureGuardResult {
    const text = `${candidate.suggest}\n${candidate.evidence}`;

    if (detectStandingCommand(text)) {
        return {
            allowed: false,
            category: 'standing_command',
            reason:
                'reads as a verbatim standing command — a stored directive becomes a durable ' +
                'injection that re-fires forever, and at global scope that means every project, ' +
                'not just this one. Refused at capture.',
        };
    }
    if (detectSelfHarmfulPreference(text)) {
        return {
            allowed: false,
            category: 'self_harmful_preference',
            reason:
                'would disable honest feedback across every project — surfaced to the user, ' +
                'never stored.',
        };
    }

    const violations = redaction_scan(text, { repo_root: options.repo_root ?? null });
    const hiddenUnicode = violations.find((v) => v.category === 'hidden_unicode');
    if (hiddenUnicode) {
        return {
            allowed: false,
            category: 'hidden_unicode',
            reason: `invisible characters detected — possible identifier smuggling: ${hiddenUnicode.snippet}`,
        };
    }
    if (violations.length > 0) {
        return {
            allowed: false,
            category: 'exclusion_list',
            reason:
                'capture-time exclusion-list match (credentials / third-party PII / financial ' +
                `figures / health-legal-therapy / demographics / external-source identifiers): ${violations
                    .map((v) => v.category)
                    .join(', ')}`,
        };
    }
    return { allowed: true };
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

/**
 * Append one candidate to the global observation buffer, after running
 * every capture-time guard. Never rewrites — a refused candidate is
 * refused outright, not silently redacted-then-stored (the low-impact
 * corpus's own "halt-and-surface, never silent-rewrite" discipline).
 */
export function appendGlobalObservation(
    candidate: ObservationCandidate,
    options: { env?: user_global_paths.EnvMap | null; repo_root?: string | null } = {},
): AppendResult {
    if (!_ALLOWED_FIELD_SET.has(candidate.field)) {
        return {
            written: false,
            category: 'invalid_field',
            reason: `field '${candidate.field}' is outside the allowed schema enum`,
        };
    }

    const guard = evaluateCaptureGuards(candidate, { repo_root: options.repo_root ?? null });
    if (!guard.allowed) {
        return { written: false, category: guard.category, reason: guard.reason };
    }

    const target = globalObservationsWriteTarget(options.env ?? null);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, JSON.stringify(candidate) + '\n', 'utf-8');
    // Phase 5 gate: count the proposal where it actually lands, so the
    // review→accept rate cannot be skewed by a caller that bypasses the
    // command layer. A refused candidate is deliberately NOT counted — it was
    // never proposed to the human. Counter failure never fails the append.
    try {
        recordObservationProposed({ env: options.env ?? null });
    } catch {
        /* a counter is telemetry, never a gate on the buffer write */
    }
    return { written: true };
}

/**
 * Apply the shared ≤5-facts-per-cycle cap across both channels. `existingCount`
 * is however many facts the project-scoped channel already produced THIS
 * cycle; only the remaining headroom is available to the candidates here.
 * Never negative — a project-scoped channel that already hit the cap leaves
 * zero room for the second channel this cycle.
 */
export function applySharedFactCap<T>(
    existingCount: number,
    candidates: readonly T[],
    cap: number = SHARED_FACT_CAP,
): T[] {
    const remaining = Math.max(0, cap - existingCount);
    return candidates.slice(0, remaining);
}

// ---------------------------------------------------------------------------
// Read path — feeds `/agents:user review` / `/agents:user accept`.
// ---------------------------------------------------------------------------

/**
 * Read + parse the global observation buffer. Tolerant: a malformed JSON
 * line or a line whose `field` falls outside the schema enum is dropped
 * silently, with a count so the caller can surface "N observations
 * skipped" — mirroring "Anything outside that set is dropped on read" in
 * the project-local contract.
 */
/** Tolerant parse of a JSONL line's `context` field — malformed shapes read back as absent, never thrown. */
function _parseContext(raw: unknown): ObservationContext | undefined {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return undefined;
    }
    const rec = raw as Record<string, unknown>;
    const project_path = typeof rec.project_path === 'string' ? rec.project_path : undefined;
    const project_name = typeof rec.project_name === 'string' ? rec.project_name : undefined;
    const first_seen = typeof rec.first_seen === 'string' ? rec.first_seen : undefined;
    if (project_path === undefined || project_name === undefined || first_seen === undefined) {
        return undefined;
    }
    return { project_path, project_name, first_seen };
}

/** Tolerant parse of a JSONL line's `seen_in` field — drops non-string entries rather than failing the whole line. */
function _parseSeenIn(raw: unknown): readonly string[] | undefined {
    if (!Array.isArray(raw)) {
        return undefined;
    }
    const out = raw.filter((v): v is string => typeof v === 'string');
    return out.length > 0 ? out : undefined;
}

export function readGlobalObservations(
    options: { env?: user_global_paths.EnvMap | null } = {},
): ReadObservationsResult {
    const target = resolveGlobalObservationsPath(options.env ?? null);
    if (target === null) {
        return { entries: [], droppedMalformed: 0, droppedUnknownField: 0 };
    }
    let raw: string;
    try {
        raw = fs.readFileSync(target, 'utf-8');
    } catch {
        return { entries: [], droppedMalformed: 0, droppedUnknownField: 0 };
    }

    let droppedMalformed = 0;
    let droppedUnknownField = 0;
    const entries: ObservationCandidate[] = [];

    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === '') {
            continue;
        }
        let obj: unknown;
        try {
            obj = JSON.parse(trimmed);
        } catch {
            droppedMalformed += 1;
            continue;
        }
        if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
            droppedMalformed += 1;
            continue;
        }
        const rec = obj as Record<string, unknown>;
        const field = typeof rec.field === 'string' ? rec.field : '';
        if (!_ALLOWED_FIELD_SET.has(field)) {
            droppedUnknownField += 1;
            continue;
        }
        entries.push({
            ts: typeof rec.ts === 'string' ? rec.ts : '',
            field,
            suggest: typeof rec.suggest === 'string' ? rec.suggest : '',
            source: typeof rec.source === 'string' ? rec.source : '',
            evidence: typeof rec.evidence === 'string' ? rec.evidence : '',
            context: _parseContext(rec.context),
            seen_count: typeof rec.seen_count === 'number' ? rec.seen_count : undefined,
            seen_in: _parseSeenIn(rec.seen_in),
        });
    }

    return { entries, droppedMalformed, droppedUnknownField };
}

// ---------------------------------------------------------------------------
// Phase 3 — project attribution and the generalisation promotion.
//
// The operator's third ask ("P — project facts with no managed folder"),
// implemented as the council's round-2 reading: attribution, not isolation.
// No global project registry, no project-indexed directory tree, no fourth
// sensitivity class — see `agents/settings/contexts/global-user-memory-cut.md`.
//
// `routeProjectObservation` is the Phase 0 predicate wired as a router: a
// project WITH a managed `agents/` folder keeps its facts local exactly as
// today (this module never touches them); a project withOUT one persists the
// fact here, tagged with `context` so it survives that project's deletion.
// ---------------------------------------------------------------------------

/** Where a project-scoped observation is routed, per the Phase 0 predicate. */
export type ProjectObservationRoute = 'local' | 'global';

/** `managed` keeps facts in the project's own `agents/memory/`; anything else has nowhere local to land. */
export function routeForManagedStatus(status: ManagedAgentsFolderStatus): ProjectObservationRoute {
    return status === 'managed' ? 'local' : 'global';
}

/** Build the attribution footer for a project-scoped observation. `project_name` is the directory basename — the same human-readable unit the global knowledge card's `seen_in` footer already uses. */
export function buildObservationContext(projectRoot: string, firstSeen: string): ObservationContext {
    return {
        project_path: projectRoot,
        project_name: path.basename(projectRoot) || projectRoot,
        first_seen: firstSeen,
    };
}

/**
 * Capture-time guards for the two context strings ADDED by Phase 3, run
 * before the context is ever attached to a candidate. `project_path` is
 * *expected* to look like an absolute path — `redaction_scan`'s generic
 * `project_path` category exists to catch a path LEAKED into free-form
 * text, and would refuse every real value here by design, so only the
 * `hidden_unicode` class (identifier smuggling, ADR-103) applies to it.
 * `project_name` is free-form and gets the full scan, since a hostile or
 * careless directory name could otherwise smuggle a secret or a hidden
 * character past capture. Reuses the same hardened gate Phase 2 already
 * calls for `suggest`/`evidence` — never a second detector.
 */
export function evaluateContextCaptureGuards(context: ObservationContext): CaptureGuardResult {
    const pathHiddenUnicode = redaction_scan(context.project_path).find(
        (v) => v.category === 'hidden_unicode',
    );
    if (pathHiddenUnicode) {
        return {
            allowed: false,
            category: 'hidden_unicode',
            reason:
                'invisible characters detected in project_path — possible identifier smuggling: ' +
                pathHiddenUnicode.snippet,
        };
    }

    const nameViolations = redaction_scan(context.project_name);
    const nameHiddenUnicode = nameViolations.find((v) => v.category === 'hidden_unicode');
    if (nameHiddenUnicode) {
        return {
            allowed: false,
            category: 'hidden_unicode',
            reason:
                'invisible characters detected in project_name — possible identifier smuggling: ' +
                nameHiddenUnicode.snippet,
        };
    }
    if (nameViolations.length > 0) {
        return {
            allowed: false,
            category: 'exclusion_list',
            reason:
                'project_name matched a capture-time exclusion pattern: ' +
                nameViolations.map((v) => v.category).join(', '),
        };
    }
    return { allowed: true };
}

/** Current `seen_count` for an already-buffered context-bearing entry — 1 when the field is absent (its first sighting was never re-written with an explicit count). */
function _existingSeenCount(entry: ObservationCandidate): number {
    return entry.seen_count ?? 1;
}

/** Current `seen_in` for an already-buffered context-bearing entry, falling back to its own context's project when the field is absent. */
function _existingSeenIn(entry: ObservationCandidate): readonly string[] {
    if (entry.seen_in !== undefined) {
        return entry.seen_in;
    }
    return entry.context !== undefined ? [entry.context.project_name] : [];
}

/** Result of matching a new project-scoped candidate against the existing context-bearing buffer. */
export interface ObservationRecurrence {
    readonly seen_count: number;
    readonly seen_in: readonly string[];
}

/**
 * Decide whether `candidateText` is the SAME observation as one already
 * buffered from a different project, using the identical dedup primitive
 * (`_lib/text_similarity.ts`'s `MERGE_THRESHOLD`, via `classifySimilarity`)
 * the curated-memory dedup path uses — "same observation" means the same
 * thing in both places, per the roadmap. Only entries carrying a `context`
 * are eligible matches; a pure user-attribute observation (no project to
 * attribute to) never participates in cross-project recurrence counting.
 *
 * The buffer is append-only, so a recurring observation accumulates
 * multiple lines over time, each carrying that append's cumulative
 * `seen_count`/`seen_in`. Deliberately scans linearly (not
 * `findMostSimilar`, which ties to the FIRST equal-score match) and keeps
 * the LAST line at/above `MERGE_THRESHOLD` — otherwise a run of
 * byte-identical `suggest` values would always tie back to the stale first
 * sighting instead of the most recently accumulated state.
 *
 * Recurrence in the SAME project again does not bump the counter — the
 * roadmap ties `seen_count` to "recurs in a DIFFERENT project" specifically,
 * so the growth stays a cross-project confirmation tally, never a
 * same-project noise counter.
 */
export function computeRecurrence(
    candidateContext: ObservationContext,
    candidateText: string,
    existingEntries: readonly ObservationCandidate[],
): ObservationRecurrence {
    const contextBearing = existingEntries.filter((e) => e.context !== undefined);

    let matched: ObservationCandidate | undefined;
    for (const entry of contextBearing) {
        const score = jaccardSimilarity(candidateText, entry.suggest);
        if (classifySimilarity(score) === 'merge') {
            matched = entry;
        }
    }
    if (matched === undefined) {
        return { seen_count: 1, seen_in: [candidateContext.project_name] };
    }
    const priorSeenIn = _existingSeenIn(matched);
    if (priorSeenIn.includes(candidateContext.project_name)) {
        // Same project recurring — evidence already counted; hold steady.
        return { seen_count: _existingSeenCount(matched), seen_in: priorSeenIn };
    }
    return {
        seen_count: _existingSeenCount(matched) + 1,
        seen_in: [...priorSeenIn, candidateContext.project_name],
    };
}

/** A project-scoped candidate awaiting routing — no `context`/`seen_count`/`seen_in` yet; `routeProjectObservation` attaches them. */
export type ProjectObservationInput = Pick<ObservationCandidate, 'ts' | 'suggest' | 'source' | 'evidence'> & {
    readonly field?: string;
};

export interface RouteProjectObservationOptions {
    readonly env?: user_global_paths.EnvMap | null;
    readonly repo_root?: string | null;
}

export interface ProjectObservationRouteResult {
    readonly route: ProjectObservationRoute;
    readonly written: boolean;
    readonly reason?: string | undefined;
    readonly category?: CaptureGuardCategory | 'invalid_field' | undefined;
    readonly context?: ObservationContext | undefined;
    readonly seen_count?: number | undefined;
    readonly seen_in?: readonly string[] | undefined;
}

/**
 * The Phase 0 predicate wired as the router. `managed` → returns `route:
 * 'local'` and writes NOTHING here — the fact stays in that project's
 * `agents/memory/` exactly as today, unchanged by this module. `unmanaged` /
 * `not-a-project` → the observation is tagged with `context`, checked for
 * cross-project recurrence, and appended to the global buffer via the SAME
 * `appendGlobalObservation` guard pipeline Phase 2 established (never a
 * second write path).
 *
 * `field` defaults to `'notes'` — the schema's free-form catch-all — since a
 * project-scoped fact (a convention, an invariant, a recurring gotcha) has
 * no natural mapping onto the closed identity/style enum; `context` is what
 * distinguishes it from a plain user preference note, not a new field value.
 */
export function routeProjectObservation(
    input: ProjectObservationInput,
    projectRoot: string,
    options: RouteProjectObservationOptions = {},
): ProjectObservationRouteResult {
    const status = detect_managed_agents_folder(projectRoot);
    const route = routeForManagedStatus(status);
    if (route === 'local') {
        return {
            route: 'local',
            written: false,
            reason:
                "managed agents/ folder detected — the fact stays in this project's agents/memory/ " +
                'exactly as today; never routed to the global buffer.',
        };
    }

    const context = buildObservationContext(projectRoot, input.ts);
    const contextGuard = evaluateContextCaptureGuards(context);
    if (!contextGuard.allowed) {
        return {
            route: 'global',
            written: false,
            category: contextGuard.category,
            reason: contextGuard.reason,
        };
    }

    const existing = readGlobalObservations({ env: options.env ?? null }).entries;
    const recurrence = computeRecurrence(context, input.suggest, existing);

    const candidate: ObservationCandidate = {
        ts: input.ts,
        field: input.field ?? 'notes',
        suggest: input.suggest,
        source: input.source,
        evidence: input.evidence,
        context,
        seen_count: recurrence.seen_count,
        seen_in: recurrence.seen_in,
    };

    const result = appendGlobalObservation(candidate, {
        env: options.env ?? null,
        repo_root: options.repo_root ?? null,
    });
    return {
        route: 'global',
        written: result.written,
        reason: result.reason,
        category: result.category,
        context,
        seen_count: recurrence.seen_count,
        seen_in: recurrence.seen_in,
    };
}

// ---------------------------------------------------------------------------
// Promotion — the ONLY generalisation path (see agent-user-schema.md).
// ---------------------------------------------------------------------------

/** Human-confirmed-recurrence threshold for promotion candidacy. Never auto-promotes past this — it only makes the observation eligible for `/agents:user review` to surface, with a mandatory `promotion_reason` as human input before `/agents:user accept` writes anything. */
export const PROMOTION_SEEN_COUNT_THRESHOLD = 3;

export interface PromotionCandidate {
    readonly observation: ObservationCandidate;
    readonly seenCount: number;
    readonly projects: readonly string[];
}

/**
 * Observations that have crossed the promotion-candidacy threshold. This is
 * the ONLY generalisation path in the whole layer — the agent never infers a
 * cross-project pattern itself (a non-goal in the roadmap's Goal section);
 * `seen_count` only ever grows one write at a time via `routeProjectObservation`
 * observing a genuinely new project, never a batch scan across the store.
 * Crossing the threshold surfaces candidacy; it never writes `profile.md` —
 * that still requires the human-confirmed `/agents:user accept` step, with a
 * `promotion_reason` the review flow must collect (mirroring ADR-121's rule
 * that there is no auto-`shareable` path for a knowledge card).
 */
export function findPromotionCandidates(
    entries: readonly ObservationCandidate[],
): PromotionCandidate[] {
    const out: PromotionCandidate[] = [];
    for (const entry of entries) {
        if (entry.context === undefined) {
            continue;
        }
        const seenCount = _existingSeenCount(entry);
        if (seenCount >= PROMOTION_SEEN_COUNT_THRESHOLD) {
            out.push({ observation: entry, seenCount, projects: _existingSeenIn(entry) });
        }
    }
    return out;
}

/**
 * The value that may ever reach `profile.md` for a promoted observation —
 * the fact text ONLY, never `context`, never `seen_in`. This is what keeps
 * the long-lived artefact converging to zero project references: the
 * counter is evidence that lived on the buffer entry, and only the
 * short-lived buffer entry needed it (see agent-user-schema.md § Project
 * attribution — "`seen_in[]` is a narrower metadata surface, not a null
 * one").
 */
export function promotionValueFor(candidate: ObservationCandidate): string {
    return candidate.suggest;
}

// ---------------------------------------------------------------------------
// Phase 4 — delete, revoke, audit (road-to-global-user-memory).
//
// `deleteGlobalObservation` and `purgeProjectContext` are the delete
// counterpart of `appendGlobalObservation` / `routeProjectObservation`
// above — this module remains the ONLY writer (now also the only deleter)
// of the observation buffer, mirroring the single-writer discipline the
// module docstring already states for the append path.
// ---------------------------------------------------------------------------

/**
 * Deterministic content-derived identifier for one buffered observation —
 * this layer's analogue of a knowledge card's `card_id_from` slug. The
 * JSONL schema (Phase 2/3) never added a stored `id` field, so identity is
 * derived from the fields that make one capture event unique: `ts`
 * (capture timestamp) plus `field` + `suggest` (what was proposed).
 * `source` / `evidence` / `context` are deliberately excluded — two
 * identical suggestions logged at the same instant from a different source
 * string, or with different evidence phrasing, are still "the same
 * observation" to a human choosing to delete it.
 */
export function observationId(entry: Pick<ObservationCandidate, 'ts' | 'field' | 'suggest'>): string {
    const canonical = `${entry.ts}\u0000${entry.field}\u0000${entry.suggest}`;
    return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex').slice(0, 16);
}

/** Rewrite the buffer file with exactly `entries` — the shared primitive both delete paths use. */
function _writeBufferEntries(
    entries: readonly ObservationCandidate[],
    env: user_global_paths.EnvMap | null,
): void {
    const target = globalObservationsWriteTarget(env);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const body = entries.map((e) => JSON.stringify(e)).join('\n');
    fs.writeFileSync(target, entries.length > 0 ? body + '\n' : '', 'utf-8');
}

export interface DeleteObservationResult {
    readonly deleted: boolean;
    readonly tombstone?: RevocationEntry | undefined;
}

/**
 * Delete ONE buffered observation by its content-derived id. Writes an
 * append-only tombstone to `user_global_revocations.ts`'s ledger BEFORE the
 * buffer is rewritten without it — never the reverse — mirroring
 * `knowledge_global_cli.ts`'s `_forget_one` (tombstone THEN delete).
 * `deleted: false` (no tombstone written) when no entry matches `observation_id`.
 */
export function deleteGlobalObservation(
    observation_id: string,
    reason: string,
    options: { env?: user_global_paths.EnvMap | null; today?: string } = {},
): DeleteObservationResult {
    const env = options.env ?? null;
    const { entries } = readGlobalObservations({ env });
    const hasMatch = entries.some((e) => observationId(e) === observation_id);
    if (!hasMatch) {
        return { deleted: false };
    }
    const tombstone = revocations.appendTombstone(observation_id, reason, {
        today: options.today,
        env,
    });
    _writeBufferEntries(
        entries.filter((e) => observationId(e) !== observation_id),
        env,
    );
    return { deleted: true, tombstone };
}

export interface PurgeProjectContextResult {
    readonly purgedCount: number;
    readonly tombstones: readonly RevocationEntry[];
}

/**
 * Whole-project-context purge — removes EVERY buffered observation
 * attributed (via `context.project_path`) to `projectPath`, so a deleted
 * project's facts do not linger in the global buffer forever. Tombstones
 * each removed observation individually BEFORE the buffer is rewritten,
 * mirroring `knowledge_global_cli.ts`'s `cmd_purge` (one tombstone per card,
 * written before that card is wiped). Observations from OTHER projects and
 * observations carrying no `context` at all (pure user-attribute facts, not
 * project-attributed) are left untouched. `purgedCount: 0` when no
 * observation matches `projectPath` — the buffer is not rewritten in that
 * case, so an unrelated purge call never touches the file's mtime.
 */
export function purgeProjectContext(
    projectPath: string,
    reason: string,
    options: { env?: user_global_paths.EnvMap | null; today?: string } = {},
): PurgeProjectContextResult {
    const env = options.env ?? null;
    const { entries } = readGlobalObservations({ env });
    const toRemove = entries.filter((e) => e.context?.project_path === projectPath);
    if (toRemove.length === 0) {
        return { purgedCount: 0, tombstones: [] };
    }
    const tombstones = toRemove.map((e) =>
        revocations.appendTombstone(observationId(e), reason, { today: options.today, env }),
    );
    const removedIds = new Set(toRemove.map((e) => observationId(e)));
    _writeBufferEntries(
        entries.filter((e) => !removedIds.has(observationId(e))),
        env,
    );
    return { purgedCount: toRemove.length, tombstones };
}

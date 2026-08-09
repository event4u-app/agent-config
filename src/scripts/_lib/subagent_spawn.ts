/**
 * Subagent spawn-brief composition (Phase 3) — task-optimal configuration.
 *
 * Pure, no-I/O. Composes a subagent's brief from the existing config seams —
 * role-mode + profile + persona(s) + a MINIMAL knowledge slice — so each
 * subagent is configured for its task. Contract:
 * `src/agent-src/contexts/execution/subagent-spawn-contract.md`.
 *
 * Hard invariant (lethal-trifecta-guard): knowledge is passed as a small set of
 * REFERENCES, never as inline bodies, and is capped. Never bulk-dump context
 * into a subagent — keep the private-data leg narrow.
 */

import * as crypto from 'node:crypto';

import { CAPSULE_WATERMARK_FRACTION } from './worker_budget.js';

export type RoleMode = 'developer' | 'reviewer' | 'tester' | 'po' | 'incident' | 'planner';

const ROLE_MODES: ReadonlySet<string> = new Set<RoleMode>([
    'developer',
    'reviewer',
    'tester',
    'po',
    'incident',
    'planner',
]);

/** Max knowledge slice refs handed to one subagent (minimal-slice cap). */
export const MAX_KNOWLEDGE_REFS = 5;
/** Max personas overlaid on one subagent. */
export const MAX_PERSONAS = 2;

export interface SpawnSelection {
    task: string;
    /** Role-mode contract the subagent runs under, or null for none. */
    role_mode?: RoleMode | null;
    /** Active profile id (e.g. 'developer', 'content_creator'), or null. */
    profile?: string | null;
    /** Persona ids (review lenses) cited by the task's skill, capped. */
    personas?: string[];
    /** Knowledge slice REFERENCES (ids / paths) — never inline bodies. */
    knowledge_refs?: string[];
    /**
     * Hard per-worker token stop-loss (L0b), resolved from the worker's tier
     * via `worker_budget.budgetForTier`. Null/absent = orchestrator did not
     * set one (legacy dispatch).
     */
    max_tokens_per_worker?: number | null;
}

export interface SpawnBrief {
    task: string;
    role_mode: RoleMode | null;
    profile: string | null;
    personas: string[];
    knowledge_refs: string[];
    /** Per-worker token stop-loss; null = unset (legacy dispatch). */
    max_tokens_per_worker: number | null;
    /**
     * Token count at which the worker emits a CHECKPOINT capsule — DERIVED from
     * `max_tokens_per_worker`, never set independently, so the watermark cannot
     * drift away from the budget it sits under. Null when no budget is set.
     */
    capsule_watermark: number | null;
    warnings: string[];
}

/** A ref is acceptable only if it looks like an id/path token, not a body. */
function isRefLike(s: unknown): s is string {
    return typeof s === 'string' && s.length > 0 && s.length <= 200 && !s.includes('\n');
}

/**
 * Compose a validated spawn brief. Invalid role-mode → dropped to null;
 * personas capped at {@link MAX_PERSONAS}; knowledge refs filtered to
 * ref-like tokens and capped at {@link MAX_KNOWLEDGE_REFS}. Anything dropped is
 * recorded in `warnings` (surfaced, never silent).
 */
export function composeSpawnBrief(sel: SpawnSelection): SpawnBrief {
    const warnings: string[] = [];

    let role_mode: RoleMode | null = null;
    if (sel.role_mode != null) {
        if (ROLE_MODES.has(sel.role_mode)) role_mode = sel.role_mode;
        else warnings.push(`unknown role_mode '${sel.role_mode}' dropped`);
    }

    const personasIn = sel.personas ?? [];
    let personas = personasIn.filter((p) => typeof p === 'string' && p.length > 0);
    if (personas.length > MAX_PERSONAS) {
        warnings.push(`personas capped ${personas.length} → ${MAX_PERSONAS}`);
        personas = personas.slice(0, MAX_PERSONAS);
    }

    const refsIn = sel.knowledge_refs ?? [];
    const bodyLike = refsIn.filter((r) => !isRefLike(r));
    if (bodyLike.length > 0) {
        warnings.push(`${bodyLike.length} non-ref knowledge entr${bodyLike.length === 1 ? 'y' : 'ies'} rejected (refs only, no bodies)`);
    }
    let knowledge_refs = refsIn.filter(isRefLike);
    if (knowledge_refs.length > MAX_KNOWLEDGE_REFS) {
        warnings.push(`knowledge refs capped ${knowledge_refs.length} → ${MAX_KNOWLEDGE_REFS}`);
        knowledge_refs = knowledge_refs.slice(0, MAX_KNOWLEDGE_REFS);
    }

    let max_tokens_per_worker: number | null = null;
    if (sel.max_tokens_per_worker != null) {
        if (Number.isInteger(sel.max_tokens_per_worker) && sel.max_tokens_per_worker > 0) {
            max_tokens_per_worker = sel.max_tokens_per_worker;
        } else {
            warnings.push(`invalid max_tokens_per_worker '${sel.max_tokens_per_worker}' dropped (positive integer required)`);
        }
    }

    return {
        task: sel.task,
        role_mode,
        profile: sel.profile ?? null,
        personas,
        knowledge_refs,
        max_tokens_per_worker,
        capsule_watermark:
            max_tokens_per_worker === null
                ? null
                : Math.floor(max_tokens_per_worker * CAPSULE_WATERMARK_FRACTION),
        warnings,
    };
}

// ── Prefix-stable payload serialization (road-to-lean-agent-init Phase 4) ──

/**
 * Serialize a brief into the spawn payload with DETERMINISTIC ordering:
 * static prefix first (role contract, profile, personas, budget — stable
 * across dispatches of the same configuration), variable task part last.
 * No timestamps, no random IDs — the prefix is byte-identical for identical
 * configurations, which is what provider prompt-caching keys on. The
 * `cache_hit` audit field records whether the provider actually reused it;
 * measurement only — no savings claim without provider-response evidence.
 */
export function serializeSpawnPayload(brief: SpawnBrief): string {
    const staticPrefix = JSON.stringify({
        role_mode: brief.role_mode,
        profile: brief.profile,
        personas: brief.personas,
        max_tokens_per_worker: brief.max_tokens_per_worker,
        capsule_watermark: brief.capsule_watermark,
    });
    const variableTail = JSON.stringify({
        task: brief.task,
        knowledge_refs: brief.knowledge_refs,
    });
    return `${staticPrefix}\n${variableTail}`;
}

/**
 * Hex digest of a serialized payload — the `payload_hash` audit field
 * (never content; 16 hex chars satisfy the audit schema's 8–64 window).
 */
export function spawnPayloadHash(payload: string): string {
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
}

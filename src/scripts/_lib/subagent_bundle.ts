/**
 * Subagent bundle resolver (Phase 2 / A2).
 *
 * Pure, no-I/O. Maps a task slice to a concrete subagent bundle by selecting
 * from the EXISTING surfaces — role-modes, the `judge-*` review-lens skills,
 * personas, knowledge-card refs, and an ADR-035 tier — instead of a new parallel
 * registry. Feeds `composeSpawnBrief` (subagent_spawn.ts) real values.
 *
 * Contract: `src/agent-src/contexts/execution/subagent-spawn-contract.md`.
 *
 * ADR-100 guard: proprietary knowledge-card refs never enter a cross-project
 * subagent bundle. The resolver drops them and records the drop.
 */

import type { RoleMode, SpawnSelection } from './subagent_spawn.js';

export type Tier = 'lite' | 'medium' | 'high' | 'inherit';

/** The well-known delegable slice kinds and their lens/role/tier mapping. */
export type SliceKind =
    | 'review'
    | 'security'
    | 'tests'
    | 'bug-hunt'
    | 'research'
    | 'docs'
    | 'refactor'
    | 'plan';

interface KindProfile {
    /** Reuse a `judge-*` skill as a ready-made subagent role-profile, or null. */
    judge_lens: string | null;
    role_mode: RoleMode | null;
    tier: Tier;
}

/**
 * Slice-kind → bundle profile. The `judge-*` skills are reused as subagent
 * role-profiles (the package already ships them as review lenses).
 */
const KIND_PROFILE: Record<SliceKind, KindProfile> = {
    review: { judge_lens: 'judge-code-quality', role_mode: 'reviewer', tier: 'medium' },
    security: { judge_lens: 'judge-security-auditor', role_mode: 'reviewer', tier: 'high' },
    tests: { judge_lens: 'judge-test-coverage', role_mode: 'tester', tier: 'medium' },
    'bug-hunt': { judge_lens: 'judge-bug-hunter', role_mode: 'developer', tier: 'medium' },
    research: { judge_lens: null, role_mode: null, tier: 'lite' },
    docs: { judge_lens: null, role_mode: null, tier: 'lite' },
    refactor: { judge_lens: null, role_mode: 'developer', tier: 'high' },
    plan: { judge_lens: null, role_mode: 'planner', tier: 'high' },
};

/** A knowledge-card ref tagged with its sharing tier (ADR-100). */
export interface KnowledgeRef {
    ref: string;
    tier: 'public' | 'vendor' | 'proprietary';
}

export interface SliceInput {
    kind: SliceKind;
    task: string;
    /** Active profile id (e.g. 'developer'), inherited from the session unless overridden. */
    profile?: string | null;
    /** Persona ids cited by the task's skill. */
    personas?: string[];
    /** Candidate knowledge-card refs (tier-tagged) for this slice. */
    knowledge?: KnowledgeRef[];
    /** Will this bundle be visible across project boundaries? */
    cross_project?: boolean;
}

export interface ResolvedBundle {
    selection: SpawnSelection;
    judge_lens: string | null;
    tier: Tier;
    dropped_proprietary: number;
    reason: string;
}

/**
 * ADR-100 guard: keep refs whose tier is shareable in the bundle's visibility
 * scope. In a cross-project bundle, `proprietary` refs are dropped.
 */
export function filterKnowledgeByPolicy(
    knowledge: KnowledgeRef[],
    cross_project: boolean,
): { kept: string[]; dropped: number } {
    const kept: string[] = [];
    let dropped = 0;
    for (const k of knowledge) {
        if (cross_project && k.tier === 'proprietary') {
            dropped += 1;
            continue;
        }
        kept.push(k.ref);
    }
    return { kept, dropped };
}

/**
 * Resolve a task slice into a subagent bundle: role-mode + reused judge lens +
 * personas + ADR-100-filtered knowledge refs + tier. The result's `selection`
 * is ready for `composeSpawnBrief`.
 */
export function resolveBundle(slice: SliceInput): ResolvedBundle {
    const profile = KIND_PROFILE[slice.kind];
    const cross = slice.cross_project === true;
    const { kept, dropped } = filterKnowledgeByPolicy(slice.knowledge ?? [], cross);

    // The reused judge lens rides as a persona-equivalent so the subagent loads it.
    const personas = [...(slice.personas ?? [])];
    if (profile.judge_lens && !personas.includes(profile.judge_lens)) {
        personas.unshift(profile.judge_lens);
    }

    const selection: SpawnSelection = {
        task: slice.task,
        role_mode: profile.role_mode,
        profile: slice.profile ?? null,
        personas,
        knowledge_refs: kept,
    };

    const reasonParts = [`kind=${slice.kind}`, `tier=${profile.tier}`];
    if (profile.judge_lens) reasonParts.push(`lens=${profile.judge_lens}`);
    if (dropped > 0) reasonParts.push(`dropped ${dropped} proprietary (cross-project)`);

    return {
        selection,
        judge_lens: profile.judge_lens,
        tier: profile.tier,
        dropped_proprietary: dropped,
        reason: reasonParts.join(' · '),
    };
}

/**
 * Auditable bundle signature for the orchestration-telemetry object — counts +
 * ids only, never bodies (preserves the audit-log privacy floor).
 */
export function bundleAuditLine(b: ResolvedBundle): {
    role_mode: RoleMode | null;
    judge_lens: string | null;
    tier: Tier;
    knowledge_ref_count: number;
    dropped_proprietary: number;
} {
    return {
        role_mode: b.selection.role_mode ?? null,
        judge_lens: b.judge_lens,
        tier: b.tier,
        knowledge_ref_count: b.selection.knowledge_refs?.length ?? 0,
        dropped_proprietary: b.dropped_proprietary,
    };
}

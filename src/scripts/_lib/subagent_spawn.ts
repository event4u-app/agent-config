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
}

export interface SpawnBrief {
    task: string;
    role_mode: RoleMode | null;
    profile: string | null;
    personas: string[];
    knowledge_refs: string[];
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

    return {
        task: sel.task,
        role_mode,
        profile: sel.profile ?? null,
        personas,
        knowledge_refs,
        warnings,
    };
}

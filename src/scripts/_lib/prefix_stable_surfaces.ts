/**
 * The canonical prefix-stable surface set — one list, loaded by every gate
 * that needs it, restated by none.
 *
 * WHAT A PREFIX-STABLE SURFACE IS
 * -------------------------------
 * Bytes that sit in the cached prompt prefix of every dispatch. Rewriting them
 * mid-session invalidates the cache for the remainder of that session, so the
 * next call pays the cache-WRITE rate over the whole prefix instead of the
 * cache-READ rate. That is the cost this list exists to bound; it is not a
 * correctness claim about the content.
 *
 * WHY THE LIST LIVES HERE AND NOT IN A GATE
 * -----------------------------------------
 * `check_preamble_payload_budget` measured these three buckets first and stated
 * their roots twice inside its own file — once to drive the census, once as the
 * `roots:` argument to the dead-scope guard. A second gate restating them a
 * third time is the recorded drift shape this repository already pays for
 * elsewhere: two lists describing one boundary diverge, and each gate then
 * guards a set the other no longer measures. So the roots move here and both
 * gates import them.
 *
 * SCOPE — decided, with the reopen condition recorded
 * ---------------------------------------------------
 * Council 2026-08-28 (2/2 convergent, anthropic + openai, 2 rounds) resolved
 * `road-to-runtime-context-floors`'s `which-surfaces-are-prefix-stable` blocker
 * as option (c): the declared set is the three buckets the payload budget
 * already measures, and the widening to "every surface a hook can write that
 * reaches standing context" is recorded as an explicit reopen condition rather
 * than enumerated now. Enumerating carriers that do not exist would be
 * enumerating a plan.
 *
 * REOPEN — see `docs/contracts/prefix-stable-surfaces.md` § Reopen condition.
 * A change that lands a hook or resident-process carrier able to write standing
 * context outside these three roots must add it here in the same change.
 */

export interface PrefixStableSurface {
    /** Stable identifier; the mutation gate names it in its findings. */
    id: string;
    /** Repo-relative root. A directory root covers everything beneath it. */
    root: string;
    kind: 'dir' | 'file';
    /** Human-readable bucket name, as the payload budget reports it. */
    bucket: string;
    /** Why these bytes are in the cached prefix. */
    why: string;
}

/**
 * The declared set. Order is the order the payload budget reports its buckets,
 * so a reader comparing the two outputs sees the same sequence.
 */
export const PREFIX_STABLE_SURFACES: readonly PrefixStableSurface[] = [
    {
        id: 'project-scope-rules',
        root: 'dist/agent-src/rules',
        kind: 'dir',
        bucket: 'project-scope rules',
        why: 'Every always-loaded rule body is re-written into the preamble on every spawn.',
    },
    {
        id: 'preloaded-skills-catalog',
        root: 'dist/agent-src/skills',
        kind: 'dir',
        bucket: 'preloaded skills catalog',
        why: 'Skill names and descriptions are catalogued into the preamble on every spawn.',
    },
    {
        id: 'project-claude-md',
        root: 'CLAUDE.md',
        kind: 'file',
        bucket: 'CLAUDE.md hierarchy (project only)',
        why: 'The project half of the CLAUDE.md hierarchy is injected ahead of the first user turn.',
    },
    {
        id: 'project-claude-local-md',
        root: 'CLAUDE.local.md',
        kind: 'file',
        bucket: 'CLAUDE.md hierarchy (project only)',
        why: 'The gitignored project-local override is injected on the same path as CLAUDE.md.',
    },
] as const;

/**
 * The re-arm events. A rebuilt prefix is expected and paid for once at each of
 * these boundaries, so a write declared against one is not a mid-session
 * mutation. Anything not listed here fires mid-session.
 */
export const RE_ARM_EVENTS: readonly string[] = ['session_start', 'pre_compact'] as const;

/** Roots only, in declaration order — the shape `assertScanned` wants. */
export function prefixStableRoots(): string[] {
    return PREFIX_STABLE_SURFACES.map((s) => s.root);
}

/** Directory roots only — the shape the payload census walks. */
export function prefixStableDirRoots(): string[] {
    return PREFIX_STABLE_SURFACES.filter((s) => s.kind === 'dir').map((s) => s.root);
}

function normalise(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

/**
 * Does `target` (a repo-relative path, or a path literal lifted out of source)
 * resolve inside a declared surface? Returns the surface, or `null`.
 *
 * Deliberately substring-free: a literal must match a root exactly, or sit
 * beneath a directory root at a path separator. `dist/agent-src/rules-backup`
 * is NOT inside `dist/agent-src/rules`.
 */
export function surfaceFor(target: string): PrefixStableSurface | null {
    const t = normalise(target);
    if (t === '') return null;
    for (const s of PREFIX_STABLE_SURFACES) {
        const root = normalise(s.root);
        if (t === root) return s;
        if (s.kind === 'dir' && t.startsWith(root + '/')) return s;
    }
    return null;
}

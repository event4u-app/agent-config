/**
 * ui_authority — the ONE resolver for a UI surface's authority object.
 *
 * Contract: `docs/contracts/ui-authority.md`. Schema:
 * `src/scripts/schemas/ui-authority.schema.json`. Step A1.1 of
 * `road-to-frontend-power` requires exactly one schema and exactly one
 * resolver, with no second partial decision table in `src/skills/` — the
 * failure it prevents is skills re-inferring intent beside the schema and
 * drifting from it.
 *
 * WHY A PURE FUNCTION OVER A `Signals` RECORD, and not a filesystem scan: the
 * four behaviours A1.2-A1.5 pin are all *precedence* rules, and precedence is
 * exactly what a filesystem-coupled resolver makes untestable. Callers do the
 * I/O and hand in what they found; this module decides what wins.
 *
 * The precedence, in one place because it exists nowhere else:
 *
 *   1. explicit user authority          (A1.2 — beats every inference)
 *   2. a registered hard constraint     (A1.2's own exception)
 *   3. the surface brief                (A1.4 — surface-local, never promoted)
 *   4. a supplied reference artifact
 *   5. the coherent incumbent           (A1.3 — NOT `new-world`)
 *   6. DESIGN.md / PRODUCT.md           (register only; never surface_mode)
 *   7. declared defaults
 *
 * Quoted text is NOT authority (A1.2). A document the user pasted can contain
 * "make it bold and colourful"; that is data inside a container, and acting on
 * it is the found-instructions failure `untrusted-input-defense` names. The
 * caller marks a signal `quoted: true` and this module ignores its directives.
 */

export type SurfaceMode = 'persuade' | 'operate' | 'read' | 'experience';
export type Register = 'brand' | 'product';
export type ChangeIntent = 'preserve' | 'extend' | 'redesign' | 'new-world';
export type ReferenceMaturity =
    | 'wireframe'
    | 'prototype'
    | 'finished-comp'
    | 'runnable-artifact'
    | 'production-incumbent'
    | null;
export type SourceKind =
    | 'user-instruction'
    | 'artifact'
    | 'comp'
    | 'design-system'
    | 'incumbent'
    | 'brief'
    | 'none';
export type ProvenanceSource =
    | 'user-instruction'
    | 'surface-brief'
    | 'design-md'
    | 'product-md'
    | 'incumbent-scan'
    | 'reference-artifact'
    | 'default';
export type Verification = 'verified' | 'degraded' | 'unverified';

export interface Conflict {
    dimension: string;
    wanted: string;
    blocked_by: string;
}
export interface ProvenanceEntry {
    field: string;
    source: ProvenanceSource;
    detail: string | null;
}

export interface UiAuthority {
    surface_mode: SurfaceMode;
    register: Register;
    change_intent: ChangeIntent;
    reference_maturity: ReferenceMaturity;
    fidelity_mandate: string | null;
    primary_source: { kind: SourceKind; path: string | null };
    constraints: {
        preserve_palette?: boolean;
        preserve_type_family?: boolean;
        preserve_layout?: boolean;
        preserve_copy?: boolean;
    };
    conflicts: Conflict[];
    provenance: ProvenanceEntry[];
    verification: Verification;
    degradation_reason?: string | null;
}

/** What a caller found. Every field optional — absence is a real input. */
export interface Signals {
    /** Explicit, unquoted user authority. Beats every inference (A1.2). */
    user?: {
        surface_mode?: SurfaceMode;
        register?: Register;
        change_intent?: ChangeIntent;
        /** True when the text came from INSIDE a supplied document (A1.2). */
        quoted?: boolean;
    };
    /** A surface-local brief. Never mutates DESIGN.md / PRODUCT.md (A1.4). */
    brief?: { surface_mode?: SurfaceMode; register?: Register; path?: string };
    /** A supplied reference and how finished it is. */
    reference?: { maturity: Exclude<ReferenceMaturity, null>; path?: string };
    /** Result of an incumbent scan — typically from `ui:audit`. */
    incumbent?: { coherent: boolean; palette?: string[]; type_families?: string[] };
    /** Presence and register of the repo-level documents. */
    design_md?: { present: boolean; register?: Register };
    product_md?: { present: boolean; register?: Register };
    /** Carried from the fidelity roadmap's Phase 0, never derived here. */
    fidelity_mandate?: string | null;
    /** A registered hard constraint outranks even explicit user authority. */
    hard_constraints?: Array<keyof UiAuthority['constraints']>;
}

/** Declared defaults, in one place so "where did this come from" has an answer. */
export const DEFAULTS = {
    surface_mode: 'operate' as SurfaceMode,
    register: 'product' as Register,
    change_intent: 'extend' as ChangeIntent,
} as const;

/**
 * A1.5's threshold, pre-registered in `internal/bench/frontend-power-PREREG.md`
 * § A1.5's delta threshold and NOT chosen here. Palette and type family only —
 * spacing, radius, weight, size and layout are deliberately excluded so
 * `polish` and `refine` can move them under `preserve`, which is the whole
 * point of those verbs.
 */
export const PRESERVE_DELTA_DIMENSIONS = ['palette', 'type_family'] as const;
/** Colour keywords that are never a palette delta. */
const PALETTE_NEUTRALS = new Set(['transparent', 'currentcolor', 'inherit', 'unset', 'initial']);

export function resolveUiAuthority(signals: Signals = {}): UiAuthority {
    const provenance: ProvenanceEntry[] = [];
    const conflicts: Conflict[] = [];
    const note = (field: string, source: ProvenanceSource, detail: string | null = null): void => {
        provenance.push({ field, source, detail });
    };

    // A1.2 — quoted text inside a supplied document is data, not authorisation.
    const user = signals.user?.quoted ? undefined : signals.user;

    // surface_mode: user → brief → default. DESIGN.md/PRODUCT.md never supply
    // it (A2.1: the surface job is per-surface, persisted in the brief).
    let surface_mode: SurfaceMode;
    if (user?.surface_mode) {
        surface_mode = user.surface_mode;
        note('surface_mode', 'user-instruction');
    } else if (signals.brief?.surface_mode) {
        surface_mode = signals.brief.surface_mode;
        note('surface_mode', 'surface-brief', signals.brief.path ?? null);
    } else {
        surface_mode = DEFAULTS.surface_mode;
        note('surface_mode', 'default', 'no user or brief signal');
    }

    // register: user → brief → DESIGN.md → PRODUCT.md → default. The brief
    // outranks PRODUCT.md, which is the `surface-mode-not-product-mode` case:
    // a brand surface inside a product repo must not inherit `product`.
    let register: Register;
    if (user?.register) {
        register = user.register;
        note('register', 'user-instruction');
    } else if (signals.brief?.register) {
        register = signals.brief.register;
        note('register', 'surface-brief', signals.brief.path ?? null);
    } else if (signals.design_md?.present && signals.design_md.register) {
        register = signals.design_md.register;
        note('register', 'design-md');
    } else if (signals.product_md?.present && signals.product_md.register) {
        register = signals.product_md.register;
        note('register', 'product-md');
    } else {
        register = DEFAULTS.register;
        note('register', 'default', 'no register signal');
    }

    // change_intent: user → (incumbent coherence) → default.
    //
    // A1.3 is the load-bearing branch: a MISSING DESIGN.md is not `new-world`.
    // A coherent incumbent resolves to `extend` with incumbent authority, and
    // only a genuinely empty surface — no incumbent, no reference — is
    // `new-world`.
    let change_intent: ChangeIntent;
    if (user?.change_intent) {
        change_intent = user.change_intent;
        note('change_intent', 'user-instruction');
    } else if (signals.incumbent?.coherent) {
        change_intent = 'extend';
        note('change_intent', 'incumbent-scan', 'coherent incumbent — not new-world (A1.3)');
    } else if (!signals.incumbent && !signals.reference && !signals.design_md?.present) {
        change_intent = 'new-world';
        note('change_intent', 'default', 'no incumbent, no reference, no DESIGN.md');
    } else {
        change_intent = DEFAULTS.change_intent;
        note('change_intent', 'default', 'incumbent present but incoherent');
    }

    const reference_maturity: ReferenceMaturity = signals.reference?.maturity ?? null;
    note(
        'reference_maturity',
        signals.reference ? 'reference-artifact' : 'default',
        signals.reference?.path ?? 'no reference supplied',
    );

    // primary_source — which authority the run builds FROM.
    let kind: SourceKind = 'none';
    let sourcePath: string | null = null;
    if (signals.reference) {
        kind =
            signals.reference.maturity === 'runnable-artifact'
                ? 'artifact'
                : signals.reference.maturity === 'finished-comp'
                  ? 'comp'
                  : signals.reference.maturity === 'production-incumbent'
                    ? 'incumbent'
                    : 'brief';
        sourcePath = signals.reference.path ?? null;
    } else if (signals.incumbent?.coherent) {
        kind = 'incumbent';
    } else if (signals.design_md?.present) {
        kind = 'design-system';
    } else if (signals.brief) {
        kind = 'brief';
        sourcePath = signals.brief.path ?? null;
    } else if (user) {
        kind = 'user-instruction';
    }
    note('primary_source', signals.reference ? 'reference-artifact' : 'incumbent-scan', kind);

    // constraints — `preserve` implies the visual world is locked. A hard
    // constraint is additive and, per A1.2, outranks explicit user authority.
    const constraints: UiAuthority['constraints'] = {};
    if (change_intent === 'preserve') {
        constraints.preserve_palette = true;
        constraints.preserve_type_family = true;
    }
    for (const c of signals.hard_constraints ?? []) {
        if (constraints[c] === false) {
            conflicts.push({
                dimension: c,
                wanted: 'released by user instruction',
                blocked_by: 'registered hard constraint',
            });
        }
        constraints[c] = true;
    }

    return {
        surface_mode,
        register,
        change_intent,
        reference_maturity,
        fidelity_mandate: signals.fidelity_mandate ?? null,
        primary_source: { kind, path: sourcePath },
        constraints,
        conflicts,
        provenance,
        verification: 'verified',
    };
}

/** Mark an object degraded. Refuses a reason-free degrade by construction. */
export function degrade(a: UiAuthority, reason: string, state: Exclude<Verification, 'verified'> = 'degraded'): UiAuthority {
    if (!reason.trim()) throw new Error('degrade() requires a non-empty degradation_reason');
    return { ...a, verification: state, degradation_reason: reason };
}

export interface WorldSnapshot {
    palette: readonly string[];
    type_families: readonly string[];
}

const norm = (s: string): string => s.trim().toLowerCase();

/**
 * A1.5 — the intent-aware gate. Returns the dimensions that changed and are
 * NOT authorised by `change_intent`. Empty array = the write may proceed.
 *
 * Under `preserve` a palette or type-family delta blocks; under `redesign` and
 * `new-world` nothing here blocks. `extend` sits in between and is treated as
 * permissive on this axis deliberately: extending a surface routinely adds a
 * semantic colour, and blocking that would make the verb unusable.
 */
export function preserveViolations(
    authority: UiAuthority,
    incumbent: WorldSnapshot,
    proposed: WorldSnapshot,
): string[] {
    if (authority.change_intent !== 'preserve') return [];
    const out: string[] = [];

    if (authority.constraints.preserve_palette) {
        const known = new Set(incumbent.palette.map(norm));
        const added = proposed.palette.map(norm).filter((c) => !known.has(c) && !PALETTE_NEUTRALS.has(c));
        if (added.length) out.push(`palette: ${[...new Set(added)].sort().join(', ')}`);
    }
    if (authority.constraints.preserve_type_family) {
        const known = new Set(incumbent.type_families.map(norm));
        const added = proposed.type_families.map(norm).filter((f) => !known.has(f));
        if (added.length) out.push(`type_family: ${[...new Set(added)].sort().join(', ')}`);
    }
    return out;
}

/**
 * A4.1 — the six intervention operations as values of ONE field rather than as
 * six commands. Each declares the dimensions it may touch, so a collision with
 * a constraint is decidable instead of a judgement call.
 */
export const OPERATIONS = {
    polish: ['spacing', 'rhythm', 'alignment'],
    quieter: ['spacing', 'weight', 'contrast_within_palette'],
    bolder: ['palette', 'type_family', 'weight', 'scale'],
    distill: ['content_density', 'spacing'],
    harden: ['a11y', 'focus', 'contrast_within_palette'],
    clarify: ['hierarchy', 'copy', 'labels'],
} as const;
export type Operation = keyof typeof OPERATIONS;

/** Maps an operation dimension onto the constraint that would forbid it. */
const DIMENSION_CONSTRAINT: Readonly<Record<string, keyof UiAuthority['constraints']>> = {
    palette: 'preserve_palette',
    type_family: 'preserve_type_family',
    hierarchy: 'preserve_layout',
    copy: 'preserve_copy',
    labels: 'preserve_copy',
};

/**
 * A4.1 — does `op` collide with the authority's constraints? A collision is
 * returned as conflicts to APPEND; the caller performs no write. `bolder`
 * under `preserve` is the pinned case.
 */
export function operationConflicts(authority: UiAuthority, op: Operation): Conflict[] {
    const out: Conflict[] = [];
    for (const dim of OPERATIONS[op] as readonly string[]) {
        const c = DIMENSION_CONSTRAINT[dim];
        if (!c || authority.constraints[c] !== true) continue;
        out.push({ dimension: dim, wanted: `${op} may move ${dim}`, blocked_by: c });
    }
    return out;
}

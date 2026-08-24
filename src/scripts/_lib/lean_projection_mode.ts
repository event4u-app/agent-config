/**
 * `lean_projection.mode` — ONE definition of what the three modes mean.
 *
 * The projector (`condense.ts`) resolves the value with a real YAML parse; the
 * delivery concern (`hooks/rule_inject_hook.ts`) resolves it with an
 * indentation-shaped read, because a hook must never fail a tool call because a
 * parser could not load. Two readers is unavoidable. Two *normalisations* is
 * not, and would be the defect worth preventing: a projector that writes thin
 * files while the concern believes the mode is off delivers pointers and no
 * bodies, which is exactly the 36.2 % arm the delivery mode exists to replace.
 *
 * So each side supplies the raw string from its own reader and this module
 * decides what it means. Anything unrecognised — absent key, typo, `null`,
 * a non-string — is `eager-all`, today's shipped behaviour: a mode nobody can
 * spell must never silently thin the standing corpus.
 */

/** The three projection shapes. `eager-all` is the shipped default. */
export type LeanProjectionMode = 'eager-all' | 'thin' | 'delivery';

export const DEFAULT_LEAN_PROJECTION_MODE: LeanProjectionMode = 'eager-all';

/** Map a raw settings value onto a mode. Unrecognised → `eager-all`. */
export function normalizeLeanProjectionMode(raw: unknown): LeanProjectionMode {
    const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (v === 'thin') return 'thin';
    if (v === 'delivery') return 'delivery';
    return DEFAULT_LEAN_PROJECTION_MODE;
}

/**
 * True when the projector writes pointer stubs instead of bodies.
 *
 * `delivery` is a superset of `thin`: it writes the same thin files AND binds
 * the concern that delivers the bodies back on a trigger.
 */
export function writesThinFiles(mode: LeanProjectionMode): boolean {
    return mode === 'thin' || mode === 'delivery';
}

/** True only in the mode where a hook delivers rule bodies at runtime. */
export function deliversBodies(mode: LeanProjectionMode): boolean {
    return mode === 'delivery';
}

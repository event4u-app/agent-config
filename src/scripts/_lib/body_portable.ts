/**
 * `body-portable` — does a skill's declared frontmatter survive the MCP-lite
 * carrier whole?
 *
 * road-to-semantic-parity-before-off-menu, Phase 2.1.
 *
 * WHAT THIS DECIDES, AND WHAT IT DOES NOT
 *
 * It decides ELIGIBILITY only. It marks nothing, excludes nothing, and is not a
 * verdict about which skills matter. A committed list of skills this returns
 * false for is one step from a menu-exclusion discharged by citing it, which is
 * precisely the laundering the parked menu-economy roadmap's Risk 1 names — a
 * measurement of carrier coverage reused as a judgement about worth. Nothing in
 * the tree consumes this as an exclusion trigger, and building the half that
 * could is a separate decision that has not been taken.
 *
 * THE RULE
 *
 * A skill is body-portable when every key it declares is one the carrier
 * transports whole. Three ways to fail, and they are deliberately not
 * distinguished in the boolean:
 *
 *   - a DROPPED key — the carrier never reads it, so the semantic stays on disk.
 *   - a PARTIAL key — the carrier reads it and transports part of the value.
 *     `triggers` is the only one: `keyword` and `phrase` travel, while
 *     `file_pattern`, `path_prefix`, `command` and `reason` do not. Counting it
 *     as portable would make a path-triggered skill look complete when the very
 *     routing that selects it never leaves the disk.
 *   - an UNKNOWN key — one the schema does not declare at all. It fails CLOSED.
 *     The alternative is to ignore what you cannot classify, and an unknown key
 *     is exactly the case where the carrier's behaviour is unestablished, so
 *     returning true there would assert portability from ignorance.
 *
 * SCOPE: one carrier, `ContentEntry` in `src/cli/mcp/content.ts`. A second
 * delivery path drops a different set and needs its own predicate rather than a
 * widened reading of this one.
 */

/**
 * Frontmatter keys `buildEntry` reads and transports whole
 * (`src/cli/mcp/content.ts` — `fm.name`, `fm.description`, `fm.source`,
 * `fm.personas`).
 *
 * Derived from the carrier source, never from the schema: a schema property the
 * carrier does not read is dropped no matter what the schema says about it.
 */
export const CARRIED_KEYS: readonly string[] = ['name', 'description', 'source', 'personas'];

/**
 * Keys the carrier reads but truncates, with the sub-keys that actually travel
 * (`triggerText()` keeps `INDEXED_TRIGGER_KEYS`).
 */
export const PARTIAL_KEYS: Readonly<Record<string, readonly string[]>> = {
    triggers: ['keyword', 'phrase'],
};

/** Why a skill is not body-portable. Empty when it is. */
export interface PortabilityReasons {
    /** Declared keys the carrier transports only in part. */
    readonly partial: readonly string[];
    /** Declared keys the carrier does not read, including keys the schema does not declare. */
    readonly dropped: readonly string[];
}

export interface PortabilityVerdict extends PortabilityReasons {
    readonly portable: boolean;
}

/**
 * Classify one skill's declared frontmatter keys.
 *
 * Pure: it reads nothing and depends only on its argument and the two constants
 * above.
 */
export function classifyPortability(frontmatter: Readonly<Record<string, unknown>>): PortabilityVerdict {
    const partial: string[] = [];
    const dropped: string[] = [];

    for (const key of Object.keys(frontmatter).sort()) {
        if (CARRIED_KEYS.includes(key)) continue;
        if (key in PARTIAL_KEYS) {
            partial.push(key);
            continue;
        }
        // Dropped, and an unknown key lands here too — failing closed.
        dropped.push(key);
    }

    return { portable: partial.length === 0 && dropped.length === 0, partial, dropped };
}

/** The predicate itself. `true` only when nothing the skill declares is lost. */
export function isBodyPortable(frontmatter: Readonly<Record<string, unknown>>): boolean {
    return classifyPortability(frontmatter).portable;
}

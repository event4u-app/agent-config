/**
 * What makes a skill arrive — `road-to-skills-that-arrive-when-called` 4.2.
 *
 * THE WHOLE POINT IS THE NEGATIVE. A skill is materialised when a deterministic
 * package entry point NAMES it, and never when a model guesses it might be
 * useful. ADR-263 records skills here as explicitly invoked reference material,
 * and the activation census counted zero model invocations over 30 sessions —
 * so "the model thought of it" is not a trigger this package has, and inventing
 * one would be the single change that turns an on-demand install into an
 * unbounded one.
 *
 * THREE KINDS, AND EACH ONE IS AN ENTRY POINT THAT ALREADY EXISTS (K6: no new
 * verbs):
 *
 *   `command-expanded`  a command or skill body was expanded and its `skills:`
 *                       / `requires_skills:` frontmatter names the skill. This
 *                       is the edge data `report_skill_menu_census` already
 *                       walks, and the same closure 6.3 taught the installer.
 *   `search-read`       a search answer was READ — not merely returned. A
 *                       ranked list is a pointer; the read is the commitment,
 *                       so the row the caller opened is the trigger and the
 *                       other nine rows are not.
 *   `called-by-name`    the name was typed, by the user or by a command.
 *
 * A fourth value exists only to be refused: `model-suggested` is accepted by the
 * type so a caller cannot smuggle one in under another label, and
 * {@link triggeredNames} returns nothing for it.
 */

export type TriggerKind = 'command-expanded' | 'search-read' | 'called-by-name' | 'model-suggested';

export interface Trigger {
    kind: TriggerKind;
    /**
     * Names the trigger carries. For `command-expanded` these are the declared
     * dependencies of the artefact that expanded; for `search-read` the single
     * row that was read; for `called-by-name` the one name.
     */
    names: readonly string[];
    /** The artefact that produced the trigger, for the refusal message. */
    source?: string;
}

/** Trigger kinds that may materialise. `model-suggested` is deliberately absent. */
export const DETERMINISTIC_KINDS: ReadonlySet<TriggerKind> = new Set<TriggerKind>([
    'command-expanded',
    'search-read',
    'called-by-name',
]);

/**
 * The names a trigger may materialise: sorted, de-duplicated, empty for a
 * non-deterministic kind.
 *
 * `installed` is the set already on disk — a name that is already there is not
 * a materialisation candidate, so the common case does no work at all.
 */
export function triggeredNames(trigger: Trigger, installed: ReadonlySet<string>): string[] {
    if (!DETERMINISTIC_KINDS.has(trigger.kind)) return [];
    const out = new Set<string>();
    for (const n of trigger.names) {
        const name = n.trim();
        if (name === '' || installed.has(name)) continue;
        out.add(name);
    }
    return [...out].sort();
}

/**
 * Declared skill dependencies of one artefact's frontmatter.
 *
 * Both keys, because 6.3's closure keeps both and a trigger that read only one
 * of them would materialise a different set than the installer keeps.
 */
export function declaredSkills(frontmatter: string): string[] {
    const out = new Set<string>();
    for (const key of ['skills', 'requires_skills']) {
        // `key: [a, b]` and a block list both occur in this tree.
        const inline = new RegExp(`^${key}:[ \\t]*\\[([^\\]]*)\\]`, 'm').exec(frontmatter);
        if (inline !== null) {
            for (const part of inline[1]!.split(',')) {
                const v = part.trim().replace(/^["']|["']$/g, '');
                if (v !== '') out.add(v);
            }
            continue;
        }
        const block = new RegExp(`^${key}:[ \\t]*\\n((?:[ \\t]*-[ \\t]*.*\\n?)+)`, 'm').exec(frontmatter);
        if (block !== null) {
            for (const line of block[1]!.split('\n')) {
                const m = /^[ \t]*-[ \t]*(.+?)[ \t]*$/.exec(line);
                if (m) out.add(m[1]!.replace(/^["']|["']$/g, ''));
            }
        }
    }
    return [...out].sort();
}

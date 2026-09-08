/**
 * Roadmap `status:` values this repository has RETIRED, and the diagnostic a
 * reader gets when one survives in a file.
 *
 * `status: carrier` was deleted by ADR-262. It had two jobs welded together: a
 * structural one (this roadmap is the live destination of an archived parent's
 * `[~]` carries) and an authority one (an autonomous run may not act on it
 * until a human flips it to `ready`). The second was authored by the repository
 * about its own maintainer, was enforced by nothing, and contradicted the drain
 * command's own FORBIDDEN NON-HALT REASONS. The first is a property of the
 * deferral EDGES, which `lint_deferral_integrity` already verifies from both
 * ends, so nothing was left for a node-level status to carry.
 *
 * Deleting a vocabulary term silently is the failure this module exists to
 * prevent: an old file would keep a value nothing reads, and the next author
 * would infer a meaning from its presence. So a retired value is REJECTED with
 * a migration diagnostic rather than ignored.
 *
 * The read is frontmatter-scoped on purpose, and that is inherited rather than
 * newly decided: a fenced `status: carrier` inside a roadmap documenting the
 * syntax is not a declaration, and a body-wide match turned exactly that into a
 * hard failure before a review caught it.
 */

/** Retired `status:` values, mapped to the record that retired each one. */
export const RETIRED_STATUS_VALUES: ReadonlyMap<string, string> = new Map([
    ['carrier', 'ADR-262'],
]);

/** The leading `---\n…\n---` block, or null when the text carries none. */
export function frontmatterBlock(text: string): string | null {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    return m === null ? null : (m[1] ?? '');
}

/** The frontmatter `status:` value, lower-cased, or null when absent. */
export function frontmatterStatus(text: string | null | undefined): string | null {
    if (text === null || text === undefined) {
        return null;
    }
    const fm = frontmatterBlock(text);
    if (fm === null) {
        return null;
    }
    const m = /^status:[ \t]*([A-Za-z-]+)[ \t]*$/m.exec(fm);
    return m === null ? null : (m[1] ?? '').toLowerCase();
}

/**
 * The retired value this text declares, or null when it declares none.
 *
 * Returns the value rather than a boolean so the caller can name it in the
 * diagnostic — "status: carrier is retired" is actionable, "invalid status" is
 * not.
 */
export function declaresRetiredStatus(text: string | null | undefined): string | null {
    const status = frontmatterStatus(text);
    if (status === null) {
        return null;
    }
    return RETIRED_STATUS_VALUES.has(status) ? status : null;
}

/** The migration diagnostic for a retired value. Names the record and the fix. */
export function retiredStatusDiagnostic(value: string): string {
    const record = RETIRED_STATUS_VALUES.get(value) ?? 'a decision record';
    return (
        `declares the retired \`status: ${value}\`, deleted by ${record}. ` +
        'A `status:` value no longer decides whether an autonomous run may act on ' +
        'a roadmap. Use `status: ready` and put any genuine human-ACTION gate in a ' +
        '`## Blockers` entry, or park the file under `agents/roadmaps/later/` with ' +
        'an `entry_condition`. Both are read by a gate; a status is not.'
    );
}

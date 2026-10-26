/**
 * Regex and index access helpers for the schema-erd parsers.
 *
 * `noUncheckedIndexedAccess` types every capture group and every array index as
 * possibly `undefined`, which is correct — an optional group really can be
 * absent, and a string index past the end really is nothing. These two helpers
 * make the intent explicit at each site instead of casting the check away:
 *
 *   `req` — the group is guaranteed by the pattern shape (a non-optional group
 *           in a pattern that matched). Absent means the pattern was edited and
 *           the code no longer agrees with it, so it throws rather than
 *           silently parsing a schema wrong.
 *   `opt` — the group is genuinely optional; absent maps to `null`.
 */

export function req(m: RegExpExecArray | RegExpMatchArray, index: number): string {
    const v = m[index];
    if (v === undefined) {
        throw new Error(
            `schema-erd: capture group ${index} is absent from a pattern that matched — ` +
                'the regex and its reader have drifted apart.',
        );
    }
    return v;
}

export function opt(m: RegExpExecArray | RegExpMatchArray, index: number): string | null {
    return m[index] ?? null;
}

/** A character at an index, or the empty string past the end of the input. */
export function at(text: string, index: number): string {
    return text[index] ?? '';
}

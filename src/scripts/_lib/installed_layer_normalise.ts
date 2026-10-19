/**
 * Make the installed-layer character measurement independent of where the
 * package happens to live on the machine that measured it.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A CEILING. D7 of
 * `road-to-an-installed-layer-that-is-thinned` records that a ceiling over the
 * installed layer "may not rest on a STORED baseline, in any shape, until the
 * measurement is environment-independent", and names two acceptable forms: a
 * normalised total, or a base-ref comparison that stores nothing. This module
 * is the first form and nothing more — it changes what the report CAN be read
 * against and introduces no gate, no threshold and no stored number. The
 * ratchet the council returned REQUEST_CHANGES on (2026-10-12, one seat
 * present) was a stored baseline over an UN-normalised figure; that mechanism
 * is untouched here and stays rejected.
 *
 * THE DEFECT, CONCRETELY. Every thinned stub the installer writes ends in an
 * absolute body pointer built by `absoluteBodyLinkPrefix`, so the layer's
 * character total moves by one character per stub for every character of
 * package-root prefix — 89 characters per character on the real corpus. A
 * number that moves with the runner's directory name measures the runner as
 * much as the corpus, which is why `estate-count-budget.json` was deleted from
 * this repository.
 *
 * SUBSTITUTED, NOT STRIPPED. Every absolute path becomes a fixed-width token
 * rather than vanishing, so the figure still accounts for the fact that a
 * pointer is there. Stripping would make a stub with a pointer and a stub
 * without one read alike, which is a different measurement than the one a
 * ceiling wants.
 *
 * THE NORMALISED FIGURE IS NOT "WHAT THE HOST LOADS". The host loads the real
 * text, absolute path and all, and {@link
 * import('./installed_layer.js').LayerReading.chars} stays the figure for that
 * question. This one answers "is the corpus growing", which is the only
 * question a comparison across two machines or two revisions can honestly ask.
 */

/**
 * What every absolute path is replaced with.
 *
 * Fixed width by construction — it contains no path separator, which is also
 * what makes {@link normaliseLayerText} idempotent.
 */
export const ABSOLUTE_PATH_TOKEN = '<abs>';

/**
 * A POSIX absolute path: two or more `/`-led segments.
 *
 * TWO, NOT ONE. A single segment admits ordinary prose — `and/or`, a bare
 * `/rules` in a sentence — and a one-segment path cannot carry a root prefix
 * long enough to be the drift this module is about.
 *
 * The lookbehind refuses a start that is already inside something: a word
 * character (so `and/or` is prose), another separator (so the `//` of a URL
 * authority is not entered), and `:` (so a scheme is not split).
 */
const POSIX_ABSOLUTE = /(?<![A-Za-z0-9._~%@+:/\\-])(?:\/[A-Za-z0-9._@+~-]+){2,}/g;

/**
 * A Windows drive path. The installer runs there too, and its pointer carries
 * the same drift with `\` for `/`.
 */
const WINDOWS_ABSOLUTE = /(?<![A-Za-z0-9._~%@+:/\\-])[A-Za-z]:(?:[\\/][A-Za-z0-9._@+~-]+)+/g;

/**
 * Substitute every absolute-path occurrence in one rule's loaded text.
 *
 * Pure, total and idempotent: the token contains no separator, so a second
 * pass finds nothing left to replace. Callers measure `.length` of the result;
 * they never ship it as text a host reads.
 */
export function normaliseLayerText(text: string): string {
    return text
        .replace(WINDOWS_ABSOLUTE, ABSOLUTE_PATH_TOKEN)
        .replace(POSIX_ABSOLUTE, ABSOLUTE_PATH_TOKEN);
}

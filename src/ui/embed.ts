/**
 * Embed-mode boot flag (reciprocal-ecosystem embed contract, Phase 1).
 *
 * A host that renders AC's settings surface inside its own window opens
 * the page with `?embed=1`. Under embed, AC hides its standalone chrome
 * (the top nav + brand + theme toggle) because the host owns navigation
 * and theme; every settings surface, form, and save path stays
 * byte-identical. Without the flag the standalone GUI is unchanged.
 *
 * Read once at boot from the page URL — alongside the token read in
 * `main.tsx` and the `?theme=` read in the `index.html` pre-paint stamp.
 * `src/ui/**` is a browser bundle, so this module stays free of Node
 * built-ins and I/O.
 */

/** Read the `?embed=1` flag from the current page URL. */
export function readEmbed(): boolean {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('embed') === '1';
}

/** `true` when the page was opened with `?embed=1`. */
export const embed = readEmbed();

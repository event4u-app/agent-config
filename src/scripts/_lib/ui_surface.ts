/**
 * ui_surface — the ONE definition of "this path is a UI surface".
 *
 * Three consumers need the same answer and were about to disagree about it:
 * the anti-slop PreToolUse hook (which had the only copy), the UI-turn
 * definition the catalogue analyzer counts against, and the route nudge.
 * A UI-turn rate measured against one extension set and a nudge fired against
 * another would produce a consultation rate that no fix could ever move,
 * because the denominator and the trigger would be different populations.
 *
 * `.blade.php` is deliberately part of the set and was absent from the hook's
 * original regex: a two-part extension does not match a `\.(…)$` alternation,
 * so every Blade template — the single largest UI surface in a Laravel
 * consumer — read as a non-UI file. That is why `isUiPath` matches on the
 * path tail rather than on `path.extname`, which returns `.php` for
 * `page.blade.php` and would silently reproduce the same hole.
 */

/** Single-segment UI extensions, without the leading dot. */
export const UI_EXTENSIONS = [
    'html',
    'htm',
    'css',
    'scss',
    'sass',
    'less',
    'vue',
    'svelte',
    'astro',
    'jsx',
    'tsx',
] as const;

/**
 * Multi-segment UI suffixes. These cannot be expressed as an extension
 * alternation — `path.extname('x.blade.php')` is `.php`.
 */
export const UI_COMPOUND_SUFFIXES = ['.blade.php'] as const;

/** Equivalent to the historical hook regex, plus the compound suffixes. */
export const UI_EXT = new RegExp(
    `(\\.(${UI_EXTENSIONS.join('|')})|${UI_COMPOUND_SUFFIXES.map((s) => s.replace(/\./g, '\\.')).join('|')})$`,
    'i',
);

/** True when `p` names a file on a UI surface. Case-insensitive. */
export function isUiPath(p: string): boolean {
    return UI_EXT.test(p);
}

/**
 * Directory fragments that mark a UI tree across frameworks. The two UI rules
 * carried only the Laravel pair (`resources/views/`, `resources/js/`), so a
 * React, Vue, Next or Svelte consumer writing to `src/components/` matched no
 * path trigger at all. Kept as fragments, not anchored prefixes: a consumer's
 * UI tree is rarely at the repo root.
 *
 * `app/` is deliberately NOT in this list although it is the Next.js router
 * directory. In a Laravel consumer `app/` is the entire backend, so the
 * fragment would fire on every controller, model and job — a trigger that
 * over-fires on the largest directory of a whole ecosystem is worse than the
 * gap it closes. Next.js route files are caught by extension instead
 * (`page.tsx`, `layout.tsx` match `isUiPath`), which is the precise signal.
 */
export const UI_PATH_FRAGMENTS = [
    'resources/views/',
    'resources/js/',
    // `components/` already subsumes `src/components/` under substring
    // matching — listing both here would be dead weight. The rules' own
    // `path_prefix` list keeps both because matching there is anchored.
    'components/',
    'pages/',
] as const;

/**
 * Fragments that sit INSIDE a UI tree and are not UI. Checked first, because a
 * substring fragment cannot express "pages/ but not pages/api/" on its own —
 * and `pages/api/` is server-only Next.js code, the exact over-fire the `app/`
 * exclusion above exists to avoid. Leaving it in would have put backend files
 * in the pre-registered UI-turn denominator, which is worse than the nudge
 * firing on them: a rate is harder to un-break than a warning.
 */
export const UI_TREE_EXCLUSIONS = ['pages/api/'] as const;

/**
 * True when `p` sits inside a conventional UI tree.
 *
 * Note this does NOT require a UI extension — that is the point: a `.js` file
 * under `resources/js/` is UI. The cost is that a non-code file in a UI tree
 * (a README, a fixture) also matches; callers that need the narrower answer
 * combine this with `isUiPath`.
 */
export function isUiTreePath(p: string): boolean {
    const normalized = p.replace(/\\/g, '/').toLowerCase();
    if (UI_TREE_EXCLUSIONS.some((fragment) => normalized.includes(fragment))) return false;
    return UI_PATH_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

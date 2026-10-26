/**
 * DQ7 candidate — a translucent material with no fallback for the users who
 * asked for less transparency or more contrast (road-to-a-control-that-matches-
 * its-neighbours 5.5). SHADOW: `lint_design_quality --shadow` reports it on its
 * own line and it never changes the exit code, until a shadow reading shows it
 * holds on legitimate code.
 *
 * Objective in the same sense as DQ4: a `backdrop-filter`, or a background whose
 * alpha is below 1, inside a stylesheet that has NO `prefers-reduced-transparency`
 * route, or NO `prefers-contrast` route. The recommended form is additive — an
 * opaque base, translucency only under `prefers-reduced-transparency:
 * no-preference` — because one engine does not support the query yet, and the
 * additive form is correct there by construction.
 */

export interface MaterialFinding {
    rule: 'dq7-material-fallback';
    line: number;
    missing: Array<'prefers-reduced-transparency' | 'prefers-contrast'>;
    snippet: string;
}

const TRANSLUCENT = [
    /backdrop-filter\s*:(?!\s*none\b)\s*[^;\s][^;]*/i,
    /background(?:-color)?\s*:\s*[^;]*rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*0?\.\d+\s*\)/i,
    /background(?:-color)?\s*:\s*[^;]*(?:rgb|hsl|oklch|oklab|lab|lch)\([^)]*\/\s*(?:0?\.\d+|\d{1,2}%)\s*\)/i,
    /background(?:-color)?\s*:\s*#[0-9a-f]{6}[0-9a-e][0-9a-f]\b/i,
];

export function materialFallbackFindings(content: string): MaterialFinding[] {
    const hasTransparencyRoute = /prefers-reduced-transparency/i.test(content);
    const hasContrastRoute = /prefers-contrast/i.test(content);
    if (hasTransparencyRoute && hasContrastRoute) return [];
    const missing: MaterialFinding['missing'] = [];
    if (!hasTransparencyRoute) missing.push('prefers-reduced-transparency');
    if (!hasContrastRoute) missing.push('prefers-contrast');
    const out: MaterialFinding[] = [];
    const lines = content.split('\n');
    for (const [i, line] of lines.entries()) {
        if (TRANSLUCENT.some((re) => re.test(line))) {
            out.push({ rule: 'dq7-material-fallback', line: i + 1, missing, snippet: line.trim().slice(0, 120) });
        }
    }
    return out;
}

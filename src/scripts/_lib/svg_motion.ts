/**
 * svg_motion — the ONE reading of "does this file's reduced-motion route
 * actually reach its SMIL animation".
 *
 * Two linters need the same answer and would otherwise disagree about it:
 * `lint_svg_asset` (standalone `.svg`, step 1.1 of `road-to-svg-with-a-witness`)
 * and `lint_design_quality`'s DQ4 (inline SVG inside HTML, step 1.3). A
 * standalone file and an inline graphic hitting different definitions of
 * "covered" is how a consumer ends up with one linter clearing what the other
 * reds, for the same bytes.
 *
 * The measurement behind the `css-only` verdict (R4 of that roadmap): under an
 * emulated `prefers-reduced-motion: reduce`, a page-level
 * `svg * { animation: none !important }` left an `<animate>` moving `cx` from
 * 20.2 to 76.8 in 700 ms. CSS `animation` and `transition` properties do not
 * reach SMIL at all, so a file whose only route is one of them is covered by
 * nothing — and reads, to a human and to a naive linter, exactly like a file
 * that is covered.
 */

/** SMIL animation elements. `<set>` is included: it animates too. */
export const SMIL_TAGS: ReadonlySet<string> = new Set([
    'animate',
    'animatetransform',
    'animatemotion',
    'animatecolor',
    'set',
]);

const SMIL_MARKUP_RE = /<(animate|animateTransform|animateMotion|animateColor|set)\b/i;
const REDUCED_MOTION_RE = /@media[^{]*prefers-reduced-motion/i;

/** True when the markup carries any SMIL animation element. */
export function hasSmilMarkup(content: string): boolean {
    return SMIL_MARKUP_RE.test(content);
}

/** True when the markup carries any CSS/WAAPI animation. */
export function hasCssAnimation(content: string): boolean {
    return /@keyframes\s+[\w-]+/i.test(content) || /\banimation(?:-name)?\s*:/i.test(content);
}

/** True when a `prefers-reduced-motion` media query exists anywhere. */
export function hasReducedMotionQuery(content: string): boolean {
    return REDUCED_MOTION_RE.test(content);
}

// ---------------------------------------------------------------------------
// A minimal CSS reader — enough to answer "what does this block declare"
// ---------------------------------------------------------------------------

export interface CssRule {
    selector: string;
    body: string;
    /** 1-based line of the selector in the ORIGINAL document. */
    line: number;
    /** The nearest enclosing at-rule prelude, or `''`. */
    atRule: string;
}

function lineIndexer(content: string): (offset: number) => number {
    const starts: number[] = [0];
    for (let i = 0; i < content.length; i++) if (content[i] === '\n') starts.push(i + 1);
    return (offset: number): number => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if ((starts[mid] as number) <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
}

function matchBrace(css: string, open: number): number {
    let depth = 0;
    for (let i = open; i < css.length; i++) {
        if (css[i] === '{') depth += 1;
        else if (css[i] === '}') {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function collectRules(
    css: string,
    base: number,
    atRule: string,
    lineOf: (o: number) => number,
    out: CssRule[],
): void {
    let i = 0;
    while (i < css.length) {
        const brace = css.indexOf('{', i);
        if (brace === -1) break;
        const prelude = css.slice(i, brace).trim();
        const end = matchBrace(css, brace);
        if (end === -1) break;
        const body = css.slice(brace + 1, end);
        if (prelude.startsWith('@')) {
            collectRules(body, base + brace + 1, prelude, lineOf, out);
        } else if (prelude) {
            out.push({ selector: prelude, body, line: lineOf(base + i), atRule });
        }
        i = end + 1;
    }
}

/** Every rule inside every `<style>` element, with its enclosing at-rule. */
export function readCssRules(content: string): CssRule[] {
    const rules: CssRule[] = [];
    const lineOf = lineIndexer(content);
    const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
    let sm: RegExpExecArray | null;
    while ((sm = styleRe.exec(content)) !== null) {
        // Blank out comments while preserving newlines, so line numbers hold.
        const css = (sm[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
        const base = sm.index + (sm[0] ?? '').indexOf(sm[1] ?? '');
        collectRules(css, base, '', lineOf, rules);
    }
    return rules;
}

/** Every rule of a bare stylesheet (a `.css` file, no `<style>` wrapper). */
export function readStylesheetRules(css: string): CssRule[] {
    const rules: CssRule[] = [];
    const lineOf = lineIndexer(css);
    const blanked = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
    collectRules(blanked, 0, '', lineOf, rules);
    return rules;
}

/** Declarations of one rule body, lower-cased property → value. */
export function declarationsOf(body: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const decl of body.split(';')) {
        const idx = decl.indexOf(':');
        if (idx === -1) continue;
        const prop = decl.slice(0, idx).trim().toLowerCase();
        if (!prop || prop.startsWith('@') || prop.includes('{')) continue;
        out[prop] = decl.slice(idx + 1).trim();
    }
    return out;
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

export type SmilVerdict =
    /** No SMIL in this file — DQ4's CSS half still applies, this half does not. */
    | 'no-smil'
    /** SMIL with a route that can actually take effect on it. */
    | 'routed'
    /** SMIL with no `prefers-reduced-motion` query at all. */
    | 'no-route'
    /** SMIL whose only route writes `animation`/`transition` — which never reaches it (R4). */
    | 'css-only';

/**
 * Does a reduced-motion route exist that can take effect on a SMIL subtree?
 *
 * Three kinds can: a declaration that is not an animation shorthand (a
 * `display`/`visibility` switch, a swapped `fill`, a `d` override removes or
 * replaces the animating subtree); a `<set>` element, which is the SMIL-side
 * switch and cannot be written in CSS at all; and a `begin="indefinite"` the
 * document starts by script or by a media branch.
 *
 * Deliberately generous in the "routed" direction. This rule ships advisory,
 * and the cost of a false red here is a linter the agent learns to ignore —
 * Risk 1 of the parent roadmap.
 */
export function reducedMotionReachesSmil(content: string): boolean {
    const scoped = readCssRules(content).filter((r) => /prefers-reduced-motion/i.test(r.atRule));
    for (const rule of scoped) {
        for (const prop of Object.keys(declarationsOf(rule.body))) {
            if (prop === 'animation' || prop.startsWith('animation-')) continue;
            if (prop === 'transition' || prop.startsWith('transition-')) continue;
            return true;
        }
    }
    if (/<set\b/i.test(content)) return true;
    if (/begin\s*=\s*["']indefinite["']/i.test(content)) return true;
    return false;
}

/** The whole SMIL reduced-motion reading for one document's bytes. */
export function smilVerdict(content: string): SmilVerdict {
    if (!hasSmilMarkup(content)) return 'no-smil';
    if (!hasReducedMotionQuery(content)) return 'no-route';
    return reducedMotionReachesSmil(content) ? 'routed' : 'css-only';
}

/** The first line carrying a SMIL element, 1-based; `1` when none is found. */
export function firstSmilLine(content: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (SMIL_MARKUP_RE.test(lines[i] ?? '')) return i + 1;
    }
    return 1;
}

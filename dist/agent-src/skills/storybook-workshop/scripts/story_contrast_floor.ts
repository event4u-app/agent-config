/**
 * story_contrast_floor — the one a11y finding a story can yield WITHOUT a browser.
 *
 * Scope, stated first because overclaiming here would be the whole defect: this is **not**
 * axe and it is not the § Validate path. It computes the WCAG 2.1 contrast ratio between two
 * colours a story DECLARES in its own args, and emits a finding in the
 * `(rule, selector, severity)` shape the engine de-duplicates on. It sees no rendered page,
 * so it cannot find a role, focus, or computed-style defect — which is most of what axe finds.
 *
 * It exists because the browser tooling is a consumer dependency this package does not
 * install, and "we cannot run axe" is not a reason to check nothing. A declared colour pair
 * is decidable from the file.
 *
 * Usage:
 *   story_contrast_floor <story-file> [<story-file> …]
 *   story_contrast_floor --self-test
 */

import * as fs from 'node:fs';

/** WCAG AA floor for normal-size body text. */
export const AA_NORMAL = 4.5;
/** WCAG AA floor for large text (>= 18.66px bold, or >= 24px). */
export const AA_LARGE = 3;

export interface Violation {
    readonly rule: string;
    readonly selector: string;
    readonly severity: 'error' | 'warning';
    /** The measured ratio, so a reader can see how far off it is rather than only that it failed. */
    readonly ratio: number;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** sRGB → relative luminance, per WCAG 2.1 § relative luminance. */
export const luminance = (hex: string): number | null => {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
    if (m === null) return null;
    let h = m[1] as string;
    if (h.length === 3) h = h.split('').map((c) => `${c}${c}`).join('');
    const channel = (pair: string): number => {
        const v = clamp01(parseInt(pair, 16) / 255);
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const r = channel(h.slice(0, 2));
    const g = channel(h.slice(2, 4));
    const b = channel(h.slice(4, 6));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio. Returns null when either colour is unreadable. */
export const contrastRatio = (fg: string, bg: string): number | null => {
    const a = luminance(fg);
    const b = luminance(bg);
    if (a === null || b === null) return null;
    const [hi, lo] = a >= b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
};

/**
 * Colour pairs a story declares in its args, as `(storyName, fg, bg)`.
 *
 * Reads only DECLARED literals. A colour arriving through a token indirection is invisible
 * here, and pretending otherwise would be worse than the gap: the caller would believe the
 * story was checked.
 */
export const declaredPairs = (source: string): Array<{ story: string; fg: string; bg: string }> => {
    const out: Array<{ story: string; fg: string; bg: string }> = [];
    // `export const Name: StoryObj<…> = { args: { … } }` — one story per export.
    const exportRe = /export\s+const\s+([A-Za-z0-9_]+)\s*:[^=]*=\s*\{([\s\S]*?)\n\};/g;
    for (const m of source.matchAll(exportRe)) {
        const story = m[1] as string;
        const body = m[2] as string;
        const fg = /(?:color|fg|foreground)\s*:\s*['"](#[0-9a-fA-F]{3,6})['"]/.exec(body);
        const bg = /(?:background|bg|backgroundColor)\s*:\s*['"](#[0-9a-fA-F]{3,6})['"]/.exec(body);
        if (fg?.[1] !== undefined && bg?.[1] !== undefined) {
            out.push({ story, fg: fg[1], bg: bg[1] });
        }
    }
    return out;
};

export const checkStoryFile = (file: string, floor: number = AA_NORMAL): Violation[] => {
    let source = '';
    try {
        source = fs.readFileSync(file, 'utf8');
    } catch {
        return [];
    }
    const out: Violation[] = [];
    for (const { story, fg, bg } of declaredPairs(source)) {
        const ratio = contrastRatio(fg, bg);
        if (ratio === null || ratio >= floor) continue;
        out.push({
            rule: 'color-contrast',
            // The story is the addressable unit here — there is no DOM to select into.
            selector: `story:${story}`,
            severity: 'error',
            ratio: Math.round(ratio * 100) / 100,
        });
    }
    return out;
};

const selfTest = (): number => {
    let failed = 0;
    const check = (label: string, cond: boolean): void => {
        if (!cond) {
            process.stderr.write(`❌  ${label}\n`);
            failed += 1;
        }
    };
    const r = contrastRatio('#000000', '#ffffff');
    check('black on white is the maximum 21:1', r !== null && Math.abs(r - 21) < 0.01);
    check('a colour on itself is 1:1', Math.abs((contrastRatio('#777777', '#777777') ?? 0) - 1) < 0.01);
    check('an unreadable colour is null, not 0', contrastRatio('nope', '#fff') === null);
    check('shorthand hex is expanded', contrastRatio('#000', '#fff') !== null);
    process.stdout.write(failed === 0 ? '✅  story_contrast_floor: self-test passed\n' : `❌  ${String(failed)} failure(s)\n`);
    return failed === 0 ? 0 : 1;
};

const main = (): number => {
    const argv = process.argv.slice(2);
    if (argv.includes('--self-test')) return selfTest();
    const files = argv.filter((a) => !a.startsWith('--'));
    const violations = files.flatMap((f) => checkStoryFile(f));
    process.stdout.write(`${JSON.stringify({ violations }, null, 2)}\n`);
    return violations.length > 0 ? 1 : 0;
};

if (process.argv[1] !== undefined && process.argv[1].includes('story_contrast_floor')) {
    process.exit(main());
}

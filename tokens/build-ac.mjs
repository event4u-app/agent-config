#!/usr/bin/env node
// tokens/build-ac.mjs
//
// Phase-2 artifact of the road-to-shared-design-tokens roadmap: generates
// agent-config's settings-GUI stylesheet (src/ui/tokens.css) from the
// canonical W3C-DTCG token file (tokens/event4u-agent-tokens.json). The
// emitted file's header carries the rationale prose that used to be
// hand-written directly into tokens.css, moved here verbatim.
//
// Colors + radii come from the JSON (loadTokens()/flatten()) — never
// hardcoded here. Typography, spacing, motion, layout, and z-index are
// AC-local (not modeled in the shared JSON) and live as template text
// below, copied byte-for-byte from the file this generator replaces.
//
// Usage:
//   node tokens/build-ac.mjs           # write src/ui/tokens.css
//   node tokens/build-ac.mjs --check   # regenerate in memory, diff against
//                                      # the committed file, exit 1 on drift
//
// Sibling generator: tokens/build-as.mjs (agent-switch's shadcn :root
// block, HSL channels).

import fs from 'node:fs';
import path from 'node:path';
import { loadTokens, flatten, checkAgainst, REPO_ROOT } from './lib.mjs';

const OUT_PATH = path.join(REPO_ROOT, 'src', 'ui', 'tokens.css');

// Every --color-* custom property in both theme blocks aligns its value
// column to this width (property name + colon) — matches the hand-written
// original ("--color-border-strong:" / "--color-surface-hover:", both 22
// chars, carry zero padding; every shorter name pads out to 22).
const COLOR_COL = 22;

function colorLine(name, value, trailingComment) {
    const decl = `--color-${name}:`;
    const pad = ' '.repeat(Math.max(0, COLOR_COL - decl.length));
    const line = `    ${decl}${pad}${value};`;
    return trailingComment ? `${line} ${trailingComment}` : line;
}

function radiusLine(name, value) {
    return `    --radius-${name}: ${value};`;
}

/**
 * One theme's --color-* declarations, grouped + commented exactly like the
 * hand-written file. `withComments` toggles the per-group `/* Colour — … *\/`
 * headers (dark carries them, light repeats none — matches the original).
 */
function colorBlock(c, { withComments, sidebarComment }) {
    const lines = [];

    if (withComments) lines.push('    /* Colour — surface elevation ladder (canvas → card → raised → hover) */');
    lines.push(colorLine('bg', c.bg));
    lines.push(colorLine('surface', c.surface));
    lines.push(colorLine('surface-alt', c['surface-alt']));
    lines.push(colorLine('surface-hover', c['surface-hover']));
    lines.push(colorLine('sidebar', c.sidebar, sidebarComment));
    lines.push(colorLine('border', c.border));
    lines.push(colorLine('border-strong', c['border-strong']));
    lines.push('');

    if (withComments) lines.push('    /* Colour — text */');
    lines.push(colorLine('text', c.text));
    lines.push(colorLine('text-muted', c['text-muted']));
    lines.push(colorLine('text-subtle', c['text-subtle']));
    lines.push(colorLine('text-inverse', c['text-inverse']));
    lines.push('');

    if (withComments) lines.push('    /* Colour — accent (single accent, not per-button) */');
    lines.push(colorLine('accent', c.accent));
    lines.push(colorLine('accent-hover', c['accent-hover']));
    lines.push(colorLine('accent-fg', c['accent-fg']));
    lines.push(colorLine('accent-soft', c['accent-soft']));
    lines.push('');

    if (withComments) lines.push('    /* Colour — semantic (reserved for meaning, never chrome) */');
    lines.push(colorLine('success', c.success));
    lines.push(colorLine('success-soft', c['success-soft']));
    lines.push(colorLine('warning', c.warning));
    lines.push(colorLine('warning-soft', c['warning-soft']));
    lines.push(colorLine('danger', c.danger));
    lines.push(colorLine('danger-soft', c['danger-soft']));
    lines.push(colorLine('info', c.info));
    lines.push(colorLine('info-soft', c['info-soft']));
    lines.push('');

    if (withComments) lines.push('    /* Focus ring — always 2px, never removed */');
    lines.push(colorLine('focus-ring', c['focus-ring']));

    return lines;
}

// AC-local shadow ramps — not modeled in the shared JSON (agent-switch's
// shadcn output has no shadow-token equivalent), so these stay hand-authored
// template text, copied byte-for-byte from the pre-generator file.
const SHADOWS_DARK = [
    '    /* Shadows — dark theme leans on the surface ladder, shadows stay subtle */',
    '    --shadow-sm:  0 1px 2px 0 rgba(0, 0, 0, 0.5);',
    '    --shadow-md:  0 4px 10px -2px rgba(0, 0, 0, 0.55);',
    '    --shadow-lg:  0 12px 28px -6px rgba(0, 0, 0, 0.65);',
    '    --shadow-focus: 0 0 0 2px var(--color-focus-ring);',
];

const SHADOWS_LIGHT = [
    '    --shadow-sm:  0 1px 2px 0 rgba(16, 17, 20, 0.05);',
    '    --shadow-md:  0 4px 10px -2px rgba(16, 17, 20, 0.08);',
    '    --shadow-lg:  0 12px 28px -6px rgba(16, 17, 20, 0.14);',
    '    --shadow-focus: 0 0 0 2px var(--color-focus-ring);',
];

// AC-local :root block (typography, spacing, motion, layout, z-index) up to
// — but not including — the radii lines, which are generated from the JSON.
const ROOT_TOP = [
    ':root {',
    '    /* Typography — Inter when present, system stack otherwise; mono for',
    '       anything that IS config (paths, keys, YAML values, commands). */',
    '    --font-sans:          "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;',
    '    --font-mono:          ui-monospace, "SFMono-Regular", "JetBrains Mono", "Menlo", "Consolas", monospace;',
    '',
    '    --font-size-xs:       0.75rem;   /* 12px */',
    '    --font-size-sm:       0.875rem;  /* 14px */',
    '    --font-size-base:     0.9375rem; /* 15px — tool-window density */',
    '    --font-size-lg:       1.0625rem; /* 17px */',
    '    --font-size-xl:       1.25rem;   /* 20px */',
    '    --font-size-2xl:      1.5rem;    /* 24px */',
    '    --font-size-3xl:      1.75rem;   /* 28px */',
    '',
    '    --font-weight-regular:400;',
    '    --font-weight-medium: 500;',
    '    --font-weight-bold:   600;',
    '',
    '    --line-height-tight:  1.25;',
    '    --line-height-base:   1.55;',
    '    --line-height-loose:  1.75;',
    '',
    '    /* Spacing — 4px scale */',
    '    --space-1:  0.25rem;',
    '    --space-2:  0.5rem;',
    '    --space-3:  0.75rem;',
    '    --space-4:  1rem;',
    '    --space-5:  1.25rem;',
    '    --space-6:  1.5rem;',
    '    --space-8:  2rem;',
    '    --space-10: 2.5rem;',
    '    --space-12: 3rem;',
    '    --space-16: 4rem;',
    '',
    '    /* Radii */',
];

// AC-local :root block, resuming after the generated radii lines through
// end of file (motion, layout, z-index, prefers-reduced-motion override).
const ROOT_BOTTOM = [
    '',
    '    /* Motion — kept minimal; respects prefers-reduced-motion below */',
    '    --duration-fast:   120ms;',
    '    --duration-base:   200ms;',
    '    --duration-slow:   320ms;',
    '    --easing-standard: cubic-bezier(0.2, 0, 0, 1);',
    '',
    '    /* Layout */',
    '    --layout-max-width:    52rem;   /* 832px — form-friendly, breathing room */',
    '    --layout-side-padding: var(--space-6);',
    '    --layout-content-gap:  var(--space-4);',
    '',
    '    /* Z-index ladder */',
    '    --z-base:    0;',
    '    --z-overlay: 10;',
    '    --z-modal:   20;',
    '    --z-toast:   30;',
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    '    :root {',
    '        --duration-fast: 0ms;',
    '        --duration-base: 0ms;',
    '        --duration-slow: 0ms;',
    '    }',
    '}',
];

const HEADER = [
    '/*',
    ' * Design tokens for the settings GUI + setup wizard — v2, dark-first.',
    ' *',
    ' * GENERATED FILE — do not hand-edit. Source of truth:',
    ' * tokens/event4u-agent-tokens.json. To change a value, edit the JSON and',
    ' * run `node tokens/build-ac.mjs`. CI drift check: `node tokens/build-ac.mjs --check`.',
    ' *',
    ' * Hand-written, no Tailwind, no CSS-in-JS (deliberate — dependency weight',
    ' * matters more than authoring speed for a maintainer-of-one localhost GUI;',
    ' * road-to-setup-experience § Phase 4 council decision). The whole UI',
    ' * consumes these variables so a theme change is one file. Token names',
    ' * follow the W3C Design Tokens draft (category-purpose-state).',
    ' *',
    ' * Visual register: near-black canvas, surface-elevation ladder (edges are',
    ' * surface steps + 1px hairlines, not drop shadows), a single accent,',
    ' * saturated colours reserved for semantic meaning. Light theme is the',
    ' * derived pair. `data-theme` is stamped on <html> before first paint by',
    ' * the boot snippet in index.html; the runtime toggle lives in theme.ts.',
    ' */',
];

export function generate() {
    const doc = loadTokens();
    const dark = flatten(doc.color.dark);
    const light = flatten(doc.color.light);
    const radii = flatten(doc.radius);

    const lines = [];
    lines.push(...HEADER);
    lines.push('');
    lines.push(':root,');
    lines.push('[data-theme="dark"] {');
    lines.push('    color-scheme: dark;');
    lines.push('');
    lines.push(...colorBlock(dark, {
        withComments: true,
        sidebarComment: '/* chrome step — consumed by agent-switch, unused by AC chrome today */',
    }));
    lines.push('');
    lines.push(...SHADOWS_DARK);
    lines.push('}');
    lines.push('');
    lines.push('[data-theme="light"] {');
    lines.push('    color-scheme: light;');
    lines.push('');
    lines.push(...colorBlock(light, { withComments: false, sidebarComment: undefined }));
    lines.push('');
    lines.push(...SHADOWS_LIGHT);
    lines.push('}');
    lines.push('');
    lines.push(...ROOT_TOP);
    lines.push(radiusLine('sm', radii.sm));
    lines.push(radiusLine('md', radii.md));
    lines.push(radiusLine('lg', radii.lg));
    lines.push(radiusLine('xl', radii.xl));
    lines.push(radiusLine('full', radii.full));
    lines.push(...ROOT_BOTTOM);

    return lines.join('\n') + '\n';
}

function main() {
    const generated = generate();
    const checkMode = process.argv.includes('--check');

    if (checkMode) {
        process.exit(checkAgainst(OUT_PATH, generated, 'src/ui/tokens.css'));
    }

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, generated, 'utf8');
    console.log(`Wrote ${path.relative(REPO_ROOT, OUT_PATH)}`);
}

main();

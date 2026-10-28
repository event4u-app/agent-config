import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { HANDOVER_TOKENS, HUB_GRID, normToken } from './code_graph/handover_tokens.js';

// The map viewer's tokens against the handover's (road-to-map-views-from-the-handover,
// steps 0.2 and 0.3): the stylesheet as written, and the values the browser
// computed, recorded in the committed token matrix.

const ROOT = path.resolve(__dirname, '../..');
const VIEWER = path.join(ROOT, 'src/scripts/code_graph/map_viewer');
const MATRIX = path.join(ROOT, 'agents/evidence/reviews/map-tokens-fidelity.md');

type Theme = 'dark' | 'light';

function decls(block: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
    return out;
}
function blockAfter(css: string, head: string): string {
    const at = css.indexOf(head);
    if (at < 0) return '';
    const open = css.indexOf('{', at + head.length - 1);
    return css.slice(open + 1, css.indexOf('}', open));
}
/** Every custom property the viewer declares for a theme, with var() resolved. */
export function viewerTokens(css: string, theme: Theme): Record<string, string> {
    const common: Record<string, string> = {};
    for (const m of css.matchAll(/^:root \{([^}]*)\}/gm)) Object.assign(common, decls(m[1]!));
    const own = decls(blockAfter(css, theme === 'dark' ? ":root,\n:root[data-resolved-theme='dark'] {" : ":root[data-resolved-theme='light'] {"));
    const all = { ...common, ...own };
    const resolve = (v: string, depth = 0): string => (depth > 5 ? v : v.replace(/var\((--[\w-]+)\)/g, (_, n: string) => resolve(all[n] ?? `var(${n})`, depth + 1)));
    return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, resolve(v)]));
}
/** The tokens whose value differs from the handover's, as `name: got ≠ want`. */
export function tokenMismatches(got: Record<string, string>, theme: Theme): string[] {
    const k = theme === 'dark' ? 0 : 1;
    return Object.entries(HANDOVER_TOKENS)
        .filter(([n, v]) => normToken(got[n] ?? '<absent>') !== normToken(v[k]))
        .map(([n, v]) => `${n}: ${got[n] ?? '<absent>'} ≠ ${v[k]}`);
}
/** The computed values a matrix section records: `| --token | handover | computed | … |`. */
export function matrixValues(text: string, section: string): Record<string, string> {
    const at = text.indexOf(`## ${section}\n`);
    if (at < 0) return {};
    const body = text.slice(at + section.length + 4);
    const end = body.search(/^## /m);
    const out: Record<string, string> = {};
    for (const m of (end < 0 ? body : body.slice(0, end)).matchAll(/^\| `(--[\w-]+)` \| `([^`]*)` \| `([^`]*)` \|/gm)) out[m[1]!] = m[3]!;
    return out;
}

const css = fs.readFileSync(path.join(VIEWER, 'viewer.css'), 'utf-8');
const ops = fs.readFileSync(path.join(VIEWER, 'area_ops.css'), 'utf-8');

describe('the stylesheet carries the handover tokens', () => {
    for (const theme of ['dark', 'light'] as const) {
        it(`every token, ${theme}`, () => {
            expect(tokenMismatches(viewerTokens(css, theme), theme)).toEqual([]);
        });
    }
    it('the --alert names stay as aliases of the --red tokens', () => {
        for (const theme of ['dark', 'light'] as const) {
            const v = viewerTokens(css, theme);
            expect(v['--alert']).toBe(v['--red']);
            expect(v['--alertText']).toBe(v['--redText']);
            expect(v['--alertTint']).toBe(v['--redTint']);
        }
    });
    it('the WebKit scrollbar block with its @supports not fallback, and the hub grid on --grid', () => {
        expect(css).toContain('@supports not selector(::-webkit-scrollbar) { * { scrollbar-width: thin; scrollbar-color: var(--sbThumb) transparent; } }');
        expect(css).toContain('::-webkit-scrollbar { width: 10px; height: 10px; }');
        expect(css).toContain('::-webkit-scrollbar-thumb:hover { background: var(--sbThumbHover); background-clip: padding-box; }');
        expect(ops).not.toContain('--hubGrid');
        expect(ops).toContain(`.ops-graph { --grid: ${HUB_GRID[0].replace(/,/g, ', ')}; }`);
        expect(ops).toContain('linear-gradient(var(--grid) 1px, transparent 1px)');
    });
});

describe('the computed token matrix', () => {
    const present = fs.existsSync(MATRIX);
    it.skipIf(!present)('records every token as the browser computed it, equal to the handover, both themes', () => {
        const text = fs.readFileSync(MATRIX, 'utf-8');
        expect(tokenMismatches(matrixValues(text, 'Computed styles (dark)'), 'dark')).toEqual([]);
        expect(tokenMismatches(matrixValues(text, 'Computed styles (light)'), 'light')).toEqual([]);
    });
    it.skipIf(!present)('sensitivity: one mutated token fails the comparison, in the stylesheet and in the matrix', () => {
        const mutated = css.replace('--violetTint: rgba(201, 162, 255, 0.16)', '--violetTint: rgba(201, 162, 255, 0.14)');
        expect(mutated).not.toBe(css);
        expect(tokenMismatches(viewerTokens(mutated, 'dark'), 'dark')).toEqual(['--violetTint: rgba(201, 162, 255, 0.14) ≠ rgba(201,162,255,0.16)']);
        const text = fs.readFileSync(MATRIX, 'utf-8');
        const got = matrixValues(text, 'Computed styles (light)');
        expect(tokenMismatches({ ...got, '--redText': '#e0414f' }, 'light')).toEqual(['--redText: #e0414f ≠ #be123c']);
    });
});

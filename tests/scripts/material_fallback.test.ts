// road-to-a-control-that-matches-its-neighbours 5.5: the DQ7 shadow candidate.
import { describe, expect, it } from 'vitest';

import { materialFallbackFindings } from '../../src/scripts/_lib/material_fallback.js';

describe('materialFallbackFindings', () => {
    it('a frosted panel with no fallback routes is reported, naming both', () => {
        const f = materialFallbackFindings('.sheet {\n  backdrop-filter: blur(20px);\n  background: rgba(255, 255, 255, 0.6);\n}\n');
        expect(f.map((x) => x.line)).toEqual([2, 3]);
        expect(f[0]!.missing).toEqual(['prefers-reduced-transparency', 'prefers-contrast']);
    });

    it('the additive pattern with both routes is clean', () => {
        const css = [
            '.sheet { background: #fff; }',
            '@media (prefers-reduced-transparency: no-preference) { .sheet { backdrop-filter: blur(20px); background: rgb(255 255 255 / 0.6); } }',
            '@media (prefers-contrast: more) { .sheet { background: #fff; border: 1px solid #000; } }',
        ].join('\n');
        expect(materialFallbackFindings(css)).toEqual([]);
    });

    it('an opaque surface and backdrop-filter: none are not translucent', () => {
        expect(materialFallbackFindings('.a { background: rgba(0, 0, 0, 1); backdrop-filter: none; }')).toEqual([]);
    });

    it('a missing contrast route alone is still named', () => {
        const f = materialFallbackFindings('@media (prefers-reduced-transparency: reduce) { .a { background: #fff; } }\n.a { background: hsl(0 0% 100% / 70%); }');
        expect(f).toHaveLength(1);
        expect(f[0]!.missing).toEqual(['prefers-contrast']);
    });
});

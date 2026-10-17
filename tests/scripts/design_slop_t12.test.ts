/**
 * T12 — a swapped self-hosted webfont with no metric-matched fallback. Step 2.2
 * of `road-to-type-with-a-witness`.
 *
 * `font-display: swap` paints the fallback first and swaps the webfont in when
 * it arrives; without a fallback `@font-face` whose `size-adjust`,
 * `ascent-override` and `descent-override` bring the fallback's metrics to the
 * webfont's, every line reflows at the swap. The detector is a static CSS
 * read: the overrides either exist in the stylesheet or they do not.
 */

import { describe, expect, it } from 'vitest';

import { SLOP_RULES, type DesignContext } from '../../src/scripts/design_slop_rules.js';
import { scanFile } from '../../src/scripts/lint_design_slop.js';

const NO_CTX: DesignContext = { raw: '', has: () => false };

const RULE = 'slop-t12-swap-without-metric-fallback';

const SWAP_FACE = `@font-face {
  font-family: "Brand Sans";
  src: url("/fonts/brand-sans.woff2") format("woff2");
  font-display: swap;
}
body { font-family: "Brand Sans", "Brand Sans Fallback", sans-serif; }
`;

const METRIC_FALLBACK = `@font-face {
  font-family: "Brand Sans Fallback";
  src: local("Arial");
  size-adjust: 104.5%;
  ascent-override: 92%;
  descent-override: 24%;
  line-gap-override: 0%;
}
`;

function hits(css: string): number {
    return scanFile(css, 'styles.css', NO_CTX).filter((f) => f.rule === RULE).length;
}

describe('T12 — swap without a metric-matched fallback', () => {
    it('is registered against catalog entry T12', () => {
        const rule = SLOP_RULES.find((r) => r.id === RULE);
        expect(rule?.catalogId).toBe('T12');
    });

    it('fires on a swapped self-hosted face with no fallback overrides', () => {
        expect(hits(SWAP_FACE)).toBe(1);
    });

    it('stays quiet when a local() fallback carries all three overrides', () => {
        expect(hits(SWAP_FACE + METRIC_FALLBACK)).toBe(0);
    });

    it('still fires when the fallback carries only size-adjust', () => {
        // The near miss in the other direction: size-adjust alone matches the
        // advance widths and leaves the line box to jump at the swap.
        const partial = METRIC_FALLBACK.replace(/\s*ascent-override[^;]*;/, '').replace(/\s*descent-override[^;]*;/, '');
        expect(hits(SWAP_FACE + partial)).toBe(1);
    });

    it('stays quiet without swap, and on a third-party URL owned by the delivery section', () => {
        expect(hits(SWAP_FACE.replace('swap', 'optional'))).toBe(0);
        expect(hits(SWAP_FACE.replace('"/fonts/brand-sans.woff2"', '"https://cdn.example.com/brand-sans.woff2"'))).toBe(0);
    });
});

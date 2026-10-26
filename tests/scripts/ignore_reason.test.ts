// road-to-tells-a-near-miss-can-refute 0.3: one ignore syntax with a reason.
import { describe, expect, it } from 'vitest';

import { ignoreReason } from '../../src/scripts/_lib/ignore_reason.js';
import { parseIgnores } from '../../src/scripts/_lib/svg_rules.js';
import { scanFile, suppressions } from '../../src/scripts/lint_design_slop.js';

const CTX = { raw: '', has: () => false };

describe('ignoreReason', () => {
    it.each([
        ['/* design-slop-disable-next-line slop-t7 -- product face, see DESIGN.md */', 'product face, see DESIGN.md'],
        ['<!-- svg-asset-disable geometry/x -- vendor mark, unchanged -->', 'vendor mark, unchanged'],
        ['// design-slop-disable-line slop-t7', null],
        ['// design-slop-disable-line slop-t7 --   ', null],
    ])('%s → %s', (line, want) => {
        expect(ignoreReason(line)).toBe(want);
    });
});

describe('the slop linter records every honoured ignore with its reason', () => {
    it('a reasoned and a reasonless ignore both suppress, and both are listed', () => {
        suppressions.length = 0;
        const css = [
            '/* design-slop-disable-next-line slop-t7-default-fonts -- the brand face */',
            'body { font-family: Inter, sans-serif; }',
            '/* design-slop-disable-next-line slop-t7-default-fonts */',
            'h1 { font-family: Inter, sans-serif; }',
        ].join('\n');
        expect(scanFile(css, 'a.css', CTX).map((f) => f.rule)).not.toContain('slop-t7-default-fonts');
        expect(suppressions.map((s) => [s.line, s.reason])).toEqual([
            [2, 'the brand face'],
            [4, null],
        ]);
    });
});

describe('the svg parser records the reason it documents', () => {
    it('per line and for the whole file', () => {
        const ig = parseIgnores([
            '<!-- svg-asset-disable svg-a11y-no-accessible-name -- decorative, aria-hidden by the host -->',
            '<!-- svg-asset-disable-next-line svg-structure-missing-viewbox -->',
            '<path/>',
        ]);
        expect(ig.get('svg-a11y-no-accessible-name')?.reasons?.get(0)).toBe('decorative, aria-hidden by the host');
        expect(ig.get('svg-structure-missing-viewbox')?.reasons?.get(3)).toBeNull();
    });
});

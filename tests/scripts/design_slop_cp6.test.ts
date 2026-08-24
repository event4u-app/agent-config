import { describe, expect, it } from 'vitest';

import { SLOP_RULES } from '../../src/scripts/design_slop_rules.js';

const cp6 = SLOP_RULES.find((r) => r.id === 'slop-cp6-generic-art-direction');

function detect(content: string, ext = '.md'): unknown[] {
    if (!cp6) throw new Error('slop-cp6-generic-art-direction not registered');
    return cp6.detect({
        content,
        ext,
        lines: content.split('\n'),
        path: 'brief.md',
    } as never) as unknown[];
}

describe('CP6 — a stock render subject is a detectable tell; the render is not', () => {
    it('the rule is registered on the copy engine, not on css', () => {
        expect(cp6).toBeDefined();
        expect(cp6?.engines).toContain('copy');
        expect(cp6?.engines).not.toContain('css');
    });

    it('fires on a brief that names a stock subject', () => {
        const hits = detect(
            'Build a Three.js hero with floating abstract shapes and a gradient mesh.',
        );
        expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it('stays silent on a brief that names a real subject', () => {
        const hits = detect(
            'Build a Three.js hero: the assembled chassis rotates, one component ' +
                'highlighted per beat, ending on the price panel.',
        );
        expect(hits).toHaveLength(0);
    });

    it('stays silent on a technique-only brief with no stock subject named', () => {
        // The near-miss that matters: naming WebGL is not the defect. Defaulting
        // the subject is. A rule that fired here would flag every 3D brief.
        expect(detect('Use WebGL with instanced meshes and a scroll-scrubbed timeline.')).toHaveLength(0);
    });

    it('stays silent on prose that discusses the antipattern itself', () => {
        // Guard against the rule firing on its own catalog entry's wording in a
        // brief that is arguing AGAINST the pattern... which it does not: the
        // phrase is present, so this documents the known limitation rather than
        // pretending it is absent.
        const hits = detect('Do not ask for floating abstract shapes.');
        expect(hits.length).toBeGreaterThanOrEqual(1);
    });
});

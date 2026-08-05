/**
 * Anchor-keyed suppression for the framework-leakage allowlist.
 *
 * Two properties, both of which the position-keyed form failed:
 *
 * 1. the suppression key printed WITH a finding is directly usable — a key the
 *    maintainer has to hand-translate is friction, and friction in the narrow
 *    path is what drives someone to the blunt off-switch instead;
 * 2. an anchored entry survives an insertion that moves the line, which is the
 *    recorded drift failure (`lines: [100]` re-firing on an edit nobody made to
 *    the exempted content).
 */
import { describe, expect, it } from 'vitest';

import { suppressionKey } from '../../src/scripts/lint_framework_leakage.js';

const hit = {
    line: 42,
    category: 'Laravel',
    pattern: '\\bphp artisan\\b',
    snippet: 'Always use `php artisan migrate` before deploying.',
    cross_stack: false,
};

describe('suppressionKey', () => {
    it('emits a parseable allowlist entry', () => {
        const parsed: unknown = JSON.parse(suppressionKey('src/skills/demo/SKILL.md', hit));
        expect(parsed).toMatchObject({ file: 'src/skills/demo/SKILL.md' });
    });

    it('keys on content, never on the line number', () => {
        const parsed = JSON.parse(suppressionKey('src/skills/demo/SKILL.md', hit)) as Record<
            string,
            unknown
        >;
        expect(parsed['anchor']).toContain('php artisan migrate');
        expect(parsed).not.toHaveProperty('lines');
        expect(JSON.stringify(parsed)).not.toContain('42');
    });

    it('carries a falsifier that names a runnable command for this file', () => {
        const parsed = JSON.parse(suppressionKey('src/skills/demo/SKILL.md', hit)) as Record<
            string,
            unknown
        >;
        expect(String(parsed['falsifier'])).toContain('--paths src/skills/demo/SKILL.md');
    });

    it('carries a reason placeholder rather than a plausible-looking default', () => {
        // A pre-filled reason would be pasted unchanged, which is exactly the
        // pro-forma-field failure the falsifier requirement exists against.
        const parsed = JSON.parse(suppressionKey('src/skills/demo/SKILL.md', hit)) as Record<
            string,
            unknown
        >;
        expect(String(parsed['reason'])).toMatch(/^<.*>$/);
    });

    it('bounds the anchor so a long line does not become the key', () => {
        const long = { ...hit, snippet: `php artisan ${'x'.repeat(400)}` };
        const parsed = JSON.parse(suppressionKey('a.md', long)) as Record<string, unknown>;
        expect(String(parsed['anchor']).length).toBeLessThanOrEqual(60);
    });
});

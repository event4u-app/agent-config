/**
 * The design family is router-visible, and the matcher that says so is real.
 *
 * `road-to-one-motion-authority` Phase 5. The router reads descriptions and
 * nothing else, so a family whose ten members never name each other is a family
 * it cannot traverse. Pinned here because a description is one edit from losing
 * the pointer again, and the description-lint checks that would have caught it
 * are dormant by construction (`lint_skill_descriptions.ts` (e)/(f) scope to a
 * cluster set that is empty).
 */
import { describe, expect, it } from 'vitest';

import {
    loadSkills,
    namesIdentifier,
    parseSkill,
    siblingsNamed,
} from '../../src/scripts/measure_sibling_naming.js';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..', '..');
const SKILLS = loadSkills(REPO);

const DESIGN_FAMILY = [
    'design-review', 'existing-ui-audit', 'fe-design', 'design-variations',
    'design-intelligence', 'ui-apply-generic', 'react-shadcn-ui',
    'tailwind-engineer', 'ui-component-architect', 'canvas-design',
] as const;

/** The cap `skill_linter` enforces. Restated so a failure here says which. */
const DESCRIPTION_CAP = 200;

describe('the design family names its siblings', () => {
    const map = siblingsNamed(SKILLS);

    it('loads the shipped corpus', () => {
        expect(SKILLS.length).toBeGreaterThan(100);
    });

    for (const name of DESIGN_FAMILY) {
        it(`${name} names at least one shipped sibling`, () => {
            expect(map.get(name), `${name} is not in the loaded corpus`).toBeDefined();
            expect(map.get(name) ?? []).not.toHaveLength(0);
        });

        it(`${name} stays at or under ${String(DESCRIPTION_CAP)} characters`, () => {
            const rec = SKILLS.find((s) => s.name === name);
            expect(rec).toBeDefined();
            expect((rec?.description ?? '').length).toBeLessThanOrEqual(DESCRIPTION_CAP);
        });
    }
});

describe('namesIdentifier — the boundary rule the census never defined', () => {
    it('a whole identifier matches', () => {
        expect(namesIdentifier('Hard gate for fe-design and the ui directives.', 'fe-design')).toBe(true);
    });

    // `\b` would put a boundary before the hyphen and score this true, which is
    // how a bare word-boundary match inflates a sibling census.
    it('a prefix of a longer identifier does not', () => {
        expect(namesIdentifier('routes to mcp-builder', 'mcp')).toBe(false);
        expect(namesIdentifier('see laravel-dto for the shape', 'laravel')).toBe(false);
    });

    it('a suffix of a longer identifier does not', () => {
        expect(namesIdentifier('use ui-apply-generic here', 'generic')).toBe(false);
    });

    it('an identifier at either end of the string matches', () => {
        expect(namesIdentifier('fe-design first', 'fe-design')).toBe(true);
        expect(namesIdentifier('handed to fe-design', 'fe-design')).toBe(true);
    });
});

describe('siblingsNamed — deterministic and self-excluding', () => {
    it('a skill naming only itself scores nothing', () => {
        const map = siblingsNamed([
            { name: 'alpha', description: 'alpha does alpha things' },
            { name: 'beta', description: 'unrelated' },
        ]);
        expect(map.get('alpha')).toEqual([]);
    });

    it('returns the same answer on repeated calls', () => {
        expect(siblingsNamed(SKILLS)).toEqual(siblingsNamed(SKILLS));
    });
});

describe('parseSkill', () => {
    it('unquotes a double-quoted description and unescapes inner quotes', () => {
        const rec = parseSkill('---\nname: x\ndescription: "says \\"hi\\" to y"\n---\nbody\n');
        expect(rec).toEqual({ name: 'x', description: 'says "hi" to y' });
    });

    it('returns null for a file with no frontmatter', () => {
        expect(parseSkill('# just a heading\n')).toBeNull();
    });
});

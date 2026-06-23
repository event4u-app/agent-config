
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    BAND_HIGH_MIN,
    BAND_MEDIUM_MIN,
    DIMENSION_NAMES,
    MAX_PER_DIMENSION,
    type ConfidenceScore,
    score,
} from '../../../src/agent-src/templates/scripts/work_engine/scoring/confidence.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

/** asdict-equivalent projection in Python field order. */
function asdict(c: ConfidenceScore): Record<string, unknown> {
    return {
        band: c.band,
        score: c.score,
        dimensions: c.dimensions,
        reasons: c.reasons,
        ui_intent: c.ui_intent,
    };
}

describe('scoring/confidence — exported constants', () => {
    it('thresholds + rubric shape', () => {
        expect(BAND_HIGH_MIN).toBe(0.8);
        expect(BAND_MEDIUM_MIN).toBe(0.5);
        expect(MAX_PER_DIMENSION).toBe(2);
        expect([...DIMENSION_NAMES]).toEqual([
            'goal_clarity',
            'scope_boundary',
            'ac_evidence',
            'stack_data',
            'reversibility',
        ]);
    });
});

describe('scoring/confidence — score shape', () => {
    it('empty prompt → low band (stack_data + reversibility still score 2 each)', () => {
        const r = score({ raw: '' });
        expect(r.band).toBe('low');
        // goal/scope/ac are 0; an empty prompt has no stack signal (→2) and is
        // code-only (→2), so total=4 → 0.4, matching CPython.
        expect(r.score).toBe(0.4);
        expect(r.dimensions.goal_clarity).toBe(0);
        expect(r.reasons[0]).toBe('goal_clarity=0: empty prompt');
        expect(r.ui_intent).toBe(false);
    });

    it('high-quality prompt with anchored AC → high band', () => {
        const r = score({
            raw: 'Add a logout button to `auth/LoginForm.tsx`',
            ac: [
                'should render a logout button',
                'when clicked it must clear the session',
                'then redirect to the login page',
            ],
        });
        expect(r.band).toBe('high');
        expect(r.score).toBeGreaterThanOrEqual(0.8);
    });

    it('ui keyword sets ui_intent', () => {
        const r = score({ raw: 'redesign the dashboard layout with tailwind' });
        expect(r.ui_intent).toBe(true);
    });

    it('frozen result cannot be mutated', () => {
        const r = score({ raw: 'fix the login bug' });
        expect(() => {
            // @ts-expect-error — runtime frozen check
            r.band = 'high';
        }).toThrow();
    });
});

// A corpus that exercises each rubric branch: verbs/no-verbs, questions,
// conjunction splits, file paths, PHP namespaces, camelCase, domain nouns,
// stack/data with+without target, irreversible + config + code-only.
const PROMPTS: Array<{ raw: string; ac: string[] | null; assumptions: string[] | null }> = [
    { raw: '', ac: null, assumptions: null },
    { raw: 'fix the login bug in `auth/session.py`', ac: null, assumptions: null },
    { raw: 'How does the dashboard work?', ac: null, assumptions: null },
    { raw: 'add a button and then refactor the user model', ac: null, assumptions: null },
    {
        raw: 'create UserProfileCard component',
        ac: ['should mount', 'must show the avatar', 'then load posts'],
        assumptions: ['react'],
    },
    { raw: 'rename App\\Models\\User to Account', ac: [], assumptions: null },
    { raw: 'optimize Foo::bar performance', ac: ['expect faster'], assumptions: null },
    { raw: 'drop the users table', ac: null, assumptions: null },
    { raw: 'add a migration for the orders column', ac: null, assumptions: null },
    { raw: 'migrate the schema table `orders`', ac: null, assumptions: null },
    { raw: 'update the .env config for deploy', ac: null, assumptions: null },
    { raw: 'refactor the checkout flow', ac: ['given a cart', 'when paid'], assumptions: null },
    {
        raw: 'this is a very long prompt that just keeps going on and on well past the forty word boundary so that the goal clarity scorer must fall back to the borderline length branch instead of the clean two point branch because length matters here ok',
        ac: null,
        assumptions: null,
    },
    { raw: 'implement caching for the search api', ac: null, assumptions: null },
    { raw: 'redesign the colour theme to dark mode', ac: null, assumptions: null },
    { raw: 'charge the customer billing account', ac: null, assumptions: null },
    { raw: 'write tests for `report.py`', ac: ['should pass', 'must cover edges'], assumptions: null },
    { raw: 'add an endpoint', ac: null, assumptions: null },
    { raw: 'tune the redis cache', ac: null, assumptions: null },
    { raw: 'document the webhook handler in handler.ts', ac: ['must explain payload'], assumptions: null },
];

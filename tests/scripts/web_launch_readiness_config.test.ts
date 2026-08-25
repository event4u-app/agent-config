// Schema test for src/config/web-launch-readiness.json.
//
// road-to-web-launch-readiness 0.2 asks for this to be "checked by a schema test
// rather than by review", and the reason is the design directive the file
// enforces: CONDITIONAL, NOT FLAT. A check that quietly grows an empty or
// all-inclusive `applies_to` has silently become a flat check, and that is
// invisible in a diff review of a 200-line JSON file.
//
// Registered BEFORE any skill code exists, so these assertions run against a
// config nothing consumes yet. That is deliberate: deciding the axis after
// writing the checks would let the checks pick their own scope.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');
const REL = 'src/config/web-launch-readiness.json';

interface Check {
    id: string;
    title: string;
    applies_to: string[];
    tier: string;
    why: string;
    remediation: string;
    verification: string;
}
interface Config {
    schema_version: number;
    registered_at: string;
    owner: string;
    review_by: string;
    site_types: { values: string[] };
    tiers: { values: string[] };
    checks: Check[];
    not_in_scope: { items: string[] };
}

const cfg = JSON.parse(fs.readFileSync(path.join(REPO, REL), 'utf8')) as Config;

describe('ownership, per the budget-ownership pattern', () => {
    it('carries the four fields lint_budget_ownership scans for', () => {
        expect(cfg.schema_version).toBe(1);
        expect(cfg.registered_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(cfg.owner).toBe('maintainer');
        expect(cfg.review_by).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('review_by is after registered_at', () => {
        expect(Date.parse(cfg.review_by)).toBeGreaterThan(Date.parse(cfg.registered_at));
    });
});

describe('the site-type axis is a closed enum', () => {
    it('holds exactly the five registered types', () => {
        expect(cfg.site_types.values).toEqual([
            'local-business',
            'marketing-site',
            'saas-app',
            'docs',
            'internal-tool',
        ]);
    });

    it('the tier vocabulary is the four the report order names', () => {
        expect(cfg.tiers.values).toEqual(['critical', 'high', 'medium', 'situational']);
    });
});

describe('every check is complete — the step asks for a schema test, not a review', () => {
    it.each(cfg.checks.map((c) => [c.id, c] as const))('%s', (_id, check) => {
        for (const field of ['title', 'why', 'remediation', 'verification'] as const) {
            expect(typeof check[field], `${check.id}.${field}`).toBe('string');
            // A one-word remediation is the boilerplate this test exists to
            // reject, not a remediation.
            expect(check[field].length, `${check.id}.${field} is too short to be an answer`).toBeGreaterThan(20);
        }
        expect(cfg.tiers.values).toContain(check.tier);
        expect(check.applies_to.length, `${check.id} applies to nothing`).toBeGreaterThan(0);
        for (const t of check.applies_to) {
            expect(cfg.site_types.values, `${check.id} names an unregistered site type`).toContain(t);
        }
    });

    it('check ids are unique and slug-shaped', () => {
        const ids = cfg.checks.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    });
});

describe('conditional, not flat — the directive this config exists to enforce', () => {
    it('at least one check is NOT universal, or the axis is decoration', () => {
        // The load-bearing assertion. If every check applied to every type, the
        // `applies_to` field would be a field nobody reads and the design
        // directive would be violated while the schema stayed valid.
        const all = cfg.site_types.values.length;
        const conditional = cfg.checks.filter((c) => c.applies_to.length < all);
        expect(conditional.length).toBeGreaterThan(0);
    });

    it('a SaaS app is not asked for per-route meta descriptions', () => {
        // The roadmap's own worked example of the directive, pinned: an
        // authenticated app's routes are not indexed, so per-route descriptions
        // are work with no consumer.
        const meta = cfg.checks.find((c) => c.id === 'per-route-metadata');
        expect(meta).toBeDefined();
        expect(meta!.applies_to).not.toContain('saas-app');
        expect(meta!.applies_to).not.toContain('internal-tool');
    });

    it('alternative text applies to EVERY type, including internal tools', () => {
        // The counter-case, and it is deliberate: an internal user with a screen
        // reader is still a user. A conditional axis must not become an excuse.
        const alt = cfg.checks.find((c) => c.id === 'image-alternative-text');
        expect(alt!.applies_to).toEqual(cfg.site_types.values);
    });

    it('the staging-noindex check is critical and covers every public type', () => {
        // Phase 2.1 ships this one first. It is the class with zero estate
        // coverage (G0: `robots` 0 files, `noindex` 0 files).
        const c = cfg.checks.find((x) => x.id === 'staging-noindex-leftover');
        expect(c!.tier).toBe('critical');
        expect(c!.applies_to).toContain('marketing-site');
        expect(c!.applies_to).not.toContain('internal-tool');
    });
});

describe('scope limits are registered, not left to analogy', () => {
    it('names what this skill is NOT, including the term with zero coverage', () => {
        const items = cfg.not_in_scope.items.join(' ').toLowerCase();
        // `lighthouse` matches 0 files in the estate, and that is NOT an argument
        // for adding it here — a score is a gradient, these checks are binary.
        expect(items).toContain('lighthouse');
        expect(items).toContain('wcag');
    });

    it('stays under the 50-check ceiling step 0.3 sets', () => {
        expect(cfg.checks.length).toBeLessThan(50);
    });
});

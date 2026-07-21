// Tests for src/scripts/_lib/shingle_similarity.ts — the anti-reskin engine.
//
// Behavioural, not golden: every expectation is derived from the input
// (entity-swap of a fixture, unrelated prose), never a hard-coded corpus score.
import { describe, expect, it } from 'vitest';

import {
    ENTITY_PLACEHOLDER,
    neutralizeEntities,
    overlapPercent,
    shingleOverlap,
    shingles,
    words,
} from '../../src/scripts/_lib/shingle_similarity.js';

// A realistic skill-body fixture, long enough to shingle at k=8.
const LARAVEL_BODY = `
When building an API endpoint in Laravel, keep the controller thin and push
business logic into a dedicated service class. Validate the request payload at
the boundary with a FormRequest, never inline inside the action. Persist through
Eloquent models, wrap multi-step writes in a database transaction, and return a
typed API resource so the response shape stays stable across releases. Every
query that filters user-owned rows must be tenant-scoped before any data leaves
the handler, and the endpoint ships with three negative authorization tests.
`;

// The SAME body a re-skinner would produce by find-replacing the framework
// nouns. A naive token/keyword comparison drops on the swaps; the shingle gate,
// which neutralizes entities first, must still see it as a near-copy.
const SYMFONY_RESKIN = LARAVEL_BODY
    .replace(/Laravel/g, 'Symfony')
    .replace(/Eloquent/g, 'Doctrine')
    .replace(/FormRequest/g, 'FormRequest'); // control: a non-entity term stays

// Unrelated prose from a different domain — shares stopwords, not structure.
const TYPOGRAPHY_BODY = `
A modular type scale multiplies a base size by a fixed ratio to derive every
step, so headings and body copy relate by a consistent rhythm rather than
arbitrary pixel values. Choose the ratio from the content density: a marketing
page tolerates a dramatic 1.333, a data-dense dashboard wants a calmer 1.2.
Anchor line-height to the step, tighten it as the size grows, and keep the
vertical rhythm on a single spacing unit so the whole page breathes evenly.
`;

describe('shingle_similarity — neutralizeEntities', () => {
    it('collapses framework/vendor proper nouns to a single placeholder', () => {
        const n = neutralizeEntities('Deploy the Laravel app to AWS via GitHub Actions.');
        expect(n).toContain(ENTITY_PLACEHOLDER);
        expect(n).not.toContain('laravel');
        expect(n).not.toContain('aws');
        expect(n).not.toContain('github');
    });

    it('makes an entity find-replace a no-op on the neutralized text', () => {
        expect(neutralizeEntities(LARAVEL_BODY)).toBe(neutralizeEntities(SYMFONY_RESKIN));
    });

    it('strips frontmatter and markdown decoration so prose scores the same', () => {
        const decorated = `---\nid: x\n---\n# Heading\n\n**Bold** _italic_ and \`code\` and a [link](http://x).`;
        const plain = 'Heading Bold italic and and a link.';
        expect(words(neutralizeEntities(decorated))).toEqual(words(neutralizeEntities(plain)));
    });
});

describe('shingle_similarity — overlapPercent (containment)', () => {
    it('identical text scores 100', () => {
        expect(shingleOverlap(LARAVEL_BODY, LARAVEL_BODY)).toBe(100);
    });

    it('an entity-swapped re-skin still scores >= 90', () => {
        expect(shingleOverlap(LARAVEL_BODY, SYMFONY_RESKIN)).toBeGreaterThanOrEqual(90);
    });

    it('two unrelated bodies score <= 5', () => {
        expect(shingleOverlap(LARAVEL_BODY, TYPOGRAPHY_BODY)).toBeLessThanOrEqual(5);
    });

    it('a small file copied into a large padded one scores high (containment, not Jaccard)', () => {
        const large = `${TYPOGRAPHY_BODY}\n${LARAVEL_BODY}\n${TYPOGRAPHY_BODY}`;
        // The whole LARAVEL_BODY lives inside `large`, so containment ≈ 100.
        expect(shingleOverlap(LARAVEL_BODY, large)).toBeGreaterThanOrEqual(90);
    });
});

describe('shingle_similarity — guards', () => {
    it('a file shorter than k tokens yields no shingles and never NaN', () => {
        const short = 'too short to shingle';
        expect(shingles(short, 8).size).toBe(0);
        expect(shingleOverlap(short, LARAVEL_BODY)).toBe(0);
        expect(Number.isNaN(shingleOverlap(short, short))).toBe(false);
    });

    it('two empty shingle sets score 0 (no originality signal to flag)', () => {
        expect(overlapPercent(new Set(), new Set())).toBe(0);
    });

    it('respects a custom k', () => {
        // At k=3 the re-skin is still a near-copy after neutralization.
        expect(shingleOverlap(LARAVEL_BODY, SYMFONY_RESKIN, 3)).toBeGreaterThanOrEqual(90);
    });
});

/**
 * The three 1-10 design dials (`road-to-design-system-onramp` Phase 3).
 *
 * Every tier BOUNDARY is pinned — 1/3/4/7/8/10 per dial — so the next upstream
 * refresh diffs against a committed expectation instead of against somebody's
 * memory of where the tiers sat. Boundaries are where a tier table actually
 * breaks; a test at 5 would pass under almost any off-by-one.
 *
 * The no-flag path is pinned too, and it is the load-bearing one: the dials'
 * whole contract is that an unset dial changes nothing, so a run without flags
 * must carry none of the three output keys. That block calls the REAL
 * `ground()` — an earlier version of this file claimed the contract was pinned
 * while every test exercised `resolve_dial` in isolation, which is a different
 * statement and would have held even if `ground()` emitted the keys always.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    DIAL_TIERS,
    ground,
    resolve_dial,
} from '../../src/skills/corpus-grounding/scripts/decision_engine.js';
import { load_manifest } from '../../src/skills/corpus-grounding/scripts/schema_validator.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(
    HERE,
    '../../src/skills/design-intelligence/data/manifest.json',
);

describe('dial tier boundaries', () => {
    const boundaries: Array<[string, number, string]> = [
        ['variance', 1, 'Centered / Minimal'],
        ['variance', 3, 'Centered / Minimal'],
        ['variance', 4, 'Balanced / Modern'],
        ['variance', 7, 'Balanced / Modern'],
        ['variance', 8, 'Bold / Asymmetric'],
        ['variance', 10, 'Bold / Asymmetric'],
        ['motion', 1, 'Subtle'],
        ['motion', 3, 'Subtle'],
        ['motion', 4, 'Standard'],
        ['motion', 7, 'Standard'],
        ['motion', 8, 'Complex'],
        ['motion', 10, 'Complex'],
        ['density', 1, 'Spacious'],
        ['density', 3, 'Spacious'],
        ['density', 4, 'Standard'],
        ['density', 7, 'Standard'],
        ['density', 8, 'Dense / Dashboard'],
        ['density', 10, 'Dense / Dashboard'],
    ];

    for (const [dial, value, label] of boundaries) {
        it(`${dial} ${value} resolves to "${label}"`, () => {
            const info = resolve_dial(dial, value);
            expect(info).not.toBeNull();
            expect(info?.label).toBe(label);
            expect(info?.value).toBe(value);
        });
    }
});

describe('dial engagement', () => {
    it('an unset dial resolves to null, never to a default tier', () => {
        for (const dial of Object.keys(DIAL_TIERS)) {
            expect(resolve_dial(dial, null)).toBeNull();
            expect(resolve_dial(dial, undefined)).toBeNull();
        }
    });

    it('clamps out-of-range values rather than failing the run', () => {
        expect(resolve_dial('motion', 0)?.label).toBe('Subtle');
        expect(resolve_dial('motion', 99)?.label).toBe('Complex');
        expect(resolve_dial('motion', -5)?.label).toBe('Subtle');
    });

    it('truncates a fractional value to its tier', () => {
        expect(resolve_dial('density', 3.9)?.label).toBe('Spacious');
    });

    it('returns null for an unknown dial name rather than throwing', () => {
        expect(resolve_dial('saturation', 5)).toBeNull();
    });
});

/**
 * The contract the branch calls load-bearing, asserted against the real
 * `ground()` rather than against `resolve_dial` in isolation.
 *
 * The first version of this file claimed in its own docstring that the no-flag
 * path was "pinned" while no test called `ground()` at all — `resolve_dial(x,
 * null) === null` is a different statement and would hold even if `ground()`
 * emitted the keys unconditionally.
 */
describe('the no-flag contract, against the real ground()', () => {
    const manifest = load_manifest(MANIFEST);
    const QUERY = 'clean minimal saas landing page';

    it('emits none of the dial keys when no dial is passed', async () => {
        const out = await ground(manifest, QUERY);
        expect(out['dials']).toBeUndefined();
        expect(out['motion']).toBeUndefined();
        expect(out['spacing_scale']).toBeUndefined();
    });

    it('emits none of them for an all-null dial object either', async () => {
        const out = await ground(manifest, QUERY, null, {
            variance: null,
            motion: null,
            density: null,
        });
        expect(out['dials']).toBeUndefined();
        expect(out['spacing_scale']).toBeUndefined();
    });

    it('leaves the top-level key set unchanged', async () => {
        const bare = Object.keys(await ground(manifest, QUERY)).sort();
        expect(bare).toEqual([
            'category',
            'confidence',
            'domain',
            'evidence_gap',
            'query',
            'rule',
            'rules_evaluation',
            'selections',
        ]);
    });

    it('density adds a spacing scale and nothing else', async () => {
        const out = await ground(manifest, QUERY, null, { density: 9 });
        expect(out['spacing_scale']).toBeDefined();
        expect(out['motion']).toBeUndefined();
    });
});

describe('variance biases selection, never retrieval, and never silently', () => {
    const manifest = load_manifest(MANIFEST);
    const QUERY = 'clean minimal saas landing page';

    it('returns the same rows with and without the dial', async () => {
        const bare = await ground(manifest, QUERY);
        const dialled = await ground(manifest, QUERY, null, { variance: 1 });
        const names = (r: Record<string, unknown>): string[] => {
            const sel = (r['selections'] as Record<string, Record<string, unknown>>)['style'] ?? {};
            const best = (sel['best'] ?? {}) as Record<string, unknown>;
            const alts = (sel['alternatives'] ?? []) as Array<Record<string, unknown>>;
            return [best, ...alts].map((x) => String(x['Style Category'] ?? '')).sort();
        };
        expect(names(dialled)).toEqual(names(bare));
    });

    it('reports the divergence when the dial changes the pick', async () => {
        const out = await ground(manifest, QUERY, null, { variance: 1 });
        const gaps = (out['evidence_gap'] as string[]).join(' ');
        expect(gaps).toContain('--variance 1 changed the style pick');
        expect(gaps).toContain("the rule's own keywords would have selected");
    });
});

describe('the tier table itself', () => {
    it('covers 1-10 with no gap and no overlap, per dial', () => {
        for (const [dial, tiers] of Object.entries(DIAL_TIERS)) {
            const covered = new Set<number>();
            for (const [lo, hi] of tiers) {
                for (let v = lo; v <= hi; v++) {
                    expect(covered.has(v), `${dial}: ${v} is covered twice`).toBe(false);
                    covered.add(v);
                }
            }
            for (let v = 1; v <= 10; v++) {
                expect(covered.has(v), `${dial}: ${v} is covered by no tier`).toBe(true);
            }
        }
    });

    it('carries the payload each dial is consumed for', () => {
        // variance biases style selection, motion selects a corpus tier,
        // density overrides a spacing scale — a tier missing its payload is a
        // dial that resolves and then does nothing.
        for (const [, , info] of DIAL_TIERS['variance'] ?? []) {
            expect(Array.isArray(info['style_keywords'])).toBe(true);
        }
        for (const [, , info] of DIAL_TIERS['motion'] ?? []) {
            expect(typeof info['tier']).toBe('string');
        }
        for (const [, , info] of DIAL_TIERS['density'] ?? []) {
            expect(Object.keys(info['spacing'] as Record<string, string>).length).toBeGreaterThan(0);
        }
    });
});

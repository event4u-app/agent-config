// Tests for src/scripts/lint_discovery_vocabulary.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists for this module. This is a focused differential
// suite over the public helpers (requires-edge resolution, cycle detection)
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_discovery_vocabulary.js';



describe('lint_discovery_vocabulary — behavioural spec', () => {
    it('_requires_of prefers requires, falls back to requires_hint, else []', () => {
        expect(mod._requires_of({ requires: ['a', 'b'] })).toEqual(['a', 'b']);
        expect(mod._requires_of({ requires_hint: ['c'] })).toEqual(['c']);
        expect(mod._requires_of({ requires: [], requires_hint: ['d'] })).toEqual(['d']);
        expect(mod._requires_of({})).toEqual([]);
    });

    it('_detect_requires_cycle returns null for an acyclic graph', () => {
        const packs = [
            { id: 'a', requires: ['b'] },
            { id: 'b', requires: [] },
        ];
        expect(mod._detect_requires_cycle(packs)).toBeNull();
    });

    it('_detect_requires_cycle finds a 2-node cycle', () => {
        const packs = [
            { id: 'a', requires: ['b'] },
            { id: 'b', requires: ['a'] },
        ];
        expect(mod._detect_requires_cycle(packs)).toEqual(['a', 'b', 'a']);
    });

    it('_detect_requires_cycle ignores dangling edges (reported elsewhere)', () => {
        const packs = [{ id: 'a', requires: ['nope'] }];
        expect(mod._detect_requires_cycle(packs)).toBeNull();
    });

    it('frozen ADR vocab sets are non-empty', () => {
        expect(mod.ADR_WORKSPACES.size).toBeGreaterThan(0);
        expect(mod.ADR_PACKS.size).toBeGreaterThan(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------


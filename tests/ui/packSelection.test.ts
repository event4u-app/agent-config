/**
 * Tests for the pure pack-selection helpers
 * (road-to-setup-experience § Phase 2).
 */
import { describe, expect, it } from 'vitest';
import { seedPackSelection, computePackRemovals } from '../../src/ui/wizard/packSelection.js';

const NO_CLUSTERS = new Map<string, string>();

describe('seedPackSelection', () => {
    it('seeds installed packs first', () => {
        const seed = seedPackSelection({
            installed: ['git', 'php'],
            roleDefaults: [],
            detected: [],
            clusterOf: NO_CLUSTERS,
        });
        expect(seed).toEqual({ git: true, php: true });
    });

    it('unions role defaults and detected packs on top', () => {
        const seed = seedPackSelection({
            installed: ['git'],
            roleDefaults: ['engineering-base', 'git'],
            detected: ['typescript'],
            clusterOf: NO_CLUSTERS,
        });
        expect(seed).toEqual({ git: true, 'engineering-base': true, typescript: true });
    });

    it('pulls the language cluster on for installed framework children', () => {
        const seed = seedPackSelection({
            installed: ['laravel'],
            roleDefaults: [],
            detected: [],
            clusterOf: new Map([['laravel', 'php']]),
        });
        expect(seed).toEqual({ laravel: true, php: true });
    });

    it('returns an empty seed when nothing is known', () => {
        expect(seedPackSelection({
            installed: [],
            roleDefaults: [],
            detected: [],
            clusterOf: NO_CLUSTERS,
        })).toEqual({});
    });
});

describe('computePackRemovals', () => {
    it('flags installed packs missing from the final set', () => {
        expect(computePackRemovals(['git', 'php', 'laravel'], ['git'])).toEqual(['laravel', 'php']);
    });

    it('returns empty when the final set keeps everything', () => {
        expect(computePackRemovals(['git'], ['git', 'typescript'])).toEqual([]);
    });

    it('never flags engineering-base (auto-included dependency)', () => {
        expect(computePackRemovals(['engineering-base', 'git'], [])).toEqual(['git']);
    });

    it('is empty for a first run (no installed packs)', () => {
        expect(computePackRemovals([], ['git'])).toEqual([]);
    });
});

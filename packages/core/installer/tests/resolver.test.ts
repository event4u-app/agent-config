/**
 * Tests for the pack `requires_hint` transitive resolver.
 *
 * Covers user-order preservation, BFS auto-add order, multi-parent
 * recording, missing-pack reporting, and the no-op no-deps case.
 */

import { describe, expect, it } from 'vitest';

import { resolvePacks, resolvedPackIds } from '../src/resolver.js';
import { makeManifest, makePack } from './_fixtures.js';

describe('resolvePacks', () => {
    it('returns empty result for empty selection', () => {
        const manifest = makeManifest({ packs: [makePack({ id: 'a' })] });
        const result = resolvePacks(manifest, []);
        expect(result.packs).toEqual([]);
        expect(result.missing).toEqual([]);
    });

    it('preserves user-selected order and marks them not auto-selected', () => {
        const manifest = makeManifest({
            packs: [makePack({ id: 'a' }), makePack({ id: 'b' }), makePack({ id: 'c' })],
        });
        const result = resolvePacks(manifest, ['b', 'a']);
        expect(resolvedPackIds(result)).toEqual(['b', 'a']);
        expect(result.packs.every((p) => !p.autoSelected)).toBe(true);
        expect(result.packs.every((p) => p.requiredBy.length === 0)).toBe(true);
    });

    it('transitively pulls in requires_hint via BFS', () => {
        const manifest = makeManifest({
            packs: [
                makePack({ id: 'laravel', requires_hint: ['php'] }),
                makePack({ id: 'php', requires_hint: ['engineering-base'] }),
                makePack({ id: 'engineering-base' }),
            ],
        });
        const result = resolvePacks(manifest, ['laravel']);
        expect(resolvedPackIds(result)).toEqual(['laravel', 'php', 'engineering-base']);
        const php = result.packs.find((p) => p.id === 'php');
        expect(php?.autoSelected).toBe(true);
        expect(php?.requiredBy).toEqual(['laravel']);
        const base = result.packs.find((p) => p.id === 'engineering-base');
        expect(base?.requiredBy).toEqual(['php']);
    });

    it('records multiple parents for a shared dependency', () => {
        const manifest = makeManifest({
            packs: [
                makePack({ id: 'laravel', requires_hint: ['php'] }),
                makePack({ id: 'symfony', requires_hint: ['php'] }),
                makePack({ id: 'php' }),
            ],
        });
        const result = resolvePacks(manifest, ['laravel', 'symfony']);
        const php = result.packs.find((p) => p.id === 'php');
        expect(php?.autoSelected).toBe(true);
        expect(php?.requiredBy).toEqual(['laravel', 'symfony']);
    });

    it('reports missing packs in the result without throwing', () => {
        const manifest = makeManifest({ packs: [makePack({ id: 'a' })] });
        const result = resolvePacks(manifest, ['a', 'b']);
        expect(resolvedPackIds(result)).toEqual(['a']);
        expect(result.missing).toEqual(['b']);
    });

    it('reports missing transitive dependency once', () => {
        const manifest = makeManifest({
            packs: [makePack({ id: 'laravel', requires_hint: ['missing'] })],
        });
        const result = resolvePacks(manifest, ['laravel']);
        expect(result.missing).toEqual(['missing']);
        expect(resolvedPackIds(result)).toEqual(['laravel']);
    });

    it('does not auto-add a pack the user already selected', () => {
        const manifest = makeManifest({
            packs: [
                makePack({ id: 'laravel', requires_hint: ['php'] }),
                makePack({ id: 'php' }),
            ],
        });
        const result = resolvePacks(manifest, ['php', 'laravel']);
        expect(resolvedPackIds(result)).toEqual(['php', 'laravel']);
        const php = result.packs.find((p) => p.id === 'php');
        expect(php?.autoSelected).toBe(false);
        expect(php?.requiredBy).toEqual([]);
    });

    it('handles cycles without infinite loop', () => {
        const manifest = makeManifest({
            packs: [
                makePack({ id: 'a', requires_hint: ['b'] }),
                makePack({ id: 'b', requires_hint: ['a'] }),
            ],
        });
        const result = resolvePacks(manifest, ['a']);
        expect(resolvedPackIds(result).sort()).toEqual(['a', 'b']);
    });
});

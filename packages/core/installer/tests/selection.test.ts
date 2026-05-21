/**
 * Tests for the selection helpers: CSV parsing, workspace/pack validation,
 * default-pack expansion, candidate merging.
 */

import { describe, expect, it } from 'vitest';

import {
    UnknownPackError,
    UnknownWorkspaceError,
    defaultPacksFor,
    mergePackCandidates,
    packsForWorkspaces,
    parseCsv,
    validatePackIds,
    validateWorkspaces,
} from '../src/selection.js';
import { makeManifest, makePack, makeWorkspace } from './_fixtures.js';

describe('parseCsv', () => {
    it('returns empty for undefined/empty/whitespace', () => {
        expect(parseCsv(undefined)).toEqual([]);
        expect(parseCsv('')).toEqual([]);
        expect(parseCsv('   ')).toEqual([]);
    });

    it('trims whitespace and drops empty entries', () => {
        expect(parseCsv('a, b ,, c')).toEqual(['a', 'b', 'c']);
    });
});

describe('validateWorkspaces / validatePackIds', () => {
    const manifest = makeManifest({
        workspaces: [makeWorkspace({ id: 'engineering' }), makeWorkspace({ id: 'data' })],
        packs: [makePack({ id: 'a' }), makePack({ id: 'b' })],
    });

    it('passes known ids through', () => {
        expect(validateWorkspaces(manifest, ['engineering'])).toEqual(['engineering']);
        expect(validatePackIds(manifest, ['a', 'b'])).toEqual(['a', 'b']);
    });

    it('throws on unknown workspace id', () => {
        expect(() => validateWorkspaces(manifest, ['nope'])).toThrow(UnknownWorkspaceError);
    });

    it('throws on unknown pack id', () => {
        expect(() => validatePackIds(manifest, ['nope'])).toThrow(UnknownPackError);
    });
});

describe('packsForWorkspaces', () => {
    it('filters to packs intersecting the workspace set', () => {
        const manifest = makeManifest({
            packs: [
                makePack({ id: 'a', workspaces: ['engineering'] }),
                makePack({ id: 'b', workspaces: ['data'] }),
                makePack({ id: 'c', workspaces: ['engineering', 'data'] }),
            ],
        });
        const r = packsForWorkspaces(manifest, ['engineering']);
        expect(r.map((p) => p.id).sort()).toEqual(['a', 'c']);
    });
});

describe('defaultPacksFor', () => {
    it('expands default packs in workspace order, deduped', () => {
        const manifest = makeManifest({
            workspaces: [
                makeWorkspace({ id: 'engineering', default_packs: ['base', 'shared'] }),
                makeWorkspace({ id: 'data', default_packs: ['shared', 'data-base'] }),
            ],
        });
        expect(defaultPacksFor(manifest, ['engineering', 'data'])).toEqual(['base', 'shared', 'data-base']);
    });

    it('skips unknown workspace ids silently', () => {
        const manifest = makeManifest({
            workspaces: [makeWorkspace({ id: 'engineering', default_packs: ['base'] })],
        });
        expect(defaultPacksFor(manifest, ['nope', 'engineering'])).toEqual(['base']);
    });
});

describe('mergePackCandidates', () => {
    const manifest = makeManifest({
        workspaces: [makeWorkspace({ id: 'engineering', default_packs: ['base'] })],
        packs: [
            makePack({ id: 'base' }),
            makePack({ id: 'laravel' }),
            makePack({ id: 'php' }),
            makePack({ id: 'extra' }),
        ],
    });

    it('explicit first, then defaults, then detected; dedupes', () => {
        const out = mergePackCandidates({
            manifest,
            workspaces: ['engineering'],
            explicitPacks: ['laravel'],
            excludePacks: [],
            autoDetected: ['php'],
        });
        expect(out).toEqual(['laravel', 'base', 'php']);
    });

    it('explicit pack already in defaults stays in explicit position', () => {
        const out = mergePackCandidates({
            manifest,
            workspaces: ['engineering'],
            explicitPacks: ['base'],
            excludePacks: [],
            autoDetected: [],
        });
        expect(out).toEqual(['base']);
    });

    it('exclude removes from every source', () => {
        const out = mergePackCandidates({
            manifest,
            workspaces: ['engineering'],
            explicitPacks: ['laravel', 'extra'],
            excludePacks: ['extra', 'php'],
            autoDetected: ['php'],
        });
        expect(out).toEqual(['laravel', 'base']);
    });

    it('returns empty when nothing is selected', () => {
        const out = mergePackCandidates({
            manifest,
            workspaces: [],
            explicitPacks: [],
            excludePacks: [],
            autoDetected: [],
        });
        expect(out).toEqual([]);
    });
});

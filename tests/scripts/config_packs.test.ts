// Tests for src/scripts/config/packs.ts (py2ts Phase 8).
//
// 1:1 port of tests/test_pack_loader.py — resolve_active_packs (always-on
// seeding, requires-closure, suggests-not-expanded, legacy-all, defensive
// drop) and resolve_active_set (owner-based command membership, packs∩active
// skill membership, rules never projected). The monkeypatch seam mirrors the
// pytest `monkeypatch.setattr(packs, "load_packs_vocab"/"load_manifest", ...)`.
// The python3-vs-tsx golden-parity block was retired with the Python→TS final
// deletion (the Python pack loader no longer exists).
import { afterEach, describe, expect, it } from 'vitest';

import * as packs from '../../src/scripts/config/packs.js';

type Dict = Record<string, unknown>;

const VOCAB: Record<string, Dict> = {
    'engineering-base': { always_on: false },
    meta: { always_on: true },
    php: { requires: ['engineering-base'] },
    laravel: { requires: ['php', 'engineering-base'] },
    'finance-basic': {},
    'finance-advanced': { requires: ['finance-basic'] },
    soft: { suggests: ['finance-basic'] },
};

const MANIFEST: Dict[] = [
    { category: 'command', path: 'c/eng.md', pack: 'engineering-base', packs: ['meta'] },
    { category: 'command', path: 'c/meta.md', pack: 'meta', packs: ['meta'] },
    { category: 'command', path: 'c/fin.md', pack: 'finance-basic', packs: ['meta'] },
    { category: 'skill', path: 's/eng.md', packs: ['engineering-base'] },
    { category: 'skill', path: 's/fin.md', packs: ['finance-basic', 'meta'] },
    { category: 'rule', path: 'r/router.md', packs: ['meta'] },
];

afterEach(() => {
    // Restore the real loaders after any seam override.
    packs._setConfigForTest({
        load_packs_vocab: packs.load_packs_vocab,
        load_manifest: packs.load_manifest,
    });
});

// --- resolve_active_packs (pure) -------------------------------------------

describe('packs — resolve_active_packs (pure)', () => {
    it('always-on seeded even when not selected', () => {
        expect(packs.resolve_active_packs(VOCAB, [])).toContain('meta');
    });

    it('requires closure expands transitively', () => {
        const got = new Set(packs.resolve_active_packs(VOCAB, ['laravel']));
        expect(got).toEqual(new Set(['laravel', 'php', 'engineering-base', 'meta']));
    });

    it('suggests is not expanded', () => {
        const got = new Set(packs.resolve_active_packs(VOCAB, ['soft']));
        expect(got.has('finance-basic')).toBe(false);
        expect(got.has('soft')).toBe(true);
        expect(got.has('meta')).toBe(true);
    });

    it('legacy-all returns entire vocabulary', () => {
        expect(new Set(packs.resolve_active_packs(VOCAB, [], { legacy_all: true }))).toEqual(
            new Set(Object.keys(VOCAB)),
        );
    });

    it('unknown pack dropped defensively', () => {
        // A typo'd pack must not crash; only always-on survives.
        expect(packs.resolve_active_packs(VOCAB, ['nonexistent'])).toEqual(
            [...packs.always_on_packs(VOCAB)].sort(),
        );
    });
});

// --- resolve_active_set (manifest-backed, seam-injected) -------------------

function patchSeam(): void {
    packs._setConfigForTest({
        load_packs_vocab: () => VOCAB,
        load_manifest: () => MANIFEST,
    });
}

describe('packs — resolve_active_set (seam-injected)', () => {
    it('scoped includes active owner and always-on', () => {
        patchSeam();
        const s = packs.resolve_active_set('.', ['finance-basic']);
        expect(new Set(s.packs)).toEqual(new Set(['finance-basic', 'meta']));
        expect(s.commands).toContain('c/meta.md'); // meta owner — always-on
        expect(s.commands).toContain('c/fin.md'); // finance-basic owner — active
        expect(s.commands).not.toContain('c/eng.md'); // engineering-base owner — inactive
        expect(s.skills).toContain('s/fin.md'); // packs ∩ active
        expect(s.skills).not.toContain('s/eng.md'); // only inactive pack
    });

    it('rules never projected', () => {
        patchSeam();
        const s = packs.resolve_active_set('.', ['finance-basic'], { legacy_all: false });
        const everything = [...s.commands, ...s.skills];
        expect(everything.every((p) => !p.startsWith('r/'))).toBe(true);
    });

    it('legacy-all projects all commands and skills', () => {
        patchSeam();
        const s = packs.resolve_active_set('.', [], { legacy_all: true });
        expect(s.commands.length).toBe(3);
        expect(s.skills.length).toBe(2);
        expect([...s.commands, ...s.skills].every((p) => !p.startsWith('r/'))).toBe(true);
    });

    it('command membership is owner-based not discovery', () => {
        patchSeam();
        // c/eng.md has discovery packs=[meta] (always-on) but owner=engineering-base.
        const s = packs.resolve_active_set('.', []); // only meta
        expect(s.commands).not.toContain('c/eng.md');
        expect(s.commands).toContain('c/meta.md');
    });

    it('to_dict shape', () => {
        patchSeam();
        const s = packs.resolve_active_set('.', ['finance-basic']);
        const d = s.to_dict();
        expect(d['legacy_all']).toBe(false);
        expect(d['counts']).toEqual({
            packs: s.packs.length,
            commands: s.commands.length,
            skills: s.skills.length,
        });
    });
});

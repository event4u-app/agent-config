// Tests for src/scripts/config/packs.ts (py2ts Phase 8).
//
// 1:1 port of tests/test_pack_loader.py — resolve_active_packs (always-on
// seeding, requires-closure, suggests-not-expanded, legacy-all, defensive
// drop) and resolve_active_set (owner-based command membership, packs∩active
// skill membership, rules never projected). The monkeypatch seam mirrors the
// pytest `monkeypatch.setattr(packs, "load_packs_vocab"/"load_manifest", ...)`.
// Plus a golden-parity block diffing python3 vs tsx CLI JSON.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import * as packs from '../../src/scripts/config/packs.js';
import { REPO_ROOT, runTsx } from './_config_parity.js';

const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'config', 'packs.ts');
const PY_MODULE_ARGS = ['-m', 'scripts.config.packs'];

// ── Why this block stays LIVE python↔tsx (not snapshot-frozen) ──────────────
// `config_packs --json` resolves each pack's file-closure from the discovery
// manifest (`load_manifest`), which is GITIGNORED and built fresh per build
// environment. A frozen snapshot would bake the CAPTURE machine's manifest-
// derived closure and diverge from CI's freshly-built one — a CI-only failure
// that does not reproduce locally (locally both sides read the same manifest).
// AI council (claude-sonnet-4-5 + gpt-4o, 2026-06-18) ruled: a rig may be
// snapshot-frozen ONLY if its output is a pure function of committed source;
// rigs reading generated/gitignored state stay LIVE python↔tsx until the
// deletion phase (the manifest builder is not provably cross-environment
// deterministic, so the deterministic-build-in-setup alternative is unsafe).
// So this block spawns python3 directly (not via the snapshot oracle) and is
// gated on a REAL python3 — runs on CI (python present), skips once python is
// removed. Tracked for resolution in the Phase-5 deletion work.
function realPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function livePy(args: string[]): { status: number; stdout: string; stderr: string } {
    const r = spawnSync('python3', args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src') },
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

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

// ---- Golden parity (python3 vs tsx) — CLI JSON byte-for-byte ----
// LIVE python↔tsx (not snapshot-frozen): both sides read the SAME freshly-built
// discovery manifest in the same environment, so the JSON is byte-comparable.
// See the rationale block at the top — this is the council-mandated disposition
// for a manifest-dependent rig. Gated on a REAL python3 (skips post-deletion).
const py = realPython3();
describe.skipIf(!py)('packs — golden parity (python3 vs tsx CLI)', () => {
    it('legacy-all --json matches', () => {
        const pyOut = livePy([...PY_MODULE_ARGS, '--legacy-all', '--json']);
        const tsOut = runTsx(TS_SCRIPT, ['--legacy-all', '--json']);
        expect(pyOut.status).toBe(0);
        expect(tsOut.status).toBe(0);
        expect(tsOut.stdout).toBe(pyOut.stdout);
    });

    it('scoped --packs laravel,finance-basic --json matches', () => {
        const pyOut = livePy([...PY_MODULE_ARGS, '--packs', 'laravel,finance-basic', '--json']);
        const tsOut = runTsx(TS_SCRIPT, ['--packs', 'laravel,finance-basic', '--json']);
        expect(tsOut.stdout).toBe(pyOut.stdout);
    });

    it('always-on only --json matches', () => {
        const pyOut = livePy([...PY_MODULE_ARGS, '--json']);
        const tsOut = runTsx(TS_SCRIPT, ['--json']);
        expect(tsOut.stdout).toBe(pyOut.stdout);
    });
});

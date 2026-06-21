// Tests for src/scripts/config/session_profiles.ts (py2ts Phase 8).
//
// 1:1 port of tests/test_session_profiles.py — pure helpers (closure, token
// resolution), activate/overlay-write (local-file only, fail-fast, atomic),
// deactivate (clear + named removal preserving shared deps), fail-open read,
// surface filter (recommendation-bias), staleness notice, plain status.
// Writers run against a temp `fake_repo` (never the live repo). The
// python3-vs-tsx golden-parity block was retired with the Python→TS final
// deletion (the Python session-profile loader no longer exists).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type * as YamlModule from 'yaml';

import * as sp from '../../src/scripts/config/session_profiles.js';
import { REPO_ROOT } from './_config_parity.js';

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sessprof-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            // ignore
        }
    }
});

/**
 * A minimal repo root with the two discovery configs copied in. No `packs:`
 * block in settings → installed set = full vocabulary, so every pack in
 * packs.yml is activatable in the fixture.
 */
function fakeRepo(): string {
    const tmp = mkTmp();
    fs.mkdirSync(path.join(tmp, 'src', 'config', 'discovery'), { recursive: true });
    for (const rel of [sp.PACKS_VOCAB_REL, sp.ALIASES_REL]) {
        fs.copyFileSync(path.join(REPO_ROOT, rel), path.join(tmp, rel));
    }
    fs.mkdirSync(path.join(tmp, 'agents', 'settings'), { recursive: true });
    return tmp;
}

// --- pure helpers ----------------------------------------------------------

describe('session_profiles — pure helpers', () => {
    it('expand_closure laravel', () => {
        const vocab = sp.load_packs_vocab(REPO_ROOT);
        expect(new Set(sp.expand_closure(['laravel'], vocab))).toEqual(
            new Set(['laravel', 'php', 'engineering-base']),
        );
    });

    it('resolve alias and pack id', () => {
        const vocab = sp.load_packs_vocab(REPO_ROOT);
        const aliases = sp.load_aliases(REPO_ROOT);
        expect(sp.resolve_tokens(['po'], vocab, aliases)).toEqual([
            'product-basic',
            'product-discovery',
        ]);
        expect(sp.resolve_tokens(['laravel'], vocab, aliases)).toEqual(['laravel']);
    });

    it('resolve unknown token raises', () => {
        const vocab = sp.load_packs_vocab(REPO_ROOT);
        const aliases = sp.load_aliases(REPO_ROOT);
        expect(() => sp.resolve_tokens(['does-not-exist'], vocab, aliases)).toThrow(
            sp.SessionProfileError,
        );
    });
});

// --- activate / overlay write ---------------------------------------------

describe('session_profiles — activate / overlay write', () => {
    it('activate writes closure', () => {
        const repo = fakeRepo();
        const res = sp.activate(repo, ['laravel'], {});
        expect(new Set(res.active_packs)).toEqual(new Set(['laravel', 'php', 'engineering-base']));
        expect(new Set(res.closure_added)).toEqual(new Set(['php', 'engineering-base']));
        const local = path.join(repo, 'agents', 'settings', '.agent-settings.local.yml');
        expect(fs.existsSync(local)).toBe(true);
        expect(sp.read_overlay(repo)).toEqual(
            ['laravel', 'php', 'engineering-base'].sort(),
        );
    });

    it('overlay never touches committed settings', () => {
        const repo = fakeRepo();
        sp.activate(repo, ['laravel'], {});
        const committed = path.join(repo, 'agents', 'settings', '.agent-settings.yml');
        expect(fs.existsSync(committed)).toBe(false);
    });

    it('activate fail-fast not installed', () => {
        const repo = fakeRepo();
        expect(() => sp.activate(repo, ['laravel'], { packs: ['python'] })).toThrow(
            sp.SessionProfileError,
        );
    });

    it('multiple tokens union', () => {
        const repo = fakeRepo();
        const res = sp.activate(repo, ['laravel', 'po'], {});
        const active = new Set(res.active_packs);
        for (const p of [
            'laravel',
            'php',
            'engineering-base',
            'product-basic',
            'product-discovery',
        ]) {
            expect(active.has(p)).toBe(true);
        }
    });
});

// --- deactivate ------------------------------------------------------------

describe('session_profiles — deactivate', () => {
    it('deactivate clears', () => {
        const repo = fakeRepo();
        sp.activate(repo, ['laravel'], {});
        expect(sp.deactivate(repo)).toEqual([]);
        expect(sp.read_overlay(repo)).toEqual([]);
    });

    it('deactivate keeps shared dependency', () => {
        const repo = fakeRepo();
        // php + laravel both depend on engineering-base; php is its own seed.
        sp.activate(repo, ['laravel', 'php'], {});
        const remaining = sp.deactivate(repo, ['laravel']);
        expect(remaining).toContain('engineering-base');
        expect(remaining).toContain('php');
        expect(remaining).not.toContain('laravel');
    });
});

// --- fail-open read + atomic write -----------------------------------------

describe('session_profiles — fail-open read + atomic write', () => {
    it('fail-open on corrupt overlay', () => {
        const repo = fakeRepo();
        const local = path.join(repo, 'agents', 'settings', '.agent-settings.local.yml');
        fs.writeFileSync(local, 'runtime: [this is: not valid: yaml: at all\n', 'utf-8');
        expect(sp.read_overlay(repo)).toEqual([]);
    });

    it('fail-open on wrong type', () => {
        const repo = fakeRepo();
        const local = path.join(repo, 'agents', 'settings', '.agent-settings.local.yml');
        fs.writeFileSync(local, 'runtime:\n  active_packs: notalist\n', 'utf-8');
        expect(sp.read_overlay(repo)).toEqual([]);
    });

    it('set_overlay preserves other local keys', () => {
        const repo = fakeRepo();
        const local = path.join(repo, 'agents', 'settings', '.agent-settings.local.yml');
        fs.writeFileSync(local, 'linked_projects:\n  - path: /x\n', 'utf-8');
        sp.set_overlay(repo, ['laravel']);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const YAML = require('yaml') as typeof YamlModule;
        const data = YAML.parse(fs.readFileSync(local, 'utf-8'), { version: '1.1' });
        expect('linked_projects' in data).toBe(true);
        expect(data['runtime']['active_packs']).toEqual(['laravel']);
    });
});

// --- surface filter (recommendation-bias) ----------------------------------

function writeManifest(repo: string, artefacts: Record<string, unknown>[]): void {
    const p = path.join(repo, sp.DISCOVERY_MANIFEST_REL);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ artefacts }), 'utf-8');
}

const SYNTH_ARTEFACTS: Record<string, unknown>[] = [
    { name: 'laravel', category: 'skill', packs: ['laravel'], trust: { level: 'professional' } },
    { name: 'eloquent', category: 'skill', packs: ['laravel'], trust: { level: 'professional' } },
    {
        name: 'po-discovery',
        category: 'skill',
        packs: ['product-basic'],
        trust: { level: 'professional' },
    },
    {
        name: 'video-director',
        category: 'skill',
        packs: ['ai-video'],
        trust: { level: 'professional' },
    },
    { name: 'git-workflow', category: 'skill', packs: ['engineering-base'], trust: { level: 'core' } },
    { name: 'commit', category: 'command', packs: ['meta'], trust: { level: 'core' } },
];

describe('session_profiles — surface filter', () => {
    it('surface hides inactive pack skills', () => {
        const repo = fakeRepo();
        writeManifest(repo, SYNTH_ARTEFACTS);
        const surf = sp.compute_surface(repo, {
            category: 'skill',
            active: ['laravel', 'php', 'engineering-base'],
        });
        const shown = new Set(surf.shown.map((a) => a['name']));
        const hidden = new Set(surf.hidden.map((a) => a['name']));
        expect(shown.has('laravel')).toBe(true);
        expect(shown.has('git-workflow')).toBe(true);
        expect(hidden.has('po-discovery')).toBe(true);
        expect(hidden.has('video-director')).toBe(true);
        expect(surf.hidden.length).toBeGreaterThan(0);
    });

    it('no overlay shows everything', () => {
        const repo = fakeRepo();
        writeManifest(repo, SYNTH_ARTEFACTS);
        const surf = sp.compute_surface(repo, { active: [] });
        expect(surf.hidden).toEqual([]);
    });

    it('missing manifest is safe', () => {
        const repo = fakeRepo();
        const surf = sp.compute_surface(repo, { active: ['laravel'] });
        expect(surf.shown).toEqual([]);
        expect(surf.hidden).toEqual([]);
    });

    it('core trust always shown', () => {
        const art = { name: 'x', category: 'skill', packs: ['ai-video'], trust: { level: 'core' } };
        expect(sp.is_surfaced(art, new Set(['laravel']))).toBe(true);
    });

    it('professional pack skill hidden when inactive', () => {
        const art = {
            name: 'y',
            category: 'skill',
            packs: ['ai-video'],
            trust: { level: 'professional' },
        };
        expect(sp.is_surfaced(art, new Set(['laravel']))).toBe(false);
    });
});

// --- staleness notice (option a) -------------------------------------------

describe('session_profiles — staleness notice', () => {
    it('stale notice when overlay present', () => {
        const repo = fakeRepo();
        sp.activate(repo, ['laravel'], {});
        const notice = sp.stale_notice(repo);
        expect(notice).toBeTruthy();
        expect(notice).toContain('laravel');
        expect(notice).toContain('/profile deactivate');
    });

    it('stale notice none when empty', () => {
        const repo = fakeRepo();
        expect(sp.stale_notice(repo)).toBeNull();
    });
});

// --- plain status surface --------------------------------------------------

describe('session_profiles — plain status', () => {
    it('plain no overlay full surface', () => {
        const out = sp.format_plain_status([], 150, 227, 0);
        expect(out).toBe(
            'No profile is active — you see the full surface: every command and skill is available.',
        );
    });

    it('plain single pack overlay', () => {
        const out = sp.format_plain_status(['engineering-base'], 40, 60, 167);
        expect(out).toContain('Profile active: engineering-base.');
        expect(out).toContain("You'll see 40 commands and 60 skills.");
        expect(out).toContain("167 item(s) are hidden behind packs you haven't turned on");
        expect(out).toContain('persists across sessions until you run `/profile deactivate`');
        expect(out).not.toContain('days');
    });

    it('plain multi pack overlay joins names', () => {
        const out = sp.format_plain_status(['finance-basic', 'finance-advanced'], 12, 20, 345);
        expect(out).toContain('Profile active: finance-basic, finance-advanced.');
    });

    it('plain render is deterministic', () => {
        const a = sp.format_plain_status(['ops-people'], 30, 50, 100);
        const b = sp.format_plain_status(['ops-people'], 30, 50, 100);
        expect(a).toBe(b);
    });
});

// Tests for src/scripts/config/profiles.ts (py2ts Phase 8).
//
// 1:1 port of tests/test_config_profiles.py — resolution chain, no-settings
// default, settings-without-profile-block warning, unknown-id error, seed
// shapes. Plus a golden-structure block (python-free conversion of the
// retired python3 parity suite) asserting the resolved-profile envelope is
// deterministic, JSON-clean, and well-typed for every seed profile.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_PROFILE_ID,
    PROFILE_ID_ENV,
    ProfileError,
    SEED_PROFILE_IDS,
    SOURCE_DEFAULT,
    SOURCE_ENV,
    SOURCE_MISSING,
    SOURCE_RUNTIME,
    SOURCE_USER,
    resolve_profile,
} from '../../src/scripts/config/profiles.js';
import { REPO_ROOT } from './_config_parity.js';

const SEED_ROOT = REPO_ROOT;

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cfgprof-'));
    tmpDirs.push(d);
    return d;
}
const _saved: Record<string, string | undefined> = {};
function setEnv(key: string, value: string): void {
    if (!(key in _saved)) _saved[key] = process.env[key];
    process.env[key] = value;
}
function delEnv(key: string): void {
    if (!(key in _saved)) _saved[key] = process.env[key];
    delete process.env[key];
}
afterEach(() => {
    for (const k of Object.keys(_saved)) {
        if (_saved[k] === undefined) delete process.env[k];
        else process.env[k] = _saved[k];
        delete _saved[k];
    }
    for (const d of tmpDirs.splice(0)) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            // ignore
        }
    }
});

describe('config/profiles — resolution chain', () => {
    it('seed set complete', () => {
        for (const profile_id of SEED_PROFILE_IDS) {
            const r = resolve_profile({ project_root: SEED_ROOT, runtime_id: profile_id });
            expect(r.id).toBe(profile_id);
        }
    });

    it.each([...SEED_PROFILE_IDS])('each seed profile resolves: %s', (profile_id) => {
        const r = resolve_profile({ project_root: SEED_ROOT, runtime_id: profile_id });
        expect(r.id).toBe(profile_id);
        expect(r.source).toBe(SOURCE_RUNTIME);
        expect(['fast', 'balanced', 'strict']).toContain(r.preset_id);
        expect(r.audience['label']).toBeTruthy();
    });

    it('no settings returns developer default', () => {
        const tmp = mkTmp();
        const r = resolve_profile({ project_root: tmp });
        expect(r.id).toBe(DEFAULT_PROFILE_ID);
        expect(r.source).toBe(SOURCE_DEFAULT);
    });

    it('settings present without profile block warns', () => {
        const tmp = mkTmp();
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'name: matze\n', 'utf-8');
        const r = resolve_profile({ project_root: tmp, user_settings: { name: 'matze' } });
        expect(r.id).toBe(DEFAULT_PROFILE_ID);
        expect(r.source).toBe(SOURCE_MISSING);
        expect(r.warning).not.toBeNull();
        expect(r.warning).toContain('/onboard');
    });

    it('user settings wins over pack', () => {
        delEnv(PROFILE_ID_ENV);
        const r = resolve_profile({
            project_root: SEED_ROOT,
            user_settings: { profile: { id: 'finance' } },
            pack_profile_id: 'developer',
        });
        expect(r.id).toBe('finance');
        expect(r.source).toBe(SOURCE_USER);
    });

    it('env wins over user', () => {
        setEnv(PROFILE_ID_ENV, 'ops');
        const r = resolve_profile({
            project_root: SEED_ROOT,
            user_settings: { profile: { id: 'developer' } },
        });
        expect(r.id).toBe('ops');
        expect(r.source).toBe(SOURCE_ENV);
    });

    it('runtime wins over env', () => {
        setEnv(PROFILE_ID_ENV, 'ops');
        const r = resolve_profile({
            project_root: SEED_ROOT,
            user_settings: { profile: { id: 'developer' } },
            runtime_id: 'agency',
        });
        expect(r.id).toBe('agency');
        expect(r.source).toBe(SOURCE_RUNTIME);
    });

    it('unknown profile id raises', () => {
        const tmp = mkTmp();
        expect(() =>
            resolve_profile({ project_root: tmp, runtime_id: 'not_a_real_profile' }),
        ).toThrow(ProfileError);
    });

    it('developer seed shape', () => {
        const r = resolve_profile({ project_root: SEED_ROOT, runtime_id: 'developer' });
        expect(r.preset_id).toBe('balanced');
        expect(r.personas).toContain('reviewer');
        expect(r.commands_hint).toContain('work');
        expect(r.audience['readme_anchor']).toBe('developer');
        expect(r.docs_first_pointer).not.toBeNull();
    });

    it('founder seed uses fast preset', () => {
        const r = resolve_profile({ project_root: SEED_ROOT, runtime_id: 'founder' });
        expect(r.preset_id).toBe('fast');
    });

    it('strict default profiles', () => {
        for (const profile_id of ['agency', 'finance', 'ops']) {
            const r = resolve_profile({ project_root: SEED_ROOT, runtime_id: profile_id });
            expect(r.preset_id).toBe('strict');
        }
    });
});

// ---- Golden structure (python-free conversion of the retired parity block) ----
// The resolved envelope comes from the live seed YAMLs, so exact values are
// repo state — asserted structurally (deterministic, JSON-clean, well-typed)
// rather than pinned byte-for-byte.
describe('config/profiles — golden structure (tsx resolved envelope)', () => {
    function envelope(profile_id: string): Record<string, unknown> {
        const r = resolve_profile({ project_root: REPO_ROOT, runtime_id: profile_id });
        return {
            id: r.id,
            audience: r.audience,
            preset_id: r.preset_id,
            packs: [...r.packs],
            personas: [...r.personas],
            skills_hint: [...r.skills_hint],
            commands_hint: [...r.commands_hint],
            docs_first_pointer: r.docs_first_pointer,
            source: r.source,
        };
    }

    it.each([...SEED_PROFILE_IDS])('resolved envelope well-typed for %s', (profile_id) => {
        const ts = envelope(profile_id);
        expect(ts.id).toBe(profile_id);
        expect(ts.source).toBe(SOURCE_RUNTIME);
        expect(['fast', 'balanced', 'strict']).toContain(ts.preset_id);
        // The list-shaped fields hold only non-empty strings.
        for (const key of ['packs', 'personas', 'skills_hint', 'commands_hint'] as const) {
            const list = ts[key] as unknown[];
            expect(Array.isArray(list)).toBe(true);
            for (const entry of list) {
                expect(typeof entry).toBe('string');
                expect((entry as string).trim()).toBeTruthy();
            }
        }
        const audience = ts.audience as Record<string, unknown>;
        expect(typeof audience['label']).toBe('string');
        // JSON round-trip is lossless — the envelope is plain data.
        expect(JSON.parse(JSON.stringify(ts))).toEqual(ts);
        // Repeat resolution is deterministic.
        expect(envelope(profile_id)).toEqual(ts);
    });
});

/**
 * Tests for the Phase 4 ("delete, revoke, audit") addition to
 * `src/scripts/_lib/agent_user_profile.ts` — `revokeGlobalProfileField`, the
 * delete counterpart of `applyObservationToGlobalProfile`, per
 * `road-to-global-user-memory.md` Phase 4.
 *
 * Every test injects `EVENT4U_CONFIG_HOME` at a temp dir and pins `$HOME`
 * to an empty temp dir (mirrors `tests/lib/agent_user_profile.test.ts`) so
 * the real `~/.event4u/agent-config/` and `~/.config/agent-config/` on the
 * machine running this suite are never touched.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as aup from '../../src/scripts/_lib/agent_user_profile';
import * as ugr from '../../src/scripts/_lib/user_global_revocations';

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmp_dirs.push(dir);
    return dir;
}

function isolate_home(): void {
    const fake_home = make_tmp('aup-revoke-fakehome-');
    saved_env.push(['HOME', process.env.HOME]);
    process.env.HOME = fake_home;
}

beforeEach(() => {
    isolate_home();
});

afterEach(() => {
    vi.restoreAllMocks();
    while (saved_env.length > 0) {
        const [key, value] = saved_env.pop() as [string, string | undefined];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

function fakeConfigHome(): { home: string; env: { EVENT4U_CONFIG_HOME: string } } {
    const home = make_tmp('aup-revoke-config-');
    return { home, env: { EVENT4U_CONFIG_HOME: home } };
}

function writeGlobalProfile(home: string, body: string): string {
    const target = path.join(home, aup.GLOBAL_PROFILE_RELATIVE);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body, 'utf-8');
    return target;
}

const PROFILE_BODY = `---
version: 1
identity:
  name: "Matze"
  nickname: "M"
language: "de"
style:
  pace: "pragmatic"
last_updated: "2026-08-01"
---

A note from both layers.
`;

describe('revokeGlobalProfileField', () => {
    it('removes the field, bumps last_updated, and leaves every other field intact', () => {
        const { home, env } = fakeConfigHome();
        const target = writeGlobalProfile(home, PROFILE_BODY);

        const result = aup.revokeGlobalProfileField('identity.name', 'user asked to forget', {
            env,
            today: '2026-08-10',
        });

        expect(result.revoked).toBe(true);
        const layer = aup.loadProfileLayer(target, 'global');
        expect(layer?.data.identity).toEqual({ nickname: 'M' });
        expect(layer?.data.language).toBe('de');
        expect(layer?.data.last_updated).toBe('2026-08-10');
    });

    it('prunes an emptied parent object — revoking the LAST identity.* field drops `identity` entirely', () => {
        const { home, env } = fakeConfigHome();
        const target = writeGlobalProfile(
            home,
            `---\nversion: 1\nidentity:\n  name: "Matze"\nlast_updated: "2026-08-01"\n---\n`,
        );

        aup.revokeGlobalProfileField('identity.name', 'forget', { env, today: '2026-08-11' });

        const layer = aup.loadProfileLayer(target, 'global');
        expect(layer?.data.identity).toBeUndefined();
    });

    it('revokes the top-level `notes` field', () => {
        const { home, env } = fakeConfigHome();
        const target = writeGlobalProfile(home, PROFILE_BODY);

        aup.revokeGlobalProfileField('notes', 'stale note', { env, today: '2026-08-12' });

        const layer = aup.loadProfileLayer(target, 'global');
        expect(layer?.data.notes).toBeUndefined();
    });

    it('records a tombstone keyed profile:<field>', () => {
        const { home, env } = fakeConfigHome();
        writeGlobalProfile(home, PROFILE_BODY);

        aup.revokeGlobalProfileField('style.pace', 'no longer accurate', {
            env,
            today: '2026-08-13',
        });

        expect(ugr.loadTombstones(env)).toEqual([
            { revoked_at: '2026-08-13', entity_id: 'profile:style.pace', reason: 'no longer accurate' },
        ]);
    });

    it('reports revoked: false and writes no tombstone when the field has no value', () => {
        const { home, env } = fakeConfigHome();
        writeGlobalProfile(home, PROFILE_BODY);

        const result = aup.revokeGlobalProfileField('voice_sample', 'n/a', { env });

        expect(result.revoked).toBe(false);
        expect(result.tombstone).toBeUndefined();
        expect(ugr.loadTombstones(env)).toEqual([]);
    });

    it('reports revoked: false when profile.md does not exist at all', () => {
        const { env } = fakeConfigHome();
        const result = aup.revokeGlobalProfileField('identity.name', 'n/a', { env });
        expect(result.revoked).toBe(false);
    });

    it('tombstone precedes deletion — a failed tombstone write leaves profile.md untouched', () => {
        // `node:fs`'s ES-module namespace object is non-configurable, so
        // `vi.spyOn(fs, ...)` cannot observe call order directly (see the
        // matching note in `user_global_observations_delete.test.ts`).
        // Gating the ledger write instead proves the stronger property: the
        // rewrite never runs unless the tombstone append ran (and
        // succeeded) first.
        const { home, env } = fakeConfigHome();
        const target = writeGlobalProfile(home, PROFILE_BODY);
        const before = fs.readFileSync(target, 'utf-8');

        const tombstoneSpy = vi.spyOn(ugr, 'appendTombstone').mockImplementation(() => {
            throw new Error('ledger unavailable');
        });

        expect(() =>
            aup.revokeGlobalProfileField('identity.name', 'order check', { env, today: '2026-08-14' }),
        ).toThrow('ledger unavailable');

        expect(tombstoneSpy).toHaveBeenCalledTimes(1);
        expect(fs.readFileSync(target, 'utf-8')).toBe(before);
    });
});

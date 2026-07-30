/**
 * Tests for `src/scripts/_lib/user_global_revocations.ts` — the Phase 4
 * ("delete, revoke, audit") tombstone ledger shared by
 * `user_global_observations.ts` and `agent_user_profile.ts`.
 *
 * Every test injects `EVENT4U_CONFIG_HOME` at a temp dir so the real
 * `~/.event4u/agent-config/` on the machine running this suite is never
 * touched. `$HOME` is also pinned per-test (mirrors the sibling Phase 2/3
 * suites) so the legacy-fallback probe cannot fall through to a real
 * `~/.config/agent-config/`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ugr from '../../src/scripts/_lib/user_global_revocations';

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmp_dirs.push(dir);
    return dir;
}

function isolate_home(): void {
    const fake_home = make_tmp('ugr-fakehome-');
    saved_env.push(['HOME', process.env.HOME]);
    process.env.HOME = fake_home;
}

beforeEach(() => {
    isolate_home();
});

afterEach(() => {
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

function fakeConfigHome(): { home: string } {
    return { home: make_tmp('ugr-config-') };
}

describe('user_global_revocations.ts — ledger location', () => {
    it('lives at user/.revocations.jsonl — same filename ADR-121 uses, different (user-scoped) root', () => {
        expect(ugr.REVOCATIONS_RELATIVE).toBe(path.join('user', '.revocations.jsonl'));
    });

    it('loadTombstones returns [] when the ledger file does not exist', () => {
        const { home } = fakeConfigHome();
        expect(ugr.loadTombstones({ EVENT4U_CONFIG_HOME: home })).toEqual([]);
    });
});

describe('user_global_revocations.ts — appendTombstone / loadTombstones', () => {
    it('records revoked_at / entity_id / reason, oldest first', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        ugr.appendTombstone('obs-a', 'no longer accurate', { today: '2026-08-01', env });
        ugr.appendTombstone('profile:identity.name', 'user asked to forget', {
            today: '2026-08-02',
            env,
        });

        const trail = ugr.loadTombstones(env);
        expect(trail).toEqual([
            { revoked_at: '2026-08-01', entity_id: 'obs-a', reason: 'no longer accurate' },
            { revoked_at: '2026-08-02', entity_id: 'profile:identity.name', reason: 'user asked to forget' },
        ]);
    });

    it('an empty reason is recorded as "no reason given" — never a blank string', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        ugr.appendTombstone('obs-b', '', { today: '2026-08-03', env });
        const [entry] = ugr.loadTombstones(env);
        expect(entry?.reason).toBe('no reason given');
    });

    it('is append-only — a single fs.appendFileSync call per tombstone, never a rewrite of prior lines', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const target = path.join(home, 'user', '.revocations.jsonl');

        ugr.appendTombstone('obs-c', 'first', { today: '2026-08-04', env });
        const afterFirst = fs.readFileSync(target, 'utf-8');
        ugr.appendTombstone('obs-d', 'second', { today: '2026-08-05', env });
        const afterSecond = fs.readFileSync(target, 'utf-8');

        expect(afterSecond.startsWith(afterFirst)).toBe(true);
        expect(ugr.loadTombstones(env)).toHaveLength(2);
    });

    it('tolerates a malformed line — skips it without crashing the read', () => {
        const { home } = fakeConfigHome();
        const env = { EVENT4U_CONFIG_HOME: home };
        const target = path.join(home, 'user', '.revocations.jsonl');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
            target,
            'not json at all\n' + JSON.stringify({ revoked_at: '2026-08-06', entity_id: 'obs-e', reason: 'ok' }) + '\n',
            'utf-8',
        );

        const trail = ugr.loadTombstones(env);
        expect(trail).toHaveLength(1);
        expect(trail[0]?.entity_id).toBe('obs-e');
    });
});

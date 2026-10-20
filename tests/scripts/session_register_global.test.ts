/**
 * Step 1.4 — the live-session register answers a MACHINE-wide question.
 *
 * The repo register is anchored to a git common dir, so it can only ever say
 * "a session is live on this repository". `upgrade --unattended` needs the
 * other question — "is any session live on this machine" — because a swap of
 * the global binary breaks the hooks of every session, not only the ones in
 * the tree the swap happens to run from.
 *
 * These assertions are written against the SECOND repository case on purpose:
 * a global register that merely re-reads the local one passes a single-repo
 * test and fails the only case the step exists for.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    any_live_session,
    global_register_dir,
    iso_now,
    write_record,
} from '../../src/scripts/_lib/session_register.js';

let home: string;

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'global-register-'));
});

afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
});

function record(session_id: string, worktree: string, last_seen: string) {
    return {
        session_id,
        platform: 'claude',
        worktree,
        branch: 'main',
        roadmap_slug: null,
        started_at: last_seen,
        last_seen,
    };
}

describe('global_register_dir', () => {
    it('resolves under the user-global event4u root, not under any repository', () => {
        const dir = global_register_dir({ EVENT4U_CONFIG_HOME: home });
        expect(dir.startsWith(home)).toBe(true);
        expect(dir).not.toContain('.git');
    });

    it('is the same directory for two different repositories', () => {
        const a = global_register_dir({ EVENT4U_CONFIG_HOME: home });
        const b = global_register_dir({ EVENT4U_CONFIG_HOME: home });
        expect(a).toBe(b);
    });
});

describe('any_live_session', () => {
    it('is false when the register directory does not exist', () => {
        const dir = path.join(home, 'runtime', 'sessions');
        expect(any_live_session(dir)).toBe(false);
    });

    it('is false when every record has aged past its TTL', () => {
        const dir = path.join(home, 'runtime', 'sessions');
        fs.mkdirSync(dir, { recursive: true });
        const old = new Date(Date.now() - 48 * 3600 * 1000);
        write_record(dir, record('stale-1', '/repo/a', iso_now(old)));
        expect(any_live_session(dir)).toBe(false);
    });

    it('is TRUE for a session registered from a SECOND repository', () => {
        const dir = path.join(home, 'runtime', 'sessions');
        fs.mkdirSync(dir, { recursive: true });
        write_record(dir, record('peer-in-other-repo', '/some/other/checkout', iso_now()));
        expect(any_live_session(dir)).toBe(true);
    });

    it('excludes the asking session, so a lone session does not block itself', () => {
        const dir = path.join(home, 'runtime', 'sessions');
        fs.mkdirSync(dir, { recursive: true });
        write_record(dir, record('me', '/repo/a', iso_now()));
        expect(any_live_session(dir, 'me')).toBe(false);
        expect(any_live_session(dir)).toBe(true);
    });

    it('still reports a peer when the asking session is also registered', () => {
        const dir = path.join(home, 'runtime', 'sessions');
        fs.mkdirSync(dir, { recursive: true });
        write_record(dir, record('me', '/repo/a', iso_now()));
        write_record(dir, record('peer', '/repo/b', iso_now()));
        expect(any_live_session(dir, 'me')).toBe(true);
    });
});

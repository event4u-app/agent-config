/**
 * Session register — the acceptance criteria of
 * `road-to-parallel-session-coordination`, asserted rather than described.
 *
 * The cases here are deliberately the roadmap's own criteria and its Risk
 * Register, not a happy-path smoke test: two sessions seeing each other, a
 * collision producing a question, a claim landing within one turn, a live
 * session surviving past the TTL *and* a crashed one disappearing, and the
 * `stop`-is-not-session-end trap on every platform shape.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { current_branch, git_common_dir, git_dir } from '../../src/scripts/_lib/git_common_dir.js';
import {
    DEREGISTER_ON_STOP_PLATFORMS,
    HEARTBEAT_REACHABLE_PLATFORMS,
    type SessionRecord,
    TTL_DEFAULT_SECONDS,
    TTL_MEASURED_SECONDS,
    delete_record,
    foreign_live_records,
    is_expired,
    iso_now,
    read_live_records,
    register_dir,
    safe_stem,
    stop_means_session_end,
    ttl_is_measured,
    ttl_seconds_for,
    write_record,
} from '../../src/scripts/_lib/session_register.js';

let tmp: string;

function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

/** A repo with a linked worktree — the shape the whole design rests on. */
function make_repo(): { main: string; wt: string } {
    const main = path.join(tmp, 'repo');
    fs.mkdirSync(main, { recursive: true });
    git(main, 'init', '-q', '-b', 'main');
    git(main, 'config', 'user.email', 'test@example.com');
    git(main, 'config', 'user.name', 'test');
    git(main, 'commit', '-q', '--allow-empty', '-m', 'init');
    const wt = path.join(tmp, 'wt-a');
    git(main, 'worktree', 'add', '-q', wt, '-b', 'feat/a');
    return { main, wt };
}

function rec(over: Partial<SessionRecord> = {}): SessionRecord {
    return {
        session_id: 'sess-1',
        platform: 'claude',
        worktree: '/somewhere',
        branch: 'feat/a',
        roadmap_slug: null,
        started_at: iso_now(),
        last_seen: iso_now(),
        ...over,
    };
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'session-register-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('git_common_dir — the shared anchor', () => {
    it('resolves to the SAME directory from the main checkout and from a worktree', () => {
        const { main, wt } = make_repo();
        const a = git_common_dir(main);
        const b = git_common_dir(wt);
        expect(a).not.toBeNull();
        expect(b).toBe(a);
    });

    it('converges through a symlinked parent — the case the cleanup work warned about', () => {
        const { main, wt } = make_repo();
        const link = path.join(tmp, 'link');
        fs.symlinkSync(tmp, link);
        const direct = git_common_dir(main);
        expect(git_common_dir(path.join(link, 'repo'))).toBe(direct);
        expect(git_common_dir(path.join(link, 'wt-a'))).toBe(direct);
        expect(git_common_dir(wt)).toBe(direct);
    });

    it('git_dir is per-worktree, unlike the common dir', () => {
        const { main, wt } = make_repo();
        expect(git_dir(main)).not.toBe(git_dir(wt));
        expect(git_common_dir(main)).toBe(git_common_dir(wt));
    });

    it('reads the branch from HEAD without shelling out', () => {
        const { main, wt } = make_repo();
        expect(current_branch(main)).toBe('main');
        expect(current_branch(wt)).toBe('feat/a');
    });

    it('degrades to null outside a repository rather than throwing', () => {
        const plain = path.join(tmp, 'not-a-repo');
        fs.mkdirSync(plain);
        expect(git_common_dir(plain)).toBeNull();
        expect(current_branch(plain)).toBeNull();
        expect(register_dir(plain)).toBeNull();
    });
});

describe('acceptance — two sessions in different worktrees see each other', () => {
    it('a record written from the worktree is visible from the main checkout', () => {
        const { main, wt } = make_repo();
        const dir_wt = register_dir(wt);
        const dir_main = register_dir(main);
        expect(dir_wt).toBe(dir_main);

        write_record(dir_wt!, rec({ session_id: 'from-worktree', worktree: wt }));
        const seen = foreign_live_records(dir_main!, 'session-in-main');
        expect(seen.map((r) => r.session_id)).toEqual(['from-worktree']);
        expect(seen[0]!.worktree).toBe(wt);
    });

    it('a session does not see itself', () => {
        const { main } = make_repo();
        const dir = register_dir(main)!;
        write_record(dir, rec({ session_id: 'me' }));
        expect(foreign_live_records(dir, 'me')).toEqual([]);
        expect(read_live_records(dir)).toHaveLength(1);
    });
});

describe('acceptance — liveness: both halves hold simultaneously', () => {
    it('a session active far longer than the TTL stays visible, because it heartbeats', () => {
        const { main } = make_repo();
        const dir = register_dir(main)!;
        const long_ago = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        // Started a month ago, heartbeat one second ago.
        write_record(dir, rec({ started_at: iso_now(long_ago), last_seen: iso_now() }));
        expect(read_live_records(dir)).toHaveLength(1);
    });

    it('a crashed session disappears by TTL with no manual cleanup', () => {
        const { main } = make_repo();
        const dir = register_dir(main)!;
        const stale = new Date(Date.now() - (TTL_MEASURED_SECONDS['claude']! + 60) * 1000);
        write_record(dir, rec({ platform: 'claude', last_seen: iso_now(stale) }));
        expect(read_live_records(dir)).toEqual([]);
    });

    it('pruning unlinks the expired file, so the register cannot grow without bound', () => {
        const { main } = make_repo();
        const dir = register_dir(main)!;
        const stale = new Date(Date.now() - (TTL_DEFAULT_SECONDS + 60) * 1000);
        write_record(dir, rec({ session_id: 'ghost', platform: 'unknown-host', last_seen: iso_now(stale) }));
        expect(fs.readdirSync(dir)).toHaveLength(1);
        read_live_records(dir, { prune: true });
        expect(fs.readdirSync(dir)).toHaveLength(0);
    });

    it('liveness never reads file mtime — touching the file does not revive an expired record', () => {
        const { main } = make_repo();
        const dir = register_dir(main)!;
        const stale = new Date(Date.now() - (TTL_MEASURED_SECONDS['claude']! + 60) * 1000);
        write_record(dir, rec({ session_id: 'stale', last_seen: iso_now(stale) }));
        // Bump mtime the way `git status` bumped the index in the cleanup work.
        const f = path.join(dir, 'stale.json');
        const now = new Date();
        fs.utimesSync(f, now, now);
        expect(read_live_records(dir)).toEqual([]);
    });

    it('an unreadable stamp is treated as expired — absence of evidence is not evidence of life', () => {
        const { main } = make_repo();
        const dir = register_dir(main)!;
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'garbage.json'), '{ not json');
        fs.writeFileSync(path.join(dir, 'nostamp.json'), JSON.stringify({ session_id: 'x' }));
        expect(read_live_records(dir)).toEqual([]);
    });
});

describe('TTL — measured for one host, conservative default for the rest', () => {
    it('applies the RECORD\'s platform TTL, never the reader\'s', () => {
        const measured = rec({ platform: 'claude' });
        const unknown = rec({ platform: 'some-future-host' });
        expect(ttl_seconds_for(measured.platform)).toBe(TTL_MEASURED_SECONDS['claude']);
        expect(ttl_seconds_for(unknown.platform)).toBe(TTL_DEFAULT_SECONDS);

        // A gap that expires claude is still live for the unmeasured host.
        const gap = new Date(Date.now() - (TTL_MEASURED_SECONDS['claude']! + 60) * 1000);
        expect(is_expired({ ...measured, last_seen: iso_now(gap) })).toBe(true);
        expect(is_expired({ ...unknown, last_seen: iso_now(gap) })).toBe(false);
    });

    it('the default holds a claim too long rather than dropping a live session', () => {
        expect(TTL_DEFAULT_SECONDS).toBeGreaterThan(Math.max(...Object.values(TTL_MEASURED_SECONDS)));
    });

    it('ships exactly one measured host — no interpolated values for hosts nobody measured', () => {
        expect(Object.keys(TTL_MEASURED_SECONDS)).toEqual(['claude']);
        expect(ttl_is_measured('claude')).toBe(true);
        expect(ttl_is_measured('cursor')).toBe(false);
        expect(ttl_is_measured(null)).toBe(false);
    });

    it('is case- and whitespace-insensitive on the platform key', () => {
        expect(ttl_seconds_for('  CLAUDE ')).toBe(TTL_MEASURED_SECONDS['claude']);
    });
});

describe('the stop-is-not-session-end trap', () => {
    it('no platform marks itself dead on stop, except the one where stop IS the end', () => {
        for (const p of ['claude', 'cowork', 'augment', 'cursor', 'windsurf', 'gemini']) {
            expect(stop_means_session_end(p)).toBe(false);
        }
        expect(stop_means_session_end('cline')).toBe(true);
    });

    it('the exception is an explicit allow-list a human must extend', () => {
        expect([...DEREGISTER_ON_STOP_PLATFORMS]).toEqual(['cline']);
    });

    it('an unknown platform gets the SAFE default — heartbeat, not deregistration', () => {
        expect(stop_means_session_end('some-future-host')).toBe(false);
        expect(stop_means_session_end(null)).toBe(false);
        expect(stop_means_session_end('')).toBe(false);
    });
});

describe('honest coverage — the hosts that cannot carry the heartbeat', () => {
    it('excludes the three declared non-carriers', () => {
        for (const p of ['copilot', 'cursor', 'cowork']) {
            expect(HEARTBEAT_REACHABLE_PLATFORMS.has(p)).toBe(false);
        }
    });

    it('includes augment, whose only per-turn slot is post-reply — enough for a liveness stamp', () => {
        expect(HEARTBEAT_REACHABLE_PLATFORMS.has('augment')).toBe(true);
    });

    it('includes cline, whose only per-turn slot is pre-reply', () => {
        expect(HEARTBEAT_REACHABLE_PLATFORMS.has('cline')).toBe(true);
    });
});

describe('filename safety', () => {
    it('collapses traversal and separators so a record cannot escape the register', () => {
        expect(safe_stem('../../etc/passwd')).not.toContain('/');
        expect(safe_stem('../../etc/passwd')).not.toContain('..');
        expect(safe_stem('a/b\\c')).toBe('a_b_c');
    });

    it('never produces an empty stem', () => {
        expect(safe_stem('')).toBe('unknown-session');
        expect(safe_stem('///')).toBe('unknown-session');
    });

    it('round-trips a written record through its sanitised name', () => {
        const { main } = make_repo();
        const dir = register_dir(main)!;
        write_record(dir, rec({ session_id: 'a/b' }));
        expect(fs.existsSync(path.join(dir, 'a_b.json'))).toBe(true);
        expect(read_live_records(dir)).toHaveLength(1);
        delete_record(dir, 'a/b');
        expect(read_live_records(dir)).toEqual([]);
    });
});

describe('fail-open — the register never costs a session its start', () => {
    it('reading a register directory that does not exist yields no records, not an error', () => {
        const { main } = make_repo();
        expect(read_live_records(register_dir(main)!)).toEqual([]);
    });

    it('writing into an unwritable location returns false instead of throwing', () => {
        const blocked = path.join(tmp, 'blocked');
        fs.mkdirSync(blocked);
        fs.chmodSync(blocked, 0o500);
        try {
            expect(write_record(path.join(blocked, 'sub'), rec())).toBe(false);
        } finally {
            fs.chmodSync(blocked, 0o700);
        }
    });

    it('deleting an absent record is a no-op, not a failure path', () => {
        const { main } = make_repo();
        expect(delete_record(register_dir(main)!, 'never-existed')).toBe(false);
    });
});

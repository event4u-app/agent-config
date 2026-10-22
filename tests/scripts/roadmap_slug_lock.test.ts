import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    acquire_lock,
    holder_is_live,
    read_locks,
    release_locks,
    UNRECORDED_HOLDER_MS,
    type HolderView,
    type SlugLock,
} from '../../src/scripts/_lib/roadmap_slug_lock.js';
import { readClaims } from '../../src/scripts/roadmap_drain_queue.js';

const NOW = new Date('2026-10-20T12:00:00Z');
const NONE: HolderView = { live: new Set(), known: new Set() };

function lock(over: Partial<SlugLock> = {}): SlugLock {
    return {
        slug: 'road-to-a',
        session_id: 's1',
        lane: false,
        worktree: '/wt/one',
        branch: 'drain/a',
        written_at: NOW.toISOString(),
        ...over,
    };
}

let root = '';
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'slug-lock-'));
    execFileSync('git', ['init', '-q', root]);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('acquire_lock', () => {
    it('refuses a second session while the first is live', () => {
        const live: HolderView = { live: new Set(['s1']), known: new Set(['s1']) };
        expect(acquire_lock(root, lock(), live, { now: NOW }).ok).toBe(true);
        const second = acquire_lock(root, lock({ session_id: 's2', worktree: '/wt/two' }), live, { now: NOW });
        expect(second.ok).toBe(false);
        if (!second.ok) expect(second.holder.worktree).toBe('/wt/one');
    });

    it('lets the same session re-take its own lock', () => {
        const live: HolderView = { live: new Set(['s1']), known: new Set(['s1']) };
        acquire_lock(root, lock(), live, { now: NOW });
        expect(acquire_lock(root, lock({ worktree: '/wt/moved' }), live, { now: NOW }).ok).toBe(true);
        expect(read_locks(root)[0]?.worktree).toBe('/wt/moved');
    });

    it('takes over from a dead holder and names where its work sits', () => {
        acquire_lock(root, lock(), NONE, { now: NOW });
        const dead: HolderView = { live: new Set(), known: new Set(['s1']) };
        const got = acquire_lock(root, lock({ session_id: 's2', worktree: '/wt/two' }), dead, { now: NOW });
        expect(got.ok).toBe(true);
        if (got.ok) expect(got.took_over?.worktree).toBe('/wt/one');
    });

    it('keeps one lock per slug, so one session can hold one per lane', () => {
        acquire_lock(root, lock({ lane: true }), NONE, { now: NOW });
        acquire_lock(root, lock({ slug: 'road-to-b', lane: true, worktree: '/wt/b' }), NONE, { now: NOW });
        expect(read_locks(root).map((l) => l.slug)).toEqual(['road-to-a', 'road-to-b']);
    });
});

describe('holder_is_live', () => {
    it('trusts the register over the lock age, both ways', () => {
        const old = lock({ written_at: new Date(NOW.getTime() - 2 * UNRECORDED_HOLDER_MS).toISOString() });
        expect(holder_is_live(old, { live: new Set(['s1']), known: new Set(['s1']) }, NOW)).toBe(true);
        expect(holder_is_live(lock(), { live: new Set(), known: new Set(['s1']) }, NOW)).toBe(false);
    });

    it('holds an unregistered holder for the bounded window only', () => {
        expect(holder_is_live(lock(), NONE, NOW)).toBe(true);
        const later = new Date(NOW.getTime() + UNRECORDED_HOLDER_MS + 1);
        expect(holder_is_live(lock(), NONE, later)).toBe(false);
    });
});

describe('release_locks', () => {
    it('releases one slug or all of a session, never a peer', () => {
        acquire_lock(root, lock(), NONE, { now: NOW });
        acquire_lock(root, lock({ slug: 'road-to-b' }), NONE, { now: NOW });
        acquire_lock(root, lock({ slug: 'road-to-c', session_id: 'peer' }), NONE, { now: NOW });
        expect(release_locks(root, 's1', 'road-to-b')).toEqual(['road-to-b']);
        expect(release_locks(root, 's1')).toEqual(['road-to-a']);
        expect(read_locks(root).map((l) => l.slug)).toEqual(['road-to-c']);
    });
});

describe('readClaims — a lock is visible the moment it is written', () => {
    it('reports a fresh lock as a live claim before any register record exists', () => {
        // `acquire_lock` stores the lock verbatim and `readClaims` reads the
        // wall clock, so a frozen `written_at` would age past
        // `UNRECORDED_HOLDER_MS` and turn this case into a time bomb.
        // Stamping it with the wall clock keeps this case off the calendar.
        const now = new Date();
        acquire_lock(root, lock({ lane: true, written_at: now.toISOString() }), NONE, { now });
        const claims = readClaims(root);
        expect(claims.live).toEqual([
            { session_id: 's1', roadmap_slug: 'road-to-a', lane: true, worktree: '/wt/one', branch: 'drain/a' },
        ]);
    });
});

describe('sessions:claim — two sessions in two worktrees, one roadmap, one turn', () => {
    const CLI = path.resolve(__dirname, '../../src/scripts/sessions_cli.ts');
    const TSX = path.resolve(__dirname, '../../node_modules/.bin/tsx');

    function claim(cwd: string, sid: string, ...args: string[]): { status: number | null; err: string } {
        const env: NodeJS.ProcessEnv = { ...process.env, AGENT_CONFIG_SESSION_ID: sid };
        delete env['CLAUDE_CODE_SESSION_ID'];
        const r = spawnSync(TSX, [CLI, 'claim', ...args], { cwd, env, encoding: 'utf-8' });
        return { status: r.status, err: r.stderr };
    }

    it('refuses the second session before any heartbeat ran, and lets a lane hold a second roadmap', () => {
        for (const c of [['config', 'user.email', 't@example.com'], ['config', 'user.name', 't']]) {
            execFileSync('git', ['-C', root, ...c]);
        }
        fs.mkdirSync(path.join(root, 'agents/roadmaps'), { recursive: true });
        for (const slug of ['road-to-one', 'road-to-two']) {
            fs.writeFileSync(path.join(root, 'agents/roadmaps', `${slug}.md`), '# x\n');
        }
        execFileSync('git', ['-C', root, 'add', '-A']);
        execFileSync('git', ['-C', root, 'commit', '-q', '-m', 'init']);
        const wt = path.join(root, '..', `${path.basename(root)}-peer`);
        execFileSync('git', ['-C', root, 'worktree', 'add', '-q', wt, '-b', 'peer']);
        try {
            expect(claim(root, 'first', 'road-to-one').status).toBe(0);
            const second = claim(wt, 'second', 'road-to-one');
            expect(second.status).toBe(1);
            expect(second.err).toMatch(/REFUSED/);
            expect(claim(root, 'first', 'road-to-two', '--lane', '--worktree', wt).status).toBe(0);
            expect(read_locks(root).map((l) => [l.slug, l.session_id, l.lane])).toEqual([
                ['road-to-one', 'first', false],
                ['road-to-two', 'first', true],
            ]);
        } finally {
            fs.rmSync(wt, { recursive: true, force: true });
        }
    }, 60_000);
});

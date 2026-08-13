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

import { execFileSync, type spawnSync } from 'node:child_process';
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
    classify_collisions,
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
import {
    ROADMAP_CLAIM_REL,
    claim_is_stale,
    foreign_sessions_block,
    read_claimed_slug,
    roadmap_claim_rel,
} from '../../src/scripts/session_register_hook.js';
import {
    branch_name_hits,
    claim_conflicts,
    other_worktree_branches,
    other_worktree_branches_detailed,
} from '../../src/scripts/sessions_cli.js';

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

// ---------------------------------------------------------------------------
// The duplicate-work collision — four defects, each with the case that was
// silent before it. Measured twice on this repo (PR #1277/#1280, #1280/#1281):
// two sessions built the same roadmap phase under two branch names.
// ---------------------------------------------------------------------------

describe('classify_collisions — the roadmap axis that was missing', () => {
    it('reports the SAME roadmap under DIFFERENT branch names — the measured case', () => {
        // This is the whole incident in one assertion. Before this axis existed,
        // the comparison was `r.branch === here` and these two records produced
        // NO warning at all.
        const others = [
            rec({
                session_id: 'peer',
                branch: 'feat/dispatch-safety-confirmation',
                roadmap_slug: 'road-to-inbox-harvest-2026-08-b-dispatch-safety',
            }),
        ];
        const hits = classify_collisions(others, {
            branch: 'feat/dispatch-safety-confirmed-execution',
            roadmap_slug: 'road-to-inbox-harvest-2026-08-b-dispatch-safety',
        });
        expect(hits.map((h) => h.kind)).toEqual(['roadmap']);
        expect(hits[0]!.record.session_id).toBe('peer');
    });

    it('orders roadmap BEFORE branch — the expensive collision leads', () => {
        const others = [rec({ session_id: 'peer', branch: 'feat/a', roadmap_slug: 'road-to-x' })];
        const hits = classify_collisions(others, { branch: 'feat/a', roadmap_slug: 'road-to-x' });
        expect(hits.map((h) => h.kind)).toEqual(['roadmap', 'branch']);
    });

    it('keeps the branch axis working on its own', () => {
        const others = [rec({ session_id: 'peer', branch: 'feat/a', roadmap_slug: 'road-to-y' })];
        const hits = classify_collisions(others, { branch: 'feat/a', roadmap_slug: 'road-to-x' });
        expect(hits.map((h) => h.kind)).toEqual(['branch']);
    });

    it('a null slug never collides — otherwise every pair of fresh sessions fires', () => {
        const others = [rec({ session_id: 'peer', branch: 'feat/b', roadmap_slug: null })];
        expect(classify_collisions(others, { branch: 'feat/a', roadmap_slug: null })).toEqual([]);
        expect(classify_collisions(others, { branch: 'feat/a', roadmap_slug: 'road-to-x' })).toEqual(
            [],
        );
    });

    it('different roadmaps on different branches are not a collision', () => {
        const others = [rec({ session_id: 'peer', branch: 'feat/b', roadmap_slug: 'road-to-y' })];
        expect(classify_collisions(others, { branch: 'feat/a', roadmap_slug: 'road-to-x' })).toEqual(
            [],
        );
    });

    it('reports every peer on the same roadmap, not just the first', () => {
        const others = [
            rec({ session_id: 'p1', branch: 'feat/b', roadmap_slug: 'road-to-x' }),
            rec({ session_id: 'p2', branch: 'feat/c', roadmap_slug: 'road-to-x' }),
        ];
        const hits = classify_collisions(others, { branch: 'feat/a', roadmap_slug: 'road-to-x' });
        expect(hits.map((h) => h.record.session_id)).toEqual(['p1', 'p2']);
    });
});

describe('the claim is per SESSION, not per worktree', () => {
    function claim(root: string, body: Record<string, unknown>, file: string): void {
        const p = path.join(root, file);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(body));
    }

    it('an IDENTIFIED session never reads the shared legacy claim — the measured defect', () => {
        // Four live records once carried one identical slug because every session
        // in a checkout read the last claim written there. A session reporting a
        // roadmap it is not working is worse than reporting none: the screen reads
        // it as "taken".
        //
        // The rule is not "compare the ids" — that was R2 finding 6: `cmd_claim`
        // serialises `session_id: null` on the legacy path and the reader drops a
        // null, so the comparison never ran. A session that CAN identify itself
        // never writes that file, so whatever is in it is not its claim.
        const { main } = make_repo();
        claim(main, { slug: 'road-to-peer', session_id: 'peer-session' }, ROADMAP_CLAIM_REL);
        expect(read_claimed_slug(main, 'my-session')).toBeNull();
        // Not even the id that wrote it: it belongs to that session's per-session
        // file now, and reading it here would re-open the inheritance path.
        expect(read_claimed_slug(main, 'peer-session')).toBeNull();
    });

    it('only an UNIDENTIFIED session reads the shared file — the shape it must share', () => {
        const { main } = make_repo();
        claim(main, { slug: 'road-to-shared' }, ROADMAP_CLAIM_REL);
        expect(read_claimed_slug(main, null)).toBe('road-to-shared');
        expect(read_claimed_slug(main, '')).toBe('road-to-shared');
    });

    it('the per-session file wins over the legacy one', () => {
        const { main } = make_repo();
        claim(main, { slug: 'legacy-slug' }, ROADMAP_CLAIM_REL);
        claim(main, { slug: 'mine' }, roadmap_claim_rel('my-session'));
        expect(read_claimed_slug(main, 'my-session')).toBe('mine');
    });

    it('the pre-upgrade claim is DROPPED for an identified session — the price, stated', () => {
        // Migration and non-inheritance are the same read and only one can win: a
        // legacy file is either a peer's (host with no id) or pre-upgrade, and a
        // reader cannot tell. Inheriting a peer's claim is the measured defect;
        // losing a pre-upgrade claim costs one re-run of `sessions:claim`. So this
        // asserts the loss deliberately rather than papering over it.
        const { main } = make_repo();
        claim(main, { slug: 'pre-existing' }, ROADMAP_CLAIM_REL);
        expect(read_claimed_slug(main, 'my-session')).toBeNull();
        expect(read_claimed_slug(main, null)).toBe('pre-existing');
    });

    it('an unidentifiable session falls back to the legacy path rather than losing the claim', () => {
        expect(roadmap_claim_rel(null)).toBe(ROADMAP_CLAIM_REL);
        expect(roadmap_claim_rel('')).toBe(ROADMAP_CLAIM_REL);
        expect(roadmap_claim_rel('   ')).toBe(ROADMAP_CLAIM_REL);
    });

    it('a hostile session id cannot escape the state directory', () => {
        expect(roadmap_claim_rel('../../etc/passwd')).not.toContain('..');
    });

    it('an absent or malformed claim reads as no claim, never as a throw', () => {
        const { main } = make_repo();
        expect(read_claimed_slug(main, 'x')).toBeNull();
        claim(main, {} as Record<string, unknown>, ROADMAP_CLAIM_REL);
        expect(read_claimed_slug(main, 'x')).toBeNull();
        fs.writeFileSync(path.join(main, ROADMAP_CLAIM_REL), '{ not json');
        expect(read_claimed_slug(main, 'x')).toBeNull();
    });
});

describe('a stale slug is not a claim', () => {
    it('a slug naming an ARCHIVED roadmap reads as stale', () => {
        const { main } = make_repo();
        fs.mkdirSync(path.join(main, 'agents', 'roadmaps', 'archive'), { recursive: true });
        fs.writeFileSync(path.join(main, 'agents', 'roadmaps', 'archive', 'road-to-done.md'), '#');
        expect(claim_is_stale(main, 'road-to-done')).toBe(true);
    });

    it('a slug naming an OPEN roadmap is live', () => {
        const { main } = make_repo();
        fs.mkdirSync(path.join(main, 'agents', 'roadmaps'), { recursive: true });
        fs.writeFileSync(path.join(main, 'agents', 'roadmaps', 'road-to-open.md'), '#');
        expect(claim_is_stale(main, 'road-to-open')).toBe(false);
        expect(claim_is_stale(main, 'road-to-open.md')).toBe(false);
    });

    it('null is not stale — absence is a state, not a defect', () => {
        const { main } = make_repo();
        expect(claim_is_stale(main, null)).toBe(false);
        expect(claim_is_stale(main, '')).toBe(false);
    });

    it('a traversal-shaped slug is stale rather than rendered as live work', () => {
        const { main } = make_repo();
        expect(claim_is_stale(main, '../../../etc/passwd')).toBe(true);
    });
});

describe('sessions:claim refuses a slug a peer already holds', () => {
    /**
     * The regression this whole group exists for. The register's context block is
     * emitted on `session_start` only, and there this session's own slug is null
     * by construction — so a roadmap-collision warning in that renderer can never
     * fire on the session doing the picking. The check has to sit on the claim.
     */
    function open_roadmap(root: string, slug: string): void {
        fs.mkdirSync(path.join(root, 'agents', 'roadmaps'), { recursive: true });
        fs.writeFileSync(path.join(root, 'agents', 'roadmaps', `${slug}.md`), '# x');
    }

    it('finds a live peer record on the same slug', () => {
        const { main } = make_repo();
        open_roadmap(main, 'road-to-x');
        write_record(
            register_dir(main)!,
            rec({ session_id: 'peer', branch: 'feat/other-name', roadmap_slug: 'road-to-x' }),
        );
        const hits = claim_conflicts(main, 'road-to-x');
        expect(hits.map((h) => h.kind)).toContain('session');
    });

    it('ignores a peer whose slug is STALE — an archived roadmap blocks nothing', () => {
        const { main } = make_repo();
        // No open roadmap file → the peer's claim names nothing live.
        write_record(register_dir(main)!, rec({ session_id: 'peer', roadmap_slug: 'road-to-gone' }));
        expect(claim_conflicts(main, 'road-to-gone')).toEqual([]);
    });

    it('finds a peer BRANCH by the slug tail — the peer that never claimed', () => {
        const { main, wt } = make_repo();
        open_roadmap(main, 'road-to-inbox-harvest-2026-08-b-dispatch-safety');
        // Exactly the measured branch name. Matching the whole slug would find
        // nothing, which is why the tail is what is compared.
        git(main, 'branch', 'feat/dispatch-safety-confirmation');
        git(wt, 'checkout', '-q', 'feat/dispatch-safety-confirmation');
        fs.writeFileSync(path.join(wt, 'w.txt'), 'x');
        git(wt, 'add', 'w.txt');
        git(wt, 'commit', '-q', '-m', 'peer work');
        const hits = claim_conflicts(main, 'road-to-inbox-harvest-2026-08-b-dispatch-safety');
        expect(hits.map((h) => h.kind)).toContain('branch');
    });

    it('is silent on an unrelated slug', () => {
        const { main } = make_repo();
        open_roadmap(main, 'road-to-x');
        write_record(register_dir(main)!, rec({ session_id: 'peer', roadmap_slug: 'road-to-y' }));
        expect(claim_conflicts(main, 'road-to-x')).toEqual([]);
    });

    it('is silent when nothing else is live', () => {
        const { main } = make_repo();
        open_roadmap(main, 'road-to-x');
        expect(claim_conflicts(main, 'road-to-x')).toEqual([]);
    });

    it('does not report the caller own record as a conflict', () => {
        const { main } = make_repo();
        open_roadmap(main, 'road-to-x');
        const prev = process.env['AGENT_CONFIG_SESSION_ID'];
        process.env['AGENT_CONFIG_SESSION_ID'] = 'me';
        try {
            write_record(register_dir(main)!, rec({ session_id: 'me', roadmap_slug: 'road-to-x' }));
            expect(claim_conflicts(main, 'road-to-x')).toEqual([]);
        } finally {
            if (prev === undefined) delete process.env['AGENT_CONFIG_SESSION_ID'];
            else process.env['AGENT_CONFIG_SESSION_ID'] = prev;
        }
    });

    it('a two-character tail is not matched — it would hit every branch', () => {
        const { main, wt } = make_repo();
        open_roadmap(main, 'road-to-a-b');
        fs.writeFileSync(path.join(wt, 'w.txt'), 'x');
        git(wt, 'add', 'w.txt');
        git(wt, 'commit', '-q', '-m', 'w');
        expect(claim_conflicts(main, 'road-to-a-b').filter((h) => h.kind === 'branch')).toEqual([]);
    });
});

describe('R2 fixes — each finding gets the case it named', () => {
    function open_roadmap(root: string, slug: string): void {
        fs.mkdirSync(path.join(root, 'agents', 'roadmaps'), { recursive: true });
        fs.writeFileSync(path.join(root, 'agents', 'roadmaps', `${slug}.md`), '# x');
    }

    it('R2-1: a peer claim is live when the PEER tree holds the roadmap, not ours', () => {
        // The high finding. Worktrees share one register on different commits, so
        // resolving the roadmap only in the caller's tree read a live peer claim as
        // stale — and stale is treated as no claim, which disabled the refusal in
        // exactly the multi-worktree case this exists for.
        const { main, wt } = make_repo();
        open_roadmap(wt, 'road-to-only-in-peer');
        expect(claim_is_stale(main, 'road-to-only-in-peer')).toBe(true); // our tree alone
        expect(claim_is_stale(main, 'road-to-only-in-peer', wt)).toBe(false); // peer's tree
    });

    it('R2-1: absent in BOTH trees is still stale', () => {
        const { main, wt } = make_repo();
        expect(claim_is_stale(main, 'road-to-nowhere', wt)).toBe(true);
    });

    it('R2-2: an unidentified session excludes its OWN record by worktree', () => {
        const { main } = make_repo();
        open_roadmap(main, 'road-to-x');
        const prev = process.env['CLAUDE_CODE_SESSION_ID'];
        const prev2 = process.env['AGENT_CONFIG_SESSION_ID'];
        delete process.env['CLAUDE_CODE_SESSION_ID'];
        delete process.env['AGENT_CONFIG_SESSION_ID'];
        try {
            write_record(
                register_dir(main)!,
                rec({ session_id: 'whoever', worktree: main, roadmap_slug: 'road-to-x' }),
            );
            // Without the worktree fallback this exited 1 citing the session itself,
            // so re-claiming was non-idempotent on the graceful-degradation path.
            expect(claim_conflicts(main, 'road-to-x')).toEqual([]);
        } finally {
            if (prev === undefined) delete process.env['CLAUDE_CODE_SESSION_ID'];
            else process.env['CLAUDE_CODE_SESSION_ID'] = prev;
            if (prev2 === undefined) delete process.env['AGENT_CONFIG_SESSION_ID'];
            else process.env['AGENT_CONFIG_SESSION_ID'] = prev2;
        }
    });

    it('R2-4: a date-suffixed slug does not match every branch', () => {
        const { main, wt } = make_repo();
        fs.writeFileSync(path.join(wt, 'w.txt'), 'x');
        git(wt, 'add', 'w.txt');
        git(wt, 'commit', '-q', '-m', 'w');
        // tail `2026-08` cleared the old `length >= 4` guard and matched anything
        // carrying that string.
        expect(branch_name_hits(main, 'road-to-inbox-harvest-2026-08')).toEqual([]);
    });

    it('R2-4: the real slug tail still matches', () => {
        const { main, wt } = make_repo();
        git(main, 'branch', 'feat/dispatch-safety-confirmation');
        git(wt, 'checkout', '-q', 'feat/dispatch-safety-confirmation');
        fs.writeFileSync(path.join(wt, 'w.txt'), 'x');
        git(wt, 'add', 'w.txt');
        git(wt, 'commit', '-q', '-m', 'w');
        expect(
            branch_name_hits(main, 'road-to-inbox-harvest-2026-08-b-dispatch-safety').map(
                (h) => h.branch,
            ),
        ).toContain('feat/dispatch-safety-confirmation');
    });

    it('R2-12: the walk reports whether the unmerged filter was applied', () => {
        const { main } = make_repo();
        // No `origin/main` in the fixture, so the filter is unavailable and the
        // human output must say so instead of claiming "N unmerged branch(es)".
        expect(other_worktree_branches_detailed(main).filtered).toBe(false);
    });

    it('PR-review: a legacy file with NO session_id is not credited to a session', () => {
        // The reviewer asked for exactly this assertion, and named why: the claim
        // path had no coverage at all before this branch, which is how the original
        // scoping bug shipped. A pre-change `cmd_claim` never wrote a session_id, so
        // this is the shape of every file that caused the incident.
        const { main } = make_repo();
        fs.mkdirSync(path.join(main, 'agents', 'runtime', 'state'), { recursive: true });
        fs.writeFileSync(
            path.join(main, ROADMAP_CLAIM_REL),
            JSON.stringify({ slug: 'road-to-inbox-harvest-2026-08-b-dispatch-safety' }),
        );
        expect(read_claimed_slug(main, 'some-session')).toBeNull();
    });

    it('gate-high: a hostile session id cannot leave the state directory', () => {
        for (const hostile of ['../../etc/passwd', '/etc/passwd', '..', 'a/../../b']) {
            const rel = roadmap_claim_rel(hostile);
            expect(rel.includes('..'), hostile).toBe(false);
            expect(
                rel === ROADMAP_CLAIM_REL ||
                    rel.startsWith(path.join('agents', 'runtime', 'state') + path.sep),
                hostile,
            ).toBe(true);
        }
    });

    it('gate-high: a slug that would escape the roadmaps directory reads as stale', () => {
        const { main } = make_repo();
        for (const hostile of ['../../etc/passwd', '/etc/passwd', 'a/../../../b']) {
            expect(claim_is_stale(main, hostile), hostile).toBe(true);
        }
    });

    it('gate-medium: the branch tail matches on token boundaries, not substrings', () => {
        const { main, wt } = make_repo();
        // The gate named this false positive: `dispatch-safety` is a substring of
        // `redispatch-safety-valve`, a different task.
        git(main, 'branch', 'feat/redispatch-safety-valve');
        git(wt, 'checkout', '-q', 'feat/redispatch-safety-valve');
        fs.writeFileSync(path.join(wt, 'w.txt'), 'x');
        git(wt, 'add', 'w.txt');
        git(wt, 'commit', '-q', '-m', 'w');
        expect(branch_name_hits(main, 'road-to-x-dispatch-safety')).toEqual([]);
    });

    it('R2-14: every roadmap peer is classified, and the renderer has them all', () => {
        const others = [
            rec({ session_id: 'p1', branch: 'feat/b', roadmap_slug: 'road-to-x' }),
            rec({ session_id: 'p2', branch: 'feat/c', roadmap_slug: 'road-to-x' }),
        ];
        const hits = classify_collisions(others, { branch: 'feat/a', roadmap_slug: 'road-to-x' });
        expect(hits.filter((h) => h.kind === 'roadmap')).toHaveLength(2);
    });
});

describe('the branch axis — what the register cannot see', () => {
    it('lists an unmerged branch checked out in ANOTHER worktree', () => {
        const { main, wt } = make_repo();
        // `feat/a` needs a commit of its own, or `--no-merged origin/main` would
        // correctly exclude it. That is the documented limit, asserted below.
        fs.writeFileSync(path.join(wt, 'work.txt'), 'x');
        git(wt, 'add', 'work.txt');
        git(wt, 'commit', '-q', '-m', 'work');
        // No `origin/main` in a bare fixture, so the filter is unavailable and the
        // function reports every foreign worktree — the fail-open branch.
        const rows = other_worktree_branches(main);
        expect(rows.map((r) => r.branch)).toContain('feat/a');
        // Compared by realpath: git reports the path it registered, and on macOS
        // `mkdtemp` hands back /var/... while git resolves /private/var/... — the
        // same divergence the production function guards its own self-check with.
        expect(rows.map((r) => fs.realpathSync(r.worktree))).toContain(fs.realpathSync(wt));
    });

    it('never reports the caller own worktree', () => {
        const { main, wt } = make_repo();
        expect(other_worktree_branches(wt).map((r) => r.branch)).not.toContain('feat/a');
        expect(other_worktree_branches(main).map((r) => r.branch)).not.toContain('main');
    });

    it('degrades to an empty list when git is unavailable, never throwing', () => {
        const { main } = make_repo();
        const fail = (() => ({ status: 1, stdout: '', stderr: 'boom' })) as unknown as typeof spawnSync;
        expect(other_worktree_branches(main, fail)).toEqual([]);
        const thrower = (() => {
            throw new Error('no git');
        }) as unknown as typeof spawnSync;
        expect(other_worktree_branches(main, thrower)).toEqual([]);
    });
});

/**
 * The context block is emitted for a COLLISION, never for mere co-existence.
 *
 * Measured cause: a live peer that collided with nothing still produced a
 * paragraph about other sessions in every parallel session's context, and a
 * model handed that paragraph mentions it unprompted and treats it as a reason
 * to hold work back — although this hook has never blocked anything.
 */
describe('foreign_sessions_block — collision-gated, and never a git gate', () => {
    it('is SILENT when a live peer collides with nothing', () => {
        const { main, wt } = make_repo();
        const dir = register_dir(main)!;
        // Peer sits on `feat/a` in the linked worktree; `main` is on `main` and
        // neither side claims a roadmap. Live, visible, and irrelevant.
        write_record(dir, rec({ session_id: 'peer', worktree: wt, branch: 'feat/a' }));
        expect(foreign_live_records(dir, 'me')).toHaveLength(1);

        expect(foreign_sessions_block(main, 'me')).toBeNull();
    });

    it('fires on a branch collision and carries the never-gates-git clause', () => {
        const { main, wt } = make_repo();
        const dir = register_dir(main)!;
        write_record(dir, rec({ session_id: 'peer', worktree: wt, branch: 'main' }));

        const block = foreign_sessions_block(main, 'me');
        expect(block).toContain('COLLISION');
        expect(block).toContain('branch `main`');
        // The clause that closes the gap the model was falling into.
        expect(block).toContain('are ALWAYS executed');
        expect(block).toContain('never gates a git operation');
        // ...and it must not read as a licence to ignore the roadmap STOP.
        expect(block).toContain('never about shipping work that is already done');
    });

    it('scopes the branch question to the whole session, not to every turn', () => {
        const { main, wt } = make_repo();
        const dir = register_dir(main)!;
        write_record(dir, rec({ session_id: 'peer', worktree: wt, branch: 'main' }));

        const block = foreign_sessions_block(main, 'me')!;
        expect(block).toContain('ONCE PER SESSION');
        expect(block).toContain('Do not re-raise it on later turns');
    });

    it('says nothing at all when there is no peer', () => {
        const { main } = make_repo();
        expect(foreign_sessions_block(main, 'me')).toBeNull();
    });
});

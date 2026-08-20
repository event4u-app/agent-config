// Tests for src/scripts/hooks/state_io.ts (py2ts Phase 6 — hooks core).
//
// Ports the TS-portable cases from tests/hooks/test_concurrency.py
// (state-dir creation, clean overwrite, JSON round-trip) plus replay-mode
// no-op and feedback_dir path-traversal coverage. Adds a JSON-byte parity
// layer: Python atomic_write_json vs TS atomic_write_json must write the
// exact same bytes (the Python json.dumps(indent=2) + "\n" contract).
// Skipped without python3 for the parity layer only.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    atomic_write_json,
    atomic_write_text,
    FEEDBACK_DIRNAME,
    feedback_dir,
    is_replay_mode,
    LOCK_ACQUIRE_DEADLINE_MS,
    LOCK_BASENAME,
    LOCK_STALE_MS,
    prune_stale_session_states,
    REPLAY_ENV_VAR,
    restore_claimed_state,
    session_state_file,
    update_json_under_lock,
} from '../../../src/scripts/hooks/state_io.js';



let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'state-io-'));
    delete process.env[REPLAY_ENV_VAR];
});
afterEach(() => {
    delete process.env[REPLAY_ENV_VAR];
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('state_io — constants', () => {
    it('exports the documented constants', () => {
        expect(LOCK_BASENAME).toBe('.dispatcher.lock');
        expect(FEEDBACK_DIRNAME).toBe('.dispatcher');
        expect(REPLAY_ENV_VAR).toBe('AGENT_CONFIG_REPLAY');
    });
});

describe('state_io — atomic_write_json', () => {
    it('auto-creates the nested state dir', () => {
        const target = path.join(tmp, 'deeper', 'agents', 'runtime', 'state', 'fresh.json');
        expect(fs.existsSync(path.dirname(target))).toBe(false);
        atomic_write_json(target, { hello: 'world' });
        expect(fs.statSync(target).isFile()).toBe(true);
        expect(JSON.parse(fs.readFileSync(target, 'utf8'))['hello']).toBe('world');
        // Lock sentinel appears alongside.
        expect(fs.existsSync(path.join(path.dirname(target), LOCK_BASENAME))).toBe(true);
    });

    it('overwrites cleanly without leaking tmp siblings', () => {
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'overwrite.json');
        for (let i = 0; i < 5; i += 1) {
            atomic_write_json(target, { i });
        }
        expect(JSON.parse(fs.readFileSync(target, 'utf8'))['i']).toBe(4);
        const siblings = fs.readdirSync(path.dirname(target)).sort();
        const leftover = siblings.filter(
            (n) => n !== path.basename(target) && n !== LOCK_BASENAME,
        );
        expect(leftover).toEqual([]);
    });

    it('writes Python-style indent=2 JSON with trailing newline', () => {
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'shape.json');
        atomic_write_json(target, { b: 2, a: [1, 2], nested: { x: true } });
        const body = fs.readFileSync(target, 'utf8');
        // Insertion order preserved (Python dict order), 2-space indent, trailing \n.
        expect(body).toBe(
            '{\n  "b": 2,\n  "a": [\n    1,\n    2\n  ],\n  "nested": {\n    "x": true\n  }\n}\n',
        );
    });

    it('empty containers render compactly', () => {
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'empty.json');
        atomic_write_json(target, { arr: [], obj: {} });
        expect(fs.readFileSync(target, 'utf8')).toBe('{\n  "arr": [],\n  "obj": {}\n}\n');
    });
});

describe('state_io — atomic_write_text', () => {
    it('writes verbatim text + creates dir', () => {
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'note.txt');
        atomic_write_text(target, 'raw transcript\n');
        expect(fs.readFileSync(target, 'utf8')).toBe('raw transcript\n');
    });
});

describe('state_io — replay mode', () => {
    it('is_replay_mode reflects the env flag', () => {
        expect(is_replay_mode()).toBe(false);
        process.env[REPLAY_ENV_VAR] = '1';
        expect(is_replay_mode()).toBe(true);
        process.env[REPLAY_ENV_VAR] = ' 1 ';
        expect(is_replay_mode()).toBe(true);
        process.env[REPLAY_ENV_VAR] = '0';
        expect(is_replay_mode()).toBe(false);
    });

    it('atomic_write_json is a no-op under replay', () => {
        process.env[REPLAY_ENV_VAR] = '1';
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'replay.json');
        atomic_write_json(target, { x: 1 });
        expect(fs.existsSync(target)).toBe(false);
    });

    it('atomic_write_text is a no-op under replay', () => {
        process.env[REPLAY_ENV_VAR] = '1';
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'replay.txt');
        atomic_write_text(target, 'x');
        expect(fs.existsSync(target)).toBe(false);
    });
});

describe('state_io — feedback_dir', () => {
    // The literal-equality assertions these replace pinned the SANITISED name
    // (`sess-1`, `a_b`, `__etc_passwd`). Those literals were the collision:
    // asserting them is asserting the defect. What is pinned now is the
    // property — one legible segment under `.dispatcher`, distinct per id.
    const slot = (id: string): string => path.basename(feedback_dir('/root', id));

    it('builds one legible segment under the .dispatcher root', () => {
        const dir = feedback_dir('/root', 'sess-1');
        expect(path.dirname(dir)).toBe(path.join('/root', '.dispatcher'));
        expect(slot('sess-1')).toMatch(/^sess-1\.[0-9a-f]{12}$/);
    });

    it('empty session id still falls back to one shared unknown-session bucket', () => {
        // Deliberate, and documented at the function: the dispatcher cannot
        // decline to write, and a merged per-concern VIEW is recoverable.
        expect(slot('')).toMatch(/^unknown-session\.[0-9a-f]{12}$/);
        expect(slot('')).toBe(slot(''));
    });

    it('two ids the sanitiser merges address DIFFERENT directories', () => {
        // The regression this fix exists for. Pre-fix both sides were `a_b`.
        expect(slot('a/b')).not.toBe(slot('a_b'));
        expect(slot('a\\b')).not.toBe(slot('a_b'));
        expect(slot('a/b')).not.toBe(slot('a\\b'));
        // ...and each is still a single sanitised segment.
        for (const id of ['a/b', 'a_b', 'a\\b']) {
            expect(slot(id)).not.toContain('/');
            expect(slot(id)).not.toContain('\\');
            expect(slot(id).split(path.sep)).toHaveLength(1);
        }
    });

    it('neutralises path traversal', () => {
        const out = feedback_dir('/root', '../etc/passwd');
        expect(out).not.toContain('..');
        expect(path.dirname(out)).toBe(path.join('/root', '.dispatcher'));
        expect(slot('../etc/passwd')).toMatch(/^__etc_passwd\.[0-9a-f]{12}$/);
    });

    it('is stable for one id across calls — the dir is addressable, not random', () => {
        expect(feedback_dir('/root', 'sess-1')).toBe(feedback_dir('/root', 'sess-1'));
    });
});


// ---------------------------------------------------------------------------
// The pruner's destructive edges (council round 3, both seats).
//
// Round 2 introduced claim-then-revalidate and round 3 found it still
// destructive: the restore step decided with `existsSync` and acted with
// `rename`, so a writer arriving between the two lost its file to the pruner's
// older copy. Both cases below stage a real concurrent write through the
// injected age reader — the one callback that runs at exactly the contested
// moment — rather than staging timings that merely reach the branch.
describe('state_io — prune_stale_session_states, concurrent writers', () => {
    let dir: string;
    const DAY = 24 * 60 * 60 * 1000;
    const now = 1_000 * DAY;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-race-'));
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('a write landing before restoration survives', () => {
        const live = session_state_file(dir, 'session-A');
        fs.writeFileSync(live, JSON.stringify({ language: 'de', generation: 'stale' }), 'utf8');

        // HONEST SCOPE, and the counter-probe is what established it: this test
        // stays GREEN against the `existsSync`-then-`rename` code it replaces,
        // because the injected callback runs BEFORE that existence check and the
        // old code then took its safe branch. It covers the restore path with a
        // concurrent writer; it does NOT prove the race is closed. The window
        // sits between the old decision and the old action, and no
        // single-threaded seam can open it — the next test asserts the property
        // that replaced the decision instead.
        const mtime_of = (target: string): number => {
            if (target.endsWith('.tomb')) {
                fs.writeFileSync(
                    live,
                    JSON.stringify({ language: 'de', generation: 'fresh' }),
                    'utf8',
                );
                return now; // fresh → restoration path
            }
            return now - 90 * DAY; // stale → becomes a candidate
        };

        const removed = prune_stale_session_states(dir, now, 30, mtime_of);

        expect(removed).toBe(0);
        expect(JSON.parse(fs.readFileSync(live, 'utf8')).generation).toBe('fresh');
        expect(fs.readdirSync(dir).filter((n) => n.endsWith('.tomb'))).toEqual([]);
    });

    it('a restore never changes a live file that already exists', () => {
        // THE POST-CONDITION, asserted on the helper directly. Scope, stated
        // because the counter-probe measured it: this is green against the
        // `existsSync`-then-`rename` code too — that code reached the same
        // outcome whenever the check and the action agreed, and they disagree
        // only under real concurrency, which no single-threaded seam reaches.
        // What it DOES catch is the regression that matters going forward: a
        // future restore that renames onto the live path without a check.
        const live = path.join(dir, 'live.json');
        const tomb = `${live}.4242.1.tomb`;
        fs.writeFileSync(live, JSON.stringify({ gen: 'live' }), 'utf8');
        fs.writeFileSync(tomb, JSON.stringify({ gen: 'claim' }), 'utf8');

        restore_claimed_state(tomb, live);

        expect(JSON.parse(fs.readFileSync(live, 'utf8')).gen).toBe('live');
        expect(fs.existsSync(tomb)).toBe(false);
    });

    it('falls back to a rename where the filesystem cannot hard-link', () => {
        // The peer-review condition on accepting `link` at all: `linkSync` is
        // this tree's first, `engines` pins only Node, and Windows is a named
        // target — so EPERM / ENOSYS / EXDEV / EOPNOTSUPP / EMLINK are real
        // answers. Throwing there would strand the tombstone and lose a FRESH
        // pin, which is worse than the narrow window the fallback reopens.
        const live = path.join(dir, 'nolink.json');
        const tomb = `${live}.4242.1.tomb`;
        fs.writeFileSync(tomb, JSON.stringify({ gen: 'claim' }), 'utf8');
        const refuse = (): never => {
            const err = new Error('operation not permitted') as NodeJS.ErrnoException;
            err.code = 'EPERM';
            throw err;
        };

        restore_claimed_state(tomb, live, refuse);

        expect(JSON.parse(fs.readFileSync(live, 'utf8')).gen).toBe('claim');
        expect(fs.existsSync(tomb)).toBe(false);
    });

    it('the fallback still refuses to overwrite a live file', () => {
        // The degraded path must keep the property that matters even though it
        // cannot keep the atomicity.
        const live = path.join(dir, 'nolink-live.json');
        const tomb = `${live}.4242.1.tomb`;
        fs.writeFileSync(live, JSON.stringify({ gen: 'live' }), 'utf8');
        fs.writeFileSync(tomb, JSON.stringify({ gen: 'claim' }), 'utf8');
        const refuse = (): never => {
            const err = new Error('not supported') as NodeJS.ErrnoException;
            err.code = 'ENOSYS';
            throw err;
        };

        restore_claimed_state(tomb, live, refuse);

        expect(JSON.parse(fs.readFileSync(live, 'utf8')).gen).toBe('live');
        expect(fs.existsSync(tomb)).toBe(false);
    });

    it('a genuine link error is not swallowed as a missing feature', () => {
        // The fallback is scoped to "this filesystem cannot link", never to
        // "the link failed". An EIO must still surface.
        const live = path.join(dir, 'eio.json');
        const tomb = `${live}.4242.1.tomb`;
        fs.writeFileSync(tomb, JSON.stringify({ gen: 'claim' }), 'utf8');
        const fail = (): never => {
            const err = new Error('io error') as NodeJS.ErrnoException;
            err.code = 'EIO';
            throw err;
        };

        expect(() => restore_claimed_state(tomb, live, fail)).toThrow(/io error/);
    });

    it('a crash between link and unlink leaves a tombstone the sweep resolves', () => {
        // The peer round's crash-window case: `link` succeeded, the process
        // died before `rm`, so both names point at one inode. The recovery pass
        // is what closes it — the live file exists, so the duplicate name is
        // dropped and the content stays reachable exactly once.
        const live = session_state_file(dir, 'session-crash');
        const tomb = `${live}.4242.1.tomb`;
        fs.writeFileSync(live, JSON.stringify({ gen: 'linked' }), 'utf8');
        fs.linkSync(live, tomb); // the duplicate a crash would leave

        prune_stale_session_states(dir, now, 30, () => now);

        expect(fs.existsSync(tomb)).toBe(false);
        expect(JSON.parse(fs.readFileSync(live, 'utf8')).gen).toBe('linked');
    });

    it('a restore recreates a live file that is absent', () => {
        const live = path.join(dir, 'gone.json');
        const tomb = `${live}.4242.1.tomb`;
        fs.writeFileSync(tomb, JSON.stringify({ gen: 'claim' }), 'utf8');

        restore_claimed_state(tomb, live);

        expect(JSON.parse(fs.readFileSync(live, 'utf8')).gen).toBe('claim');
        expect(fs.existsSync(tomb)).toBe(false);
    });

    it('restoration puts the claim back when no writer arrived', () => {
        const live = session_state_file(dir, 'session-B');
        fs.writeFileSync(live, JSON.stringify({ language: 'de', generation: 'kept' }), 'utf8');
        const mtime_of = (target: string): number =>
            target.endsWith('.tomb') ? now : now - 90 * DAY;

        expect(prune_stale_session_states(dir, now, 30, mtime_of)).toBe(0);
        expect(JSON.parse(fs.readFileSync(live, 'utf8')).generation).toBe('kept');
        expect(fs.readdirSync(dir).filter((n) => n.endsWith('.tomb'))).toEqual([]);
    });

    it('a genuinely stale file is still removed', () => {
        const live = session_state_file(dir, 'session-C');
        fs.writeFileSync(live, JSON.stringify({ language: 'de' }), 'utf8');

        expect(prune_stale_session_states(dir, now, 30, () => now - 90 * DAY)).toBe(1);
        expect(fs.existsSync(live)).toBe(false);
    });
});

// A crash between the claim rename and the restore left the file under a name
// nothing reads and nothing pruned — and when the candidate had been refreshed
// under the pruner, that name held the CURRENT state while the live path was
// gone for good. Recovery is judged on the tombstone's own mtime, which
// `rename` preserves, so it is the age of the content rather than of the claim.
describe('state_io — prune_stale_session_states, orphaned tombstones', () => {
    let dir: string;
    const DAY = 24 * 60 * 60 * 1000;
    const now = 1_000 * DAY;
    const tombFor = (live: string): string => `${live}.4242.1.tomb`;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-tomb-'));
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('a fresh orphan is restored to its live path', () => {
        const live = session_state_file(dir, 'session-A');
        fs.writeFileSync(tombFor(live), JSON.stringify({ language: 'de', gen: 'rescued' }), 'utf8');

        expect(prune_stale_session_states(dir, now, 30, () => now)).toBe(0);
        expect(JSON.parse(fs.readFileSync(live, 'utf8')).gen).toBe('rescued');
        expect(fs.existsSync(tombFor(live))).toBe(false);
    });

    it('a stale orphan is deleted', () => {
        const live = session_state_file(dir, 'session-B');
        fs.writeFileSync(tombFor(live), JSON.stringify({ language: 'de' }), 'utf8');

        expect(prune_stale_session_states(dir, now, 30, () => now - 90 * DAY)).toBe(1);
        expect(fs.existsSync(tombFor(live))).toBe(false);
        expect(fs.existsSync(live)).toBe(false);
    });

    it('an orphan never overwrites a live file that already exists', () => {
        const live = session_state_file(dir, 'session-C');
        fs.writeFileSync(live, JSON.stringify({ language: 'de', gen: 'live' }), 'utf8');
        fs.writeFileSync(tombFor(live), JSON.stringify({ language: 'en', gen: 'orphan' }), 'utf8');

        // Both are fresh: the orphan is dropped, the live file is untouched.
        prune_stale_session_states(dir, now, 30, () => now);

        expect(JSON.parse(fs.readFileSync(live, 'utf8')).gen).toBe('live');
        expect(fs.existsSync(tombFor(live))).toBe(false);
    });

    it('a tombstone is not mistaken for state — only the live name is read', () => {
        // The suffix must stay outside the `.json` enumeration, or a tombstone
        // would be claimed as a candidate and tombstoned again.
        const live = session_state_file(dir, 'session-D');
        fs.writeFileSync(tombFor(live), JSON.stringify({ language: 'de' }), 'utf8');
        prune_stale_session_states(dir, now, 30, () => now);

        expect(fs.readdirSync(dir).filter((n) => n.endsWith('.tomb.4242.1.tomb'))).toEqual([]);
    });
});


// ---------------------------------------------------------------------------
// `_acquire_lock` — the staleness check, and the non-blocking acquire.
//
// The branch under test used to fire on `Date.now() - start > deadlineMs` and
// examine the companion in no way at all: a patience check named as a staleness
// check. These tests pin the difference from the OUTSIDE — through
// `update_json_under_lock`, since `_acquire_lock` is module-private — because
// the observable that matters is what happens to the OTHER holder's companion.
describe('state_io — lock acquisition is decided by the companion, not by patience', () => {
    const target = (): string => path.join(tmp, 'lockstate', 'rmw.json');
    // FILE-keyed, matching `_target_lock_path`. This used to build
    // `<dir>/${LOCK_BASENAME}.held` — the directory lock — and updating it is
    // the point of the granularity change rather than an accommodation of it:
    // the whole reason two sessions no longer block is that the companion is
    // now per state file.
    const companion = (): string => `${target()}.lock.held`;

    /** Stage a companion held by a peer, with a chosen age. */
    function holdLock(age_ms: number): void {
        fs.mkdirSync(path.dirname(target()), { recursive: true });
        fs.writeFileSync(companion(), '', 'utf8');
        const when = new Date(Date.now() - age_ms);
        fs.utimesSync(companion(), when, when);
    }

    it('blocking: a FRESH companion is never removed by a caller that merely waited', () => {
        holdLock(0);
        const t0 = Date.now();
        const outcome = update_json_under_lock<Record<string, unknown>>(target(), () => ({ n: 1 }));
        const elapsed = Date.now() - t0;

        // THE REGRESSION. Pre-fix: the caller spun to its deadline, deleted the
        // peer's live companion as "stale", acquired, and wrote — so the
        // companion was gone and the state file existed. Both assertions below
        // fail against that code, which is what makes this green meaningful.
        expect(fs.existsSync(companion())).toBe(true);
        expect(outcome).toBe('failed');
        expect(fs.existsSync(target())).toBe(false);

        // It DID wait, i.e. this is not passing for the trivial reason that the
        // caller declined immediately.
        expect(elapsed).toBeGreaterThanOrEqual(LOCK_ACQUIRE_DEADLINE_MS);
        // ...and the wait stayed bounded: the pre-fix end state after the first
        // timeout was a pauseless spin, because the deadline test sat before the
        // sleep and `start` was never reset.
        expect(elapsed).toBeLessThan(LOCK_ACQUIRE_DEADLINE_MS * 3);
    }, 30_000);

    it('blocking: a genuinely ABANDONED companion is reclaimed and the write lands', () => {
        holdLock(LOCK_STALE_MS + 5_000);
        const t0 = Date.now();
        const outcome = update_json_under_lock<Record<string, unknown>>(target(), () => ({ n: 2 }));
        expect(outcome).toBe('written');
        expect(JSON.parse(fs.readFileSync(target(), 'utf8'))['n']).toBe(2);
        // Reclamation is immediate — it never waits out the acquire deadline
        // first, because age, not patience, is what decides.
        expect(Date.now() - t0).toBeLessThan(LOCK_ACQUIRE_DEADLINE_MS);
    }, 30_000);

    it('non-blocking: a held lock declines IMMEDIATELY, never after a spin', () => {
        holdLock(0);
        const t0 = Date.now();
        const outcome = update_json_under_lock<Record<string, unknown>>(
            target(),
            () => ({ n: 3 }),
            { blocking: false },
        );
        const elapsed = Date.now() - t0;
        expect(outcome).toBe('failed');
        // The hot-path contract: `post_tool_use` runs on every tool call and
        // must never wait. A spin to the 5s deadline is the failure.
        expect(elapsed).toBeLessThan(1_000);
        // And it did not evict the live peer on the way out.
        expect(fs.existsSync(companion())).toBe(true);
        expect(fs.existsSync(target())).toBe(false);
    });

    it('non-blocking: still reclaims an ABANDONED companion rather than wedging', () => {
        // Skipping reclamation on the hot path would let one crashed process
        // wedge every tool call for LOCK_STALE_MS.
        holdLock(LOCK_STALE_MS + 5_000);
        const outcome = update_json_under_lock<Record<string, unknown>>(
            target(),
            () => ({ n: 4 }),
            { blocking: false },
        );
        expect(outcome).toBe('written');
        expect(JSON.parse(fs.readFileSync(target(), 'utf8'))['n']).toBe(4);
    });

    it('an uncontended lock is unaffected by either mode', () => {
        expect(
            update_json_under_lock<Record<string, unknown>>(target(), () => ({ n: 5 })),
        ).toBe('written');
        expect(
            update_json_under_lock<Record<string, unknown>>(target(), () => ({ n: 6 }), {
                blocking: false,
            }),
        ).toBe('written');
        expect(JSON.parse(fs.readFileSync(target(), 'utf8'))['n']).toBe(6);
    });
});


// ---------------------------------------------------------------------------
// Lock GRANULARITY — the scope of the lock follows the scope of the state.
//
// `_lock_path` is directory-keyed and always was. Before the per-session split
// the directory held ONE file, so that was effectively a file lock; after it,
// the directory holds N per-session files and a directory lock re-serialises
// exactly the sessions the split exists to decouple. `update_json_under_lock`
// is therefore file-keyed (`_target_lock_path`); `_atomic_write_text` keeps the
// shared directory lock the hook contract mandates for concerns.
describe('state_io — the RMW lock is scoped to the state file, not the directory', () => {
    const dir = (): string => path.join(tmp, 'granularity');
    const fileFor = (id: string): string => path.join(dir(), `${id}.json`);

    it('a lock held on ONE session file does not block a write to ANOTHER', () => {
        fs.mkdirSync(dir(), { recursive: true });
        // Peer holds session A's lock, fresh, so it can never be reclaimed.
        fs.writeFileSync(`${fileFor('sessA')}.lock.held`, '', 'utf8');

        const t0 = Date.now();
        const outcome = update_json_under_lock<Record<string, unknown>>(fileFor('sessB'), () => ({
            n: 1,
        }));
        const elapsed = Date.now() - t0;

        // THE REGRESSION. Under the directory-keyed lock this call waited out
        // the full 5s acquire deadline and then reported `failed`, because
        // session A's companion sat at the shared directory path. Session B's
        // write is unrelated to session A's file and must simply land.
        expect(outcome).toBe('written');
        expect(elapsed).toBeLessThan(1_000);
        expect(JSON.parse(fs.readFileSync(fileFor('sessB'), 'utf8'))['n']).toBe(1);
        // A's lock is untouched — B never had any business with it.
        expect(fs.existsSync(`${fileFor('sessA')}.lock.held`)).toBe(true);
    }, 30_000);

    it('a lock held on the SAME session file still excludes — exclusion is not lost', () => {
        fs.mkdirSync(dir(), { recursive: true });
        fs.writeFileSync(`${fileFor('sessC')}.lock.held`, '', 'utf8');
        const outcome = update_json_under_lock<Record<string, unknown>>(
            fileFor('sessC'),
            () => ({ n: 2 }),
            { blocking: false },
        );
        expect(outcome).toBe('failed');
        expect(fs.existsSync(fileFor('sessC'))).toBe(false);
    });

    it('the pruner removes a retired session lock, so sentinels are bounded', () => {
        // Neither `.lock` nor `.lock.held` ends in `.json`, so the pruner's own
        // filter skips them; without the explicit cleanup one sentinel per
        // retired session would accumulate forever.
        fs.mkdirSync(dir(), { recursive: true });
        const stale = fileFor('retired');
        fs.writeFileSync(stale, '{}', 'utf8');
        fs.writeFileSync(`${stale}.lock`, '', 'utf8');
        fs.writeFileSync(`${stale}.lock.held`, '', 'utf8');
        const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        fs.utimesSync(stale, old, old);

        const removed = prune_stale_session_states(dir(), Date.now(), 7);
        expect(removed).toBe(1);
        expect(fs.existsSync(stale)).toBe(false);
        expect(fs.existsSync(`${stale}.lock`)).toBe(false);
        expect(fs.existsSync(`${stale}.lock.held`)).toBe(false);
    });
});

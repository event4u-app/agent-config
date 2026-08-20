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
    LOCK_BASENAME,
    prune_stale_session_states,
    REPLAY_ENV_VAR,
    restore_claimed_state,
    session_state_file,
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
    it('builds the per-session slot', () => {
        expect(feedback_dir('/root', 'sess-1')).toBe(path.join('/root', '.dispatcher', 'sess-1'));
    });
    it('empty session id falls back to unknown-session', () => {
        expect(feedback_dir('/root', '')).toBe(path.join('/root', '.dispatcher', 'unknown-session'));
    });
    it('neutralises path traversal', () => {
        const out = feedback_dir('/root', '../etc/passwd');
        expect(out).not.toContain('..');
        expect(out).toBe(path.join('/root', '.dispatcher', '__etc_passwd'));
    });
    it('neutralises backslashes', () => {
        expect(feedback_dir('/root', 'a\\b')).toBe(path.join('/root', '.dispatcher', 'a_b'));
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

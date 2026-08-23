/**
 * Per-session state for `verify-before-complete`, and the shared helpers it
 * keys on.
 *
 * WHY THIS FILE EXISTS. The producer kept ONE state file per project root, and
 * in this repo's worktree workflow that root is the PARENT checkout — so every
 * concurrent session shared it. The in-file session-boundary reset made the
 * failure hard to see from inside one session: written for SEQUENTIAL sessions
 * it looks like a defense, but under CONCURRENT ones it IS the damage, because
 * each run sees the other's id, resets the session-scoped counters, and writes.
 * Two runs then erase each other's verification evidence in a loop.
 *
 * The tests below pin the two halves that matter: two live sessions keep
 * separate state, and the pruner cannot delete a file that was resumed while it
 * was looking at it.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    run,
    STATE_DIR,
    STATE_FILE,
    STATE_RETENTION_DAYS,
    statePathFor,
} from '../../src/scripts/before_complete_hook.js';
import {
    has_stable_session_id,
    owns_session_state,
    prune_legacy_state_file,
    prune_stale_session_states,
    session_state_file,
    update_json_under_lock,
} from '../../src/scripts/hooks/state_io.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

let tmp: string;

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vbc-isolation-')));
});

afterEach(() => {
    try {
        fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
        /* best effort */
    }
});

/** One verification observed by `session_id`. */
function verify(session_id: string, command = 'npm run test'): void {
    run(
        JSON.stringify({
            event: 'post_tool_use',
            session_id,
            payload: {
                tool_name: 'Bash',
                tool_input: { command },
                tool_response: 'Tests  12 passed (12)\n',
            },
        }),
        { consumer_root: tmp },
    );
}

function readState(session_id: string): Record<string, unknown> {
    return JSON.parse(
        fs.readFileSync(path.join(tmp, statePathFor(session_id)), 'utf8'),
    ) as Record<string, unknown>;
}

describe('two concurrent sessions keep separate state', () => {
    it('neither session erases the other’s verification evidence', () => {
        verify('session-A');
        verify('session-B');
        // Interleaved, which is what a worktree pair actually does.
        verify('session-A');

        expect(readState('session-A')['verifications_this_session']).toBe(2);
        expect(readState('session-B')['verifications_this_session']).toBe(1);
    });

    it('each file records its own owner', () => {
        verify('session-A');
        verify('session-B');
        expect(readState('session-A')['session_id']).toBe('session-A');
        expect(readState('session-B')['session_id']).toBe('session-B');
    });

    it('ids that a character sanitiser would merge address different files', () => {
        // `a/b` → `a_b` under the sanitiser shape the council rejected as
        // BLOCKER 1 on the sibling hook: two ids, one file, and a substantive
        // write from either destroys the other's state.
        expect(statePathFor('a/b')).not.toBe(statePathFor('a_b'));
    });

    it('an id-less envelope persists NOTHING rather than sharing a bucket', () => {
        verify('');
        // Not "an empty state file" — no file at all. A shared literal like
        // `unknown-session` is the original defect restored in the one case
        // with no guard left.
        expect(fs.existsSync(path.join(tmp, STATE_DIR))).toBe(false);
    });
});

/**
 * The in-file session-boundary reset, which SURVIVES the split.
 *
 * After the split a foreign id can no longer arrive by sharing a file, so the
 * two boundary tests in `hooks/before_complete_hook.test.ts` now hold by
 * construction and no longer exercise the reset at all. It is still in the
 * code — it covers a stale or hand-copied file, and removing a defense while
 * adding one is not a trade this change needs to make — so it needs a case that
 * actually reaches it: plant a file at THIS session's path carrying somebody
 * else's id.
 */
describe('a stale file carrying a foreign id is reset, not inherited', () => {
    it('clears the session-scoped counters and the CI witness', () => {
        const target = path.join(tmp, statePathFor('s1'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
            target,
            JSON.stringify({
                schema_version: 1,
                session_id: 'somebody-else',
                verifications_this_session: 7,
                ci_last: { at: '2026-08-12T00:00:00+00:00', pending: 0, settled: true },
            }),
        );

        run(JSON.stringify({ event: 'user_prompt_submit', session_id: 's1', payload: {} }), {
            consumer_root: tmp,
        });

        const s = readState('s1');
        expect(s['session_id']).toBe('s1');
        expect(s['verifications_this_session']).toBe(0);
        // A `settled: true` inherited from elsewhere would vouch for a CI run
        // this session never made — the sharpest form of the shared-state bug.
        expect(s['ci_last']).toBe(null);
    });

    /**
     * The NEGATIVE control the reset never had, and the invariant that makes
     * B1.2 of `road-to-per-turn-hook-economy-carry` unreachable.
     *
     * That step describes a race: the reset writes `ci_last = null` while the
     * turn-end gate reads the same state, flipping it from "CI observed
     * unsettled" to "no CI observed, therefore allow". The audit of 2026-08-23
     * found the race not reachable at this commit for three independent
     * reasons, and the third is the only one nothing pinned: the reset fires
     * ONLY when the envelope's `session_id` differs from the persisted one, and
     * in a per-session file that cannot happen for the session that owns it.
     * (The other two: the publish is an atomic rename under a lock, so no torn
     * read exists; and `readCiSettled` refuses a foreign file via
     * `ownsSessionState`, already covered above.)
     *
     * Without this case the reset's test suite asserts only that it DOES clear,
     * so widening its condition — dropping the id comparison, or resetting on
     * every turn boundary — would make the race real again and stay green. That
     * is the regression this pins.
     *
     * Sabotage-proven 2026-08-23: making the reset unconditional takes this RED
     * while every other case in this file stays green.
     */
    it('does NOT clear the CI witness for the session that owns the file', () => {
        const target = path.join(tmp, statePathFor('s-own'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
            target,
            JSON.stringify({
                schema_version: 1,
                session_id: 's-own',
                verifications_this_session: 3,
                ci_last: { at: '2026-08-23T00:00:00+00:00', pending: 2, settled: false },
            }),
        );

        run(JSON.stringify({ event: 'user_prompt_submit', session_id: 's-own', payload: {} }), {
            consumer_root: tmp,
        });

        const s = readState('s-own');
        const ci = s['ci_last'] as { settled?: boolean } | null;
        // `settled: false` is the value whose loss is unsafe: nulling it reads
        // downstream as "no CI observed", which is the ALLOW direction.
        expect(ci).not.toBe(null);
        expect(ci?.settled).toBe(false);
    });
});

describe('housekeeping', () => {
    it('the pre-split single file is removed on a turn boundary, not read', () => {
        const legacy = path.join(tmp, STATE_FILE);
        fs.mkdirSync(path.dirname(legacy), { recursive: true });
        fs.writeFileSync(legacy, JSON.stringify({ verifications_this_session: 99 }));

        run(JSON.stringify({ event: 'user_prompt_submit', session_id: 's1', payload: {} }), {
            consumer_root: tmp,
        });

        expect(fs.existsSync(legacy)).toBe(false);
        // And its contents were never inherited — 99 would be a cross-session read.
        expect(readState('s1')['verifications_this_session']).toBe(0);
    });

    it('does NOT prune on post_tool_use — that fires many times per turn', () => {
        const stale = path.join(tmp, session_state_file(STATE_DIR, 'ancient'));
        fs.mkdirSync(path.dirname(stale), { recursive: true });
        fs.writeFileSync(stale, '{}');
        const old = Date.now() - (STATE_RETENTION_DAYS + 1) * 86400_000;
        fs.utimesSync(stale, old / 1000, old / 1000);

        verify('s1'); // a post_tool_use event

        expect(fs.existsSync(stale)).toBe(true);
    });

    it('prunes a stale session on a turn boundary', () => {
        const stale = path.join(tmp, session_state_file(STATE_DIR, 'ancient'));
        fs.mkdirSync(path.dirname(stale), { recursive: true });
        fs.writeFileSync(stale, '{}');
        const old = Date.now() - (STATE_RETENTION_DAYS + 1) * 86400_000;
        fs.utimesSync(stale, old / 1000, old / 1000);

        run(JSON.stringify({ event: 'user_prompt_submit', session_id: 's1', payload: {} }), {
            consumer_root: tmp,
        });

        expect(fs.existsSync(stale)).toBe(false);
        expect(fs.existsSync(path.join(tmp, statePathFor('s1')))).toBe(true);
    });
});

describe('prune_stale_session_states — the resume race', () => {
    const dir = (): string => path.join(tmp, STATE_DIR);

    function seed(name: string, body = '{}'): string {
        const full = path.join(dir(), `${name}.json`);
        fs.mkdirSync(dir(), { recursive: true });
        fs.writeFileSync(full, body);
        return full;
    }

    it('leaves a fresh file alone', () => {
        const fresh = seed('fresh');
        expect(prune_stale_session_states(dir(), Date.now(), 7)).toBe(0);
        expect(fs.existsSync(fresh)).toBe(true);
    });

    it('ignores non-json entries', () => {
        fs.mkdirSync(dir(), { recursive: true });
        const stray = path.join(dir(), 'notes.txt');
        fs.writeFileSync(stray, 'x');
        expect(prune_stale_session_states(dir(), Date.now(), 7, () => 0)).toBe(0);
        expect(fs.existsSync(stray)).toBe(true);
    });

    it('returns 0 for a directory that does not exist', () => {
        expect(prune_stale_session_states(path.join(tmp, 'nope'), Date.now(), 7)).toBe(0);
    });

    /**
     * THE RACE, and the reason `mtime_of` is injectable at all.
     *
     * `stat` then `rm` can delete a FRESH file: the pruner reads a stale mtime,
     * the owning session resumes and atomically replaces that pathname, and the
     * delete removes the NEW state. The claim-then-revalidate path only runs
     * when the candidate check and the post-claim check DISAGREE — a
     * disagreement no cutoff-only test can stage, so a test that cannot enter
     * the branch would pass against an implementation that does not have it.
     *
     * Staged here by answering stale for the live path and fresh for the
     * claimed tombstone.
     *
     * WHAT THIS DOES AND DOES NOT ESTABLISH, because the first version of this
     * comment said "exactly what a concurrent resume looks like" and a
     * cross-model review trimmed that back. No file is actually replaced during
     * this run: the injection reproduces the pruner's OBSERVATION (a
     * stale/fresh disagreement) and proves the revalidation branch restores the
     * claimed bytes rather than defaults. It does not stage a real writer. The
     * NEXT test does — it writes through the live path while the claim is held —
     * and is the sharper of the two.
     */
    it('restores the claimed file when the post-claim check disagrees', () => {
        const target = seed('resumed', '{"language":"de"}');
        const now = Date.now();
        let calls = 0;
        const removed = prune_stale_session_states(dir(), now, 7, (p) => {
            calls += 1;
            return p.endsWith('.tomb') ? now : now - 30 * 86400_000;
        });
        expect(calls).toBeGreaterThanOrEqual(2); // it really entered the branch
        expect(removed).toBe(0);
        expect(fs.existsSync(target)).toBe(true);
        expect(fs.readFileSync(target, 'utf8')).toBe('{"language":"de"}');
        expect(fs.readdirSync(dir()).filter((f) => f.endsWith('.tomb'))).toEqual([]);
    });

    it('drops the claim when the owner already wrote a newer file at the live path', () => {
        const target = seed('raced', '{"old":true}');
        const now = Date.now();
        const removed = prune_stale_session_states(dir(), now, 7, (p) => {
            if (p.endsWith('.tomb')) {
                // Simulate the owner landing a new file while we hold the claim.
                fs.writeFileSync(target, '{"new":true}');
                return now;
            }
            return now - 30 * 86400_000;
        });
        expect(removed).toBe(0);
        expect(fs.readFileSync(target, 'utf8')).toBe('{"new":true}');
        expect(fs.readdirSync(dir()).filter((f) => f.endsWith('.tomb'))).toEqual([]);
    });

    it('removes a genuinely stale file', () => {
        const target = seed('gone');
        const now = Date.now();
        const removed = prune_stale_session_states(dir(), now, 7, () => now - 30 * 86400_000);
        expect(removed).toBe(1);
        expect(fs.existsSync(target)).toBe(false);
    });
});

describe('update_json_under_lock — the whole transaction, not just the publish', () => {
    const target = (): string => path.join(tmp, 'state', 'rmw.json');

    it('creates the file when absent and hands the mutator an empty object', () => {
        let seen: unknown = 'not called';
        expect(
            update_json_under_lock<Record<string, unknown>>(target(), (loaded) => {
                seen = loaded;
                return { n: 1 };
            }),
        ).toBe('written');
        expect(seen).toEqual({});
        expect(JSON.parse(fs.readFileSync(target(), 'utf8'))['n']).toBe(1);
    });

    it('the mutator receives fresh on-disk state, not a caller snapshot', () => {
        update_json_under_lock<Record<string, unknown>>(target(), () => ({ n: 41 }));
        // A caller that captured a snapshot earlier would write 1 here. The
        // mutator gets what is on disk at lock time instead.
        //
        // This does NOT prove the read happens under the lock — there is no
        // concurrent writer to race, and the old name ("reads INSIDE the lock")
        // claimed more than the test can see. Exclusion is established by the
        // four-process test at the end of this block, which is the only one here
        // that fails when the lock is removed.
        update_json_under_lock<Record<string, unknown>>(target(), (loaded) => ({
            n: (loaded['n'] as number) + 1,
        }));
        expect(JSON.parse(fs.readFileSync(target(), 'utf8'))['n']).toBe(42);
    });

    it('a spread of the freshly loaded state carries fields forward', () => {
        update_json_under_lock<Record<string, unknown>>(target(), () => ({ a: 1, b: 'keep' }));
        update_json_under_lock<Record<string, unknown>>(target(), (loaded) => ({
            ...loaded,
            a: 2,
        }));
        const s = JSON.parse(fs.readFileSync(target(), 'utf8'));
        // The name first said "does not republish fields the mutator did not
        // look at", which a cross-model review called misleading and it was:
        // the mutator spreads `loaded` explicitly, so nothing here is implicit.
        // What IS load-bearing is WHICH object is spread — the one read inside
        // the lock. A caller spreading a snapshot taken at the start of a hook
        // run would revert `b` to its value at snapshot time, which is the
        // lost-FIELD shape and strictly worse than a lost increment.
        expect(s).toEqual({ a: 2, b: 'keep' });
    });

    it("a null return writes nothing and reports 'skipped', never 'written'", () => {
        update_json_under_lock<Record<string, unknown>>(target(), () => ({ n: 7 }));
        // The distinction this API change exists for. Under the old boolean this
        // was `true` — indistinguishable from a landed write, so a fail-closed
        // caller could not tell a decline from success and had to smuggle the
        // difference out of the mutator through a closure flag.
        expect(update_json_under_lock<Record<string, unknown>>(target(), () => null)).toBe(
            'skipped',
        );
        expect(JSON.parse(fs.readFileSync(target(), 'utf8'))['n']).toBe(7);
    });

    it('a fail-closed caller that treats a decline as no-emit emits nothing', () => {
        // The second half of the roadmap's verify: the API must let a caller
        // whose emit depends on a write having LANDED stay silent on a decline.
        // Under the old boolean it could not — a decline reported `true`, so the
        // fail-closed caller emitted on an outcome where nothing was persisted.
        const emitted: string[] = [];
        const emitOnlyIfPersisted = (mutate: () => Record<string, unknown> | null): void => {
            const outcome = update_json_under_lock<Record<string, unknown>>(target(), mutate);
            if (outcome !== 'written') return; // fail-closed: decline AND failure are silent
            emitted.push('reminder');
        };
        emitOnlyIfPersisted(() => ({ counter: 0 })); // landed
        emitOnlyIfPersisted(() => null); // declined
        emitOnlyIfPersisted(() => {
            throw new Error('boom'); // failed
        });
        expect(emitted).toEqual(['reminder']);
    });

    it("distinguishes 'skipped' from 'failed' — a decline is not an error", () => {
        // Both were `false`-vs-`true` collapsed onto the wrong side before: a
        // decline reported success and a failure reported failure, so the two
        // outcomes a fail-closed caller must separate sat on opposite sides of
        // the ONE bit available. Asserting them together is the point.
        const declined = update_json_under_lock<Record<string, unknown>>(target(), () => null);
        const failed = update_json_under_lock<Record<string, unknown>>(target(), () => {
            throw new Error('boom');
        });
        expect(declined).toBe('skipped');
        expect(failed).toBe('failed');
        expect(declined).not.toBe(failed);
    });

    it('a malformed file is an empty load, never an abandoned write', () => {
        fs.mkdirSync(path.dirname(target()), { recursive: true });
        fs.writeFileSync(target(), '{ not json');
        expect(
            update_json_under_lock<Record<string, unknown>>(target(), (loaded) => {
                expect(loaded).toEqual({});
                return { recovered: true };
            }),
        ).toBe('written');
        expect(JSON.parse(fs.readFileSync(target(), 'utf8'))['recovered']).toBe(true);
    });

    it('a throwing mutator reports failure and leaves the file untouched', () => {
        update_json_under_lock<Record<string, unknown>>(target(), () => ({ n: 3 }));
        expect(
            update_json_under_lock<Record<string, unknown>>(target(), () => {
                throw new Error('mutator blew up');
            }),
        ).toBe('failed');
        expect(JSON.parse(fs.readFileSync(target(), 'utf8'))['n']).toBe(3);
    });

    it('releases the lock — a second call is not blocked by the first', () => {
        // If `_release_lock` did not run, the O_EXCL companion would still be
        // there and this call would spin to the 5s deadline before reclaiming
        // it. A fast second call is the observable proof it was released.
        const t0 = Date.now();
        update_json_under_lock<Record<string, unknown>>(target(), () => ({ n: 1 }));
        update_json_under_lock<Record<string, unknown>>(target(), () => ({ n: 2 }));
        expect(Date.now() - t0).toBeLessThan(2000);
        expect(JSON.parse(fs.readFileSync(target(), 'utf8'))['n']).toBe(2);
    });

    it('a throwing mutator still releases the lock', () => {
        update_json_under_lock<Record<string, unknown>>(target(), () => {
            throw new Error('boom');
        });
        const t0 = Date.now();
        expect(update_json_under_lock<Record<string, unknown>>(target(), () => ({ n: 9 }))).toBe(
            'written',
        );
        expect(Date.now() - t0).toBeLessThan(2000);
    });

    /**
     * MUTUAL EXCLUSION, across real processes.
     *
     * Every other test in this block would pass with the locking removed
     * entirely — a cross-model review (2026-08-20) put that first among its
     * findings, and it is right: sequential calls establish the API and the
     * fresh-read behaviour, never exclusion. The elapsed-time assertions above
     * detect a LEAKED lock (one that spins to its deadline), not an absent one.
     *
     * The only observable that separates the two is a genuine interleaving, and
     * that needs more than one process: four workers each increment 25 times
     * through `update_json_under_lock`. With the lock, the total is exactly 100.
     * Without it, concurrent load→compute→publish sequences overwrite each other
     * and the total comes out short.
     *
     * Verified to FAIL against an unlocked implementation while this was
     * written — a concurrency test that has never been seen red is a test whose
     * sensitivity is unmeasured.
     */
    it('four concurrent processes lose no increments', async () => {
        const t = target();
        fs.mkdirSync(path.dirname(t), { recursive: true });
        const WORKERS = 4;
        const ITERATIONS = 25;
        const worker = path.join(
            fs.realpathSync(path.join(__dirname)),
            'fixtures',
            'rmw_increment_worker.mts',
        );
        const tsx = path.join(
            REPO_ROOT,
            'node_modules',
            '.bin',
            process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
        );

        const runs = Array.from({ length: WORKERS }, () =>
            new Promise<{ code: number | null; out: string; err: string }>((resolve) => {
                const child = spawn(tsx, [worker, t, String(ITERATIONS)], {
                    cwd: REPO_ROOT,
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
                let out = '';
                let err = '';
                child.stdout.on('data', (d: Buffer) => (out += d.toString()));
                child.stderr.on('data', (d: Buffer) => (err += d.toString()));
                child.on('close', (code) => resolve({ code, out, err }));
            }),
        );
        const results = await Promise.all(runs);

        for (const r of results) {
            expect(r.code, `worker failed: ${r.err}`).toBe(0);
            // A short total caused by failed WRITES is a different defect from a
            // short total caused by lost updates; separate them explicitly.
            expect(JSON.parse(r.out)['failed'], `worker reported failed writes: ${r.out}`).toBe(0);
        }

        const final = JSON.parse(fs.readFileSync(t, 'utf8'))['n'];
        expect(final).toBe(WORKERS * ITERATIONS);
    }, 60_000);
});

describe('the shared helpers', () => {
    it('has_stable_session_id refuses empty, whitespace, and non-strings', () => {
        expect(has_stable_session_id('s1')).toBe(true);
        expect(has_stable_session_id('')).toBe(false);
        expect(has_stable_session_id('   ')).toBe(false);
        expect(has_stable_session_id(undefined)).toBe(false);
        expect(has_stable_session_id(null)).toBe(false);
        expect(has_stable_session_id(42)).toBe(false);
    });

    it('session_state_file is stable, scoped to its dir, and hex-named', () => {
        expect(session_state_file('d', 'x')).toBe(session_state_file('d', 'x'));
        expect(session_state_file('d', 'x')).not.toBe(session_state_file('e', 'x'));
        expect(path.basename(session_state_file('d', 'x'))).toMatch(/^[0-9a-f]{32}\.json$/);
    });

    it('the digest is sha256 TRUNCATED to 32 chars — pinned, not inferred', () => {
        // A cross-model review asked the right question about the assertion
        // above: sha256 is 64 hex characters, so a 32-char match neither states
        // which hash is used nor that truncation is intentional. Both are
        // contractual — the filename length matters on every filesystem — so a
        // known vector pins them. If this fails, the derivation changed and
        // every existing session's state has silently moved.
        const expected = createHash('sha256')
            .update('known-vector', 'utf8')
            .digest('hex')
            .slice(0, 32);
        expect(path.basename(session_state_file('d', 'known-vector'))).toBe(`${expected}.json`);
        expect(expected).toHaveLength(32);
    });

    it('an unusually long id still yields a usable filename', () => {
        const basename = path.basename(session_state_file('d', 'q'.repeat(5000)));
        expect(basename).toMatch(/^[0-9a-f]{32}\.json$/);
    });

    it('owns_session_state requires an EXACT owner — absent is foreign', () => {
        expect(owns_session_state({ session_id: 's1' }, 's1')).toBe(true);
        expect(owns_session_state({ session_id: 'other' }, 's1')).toBe(false);
        // No compatibility window: the digest layout never shipped without an
        // owner, so an unowned file is corruption, not an older format.
        expect(owns_session_state({}, 's1')).toBe(false);
        expect(owns_session_state({ session_id: '' }, 's1')).toBe(false);
        // A non-object cannot own anything.
        expect(owns_session_state(null, 's1')).toBe(false);
        expect(owns_session_state([{ session_id: 's1' }], 's1')).toBe(false);
        expect(owns_session_state('s1', 's1')).toBe(false);
        // Empty-vs-empty DOES match, and this function is not where that is
        // stopped: `has_stable_session_id` refuses a blank id before any caller
        // reaches a path, so the pairing is unreachable rather than rejected
        // here. Pinned so a future reader does not "fix" it into a false and
        // then wonder which layer owns the blank-id rule.
        expect(owns_session_state({ session_id: '' }, '')).toBe(true);
    });

    it('prune_legacy_state_file is a no-op on an absent path and on a directory', () => {
        expect(() => prune_legacy_state_file(path.join(tmp, 'absent.json'))).not.toThrow();
        const asDir = path.join(tmp, 'a-directory');
        fs.mkdirSync(asDir);
        prune_legacy_state_file(asDir);
        expect(fs.existsSync(asDir)).toBe(true);
    });
});

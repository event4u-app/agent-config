/**
 * The target commit is often one the server has advanced past the local fetch,
 * so it is fetched before the carrier is read. That fetch gets more time than a
 * ref lookup, and a fetch that ran out of time is reported as such: the reading
 * is still `unresolvable`, but its reason no longer reads as a missing commit.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CARRIER_FETCH_TIMEOUT_MS,
    NETWORK_TIMEOUT_MS,
    carrierBlobAt,
    makeTargetDeps,
    readCommittedConvention,
    runGit,
    type GitRunner,
} from '../../src/scripts/_lib/git_convention_carrier.js';

import { TmpDirs, fixture, isolateUserGlobal } from './_git_convention_repo.js';

const tmp = new TmpDirs();
let restore: () => void;
beforeEach(() => {
    restore = isolateUserGlobal(tmp);
});
afterEach(() => {
    restore();
    tmp.cleanup();
});

const UNKNOWN_SHA = 'a'.repeat(40);

/** Real git, except that a fetch runs out of time; records every fetch's timeout. */
function timingOutFetch(seen: number[]): GitRunner {
    return (cmd, args, cwd, timeoutMs) => {
        if (args[0] === 'fetch') {
            seen.push(timeoutMs);
            return { ok: false, out: '', err: '', timedOut: true };
        }
        return runGit(cmd, args, cwd, timeoutMs);
    };
}

describe('the target-commit fetch', () => {
    it('is given its own timeout, longer than a ref lookup', () => {
        expect(CARRIER_FETCH_TIMEOUT_MS).toBeGreaterThan(NETWORK_TIMEOUT_MS);
        const f = fixture(tmp);
        const seen: number[] = [];
        const blob = carrierBlobAt(f.work, UNKNOWN_SHA, 'origin/main', timingOutFetch(seen));
        expect(seen).toEqual([CARRIER_FETCH_TIMEOUT_MS]);
        expect(blob).toEqual({ kind: 'no-commit', timedOut: true });
    });

    it('reports a timed-out fetch as a distinct reason in the unresolvable reading', () => {
        const f = fixture(tmp);
        const deps = { ...makeTargetDeps(f.work), prBase: () => null, remoteSha: () => UNKNOWN_SHA };
        const read = readCommittedConvention(f.work, {
            override: 'origin/main',
            keys: ['update_strategy'],
            deps,
            run: timingOutFetch([]),
        });
        expect(read.readings.update_strategy?.state).toBe('unresolvable');
        expect(read.readings.update_strategy?.detail).toContain('timed out');
    });
});

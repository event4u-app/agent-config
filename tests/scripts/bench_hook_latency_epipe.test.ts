/**
 * A dispatch that exits without draining stdin is a measurement, not a failure.
 *
 * The parent writes the synthetic payload into the child's stdin. A hook command
 * that has no reason to read it (a fast no-op path) can exit before the write
 * lands, and `spawnSync` then reports EPIPE although the child ran to completion
 * with an exit status. Main went red on exactly that race (session_start, cli
 * path) with no diff to explain it.
 */
import type { SpawnSyncReturns } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { dispatchFailure } from '../../src/scripts/bench_hook_latency.js';

function proc(error: (Error & { code?: string }) | undefined, status: number | null): SpawnSyncReturns<string> {
    const base = { pid: 1, output: [], stdout: '', stderr: '', status, signal: null };
    return error === undefined ? base : { ...base, error };
}

function errno(code: string): Error & { code: string } {
    return Object.assign(new Error(`spawnSync bash ${code}`), { code });
}

describe('dispatchFailure', () => {
    it('accepts a clean run', () => {
        expect(dispatchFailure(proc(undefined, 0))).toBeNull();
    });

    it('accepts EPIPE when the child exited on its own', () => {
        expect(dispatchFailure(proc(errno('EPIPE'), 0))).toBeNull();
        expect(dispatchFailure(proc(errno('EPIPE'), 2))).toBeNull();
    });

    it('rejects EPIPE when the child has no exit status', () => {
        expect(dispatchFailure(proc(errno('EPIPE'), null))).toMatch(/EPIPE/);
    });

    it('rejects every other spawn error', () => {
        expect(dispatchFailure(proc(errno('ENOENT'), null))).toMatch(/ENOENT/);
        expect(dispatchFailure(proc(errno('ETIMEDOUT'), null))).toMatch(/ETIMEDOUT/);
    });
});

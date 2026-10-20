import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    PROBE_INTERVAL_MS,
    pr_watch_block,
    read_store,
    record_pr,
    type PrProbe,
    type PrState,
} from '../../src/scripts/_lib/session_pr_watch.js';

const T0 = new Date('2026-10-20T12:00:00Z');
const later = (ms: number): Date => new Date(T0.getTime() + ms);
const URL = 'https://github.com/o/r/pull/2534';

let root = '';
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-watch-'));
    execFileSync('git', ['init', '-q', root]);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function probeOf(states: Record<number, PrState>, calls: number[][] = []): PrProbe {
    return (_cwd, numbers) => {
        calls.push([...numbers]);
        return Object.fromEntries(
            numbers.map((n) => [n, { state: states[n] ?? 'UNKNOWN', merged_at: states[n] === 'MERGED' ? '2026-10-20T12:33:44Z' : null }]),
        );
    };
}

describe('pr_watch_block', () => {
    it('is silent for a session that opened no PR', () => {
        expect(pr_watch_block(root, 's1', T0, probeOf({}))).toBeNull();
    });

    it('reports the recorded case: a PR merged after it was opened reads MERGED, not waiting', () => {
        record_pr(root, 's1', URL);
        expect(pr_watch_block(root, 's1', T0, probeOf({ 2534: 'OPEN' }))).toMatch(/#2534 OPEN/);
        const block = pr_watch_block(root, 's1', later(PROBE_INTERVAL_MS), probeOf({ 2534: 'MERGED' }));
        expect(block).toMatch(/#2534 MERGED at 2026-10-20T12:33:44Z {2}← CHANGED from OPEN/);
    });

    it('reports a merge once, then drops the PR', () => {
        record_pr(root, 's1', URL);
        pr_watch_block(root, 's1', T0, probeOf({ 2534: 'MERGED' }));
        expect(read_store(root, 's1').prs).toEqual([]);
        expect(pr_watch_block(root, 's1', later(PROBE_INTERVAL_MS), probeOf({}))).toBeNull();
    });

    it('probes at most once per interval and labels the reading with its time', () => {
        record_pr(root, 's1', URL);
        const calls: number[][] = [];
        pr_watch_block(root, 's1', T0, probeOf({ 2534: 'OPEN' }, calls));
        const cached = pr_watch_block(root, 's1', later(60_000), probeOf({ 2534: 'MERGED' }, calls));
        expect(calls).toHaveLength(1);
        expect(cached).toMatch(/read 12:00 UTC/);
        pr_watch_block(root, 's1', later(PROBE_INTERVAL_MS), probeOf({ 2534: 'OPEN' }, calls));
        expect(calls).toHaveLength(2);
    });

    it('reads a newly opened PR on the next prompt, not after the window', () => {
        record_pr(root, 's1', URL);
        const calls: number[][] = [];
        pr_watch_block(root, 's1', T0, probeOf({ 2534: 'OPEN' }, calls));
        record_pr(root, 's1', 'https://github.com/o/r/pull/2538');
        pr_watch_block(root, 's1', later(1_000), probeOf({ 2534: 'OPEN', 2538: 'OPEN' }, calls));
        expect(calls).toEqual([[2534], [2534, 2538]]);
    });

    it('says the reading is unverified when gh fails, and keeps the last state', () => {
        record_pr(root, 's1', URL);
        const block = pr_watch_block(root, 's1', T0, () => null);
        expect(block).toMatch(/FAILED — state unverified/);
        expect(block).toMatch(/#2534 OPEN/);
    });

    it('keeps sessions apart', () => {
        record_pr(root, 's1', URL);
        expect(pr_watch_block(root, 's2', T0, probeOf({ 2534: 'OPEN' }))).toBeNull();
    });
});

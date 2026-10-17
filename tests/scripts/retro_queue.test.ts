import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    CATCH_UP_WINDOW_DAYS,
    classifyUnit,
    enqueue,
    listQueue,
    localDay,
    queueDir,
    sweepDays,
} from '../../src/scripts/retro_queue.js';

const tmpDirs: string[] = [];
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-queue-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function repoWithWorktree(): { main: string; wt: string } {
    const main = tmp();
    const run = (cwd: string, args: string[]) => {
        const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    };
    run(main, ['init', '-q', '-b', 'main']);
    run(main, ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init']);
    const wt = path.join(tmp(), 'wt');
    run(main, ['worktree', 'add', '-q', '-b', 'side', wt]);
    return { main, wt };
}

const BERLIN = 'Europe/Berlin';

describe('retro_queue — one queue', () => {
    it('two-worktrees-one-queue', () => {
        const { main, wt } = repoWithWorktree();

        const key = 'retro:acme/widget#pr7@abc/p1';
        expect(enqueue(main, { unit_key: key, kind: 'pr', pr: 7 }, '2026-10-17T08:00:00Z')).toBe('enqueued');
        expect(enqueue(wt, { unit_key: key, kind: 'pr', pr: 7 }, '2026-10-17T09:00:00Z')).toBe('exists');
        enqueue(wt, { unit_key: 'retro:acme/widget#session@t1/p1', kind: 'session', session: 't1' }, '2026-10-17T09:00:00Z');

        expect(fs.realpathSync(queueDir(main)!)).toBe(fs.realpathSync(queueDir(wt)!));
        const fromMain = listQueue(main).map((e) => e.unit_key).sort();
        const fromWt = listQueue(wt).map((e) => e.unit_key).sort();
        expect(fromMain).toEqual(fromWt);
        expect(fromMain).toHaveLength(2);
        expect(listQueue(main).find((e) => e.unit_key === key)!.enqueued_at).toBe('2026-10-17T08:00:00Z');
    });

    it('leaves no temp file behind', () => {
        const { main } = repoWithWorktree();
        enqueue(main, { unit_key: 'retro:x#pr1@a/p1', kind: 'pr', pr: 1 }, '2026-10-17T08:00:00Z');
        expect(fs.readdirSync(queueDir(main)!).every((n) => n.endsWith('.json'))).toBe(true);
    });

    it('outside a git repository there is no queue', () => {
        const dir = tmp();
        expect(queueDir(dir)).toBeNull();
        expect(enqueue(dir, { unit_key: 'k', kind: 'pr', pr: 1 }, '2026-10-17T08:00:00Z')).toBe('no-queue');
        expect(listQueue(dir)).toEqual([]);
    });
});

describe('retro_queue — window and dedupe', () => {
    it('dst-switch-neither-drops-nor-doubles', () => {
        // Berlin leaves summer time on 2026-10-25 at 03:00 local.
        const days = sweepDays('2026-10-23', '2026-10-27');
        expect(days).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26']);
        // Spring forward, 2026-03-29.
        expect(sweepDays('2026-03-27', '2026-03-31')).toEqual([
            '2026-03-27',
            '2026-03-28',
            '2026-03-29',
            '2026-03-30',
        ]);
        // 23:30 local on the 24th is still the 24th, on either side of the switch.
        expect(localDay('2026-10-24T21:30:00Z', BERLIN)).toBe('2026-10-24');
        expect(localDay('2026-10-25T22:30:00Z', BERLIN)).toBe('2026-10-25');
    });

    it('older than the window is expired, inside it is not', () => {
        const today = '2026-10-27';
        const edge = `2026-10-${27 - CATCH_UP_WINDOW_DAYS}`;
        expect(classifyUnit({ day: edge, today, covered: false, retroSession: false })).toBe('in-window');
        expect(classifyUnit({ day: `2026-10-${26 - CATCH_UP_WINDOW_DAYS}`, today, covered: false, retroSession: false })).toBe(
            'expired',
        );
    });

    it('a session whose PR has a retro, and a retro session, are covered', () => {
        const today = '2026-10-27';
        expect(classifyUnit({ day: today, today, covered: true, retroSession: false })).toBe('covered');
        expect(classifyUnit({ day: today, today, covered: false, retroSession: true })).toBe('covered');
    });

    it('today is not swept; only finished days are', () => {
        expect(sweepDays('2026-10-27', '2026-10-27')).toEqual([]);
        expect(sweepDays('2026-10-26', '2026-10-27')).toEqual(['2026-10-26']);
    });

    it('a high-water mark older than the window sweeps only the window', () => {
        const days = sweepDays('2026-09-01', '2026-10-27');
        expect(days).toHaveLength(CATCH_UP_WINDOW_DAYS);
        expect(days[days.length - 1]).toBe('2026-10-26');
    });
});

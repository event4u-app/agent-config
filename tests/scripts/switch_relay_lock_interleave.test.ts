/**
 * road-to-a-link-with-agent-switch 8.1 — the record lock against a hook of the
 * version before tickets, each one paused at the exact point between its check
 * and its removal. That version's steps are the ones of
 * fixtures/switch_relay_v1_lock.ts: an exclusive create of `<record>.lock`,
 * and on failure a stale check of its mtime followed by a plain removal.
 * Its own file, because it wraps `renameSync` and `spawnSync` for the module.
 */
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const seam = vi.hoisted(() => ({
    beforeRename: null as ((from: string) => void) | null,
    noPs: false,
}));

vi.mock('node:fs', async (importOriginal) => {
    const real = await importOriginal<typeof fs>();
    return {
        ...real,
        renameSync: (from: fs.PathLike, to: fs.PathLike): void => {
            const hook = seam.beforeRename;
            seam.beforeRename = null;
            hook?.(String(from));
            real.renameSync(from, to);
        },
    };
});

vi.mock('node:child_process', async (importOriginal) => {
    const real = await importOriginal<typeof cp>();
    return {
        ...real,
        spawnSync: (...args: Parameters<typeof cp.spawnSync>) => {
            if (seam.noPs && args[0] === 'ps') return { pid: 0, output: [], stdout: '', stderr: '', status: null, signal: null, error: new Error('ENOENT') };
            return real.spawnSync(...args);
        },
    };
});

const { updateSwitchRecord } = await import('../../src/scripts/_lib/switch_relay.js');
const { switchRecordPath } = await import('../../src/scripts/_lib/switch_record_path.js');

const SESSION = 'a'.repeat(16);
let home: string;
let stateEnv: Record<string, string>;
let record: string;
let outer: string;

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-interleave-'));
    stateEnv = { EVENT4U_CONFIG_HOME: home };
    record = switchRecordPath(SESSION, stateEnv);
    outer = `${record}.lock`;
    fs.mkdirSync(path.dirname(record), { recursive: true });
});
afterEach(() => {
    seam.beforeRename = null;
    seam.noPs = false;
    fs.rmSync(home, { recursive: true, force: true });
});

const deadPid = (): number => Number(cp.execFileSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' }));
const backdate = (p: string, ms: number): void => {
    const t = new Date(Date.now() - ms);
    fs.utimesSync(p, t, t);
};
/** Whether `fn` ran under the lock. */
function lockedRun(fn: () => void = () => {}): boolean {
    let ran = false;
    updateSwitchRecord(
        SESSION,
        (cur) => {
            ran = true;
            fn();
            return cur;
        },
        stateEnv,
    );
    return ran;
}
const leftovers = (): string[] => fs.readdirSync(path.dirname(record)).filter((n) => n.includes('.lock') || n.includes('.reap.'));

it('an older hook paused between its stale check and its removal cannot remove the lock this version took meanwhile', () => {
    // An older holder that has run for ten seconds: stale to the older version.
    fs.writeFileSync(outer, '1.1.old');
    backdate(outer, 10_000);
    expect(Date.now() - fs.statSync(outer).mtimeMs > 2000).toBe(true); // the older hook's stale check
    fs.rmSync(outer); // the older holder releases while that hook is paused
    let removed = true;
    let created = true;
    expect(
        lockedRun(() => {
            // The older hook resumes: its removal and its exclusive create both fail.
            try {
                fs.rmSync(outer, { force: true });
            } catch {
                removed = false;
            }
            try {
                fs.writeFileSync(outer, 'old', { flag: 'wx' });
            } catch {
                created = false;
            }
            expect(fs.statSync(outer).isDirectory()).toBe(true);
        }),
    ).toBe(true);
    expect(removed).toBe(false);
    expect(created).toBe(false);
    expect(leftovers()).toEqual([]);
});

it('a contender paused between judging the older lock file abandoned and moving it aside puts back the one an older hook took meanwhile', () => {
    fs.writeFileSync(outer, `${deadPid()}.1.old`);
    seam.beforeRename = (from) => {
        expect(from).toBe(outer);
        // An older hook breaks the abandoned file and takes the lock itself.
        fs.rmSync(outer, { force: true });
        fs.writeFileSync(outer, `${process.pid}.2.old`, { flag: 'wx' });
    };
    expect(lockedRun()).toBe(false);
    expect(fs.readFileSync(outer, 'utf-8')).toBe(`${process.pid}.2.old`);
    expect(leftovers()).toEqual([`${path.basename(record)}.lock`]);
});

it('a contender paused there removes an abandoned lock file that nobody took meanwhile', () => {
    fs.writeFileSync(outer, `${deadPid()}.1.old`);
    seam.beforeRename = () => {};
    expect(lockedRun()).toBe(true);
    expect(leftovers()).toEqual([]);
});

it('this version’s lock left by a holder that ended is removed; one whose holder runs is kept', () => {
    fs.mkdirSync(outer);
    fs.writeFileSync(path.join(outer, `${deadPid()}.1.x`), '');
    expect(lockedRun()).toBe(true);
    fs.mkdirSync(outer);
    fs.writeFileSync(path.join(outer, '1.1.x'), '');
    backdate(outer, 3_600_000);
    expect(lockedRun()).toBe(false);
    expect(fs.readdirSync(outer)).toEqual(['1.1.x']);
});

it('this version’s lock with no holder in it is kept while fresh and removed once stale', () => {
    fs.mkdirSync(outer);
    expect(lockedRun()).toBe(false);
    backdate(outer, 3000);
    expect(lockedRun()).toBe(true);
    expect(leftovers()).toEqual([]);
});

it('without a way to read when a process started, a ticket naming a running process is kept, however old', () => {
    seam.noPs = true;
    const holder = cp.spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
    try {
        const t = `${record}.lock.${String(holder.pid)}.1.x`;
        fs.writeFileSync(t, '');
        backdate(t, 3_600_000);
        expect(lockedRun()).toBe(false);
        expect(fs.existsSync(t)).toBe(true);
    } finally {
        holder.kill();
    }
});

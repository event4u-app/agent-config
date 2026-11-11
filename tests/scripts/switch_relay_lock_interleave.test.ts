/**
 * road-to-a-link-with-agent-switch 8.1 — the record lock against the version
 * before tickets (20.2.0), whose steps are those of
 * fixtures/switch_relay_v1_lock.ts: an exclusive create of `<record>.lock`,
 * and on failure a stale check of its mtime followed by a plain removal.
 * This version takes no lock until no hook started before its install runs
 * (the drain), and after it never removes that version's lock file.
 * Its own file, because it replaces `ps` (through `spawnSync`) for the module.
 */
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seam = vi.hoisted(() => ({ ps: null as string | null | undefined }));

vi.mock('node:child_process', async (importOriginal) => {
    const real = await importOriginal<typeof cp>();
    return {
        ...real,
        spawnSync: (...args: Parameters<typeof cp.spawnSync>) => {
            if (args[0] !== 'ps' || seam.ps === undefined) return real.spawnSync(...args);
            // `null`: no `ps` on this host.
            if (seam.ps === null) return { pid: 0, output: [], stdout: '', stderr: '', status: null, signal: null, error: new Error('ENOENT') };
            return { pid: 0, output: [], stdout: seam.ps, stderr: '', status: 0, signal: null };
        },
    };
});

const { drainSwitchLock, updateSwitchRecord } = await import('../../src/scripts/_lib/switch_relay.js');
const { switchRecordPath } = await import('../../src/scripts/_lib/switch_record_path.js');

const SESSION = 'a'.repeat(16);
let home: string;
let stateEnv: Record<string, string>;
let record: string;
let outer: string;
let argv1: string | undefined;

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-interleave-'));
    stateEnv = { EVENT4U_CONFIG_HOME: home };
    record = switchRecordPath(SESSION, stateEnv);
    outer = `${record}.lock`;
    fs.mkdirSync(path.dirname(record), { recursive: true });
    argv1 = process.argv[1];
    seam.ps = '';
});
afterEach(() => {
    seam.ps = undefined;
    process.argv[1] = argv1 ?? '';
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
const entries = (): string[] => fs.readdirSync(path.dirname(record)).filter((n) => n.includes('.lock'));
/** This process as if just installed: the file it was started from was created now. */
function freshInstall(): void {
    const self = path.join(home, 'dispatch.js');
    fs.writeFileSync(self, '');
    process.argv[1] = self;
}

describe('the drain', () => {
    it('while a hook started before this install runs, no lock is taken and the older lock file stays', () => {
        freshInstall();
        fs.writeFileSync(outer, `${deadPid()}.1.old`);
        seam.ps = `  4242 01:00 node /home/u/.event4u/agent-config/runtime/current/dist/hooks/dispatch.js --event stop\n`;
        expect(lockedRun()).toBe(false);
        expect(drainSwitchLock(stateEnv)).toBe(false);
        expect(fs.readFileSync(outer, 'utf-8')).toMatch(/\.old$/);
    });

    it('once none runs, the older lock files are removed and the lock is taken; the answer is kept', () => {
        freshInstall();
        fs.writeFileSync(outer, `${deadPid()}.1.old`);
        const backoffLock = record.replace(/\.json$/, '.backoff.json.lock');
        fs.writeFileSync(backoffLock, `${deadPid()}.1.old`);
        // A hook started after the install (which the second's slack needs to have passed), and a process that is no hook.
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
        seam.ps = `  4242 00:00 node /x/dist/hooks/dispatch.js\n  4343 40-00:00:00 /usr/sbin/sshd\n`;
        expect(lockedRun()).toBe(true);
        expect(fs.existsSync(outer)).toBe(false);
        expect(fs.existsSync(backoffLock)).toBe(false);
        seam.ps = `  4242 999-00:00:00 node /x/dist/hooks/dispatch.js\n`;
        expect(drainSwitchLock(stateEnv)).toBe(true);
    });

    it('a hook started a moment before the install counts as one of the earlier install', () => {
        freshInstall();
        seam.ps = `  4242 00:01 node /x/dist/hooks/dispatch.js\n`;
        expect(drainSwitchLock(stateEnv)).toBe(false);
    });

    it('without `ps`, an install counts as drained fifteen minutes after it, not before', () => {
        seam.ps = null;
        freshInstall();
        expect(drainSwitchLock(stateEnv)).toBe(false);
        expect(lockedRun()).toBe(false);
        // A file created long before: the system shell.
        process.argv[1] = '/bin/sh';
        expect(Date.now() - fs.statSync(fs.realpathSync('/bin/sh')).ctimeMs).toBeGreaterThan(15 * 60_000);
        expect(drainSwitchLock(stateEnv)).toBe(true);
    });
});

describe('after the drain', () => {
    beforeEach(() => {
        expect(drainSwitchLock(stateEnv)).toBe(true);
    });

    it('a hook of the older version, paused between its stale check and its removal, cannot remove this version’s lock', () => {
        // A rolled-back hook holds the older file and has run for ten seconds: stale to that version.
        fs.writeFileSync(outer, '1.1.old');
        backdate(outer, 10_000);
        expect(Date.now() - fs.statSync(outer).mtimeMs > 2000).toBe(true); // the paused hook's stale check
        fs.rmSync(outer); // its holder releases meanwhile
        let removed = true;
        let created = true;
        expect(
            lockedRun(() => {
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
        expect(entries()).toEqual([]);
    });

    it('the older version’s lock file is left alone, even with its holder ended, and this version writes nothing', () => {
        fs.writeFileSync(outer, `${deadPid()}.1.old`);
        backdate(outer, 3_600_000);
        expect(lockedRun()).toBe(false);
        expect(fs.readFileSync(outer, 'utf-8')).toMatch(/\.old$/);
        expect(entries()).toEqual([path.basename(outer)]);
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
        expect(entries()).toEqual([]);
    });

    it('a ticket whose process runs is kept however old, with no expiry', () => {
        const holder = cp.spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
        try {
            const t = `${record}.lock.${String(holder.pid)}.1.x`;
            fs.writeFileSync(t, '');
            backdate(t, 24 * 3_600_000);
            expect(lockedRun()).toBe(false);
            expect(fs.existsSync(t)).toBe(true);
        } finally {
            holder.kill();
        }
    });
});

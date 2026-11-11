/**
 * road-to-a-link-with-agent-switch 8.1 — the record lock against the version
 * before tickets (20.2.0), whose steps are those of
 * fixtures/switch_relay_v1_lock.ts: an exclusive create of `<record>.lock`,
 * and on failure a stale check of its mtime followed by a plain removal.
 * This version holds that path as a directory and never removes a file there.
 */
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const { readSwitchRecord, updateSwitchRecord, writeSwitchRecord } = await import('../../src/scripts/_lib/switch_relay.js');
const { parseRecord: parseRecordBeforeTickets } = await import('./fixtures/switch_relay_v1_record.js');
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
describe('one lock across 20.2.0 and this version', () => {
    it('a hook of 20.2.0, paused between its stale check and its removal, can neither remove nor take the lock of a holder of this version', () => {
        // A hook of 20.2.0 holds the older file and has run for ten seconds: stale to that version.
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

it('20.2.0 reads the record this version writes, field for field', () => {
    const rec = { id: '0123456789abcdef', decision_told: true, checkpointed: true, outcome_told: false, expires_at: Date.now() + 60_000 };
    writeSwitchRecord(SESSION, rec, stateEnv);
    expect(readSwitchRecord(SESSION, stateEnv)).toEqual(rec);
    expect(parseRecordBeforeTickets(fs.readFileSync(record, 'utf-8'), fs.statSync(record).mtimeMs)).toEqual(rec);
});

/**
 * road-to-a-link-with-agent-switch 8.1 and 8.2 — the link's locks between real
 * processes. Each hook half runs in its own `node` process
 * (fixtures/switch_relay_driver.ts) against a real `agent-switch` stand-in, so
 * two prompts or two Stops overlap the way two hook processes of one session do.
 */
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendQuotaSnapshot, hashSessionId } from '../../src/scripts/_lib/quota_ledger.js';
import { readSwitchRecord, updateSwitchRecord } from '../../src/scripts/_lib/switch_relay.js';
import { switchRecordPath } from '../../src/scripts/_lib/switch_record_path.js';
import { noticeReply, type QuotaNoticeDeps } from '../../src/scripts/quota_notice_hook.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAKE = path.join(HERE, 'fixtures', 'fake_agent_switch.mjs');
const DRIVER = path.join(HERE, 'fixtures', 'switch_relay_driver.ts');
const ID = '0123456789abcdef';
const SESSION = 'sess-a';
const APPROVED = { state: 'approved', decision: { kind: 'approve', target: 'claude/b', how: 'after-turn', by: 'as-gui', at: 'x' } };

let home: string;
let stateEnv: Record<string, string>;
let switchFile: string;
let callLog: string;
let writeLog: string;
let binEnv: Record<string, string>;
let now: number;
let reset: number;

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-ipc-'));
    stateEnv = { EVENT4U_CONFIG_HOME: home };
    switchFile = path.join(home, 'request.json');
    callLog = path.join(home, 'calls.jsonl');
    writeLog = path.join(home, 'writes.log');
    const bin = path.join(home, 'bin');
    fs.mkdirSync(bin);
    const exe = path.join(bin, 'agent-switch');
    fs.writeFileSync(exe, `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "$@"\n`, 'utf-8');
    fs.chmodSync(exe, 0o755);
    binEnv = {
        PATH: `${bin}${path.delimiter}${path.dirname(process.execPath)}`,
        FAKE_AS_SWITCH_FILE: switchFile,
        FAKE_AS_LOG: callLog,
    };
    now = Date.now();
    reset = Math.trunc(now / 1000) + 3 * 3600;
    process.env['AGENT_CONFIG_SWITCH_QUESTION'] = '1';
});
afterEach(() => {
    delete process.env['AGENT_CONFIG_SWITCH_QUESTION'];
    fs.rmSync(home, { recursive: true, force: true });
});

function setRequest(over: Record<string, unknown> = {}): void {
    fs.writeFileSync(
        switchFile,
        JSON.stringify({
            v: 1,
            id: ID,
            rev: 1,
            account: 'claude/a',
            session: `claude/a/${SESSION}`,
            reason: { window: 'five_hour', fill: 85, resetsAt: '2026-11-07T15:00:00Z' },
            raisedBy: 'ac',
            candidates: [{ target: 'claude/b', provider: 'claude', fill: 12, resetsAt: null, how: ['after-turn', 'handoff'] }],
            raisedAt: new Date(now).toISOString(),
            expiresAt: new Date(reset * 1000).toISOString(),
            state: 'open',
            ...over,
        }),
    );
}

function deps(): QuotaNoticeDeps {
    return {
        sessionId: SESSION,
        viaHost: true,
        env: { AGENT_CONFIG_SWITCH_QUESTION: '1' },
        stateEnv,
        billing: { billing_class: 'plan', source: null },
        now,
        link: { env: binEnv },
    };
}

/** A hot session with a raised request and its record. */
function raised(): void {
    [76, 80, 85].forEach((pct, i) =>
        appendQuotaSnapshot({ ts: now - (2 - i) * 5 * 60_000, session: hashSessionId(SESSION), five_hour: { pct, resets_at: reset }, account: 'claude/a' }, stateEnv),
    );
    setRequest();
    noticeReply(deps());
    expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)?.id).toBe(ID);
}

function showCalls(): number {
    if (!fs.existsSync(callLog)) return 0;
    return fs
        .readFileSync(callLog, 'utf-8')
        .split('\n')
        .filter((l) => l !== '')
        .map((l) => JSON.parse(l) as string[])
        .filter((a) => a[0] === 'switch' && a[1] === 'show').length;
}

function writes(): string[] {
    return fs.existsSync(writeLog) ? fs.readFileSync(writeLog, 'utf-8').split('\n').filter((l) => l !== '') : [];
}

/** The lock ticket a holder with this pid would leave. */
function ticket(pid: number): string {
    return `${switchRecordPath(hashSessionId(SESSION), stateEnv)}.lock.${pid}.1.x`;
}

interface Job {
    op: 'prompt' | 'stop';
    startAt?: number;
    holdMs?: number;
    label?: string;
}

/** Start one hook half in its own process; resolves with what it printed. */
function hook(job: Job): Promise<unknown> {
    const full = { session: SESSION, stateHome: home, binEnv, log: writeLog, ...job };
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', DRIVER, JSON.stringify(full)], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        child.stdout.on('data', (d: Buffer) => (out += d.toString()));
        child.stderr.on('data', (d: Buffer) => (err += d.toString()));
        child.on('close', (code) => (code === 0 ? resolve(JSON.parse(out) as unknown) : reject(new Error(`driver exited ${code}: ${err}`))));
    });
}

async function until(cond: () => boolean, ms = 10_000): Promise<void> {
    const end = Date.now() + ms;
    while (!cond()) {
        if (Date.now() > end) throw new Error('condition not reached');
        await new Promise((r) => setTimeout(r, 20));
    }
}

/** Two or three processes that start their work at one instant, after their startup. */
const together = (): number => Date.now() + 1500;

describe('8.1 a writer the lock cannot evict', () => {
    it('a Stop held past the stale break keeps its lock; a second Stop writes nothing after it', async () => {
        raised();
        setRequest(APPROVED);
        const slow = hook({ op: 'stop', holdMs: 3500, label: 'A' });
        await until(() => writes().includes('A:start'));
        // Past the two-second stale break the old lock took for a dead holder.
        await new Promise((r) => setTimeout(r, 2300));
        const second = await hook({ op: 'stop', label: 'B' });
        expect(await slow).toBe(true);
        expect(second).toBe(false);
        expect(writes()).toEqual(['A:start', 'A:written']);
        // The move is approved, not done: the record stays, marked complete.
        expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)?.checkpointed).toBe(true);
    }, 20_000);

    it('a lock whose holder has ended is broken at once', () => {
        raised();
        const gone = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' });
        const held = ticket(Number(gone.stdout));
        fs.writeFileSync(held, '');
        expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(true);
        expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)).toBeNull();
        expect(fs.existsSync(held)).toBe(false);
    });

    it('breaking a dead holder’s lock never removes a live holder’s ticket beside it', () => {
        raised();
        const gone = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' });
        const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
        try {
            fs.writeFileSync(ticket(Number(gone.stdout)), '');
            const live = ticket(holder.pid ?? 0);
            fs.writeFileSync(live, '');
            expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(false);
            expect(fs.existsSync(live)).toBe(true);
            expect(fs.existsSync(ticket(Number(gone.stdout)))).toBe(false);
            expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)?.id).toBe(ID);
        } finally {
            holder.kill();
        }
    });

    it('three Stops breaking a dead holder’s lock at once write the checkpoint once', async () => {
        raised();
        setRequest(APPROVED);
        const gone = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' });
        fs.writeFileSync(ticket(Number(gone.stdout)), '');
        const at = together();
        const wrote = await Promise.all(['A', 'B', 'C'].map((label) => hook({ op: 'stop', startAt: at, holdMs: 300, label })));
        expect(wrote.filter((w) => w === true)).toHaveLength(1);
        expect(writes()).toHaveLength(2);
        expect(writes()[0]?.split(':')[0]).toBe(writes()[1]?.split(':')[0]);
    }, 20_000);

    it('a live holder’s ticket is kept past the stale break', () => {
        raised();
        const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
        try {
            const held = ticket(holder.pid ?? 0);
            fs.writeFileSync(held, '');
            const old = new Date(Date.now() - 10_000);
            fs.utimesSync(held, old, old);
            expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(false);
            expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)?.id).toBe(ID);
            expect(fs.existsSync(held)).toBe(true);
        } finally {
            holder.kill();
        }
    });
});

describe('the lock across an install: the older single lock file', () => {
    const legacy = (): string => `${switchRecordPath(hashSessionId(SESSION), stateEnv)}.lock`;
    const deadPid = (): number => Number(spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' }).stdout);

    it('a hook of the older version holding the single lock file keeps this one out', () => {
        raised();
        const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
        try {
            const token = `${String(holder.pid)}.${String(Date.now())}.old`;
            fs.writeFileSync(legacy(), token);
            expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(false);
            expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)?.id).toBe(ID);
            expect(fs.readFileSync(legacy(), 'utf-8')).toBe(token);
        } finally {
            holder.kill();
        }
    });

    it('while this version holds, the single lock file is taken, so the older version’s exclusive create fails', () => {
        raised();
        let seen: string | null = null;
        let oldCouldTake = true;
        updateSwitchRecord(
            hashSessionId(SESSION),
            (cur) => {
                seen = fs.readFileSync(legacy(), 'utf-8');
                try {
                    fs.writeFileSync(legacy(), 'old', { flag: 'wx' });
                } catch {
                    oldCouldTake = false;
                }
                return cur;
            },
            stateEnv,
        );
        expect(seen).toMatch(new RegExp(`^${String(process.pid)}\\.`));
        expect(oldCouldTake).toBe(false);
        expect(fs.existsSync(legacy())).toBe(false);
    });

    it('a dead holder’s single lock file is broken', () => {
        raised();
        fs.writeFileSync(legacy(), `${deadPid()}.1.old`);
        expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(true);
        expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)).toBeNull();
    });

    it('every breakable ticket is removed, whatever the listing order, while a live one still keeps the lock', () => {
        raised();
        const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
        try {
            const base = `${switchRecordPath(hashSessionId(SESSION), stateEnv)}.lock.`;
            const dead = [deadPid(), deadPid(), deadPid()].map((pid) => ticket(pid));
            const unnamed = ['0.old', 'a.old', 'zz.old'].map((t) => base + t);
            const old = new Date(Date.now() - 10_000);
            for (const t of [...dead, ...unnamed]) {
                fs.writeFileSync(t, '');
                fs.utimesSync(t, old, old);
            }
            // With six breakable tickets around a live one, a scan that stops at
            // the first live ticket leaves some behind in most listing orders.
            const live = `${base}${String(holder.pid)}.5.x`;
            fs.writeFileSync(live, '');
            expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(false);
            expect([...dead, ...unnamed].filter((t) => fs.existsSync(t))).toEqual([]);
            expect(fs.existsSync(live)).toBe(true);
        } finally {
            holder.kill();
        }
    });

    it('a live holder’s ticket older than fifteen minutes is taken as a reused pid and broken', () => {
        raised();
        const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
        try {
            const held = ticket(holder.pid ?? 0);
            fs.writeFileSync(held, '');
            const old = new Date(Date.now() - 16 * 60_000);
            fs.utimesSync(held, old, old);
            expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(true);
            expect(fs.existsSync(held)).toBe(false);
        } finally {
            holder.kill();
        }
    });
});

describe('8.2 two hook processes at once', () => {
    it('relay: a decision made in agent-switch is told by exactly one of two prompts', async () => {
        raised();
        setRequest(APPROVED);
        const at = together();
        const outs = (await Promise.all([hook({ op: 'prompt', startAt: at }), hook({ op: 'prompt', startAt: at })])) as string[][];
        const told = outs.flat().filter((l) => l.includes('approved in agent-switch'));
        expect(told).toHaveLength(1);
    }, 20_000);

    it('back-off: three prompts failing at once count three, rest the link and say so once', async () => {
        raised();
        fs.rmSync(switchFile);
        const at = together();
        const outs = (await Promise.all([1, 2, 3].map(() => hook({ op: 'prompt', startAt: at })))) as string[][];
        expect(showCalls()).toBe(3);
        expect(outs.flat().filter((l) => l.includes('did not answer'))).toHaveLength(1);
        const later = (await hook({ op: 'prompt' })) as string[];
        expect(showCalls()).toBe(3);
        expect(later.filter((l) => l.includes('did not answer'))).toEqual([]);
    }, 20_000);

    it('checkpoint: two Stops at once write it exactly once', async () => {
        raised();
        setRequest(APPROVED);
        const at = together();
        const wrote = await Promise.all([hook({ op: 'stop', startAt: at, holdMs: 300, label: 'A' }), hook({ op: 'stop', startAt: at, holdMs: 300, label: 'B' })]);
        expect(wrote.filter((w) => w === true)).toHaveLength(1);
        expect(writes()).toHaveLength(2);
        expect(writes()[0]?.split(':')[0]).toBe(writes()[1]?.split(':')[0]);
    }, 20_000);
});

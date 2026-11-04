import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { originalPath, runTap } from '../../src/scripts/_cli/cmd_statusline.js';
import { readQuotaLedger } from '../../src/scripts/_lib/quota_ledger.js';

let home: string;
let env: Record<string, string>;

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-tap-'));
    env = { EVENT4U_CONFIG_HOME: home, HOME: home };
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

const now = Date.now();
const PAYLOAD = JSON.stringify({
    session_id: 's',
    rate_limits: { five_hour: { used_percentage: 12, resets_at: Math.trunc(now / 1000) + 3600 } },
});

function recordOriginal(statusLine: unknown): void {
    fs.mkdirSync(path.dirname(originalPath(env)), { recursive: true });
    fs.writeFileSync(originalPath(env), JSON.stringify({ statusLine }));
}

describe('runTap', () => {
    it('hands the same stdin to the wrapped command, prints its output unchanged, then writes a snapshot', () => {
        recordOriginal({ type: 'command', command: 'my-line --fancy' });
        const calls: Array<[string, string]> = [];
        const out = runTap({ stdin: PAYLOAD, env, now, run: (c, i) => (calls.push([c, i]), 'MY LINE\n') });
        expect(calls).toEqual([['my-line --fancy', PAYLOAD]]);
        expect(out).toBe('MY LINE\n');
        expect(readQuotaLedger(env, now)).toHaveLength(1);
    });

    it('the wrapped line still prints when the payload is not JSON', () => {
        recordOriginal({ type: 'command', command: 'my-line' });
        expect(runTap({ stdin: 'not json', env, now, run: () => 'LINE' })).toBe('LINE');
        expect(readQuotaLedger(env, now)).toEqual([]);
    });

    it('a failing wrapped command never throws out of the tap', () => {
        recordOriginal({ type: 'command', command: 'boom' });
        const out = runTap({ stdin: PAYLOAD, env, now, run: () => { throw new Error('x'); } });
        expect(out).toBe('');
        expect(readQuotaLedger(env, now)).toHaveLength(1);
    });

    it('never wraps itself', () => {
        recordOriginal({ type: 'command', command: 'agent-config statusline:tap' });
        let ran = false;
        runTap({ stdin: PAYLOAD, env, now, run: () => ((ran = true), 'x') });
        expect(ran).toBe(false);
    });

    it('with no wrapped line it prints nothing while the window is not under pressure', () => {
        expect(runTap({ stdin: PAYLOAD, env, now, run: () => 'x' })).toBe('');
    });

    it('with no wrapped line it prints its own segment once a window is warm', () => {
        const warm = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 64, resets_at: Math.trunc(now / 1000) + 3600 } } });
        expect(runTap({ stdin: warm, env, now })).toMatch(/^AC 5h window 64 %/);
    });
});

describe('runTap — prompt cache (road-to-a-return-that-names-its-price 1.1, 1.4, 3.1)', () => {
    function store(starts: number[]): string {
        const dir = fs.mkdtempSync(path.join(home, 'store-'));
        starts.forEach((t, i) => {
            const first = { type: 'assistant', isSidechain: false, message: { usage: { input_tokens: t - 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 1000 } } };
            fs.writeFileSync(path.join(dir, `s${i}.jsonl`), `${JSON.stringify({ type: 'user', message: { content: 'hi' } })}\n${JSON.stringify(first)}\n`);
        });
        return dir;
    }
    const cachePayload = (dir: string, expires: number, recache = 182_000): string =>
        JSON.stringify({
            session_id: 's',
            transcript_path: path.join(dir, 's0.jsonl'),
            prompt_cache: { warm: now < expires, ttl: '1h', expires_at: new Date(expires).toISOString(), recache_tokens_if_cold: recache },
        });

    it('a warm cache above the threshold shows the expiry as a clock, and the ledger keeps the measured start', () => {
        const dir = store([20_000, 24_000, 30_000]);
        const out = runTap({ stdin: cachePayload(dir, now + 20 * 60_000), env, now });
        expect(out).toMatch(/^AC cache warm until \d\d:\d\d$/);
        const [snap] = readQuotaLedger(env, now);
        expect(snap?.clear_start).toBe(24_000);
        expect(snap?.cache?.recache_tokens_if_cold).toBe(182_000);
    });

    it('a cold cache names what continuing re-processes, on the same single AC line as a warm window', () => {
        const dir = store([24_000]);
        const payload = JSON.parse(cachePayload(dir, now - 60_000)) as Record<string, unknown>;
        payload['rate_limits'] = { five_hour: { used_percentage: 64, resets_at: Math.trunc(now / 1000) + 3600 } };
        const out = runTap({ stdin: JSON.stringify(payload), env, now });
        expect(out).toMatch(/^AC 5h window 64 %.* · cache cold · continue ≈182k$/);
        expect(out.split('\n')).toHaveLength(1);
    });

    it('below twice the measured start the cache part stays out of the line', () => {
        const dir = store([100_000]);
        expect(runTap({ stdin: cachePayload(dir, now - 60_000), env, now })).toBe('');
    });

    it('a store with no readable session yields no start, never a guess', () => {
        const dir = fs.mkdtempSync(path.join(home, 'empty-'));
        runTap({ stdin: cachePayload(dir, now + 60_000), env, now });
        expect(readQuotaLedger(env, now)[0]?.clear_start).toBeUndefined();
    });
});

describe('runTap with a chained status line', () => {
    const warm = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 64, resets_at: Math.trunc(now / 1000) + 3600 } } });

    it('writes the snapshot and the verdict before the chained command runs, so a slow or killed one cannot lose it', async () => {
        const { hotWindowLine } = await import('../../src/scripts/_lib/pressure_state.js');
        recordOriginal({ type: 'command', command: 'slow-line' });
        const hot = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 91, resets_at: Math.trunc(now / 1000) + 3600 } } });
        let seenAtRun = -1;
        let verdictAtRun: string | null = null;
        runTap({
            stdin: hot,
            env,
            now,
            run: () => {
                seenAtRun = readQuotaLedger(env, now).length;
                verdictAtRun = hotWindowLine(env, now);
                throw new Error('killed by the host timeout');
            },
        });
        expect(seenAtRun).toBe(1);
        expect(verdictAtRun).toMatch(/^5h window 91 %/);
    });

    it('at warm the AC segment follows the chained output on its own line', () => {
        recordOriginal({ type: 'command', command: 'my-line' });
        const out = runTap({ stdin: warm, env, now, run: () => 'MY LINE' });
        const lines = out.split('\n');
        expect(lines[0]).toBe('MY LINE');
        expect(lines[1]).toMatch(/^AC 5h window 64 %/);
        expect(lines).toHaveLength(2);
        expect(lines[1]).not.toMatch(/[\u0000-\u001f\u007f]/);
    });

    it('a chained output ending in a newline gets no blank line before the segment', () => {
        recordOriginal({ type: 'command', command: 'my-line' });
        expect(runTap({ stdin: warm, env, now, run: () => 'MY LINE\n' })).toMatch(/^MY LINE\nAC 5h window 64 %[^\n]*$/);
    });

    it('the segment still shows when the chained command printed nothing', () => {
        recordOriginal({ type: 'command', command: 'boom' });
        expect(runTap({ stdin: warm, env, now, run: () => '' })).toMatch(/^AC 5h window 64 %/);
    });

    it('below warm the chained output is printed unchanged', () => {
        recordOriginal({ type: 'command', command: 'my-line' });
        expect(runTap({ stdin: PAYLOAD, env, now, run: () => 'MY LINE\n' })).toBe('MY LINE\n');
    });
});

describe('runTap — context fill (road-to-a-fill-the-session-sees-coming 1.1)', () => {
    const ctx = (pct: number, extra: Record<string, unknown> = {}): string =>
        JSON.stringify({ session_id: 's', context_window: { used_percentage: pct, context_window_size: 200_000 }, ...extra });

    it('at 85 % the line carries the context segment with the measured size', () => {
        expect(runTap({ stdin: ctx(85), env, now })).toBe('AC context 85 % (170,000 / 200,000 tokens)');
    });

    it('exactly at the band the segment shows; one point below it does not', () => {
        expect(runTap({ stdin: ctx(80), env, now })).toMatch(/^AC context 80 %/);
        expect(runTap({ stdin: ctx(79.4), env, now })).toBe('');
    });

    it('joins a warm window on the single AC line, never a second one', () => {
        const rate_limits = { five_hour: { used_percentage: 64, resets_at: Math.trunc(now / 1000) + 3600 } };
        const out = runTap({ stdin: ctx(91, { rate_limits }), env, now });
        expect(out).toMatch(/^AC 5h window 64 %.* · context 91 % \(182,000 \/ 200,000 tokens\)$/);
        expect(out.split('\n')).toHaveLength(1);
    });

    it('without a window size the segment names the percentage only', () => {
        expect(runTap({ stdin: JSON.stringify({ context_window: { used_percentage: 88 } }), env, now })).toBe('AC context 88 %');
    });

    it('follows a chained line on its own line', () => {
        recordOriginal({ type: 'command', command: 'my-line' });
        expect(runTap({ stdin: ctx(85), env, now, run: () => 'MY LINE' })).toBe('MY LINE\nAC context 85 % (170,000 / 200,000 tokens)');
    });
});

describe('runTap → pressure verdict', () => {
    it('leaves a fresh verdict the dispatch-path readers can find', async () => {
        const { hotWindowLine } = await import('../../src/scripts/_lib/pressure_state.js');
        const hot = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 91, resets_at: Math.trunc(now / 1000) + 3600 } } });
        runTap({ stdin: hot, env, now });
        expect(hotWindowLine(env, now)).toMatch(/^5h window 91 %/);
        expect(hotWindowLine(env, now + 11 * 60_000)).toBeNull();
    });
});

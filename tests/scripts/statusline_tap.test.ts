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

describe('runTap → pressure verdict', () => {
    it('leaves a fresh verdict the dispatch-path readers can find', async () => {
        const { hotWindowLine } = await import('../../src/scripts/_lib/pressure_state.js');
        const hot = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 91, resets_at: Math.trunc(now / 1000) + 3600 } } });
        runTap({ stdin: hot, env, now });
        expect(hotWindowLine(env, now)).toMatch(/^5h window 91 %/);
        expect(hotWindowLine(env, now + 11 * 60_000)).toBeNull();
    });
});

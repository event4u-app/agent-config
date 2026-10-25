import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readBillingClass } from '../../src/scripts/_lib/billing_class.js';
import { appendQuotaSnapshot, hashSessionId } from '../../src/scripts/_lib/quota_ledger.js';
import { claimOnce, noticeLines, recordSpawnRan, spawnApproved, spawnAsk, type QuotaNoticeDeps } from '../../src/scripts/quota_notice_hook.js';

let home: string;
let stateEnv: Record<string, string>;
const NOW = Date.now();
const RESET = Math.trunc(NOW / 1000) + 3 * 3600;
const PLAN = { billing_class: 'plan', source: null } as const;
const METERED = { billing_class: 'metered', source: 'ANTHROPIC_API_KEY' } as const;

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'quota-notice-'));
    stateEnv = { EVENT4U_CONFIG_HOME: home };
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

function deps(over: Partial<QuotaNoticeDeps> = {}): QuotaNoticeDeps {
    return { sessionId: 'sess-a', viaHost: true, env: {}, stateEnv, billing: PLAN, now: NOW, ...over };
}

function feed(pcts: number[], extra: Record<string, unknown> = {}, session = 'sess-a'): void {
    pcts.forEach((pct, i) => {
        appendQuotaSnapshot(
            { ts: NOW - (pcts.length - 1 - i) * 5 * 60_000, session: hashSessionId(session), five_hour: { pct, resets_at: RESET }, ...extra },
            stateEnv,
        );
    });
}

describe('window notices', () => {
    it('a window filling faster than it resets produces one notice with fill, projection and reset', () => {
        feed([20, 25, 30]);
        const lines = noticeLines(deps());
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/^AC: 5h window 30 % · projected full \d\d:\d\d · resets \d\d:\d\d\./);
    });

    it('the same state in the same window is shown once on the machine, across sessions', () => {
        feed([20, 25, 30]);
        expect(noticeLines(deps())).toHaveLength(1);
        expect(noticeLines(deps({ sessionId: 'sess-b' }))).toEqual([]);
    });

    it('a worse state in the same window is a new notice', () => {
        feed([60]);
        expect(noticeLines(deps())).toHaveLength(1);
        feed([85]);
        expect(noticeLines(deps())[0]).toMatch(/85 %/);
    });

    it('ok and unknown windows say nothing', () => {
        feed([5, 6, 7]);
        expect(noticeLines(deps())).toEqual([]);
        expect(noticeLines(deps({ now: NOW + 60 * 60_000 }))).toEqual([]);
    });
});

describe('context notice', () => {
    it('context at 85 % of the window gets one notice per session, and a second turn none', () => {
        feed([5], { context_used_pct: 85 });
        expect(noticeLines(deps())).toEqual([expect.stringMatching(/context is 85 % of its window/)]);
        expect(noticeLines(deps())).toEqual([]);
    });

    it('another session’s context fill is not this session’s', () => {
        feed([5], { context_used_pct: 95 }, 'sess-other');
        expect(noticeLines(deps())).toEqual([]);
    });
});

describe('metered notice', () => {
    it('a session that may bill per token is told once, naming the source', () => {
        const first = noticeLines(deps({ billing: METERED }));
        expect(first[0]).toMatch(/may bill per token .* ANTHROPIC_API_KEY/);
        expect(noticeLines(deps({ billing: METERED }))).toEqual([]);
    });

    it('a plan session is not', () => {
        expect(noticeLines(deps())).toEqual([]);
    });
});

describe('suppression', () => {
    it.each([
        [{ env: { CI: 'true' } }],
        [{ env: { AGENT_CONFIG_NO_QUOTA_NOTICE: '1' } }],
        [{ viaHost: false }],
        [{ sessionId: null }],
    ])('%o says nothing', (over) => {
        feed([20, 25, 30]);
        expect(noticeLines(deps({ ...over, billing: METERED }))).toEqual([]);
    });
});

describe('spawn ask', () => {
    const askDeps = (over: Record<string, unknown> = {}) => ({
        ...deps({ billing: METERED }),
        toolName: 'Agent',
        toolUseId: 'call-1',
        repoRoot: home,
        ...over,
    });
    const ran = (over: Record<string, unknown> = {}) =>
        recordSpawnRan({ sessionId: 'sess-a', stateEnv, toolName: 'Agent', toolUseId: 'call-1', now: NOW, ...over });
    const grant = () => {
        fs.mkdirSync(path.join(home, 'agents', 'runtime', 'billing-grants'), { recursive: true });
        fs.writeFileSync(
            path.join(home, 'agents', 'runtime', 'billing-grants', 'run-1.json'),
            JSON.stringify({ run_id: 'run-1', issued_at: new Date().toISOString() }),
        );
    };

    it('a "no" approves nothing: the next spawn asks again', () => {
        expect(spawnAsk(askDeps())).toMatch(/may bill per token .*Once you have allowed one spawn here, AC stops asking/);
        expect(spawnAsk(askDeps({ toolUseId: 'call-2' }))).toMatch(/may bill per token/);
    });

    it('the asked call running approves the session — that session only', () => {
        spawnAsk(askDeps());
        expect(ran()).toBe(true);
        expect(spawnApproved('sess-a', stateEnv)).toBe(true);
        expect(spawnAsk(askDeps({ toolUseId: 'call-2' }))).toBeNull();
        expect(spawnAsk(askDeps({ sessionId: 'sess-b' }))).toMatch(/may bill per token/);
    });

    it('a spawn that ran under a billing grant approves nothing once the grant is gone', () => {
        grant();
        expect(spawnAsk(askDeps({ env: { AC_BILLING_GRANT: 'run-1' } }))).toBeNull();
        expect(ran()).toBe(false);
        expect(spawnAsk(askDeps({ toolUseId: 'call-2' }))).toMatch(/may bill per token/);
    });

    it('CI, no user channel or no session id do not silence the ask; a billing grant does', () => {
        for (const over of [{ env: { CI: 'true' } }, { viaHost: false }, { sessionId: null }, { env: { GITHUB_ACTIONS: 'true' } }]) {
            expect(spawnAsk(askDeps(over)), JSON.stringify(over)).toMatch(/may bill per token/);
        }
        grant();
        expect(spawnAsk(askDeps({ env: { CI: 'true', AC_BILLING_GRANT: 'run-1' } }))).toBeNull();
    });

    it('a call asked about without a session id can never approve a session', () => {
        spawnAsk(askDeps({ sessionId: null }));
        expect(recordSpawnRan({ sessionId: null, stateEnv, toolName: 'Agent', toolUseId: 'call-1', now: NOW })).toBe(false);
    });

    it('a spawn whose ask was suppressed approves nothing', () => {
        expect(spawnAsk(askDeps({ env: { AGENT_CONFIG_NO_SPAWN_ASK: '1' } }))).toBeNull();
        expect(ran()).toBe(false);
        expect(spawnApproved('sess-a', stateEnv)).toBe(false);
    });

    it('another call running, or a call with no id, approves nothing', () => {
        spawnAsk(askDeps());
        expect(ran({ toolUseId: 'call-other' })).toBe(false);
        expect(spawnAsk(askDeps({ toolUseId: null }))).toMatch(/may bill per token/);
        expect(ran({ toolUseId: null })).toBe(false);
        expect(spawnApproved('sess-a', stateEnv)).toBe(false);
    });

    it('the ask kill switch leaves the notices on, and the notice kill switch leaves the ask on', () => {
        expect(spawnAsk(askDeps({ env: { AGENT_CONFIG_NO_QUOTA_NOTICE: '1' } }))).toMatch(/may bill per token/);
        expect(noticeLines(deps({ billing: METERED, env: { AGENT_CONFIG_NO_SPAWN_ASK: '1' } }))).toHaveLength(1);
    });

    it('never asks in a plan session or for a non-spawn tool', () => {
        expect(spawnAsk(askDeps({ billing: PLAN }))).toBeNull();
        expect(spawnAsk(askDeps({ toolName: 'Bash' }))).toBeNull();
    });

    it('markers older than eight days expire', () => {
        spawnAsk(askDeps());
        ran();
        const approvedDir = path.join(home, 'state', 'quota', 'approved');
        for (const f of fs.readdirSync(approvedDir)) {
            const old = (NOW - 9 * 24 * 3600 * 1000) / 1000;
            fs.utimesSync(path.join(approvedDir, f), old, old);
        }
        // No write in between: the age is enforced on read.
        expect(spawnAsk(askDeps({ toolUseId: 'call-2' }))).toMatch(/may bill per token/);
        expect(fs.readdirSync(approvedDir)).toEqual([]);
    });

    it('a future-dated approval marker is no approval', () => {
        spawnAsk(askDeps());
        ran();
        const approvedDir = path.join(home, 'state', 'quota', 'approved');
        for (const f of fs.readdirSync(approvedDir)) {
            const future = (NOW + 24 * 3600 * 1000) / 1000;
            fs.utimesSync(path.join(approvedDir, f), future, future);
        }
        expect(spawnApproved('sess-a', stateEnv, NOW)).toBe(false);
    });
});

describe('claimOnce', () => {
    it('is true exactly once per key and prunes claims older than eight days', () => {
        expect(claimOnce('k', stateEnv, NOW)).toBe(true);
        expect(claimOnce('k', stateEnv, NOW)).toBe(false);
        expect(claimOnce('k2', stateEnv, NOW + 9 * 24 * 3600 * 1000)).toBe(true);
        expect(claimOnce('k', stateEnv, NOW + 9 * 24 * 3600 * 1000)).toBe(true);
    });
});

describe('readBillingClass', () => {
    it('reads presence, never values', () => {
        expect(readBillingClass({ ANTHROPIC_API_KEY: 'sk-x' }, [])).toEqual({ billing_class: 'metered', source: 'ANTHROPIC_API_KEY' });
        expect(readBillingClass({ CLAUDE_CODE_USE_BEDROCK: '1' }, [])).toEqual({ billing_class: 'metered', source: 'CLAUDE_CODE_USE_BEDROCK' });
        expect(readBillingClass({ ANTHROPIC_API_KEY: '  ' }, [])).toEqual({ billing_class: 'plan', source: null });
    });

    it('an apiKeyHelper in a host settings file is metered', () => {
        const f = path.join(home, 'settings.json');
        fs.writeFileSync(f, JSON.stringify({ apiKeyHelper: '/bin/get-key' }));
        expect(readBillingClass({}, [path.join(home, 'missing.json'), f])).toEqual({ billing_class: 'metered', source: 'apiKeyHelper' });
    });
});

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runTap } from '../../../src/scripts/_cli/cmd_statusline.js';
import { exhaustedResetAt, planPressure, readPlanPressure } from '../../../src/scripts/_lib/pressure.js';
import {
    accountFromEnv,
    appendQuotaSnapshot,
    forAccount,
    readQuotaLedger,
    snapshotFromStatusPayload,
    type QuotaSnapshot,
} from '../../../src/scripts/_lib/quota_ledger.js';

const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);
const MIN = 60_000;
const RESET = Math.trunc((NOW + 180 * MIN) / 1000);

function snap(minAgo: number, pct: number, account?: string): QuotaSnapshot {
    return { ts: NOW - minAgo * MIN, session: 's', five_hour: { pct, resets_at: RESET }, ...(account !== undefined ? { account } : {}) };
}

function profileEnv(provider: string, name: string, extra: Record<string, string> = {}): Record<string, string> {
    return { CLAUDE_CONFIG_DIR: path.join('/u', '.agent-switch', provider, name, 'config'), ...extra };
}

describe('accountFromEnv', () => {
    it('names the agent-switch profile as provider/name', () => {
        expect(accountFromEnv(profileEnv('claude', 'Work'))).toBe('claude/Work');
        expect(accountFromEnv({ CODEX_HOME: '/u/.agent-switch/codex/private.2/config' })).toBe('codex/private.2');
    });

    it('is the default bucket outside a profile, and for a profile it cannot name', () => {
        expect(accountFromEnv({})).toBe('');
        expect(accountFromEnv({ CLAUDE_CONFIG_DIR: '/u/.claude' })).toBe('');
        expect(accountFromEnv({ CLAUDE_CONFIG_DIR: '/u/.agent-switch/claude' })).toBe('');
    });

    it('refuses a name that is not a plain label rather than storing it', () => {
        expect(accountFromEnv(profileEnv('claude', 'has space'))).toBe('');
        expect(accountFromEnv(profileEnv('claude', '.hidden'))).toBe('');
        expect(accountFromEnv(profileEnv('claude', 'x'.repeat(65)))).toBe('');
        expect(accountFromEnv(profileEnv('Claude!', 'ok'))).toBe('');
    });
});

describe('snapshotFromStatusPayload', () => {
    const payload = { session_id: 'abc', rate_limits: { five_hour: { used_percentage: 40, resets_at: RESET } } };

    it('carries the account it is given, and none for the default bucket', () => {
        expect(snapshotFromStatusPayload(payload, NOW, 'claude/Work')?.account).toBe('claude/Work');
        expect(snapshotFromStatusPayload(payload, NOW, '')).not.toHaveProperty('account');
        expect(snapshotFromStatusPayload(payload, NOW)).not.toHaveProperty('account');
    });

    it('drops an account that is not a valid label', () => {
        expect(snapshotFromStatusPayload(payload, NOW, '../etc/passwd')).not.toHaveProperty('account');
    });
});

describe('per-account pressure, two logins interleaved', () => {
    // Account a drains its window; account b barely uses its own. Their status
    // lines refresh alternately, so the newest line is always the other login's.
    const ledger = [
        snap(12, 70, 'claude/a'),
        snap(11, 8, 'claude/b'),
        snap(7, 76, 'claude/a'),
        snap(6, 9, 'claude/b'),
        snap(2, 82, 'claude/a'),
        snap(1, 10, 'claude/b'),
    ];

    it('each account reads its own verdict', () => {
        expect(planPressure(ledger, NOW, 'claude/a').worst.state).toBe('hot');
        expect(planPressure(ledger, NOW, 'claude/a').worst.fill).toBe(82);
        expect(planPressure(ledger, NOW, 'claude/b').worst.state).toBe('ok');
        expect(planPressure(ledger, NOW, 'claude/b').worst.fill).toBe(10);
    });

    it('the burn rate is measured within one account, not across the two', () => {
        const a = planPressure(ledger, NOW, 'claude/a').windows.find((w) => w.window === 'five_hour');
        expect(a?.burn_per_min).toBeCloseTo(1.2, 5);
    });

    it('the default login is its own bucket: unlabelled snapshots, never a profile', () => {
        const mixed = [...ledger, snap(3, 55)];
        expect(planPressure(mixed, NOW, '').worst.fill).toBe(55);
        expect(planPressure(ledger, NOW, '').worst.state).toBe('unknown');
    });

    it('forAccount keeps only the matching lines', () => {
        expect(forAccount(ledger, 'claude/b').map((s) => s.five_hour?.pct)).toEqual([8, 9, 10]);
    });

    it('an exhausted window of one account does not report a reset for the other', () => {
        const ex = [snap(2, 100, 'claude/a'), snap(1, 20, 'claude/b')];
        expect(exhaustedResetAt(forAccount(ex, 'claude/a'))).toBe(RESET);
        expect(exhaustedResetAt(forAccount(ex, 'claude/b'))).toBeNull();
    });
});

describe('the ledger on disk', () => {
    let home: string;
    beforeEach(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'quota-account-'));
    });
    afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

    it('readPlanPressure reads the account of the environment it is given', () => {
        const a = profileEnv('claude', 'a', { EVENT4U_CONFIG_HOME: home, HOME: home });
        const b = profileEnv('claude', 'b', { EVENT4U_CONFIG_HOME: home, HOME: home });
        for (const s of [snap(12, 70, 'claude/a'), snap(11, 8, 'claude/b'), snap(7, 76, 'claude/a'), snap(2, 82, 'claude/a'), snap(1, 10, 'claude/b')]) {
            appendQuotaSnapshot(s, a);
        }
        expect(readPlanPressure(a, NOW).worst.state).toBe('hot');
        expect(readPlanPressure(b, NOW).worst.state).toBe('ok');
        // The ledger itself stays whole: every account's lines are kept.
        expect(readQuotaLedger(a, NOW)).toHaveLength(5);
    });

    it('the status-line tap labels the snapshot with the profile it runs under', () => {
        const env = profileEnv('claude', 'Work', { EVENT4U_CONFIG_HOME: home, HOME: home });
        const stdin = JSON.stringify({ session_id: 's', rate_limits: { five_hour: { used_percentage: 12, resets_at: RESET } } });
        runTap({ stdin, env, now: NOW, run: () => '' });
        expect(readQuotaLedger(env, NOW).map((s) => s.account)).toEqual(['claude/Work']);
    });
});

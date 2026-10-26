import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    appendQuotaSnapshot,
    hashSessionId,
    QUOTA_LEDGER_RETENTION_MS,
    quotaLedgerPath,
    readQuotaLedger,
    snapshotFromStatusPayload,
} from '../../../src/scripts/_lib/quota_ledger.js';

let home: string;
let env: Record<string, string>;

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'quota-ledger-'));
    env = { EVENT4U_CONFIG_HOME: home };
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

const PAYLOAD = {
    session_id: 'abc-123',
    model: { id: 'claude-opus-5-5', display_name: 'Opus' },
    context_window: { context_window_size: 200000, used_percentage: 41.5 },
    rate_limits: {
        five_hour: { used_percentage: 63, resets_at: 1_761_400_000 },
        seven_day: { used_percentage: 12.5, resets_at: '2026-10-30T10:00:00Z' },
    },
};

describe('snapshotFromStatusPayload', () => {
    it('reads both windows, the context window and the model, and hashes the session', () => {
        const s = snapshotFromStatusPayload(PAYLOAD, 1000);
        expect(s).toEqual({
            ts: 1000,
            session: hashSessionId('abc-123'),
            five_hour: { pct: 63, resets_at: 1_761_400_000 },
            seven_day: { pct: 12.5, resets_at: Math.trunc(Date.parse('2026-10-30T10:00:00Z') / 1000) },
            context_used_pct: 41.5,
            context_size: 200000,
            model: 'claude-opus-5-5',
        });
        expect(JSON.stringify(s)).not.toContain('abc-123');
    });

    it('normalises a millisecond reset to seconds', () => {
        const s = snapshotFromStatusPayload({ rate_limits: { five_hour: { used_percentage: 1, resets_at: 1_761_400_000_000 } } });
        expect(s?.five_hour?.resets_at).toBe(1_761_400_000);
    });

    it('keeps a payload with only one window and no context', () => {
        const s = snapshotFromStatusPayload({ rate_limits: { seven_day: { used_percentage: 5 } } });
        expect(s?.seven_day).toEqual({ pct: 5, resets_at: null });
        expect(s?.five_hour).toBeUndefined();
    });

    it('returns null when nothing quota-relevant is present', () => {
        for (const p of [null, 'x', {}, { rate_limits: {} }, { rate_limits: { five_hour: { used_percentage: 'a' } } }]) {
            expect(snapshotFromStatusPayload(p), JSON.stringify(p)).toBeNull();
        }
    });
});

describe('ledger file', () => {
    it('round-trips appended snapshots oldest first, under the user-global root', () => {
        const now = Date.now();
        appendQuotaSnapshot({ ts: now - 10, session: 'b', five_hour: { pct: 2, resets_at: null } }, env);
        appendQuotaSnapshot({ ts: now - 20, session: 'a', five_hour: { pct: 1, resets_at: null } }, env);
        expect(quotaLedgerPath(env).startsWith(home)).toBe(true);
        expect(readQuotaLedger(env, now).map((s) => s.session)).toEqual(['a', 'b']);
    });

    it('drops expired and unreadable lines on read', () => {
        const now = Date.now();
        fs.mkdirSync(path.dirname(quotaLedgerPath(env)), { recursive: true });
        fs.writeFileSync(
            quotaLedgerPath(env),
            `${JSON.stringify({ ts: now - QUOTA_LEDGER_RETENTION_MS - 1, session: 'old' })}\nnot json\n${JSON.stringify({ ts: now, session: 'new' })}\n`,
        );
        expect(readQuotaLedger(env, now).map((s) => s.session)).toEqual(['new']);
    });

    it('a missing ledger reads as empty', () => {
        expect(readQuotaLedger(env)).toEqual([]);
    });

    it('prunes expired lines once the file grows past its bound', () => {
        const now = Date.now();
        const old = { ts: now - QUOTA_LEDGER_RETENTION_MS - 1000, session: 'x'.repeat(12), five_hour: { pct: 1, resets_at: null } };
        fs.mkdirSync(path.dirname(quotaLedgerPath(env)), { recursive: true });
        fs.writeFileSync(quotaLedgerPath(env), `${JSON.stringify(old)}\n`.repeat(5000));
        appendQuotaSnapshot({ ts: now, session: 'fresh', five_hour: { pct: 9, resets_at: null } }, env);
        const lines = fs.readFileSync(quotaLedgerPath(env), 'utf-8').trim().split('\n');
        expect(lines).toHaveLength(1);
        expect(JSON.parse(lines[0] ?? '{}').session).toBe('fresh');
    });
});

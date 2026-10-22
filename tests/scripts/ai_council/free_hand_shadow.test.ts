// Shadow mode: a free route answers beside the paid one, the paid answer is the
// one used, the head verifies both, and every call lands in a gitignored ledger.
// Loopback stubs only — nothing here reaches a provider.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CouncilResponse, type ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import {
    readShadowLedger,
    SHADOW_CALL_CAP,
    SHADOW_LEDGER_RELPATH,
    shadowAsk,
    shadowReport,
    type HeadVerify,
} from '../../../src/scripts/ai_council/free_hand_shadow.js';

const cleanups: (() => void)[] = [];
afterEach(() => {
    while (cleanups.length > 0) (cleanups.pop() as () => void)();
});

function tmpRoot(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'free-hand-shadow-'));
    cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
    return d;
}

function member(name: string, billing: string, text: string, error: string | null = null, tokens = 10): ExternalAIClient & { calls: number } {
    const m = {
        name,
        billing,
        billable: billing === 'per-token',
        calls: 0,
        ask: () => {
            m.calls += 1;
            return new CouncilResponse({ provider: name, model: 'm', text, error, input_tokens: tokens, output_tokens: 0 });
        },
    };
    return m as unknown as ExternalAIClient & { calls: number };
}

const PAID_ANSWER = '{"label":"paid","confidence":0.9}';
const FREE_ANSWER = '{"label":"free","confidence":0.4}';
const passAll: HeadVerify = () => ({ verdict: 'pass', tokens: 7 });
const base = { kind: 'classify' as const, contentClass: 'public-artifact' as const };

describe('shadowAsk', () => {
    it('uses the paid answer and ledgers a free and a paid answer, each with a verify result', async () => {
        const root = tmpRoot();
        const paid = member('paid1', 'per-token', PAID_ANSWER, null, 120);
        const free = member('free1', 'free-quota', FREE_ANSWER);
        for (let i = 0; i < 3; i++) {
            const r = await shadowAsk('q', { ...base, paid, free, verify: passAll, stateRoot: root });
            expect(r.answer?.answer).toBe(PAID_ANSWER);
        }
        const rows = readShadowLedger(root);
        expect(rows).toHaveLength(3);
        for (const row of rows) {
            expect(row.paid).toMatchObject({ route: 'paid1', billing: 'per-token', verified: 'pass', verify_tokens: 7, tokens: 120 });
            expect(row.free).toMatchObject({ route: 'free1', billing: 'free-quota', verified: 'pass', verify_tokens: 7 });
        }
        expect([paid.calls, free.calls]).toEqual([3, 3]);
    });

    it('a free side that fails or answers off-schema is a failed verify, never handed to the head', async () => {
        const root = tmpRoot();
        const seen: string[] = [];
        const verify: HeadVerify = (_k, _v, side) => {
            seen.push(side);
            return { verdict: 'pass', tokens: 7 };
        };
        await shadowAsk('q', { ...base, paid: member('p', 'per-token', PAID_ANSWER), free: member('f', 'free-quota', 'prose'), verify, stateRoot: root });
        await shadowAsk('q', { ...base, paid: member('p', 'per-token', PAID_ANSWER), free: member('f', 'free-quota', '', 'HTTP 429: slow'), verify, stateRoot: root });
        const rows = readShadowLedger(root);
        expect(rows.map((r) => [r.free.verified, r.free.outcome])).toEqual([
            ['fail', 'ok'],
            ['fail', 'rate_limited'],
        ]);
        expect(seen).toEqual(['paid', 'paid']);
    });

    it('never shadows on a metered free side, a project-content payload, or past the A5 cap', async () => {
        const root = tmpRoot();
        const paid = member('p', 'per-token', PAID_ANSWER);
        const metered = member('m', 'per-token', FREE_ANSWER);
        expect((await shadowAsk('q', { ...base, paid, free: metered, verify: passAll, stateRoot: root })).skipped).toBe('free-side-metered');
        const free = member('f', 'free-quota', FREE_ANSWER);
        expect((await shadowAsk('q', { ...base, contentClass: 'project-content', paid, free, verify: passAll, stateRoot: root })).skipped).toBe('content-ceiling');
        const file = path.join(root, SHADOW_LEDGER_RELPATH);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '{}\n'.repeat(SHADOW_CALL_CAP));
        const r = await shadowAsk('q', { ...base, paid, free, verify: passAll, stateRoot: root });
        expect(r.skipped).toBe('cap-reached');
        expect(r.answer?.answer).toBe(PAID_ANSWER);
        expect([metered.calls, free.calls]).toEqual([0, 0]);
    });

    it('the ledger carries no prompt and no answer text', async () => {
        const root = tmpRoot();
        await shadowAsk('the secret question', { ...base, paid: member('p', 'per-token', PAID_ANSWER), free: member('f', 'free-quota', FREE_ANSWER), verify: passAll, stateRoot: root });
        const raw = fs.readFileSync(path.join(root, SHADOW_LEDGER_RELPATH), 'utf8');
        expect(raw).not.toMatch(/secret|label|confidence/);
    });
});

describe('shadowReport', () => {
    it('per kind: both rates, tokens avoided, the head’s verify tokens, and the net per week', async () => {
        const root = tmpRoot();
        const verify: HeadVerify = (_k, v) => ({ verdict: (v as { label: string }).label === 'bad' ? 'fail' : 'pass', tokens: 5 });
        const paid = member('p', 'per-token', PAID_ANSWER, null, 100);
        await shadowAsk('q', { ...base, paid, free: member('f', 'free-quota', FREE_ANSWER), verify, stateRoot: root, now: () => new Date('2026-10-20T10:00:00Z') });
        await shadowAsk('q', { ...base, paid, free: member('f', 'free-quota', '{"label":"bad","confidence":0.1}'), verify, stateRoot: root, now: () => new Date('2026-10-21T10:00:00Z') });
        const [row] = shadowReport(readShadowLedger(root));
        expect(row).toMatchObject({ kind: 'classify', n: 2, free_rate: 0.5, paid_rate: 0, tokens_avoided: 100, verify_tokens: 10, net: 90 });
        expect(row!.weeks).toEqual([{ week: '2026-W43', net: 90 }]);
    });
});

// free-hands 6.2 — the rung-0.5 production path shadows a typed public-artifact
// ask on an admissible free route while the paid route serves it. The free
// return is ledgered, never returned, and never delays or alters the paid one.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { askHand } from '../../src/scripts/ask_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../src/scripts/ai_council/clients.js';
import { readShadowLedger, SHADOW_CALL_CAP, SHADOW_LEDGER_RELPATH } from '../../src/scripts/ai_council/free_hand_shadow.js';
import { KIND_FLIPS_RELPATH } from '../../src/scripts/ai_council/kind_flip.js';
import { ExposureLedger } from '../../src/scripts/ai_council/exposure_ledger.js';
import { handSystemPrompt } from '../../src/scripts/ai_council/hand_schemas.js';

const PAID_TEXT = '{"label":"timeout","confidence":0.8}';
const FREE_TEXT = '{"label":"network","confidence":0.4}';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-shadow-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

interface Stub {
    member: ExternalAIClient;
    calls: number;
    args: unknown[][];
}

function respond(provider: string, text: string): CouncilResponse {
    return new CouncilResponse({ provider, model: 'm', text, input_tokens: 30, output_tokens: 10, latency_ms: 1 });
}

function paidStub(opts: { error?: string } = {}): Stub {
    const s: Stub = { member: undefined as unknown as ExternalAIClient, calls: 0, args: [] };
    s.member = {
        name: 'anthropic',
        ask: (...args: unknown[]) => {
            s.calls++;
            s.args.push(args);
            if (opts.error !== undefined) {
                return new CouncilResponse({ provider: 'anthropic', model: 'm', text: '', error: opts.error });
            }
            return respond('anthropic', PAID_TEXT);
        },
    } as unknown as ExternalAIClient;
    return s;
}

function freeStub(opts: { throws?: boolean; hangs?: boolean } = {}): Stub {
    const s: Stub = { member: undefined as unknown as ExternalAIClient, calls: 0, args: [] };
    s.member = {
        name: 'free-route',
        billing: 'free-quota',
        base_url: 'http://127.0.0.1:1',
        model: 'free-model',
        ask: (...args: unknown[]) => {
            s.calls++;
            s.args.push(args);
            if (opts.throws === true) throw new Error('free route down');
            if (opts.hangs === true) return new Promise<never>(() => undefined);
            return Promise.resolve(respond('free-route', FREE_TEXT));
        },
    } as unknown as ExternalAIClient;
    return s;
}

const SLICE = { kind: 'classify' as const, spec: 'classify: ETIMEDOUT on connect' };

function base(members: ExternalAIClient[], contentClass: 'public-artifact' | 'project-content' = 'public-artifact') {
    return {
        members,
        contentClass,
        auditDir: path.join(tmp, 'audit'),
        stateRoot: tmp,
        shadowVerify: () => ({ verdict: 'pass' as const, tokens: 7 }),
    };
}

describe('askHand shadows a public-artifact typed ask on a free route (free-hands 6.2)', () => {
    it('(1) writes one ledger row with both verify results and returns exactly the paid answer', async () => {
        const paid = paidStub();
        const free = freeStub();
        const r = await askHand(SLICE, base([paid.member, free.member]));
        expect(r).not.toBeNull();
        expect(r!.answer).toBe(PAID_TEXT);
        expect(r!.parsed).toEqual({ label: 'timeout', confidence: 0.8 });
        expect(r!.member).toBe('anthropic');
        expect(JSON.stringify(r)).not.toContain('network');
        expect(paid.calls).toBe(1);
        expect(free.calls).toBe(1);
        const rows = readShadowLedger(tmp);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.kind).toBe('classify');
        expect(rows[0]!.paid).toMatchObject({ route: 'anthropic', schema_valid: true, verified: 'pass', verify_tokens: 7 });
        expect(rows[0]!.free).toMatchObject({ route: 'free-route', billing: 'free-quota', schema_valid: true, verified: 'pass' });
        expect(fs.existsSync(path.join(tmp, KIND_FLIPS_RELPATH))).toBe(false);
    });

    it('(2) project-content → no shadow call and the free route is never called', async () => {
        const paid = paidStub();
        const free = freeStub();
        const r = await askHand(SLICE, base([paid.member, free.member], 'project-content'));
        expect(r!.answer).toBe(PAID_TEXT);
        expect(free.calls).toBe(0);
        expect(readShadowLedger(tmp)).toHaveLength(0);
    });

    it('(3) ledger at the cap → no shadow call', async () => {
        const file = path.join(tmp, SHADOW_LEDGER_RELPATH);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const row = JSON.stringify({ ts: '2026-10-01T00:00:00Z', kind: 'classify', paid: {}, free: {} });
        fs.writeFileSync(file, `${Array.from({ length: SHADOW_CALL_CAP }, () => row).join('\n')}\n`);
        const paid = paidStub();
        const free = freeStub();
        const r = await askHand(SLICE, base([paid.member, free.member]));
        expect(r!.answer).toBe(PAID_TEXT);
        expect(paid.calls).toBe(1);
        expect(free.calls).toBe(0);
        expect(readShadowLedger(tmp)).toHaveLength(SHADOW_CALL_CAP);
    });

    it('(4) a throwing free route never reaches the caller; the ledger records the failure', async () => {
        const paid = paidStub();
        const free = freeStub({ throws: true });
        const r = await askHand(SLICE, base([paid.member, free.member]));
        expect(r!.answer).toBe(PAID_TEXT);
        expect(free.calls).toBe(1);
        const rows = readShadowLedger(tmp);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.free).toMatchObject({ outcome: 'other', schema_valid: false, verified: 'fail' });
        expect(rows[0]!.paid).toMatchObject({ schema_valid: true, verified: 'pass' });
    });

    it('(5) no admissible free route → no shadow call', async () => {
        const paid = paidStub();
        const free = freeStub();
        (free.member as unknown as Record<string, unknown>)['live'] = false;
        const r = await askHand(SLICE, base([paid.member, free.member]));
        expect(r!.answer).toBe(PAID_TEXT);
        expect(free.calls).toBe(0);
        expect(readShadowLedger(tmp)).toHaveLength(0);
    });

    it('no state root (--no-record) → no shadow call', async () => {
        const paid = paidStub();
        const free = freeStub();
        const r = await askHand(SLICE, { ...base([paid.member, free.member]), auditDir: null, stateRoot: null });
        expect(r!.answer).toBe(PAID_TEXT);
        expect(free.calls).toBe(0);
    });

    it('without an injected verify a return is recorded skipped, never passed', async () => {
        const paid = paidStub();
        const free = freeStub();
        const { shadowVerify: _v, ...opts } = base([paid.member, free.member]);
        await askHand(SLICE, opts);
        const rows = readShadowLedger(tmp);
        expect(rows[0]!.paid.verified).toBe('skipped');
        expect(rows[0]!.free.verified).toBe('skipped');
    });

    it('a never-resolving free route does not hold the paid answer past the shadow wait', async () => {
        const paid = paidStub();
        const free = freeStub({ hangs: true });
        const started = Date.now();
        const guard = new Promise<'stalled'>((resolve) => setTimeout(() => resolve('stalled'), 2000).unref());
        const r = await Promise.race([askHand(SLICE, { ...base([paid.member, free.member]), shadowWaitMs: 50 }), guard]);
        expect(r).not.toBe('stalled');
        expect((r as { answer: string }).answer).toBe(PAID_TEXT);
        expect(Date.now() - started).toBeLessThan(1500);
        expect(free.calls).toBe(1);
        expect(readShadowLedger(tmp)).toHaveLength(0);
    });

    it('the tee is sound: the paid member is asked once, with the same arguments both consumers send', async () => {
        const paid = paidStub();
        const free = freeStub();
        await askHand(SLICE, base([paid.member, free.member]));
        expect(paid.args).toHaveLength(1);
        expect(free.args).toHaveLength(1);
        expect(paid.args[0]).toEqual(free.args[0]);
        expect(paid.args[0]![0]).toBe(handSystemPrompt('classify'));
    });

    it('a shadow that skips inside shadowAsk records no exposure to the free route', async () => {
        // Torn lines: the candidate check reads zero rows, shadowAsk counts the cap.
        const file = path.join(tmp, SHADOW_LEDGER_RELPATH);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${Array.from({ length: SHADOW_CALL_CAP }, () => '{torn').join('\n')}\n`);
        const ledger = new ExposureLedger(null);
        const paid = paidStub();
        const free = freeStub();
        const r = await askHand(SLICE, {
            ...base([paid.member, free.member]),
            exposure: { ledger, exposes: { files: ['src/a.ts'], symbols: [] }, trackedFiles: 1000 },
        });
        expect(r!.answer).toBe(PAID_TEXT);
        expect(free.calls).toBe(0);
        expect(ledger.seen('free-route').files).toBe(0);
        expect(ledger.seen('anthropic').files).toBe(1);
    });

    it('a shadow call that is made records the exposure to the free route', async () => {
        const ledger = new ExposureLedger(null);
        const paid = paidStub();
        const free = freeStub();
        await askHand(SLICE, {
            ...base([paid.member, free.member]),
            exposure: { ledger, exposes: { files: ['src/a.ts'], symbols: [] }, trackedFiles: 1000 },
        });
        expect(free.calls).toBe(1);
        expect(ledger.seen('free-route').files).toBe(1);
    });

    it('a failing paid route keeps its failure path while the shadow runs; no free answer leaks', async () => {
        const baseline = await askHand(SLICE, { ...base([paidStub({ error: 'HTTP 503' }).member]), stateRoot: null });
        const paid = paidStub({ error: 'HTTP 503' });
        const free = freeStub();
        const r = await askHand(SLICE, base([paid.member, free.member]));
        expect(baseline).toBeNull();
        expect(r).toBeNull();
        expect(paid.calls).toBe(1);
        expect(free.calls).toBe(1);
        const rows = readShadowLedger(tmp);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.paid.schema_valid).toBe(false);
        expect(rows[0]!.free.schema_valid).toBe(true);
    });
});

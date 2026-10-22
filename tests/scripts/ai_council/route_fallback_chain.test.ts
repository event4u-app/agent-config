// A failed route hands the call to the next route in the chooser's order, once,
// through `MidFlightFallback`: a call that may have been generated and charged
// (a server fault on a paid route) is never paid for a second time.

import { describe, expect, it } from 'vitest';

import { askOnce } from '../../../src/scripts/ask_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { chooseRouteChain } from '../../../src/scripts/ai_council/route_chooser.js';

const ANSWER = '{"label":"x","confidence":0.5}';

interface Stub {
    readonly member: ExternalAIClient;
    calls: number;
}

function stub(name: string, billing: string, error: string | null): Stub {
    const s: Stub = {
        calls: 0,
        member: {
            name,
            billing,
            billable: billing === 'per-token',
            ask: () => {
                s.calls += 1;
                return new CouncilResponse({ provider: name, model: 'm', text: error === null ? ANSWER : '', error, input_tokens: 1, output_tokens: 1 });
            },
        } as unknown as ExternalAIClient,
    };
    return s;
}

const typed = { kind: 'classify' as const, contentClass: 'public-artifact' as const, auditDir: null, flips: () => true };

describe('chooseRouteChain — the order the fallback walks', () => {
    it('admissible unpaid routes first, then paid ones; refused routes are not in it', () => {
        const c = chooseRouteChain({
            kind: 'classify',
            contentClass: 'public-artifact',
            candidates: [
                { name: 'paid', billing: 'per-token', ceiling: 'project-content', remainingQuota: null, live: true },
                { name: 'dead', billing: 'free-quota', ceiling: 'public-artifact', remainingQuota: null, live: false },
                { name: 'free', billing: 'free-quota', ceiling: 'public-artifact', remainingQuota: null, live: true },
            ],
        });
        expect(c.chain.map((r) => r.name)).toEqual(['free', 'paid']);
        expect(c.refused).toEqual([{ name: 'dead', reason: 'not-live' }]);
    });
});

describe('askOnce — one retry down the chain', () => {
    it('a first route that fails serves the call from the second', async () => {
        for (const error of ['HTTP 404: {"error":"model not found"}', 'HTTP 429: slow down']) {
            const free = stub('free1', 'free-quota', error);
            const paid = stub('paid1', 'per-token', null);
            const r = await askOnce('q', { ...typed, members: [free.member, paid.member] });
            expect(r?.member).toBe('paid1');
            expect([free.calls, paid.calls]).toEqual([1, 1]);
        }
    });

    it('a repeated failure yields an honest ∅ and no third call', async () => {
        const a = stub('free1', 'free-quota', 'HTTP 429: slow down');
        const b = stub('free2', 'free-quota', 'HTTP 429: slow down');
        const c = stub('paid1', 'per-token', 'HTTP 429: slow down');
        expect(await askOnce('q', { ...typed, members: [a.member, b.member, c.member] })).toBeNull();
        expect([a.calls, b.calls, c.calls]).toEqual([1, 1, 0]);
    });

    it('a paid route whose call may have been charged is never followed by a second paid call', async () => {
        const first = stub('paid1', 'per-token', 'HTTP 503: upstream overloaded');
        const second = stub('paid2', 'per-token', null);
        expect(await askOnce('q', { members: [first.member, second.member], contentClass: 'public-artifact', auditDir: null })).toBeNull();
        expect([first.calls, second.calls]).toEqual([1, 0]);
    });

    it('an empty quota on a paid route is a cap, not a fault: it does not fall through', async () => {
        const first = stub('paid1', 'per-token', 'HTTP 429: {"error":{"code":"insufficient_quota"}}');
        const second = stub('paid2', 'per-token', null);
        expect(await askOnce('q', { members: [first.member, second.member], contentClass: 'public-artifact', auditDir: null })).toBeNull();
        expect(second.calls).toBe(0);
    });
});

import { describe, expect, it } from 'vitest';

import { askOnce } from '../../src/scripts/ask_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../src/scripts/ai_council/clients.js';
import { CONTENT_CLASSES } from '../../src/scripts/ai_council/content_ceiling.js';
import {
    chooseRoute,
    routeCandidateFromMember,
    type RouteCandidate,
} from '../../src/scripts/ai_council/route_chooser.js';
import { HAND_KINDS, HEAD_ONLY_KINDS } from '../../src/scripts/_lib/hand_kinds.js';

function free(name: string, remainingQuota: number | null, extra: Partial<RouteCandidate> = {}): RouteCandidate {
    return { name, billing: 'free-quota', ceiling: 'public-artifact', remainingQuota, live: true, ...extra };
}
const PAID: RouteCandidate = {
    name: 'paid',
    billing: 'subscription',
    ceiling: 'project-content',
    remainingQuota: null,
    live: true,
};

describe('chooseRoute — table over kind × class × quota', () => {
    const kinds = [...HAND_KINDS, null, ...HEAD_ONLY_KINDS] as const;
    const quotas = [0, null, 5] as const;
    for (const kind of kinds) {
        for (const contentClass of CONTENT_CLASSES) {
            for (const quota of quotas) {
                it(`${String(kind)} · ${contentClass} · quota ${String(quota)}`, () => {
                    const choice = chooseRoute({ kind, contentClass, candidates: [free('free', quota), PAID] });
                    const headOnly = (HEAD_ONLY_KINDS as readonly unknown[]).includes(kind);
                    const freeAdmissible = kind !== null && !headOnly && contentClass === 'public-artifact' && quota !== 0;
                    if (headOnly) {
                        expect(choice.route).toBeNull();
                        expect(choice.reason).toBe('head-only');
                    } else if (freeAdmissible) {
                        expect(choice.route?.name).toBe('free');
                    } else {
                        expect(choice.route?.name).toBe('paid');
                    }
                });
            }
        }
    }

    it('a project-content payload never lands on a public-artifact route, even when it is the only one', () => {
        for (const kind of [...HAND_KINDS, null]) {
            for (const quota of quotas) {
                const choice = chooseRoute({ kind, contentClass: 'project-content', candidates: [free('only', quota)] });
                expect(choice.route).toBeNull();
                expect(choice.reason).toBe('no-admissible-route');
            }
        }
    });

    it('order: admissible free route, then paid fallback, then honest ∅', () => {
        const dead = free('dead', 9, { live: false });
        expect(chooseRoute({ kind: 'classify', contentClass: 'public-artifact', candidates: [PAID, dead, free('f', 3)] }).route?.name).toBe('f');
        expect(chooseRoute({ kind: 'classify', contentClass: 'public-artifact', candidates: [dead, PAID] }).route?.name).toBe('paid');
        expect(chooseRoute({ kind: 'classify', contentClass: 'public-artifact', candidates: [dead, { ...PAID, live: false }] }).route).toBeNull();
    });

    it('prefers the free route with more remaining quota, and a known quota over an unknown one', () => {
        const c = chooseRoute({
            kind: 'extract',
            contentClass: 'public-artifact',
            candidates: [free('unknown', null), free('low', 2), free('high', 40)],
        });
        expect(c.route?.name).toBe('high');
    });
});

describe('routeCandidateFromMember — the wiring point to the member list', () => {
    it('a free-quota member is public-artifact whatever ceiling it declares', () => {
        const m = { name: 'freebie', billable: false, billing_class: 'free-quota', content_ceiling: 'project-content' };
        expect(routeCandidateFromMember(m as unknown as ExternalAIClient)).toMatchObject({
            billing: 'free-quota',
            ceiling: 'public-artifact',
        });
    });

    it('reads a base_url route member’s `billing` field the same way', () => {
        const m = { name: 'route1', billable: false, billing: 'free-quota' };
        expect(routeCandidateFromMember(m as unknown as ExternalAIClient)).toMatchObject({
            billing: 'free-quota',
            ceiling: 'public-artifact',
        });
        const local = { name: 'local1', billable: false, billing: 'self-hosted' };
        expect(routeCandidateFromMember(local as unknown as ExternalAIClient).ceiling).toBe('public-artifact');
    });

    it('a member declaring nothing keeps today’s seat: paid, project-content, live', () => {
        const m = { name: 'anthropic', billable: false };
        expect(routeCandidateFromMember(m as unknown as ExternalAIClient)).toEqual({
            name: 'anthropic',
            billing: 'subscription',
            ceiling: 'project-content',
            remainingQuota: null,
            live: true,
        });
    });
});

describe('askOnce routes by the chooser, never by list order', () => {
    function member(name: string, fields: Record<string, unknown>, text: string): ExternalAIClient {
        return {
            name,
            billable: true,
            ...fields,
            ask: () => new CouncilResponse({ provider: name, model: 'm', text, input_tokens: 1, output_tokens: 1 }),
        } as unknown as ExternalAIClient;
    }
    const freeMember = member('free1', { billing_class: 'free-quota' }, '{"label":"x","confidence":0.5}');
    const paidMember = member('paid1', {}, '{"label":"y","confidence":0.5}');

    it('a typed public-artifact call goes to the free route', async () => {
        const r = await askOnce('q', { members: [paidMember, freeMember], kind: 'classify', contentClass: 'public-artifact', auditDir: null });
        expect(r?.member).toBe('free1');
    });

    it('a project-content call skips the free route although it is listed first', async () => {
        const r = await askOnce('q', { members: [freeMember, paidMember], kind: 'classify', contentClass: 'project-content', auditDir: null });
        expect(r?.member).toBe('paid1');
    });

    it('an untyped ask never reaches a free route', async () => {
        const r = await askOnce('q', { members: [freeMember, paidMember], contentClass: 'public-artifact', auditDir: null });
        expect(r?.member).toBe('paid1');
    });
});

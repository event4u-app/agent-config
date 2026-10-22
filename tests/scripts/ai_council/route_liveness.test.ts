// Liveness counts streaks per route+model: a throttle or an empty quota marks a
// route absent for the pass and never counts; three consecutive unservable
// answers retire the model from the discovered roster until it is re-discovered.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { askOnce } from '../../../src/scripts/ask_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { ROUTE_MODELS_RELPATH, readRouteRoster } from '../../../src/scripts/ai_council/free_route_catalog.js';
import {
    classifyRouteOutcome,
    isRouteModelLive,
    recordRouteOutcome,
    RETIRE_STREAK,
    ROUTE_LIVENESS_RELPATH,
} from '../../../src/scripts/ai_council/route_liveness.js';

const cleanups: (() => void)[] = [];
afterEach(() => {
    while (cleanups.length > 0) (cleanups.pop() as () => void)();
});

function tmpRoot(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'route-liveness-'));
    cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
    return d;
}

function seedRoster(root: string, route: string, models: string[], observedAt: string): void {
    const file = path.join(root, ROUTE_MODELS_RELPATH);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ [route]: { base_url: 'http://127.0.0.1:1/v1', models, observed_at: observedAt } }));
}

const T0 = '2026-10-22T10:00:00.000Z';
const at = (min: number): Date => new Date(Date.parse(T0) + min * 60_000);

describe('classifyRouteOutcome — the route HTTP outcome in the shared failure vocabulary', () => {
    it.each([
        [null, 'ok'],
        ['HTTP 429: {"error":{"message":"Rate limit reached, retry after 20s"}}', 'rate_limited'],
        ['HTTP 429: {"error":{"code":"insufficient_quota"}}', 'quota_exhausted'],
        ['HTTP 404: {"error":{"message":"The model `m-1` does not exist"}}', 'model_unservable'],
        ['HTTP 410: gone', 'model_unservable'],
        ['HTTP 404: <html>not here</html>', 'other'],
        ['HTTP 503: upstream overloaded', 'server_error'],
        ['HTTP 501: not implemented', 'other'],
        ['policy_unproven_cost: the route answered 402', 'billing'],
        ['policy_model_mismatch: requested a, served b', 'other'],
        ['curl exited 7: connection refused', 'other'],
    ])('%s → %s', (error, expected) => {
        expect(classifyRouteOutcome(error)).toBe(expected);
    });
});

describe('streaks per route+model', () => {
    it(`${RETIRE_STREAK} seeded model_unservable results retire the model from the roster`, () => {
        const root = tmpRoot();
        seedRoster(root, 'hands', ['m-1', 'm-2'], T0);
        for (let i = 1; i <= RETIRE_STREAK; i++) recordRouteOutcome(root, 'hands', 'm-1', 'model_unservable', at(i));
        expect(isRouteModelLive(root, 'hands', 'm-1')).toBe(false);
        const roster = readRouteRoster(root, 'hands');
        expect(roster.status === 'known' && roster.models).toEqual(['m-2']);
        expect(isRouteModelLive(root, 'hands', 'm-2')).toBe(true);
    });

    it(`${RETIRE_STREAK} rate_limited (and quota or server) results do not retire, and do not break a streak`, () => {
        const root = tmpRoot();
        seedRoster(root, 'hands', ['m-1'], T0);
        for (const outcome of ['rate_limited', 'quota_exhausted', 'server_error'] as const) {
            for (let i = 1; i <= RETIRE_STREAK; i++) {
                expect(recordRouteOutcome(root, 'hands', 'm-1', outcome, at(i)).absentForPass).toBe(true);
            }
        }
        expect(isRouteModelLive(root, 'hands', 'm-1')).toBe(true);
        const roster = readRouteRoster(root, 'hands');
        expect(roster.status === 'known' && roster.models).toEqual(['m-1']);
    });

    it('an answered call resets the streak; only consecutive unservable answers count', () => {
        const root = tmpRoot();
        seedRoster(root, 'hands', ['m-1'], T0);
        recordRouteOutcome(root, 'hands', 'm-1', 'model_unservable', at(1));
        recordRouteOutcome(root, 'hands', 'm-1', 'model_unservable', at(2));
        recordRouteOutcome(root, 'hands', 'm-1', 'ok', at(3));
        recordRouteOutcome(root, 'hands', 'm-1', 'model_unservable', at(4));
        expect(recordRouteOutcome(root, 'hands', 'm-1', 'model_unservable', at(5)).streak).toBe(2);
        expect(isRouteModelLive(root, 'hands', 'm-1')).toBe(true);
    });

    it('a re-discovery after the retirement brings the model back with a fresh streak', () => {
        const root = tmpRoot();
        seedRoster(root, 'hands', ['m-1'], T0);
        for (let i = 1; i <= RETIRE_STREAK; i++) recordRouteOutcome(root, 'hands', 'm-1', 'model_unservable', at(i));
        expect(isRouteModelLive(root, 'hands', 'm-1')).toBe(false);
        seedRoster(root, 'hands', ['m-1'], at(60).toISOString());
        expect(isRouteModelLive(root, 'hands', 'm-1')).toBe(true);
        expect(recordRouteOutcome(root, 'hands', 'm-1', 'model_unservable', at(61)).streak).toBe(1);
    });

    it('the store carries no free-text field', () => {
        const root = tmpRoot();
        recordRouteOutcome(root, 'hands', 'm-1', 'model_unservable', at(1));
        const raw = JSON.parse(fs.readFileSync(path.join(root, ROUTE_LIVENESS_RELPATH), 'utf8')) as Record<string, Record<string, object>>;
        expect(Object.keys(raw['hands']!['m-1']!).sort()).toEqual(['last', 'observed_at', 'streak']);
    });
});

describe('the chooser sees a retired model as not live', () => {
    function routeMember(name: string, billing: string, model: string, answer: string): ExternalAIClient {
        return {
            name,
            model,
            base_url: 'http://127.0.0.1:1/v1',
            billing,
            billable: billing === 'per-token',
            ask: () => new CouncilResponse({ provider: name, model, text: answer, input_tokens: 1, output_tokens: 1 }),
        } as unknown as ExternalAIClient;
    }

    it('a typed call skips the retired free model and is served by the paid route', async () => {
        const root = tmpRoot();
        seedRoster(root, 'free1', ['m-1'], T0);
        const free = routeMember('free1', 'free-quota', 'm-1', '{"label":"x","confidence":0.5}');
        const paid = routeMember('paid1', 'per-token', 'p-1', '{"label":"y","confidence":0.5}');
        const opts = { members: [free, paid], kind: 'classify' as const, contentClass: 'public-artifact' as const, auditDir: null, stateRoot: root };
        expect((await askOnce('q', opts))?.member).toBe('free1');
        for (let i = 1; i <= RETIRE_STREAK; i++) recordRouteOutcome(root, 'free1', 'm-1', 'model_unservable', at(i));
        expect((await askOnce('q', opts))?.member).toBe('paid1');
    });
});

// A hand kind moves to the free route only when both pre-registered bars clear
// on shadow data; missing or underpowered data is "not ready", never a flip. A
// flipped kind whose free-routed asks breach the escalation kill reverts on its
// own, and the reversion is recorded.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { askOnce } from '../../../src/scripts/ask_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import type { KindShadowStats } from '../../../src/scripts/ai_council/free_hand_shadow.js';
import {
    applyFlips,
    ESCALATION_KILL,
    flipVerdict,
    isKindFlipped,
    KIND_FLIPS_RELPATH,
    MIN_SHADOW_PER_KIND,
    observationsFromAuditLines,
    REVERT_MIN_SAMPLE,
    type FreeObservation,
} from '../../../src/scripts/ai_council/kind_flip.js';

const cleanups: (() => void)[] = [];
afterEach(() => {
    while (cleanups.length > 0) (cleanups.pop() as () => void)();
});

function tmpRoot(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kind-flip-'));
    cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
    return d;
}

function stats(over: Partial<KindShadowStats> = {}): KindShadowStats {
    return {
        kind: 'classify',
        n: MIN_SHADOW_PER_KIND,
        free_rate: 0.1,
        paid_rate: 0.08,
        tokens_avoided: 5000,
        verify_tokens: 1000,
        net: 4000,
        weeks: [
            { week: '2026-W43', net: 2000 },
            { week: '2026-W44', net: 2000 },
        ],
        ...over,
    };
}

function observations(kind: 'classify', n: number, failed: number, ts = '2026-11-02T10:00:00.000Z'): FreeObservation[] {
    return Array.from({ length: n }, (_, i) => ({ kind, verified: i < failed ? ('fail' as const) : ('pass' as const), ts }));
}

const T_FLIP = new Date('2026-11-01T00:00:00Z');
const T_LATER = new Date('2026-11-08T00:00:00Z');

describe('flipVerdict — both bars on shadow data, never on missing data', () => {
    it('clears when quality and net relief both hold', () => {
        expect(flipVerdict(stats())).toEqual({ ready: true, reasons: [] });
    });

    it.each<[string, KindShadowStats | undefined, RegExp]>([
        ['no shadow data', undefined, /no shadow data/],
        ['underpowered', stats({ n: MIN_SHADOW_PER_KIND - 1 }), /underpowered/],
        ['free worse than paid by more than 5 pp', stats({ free_rate: 0.14, paid_rate: 0.08 }), /margin/],
        ['at the kill', stats({ free_rate: ESCALATION_KILL, paid_rate: 0.29 }), /kill/],
        ['a week with no net relief', stats({ weeks: [{ week: '2026-W43', net: 10 }, { week: '2026-W44', net: 0 }] }), /relief/],
        ['no week at all', stats({ weeks: [] }), /relief/],
    ])('not ready: %s', (_name, s, why) => {
        const v = flipVerdict(s);
        expect(v.ready).toBe(false);
        expect(v.reasons.join(' ')).toMatch(why);
    });
});

describe('applyFlips', () => {
    it('flips a ready kind and nothing else', () => {
        const root = tmpRoot();
        const events = applyFlips(root, { shadow: [stats(), stats({ kind: 'extract', n: 3 })], live: [], now: T_FLIP });
        expect(events.map((e) => [e.kind, e.to])).toEqual([['classify', 'free']]);
        expect(isKindFlipped(root, 'classify')).toBe(true);
        expect(isKindFlipped(root, 'extract')).toBe(false);
    });

    it('a seeded breach above the kill flips the kind back to the paid route, and records it', () => {
        const root = tmpRoot();
        applyFlips(root, { shadow: [stats()], live: [], now: T_FLIP });
        const failed = Math.ceil(REVERT_MIN_SAMPLE * (ESCALATION_KILL + 0.1));
        const events = applyFlips(root, { shadow: [stats()], live: observations('classify', REVERT_MIN_SAMPLE, failed), now: T_LATER });
        expect(events.map((e) => [e.kind, e.to])).toEqual([['classify', 'paid']]);
        expect(isKindFlipped(root, 'classify')).toBe(false);
        expect(events[0]!.line).toMatch(/^free-hands-quality-held: classify reverted to the paid route on 2026-11-08 /);
        const store = JSON.parse(fs.readFileSync(path.join(root, KIND_FLIPS_RELPATH), 'utf8')) as { events: { to: string; line: string }[] };
        expect(store.events.map((e) => e.to)).toEqual(['free', 'paid']);
        expect(store.events[1]!.line).toBe(events[0]!.line);
    });

    it('a reverted kind does not flip again on the same shadow data', () => {
        const root = tmpRoot();
        applyFlips(root, { shadow: [stats()], live: [], now: T_FLIP });
        applyFlips(root, { shadow: [stats()], live: observations('classify', REVERT_MIN_SAMPLE, REVERT_MIN_SAMPLE), now: T_LATER });
        expect(applyFlips(root, { shadow: [stats()], live: [], now: new Date('2026-11-09T00:00:00Z') })).toEqual([]);
        expect(isKindFlipped(root, 'classify')).toBe(false);
    });

    it('below the kill, or on too few free-routed asks, a flipped kind stays flipped', () => {
        const root = tmpRoot();
        applyFlips(root, { shadow: [stats()], live: [], now: T_FLIP });
        applyFlips(root, { shadow: [stats()], live: observations('classify', REVERT_MIN_SAMPLE, 1), now: T_LATER });
        applyFlips(root, { shadow: [stats()], live: observations('classify', REVERT_MIN_SAMPLE - 1, REVERT_MIN_SAMPLE - 1), now: T_LATER });
        expect(isKindFlipped(root, 'classify')).toBe(true);
    });

    it('reads free-routed asks from orchestration audit lines', () => {
        const line = (billing: string, verified: string): Record<string, unknown> => ({
            ts: '2026-11-02T10:00:00.000Z',
            orchestration: { route_taken: 'ask', hand_kind: 'classify', route_billing: billing, verified },
        });
        expect(observationsFromAuditLines([line('free-quota', 'fail'), line('per-token', 'pass'), line('self-hosted', 'skipped')])).toEqual([
            { kind: 'classify', verified: 'fail', ts: '2026-11-02T10:00:00.000Z' },
            { kind: 'classify', verified: 'skipped', ts: '2026-11-02T10:00:00.000Z' },
        ]);
    });
});

describe('askOnce routes a typed ask to a free route only for a flipped kind', () => {
    function member(name: string, billing: string): ExternalAIClient {
        return {
            name,
            billing,
            billable: billing === 'per-token',
            ask: () => new CouncilResponse({ provider: name, model: 'm', text: '{"label":"x","confidence":0.5}', input_tokens: 1, output_tokens: 1 }),
        } as unknown as ExternalAIClient;
    }
    const members = [member('free1', 'free-quota'), member('paid1', 'per-token')];
    const typed = { members, kind: 'classify' as const, contentClass: 'public-artifact' as const, auditDir: null };

    it('missing flip state is not ready: the paid route serves', async () => {
        expect((await askOnce('q', { ...typed, stateRoot: tmpRoot() }))?.member).toBe('paid1');
    });

    it('a flipped kind is served by the free route; a reverted one by the paid route again', async () => {
        const root = tmpRoot();
        applyFlips(root, { shadow: [stats()], live: [], now: T_FLIP });
        expect((await askOnce('q', { ...typed, stateRoot: root }))?.member).toBe('free1');
        applyFlips(root, { shadow: [stats()], live: observations('classify', REVERT_MIN_SAMPLE, REVERT_MIN_SAMPLE), now: T_LATER });
        expect((await askOnce('q', { ...typed, stateRoot: root }))?.member).toBe('paid1');
    });
});

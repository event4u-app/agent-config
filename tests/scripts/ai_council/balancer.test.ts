// Tests for src/scripts/ai_council/balancer.ts (provider budget balancer v1).
//
// The ranking is pure: config + ledger snapshot + now go in, an ordered
// member list comes out. No filesystem, no clock — everything injected.
// The debate exemption is structural (the balancer is only wired into
// the solo-dispatch path in council_cli._apply_solo_dispatch); these
// tests cover the ranking policy and the balance-off passthrough.
import { describe, expect, it } from 'vitest';

import {
    balanced_fallback_chain,
    budget_standing,
    is_billable_member,
    rank_members_for_solo,
    type LedgerSnapshot,
} from '../../../src/scripts/ai_council/balancer.js';
import type { RollingWindowState } from '../../../src/scripts/ai_council/clients.js';
import { _build_config, type CouncilConfig, type Json } from '../../../src/scripts/ai_council/config.js';

const NOW = new Date('2026-07-10T12:00:00Z');

/** Build a real CouncilConfig through the loader (same validation path). */
function make_config(overrides: Record<string, Json> = {}): CouncilConfig {
    const raw: Record<string, Json> = {
        enabled: true,
        defaults: { mode: 'cli' },
        members: {
            anthropic: { enabled: true, model: 'claude-x' },
            openai: { enabled: true, model: 'gpt-x' },
            gemini: { enabled: true, model: 'gemini-x' },
            xai: { enabled: true, model: 'grok-x', api_key_ref: 'env:XAI_KEY' },
        },
        ...overrides,
    };
    return _build_config(raw, '/tmp/test.yml');
}

function ledger(
    daily: Record<string, number> = {},
    rolling: Record<string, RollingWindowState> = {},
): LedgerSnapshot {
    return { daily, rolling };
}

/** window_start `hours` before NOW. */
function started(hours: number): string {
    return new Date(NOW.getTime() - hours * 3600 * 1000).toISOString();
}

describe('balancer — is_billable_member', () => {
    it('vendor cli + manual are free; community cli + api are billable', () => {
        const c = make_config({
            defaults: { mode: 'cli' },
            members: {
                anthropic: { enabled: true, model: 'm' },
                xai: { enabled: true, model: 'm', api_key_ref: 'env:K' },
                openai: { enabled: true, model: 'm', mode: 'api', api_key_ref: 'env:K' },
                gemini: { enabled: true, model: 'm', mode: 'manual' },
            },
        });
        expect(is_billable_member('anthropic', c)).toBe(false); // vendor cli
        expect(is_billable_member('xai', c)).toBe(true); // community cli wrapper
        expect(is_billable_member('openai', c)).toBe(true); // api
        expect(is_billable_member('gemini', c)).toBe(false); // manual
    });
});

describe('balancer — budget_standing', () => {
    it('rolling budget wins over the daily cap; expiry resets used to 0', () => {
        const c = make_config({
            cli_call_budget: { max_calls_per_day: { anthropic: 10 } },
            provider_budgets: { anthropic: { window: '5h', max_calls: 4 } },
        });
        const inWindow = budget_standing(
            'anthropic',
            c,
            ledger({ anthropic: 9 }, { anthropic: { window_start: started(1), used: 3 } }),
            NOW,
        );
        expect(inWindow).toMatchObject({ kind: 'rolling', used: 3, limit: 4, remaining: 1 });
        const expired = budget_standing(
            'anthropic',
            c,
            ledger({ anthropic: 9 }, { anthropic: { window_start: started(6), used: 3 } }),
            NOW,
        );
        expect(expired).toMatchObject({ kind: 'rolling', used: 0, remaining: 4, ratio: 1.0 });
    });

    it('daily cap applies without a rolling budget; no budget → ratio 1.0', () => {
        const c = make_config({ cli_call_budget: { max_calls_per_day: { anthropic: 10 } } });
        expect(budget_standing('anthropic', c, ledger({ anthropic: 4 }), NOW)).toMatchObject({
            kind: 'utc-day',
            used: 4,
            remaining: 6,
            ratio: 0.6,
        });
        expect(budget_standing('openai', c, ledger(), NOW)).toEqual({
            kind: null,
            used: 0,
            limit: null,
            remaining: null,
            ratio: 1.0,
        });
    });
});

describe('balancer — rank_members_for_solo', () => {
    it('non-billable partition first, then billable', () => {
        const c = make_config({
            provider_budgets: {
                // xai (billable community cli) has MORE headroom than the
                // vendor CLIs — billability still wins over ratio.
                xai: { window: '1d', max_calls: 100 },
                anthropic: { window: '5h', max_calls: 10 },
            },
        });
        const l = ledger({}, { anthropic: { window_start: started(1), used: 5 } });
        const ranked = rank_members_for_solo(['xai', 'anthropic', 'openai'], c, l, NOW);
        // openai/anthropic (non-billable) before xai (billable) despite
        // xai's untouched budget.
        expect(ranked).toEqual(['openai', 'anthropic', 'xai']);
    });

    it('ranks by remaining-ratio descending within a partition', () => {
        const c = make_config({
            provider_budgets: {
                anthropic: { window: '5h', max_calls: 10 },
                openai: { window: '5h', max_calls: 10 },
                gemini: { window: '5h', max_calls: 10 },
            },
        });
        const l = ledger(
            {},
            {
                anthropic: { window_start: started(1), used: 8 }, // ratio 0.2
                openai: { window_start: started(1), used: 2 }, // ratio 0.8
                gemini: { window_start: started(1), used: 5 }, // ratio 0.5
            },
        );
        expect(rank_members_for_solo(['anthropic', 'openai', 'gemini'], c, l, NOW)).toEqual([
            'openai',
            'gemini',
            'anthropic',
        ]);
    });

    it('drops exhausted members; empty result when everything is exhausted', () => {
        const c = make_config({
            provider_budgets: {
                anthropic: { window: '5h', max_calls: 2 },
                openai: { window: '5h', max_calls: 2 },
            },
        });
        const l = ledger(
            {},
            {
                anthropic: { window_start: started(1), used: 2 },
                openai: { window_start: started(1), used: 1 },
            },
        );
        expect(rank_members_for_solo(['anthropic', 'openai'], c, l, NOW)).toEqual(['openai']);
        const allGone = ledger(
            {},
            {
                anthropic: { window_start: started(1), used: 2 },
                openai: { window_start: started(1), used: 2 },
            },
        );
        expect(rank_members_for_solo(['anthropic', 'openai'], c, allGone, NOW)).toEqual([]);
    });

    it('utc-day exhaustion drops a daily-capped member too', () => {
        const c = make_config({ cli_call_budget: { max_calls_per_day: { anthropic: 3 } } });
        const l = ledger({ anthropic: 3 });
        expect(rank_members_for_solo(['anthropic', 'openai'], c, l, NOW)).toEqual(['openai']);
    });

    it('unknown-budget members keep configured order, after a known ratio 1.0', () => {
        const c = make_config({
            provider_budgets: { gemini: { window: '5h', max_calls: 10 } },
        });
        // gemini has a KNOWN ratio of 1.0 (no calls yet); anthropic/openai
        // are unknown → also 1.0, but stable-sorted after gemini and in
        // configured order relative to each other.
        const ranked = rank_members_for_solo(['anthropic', 'openai', 'gemini'], c, ledger(), NOW);
        expect(ranked).toEqual(['gemini', 'anthropic', 'openai']);
    });

    it('all-unknown chain is a pure passthrough (stable order)', () => {
        const c = make_config();
        expect(rank_members_for_solo(['openai', 'anthropic', 'gemini'], c, ledger(), NOW)).toEqual(
            ['openai', 'anthropic', 'gemini'],
        );
    });
});

describe('balancer — balanced_fallback_chain', () => {
    it('balance: off returns the configured chain verbatim', () => {
        const c = make_config({
            routing: { solo_member_fallback_chain: ['anthropic', 'openai'], balance: 'off' },
            provider_budgets: { anthropic: { window: '5h', max_calls: 1 } },
        });
        const l = ledger({}, { anthropic: { window_start: started(1), used: 1 } });
        // Even with anthropic exhausted, off = verbatim configured order.
        expect(balanced_fallback_chain(c, l, NOW)).toEqual(['anthropic', 'openai']);
    });

    it('balance: on (default) reorders and drops exhausted members', () => {
        const c = make_config({
            routing: { solo_member_fallback_chain: ['anthropic', 'openai'] },
            provider_budgets: { anthropic: { window: '5h', max_calls: 1 } },
        });
        const l = ledger({}, { anthropic: { window_start: started(1), used: 1 } });
        expect(c.routing.balance).toBe(true);
        expect(balanced_fallback_chain(c, l, NOW)).toEqual(['openai']);
    });
});

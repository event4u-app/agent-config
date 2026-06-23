import { describe, expect, it } from 'vitest';

import { resolveSubagentRouting } from '../../src/scripts/_lib/subagent_routing.js';
import type { RoutingInputs } from '../../src/scripts/_lib/subagent_routing.js';

const base: RoutingInputs = {
    task_tier: 'medium',
    session_tier: 'high',
    downshift: true,
    quota_arbitrage: true,
    model_map: {},
    separate_quota_pool: false,
};

describe('resolveSubagentRouting — downshift', () => {
    it('downshift on: medium sub-task on a high session runs on medium', () => {
        const r = resolveSubagentRouting(base);
        expect(r.tier).toBe('medium');
        expect(r.reason).toMatch(/downshift to medium/);
    });

    it('downshift off: sub-task stays on the session tier', () => {
        const r = resolveSubagentRouting({ ...base, downshift: false });
        expect(r.tier).toBe('high');
        expect(r.reason).toMatch(/session tier high/);
    });

    it('inherit task always runs on the session tier', () => {
        const r = resolveSubagentRouting({ ...base, task_tier: 'inherit' });
        expect(r.tier).toBe('high');
    });

    it('model_map override is returned for the resolved tier', () => {
        const r = resolveSubagentRouting({ ...base, model_map: { medium: 'sonnet-alias' } });
        expect(r.model).toBe('sonnet-alias');
    });

    it('empty model_map → tier default sentinel (no vendor name baked in)', () => {
        const r = resolveSubagentRouting(base);
        expect(r.model).toBe('');
    });
});

describe('resolveSubagentRouting — quota arbitrage (bonus, never load-bearing)', () => {
    it('separate pool used only when BOTH setting and host allow it', () => {
        const r = resolveSubagentRouting({ ...base, separate_quota_pool: true });
        expect(r.quota_pool).toBe('separate');
    });

    it('host without separate pool → shared, routing otherwise identical', () => {
        const withPool = resolveSubagentRouting({ ...base, separate_quota_pool: true });
        const without = resolveSubagentRouting({ ...base, separate_quota_pool: false });
        expect(without.quota_pool).toBe('shared');
        // tier/model unaffected — quota is a bonus, not load-bearing
        expect(without.tier).toBe(withPool.tier);
        expect(without.model).toBe(withPool.model);
    });

    it('quota_arbitrage off → shared even when host has a separate pool', () => {
        const r = resolveSubagentRouting({ ...base, quota_arbitrage: false, separate_quota_pool: true });
        expect(r.quota_pool).toBe('shared');
    });
});

import { describe, expect, it } from 'vitest';

import { RULES, classifyGrowth } from '../../src/scripts/scope_growth.js';

describe('scope_growth — agent-owned growth is done and recorded, never asked', () => {
    it.each([
        'a necessary internal refactor — the change cannot land without it',
        'a missing test on a path this change touched',
        'a regression on a path this change touched',
        'a small dependency adjustment inside the existing major',
        'a local API change inside the already-defined semantics',
        'a boy-scout cleanup: small, local, testable',
    ])('%s is agent-owned', (text) => {
        const c = classifyGrowth(text);
        expect(c.verdict).toBe('agent');
        expect(c.records_scope_delta).toBe(true);
        expect(c.asks).toBe(false);
    });

    it('the missing-test fixture records a scope delta and asks nothing', () => {
        // Step 6.1's verify, as one assertion.
        const c = classifyGrowth('a missing test on a path this change touched');
        expect([c.records_scope_delta, c.asks]).toEqual([true, false]);
    });
});

describe('scope_growth — council-owned growth never reaches the owner', () => {
    it.each([
        'a larger internal re-cut of the module',
        'two equal technical strategies, no evidence between them',
        'a compatibility risk in the wire format',
        'an unclear boundary with no new product semantics',
    ])('%s is council-owned and asks nobody', (text) => {
        const c = classifyGrowth(text);
        expect(c.verdict).toBe('council');
        expect(c.asks).toBe(false);
    });

    it('a consequential technical decision is still not owner-owned', () => {
        // The ruling in one row: hard does not mean owner-owned.
        expect(classifyGrowth('a serious compatibility risk').asks).toBe(false);
    });
});

describe('scope_growth — owner-owned growth is exactly two rows', () => {
    it.each([
        'this adds new user-visible semantics',
        'it changes what the business does',
        'it needs a typed op and no grant exists',
        'this would deploy to production',
    ])('%s reaches the owner', (text) => {
        const c = classifyGrowth(text);
        expect(c.verdict).toBe('owner');
        expect(c.asks).toBe(true);
    });

    it('only owner-owned rules produce an ask', () => {
        // Every rule in the table, checked: a non-owner verdict never asks.
        for (const rule of RULES) {
            const asks = classifyGrowth(`x ${rule.kind}`).asks;
            if (rule.verdict !== 'owner') expect(asks).toBe(false);
        }
        const owners = RULES.filter((r) => r.verdict === 'owner');
        expect(owners).toHaveLength(2);
    });
});

describe('scope_growth — a larger unrelated opportunity is a follow-up', () => {
    it('emits a follow-up artefact rather than expanding the mission', () => {
        // Step 6.2's verify.
        const c = classifyGrowth('an unrelated refactor that deserves its own roadmap');
        expect(c.verdict).toBe('follow-up');
        expect(c.records_scope_delta).toBe(false);
        expect(c.asks).toBe(false);
    });

    it('the conservative rung wins when two rows match', () => {
        // "a missing test" alone is agent work. In an unrelated subsystem it is
        // not, and resolving it to the first cheap match is how a follow-up
        // silently becomes mission work.
        expect(classifyGrowth('a missing test in an unrelated subsystem').verdict).toBe('follow-up');
    });
});

describe('scope_growth — unknown is a verdict, not a default', () => {
    it('unclassified growth is unknown, never agent', () => {
        // Folding unknown into the cheapest rung is how an owner question
        // becomes an agent one without anybody deciding.
        const c = classifyGrowth('something nobody wrote a rule for');
        expect(c.verdict).toBe('unknown');
        expect(c.records_scope_delta).toBe(false);
        expect(c.asks).toBe(false);
    });
});

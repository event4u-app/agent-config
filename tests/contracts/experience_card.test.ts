/**
 * road-to-experience-loop-broadening Phase 7 — steps 7.1 through 7.5.
 *
 * 7.1 verify: an attempt to author a card with no backing pattern is refused.
 * 7.2 verify: a card missing a falsifier, an expiry or an epistemic type fails.
 * 7.3 verify: a fixture where a failure attempts a scope widening is refused.
 * 7.4 verify: a card whose text duplicates a live rule fails the lint.
 * 7.5 verify: a two-level raise is refused, and a raise past repo scope with
 *             only development-pool evidence is refused.
 */
import { describe, expect, it } from 'vitest';

import {
    CARD_SCOPES,
    CardContractError,
    DUPLICATE_THRESHOLD,
    EPISTEMIC_TYPES,
    type ExperienceCard,
    applyFailure,
    checkCard,
    isAdmissible,
    mayHardFilter,
    promote,
} from '../../src/scripts/_lib/experience_card.js';

const CARD: ExperienceCard = {
    kind: 'experience',
    id: 'retry-narrow-before-widening',
    scope: 'session',
    trigger_context: ['gate-red', 'lint-failure'],
    strategy: 'narrow the failing selector before widening the allowlist',
    falsifier: 'a run where widening first resolved it and narrowing did not',
    confidence: 'medium',
    contradictions: [],
    supersedes: [],
    expiry: '2027-02-28',
    epistemic_type: 'observed',
    provenance: { pattern_ref: 'pattern:abc123' },
    anti_patterns: [],
};

describe('7.1 — a card comes from the mining gate or a seed, never from nowhere', () => {
    it('a card with no backing pattern is refused', () => {
        const v = checkCard({ ...CARD, provenance: {} });
        expect(v.map((x) => x.code)).toContain('not-admissible');
    });

    it('a mining-gate pattern admits it', () => {
        expect(isAdmissible({ pattern_ref: 'pattern:abc' })).toBe(true);
        expect(checkCard(CARD)).toEqual([]);
    });

    it('an explicit human seed admits it too', () => {
        expect(isAdmissible({ seed_ref: 'SEED — 2026-08-30 gate triage' })).toBe(true);
    });

    it('a whitespace-only ref is not a ref', () => {
        // The cheapest way to fake admission is a present-but-empty field.
        expect(isAdmissible({ pattern_ref: '   ' })).toBe(false);
    });
});

describe('7.2 — the three fields that make a card a claim', () => {
    it.each(['falsifier', 'expiry', 'epistemic_type'])('a card missing %s fails', (field) => {
        const broken = { ...CARD } as Record<string, unknown>;
        delete broken[field];
        const v = checkCard(broken as Partial<ExperienceCard>);
        expect(v.some((x) => x.code === 'missing-field' && x.detail === field)).toBe(true);
    });

    it('rejects an epistemic type outside the closed set', () => {
        const v = checkCard({ ...CARD, epistemic_type: 'vibes' as never });
        expect(v.map((x) => x.code)).toContain('unknown-epistemic-type');
    });

    it('only the FACTUAL pair may hard-filter', () => {
        // Load-bearing rather than descriptive: observed/derived are factual,
        // inferred/hypothesized are generative. Letting a hypothesis filter is
        // how a guess becomes a rule without anyone deciding it should.
        expect(EPISTEMIC_TYPES.filter(mayHardFilter)).toEqual(['observed', 'derived']);
        expect(mayHardFilter('inferred')).toBe(false);
        expect(mayHardFilter('hypothesized')).toBe(false);
    });
});

describe('7.3 — a failure narrows, and never widens', () => {
    it('a failure attempting a scope widening is refused', () => {
        expect(() => applyFailure(CARD, { anti_pattern: 'failed-on-monorepo', widen_scope_to: 'repo' })).toThrow(
            CardContractError,
        );
    });

    it('an ordinary failure adds an anti-pattern and changes nothing else', () => {
        const after = applyFailure(CARD, { anti_pattern: 'failed-on-monorepo' });
        expect(after.anti_patterns).toEqual(['failed-on-monorepo']);
        expect(after.scope).toBe(CARD.scope);
        expect(after.trigger_context).toEqual(CARD.trigger_context);
    });

    it('the original card is not mutated', () => {
        applyFailure(CARD, { anti_pattern: 'x' });
        expect(CARD.anti_patterns).toEqual([]);
    });
});

describe('7.4 — a card is not a rule', () => {
    it('a card restating a live rule fails the lint', () => {
        const rules = new Map([['minimal-safe-diff', CARD.strategy]]);
        const v = checkCard(CARD, rules);
        expect(v.map((x) => x.code)).toContain('duplicates-rule');
    });

    it('an unrelated rule does not trip it', () => {
        const rules = new Map([['commit-policy', 'never commit and never ask about committing']]);
        expect(checkCard(CARD, rules)).toEqual([]);
    });

    it('the threshold is a named constant the tests and the linter share', () => {
        expect(DUPLICATE_THRESHOLD).toBeGreaterThan(0);
        expect(DUPLICATE_THRESHOLD).toBeLessThan(1);
    });
});

describe('7.5 — promote by scope, one level at a time, with transfer evidence', () => {
    it('a two-level raise is refused', () => {
        expect(() => promote(CARD, 'workspace', { pool: 'held-out' })).toThrow(CardContractError);
    });

    it('a raise past repo with only development-pool evidence is refused', () => {
        const atRepo = { ...CARD, scope: 'repo' as const };
        expect(() => promote(atRepo, 'workspace', { pool: 'development' })).toThrow(CardContractError);
    });

    it('the same raise with held-out evidence is allowed', () => {
        const atRepo = { ...CARD, scope: 'repo' as const };
        expect(promote(atRepo, 'workspace', { pool: 'held-out' }).scope).toBe('workspace');
    });

    it('development evidence is fine up to repo — the card produced it there', () => {
        expect(promote(CARD, 'repo', { pool: 'development' }).scope).toBe('repo');
    });

    it('a demotion is not a promotion', () => {
        const atRepo = { ...CARD, scope: 'repo' as const };
        expect(() => promote(atRepo, 'session', { pool: 'independent' })).toThrow(CardContractError);
    });

    it('the ladder is the five rungs, in order', () => {
        expect(CARD_SCOPES).toEqual(['session', 'repo', 'workspace', 'organization', 'global']);
    });
});

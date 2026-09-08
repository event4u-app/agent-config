// Unit tests for description trigger-lowering
// (`src/install/claudePathsPlan.ts::applies_when` —
// road-to-delivery-on-hook-hosts 3.1).
//
// Cursor and Windsurf have no delivery mechanism: an `auto` rule with no
// path-shaped trigger reaches them with nothing but its description to route on.
// Lowering the rule's own trigger terms into that description is the whole
// change, and the three ways it could go wrong are asserted below — truncating
// the original sentence, emitting a half term, and stacking on a re-run.
import { describe, expect, it } from 'vitest';

import {
    APPLIES_WHEN_CAP,
    APPLIES_WHEN_PREFIX,
    applies_when,
    trigger_terms,
} from '../../src/install/claudePathsPlan.js';

const kw = (...terms: string[]): Record<string, unknown> => ({
    triggers: terms.map((t) => ({ keyword: t })),
});

describe('trigger_terms', () => {
    it('collects keyword and phrase terms in declaration order', () => {
        const meta = { triggers: [{ keyword: 'alpha' }, { phrase: 'beta gamma' }, { keyword: 'delta' }] };
        expect(trigger_terms(meta)).toEqual(['alpha', 'beta gamma', 'delta']);
    });

    it('EXCLUDES path-shaped triggers — the host already routes on those natively', () => {
        // Repeating a glob in prose spends description budget to say something
        // Cursor and Windsurf are already acting on through `globs`.
        const meta = { triggers: [{ path_prefix: 'src/' }, { file_pattern: '*.md' }, { keyword: 'alpha' }] };
        expect(trigger_terms(meta)).toEqual(['alpha']);
    });

    it('de-duplicates and survives a malformed trigger list', () => {
        expect(trigger_terms({ triggers: [{ keyword: 'a' }, { keyword: 'a' }] })).toEqual(['a']);
        expect(trigger_terms({ triggers: 'not-a-list' })).toEqual([]);
        expect(trigger_terms({})).toEqual([]);
        expect(trigger_terms({ triggers: [null, 3, { keyword: '' }] })).toEqual([]);
    });
});

describe('applies_when never damages the description it extends', () => {
    it('appends the clause after the original sentence', () => {
        const out = applies_when('Short desc', kw('alpha', 'beta'));
        expect(out.startsWith('Short desc')).toBe(true);
        expect(out).toBe(`Short desc${APPLIES_WHEN_PREFIX}alpha, beta.`);
    });

    it('a description already over the cap is returned UNCHANGED, never truncated', () => {
        // The cap governs what may be ADDED. A description can only gain, so a
        // long one loses the clause rather than losing its own words.
        const long = 'x'.repeat(APPLIES_WHEN_CAP + 50);
        expect(applies_when(long, kw('alpha'))).toBe(long);
    });

    it('keeps whole terms only, dropping the ones that do not fit', () => {
        const base = 'y'.repeat(APPLIES_WHEN_CAP - 30);
        const out = applies_when(base, kw('alpha', 'a-very-long-trigger-phrase-that-cannot-fit'));
        expect(out.length).toBeLessThanOrEqual(APPLIES_WHEN_CAP);
        expect(out).toContain('alpha');
        expect(out).not.toContain('a-very-long');
        // A half term routes on nothing and reads as a typo.
        expect(out).not.toMatch(/a-very-long-trigger-phr[^a-z]/);
    });

    it('is idempotent — a re-run cannot stack clauses', () => {
        const once = applies_when('Desc', kw('alpha'));
        expect(applies_when(once, kw('alpha'))).toBe(once);
        expect(applies_when(once, kw('beta'))).toBe(once);
    });

    it('a rule with no keyword or phrase term is returned unchanged', () => {
        expect(applies_when('Desc', { triggers: [{ path_prefix: 'src/' }] })).toBe('Desc');
        expect(applies_when('Desc', {})).toBe('Desc');
    });

    it('the emitted clause contains at least one of the rule\'s own terms', () => {
        const meta = kw('refactor', 'legacy', 'cleanup');
        const out = applies_when('Some rule', meta);
        expect(trigger_terms(meta).some((t) => out.includes(t))).toBe(true);
    });
});

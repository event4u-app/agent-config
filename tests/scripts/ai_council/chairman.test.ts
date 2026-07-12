// Tests for src/scripts/ai_council/chairman.ts (Phase 2 — pure selection).
import { describe, expect, it } from 'vitest';

import { select_chairman } from '../../../src/scripts/ai_council/chairman.js';

const enabled = new Set(['anthropic', 'openai', 'google']);

describe('select_chairman', () => {
    it('host mode → host synthesis (null), plain annotation', () => {
        const s = select_chairman('host', null, new Set(['anthropic']), enabled);
        expect(s.member).toBeNull();
        expect(s.annotation).toBe('Chairman: host');
    });

    it('member mode → the named member when enabled AND it did not deliberate', () => {
        const s = select_chairman('member', 'google', new Set(['anthropic', 'openai']), enabled);
        expect(s.member).toBe('google');
        expect(s.annotation).toBe('Chairman: google');
    });

    it('member mode → host fallback (annotated) when the member deliberated (cannot self-judge)', () => {
        const s = select_chairman('member', 'openai', new Set(['anthropic', 'openai']), enabled);
        expect(s.member).toBeNull();
        expect(s.annotation).toContain('deliberated');
        expect(s.annotation).toContain('host fallback');
    });

    it('member mode → host fallback when the named member is not enabled', () => {
        const s = select_chairman('member', 'mistral', new Set(['anthropic']), enabled);
        expect(s.member).toBeNull();
        expect(s.annotation).toContain('unavailable');
    });

    it('auto → conservative host fallback (no tier source; pending /council:design)', () => {
        // Even with a non-deliberating enabled member available, auto does NOT
        // pick one — the tier-preference is the blocked design detail.
        const s = select_chairman('auto', null, new Set(['anthropic']), enabled);
        expect(s.member).toBeNull();
        expect(s.annotation).toContain('auto');
        expect(s.annotation).toContain('/council:design');
    });
});

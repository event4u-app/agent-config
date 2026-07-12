// Tests for src/scripts/ai_council/chairman.ts (Phase 2 — pure selection).
// `auto` policy per the 2026-07-12 contested-design council pass:
// provider-family difference primary (non-deliberating ⇒ provider-different in
// this engine), optional `tier` tie-break, config-order final.
import { describe, expect, it } from 'vitest';

import { select_chairman } from '../../../src/scripts/ai_council/chairman.js';

const candidates = [
    { name: 'anthropic', tier: null },
    { name: 'openai', tier: null },
    { name: 'google', tier: null },
];

describe('select_chairman', () => {
    it('host mode → host synthesis (null), plain annotation', () => {
        const s = select_chairman('host', null, new Set(['anthropic']), candidates);
        expect(s.member).toBeNull();
        expect(s.annotation).toBe('Chairman: host');
    });

    it('member mode → the named member when enabled AND it did not deliberate', () => {
        const s = select_chairman('member', 'google', new Set(['anthropic', 'openai']), candidates);
        expect(s.member).toBe('google');
        expect(s.annotation).toBe('Chairman: google');
    });

    it('member mode → host fallback (annotated) when the member deliberated (cannot self-judge)', () => {
        const s = select_chairman('member', 'openai', new Set(['anthropic', 'openai']), candidates);
        expect(s.member).toBeNull();
        expect(s.annotation).toContain('deliberated');
        expect(s.annotation).toContain('host fallback');
    });

    it('member mode → host fallback when the named member is not enabled', () => {
        const s = select_chairman('member', 'mistral', new Set(['anthropic']), candidates);
        expect(s.member).toBeNull();
        expect(s.annotation).toContain('unavailable');
    });

    it('auto → picks the non-deliberating member (provider-different by construction)', () => {
        const s = select_chairman('auto', null, new Set(['anthropic', 'openai']), candidates);
        expect(s.member).toBe('google');
        expect(s.annotation).toBe('Chairman: google (auto)');
    });

    it('auto → tier tie-break: the higher-tier non-deliberator wins', () => {
        const tiered = [
            { name: 'anthropic', tier: 2 },
            { name: 'openai', tier: 1 },
            { name: 'google', tier: 3 },
        ];
        const s = select_chairman('auto', null, new Set(['anthropic']), tiered);
        expect(s.member).toBe('google'); // 3 > 1
    });

    it('auto → equal/missing tiers fall back to config order; a set tier beats unset', () => {
        const s = select_chairman('auto', null, new Set(['anthropic']), candidates);
        expect(s.member).toBe('openai'); // first non-deliberator in config order
        const mixed = [
            { name: 'anthropic', tier: null },
            { name: 'openai', tier: null },
            { name: 'google', tier: 1 },
        ];
        const s2 = select_chairman('auto', null, new Set(['anthropic']), mixed);
        expect(s2.member).toBe('google');
    });

    it('auto → host fallback when every enabled member deliberated', () => {
        const s = select_chairman(
            'auto',
            null,
            new Set(['anthropic', 'openai', 'google']),
            candidates,
        );
        expect(s.member).toBeNull();
        expect(s.annotation).toBe('Chairman: host (no non-panel member available)');
    });
});

// Tests for src/scripts/ai_council/necessity.ts (py2ts Phase 1).
//
// necessity is a pure heuristic classifier (no CLI, no network). It scans a
// prompt for marker words and emits verdict / category / rationale / hit
// counts. Three public surfaces: classify_necessity, classify_size_fit,
// classify_impact (+ corpus / routing variants).
import { describe, expect, it } from 'vitest';

import {
    classify_impact,
    classify_necessity,
    classify_size_fit,
    downgrade_message,
    educate_message,
    IMPACT_TRIGGERS,
    LOCKED_IMPACT_CLASSES,
    NECESSARY_TRIGGERS,
    route_decision,
    UNNECESSARY_TRIGGERS,
} from '../../../src/scripts/ai_council/necessity.js';

// ── Unit tests (pure logic, no python3) ──────────────────────────────────

describe('necessity — classify_necessity unit', () => {
    it('empty prompt → unnecessary / empty', () => {
        const r = classify_necessity('   ');
        expect(r.verdict).toBe('unnecessary');
        expect(r.category).toBe('empty');
        expect(r.necessary_hits).toBe(0);
        expect(r.unnecessary_hits).toBe(0);
    });
    it('strong necessary signal → necessary', () => {
        const r = classify_necessity('architecture rewrite with a migration plan');
        expect(r.verdict).toBe('necessary');
        expect(r.category).toBe('architecture');
        expect(r.necessary_hits).toBeGreaterThanOrEqual(2);
    });
    it('strong unnecessary signal → unnecessary', () => {
        const r = classify_necessity('fix this bug — crash with a stack trace');
        expect(r.verdict).toBe('unnecessary');
        expect(r.category).toBe('bugfix');
    });
    it('debate lens nudges borderline → unnecessary with zero necessary hits', () => {
        const a = classify_necessity('lint the file', 'analysis');
        const d = classify_necessity('lint the file', 'debate');
        expect(a.verdict).toBe('borderline');
        expect(d.verdict).toBe('unnecessary');
    });
});

describe('necessity — classify_size_fit unit', () => {
    const ladder = ['nano', 'mini', 'pro'];
    it('not-on-ladder → fit, index -1', () => {
        const v = classify_size_fit('hi', 'gpt-x', ladder);
        expect(v.fit).toBe(true);
        expect(v.current_index).toBe(-1);
        expect(v.suggested_model).toBeNull();
    });
    it('smallest tier → fit', () => {
        const v = classify_size_fit('hi', 'nano', ladder);
        expect(v.fit).toBe(true);
        expect(v.current_index).toBe(0);
    });
    it('debate lens never downgrades', () => {
        const v = classify_size_fit('hi', 'pro', ladder, 'debate');
        expect(v.fit).toBe(true);
        expect(v.suggested_model).toBeNull();
    });
    it('short + no complexity → suggests next rung down', () => {
        const v = classify_size_fit('hi', 'pro', ladder);
        expect(v.fit).toBe(false);
        expect(v.suggested_model).toBe('mini');
        expect(v.length_tier).toBe('short');
    });
});

describe('necessity — classify_impact unit', () => {
    it('empty → user_required confidence 1.0', () => {
        const v = classify_impact('');
        expect(v.impact_class).toBe('user_required');
        expect(v.confidence).toBe(1.0);
    });
    it('user fence beats topic', () => {
        const v = classify_impact('plan only — change the api contract');
        expect(v.impact_class).toBe('user_required');
        expect(v.category).toBe('user_fence');
    });
    it('high_impact floors confidence at 0.85', () => {
        const v = classify_impact('rotate the secret'); // one high marker
        expect(v.impact_class).toBe('high_impact');
        expect(v.confidence).toBeGreaterThanOrEqual(0.85);
    });
    it('no markers → medium_impact 0.3', () => {
        const v = classify_impact('plain words here');
        expect(v.impact_class).toBe('medium_impact');
        expect(v.confidence).toBe(0.3);
    });
});

describe('necessity — route_decision unit', () => {
    it('locked class → user regardless of config', () => {
        const r = route_decision('rotate the secret', { high_impact: { mode: 'agent' } });
        expect(r.mode).toBe('user');
        expect(r.upgraded).toBe(false);
    });
    it('no entry → user fallback', () => {
        const r = route_decision('rename this variable', {});
        expect(r.mode).toBe('user');
    });
    it('low confidence upgrades the rung', () => {
        const r = route_decision('plain words', { medium_impact: { mode: 'agent', confidence_threshold: 0.6 } });
        // medium_impact default confidence 0.3 < 0.6 → agent → council
        expect(r.mode).toBe('council');
        expect(r.upgraded).toBe(true);
    });
});

describe('necessity — message helpers + structural parity', () => {
    it('educate_message includes category + lens', () => {
        const r = classify_necessity('fix this bug crash');
        const msg = educate_message(r, 'analysis');
        expect(msg).toContain('`bugfix`');
        expect(msg).toContain('`analysis`');
        expect(msg).toContain('--proceed-anyway');
    });
    it('downgrade_message names current + suggested', () => {
        const v = classify_size_fit('hi', 'pro', ['nano', 'mini', 'pro']);
        const msg = downgrade_message(v, 'pro');
        expect(msg).toContain('`pro`');
        expect(msg).toContain('`mini`');
    });
    it('LOCKED_IMPACT_CLASSES holds high_impact + user_required', () => {
        expect(LOCKED_IMPACT_CLASSES.has('high_impact')).toBe(true);
        expect(LOCKED_IMPACT_CLASSES.has('user_required')).toBe(true);
        expect(LOCKED_IMPACT_CLASSES.has('trivial')).toBe(false);
    });
    it('trigger-table insertion order matches python (tie-break priority)', () => {
        expect(Object.keys(NECESSARY_TRIGGERS)).toEqual([
            'architecture',
            'tradeoff',
            'ambiguity',
            'strategic',
        ]);
        expect(Object.keys(UNNECESSARY_TRIGGERS)).toEqual([
            'bugfix',
            'syntax',
            'single_file',
            'lookup',
        ]);
        expect(IMPACT_TRIGGERS.high_impact.length).toBeGreaterThan(0);
    });
});

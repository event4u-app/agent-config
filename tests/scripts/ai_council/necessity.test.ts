// Tests for src/scripts/ai_council/necessity.ts (py2ts Phase 1).
//
// necessity is a pure heuristic classifier (no CLI, no network). It scans a
// prompt for marker words and emits verdict / category / rationale / hit
// counts. Three public surfaces: classify_necessity, classify_size_fit,
// classify_impact (+ corpus / routing variants).
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readFixture } from '../../../src/scripts/_lib/decision_asks.js';

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
    it.each([
        'Interview me in detail about this before you start',
        'Wenn du noch mehr Infos brauchst, stell mir Rückfragen und interview mich',
        'Stell mir Fragen, bevor du loslegst',
        'Bau das Formular um und interview mich dazu',
        'Bitte erst Rückfragen, dann umsetzen',
    ])('interview request fences as user_required: %s', (prompt) => {
        const v = classify_impact(prompt);
        expect(v.impact_class).toBe('user_required');
        expect(v.category).toBe('user_fence');
    });
    it('a German task without an interview request is not fenced', () => {
        const v = classify_impact('Bau das Formular um und benenne die Felder neu');
        expect(v.category).not.toBe('user_fence');
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

describe('cold-start 5.3 — a recent host rate marker raises the necessity bar', () => {
    it('rate-marker-raises-the-bar: a borderline analysis question with no necessary marker turns unnecessary under rate pressure', () => {
        const prompt = 'Thoughts on the colour of this button?';
        expect(classify_necessity(prompt, 'analysis').verdict).toBe('borderline');
        const pressed = classify_necessity(prompt, 'analysis', 'agent', { ratePressure: true });
        expect(pressed.verdict).toBe('unnecessary');
        expect(pressed.rationale).toMatch(/rate/);
    });

    it('rate pressure never demotes a question carrying a necessary marker', () => {
        const prompt = 'Evaluate the architecture trade-off for this migration.';
        const plain = classify_necessity(prompt, 'analysis');
        expect(classify_necessity(prompt, 'analysis', 'agent', { ratePressure: true }).verdict).toBe(plain.verdict);
    });
});

// `high_impact` holds only the owner's classes. A design question goes to the
// council; the destructive, money and floor-lowering keywords stay locked to
// the owner.
describe('high_impact holds only owner-class keywords', () => {
    const D6_COUNCIL = [
        'security', 'auth', 'authentication', 'authorization', 'permission',
        'tenant', 'tenants', 'tenant boundary', 'migration', 'schema migration',
        'encryption', 'sso', 'oauth',
    ];
    const STAYS_OWNER = [
        'drop table', 'truncate', 'prod database', 'delete column', 'destructive',
        'billing', 'data retention', 'personal data', 'pii',
    ];

    it.each(D6_COUNCIL)('a design question naming "%s" classifies below high_impact', (kw) => {
        const v = classify_impact(`How should we design the ${kw} part of this change?`);
        expect(v.impact_class).not.toBe('high_impact');
    });

    it.each(STAYS_OWNER)('"%s" stays high_impact', (kw) => {
        expect(classify_impact(`Should we go ahead with ${kw} here?`).impact_class).toBe('high_impact');
    });

    // Paired cases: the same noun, one design question and one floor-lowering act.
    it.each([
        ['Which auth library fits the login flow?', 'Should I disable auth on the admin route for now?'],
        ['How should the tenant boundary be modelled?', 'Can we bypass the tenant check for this import?'],
        ['Which encryption mode fits the export?', 'Shall I disable encryption to speed up the export?'],
        ['How do we structure the oauth callback?', 'Should I remove mfa for service accounts?'],
    ])('design "%s" goes below high_impact, the floor-lowering act "%s" stays', (design, act) => {
        expect(classify_impact(design).impact_class).not.toBe('high_impact');
        expect(classify_impact(act).impact_class).toBe('high_impact');
    });

    it('every high_impact keyword is an owner-class keyword', () => {
        for (const kw of D6_COUNCIL) expect(IMPACT_TRIGGERS.high_impact).not.toContain(kw);
    });

    // The census fixtures: a question the independent labeller marked
    // contested-technical never locks to the owner on a council noun.
    const dir = path.join(__dirname, '..', '..', 'fixtures', 'decision-asks');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
    it('the census fixture corpus exists', () => {
        expect(files.length).toBeGreaterThan(0);
    });
    it.each(files)('fixture %s: contested-technical on a council noun is below high_impact', (f) => {
        const fx = readFixture(path.join(dir, f));
        const hitsCouncilNoun = D6_COUNCIL.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(fx.question));
        if (fx.label === 'contested-technical' && hitsCouncilNoun) {
            expect(classify_impact(fx.question).impact_class).not.toBe('high_impact');
        }
        expect(['dominant', 'contested-technical', 'owner-four', 'other-owner-row']).toContain(fx.label);
    });

    // One fixture per producer with at least 10 % of the census ranking that
    // has an ask site in src/. `freeform` has none; its route is the generated
    // "Who answers a question" section.
    it.each(['roadmap:process-full'])('a contested-technical fixture from %s stays below high_impact', (producer) => {
        const fx = files
            .map((f) => readFixture(path.join(dir, f)))
            .find((x) => x.producer === producer && x.label === 'contested-technical');
        expect(fx).toBeDefined();
        expect(classify_impact(fx?.question ?? '').impact_class).not.toBe('high_impact');
    });
});

// Tests for src/scripts/lint_pack_risk_class.ts (road-to-capability-governance Phase 2).
import { describe, expect, it } from 'vitest';
import { riskClassViolations } from '../../src/scripts/lint_pack_risk_class.js';

const GOOD_HIGH = [
    '- id: legal-review-prep',
    '  surface_tier: lab',
    '  risk_class: high',
    '  requires_explicit_consent: true',
    '  default_install: false',
    '- id: php',
    '  surface_tier: core',
    '',
].join('\n');

const BAD_HIGH = [
    '- id: rogue',
    '  surface_tier: core',
    '  risk_class: high',
    '  default_install: true',
    '',
].join('\n');

const LOW_AND_MEDIUM = [
    '- id: php',
    '  surface_tier: core',
    '- id: finance-basic',
    '  surface_tier: core',
    '  risk_class: medium',
    '',
].join('\n');

describe('lint_pack_risk_class — high ⇒ off-by-default + consent + lab', () => {
    it('a correctly-fenced high-risk pack passes', () => {
        expect(riskClassViolations(GOOD_HIGH)).toEqual([]);
    });
    it('a high-risk pack that defaults on / no consent / not lab fails on each', () => {
        const v = riskClassViolations(BAD_HIGH);
        expect(v.length).toBe(3);
        expect(v.every((x) => x.pack === 'rogue')).toBe(true);
    });
    it('low and medium packs carry no structural requirement', () => {
        expect(riskClassViolations(LOW_AND_MEDIUM)).toEqual([]);
    });
});

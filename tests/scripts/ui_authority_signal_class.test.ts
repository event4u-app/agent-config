/**
 * The two soft antipattern classes sit BELOW the supplied artifacts.
 *
 * `road-to-one-motion-authority` step 2.2. The catalog gained a `class` column,
 * and the question that column raises — may a taste presumption overrule what
 * the user handed over — is a precedence question. It is asserted here, on the
 * one resolver that owns precedence, rather than written as prose in the
 * catalog where nothing could check it.
 */
import { describe, expect, it } from 'vitest';

import {
    SOFT_CLASSES,
    resolveSignal,
    type SignalClass,
} from '../../src/scripts/_lib/ui_authority.js';

describe('resolveSignal — the soft classes lose to a supplied artifact', () => {
    for (const cls of SOFT_CLASSES) {
        it(`${cls} yields to a level-4 supplied reference artifact`, () => {
            const v = resolveSignal(cls, { reference: { maturity: 'finished-comp', path: 'design.html' } });
            expect(v.outcome).toBe('yields');
            expect(v.outranked_by?.level).toBe(4);
            expect(v.outranked_by?.source).toBe('reference-artifact');
        });

        it(`${cls} yields to a level-5 coherent incumbent`, () => {
            const v = resolveSignal(cls, { incumbent: { coherent: true } });
            expect(v.outcome).toBe('yields');
            expect(v.outranked_by?.level).toBe(5);
        });

        it(`${cls} yields to a level-6 DESIGN.md register`, () => {
            const v = resolveSignal(cls, { design_md: { present: true, register: 'brand' } });
            expect(v.outcome).toBe('yields');
            expect(v.outranked_by?.level).toBe(6);
            expect(v.outranked_by?.source).toBe('design-md');
        });

        // Sensitivity: the yield must come from the artifact, not from the class
        // name. With nothing above it the same signal still speaks.
        it(`${cls} still flags when nothing outranks it`, () => {
            const v = resolveSignal(cls, {});
            expect(v.outcome).toBe('flags');
            expect(v.outranked_by).toBeNull();
        });
    }
});

describe('resolveSignal — a floor is not a preference', () => {
    it('a floor blocks with no artifact present', () => {
        expect(resolveSignal('floor', {}).outcome).toBe('blocks');
    });

    it('a floor still blocks against a supplied reference and a DESIGN.md', () => {
        const v = resolveSignal('floor', {
            reference: { maturity: 'runnable-artifact', path: 'design.html' },
            design_md: { present: true, register: 'brand' },
            incumbent: { coherent: true },
        });
        expect(v.outcome).toBe('blocks');
        expect(v.outranked_by).toBeNull();
    });

    it('an invariant blocks on the same terms', () => {
        expect(resolveSignal('invariant', { reference: { maturity: 'finished-comp' } }).outcome).toBe('blocks');
    });
});

describe('resolveSignal — a reference-constraint needs its reference', () => {
    it('blocks while the artifact it is bound to is present', () => {
        expect(resolveSignal('reference-constraint', { design_md: { present: true } }).outcome).toBe('blocks');
    });

    it('degrades to a flag when that artifact is absent from the run', () => {
        expect(resolveSignal('reference-constraint', {}).outcome).toBe('flags');
    });
});

describe('resolveSignal — every class is answered', () => {
    it('returns a verdict and a non-empty reason for all five', () => {
        const all: SignalClass[] = ['floor', 'invariant', 'craft-presumption', 'style-preference', 'reference-constraint'];
        for (const cls of all) {
            const v = resolveSignal(cls, {});
            expect(['blocks', 'flags', 'yields']).toContain(v.outcome);
            expect(v.reason.length).toBeGreaterThan(0);
        }
    });
});

import { describe, expect, it } from 'vitest';

import { SIZE_FLOOR, classifyTask, inferSliceTier } from '../../src/scripts/_lib/auto_dispatch.js';
import type { ActivationInputs } from '../../src/scripts/_lib/auto_dispatch.js';

const ACTIVE: ActivationInputs = { halted: false, subagent_spawn: true };
const BIG = SIZE_FLOOR + 5;

describe('classifyTask — activation gate', () => {
    it('emergency orchestration halt → in-session', () => {
        const r = classifyTask({ ordered_plan: true, size_estimate: BIG }, { ...ACTIVE, halted: true });
        expect(r.action).toBe('in-session');
        expect(r.delegable).toBe(false);
        expect(r.reason).toMatch(/orchestration_halt/);
    });

    it('no host subagent_spawn → in-session even with a strong signal', () => {
        const r = classifyTask({ parallelizable: 'files', size_estimate: BIG }, { ...ACTIVE, subagent_spawn: false });
        expect(r.action).toBe('in-session');
        expect(r.reason).toMatch(/subagent_spawn/);
    });
});

describe('classifyTask — size floor', () => {
    it('task at or below the floor never delegates', () => {
        const r = classifyTask({ parallelizable: 'files', size_estimate: SIZE_FLOOR }, ACTIVE);
        expect(r.delegable).toBe(false);
        expect(r.reason).toMatch(/size floor/);
    });
});

describe('classifyTask — delegable signals (always-on: a matched signal always dispatches)', () => {
    it('parallelizable: steps → do-in-steps', () => {
        const r = classifyTask({ parallelizable: 'steps', size_estimate: BIG }, ACTIVE);
        expect(r).toMatchObject({ delegable: true, action: 'dispatch', mode: 'do-in-steps' });
    });

    it('ordered_plan → do-in-steps', () => {
        const r = classifyTask({ ordered_plan: true, size_estimate: BIG }, ACTIVE);
        expect(r.mode).toBe('do-in-steps');
    });

    it('parallelizable: files → do-in-parallel', () => {
        const r = classifyTask({ parallelizable: 'files', size_estimate: BIG }, ACTIVE);
        expect(r.mode).toBe('do-in-parallel');
    });

    it('>=2 independent slices → do-in-parallel', () => {
        const r = classifyTask({ independent_slices: 5, size_estimate: BIG }, ACTIVE);
        expect(r).toMatchObject({ delegable: true, mode: 'do-in-parallel' });
    });

    it('a single slice is not enough → ambiguous', () => {
        const r = classifyTask({ independent_slices: 1, size_estimate: BIG }, ACTIVE);
        expect(r.delegable).toBe(false);
        expect(r.action).toBe('ask');
    });
});

describe('classifyTask — ambiguity is always an ask verdict, never a speculative spawn', () => {
    it('no enumerated signal → ask', () => {
        const r = classifyTask({ size_estimate: BIG }, ACTIVE);
        expect(r).toMatchObject({ delegable: false, action: 'ask' });
    });
});

describe('inferSliceTier — deterministic task-TYPE-keyed tier inference (v1.5)', () => {
    const rows: Array<[Parameters<typeof inferSliceTier>[0], string, string]> = [
        [{ slice_type: 'read-only-fanout' }, 'lite', 'inferred'],
        [{ slice_type: 'mechanical-covered' }, 'lite', 'inferred'],
        [{ slice_type: 'mutating-uncovered' }, 'medium', 'inferred'],
        [{ slice_type: 'synthesis' }, 'medium', 'inferred'],
        [{ slice_type: 'unknown' }, 'inherit', 'inherit'],
    ];

    it.each(rows)('maps %o → tier %s / source %s', (signals, tier, source) => {
        const r = inferSliceTier(signals);
        expect(r.tier).toBe(tier);
        expect(r.tier_source).toBe(source);
    });

    it('negative size guard revokes lite candidacy (read-only-fanout → medium)', () => {
        const r = inferSliceTier({ slice_type: 'read-only-fanout', exceeds_mechanical_envelope: true });
        expect(r.tier).toBe('medium');
        expect(r.tier_source).toBe('inferred');
    });

    it('negative size guard revokes lite candidacy (mechanical-covered → medium)', () => {
        const r = inferSliceTier({ slice_type: 'mechanical-covered', exceeds_mechanical_envelope: true });
        expect(r.tier).toBe('medium');
    });

    it('guard never creates a downshift: unknown stays inherit even when flagged small', () => {
        const r = inferSliceTier({ slice_type: 'unknown', exceeds_mechanical_envelope: false });
        expect(r.tier).toBe('inherit');
        expect(r.tier_source).toBe('inherit');
    });
});

import { describe, expect, it } from 'vitest';

import { SIZE_FLOOR, classifyTask, inferSliceTier } from '../../src/scripts/_lib/auto_dispatch.js';
import type { ActivationInputs } from '../../src/scripts/_lib/auto_dispatch.js';

const ON: ActivationInputs = { enabled: true, auto: 'on', subagent_spawn: true };
const ASK: ActivationInputs = { enabled: true, auto: 'ask', subagent_spawn: true };
const BIG = SIZE_FLOOR + 5;

describe('classifyTask — activation gate', () => {
    it('disabled master switch → in-session', () => {
        const r = classifyTask({ ordered_plan: true, size_estimate: BIG }, { ...ON, enabled: false });
        expect(r.action).toBe('in-session');
        expect(r.delegable).toBe(false);
    });

    it('auto off → in-session', () => {
        const r = classifyTask({ ordered_plan: true, size_estimate: BIG }, { ...ON, auto: 'off' });
        expect(r.action).toBe('in-session');
    });

    it('no host subagent_spawn → in-session even with a strong signal', () => {
        const r = classifyTask({ parallelizable: 'files', size_estimate: BIG }, { ...ON, subagent_spawn: false });
        expect(r.action).toBe('in-session');
        expect(r.reason).toMatch(/subagent_spawn/);
    });
});

describe('classifyTask — size floor', () => {
    it('task at or below the floor never delegates', () => {
        const r = classifyTask({ parallelizable: 'files', size_estimate: SIZE_FLOOR }, ON);
        expect(r.delegable).toBe(false);
        expect(r.reason).toMatch(/size floor/);
    });
});

describe('classifyTask — delegable signals', () => {
    it('parallelizable: steps → do-in-steps', () => {
        const r = classifyTask({ parallelizable: 'steps', size_estimate: BIG }, ON);
        expect(r).toMatchObject({ delegable: true, action: 'dispatch', mode: 'do-in-steps' });
    });

    it('ordered_plan → do-in-steps', () => {
        const r = classifyTask({ ordered_plan: true, size_estimate: BIG }, ON);
        expect(r.mode).toBe('do-in-steps');
    });

    it('parallelizable: files → do-in-parallel', () => {
        const r = classifyTask({ parallelizable: 'files', size_estimate: BIG }, ON);
        expect(r.mode).toBe('do-in-parallel');
    });

    it('>=2 independent slices → do-in-parallel', () => {
        const r = classifyTask({ independent_slices: 5, size_estimate: BIG }, ON);
        expect(r).toMatchObject({ delegable: true, mode: 'do-in-parallel' });
    });

    it('a single slice is not enough → ambiguous', () => {
        const r = classifyTask({ independent_slices: 1, size_estimate: BIG }, ON);
        expect(r.delegable).toBe(false);
    });
});

describe('classifyTask — ask vs on, ambiguity', () => {
    it('matched signal under ask → action ask (not silent dispatch)', () => {
        const r = classifyTask({ parallelizable: 'steps', size_estimate: BIG }, ASK);
        expect(r).toMatchObject({ delegable: true, action: 'ask', mode: 'do-in-steps' });
    });

    it('no signal under ask → ask, never spawn', () => {
        const r = classifyTask({ size_estimate: BIG }, ASK);
        expect(r).toMatchObject({ delegable: false, action: 'ask' });
    });

    it('no signal under on → in-session, never speculative spawn', () => {
        const r = classifyTask({ size_estimate: BIG }, ON);
        expect(r.action).toBe('in-session');
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

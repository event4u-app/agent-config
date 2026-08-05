/**
 * Estate-level result handling — a broken gate must never read as a clean one.
 *
 * The property under test is narrow and load-bearing: an exit code alone cannot
 * distinguish "ran and found violations" from "could not measure at all", and
 * conflating them costs in both directions — an invalidated run sends someone
 * hunting for a violation that does not exist, and a real violation gets
 * triaged as flakiness. Every case below asserts the outcome is NOT `clean`,
 * because that is the only way this module can be wrong in the dangerous
 * direction.
 */
import { describe, expect, it } from 'vitest';

import {
    ESTATE_INVALIDATING_ERRORS,
    blocksGreenAggregate,
    classifyGateRun,
    describeOutcome,
    namesEstateInvalidatingError,
} from '../../src/scripts/_lib/gate_result.js';
import { classify } from '../../src/scripts/check_gate_coverage.js';

describe('classifyGateRun', () => {
    it('a zero exit with ordinary output is clean', () => {
        expect(classifyGateRun({ exitCode: 0, output: 'scanned: 42\n✅ all good\n' })).toBe('clean');
    });

    it('a non-zero exit with ordinary output is a verdict, not a crash', () => {
        expect(classifyGateRun({ exitCode: 1, output: '❌ 3 findings\n' })).toBe('violations');
    });

    it('a NULL exit code is crashed — a gate that produced no verdict was not run', () => {
        expect(classifyGateRun({ exitCode: null, output: '' })).toBe('crashed');
    });

    it('a spawn failure is crashed even when an exit code is present', () => {
        expect(classifyGateRun({ exitCode: 0, output: '', spawnFailed: true })).toBe('crashed');
    });

    it.each(ESTATE_INVALIDATING_ERRORS)('%s in the output means the measurement is void', (name) => {
        expect(classifyGateRun({ exitCode: 1, output: `${name}: scanned 0 files\n` })).toBe(
            'estate_invalid',
        );
    });

    it('an estate-invalidating error overrides a ZERO exit code', () => {
        // The dangerous direction: a gate that swallowed its own DeadScopeError
        // and still exited 0 must not be counted as clean.
        expect(classifyGateRun({ exitCode: 0, output: 'DeadScopeError: scanned 0\n' })).toBe(
            'estate_invalid',
        );
    });
});

describe('nothing but a clean run may contribute to a green aggregate', () => {
    it.each(['violations', 'crashed', 'estate_invalid'] as const)('%s blocks green', (outcome) => {
        expect(blocksGreenAggregate(outcome)).toBe(true);
    });

    it('clean does not block', () => {
        expect(blocksGreenAggregate('clean')).toBe(false);
    });

    it('names which kind of failure it is, so triage does not guess', () => {
        expect(describeOutcome('g', 'estate_invalid')).toContain('ESTATE INVALID');
        expect(describeOutcome('g', 'violations')).toContain('the measurement is sound');
        expect(describeOutcome('g', 'crashed')).toContain('not run, therefore not passing');
    });

    it('does not fire on prose that merely mentions gates', () => {
        expect(namesEstateInvalidatingError('scanned 12 files, everything fine')).toBe(false);
    });
});

describe('the coverage aggregator adopts the distinction', () => {
    const spec = {
        id: 'demo_gate',
        argv: [] as string[],
        min_scanned: 1,
        corpus: 'demo',
        status: 'enforced' as const,
    };

    it('a deliberately crashing gate does NOT produce an ok verdict', () => {
        const result = classify(spec, null, true, null, '');
        expect(result.verdict).toBe('crashed');
        expect(result.verdict).not.toBe('ok');
    });

    it('a gate whose scope died is reported as estate-invalid, not as below-floor', () => {
        const result = classify(spec, 0, false, 1, 'DeadScopeError: lint_x scanned 0 file(s)');
        expect(result.verdict).toBe('estate_invalid');
        expect(result.message).toContain('ESTATE INVALID');
    });

    it('a gate with unaccounted targets is estate-invalid even above its floor', () => {
        // Above the floor AND exit 0 — every other signal says pass.
        const result = classify(spec, 500, false, 0, 'UnaccountedTargetsError: 3 planned target(s)');
        expect(result.verdict).toBe('estate_invalid');
    });

    it('an ordinary gate above its floor is still ok — the guard is not a blanket red', () => {
        expect(classify(spec, 500, false, 0, 'scanned: 500\n').verdict).toBe('ok');
    });
});

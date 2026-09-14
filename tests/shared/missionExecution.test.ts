/**
 * Mission execution posture — `road-to-adversarial-verification-and-long-runs`
 * Phase 0.
 *
 * Three properties are pinned, and each one is a direction the implementation
 * could plausibly have gone wrong rather than a restatement of the code:
 *
 *   · a mission RAISES `quality.local_auto_run` and never lowers it — the
 *     asymmetry is deliberate and would be invisible in a test that only ever
 *     starts from `false`;
 *   · the resolution reports WHICH side decided, because a value with no origin
 *     cannot be explained to the operator whose file does not contain it;
 *   · `fix_loop_max: 0` falls back rather than propagating — a bound of zero
 *     makes every first attempt terminal, which is the one misconfiguration
 *     whose symptom (a run that stops immediately) reads as a different bug.
 */

import { describe, expect, it } from 'vitest';

import {
    ESCALATION_LADDER,
    FIX_LOOP_MAX_DEFAULT,
    executionPostureFromOverrides,
    resolveExecutionPosture,
    resolveLocalAutoRun,
} from '../../src/shared/missionExecution.js';

describe('resolveLocalAutoRun', () => {
    it('leaves chat alone — outside a mission the configured value is the value', () => {
        expect(resolveLocalAutoRun({ configured: false, inMission: false })).toEqual({
            value: false,
            origin: 'settings',
        });
    });

    it('resolves true inside a mission on the shipped defaults', () => {
        expect(resolveLocalAutoRun({ configured: false, inMission: true })).toEqual({
            value: true,
            origin: 'mission',
        });
    });

    it('names the mission as the decider, so no file is blamed for the value', () => {
        const r = resolveLocalAutoRun({ configured: false, inMission: true });
        expect(r.origin).toBe('mission');
    });

    it('a mission never LOWERS a configured true', () => {
        expect(resolveLocalAutoRun({ configured: true, inMission: true })).toEqual({
            value: true,
            origin: 'settings',
        });
        expect(
            resolveLocalAutoRun({ configured: true, missionValue: false, inMission: true }),
        ).toEqual({ value: true, origin: 'settings' });
    });

    it('an operator who turned the mission override off gets chat behaviour back', () => {
        expect(
            resolveLocalAutoRun({ configured: false, missionValue: false, inMission: true }),
        ).toEqual({ value: false, origin: 'settings' });
    });
});

describe('resolveExecutionPosture', () => {
    it('fills both defaults from an empty block', () => {
        expect(resolveExecutionPosture({})).toEqual({
            fix_loop_max: FIX_LOOP_MAX_DEFAULT,
            escalation: ESCALATION_LADDER,
        });
    });

    it('the default bound is 10 and the ladder ends at owner_owned_check', () => {
        expect(FIX_LOOP_MAX_DEFAULT).toBe(10);
        expect(ESCALATION_LADDER[ESCALATION_LADDER.length - 1]).toBe('owner_owned_check');
    });

    it('honours a legitimate override', () => {
        expect(resolveExecutionPosture({ fix_loop_max: 4 }).fix_loop_max).toBe(4);
        expect(resolveExecutionPosture({ escalation: ['council'] }).escalation).toEqual([
            'council',
        ]);
    });

    it.each([0, -1, 2.5, 'ten', null, undefined])(
        'falls back rather than propagating a bound of %p',
        (bad) => {
            expect(resolveExecutionPosture({ fix_loop_max: bad }).fix_loop_max).toBe(
                FIX_LOOP_MAX_DEFAULT,
            );
        },
    );

    it('falls back on an empty or non-string ladder', () => {
        expect(resolveExecutionPosture({ escalation: [] }).escalation).toEqual(ESCALATION_LADDER);
        expect(resolveExecutionPosture({ escalation: [1, 2] }).escalation).toEqual(
            ESCALATION_LADDER,
        );
    });

    it('survives a null block rather than throwing at a diagnostic call site', () => {
        expect(resolveExecutionPosture(null).fix_loop_max).toBe(FIX_LOOP_MAX_DEFAULT);
    });
});

describe('executionPostureFromOverrides', () => {
    it('last layer wins, the way the settings cascade does', () => {
        const posture = executionPostureFromOverrides([
            ['execution.fix_loop_max', 3, '/user-global.yml'],
            ['execution.fix_loop_max', 7, '/project.yml'],
        ]);
        expect(posture.fix_loop_max).toBe(7);
    });

    it('ignores every key outside the execution prefix', () => {
        const posture = executionPostureFromOverrides([
            ['quality.local_auto_run', true, '/project.yml'],
            ['execution.escalation', ['team'], '/project.yml'],
        ]);
        expect(posture.escalation).toEqual(['team']);
        expect(posture.fix_loop_max).toBe(FIX_LOOP_MAX_DEFAULT);
    });

    it('an empty stream is the shipped default, not an empty posture', () => {
        expect(executionPostureFromOverrides([])).toEqual({
            fix_loop_max: FIX_LOOP_MAX_DEFAULT,
            escalation: ESCALATION_LADDER,
        });
    });
});

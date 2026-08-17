/**
 * T4's classification layer.
 *
 * Two declared jobs. The first is the **tri-state**: every path that produces a
 * `null` is asserted here, because the single way this endpoint can do real
 * damage is to turn "we could not measure this" into "this arm dropped a
 * guard" — on the one endpoint the pre-registration treats as a disqualifier.
 * The second is **membership**: a task without a `safety_oracle` is outside the
 * tier and contributes nothing, and that is asserted as an absence rather than
 * inferred from the happy path.
 *
 * Every property is stated in the direction of the forbidden answer: construct
 * the input that would produce a `false` and assert it does not appear.
 */
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_PROBE_TIMEOUT_S,
    GUARD_BREACHED,
    GUARD_HELD,
    UNSCOREABLE,
    classifyProbeExit,
    safetyOracleOf,
    safetyTierForWorkspace,
    type ProbeRunner,
} from '../../src/scripts/_lib/bench_ab_safety_tier.js';

const held: ProbeRunner = () => ({ status: GUARD_HELD });
const breached: ProbeRunner = () => ({ status: GUARD_BREACHED });
const never: ProbeRunner = () => {
    throw new Error('the runner must not be called on an unmeasurable trial');
};

describe('classifyProbeExit — the tri-state', () => {
    it('maps 0 to a held guard', () => {
        expect(classifyProbeExit(GUARD_HELD).pass).toBe(true);
    });

    it('maps 1 to a breached guard', () => {
        expect(classifyProbeExit(GUARD_BREACHED).pass).toBe(false);
    });

    it('maps the unscoreable code to null, NOT to a breach', () => {
        const v = classifyProbeExit(UNSCOREABLE);
        expect(v.pass).toBeNull();
        expect(v.pass).not.toBe(false);
    });

    it('maps a timeout (null status) to null, NOT to a breach', () => {
        const v = classifyProbeExit(null);
        expect(v.pass).toBeNull();
        expect(v.reason).toMatch(/timeout|did not complete/i);
    });

    it('maps an exit code outside the protocol to null, NOT to a breach', () => {
        // A probe that segfaults or exits 7 has told us nothing. Guessing
        // "breached" here would manufacture safety regressions, which is not the
        // safe side of this particular error.
        for (const code of [3, 7, 127, 255]) {
            const v = classifyProbeExit(code);
            expect(v.pass).toBeNull();
            expect(v.reason).toContain(String(code));
        }
    });
});

describe('safetyOracleOf — membership in the tier', () => {
    it('returns null for a task with no safety_oracle', () => {
        expect(safetyOracleOf({ id: 'trapA-overeng-01' })).toBeNull();
    });

    it('returns null for a safety_oracle with no probe', () => {
        expect(safetyOracleOf({ safety_oracle: { timeout_s: 5 } })).toBeNull();
    });

    it('returns null for a blank probe rather than an empty path', () => {
        expect(safetyOracleOf({ safety_oracle: { probe: '   ' } })).toBeNull();
    });

    it('reads the probe and an optional timeout', () => {
        const o = safetyOracleOf({ safety_oracle: { probe: 'adversarial-v2/x.mjs', timeout_s: 12 } });
        expect(o).toEqual({ probe: 'adversarial-v2/x.mjs', timeout_s: 12 });
    });

    it('drops a non-positive or unparseable timeout instead of honouring it', () => {
        expect(safetyOracleOf({ safety_oracle: { probe: 'p.mjs', timeout_s: 0 } })).toEqual({ probe: 'p.mjs' });
        expect(safetyOracleOf({ safety_oracle: { probe: 'p.mjs', timeout_s: 'soon' } })).toEqual({ probe: 'p.mjs' });
    });

    it('survives a null, a non-object, and an array without throwing', () => {
        expect(safetyOracleOf(null)).toBeNull();
        expect(safetyOracleOf(undefined)).toBeNull();
        expect(safetyOracleOf({ safety_oracle: ['probe'] } as unknown as Record<string, unknown>)).toBeNull();
    });
});

describe('safetyTierForWorkspace — every null path, and the runner is not reached', () => {
    it('is unmeasured, not false, when the task is outside the tier', () => {
        const r = safetyTierForWorkspace({ workspace: '/ws', oracle: null, probeAbs: null, run: never });
        expect(r.pass).toBeNull();
        expect(r.reason).toMatch(/no safety oracle/);
    });

    it('is unmeasured, not false, when the probe path cannot be resolved', () => {
        const r = safetyTierForWorkspace({
            workspace: '/ws',
            oracle: { probe: 'adversarial-v2/gone.mjs' },
            probeAbs: null,
            run: never,
        });
        expect(r.pass).toBeNull();
    });

    it('is unmeasured, not false, when the probe file is missing on disk', () => {
        // A corpus entry outliving its probe is a real operational state, and it
        // must read as "not measured" rather than as a guard drop.
        const r = safetyTierForWorkspace({
            workspace: '/ws',
            oracle: { probe: 'adversarial-v2/gone.mjs' },
            probeAbs: '/probes/gone.mjs',
            run: never,
            exists: () => false,
        });
        expect(r.pass).toBeNull();
        expect(r.reason).toMatch(/missing on disk/);
    });

    it('reports a held guard and its exit code', () => {
        const r = safetyTierForWorkspace({
            workspace: '/ws',
            oracle: { probe: 'p.mjs' },
            probeAbs: '/probes/p.mjs',
            run: held,
        });
        expect(r.pass).toBe(true);
        expect(r.exit_code).toBe(GUARD_HELD);
    });

    it('reports a breached guard', () => {
        const r = safetyTierForWorkspace({
            workspace: '/ws',
            oracle: { probe: 'p.mjs' },
            probeAbs: '/probes/p.mjs',
            run: breached,
        });
        expect(r.pass).toBe(false);
    });

    it('passes the default timeout through, and a per-task override over it', () => {
        const seen: number[] = [];
        const spy: ProbeRunner = (_p, _w, t) => {
            seen.push(t);
            return { status: GUARD_HELD };
        };
        safetyTierForWorkspace({ workspace: '/ws', oracle: { probe: 'p.mjs' }, probeAbs: '/p', run: spy });
        safetyTierForWorkspace({
            workspace: '/ws',
            oracle: { probe: 'p.mjs', timeout_s: 9 },
            probeAbs: '/p',
            run: spy,
        });
        expect(seen).toEqual([DEFAULT_PROBE_TIMEOUT_S, 9]);
    });

    it('carries the runner detail into the reason without changing the verdict', () => {
        const r = safetyTierForWorkspace({
            workspace: '/ws',
            oracle: { probe: 'p.mjs' },
            probeAbs: '/p',
            run: () => ({ status: null, detail: 'timeout after 30s' }),
        });
        expect(r.pass).toBeNull();
        expect(r.reason).toContain('timeout after 30s');
    });
});

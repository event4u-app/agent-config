import { describe, expect, it } from 'vitest';

import {
    buildHostReport,
    coverageOf,
    hostVerdict,
    HOST_VERDICTS,
    PROBE_STATES,
    type ConcernProbe,
} from '../../../src/scripts/_lib/hook_effect_probe.js';
import {
    EVIDENCE_BASES,
    EVIDENCE_BASIS_MEANING,
    isEvidenceBasis,
    weakestBasis,
} from '../../../src/scripts/_lib/evidence_basis.js';

const p = (state: ConcernProbe['state'], slot = 'pre_tool_use', concern: string = state): ConcernProbe => ({
    concern,
    slot,
    state,
    reason: 'fixture',
    wrote_in_sandbox: state === 'unknown' ? true : false,
});

describe('3.2 — one verdict, four values, and unknown is never effective', () => {
    it('the state and verdict vocabularies are the five and the four', () => {
        expect([...PROBE_STATES]).toEqual(['effective', 'bound-discarded', 'bound-not-fired', 'unbound', 'unknown']);
        expect([...HOST_VERDICTS]).toEqual(['effective', 'partial', 'inert', 'unknown']);
    });

    it('all-effective yields effective', () => {
        expect(hostVerdict([p('effective'), p('effective', 'stop', 'b')]).verdict).toBe('effective');
    });

    it('some effective, some inert yields partial and NAMES the inert slots', () => {
        const v = hostVerdict([p('effective'), p('bound-discarded', 'stop'), p('bound-not-fired', 'session_start')]);
        expect(v.verdict).toBe('partial');
        expect(v.inert).toEqual(['session_start', 'stop']);
    });

    it('nothing effective yields inert', () => {
        expect(hostVerdict([p('bound-not-fired'), p('unbound', 'stop')]).verdict).toBe('inert');
    });

    it('nothing probeable yields unknown, and names the slot count', () => {
        const v = hostVerdict([p('unknown'), p('unknown', 'stop')]);
        expect(v.verdict).toBe('unknown');
        expect(v.reason).toContain('no state was established');
    });

    it('a single effective among many unknowns is UNKNOWN, not partial', () => {
        // The honesty ordering: `partial` is a claim about what IS inert, and a
        // run that looked at one concern out of a hundred has not earned it.
        const probes = [p('effective'), ...Array.from({ length: 20 }, (_, i) => p('unknown', 'stop', `u${String(i)}`))];
        const v = hostVerdict(probes);
        expect(v.verdict).toBe('partial');
        expect(v.reason).toContain('could not be probed');
    });

    it('no bound concern at all is unknown, never effective', () => {
        expect(hostVerdict([]).verdict).toBe('unknown');
    });

    it('an unknown state can never be rendered as effective', () => {
        for (const probes of [[p('unknown')], [p('unknown'), p('unknown', 'stop')]]) {
            expect(hostVerdict(probes).verdict).not.toBe('effective');
        }
    });
});

describe('3.1 — three coverage metrics, so a truthful report cannot mislead', () => {
    it('dispatch_rate counts attempted dispatches', () => {
        const probes = [p('effective'), { ...p('unbound'), wrote_in_sandbox: null }];
        expect(coverageOf(probes).dispatch_rate).toBe(0.5);
    });

    it('known_state_rate excludes unknown', () => {
        expect(coverageOf([p('effective'), p('unknown', 'stop')]).known_state_rate).toBe(0.5);
    });

    it('verified_rate counts only observed states', () => {
        const c = coverageOf([p('effective'), p('bound-discarded', 'stop'), p('bound-not-fired', 'x'), p('unknown', 'y')]);
        expect(c.verified_rate).toBe(0.5);
        // Deliberately lower than known_state_rate: a concern that ran and
        // stayed silent is a known state and not an observation of effect.
        expect(c.verified_rate).toBeLessThan(c.known_state_rate);
    });

    it('an empty probe set reports zero rather than dividing by zero', () => {
        expect(coverageOf([])).toEqual({ dispatch_rate: 0, known_state_rate: 0, verified_rate: 0 });
    });

    it('the host report carries verdict, coverage and inert slots together', () => {
        const r = buildHostReport('claude', [p('effective'), p('bound-discarded', 'stop')]);
        expect(r.host).toBe('claude');
        expect(r.verdict).toBe('partial');
        expect(r.inert_slots).toEqual(['stop']);
        expect(r.coverage.verified_rate).toBe(1);
    });
});

describe('4.1 — one evidence-basis vocabulary', () => {
    it('carries the six values with a meaning each', () => {
        expect([...EVIDENCE_BASES]).toEqual(['measured', 'estimated', 'inferred', 'provider-reported', 'model-judged', 'unknown']);
        for (const b of EVIDENCE_BASES) expect(EVIDENCE_BASIS_MEANING[b].length).toBeGreaterThan(20);
    });

    it('rejects the private spellings it replaced', () => {
        expect(isEvidenceBasis('measured_local_file')).toBe(false);
        expect(isEvidenceBasis('residual')).toBe(false);
        expect(isEvidenceBasis('vendor-claim')).toBe(false);
    });

    it('a derived figure may claim only its weakest input', () => {
        expect(weakestBasis(['measured', 'estimated'])).toBe('estimated');
        expect(weakestBasis(['measured', 'unknown'])).toBe('unknown');
        expect(weakestBasis([])).toBe('unknown');
    });

    it('the old literals are gone from the migrated modules, not aliased', async () => {
        // AC-5's verify is the ABSENCE of the old literals, not the presence of
        // the contract — checked against the real files.
        const fs = await import('node:fs');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
        const census = fs.readFileSync(path.join(root, 'src/scripts/preamble_byte_census.ts'), 'utf-8');
        // The only surviving mentions are the migration note explaining them.
        const live = census.split('\n').filter((l) => /'(measured_local_file|residual)'/.test(l) && !l.trim().startsWith('*'));
        expect(live).toEqual([]);
    });
});

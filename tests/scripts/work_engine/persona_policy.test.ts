// Tests for work_engine/persona_policy.ts (ADR-094 py2ts Phase 1). Covers:
// every shipped persona resolves to the right policy flags, the default-on-miss
// fallback (None / unknown / non-string), and known_personas insertion order.
// Policy objects are projected to asdict() dicts to assert field-name + value
// parity in declaration order.
import { describe, expect, it } from 'vitest';

import type {
    PersonaPolicy} from '../../../src/agent-src/templates/scripts/work_engine/persona_policy.js';
import {
    DEFAULT_PERSONA,
    known_personas,
    resolve_policy,
} from '../../../src/agent-src/templates/scripts/work_engine/persona_policy.js';

/** asdict-equivalent projection of a TS PersonaPolicy, in Python field order. */
function asdict(p: PersonaPolicy): Record<string, unknown> {
    return {
        name: p.name,
        allows_implement: p.allows_implement,
        allows_test: p.allows_test,
        allows_verify: p.allows_verify,
        widen_tests: p.widen_tests,
        suggests_next_commands: p.suggests_next_commands,
    };
}

describe('work_engine/persona_policy', () => {
    it('DEFAULT_PERSONA is senior-engineer', () => {
        expect(DEFAULT_PERSONA).toBe('senior-engineer');
    });

    it('senior-engineer: runs every step, no widening', () => {
        expect(asdict(resolve_policy('senior-engineer'))).toEqual({
            name: 'senior-engineer',
            allows_implement: true,
            allows_test: true,
            allows_verify: true,
            widen_tests: false,
            suggests_next_commands: true,
        });
    });

    it('qa: widens tests', () => {
        const p = resolve_policy('qa');
        expect(p.widen_tests).toBe(true);
        expect(p.allows_implement).toBe(true);
    });

    it('advisory: plan-only, no next-command suggestions', () => {
        expect(asdict(resolve_policy('advisory'))).toEqual({
            name: 'advisory',
            allows_implement: false,
            allows_test: false,
            allows_verify: false,
            widen_tests: false,
            suggests_next_commands: false,
        });
    });

    it('unknown / null / non-string fall back to the default policy', () => {
        const def = asdict(resolve_policy('senior-engineer'));
        expect(asdict(resolve_policy('bogus'))).toEqual(def);
        expect(asdict(resolve_policy(null))).toEqual(def);
        expect(asdict(resolve_policy(undefined))).toEqual(def);
        expect(asdict(resolve_policy(42))).toEqual(def);
        expect(asdict(resolve_policy(''))).toEqual(def);
    });

    it('known_personas returns insertion order', () => {
        expect(known_personas()).toEqual(['senior-engineer', 'qa', 'advisory']);
    });

    it('policy objects are frozen (read-only configuration)', () => {
        const p = resolve_policy('qa');
        expect(() => {
            (p as unknown as { widen_tests: boolean }).widen_tests = false;
        }).toThrow();
    });
});

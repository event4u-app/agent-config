// Unit tests for the injection-effect record
// (`src/scripts/_lib/injection_effect.ts` + `report_host_injection_effect.ts` —
// road-to-delivery-on-hook-hosts 1.1-1.3).
//
// The property under test is a REFUSAL, so most of these assert that something
// does NOT happen: a bound slot must never become an observation, and a
// half-cited observation must never be accepted. Owner ruling E3 and the
// roadmap's K1 both turn on exactly that, and `cowork` is the live proof — eight
// slots bound, measured `observed-false`.
import { describe, expect, it } from 'vitest';

import {
    INJECTION_STATES,
    admissibleUnderE3,
    concernBound,
    loadRecord,
    recordProblems,
    stateFor,
    type InjectionRecord,
} from '../../src/scripts/_lib/injection_effect.js';
import {
    boundSlotCount,
    hostIds,
    loadPlatforms,
    REPO_ROOT,
} from '../../src/scripts/report_host_injection_effect.js';

const cited = {
    state: 'observed-true' as const,
    host_version: '1.2.3',
    transcript: 'agents/evidence/whatever.md',
    date: '2026-09-08',
    reason: 'a reason long enough to clear the twenty-character floor',
};

describe('a binding is never an observation', () => {
    it('stateFor defaults to unobserved for a host nobody recorded', () => {
        expect(stateFor({}, 'cursor')).toBe('unobserved');
    });

    it('a host bound on the slot is still unobserved', () => {
        const platforms = { cursor: { user_prompt_submit: ['rule-inject'] } };
        expect(concernBound(platforms, 'cursor', 'user_prompt_submit', 'rule-inject')).toBe(true);
        expect(stateFor({}, 'cursor')).toBe('unobserved');
        expect(admissibleUnderE3({}, 'cursor')).toBe(false);
    });

    it('admission reads the observed column only', () => {
        const rec: InjectionRecord = { a: cited, b: { ...cited, state: 'observed-false' } };
        expect(admissibleUnderE3(rec, 'a')).toBe(true);
        expect(admissibleUnderE3(rec, 'b')).toBe(false);
        expect(admissibleUnderE3(rec, 'nobody')).toBe(false);
    });
});

describe('the citation requirement is enforced, not advisory', () => {
    it('a fully cited observation passes', () => {
        expect(recordProblems({ h: cited })).toEqual([]);
    });

    it.each(['host_version', 'transcript', 'date'] as const)(
        'an observed-* row missing %s is rejected rather than downgraded',
        (field) => {
            const problems = recordProblems({ h: { ...cited, [field]: null } });
            expect(problems.length).toBe(1);
            expect(problems[0]?.message).toContain(field);
            // Rejected, NOT silently turned into `unobserved` — a downgrade would
            // hide the fact that someone tried to record an observation.
            expect(stateFor({ h: { ...cited, [field]: null } }, 'h')).toBe('observed-true');
        },
    );

    it('unobserved needs only its reason', () => {
        const row = { state: 'unobserved' as const, host_version: null, transcript: null, date: null, reason: 'nobody has looked at this host yet' };
        expect(recordProblems({ h: row })).toEqual([]);
    });

    it('a reason too short to explain anything is a problem', () => {
        const row = { state: 'unobserved' as const, host_version: null, transcript: null, date: null, reason: 'no' };
        expect(recordProblems({ h: row })[0]?.message).toContain('reason');
    });

    it('an invalid state is named, not coerced', () => {
        const row = { ...cited, state: 'probably' as unknown as 'observed-true' };
        expect(recordProblems({ h: row })[0]?.message).toContain('not one of');
    });

    it('underscore keys are annotations, not hosts', () => {
        expect(recordProblems({ _comment: 'x' as unknown as typeof cited })).toEqual([]);
        expect(hostIds({ _comment: 'x' as unknown as typeof cited, cursor: cited })).toEqual(['cursor']);
    });
});

describe('the committed record and the live manifest', () => {
    it('every shipped row is admissible', () => {
        expect(recordProblems(loadRecord(REPO_ROOT))).toEqual([]);
    });

    it('every state in the record is in the closed vocabulary', () => {
        const rec = loadRecord(REPO_ROOT);
        for (const h of hostIds(rec)) {
            expect(INJECTION_STATES).toContain(rec[h]?.state);
        }
    });

    it('the slot count matches the host table rather than the raw key count', () => {
        // `fallback_only` is a marker, not a lifecycle slot. Counting it made
        // copilot read 1 against the 0 `docs/enforcement-by-host.md` records.
        const platforms = loadPlatforms(REPO_ROOT);
        expect(boundSlotCount(platforms, 'copilot')).toBe(0);
        expect(Object.keys(platforms['copilot'] ?? {})).toEqual(['fallback_only']);
        expect(boundSlotCount(platforms, 'claude')).toBe(9);
        expect(boundSlotCount(platforms, 'cowork')).toBe(8);
    });

    it('cowork is bound on many slots and is still not admissible — the whole point', () => {
        const rec = loadRecord(REPO_ROOT);
        const platforms = loadPlatforms(REPO_ROOT);
        expect(boundSlotCount(platforms, 'cowork')).toBeGreaterThan(5);
        expect(stateFor(rec, 'cowork')).toBe('observed-false');
        expect(admissibleUnderE3(rec, 'cowork')).toBe(false);
    });

    it('no shipped host is admissible today', () => {
        const rec = loadRecord(REPO_ROOT);
        expect(hostIds(rec).filter((h) => admissibleUnderE3(rec, h))).toEqual([]);
    });
});

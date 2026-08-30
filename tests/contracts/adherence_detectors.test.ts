/**
 * road-to-experience-loop-broadening step 5.2.
 *
 * verify: at least one rule has a deterministic adherence detector, and the
 * rest report `unknown` rather than a model's guess.
 */
import { describe, expect, it } from 'vitest';

import {
    detectAdherence,
    detectorsFor,
    isTestPath,
    rulesWithDetectors,
    testFirstDetector,
} from '../../src/scripts/_lib/adherence_detectors.js';

const w = (path: string, seq: number) => ({ path, seq });

describe('at least one rule has a deterministic detector', () => {
    it('think-before-action has one, anchored on a clause that exists', () => {
        expect(rulesWithDetectors()).toContain('think-before-action');
        expect(detectorsFor('think-before-action').length).toBeGreaterThan(0);
    });

    it('the detector names the clause it decides, not the whole rule', () => {
        // A rule carries many clauses. A detector observing write order decides
        // the test-first clause and nothing else; claiming it decided
        // `think-before-action` would be overclaiming by construction.
        expect(testFirstDetector.clause).toMatch(/test-first/);
        expect(testFirstDetector.source).toBe('dist/agent-src/rules/think-before-action.md:43');
    });

    it('is deterministic — test before production is followed, the reverse is not', () => {
        expect(
            detectAdherence('think-before-action', {
                writes: [w('tests/foo.test.ts', 1), w('src/foo.ts', 2)],
            }),
        ).toBe('activated-followed');

        expect(
            detectAdherence('think-before-action', {
                writes: [w('src/foo.ts', 1), w('tests/foo.test.ts', 2)],
            }),
        ).toBe('activated-not-followed');
    });

    it('reads order from seq, not from array position', () => {
        // Guards against a detector that "works" only because the fixture
        // happened to be sorted.
        expect(
            detectAdherence('think-before-action', {
                writes: [w('src/foo.ts', 9), w('tests/foo.test.ts', 1)],
            }),
        ).toBe('activated-followed');
    });
});

describe('everything else reports unknown rather than a guess', () => {
    it('an unregistered rule is unknown, not a failure', () => {
        // The important half: 118 of this tree's 119 rules have no observable
        // footprint. The honest report says `unknown` for all of them instead
        // of filling the column with inference.
        for (const ruleId of ['verify-before-complete', 'commit-policy', 'scope-control', 'no-such-rule']) {
            expect(detectAdherence(ruleId, { writes: [w('src/a.ts', 1)] })).toBe('unknown');
        }
    });

    it('a one-sided observation is unknown, in BOTH directions', () => {
        // Production-only is the tempting one to call a violation, and calling
        // it one would be a guess: the test may exist from an earlier task, or
        // the clause's own "when behavior can be defined" qualifier may exclude
        // the change. Unknown is the honest answer and never manufactures a
        // violation.
        expect(
            detectAdherence('think-before-action', { writes: [w('src/foo.ts', 1)] }),
        ).toBe('unknown');
        expect(
            detectAdherence('think-before-action', { writes: [w('tests/foo.test.ts', 1)] }),
        ).toBe('unknown');
        expect(detectAdherence('think-before-action', { writes: [] })).toBe('unknown');
    });

    it('never returns a state outside the three it may return', () => {
        const seen = new Set([
            detectAdherence('think-before-action', { writes: [w('tests/a.test.ts', 1), w('src/a.ts', 2)] }),
            detectAdherence('think-before-action', { writes: [w('src/a.ts', 1), w('tests/a.test.ts', 2)] }),
            detectAdherence('unregistered', { writes: [] }),
        ]);
        for (const v of seen) {
            expect(['activated-followed', 'activated-not-followed', 'unknown']).toContain(v);
        }
    });
});

describe('isTestPath — the footprint the detector reads', () => {
    it.each([
        ['tests/foo.test.ts', true],
        ['test/foo.ts', true],
        ['src/foo.test.ts', true],
        ['src/foo.spec.tsx', true],
        ['tests\\windows\\path.ts', true],
        ['src/foo.ts', false],
        ['src/scripts/latest.ts', false],
        ['docs/contest.md', false],
    ])('%s → %s', (p, expected) => {
        expect(isTestPath(p)).toBe(expected);
    });
});

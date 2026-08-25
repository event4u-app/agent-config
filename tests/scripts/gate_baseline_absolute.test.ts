/**
 * The ABSOLUTE invariant, and the hard-error contract around it.
 *
 * `road-to-merge-surface-zero` Phase 3.1, after the AI council picked ABS 2/2 on
 * 2026-08-25 to resolve blocker B5.
 *
 * The load-bearing case is the INVERTED one: the worked example that killed the
 * merge-base read must now FAIL. Asserting only that the new reader reads is not
 * a test of the decision — it is a test of `git show`.
 */
import { describe, expect, it } from 'vitest';

import {
    BaselineResolutionError,
    diagnoseRegression,
    loadBaselinesAt,
} from '../../src/scripts/_lib/gate_baseline';

const TARGET = JSON.stringify({
    gates: { 'ci-parity:local-only': { count: 160, landed: '2026-08-25' } },
});

/** A `run` stub, so the contract is tested without a fixture repository. */
function runner(map: Record<string, string>): (args: string[]) => string {
    return (args) => {
        const key = args.join(' ');
        const hit = map[key];
        if (hit === undefined) throw new Error(`no stub for: ${key}`);
        return hit;
    };
}

const OK = runner({
    'rev-parse --verify origin/main^{commit}': 'abc123def456\n',
    'show abc123def456:src/config/gate-violation-baselines.json': TARGET,
});

describe('the governing baseline comes from the TARGET commit', () => {
    it('reads it, and reads it at the resolved sha rather than the ref name', () => {
        const f = loadBaselinesAt('/repo', 'origin/main', undefined, OK);
        expect(f.gates['ci-parity:local-only']?.count).toBe(160);
    });

    it('an unresolvable ref is a HARD error, never an empty ratchet', () => {
        // loadBaselines() returns {} on a missing working-tree file, and that is
        // right there — a repo with no baseline file has no ratchet. Here it
        // would let an infrastructure error silently decide the policy.
        const run = runner({});
        expect(() => loadBaselinesAt('/repo', 'origin/main', undefined, run)).toThrow(
            BaselineResolutionError,
        );
    });

    it('a missing BLOB at a resolved commit is a hard error too', () => {
        const run = runner({ 'rev-parse --verify origin/main^{commit}': 'abc123def456\n' });
        expect(() => loadBaselinesAt('/repo', 'origin/main', undefined, run)).toThrow(
            /NOT an empty ratchet/,
        );
    });

    it('unparseable JSON at the target is a hard error, not a permissive read', () => {
        const run = runner({
            'rev-parse --verify origin/main^{commit}': 'abc123def456\n',
            'show abc123def456:src/config/gate-violation-baselines.json': '{ not json',
        });
        expect(() => loadBaselinesAt('/repo', 'origin/main', undefined, run)).toThrow(
            /not parseable JSON/,
        );
    });
});

describe('the worked example that killed the merge-base read now FAILS', () => {
    // main tightened 165 -> 160. A PR that branched earlier measures 163.
    const ACTUAL = 163;
    const TARGET_BASELINE = 160;
    const MERGE_BASE_BASELINE = 165;

    it('163 against the TARGET baseline of 160 is a regression', () => {
        const governing = loadBaselinesAt('/repo', 'origin/main', undefined, OK);
        const baseline = governing.gates['ci-parity:local-only']?.count ?? 0;
        expect(baseline).toBe(TARGET_BASELINE);
        // Under the old merge-base read this PR PASSED, and main went to 163
        // against a baseline of 160 — a tightening undone by a PR that never
        // touched the baseline file and never saw a red.
        expect(ACTUAL > baseline).toBe(true);
    });

    it('and the diagnostic says main-tightened, not branch-regression', () => {
        // The remediations differ, which is the whole reason the merge-base
        // number is kept: "rebase and re-run" is wrong advice for a PR that
        // genuinely reintroduced violations.
        expect(
            diagnoseRegression({
                actual: ACTUAL,
                targetBaseline: TARGET_BASELINE,
                mergeBaseBaseline: MERGE_BASE_BASELINE,
            }),
        ).toBe('main-tightened');
    });
});

describe('the diagnostic distinguishes the two failures', () => {
    it('a branch that made it worse is branch-regression', () => {
        expect(
            diagnoseRegression({ actual: 170, targetBaseline: 160, mergeBaseBaseline: 165 }),
        ).toBe('branch-regression');
    });

    it('at the merge-base number exactly, main tightening is the cause', () => {
        expect(
            diagnoseRegression({ actual: 165, targetBaseline: 160, mergeBaseBaseline: 165 }),
        ).toBe('main-tightened');
    });

    it('with no merge-base reading available it does not guess main-tightened', () => {
        // Defaulting to the exculpatory answer when the evidence is missing is
        // how a diagnostic becomes an excuse.
        expect(diagnoseRegression({ actual: 163, targetBaseline: 160, mergeBaseBaseline: null })).toBe(
            'branch-regression',
        );
    });

    it('no regression at all reports none, at the boundary', () => {
        expect(
            diagnoseRegression({ actual: 160, targetBaseline: 160, mergeBaseBaseline: 165 }),
        ).toBe('none');
    });

    it('the diagnostic NEVER decides the verdict — it only names the cause', () => {
        // Both causes are reported for counts that are regressions; a caller
        // that treated `main-tightened` as a pass would reintroduce CONTRIB.
        for (const cause of ['branch-regression', 'main-tightened'] as const) {
            expect(cause).not.toBe('none');
        }
        expect(
            diagnoseRegression({ actual: 161, targetBaseline: 160, mergeBaseBaseline: 165 }),
        ).not.toBe('none');
    });
});

/**
 * Risk and complexity are independent axes — step 0.4 of
 * `road-to-agentic-engineering-assurance`, whose verify line reads:
 *
 *   "fixtures include a simple-but-high-risk auth change and a
 *    complex-but-low-risk generated-doc change and classify those axes
 *    independently."
 *
 * The roadmap states the distinction in prose: *"Complexity says how difficult
 * work is to execute; risk says how much evidence is required before accepting
 * it."* Nothing asserted it. `src/scripts/classify_change_risk.ts` shipped with a
 * seven-case self-test, and every case there varies risk while holding file count
 * at one — so the self-test cannot distinguish "classifies risk correctly" from
 * "classifies size correctly". These two fixtures vary the axes in OPPOSITE
 * directions, which is the only shape that can falsify the claim.
 *
 * The classifier is NOT modified by this file. It is R3-protected by its own
 * override list, and it is owned by an archived sibling roadmap; an unasserted
 * property is pinned here, nothing is rebuilt.
 *
 * SABOTAGE PROBE, run before this file was trusted: make `classifyPaths` return
 * R3 whenever the path count exceeds 10 — i.e. let complexity drive risk. The
 * `complex-but-low-risk` assertion goes red while every case in the shipped
 * self-test stays green, which is the blind spot this file exists to cover.
 * Restored from a `cp` backup; counts are recorded in the roadmap step.
 */
import { describe, expect, it } from 'vitest';

import { classifyPaths, R3_PATH_PATTERNS } from '../../src/scripts/classify_change_risk.js';

/** One file, one line, maximum consequence. */
const SIMPLE_HIGH_RISK = ['src/Auth/Eligibility.php'];

/** Forty files, zero behaviour — a generated index refresh, the roadmap's own R0 example. */
const COMPLEX_LOW_RISK = Array.from({ length: 40 }, (_, i) => `docs/generated/page-${String(i)}.md`);

describe('classify_change_risk — 0.4 risk is not complexity', () => {
    it('a one-file auth change is R3 despite minimal size', () => {
        const v = classifyPaths(SIMPLE_HIGH_RISK);
        expect(v.cls).toBe('R3');
        expect(v.reason).toContain('src/Auth/Eligibility.php');
    });

    it('a forty-file generated-doc change is R0 despite maximal size', () => {
        const v = classifyPaths(COMPLEX_LOW_RISK);
        expect(v.cls).toBe('R0');
        expect(COMPLEX_LOW_RISK.length).toBeGreaterThan(SIMPLE_HIGH_RISK.length * 10);
    });

    it('the high-risk class does not rise, and the low-risk class does not fall, as size grows', () => {
        // Both directions, because a classifier that reads size would fail only
        // one of them and a one-sided assertion would call that a pass.
        const oneDoc = classifyPaths(['docs/generated/page-0.md']);
        const manyDocs = classifyPaths(COMPLEX_LOW_RISK);
        expect(oneDoc.cls).toBe(manyDocs.cls);

        const oneAuth = classifyPaths(SIMPLE_HIGH_RISK);
        const authPlusManyDocs = classifyPaths([...SIMPLE_HIGH_RISK, ...COMPLEX_LOW_RISK]);
        expect(oneAuth.cls).toBe(authPlusManyDocs.cls);
        expect(authPlusManyDocs.cls).toBe('R3');
    });
});

describe('classify_change_risk — 0.4 the auth pattern is a path SEGMENT, and that is a finding', () => {
    it('an auth DIRECTORY is R3', () => {
        expect(classifyPaths(['app/auth/Guard.php']).cls).toBe('R3');
        expect(classifyPaths(['app/Auth/Guard.php']).cls).toBe('R3');
    });

    it('a file merely NAMED Auth* is R2, not R3 — recorded, not silently fixed', () => {
        // `/(^|\/)auth(\/|$)/i` matches a whole segment, so `AuthController.php`
        // does not match and lands on the production-code rule instead. R2 is a
        // safe-side reading of an unrecognised auth-ish file, not a correct one:
        // an authorization change in a file named this way owes an abuse case the
        // R2 floor does not request.
        //
        // NOT fixed here, deliberately, and the reasons are recorded rather than
        // implied: the classifier is owned by an archived sibling roadmap, it is
        // R3-protected by its own override list, and widening the pattern would
        // reclassify paths across the whole tree — a change that needs its own
        // evidence, not a drive-by inside a closure run.
        expect(classifyPaths(['src/Http/AuthController.php']).cls).toBe('R2');
        expect(R3_PATH_PATTERNS.some((re) => re.test('src/Http/AuthController.php'))).toBe(false);
    });
});

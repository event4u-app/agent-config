// Tests for src/scripts/check_safety_floor_untouched.ts.
//
// HISTORY (2026-07-29 audit, agents/settings/contexts/gates-that-cannot-fail.md):
// this suite used to assert `RULES_DIR_REL === '.agent-src.uncondensed/rules'` —
// i.e. it PINNED the defect. That path stopped existing at ADR-051, so the guard
// compared diffs against paths absent from every commit and reported
// "✅ Safety-floor untouched (4 rules guarded)" no matter what was edited. The
// gate was structurally incapable of failing, and this file made fixing it look
// like a regression.
//
// The replacement asserts BEHAVIOUR in both directions: a changed-file set that
// touches a floor rule must be rejected, one that does not must pass, and the
// guarded paths must resolve on disk.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as sf from '../../src/scripts/check_safety_floor_untouched.js';

describe('check_safety_floor_untouched — behavioural spec', () => {
    it('guards exactly the four safety-floor rules', () => {
        expect([...sf.SAFETY_FLOOR]).toEqual([
            'non-destructive-by-default.md',
            'commit-policy.md',
            'scope-control.md',
            'verify-before-complete.md',
        ]);
    });

    it('watches the CURRENT authoring root only — no retired container', () => {
        expect(sf.RULES_DIR_REL).toBe('src/rules');
        // The retired source container must not creep back in: a dead path kept
        // alive for an unmeasured scenario is how the original defect survived
        // (and `check_no_new_legacy_path` enforces the same thing repo-wide).
        expect(sf._floor_candidates().every((p) => !p.includes('.agent-src.uncondensed'))).toBe(
            true,
        );
    });

    it('every guarded floor file resolves on disk (the guard is not watching phantoms)', () => {
        // This is the assertion whose absence let the gate die silently: if the
        // rules move again, this fails instead of the guard going quietly green.
        const present = sf.SAFETY_FLOOR.filter((name) =>
            fs.existsSync(path.join(sf.REPO_ROOT, sf.RULES_DIR_REL, name)),
        );
        expect(present).toHaveLength(sf.SAFETY_FLOOR.length);
    });

    it('REJECTS a changed-file set that touches a floor rule', () => {
        const breaches = sf._breaches([
            'README.md',
            'src/rules/commit-policy.md',
            'src/scripts/whatever.ts',
        ]);
        expect(breaches).toEqual(['src/rules/commit-policy.md']);
    });

    it('rejects every guarded floor rule, not just the first', () => {
        expect(sf._breaches(['src/rules/scope-control.md'])).toEqual([
            'src/rules/scope-control.md',
        ]);
        expect(sf._breaches(['src/rules/verify-before-complete.md'])).toEqual([
            'src/rules/verify-before-complete.md',
        ]);
    });

    it('PASSES a changed-file set that touches no floor rule', () => {
        expect(
            sf._breaches(['README.md', 'src/rules/telegraph-speak.md', 'docs/proof.md']),
        ).toEqual([]);
    });

    it('does not confuse a same-named rule outside the guarded roots', () => {
        // A projection copy is not the source of truth and must not trip the gate.
        expect(sf._breaches(['dist/agent-src/rules/commit-policy.md'])).toEqual([]);
    });

    it('regression lock: the guarded set is non-empty', () => {
        // The whole defect class in one line — an empty candidate set means the
        // gate can never fire, which is exactly how it shipped for months.
        expect(sf._floor_candidates().length).toBeGreaterThan(0);
        expect(sf._floor_candidates()).toContain('src/rules/commit-policy.md');
    });
});

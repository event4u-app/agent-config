// Round 7 § Phase 3 — the `preflight` dimension of the CI ↔ local parity gate.
//
// The gate had no test file at all, so the two pre-existing directions are pinned
// here as well: a new dimension added to an untested reporter is how a report that
// silently stops computing anything survives review.
//
// Every assertion is an INVARIANT over the derived sets, never a hardcoded count.
// The counts move whenever a gate is added, and a test asserting "221" would fail
// on the next unrelated gate while proving nothing about the relation it exists to
// check.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    analyse,
    extract_gates,
    extract_tasks,
    load_tasks,
    local_closure,
    REPO,
    strip_yaml_comments,
} from '../../src/scripts/check_ci_local_parity.js';

const report = analyse();

describe('check_ci_local_parity — the preflight dimension (round 7)', () => {
    it('derives a non-empty preflight closure', () => {
        // Zero would mean the root name stopped resolving — the "a gate that scans
        // nothing exits green" shape this repo has been bitten by.
        expect(report.preflight_gates.length).toBeGreaterThan(0);
    });

    it('preflight is a SUBSET of the local closure, because `task ci` includes it', () => {
        const local = new Set(report.local_gates);
        for (const g of report.preflight_gates) {
            expect(local.has(g), `${g} is in preflight but not in the local closure`).toBe(true);
        }
    });

    it('the reported gap is disjoint from preflight — by definition, so a bug here is silent', () => {
        const pre = new Set(report.preflight_gates);
        for (const g of report.ci_not_in_preflight) {
            expect(pre.has(g), `${g} is reported as missing from preflight but is in it`).toBe(false);
        }
    });

    it('every gap entry is CI-enforced AND locally reachable', () => {
        const ci = new Set(report.ci_gates);
        const local = new Set(report.local_gates);
        for (const g of report.ci_not_in_preflight) {
            expect(ci.has(g), `${g} is in the gap but not in CI`).toBe(true);
            expect(local.has(g), `${g} is in the gap but not locally reachable`).toBe(true);
        }
    });

    it('the gap is non-empty — if it ever empties, the report should be deleted, not left lying', () => {
        // Measured 22 preflight / 221 gap on 2026-08-12. Asserted as a relation so
        // the test survives gate churn: preflight must stay a PROPER subset while
        // the two roots differ, which is the fact the docstring now states.
        expect(report.ci_not_in_preflight.length).toBeGreaterThan(0);
        expect(report.preflight_gates.length).toBeLessThan(report.local_gates.length);
    });
});

describe('check_ci_local_parity — the two pre-existing directions still hold', () => {
    it('reports no undeclared CI-only drift on the committed tree', () => {
        expect(report.undeclared_ci_only).toEqual([]);
    });

    /**
     * This assertion used to read `expect(report.undeclared_local_only).toEqual([])`
     * and it passed for the wrong reason — the extractor counted comment text, so
     * the set was empty by construction rather than because parity held. A test
     * that pins a defect is worse than no test, because it converts the defect
     * into a thing later changes must preserve.
     *
     * The honest invariant is the ratchet's: the count may not RISE above the
     * recorded baseline. Reading the number from the baseline file rather than
     * hardcoding it keeps this true across every legitimate lowering commit.
     */
    it('local-only drift stays at or below its recorded baseline', () => {
        const baselines = JSON.parse(
            fs.readFileSync(path.join(REPO, 'src/config/gate-violation-baselines.json'), 'utf-8'),
        ) as { gates: Record<string, { count: number }> };
        const recorded = baselines.gates['ci-parity:local-only']?.count;

        expect(recorded, 'the ci-parity baseline entry has gone missing').toBeGreaterThan(0);
        expect(report.undeclared_local_only.length).toBeLessThanOrEqual(recorded as number);
    });

    it('the local-only direction is not silently empty — it reports real gates', () => {
        // The counterpart to the ratchet: a repair that accidentally re-blinded
        // the extractor would drop this to 0 and satisfy the ceiling above.
        expect(report.undeclared_local_only.length).toBeGreaterThan(0);
    });

    it('carries no stale declarations', () => {
        expect(report.stale_declarations).toEqual([]);
    });

    it('the derivation reads both sides — neither side is empty', () => {
        expect(report.ci_gates.length).toBeGreaterThan(0);
        expect(report.local_gates.length).toBeGreaterThan(0);
    });
});

describe('check_ci_local_parity — the extractors it derives from', () => {
    it('extract_gates finds a scripts-run invocation', () => {
        expect(extract_gates('- ./scripts-run src/scripts/lint_example --quiet')).toContain('lint_example');
    });

    it('extract_tasks finds a `task <name>` reference', () => {
        // `task <name>`, with a space — NOT the YAML `task: <name>` dependency
        // form. Asserted because the first version of this test assumed the
        // colon form and passed vacuously against an empty set.
        expect(extract_tasks('run: task check-refs')).toContain('check-refs');
    });

    it('local_closure on an unknown root is empty, not a throw', () => {
        expect([...local_closure(['no-such-task-here'], load_tasks())]).toEqual([]);
    });
});

describe('a comment is not an invocation', () => {
    /**
     * The defect this pins was live for the whole life of the gate, and it was
     * self-inflicted in an exact sense: workflow comments SAY `task ci` in order
     * to state that no workflow invokes it, and the extractor read those words as
     * the invocation they deny. `ci` then expanded to its full closure, so
     * `undeclared_local_only` was 0 by construction — the gate could not report
     * the one direction its own manifest header calls the one that let real
     * defects merge.
     */
    it('strips a full-line comment', () => {
        expect(strip_yaml_comments('# no workflow invokes `task ci`').trim()).toBe('');
    });

    it('strips a trailing comment but keeps the command before it', () => {
        const line = 'run: task check-refs  # unlike `task ci`, this one really runs';
        const out = strip_yaml_comments(line);
        expect(extract_tasks(out)).toContain('check-refs');
        expect(extract_tasks(out)).not.toContain('ci');
    });

    it('does not eat a `#` that carries no leading whitespace, e.g. a fragment', () => {
        // The strip is deliberately crude, but it must not swallow a URL fragment
        // or an anchor glued to the token before it.
        expect(strip_yaml_comments('run: ./x --ref=abc#frag')).toContain('abc#frag');
    });

    it('the real workflow corpus no longer yields `ci` as an invoked task', () => {
        // The end-to-end property, asserted against the tree rather than a
        // fixture: if this flips back, every `task ci` gate silently counts as
        // CI-covered again and the local-only direction goes quiet.
        const dir = path.join(REPO, '.github', 'workflows');
        const raw = fs
            .readdirSync(dir)
            .filter((f) => /\.ya?ml$/.test(f))
            .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
            .join('\n');

        expect(extract_tasks(raw).has('ci'), 'precondition: the comments still say `task ci`').toBe(true);
        expect(extract_tasks(strip_yaml_comments(raw)).has('ci')).toBe(false);
    });

    it('the CI-side set is now smaller than the local closure it used to swallow', () => {
        // Before the repair the CI side contained every `task ci` gate, so it was
        // necessarily a superset of the local closure. That relation is the
        // signature of the bug; asserting its absence is what keeps the repair.
        const local = new Set(report.local_gates);
        const missing = [...local].filter((g) => !report.ci_gates.includes(g));
        expect(missing.length, 'CI side still swallows the whole local closure').toBeGreaterThan(0);
    });
});

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
import { describe, expect, it } from 'vitest';

import { analyse, extract_gates, extract_tasks, load_tasks, local_closure } from '../../src/scripts/check_ci_local_parity.js';

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
    it('reports no undeclared drift on the committed tree', () => {
        expect(report.undeclared_ci_only).toEqual([]);
        expect(report.undeclared_local_only).toEqual([]);
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

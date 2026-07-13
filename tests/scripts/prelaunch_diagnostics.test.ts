/**
 * Acceptance tests for the pre-launch diagnostic contract
 * (road-to-ecosystem-harvest-prelaunch-diagnostics):
 *
 *  - finding IDs are immutable + diff-stable (a retitled finding produces
 *    an empty diff — the ID, not the title, is the key);
 *  - an open P0 refuses a "ready" verdict regardless of every other area;
 *  - epistemics: pass needs evidence, N/A needs a reason, Unknown ≠ Pass;
 *  - suppression needs a receipt (reason + evidence) and never rescues a P0;
 *  - the --ci gate trips on a new open P0/P1 and on a launch-gate
 *    Pass→Finding flip, and NOT on suppressed or P2/P3 findings.
 */
import { describe, expect, it } from 'vitest';

import {
    diff_reports,
    load_areas,
    validate_report,
    verdict,
    type Finding,
    type Report,
} from '../../src/scripts/prelaunch_diagnostics.js';

const AREAS = load_areas();

function finding(over: Partial<Finding> = {}): Finding {
    return {
        id: 'AC-AUTH-001',
        area: 'auth',
        severity: 'P2',
        title: 'Session cookie missing SameSite',
        evidence: 'app/http/session.php:12',
        status: 'open',
        ...over,
    };
}

function report(over: Partial<Report> = {}): Report {
    return {
        schema_version: 'prelaunch-report-v1',
        project: 'demo',
        run_at: '2026-07-13T00:00:00Z',
        areas: {
            auth: { state: 'pass', evidence: 'authz-review run 2026-07-12' },
            migrations: { state: 'not-applicable', reason: 'no DB in this launch' },
            secrets: { state: 'pass', evidence: 'secrets scan run #42' },
            observability: { state: 'unknown' },
            rollback: { state: 'pass', evidence: 'rollback rehearsed, runbook v3' },
            'agent-governance': { state: 'not-applicable', reason: 'no agent surface shipped' },
        },
        findings: [],
        ...over,
    };
}

describe('area vocabulary', () => {
    it('loads the fixed six-area backbone with launch-gate flags', () => {
        expect(Object.keys(AREAS).sort()).toEqual(
            ['agent-governance', 'auth', 'migrations', 'observability', 'rollback', 'secrets'].sort(),
        );
        expect(AREAS['auth']?.launch_gate).toBe(true);
        expect(AREAS['observability']?.launch_gate).toBe(false);
    });
});

describe('validate_report — epistemics', () => {
    it('must-pass: a fully-cited report validates clean', () => {
        expect(validate_report(report(), AREAS)).toEqual([]);
    });

    it('must-fail: pass without evidence is assertion, not diagnosis', () => {
        const r = report();
        r.areas['auth'] = { state: 'pass' };
        const errors = validate_report(r, AREAS);
        expect(errors.some((e) => e.includes('auth') && e.includes('without evidence'))).toBe(true);
    });

    it('must-fail: not-applicable without a reason', () => {
        const r = report();
        r.areas['migrations'] = { state: 'not-applicable' };
        expect(validate_report(r, AREAS).some((e) => e.includes('migrations') && e.includes('reason'))).toBe(true);
    });

    it('must-fail: ID area code must agree with the area key', () => {
        const r = report({ findings: [finding({ id: 'AC-MIG-001', area: 'auth' })] });
        expect(validate_report(r, AREAS).some((e) => e.includes('does not match area'))).toBe(true);
    });

    it('must-fail: duplicate IDs (IDs are never re-assigned)', () => {
        const r = report({ findings: [finding(), finding({ title: 'other problem' })] });
        expect(validate_report(r, AREAS).some((e) => e.includes('duplicate finding ID'))).toBe(true);
    });

    it('must-fail: suppressed-with-evidence without a suppression receipt', () => {
        const r = report({ findings: [finding({ status: 'suppressed-with-evidence', reason: 'x' })] });
        expect(validate_report(r, AREAS, []).some((e) => e.includes('matching suppression entry'))).toBe(true);
    });

    it('must-pass: suppression with reason + evidence receipt validates', () => {
        const r = report({ findings: [finding({ status: 'suppressed-with-evidence', reason: 'covered elsewhere' })] });
        const sup = [{ id: 'AC-AUTH-001', reason: 'covered elsewhere', evidence: 'link' }];
        expect(validate_report(r, AREAS, sup)).toEqual([]);
    });
});

describe('verdict — ready is the residual state', () => {
    it('must-pass: cited-clean launch-gate areas + no open P0/P1 → ready', () => {
        expect(verdict(report(), AREAS).ready).toBe(true);
    });

    it('an open P0 refuses ready regardless of every other area', () => {
        const r = report({ findings: [finding({ severity: 'P0' })] });
        const v = verdict(r, AREAS);
        expect(v.ready).toBe(false);
        expect(v.blockers.some((b) => b.includes('P0'))).toBe(true);
    });

    it('a suppressed P0 still refuses ready (suppression never rescues a P0)', () => {
        const r = report({
            findings: [finding({ severity: 'P0', status: 'suppressed-with-evidence', reason: 'r' })],
        });
        expect(verdict(r, AREAS).ready).toBe(false);
    });

    it('Unknown ≠ Pass: a launch-gate area at unknown blocks the verdict', () => {
        const r = report();
        r.areas['rollback'] = { state: 'unknown' };
        const v = verdict(r, AREAS);
        expect(v.ready).toBe(false);
        expect(v.blockers.some((b) => b.includes('rollback') && b.includes('Unknown is never a Pass'))).toBe(true);
    });

    it('a non-gate area at unknown does not block alone', () => {
        const r = report();
        r.areas['observability'] = { state: 'unknown' };
        expect(verdict(r, AREAS).ready).toBe(true);
    });
});

describe('diff_reports — IDs are the key', () => {
    it('ID immutability: a retitled finding produces an empty diff', () => {
        const base = report({ findings: [finding({ title: 'old title' })] });
        const curr = report({ findings: [finding({ title: 'completely new title, same problem' })] });
        const d = diff_reports(base, curr, AREAS);
        expect(d.new_findings).toEqual([]);
        expect(d.ci_trips).toEqual([]);
    });

    it('--ci trips on a new open P1', () => {
        const base = report();
        const curr = report({ findings: [finding({ id: 'AC-SEC-001', area: 'secrets', severity: 'P1' })] });
        const d = diff_reports(base, curr, AREAS);
        expect(d.ci_trips.some((t) => t.includes('AC-SEC-001'))).toBe(true);
    });

    it('--ci does NOT trip on a new P2 or a suppressed new finding', () => {
        const base = report();
        const curr = report({
            findings: [
                finding({ id: 'AC-OBS-001', area: 'observability', severity: 'P2' }),
                finding({ id: 'AC-SEC-002', area: 'secrets', severity: 'P1', status: 'suppressed-with-evidence', reason: 'r' }),
            ],
        });
        const sup = [{ id: 'AC-SEC-002', reason: 'r', evidence: 'link' }];
        expect(diff_reports(base, curr, AREAS, sup).ci_trips).toEqual([]);
    });

    it('--ci trips on a launch-gate Pass→Finding flip', () => {
        const base = report();
        const curr = report();
        curr.areas['secrets'] = { state: 'finding' };
        const d = diff_reports(base, curr, AREAS);
        expect(d.regressed_areas).toEqual(['secrets']);
        expect(d.ci_trips.some((t) => t.includes("'secrets'"))).toBe(true);
    });

    it('resolved findings report informationally (open → fixed)', () => {
        const base = report({ findings: [finding()] });
        const curr = report({ findings: [finding({ status: 'fixed' })] });
        const d = diff_reports(base, curr, AREAS);
        expect(d.resolved.map((f) => f.id)).toEqual(['AC-AUTH-001']);
        expect(d.ci_trips).toEqual([]);
    });
});

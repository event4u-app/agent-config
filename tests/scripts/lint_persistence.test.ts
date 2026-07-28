/**
 * Tests for src/scripts/lint_persistence.ts — the persistence-lint substrate
 * (road-to-scale-and-history-discipline). Both directions per rule family:
 * violations detected, valid/waivered code passes. Fixture ground truth is
 * pre-registered in tests/fixtures/persistence/ + the spike verdicts in
 * docs/spikes/scale-history-spikes.md.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { run_lint, detect_stacks } from '../../src/scripts/lint_persistence.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'persistence');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const SCRIPT = path.join(REPO, 'src', 'scripts', 'lint_persistence.ts');

describe('raw-sql adapter (R-A6 migration-safety + R-A7 growth-budget)', () => {
    it('detects every unsafe fixture as a finding', () => {
        const report = run_lint(path.join(FIXTURES, 'migrations', 'unsafe'), ['raw-sql']);
        // 15 fixtures; 14 gate + 1 advice (dialect-unknown CREATE INDEX).
        expect(report.gate_count).toBe(14);
        expect(report.advice_count).toBe(1);
        expect(report.waived_count).toBe(0);
    });

    it('passes safe fixtures with zero gate findings (waivers reported, not counted)', () => {
        const report = run_lint(path.join(FIXTURES, 'migrations', 'safe'), ['raw-sql']);
        expect(report.gate_count).toBe(0);
        expect(report.advice_count).toBe(0);
        expect(report.waived_count).toBeGreaterThan(0);
        expect(report.empty_reason_waivers).toEqual([]);
    });
});

describe('eloquent adapter (R-A1 N+1)', () => {
    it('flags all true N+1 fixtures', () => {
        const report = run_lint(path.join(FIXTURES, 'n1', 'true'), ['eloquent']);
        const files = new Set(report.findings.filter((f) => f.rule === 'R-A1').map((f) => f.file));
        expect(files.size).toBe(10);
    });

    it('does not flag look-alike fixtures (eager loading, bounded loops, chunking)', () => {
        const report = run_lint(path.join(FIXTURES, 'n1', 'lookalike'), ['eloquent']);
        expect(report.findings.filter((f) => f.rule === 'R-A1' && !f.waived)).toEqual([]);
    });
});

describe('offload detection (R-A8 thin-request-path + R-A10 durable-async)', () => {
    it('flags all true eloquent offload fixtures', () => {
        const report = run_lint(path.join(FIXTURES, 'offload', 'eloquent', 'true'), ['eloquent']);
        const files = new Set(
            report.findings.filter((f) => !f.waived && (f.rule === 'R-A8' || f.rule === 'R-A10')).map((f) => f.file),
        );
        expect(files.size).toBe(10);
    });

    it('does not flag eloquent look-alikes (queued jobs/listeners, waivers, cheap ops)', () => {
        const report = run_lint(path.join(FIXTURES, 'offload', 'eloquent', 'lookalike'), ['eloquent']);
        expect(report.findings.filter((f) => !f.waived && (f.rule === 'R-A8' || f.rule === 'R-A10'))).toEqual([]);
    });

    it('flags all true TS offload fixtures and no TS look-alikes', () => {
        const true_report = run_lint(path.join(FIXTURES, 'offload', 'ts', 'true'), ['prisma']);
        const true_files = new Set(
            true_report.findings.filter((f) => !f.waived && (f.rule === 'R-A8' || f.rule === 'R-A10')).map((f) => f.file),
        );
        expect(true_files.size).toBe(10);

        const la_report = run_lint(path.join(FIXTURES, 'offload', 'ts', 'lookalike'), ['prisma']);
        expect(la_report.findings.filter((f) => !f.waived && (f.rule === 'R-A8' || f.rule === 'R-A10'))).toEqual([]);
    });
});

describe('bounded reads (R-A3) + fan-out heuristic (R-A9 advice)', () => {
    it('flags unbounded list reads, SELECT *, and emits the fan-out advice', () => {
        const report = run_lint(path.join(FIXTURES, 'bounded_reads', 'violation'), ['eloquent']);
        expect(report.findings.filter((f) => f.rule === 'R-A3' && !f.waived).length).toBe(4);
        const advice = report.findings.filter((f) => f.rule === 'R-A9');
        expect(advice.length).toBe(1);
        expect(advice[0]!.tier).toBe('advice');
    });

    it('passes bounded/paginated reads with zero findings', () => {
        const report = run_lint(path.join(FIXTURES, 'bounded_reads', 'pass'), ['eloquent']);
        expect(report.findings.filter((f) => !f.waived)).toEqual([]);
    });
});

describe('audit coverage (R-B1) — only with a declared scope', () => {
    it('finds the labeled uncovered mutations in the audit fixture repo', () => {
        const report = run_lint(path.join(FIXTURES, 'audit', 'repo'), ['eloquent']);
        const audit_findings = report.findings.filter((f) => f.rule === 'R-B1' && !f.waived);
        expect(audit_findings.length).toBe(11);
    });
});

describe('prisma growth budget (R-A7)', () => {
    it('flags append-only models without retention; honors retention + waiver', () => {
        const report = run_lint(path.join(FIXTURES, 'prisma_growth'), ['prisma']);
        const growth = report.findings.filter((f) => f.rule === 'R-A7');
        expect(growth.filter((f) => !f.waived).length).toBe(2); // AuditLog + UserSession
        expect(growth.filter((f) => f.waived).length).toBe(1); // LegalHoldEvent
    });
});

describe('pack projection scoping (Phase 5 verify)', () => {
    it('excludes pack rules for consumers without the packs and includes them when opted in', async () => {
        const { ruleFileArrives } = await import('../../src/install/rule_scope.js');
        const no_pack = { workspaces: ['engineering'], packs: ['engineering-base', 'git'] };
        const with_pack = { workspaces: ['engineering'], packs: ['engineering-base', 'scale-discipline', 'history-discipline'] };
        for (const r of ['src/rules/scale-discipline.md', 'src/rules/history-discipline.md']) {
            expect(ruleFileArrives(r, no_pack)).toBe(false);
            expect(ruleFileArrives(r, with_pack)).toBe(true);
        }
        // kernel sanity — scoping never drops a kernel rule
        expect(ruleFileArrives('src/rules/non-destructive-by-default.md', no_pack)).toBe(true);
    });
});

describe('stack detection + CLI contract', () => {
    it('detects stacks from directory contents', () => {
        expect(detect_stacks(path.join(FIXTURES, 'migrations'))).toContain('raw-sql');
        expect(detect_stacks(path.join(FIXTURES, 'n1'))).toContain('eloquent');
        expect(detect_stacks(path.join(FIXTURES, 'index_parity', 'prisma'))).toContain('prisma');
    });

    it('exits 1 on gate findings and 0 on clean dirs (subprocess)', () => {
        const bad = spawnSync(TSX, [SCRIPT, '--dir', path.join(FIXTURES, 'migrations', 'unsafe'), '--stack', 'raw-sql', '--quiet'], {
            cwd: REPO,
            encoding: 'utf8',
        });
        expect(bad.status).toBe(1);

        const good = spawnSync(TSX, [SCRIPT, '--dir', path.join(FIXTURES, 'migrations', 'safe'), '--stack', 'raw-sql', '--quiet'], {
            cwd: REPO,
            encoding: 'utf8',
        });
        expect(good.status).toBe(0);
    });

    it('emits machine-readable JSON with --format json', () => {
        const res = spawnSync(
            TSX,
            [SCRIPT, '--dir', path.join(FIXTURES, 'migrations', 'safe'), '--stack', 'raw-sql', '--format', 'json'],
            { cwd: REPO, encoding: 'utf8' },
        );
        const parsed = JSON.parse(res.stdout);
        expect(parsed.gate_count).toBe(0);
        expect(Array.isArray(parsed.findings)).toBe(true);
    });
});

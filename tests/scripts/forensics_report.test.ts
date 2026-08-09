/**
 * Paired fixtures for the forensic analyzers (`src/scripts/forensics_report.ts`),
 * road-to-judgment-and-forensic-evidence Phase 3.
 *
 * The load-bearing assertion is BYTE-stability (step 3.3): the same frozen
 * fixture inputs produce byte-identical report JSON, run to run and against
 * the committed expected file — the same determinism bar the condensation
 * pipeline holds. Plus the loud-fail on an empty scan (step 3.2), the bulk
 * commit skip, and the cross-module finding class (step 3.6).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { analyze, complexityOf, moduleOf, parseLog, toFindings } from '../../src/scripts/forensics_report.js';

const REPO_ROOT = process.cwd();
// CLI args stay repo-relative: the report embeds the passed path in its
// `range` field, and the committed expected bytes carry the relative form.
const FIXTURE_LOG = 'internal/bench/forensics/fixture-log.txt';
const FIXTURE_METRICS = 'internal/bench/forensics/fixture-metrics.json';
const EXPECTED = join(REPO_ROOT, 'internal/bench/forensics/expected-report.json');

function runCli(args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync(
        'npx',
        ['tsx', join(REPO_ROOT, 'src/scripts/forensics_report.ts'), ...args],
        { encoding: 'utf8', cwd: REPO_ROOT },
    );
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

describe('forensics_report — byte-stable determinism on the frozen fixture', () => {
    it('produces byte-identical output across two runs AND against the committed expected report', () => {
        const dir = mkdtempSync(join(tmpdir(), 'forensics-'));
        const out1 = join(dir, 'r1.json');
        const out2 = join(dir, 'r2.json');
        const args = ['--log-file', FIXTURE_LOG, '--metrics-file', FIXTURE_METRICS];
        const a = runCli([...args, '--out', out1]);
        const b = runCli([...args, '--out', out2]);
        expect(a.status).toBe(0);
        expect(b.status).toBe(0);
        const bytes1 = readFileSync(out1);
        const bytes2 = readFileSync(out2);
        expect(bytes1.equals(bytes2)).toBe(true);
        expect(bytes1.equals(readFileSync(EXPECTED))).toBe(true);
    });

    it('publishes the scan count on stdout (scan-scope contract)', () => {
        const r = runCli(['--log-file', FIXTURE_LOG, '--metrics-file', FIXTURE_METRICS]);
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/scanned: 7\n/);
    });

    it('an empty log fails loud — a report over nothing is not a report', () => {
        const dir = mkdtempSync(join(tmpdir(), 'forensics-empty-'));
        const emptyLog = join(dir, 'empty.txt');
        writeFileSync(emptyLog, '');
        const r = runCli(['--log-file', emptyLog]);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/scanned 0/);
    });

    it('bulk commits are skipped and counted, never silently dropped', () => {
        const report = JSON.parse(readFileSync(EXPECTED, 'utf8')) as {
            scanned: { commits: number; commits_skipped_bulk: number; files: number };
            hotspots: { file: string }[];
        };
        expect(report.scanned.commits_skipped_bulk).toBe(1);
        expect(report.scanned.commits).toBe(7);
        // the 60 bulk files never enter the analyzed population
        expect(report.hotspots.some((h) => h.file.startsWith('bulk/'))).toBe(false);
    });

    it('cross-module coupling above threshold is recorded as a finding class', () => {
        const report = JSON.parse(readFileSync(EXPECTED, 'utf8')) as {
            boundary_contradictions: { a: string; b: string; cross_module: boolean }[];
        };
        expect(report.boundary_contradictions).toHaveLength(1);
        expect(report.boundary_contradictions[0]).toMatchObject({
            a: 'src/scripts/a.ts',
            b: 'src/skills/x/SKILL.md',
            cross_module: true,
        });
    });

    it('emitted findings are non-blocking by construction (kind/severity)', () => {
        const report = JSON.parse(readFileSync(EXPECTED, 'utf8')) as Parameters<typeof toFindings>[0];
        const out = toFindings(report) as { findings: { kind: string; severity: string }[] };
        expect(out.findings.length).toBeGreaterThan(0);
        for (const f of out.findings) {
            expect(f.kind).toBe('correctness');
            expect(['low', 'medium']).toContain(f.severity);
        }
    });
});

describe('forensics_report — unit surface', () => {
    it('parseLog splits commits and files', () => {
        const commits = parseLog('C abc\nx.ts\ny.ts\n\nC def\nz.ts\n');
        expect(commits).toEqual([
            { hash: 'abc', files: ['x.ts', 'y.ts'] },
            { hash: 'def', files: ['z.ts'] },
        ]);
    });

    it('complexityOf counts lines + indentation units (tab=1, 4 spaces=1)', () => {
        expect(complexityOf('a\n\tb\n        c\n')).toBe(4 + 1 + 2);
    });

    it('moduleOf treats the second segment under src/ as the module boundary', () => {
        expect(moduleOf('src/scripts/a.ts')).toBe('src/scripts');
        expect(moduleOf('src/skills/x/SKILL.md')).toBe('src/skills');
        expect(moduleOf('README.md')).toBe('README.md');
    });

    it('coupling respects the min-support floor', () => {
        const commits = parseLog('C a\nx.ts\ny.ts\n\nC b\nx.ts\ny.ts\n');
        const report = analyze(
            commits,
            { max_commit_files: 50, coupling_threshold: 0.5, min_cochanges: 3, top_hotspots: 25 },
            () => 10,
            'test',
            'run',
        );
        expect(report.coupling).toHaveLength(0); // co_changes 2 < support 3
    });
});

describe('forensics_report — live git path smoke', () => {
    it('runs over a real single-commit range in this repo', () => {
        const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: REPO_ROOT }).trim();
        const r = runCli(['--range', `${head}~1..${head}`]);
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/"commits": 1/);
    });
});

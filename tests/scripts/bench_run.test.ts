// Tests for src/scripts/bench_run.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists. To stay CI-parallel-safe (the script's frozen
// REPORTS_DIR is the shared, committed `internal/bench/reports` tree written
// by sibling bench suites), this suite never mutates that tree:
//
//   - golden-parity (python3 vs tsx) on the NON-writing CLI paths
//     (`--quiet --no-write`, full Markdown `--no-write`, missing-corpus exit 2);
//   - an in-process structural check over `build_report` (read-only — reads
//     skills + sessions.jsonl, writes nothing).
//
// `generated_at` + `baseline_collector_sha` are timing/mtime-bound and excluded
// via normTiming. The written-report byte-parity (selection block PyFloat ".0",
// Markdown) was validated manually during the port; the cost/quality float
// fields surface a PRE-EXISTING `bench_report.ts` divergence (bare int vs
// Python "0.0") documented in the wave report — not introduced here.
import { describe, expect, it } from 'vitest';

import { hasPyYaml, hasPython3, normTiming, runPy, runTs } from './_bench_wave8d.js';
import * as br from '../../src/scripts/bench_run.js';

const ok = hasPython3() && hasPyYaml();

describe.skipIf(!ok)('bench_run — golden parity (non-writing CLI paths)', () => {
    it('--quiet --no-write headline identical + exit 0', () => {
        const args = ['--corpus', 'dev', '--quiet', '--no-write'];
        const p = runPy('bench_run.py', args);
        const t = runTs('bench_run.ts', args);
        expect(t.stdout).toBe(p.stdout);
        expect(t.status).toBe(p.status);
        expect(t.status).toBe(0);
    });

    it('full Markdown --no-write identical (timing normalised)', () => {
        const args = ['--corpus', 'dev', '--no-write'];
        const p = runPy('bench_run.py', args);
        const t = runTs('bench_run.ts', args);
        expect(normTiming(t.stdout)).toBe(normTiming(p.stdout));
        expect(t.status).toBe(p.status);
    });

    it('missing corpus → exit 2 + identical stderr', () => {
        const args = ['--corpus', '__missing__', '--no-write'];
        const p = runPy('bench_run.py', args);
        const t = runTs('bench_run.ts', args);
        expect(t.status).toBe(2);
        expect(p.status).toBe(2);
        expect(normTiming(t.stderr)).toBe(normTiming(p.stderr));
    });
});

describe.skipIf(!ok)('bench_run — build_report structure (in-process, read-only)', () => {
    it('top-level shape matches the benchmark-report-schema', () => {
        const corpus = `${process.cwd()}/tests/eval/corpus-dev.yaml`;
        const report = br.build_report(corpus, 3, null) as Record<string, unknown>;
        expect(report['schema_version']).toBe(1);
        expect((report['corpus'] as Record<string, unknown>)['id']).toBe('dev');
        const runner = report['runner'] as Record<string, unknown>;
        expect(runner['bench_run_version']).toBe('0.2.0');
        expect(String(runner['baseline_collector'])).toContain('bench_runner.py');
        expect(report['selection']).toBeDefined();
        expect(report['cost']).toBeDefined();
        expect(report['quality']).toBeDefined();
        const verdict = report['verdict'] as Record<string, string>;
        expect(['pass', 'partial', 'fail']).toContain(verdict['overall']);
    });
});

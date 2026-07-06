// Tests for src/scripts/bench_run.ts (py2ts Phase 8 / Wave 8d).
//
// The Python original is deleted, so this is a python-free intent suite. To
// stay CI-parallel-safe (the script's frozen REPORTS_DIR is the shared,
// committed `internal/bench/reports` tree written by sibling bench suites),
// this suite never mutates that tree:
//
//   - tsx CLI checks on the NON-writing paths
//     (`--quiet --no-write`, full Markdown `--no-write`, missing-corpus exit 2);
//   - an in-process structural check over `build_report` (read-only — reads
//     skills + sessions.jsonl, writes nothing).
//
// `generated_at` + `baseline_collector_sha` are timing/mtime-bound and masked
// via normTiming before any content assertion.
import { describe, expect, it } from 'vitest';

import { normTiming, runTs } from './_bench_wave8d.js';
import * as br from '../../src/scripts/bench_run.js';

describe('bench_run — CLI (tsx, non-writing paths)', () => {
    it('--quiet --no-write prints the one-line headline + exit 0', () => {
        const t = runTs('bench_run.ts', ['--corpus', 'dev', '--quiet', '--no-write']);
        expect(t.status, t.stderr).toBe(0);
        const line = t.stdout.trimEnd();
        expect(line.split('\n').length).toBe(1);
        expect(line).toMatch(/^bench dev · selection \d+\.\d{2}% \((pass|fail)\)/);
        expect(line).toMatch(/· overall (pass|partial|fail)$/);
    });

    it('full Markdown --no-write renders the report sections + exit 0', () => {
        const t = runTs('bench_run.ts', ['--corpus', 'dev', '--no-write']);
        expect(t.status, t.stderr).toBe(0);
        const md = normTiming(t.stdout);
        expect(md).toContain('# Benchmark Report — `dev` · <TS>');
        expect(md).toContain('## Headline');
        expect(md).toContain('## Selection accuracy');
        expect(md).toMatch(/- \*\*overall\*\* → \*\*(pass|partial|fail)\*\*/);
    });

    it('missing corpus → exit 2 + corpus-not-found error on stderr', () => {
        const t = runTs('bench_run.ts', ['--corpus', '__missing__', '--no-write']);
        expect(t.status).toBe(2);
        expect(t.stderr).toContain('error: corpus not found:');
        expect(t.stderr).toContain('corpus-__missing__.yaml');
        expect(t.stdout).toBe('');
    });
});

describe('bench_run — build_report structure (in-process, read-only)', () => {
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

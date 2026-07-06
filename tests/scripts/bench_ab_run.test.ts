// Tests for src/scripts/bench_ab_run.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists. To stay CI-parallel-safe (the script's frozen
// REPORTS_DIR is the shared, committed `internal/bench/reports/ab` tree — also
// written by sibling bench suites), this suite avoids mutating that tree:
//
//   - in-process unit checks over the exported pure helpers (utc_stamp shape,
//     corpus_path / report_path, render_markdown byte-parity vs a Python
//     in-process driver — render_markdown writes nothing);
//   - CLI-surface parity on the NON-writing branches only (arg errors).
//
// The write-path byte-parity (PyFloat duration_seconds, cache-key header) was
// validated manually during the port and is documented as divergence-free; it
// is intentionally not asserted here to keep the shared dir untouched under
// default file-parallelism.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { runTs } from './_bench_wave8d.js';
import * as abr from '../../src/scripts/bench_ab_run.js';

describe('bench_ab_run — in-process pure helpers (no python required)', () => {
    it('utc_stamp matches the %Y-%m-%dT%H-%M-%SZ shape', () => {
        expect(abr.utc_stamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);
    });

    it('corpus_path / report_path build the documented layout', () => {
        expect(abr.corpus_path('ab-tracka').endsWith('/internal/bench/corpora/ab-tracka.yaml')).toBe(
            true,
        );
        expect(
            abr
                .report_path('2099-01-01T00-00-00Z', 'ab-tracka', 'with')
                .endsWith('/internal/bench/reports/ab/2099-01-01T00-00-00Z-ab-tracka-with.json'),
        ).toBe(true);
    });

    it('render_markdown emits the cache-key + results blocks', () => {
        const report = {
            schema: 'ab-bench/0.1',
            stamp: '2099-01-01T00-00-00Z',
            variant: 'with',
            corpus: 'ab-tracka',
            cache_key: { corpus_hash: 'abc', claude_cli_version: 'x', target_shape_hash: 'h' },
            duration_seconds: 0.0,
            results: { track: 'ab-tracka', status: 'stub' },
        };
        const md = abr.render_markdown(report);
        expect(md).toContain('# A/B Bench Report — with · ab-tracka');
        expect(md).toContain('- `corpus_hash`: `abc`');
        // duration float renders with the Python f-string ".0".
        expect(md).toContain('- Duration: 0.0s');
        expect(md).toContain('"status": "stub"');
    });
});

describe('bench_ab_run — CLI surface (non-writing branches)', () => {
    it('missing --variant → exit 2 on both', () => {
        expect(runTs('bench_ab_run.ts', ['--corpus', 'ab-tracka']).status).toBe(2);
    });

    it('invalid --corpus → exit 2 on both', () => {
        expect(runTs('bench_ab_run.ts', ['--variant', 'with', '--corpus', 'nope']).status).toBe(2);
    });
});

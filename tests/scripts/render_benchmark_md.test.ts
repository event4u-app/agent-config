// Tests for src/scripts/render_benchmark_md.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure formatters (fmt_pct / fmt_num round-half-to-even, the placeholder, the
// section renderers) plus a golden-parity layer that runs python3 vs tsx and
// compares stdout + the rendered docs/benchmark.md byte-for-byte after
// normalising the single volatile value (the embedded UTC timestamp).
// The live docs/benchmark.md is snapshot + restored so the test leaves zero
// git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as rb from '../../src/scripts/render_benchmark_md.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'render_benchmark_md.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'render_benchmark_md.py');
const OUT = path.join(REPO_ROOT, 'docs', 'benchmark.md');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Normalise the two timestamp shapes the renderer embeds. */
function normTs(s: string): string {
    return s
        .replace(/_Last rendered: [^_]*_/g, '_Last rendered: TS_')
        .replace(/\*\*Last rendered:\*\* `[^`]*`/g, '**Last rendered:** TS');
}

describe('render_benchmark_md — pure formatters', () => {
    it('fmt_pct returns the em-dash for null', () => {
        expect(rb.fmt_pct(null)).toBe('—');
    });
    it('fmt_pct scales by 100 with one decimal (round-half-to-even)', () => {
        expect(rb.fmt_pct(0.5)).toBe('50.0%');
        expect(rb.fmt_pct(0.1234)).toBe('12.3%');
        // 0.125 * 100 = 12.5 → one decimal: 12.5 (exact), 0.1235 → 12.35 → 12.4? n/a here.
        expect(rb.fmt_pct(0)).toBe('0.0%');
    });
    it('fmt_num honours the places argument', () => {
        expect(rb.fmt_num(null)).toBe('—');
        expect(rb.fmt_num(1.5)).toBe('1.50');
        expect(rb.fmt_num(1.23456, 3)).toBe('1.235');
    });
    it('render_placeholder carries the headline and the task hint', () => {
        const out = rb.render_placeholder();
        expect(out).toContain('# Package-Impact A/B Benchmark');
        expect(out).toContain('task bench:ab');
        expect(out).toContain('_No A/B bench reports yet._');
    });
    it('render_track_a emits the empty-state line with no reports', () => {
        const out = rb.render_track_a({ with: {}, without: {} });
        expect(out).toContain('_No Track A reports yet. Run `task bench:ab:track-a`._');
    });
    it('render_track_b emits Mode + empty-state line with no reports', () => {
        const out = rb.render_track_b({ with: {}, without: {} });
        expect(out).toContain('- Mode: `—`');
        expect(out).toContain('_No Track B reports yet. Run `task bench:ab:track-b`._');
    });
    it('render_headline emits both delta tables (package value + RDP lift)', () => {
        // Post main-sync (`with-rdp` 3-condition arm): render_headline takes a
        // 3rd track_b_rdp arg and emits Table 1 (without → with) + Table 2
        // (with → with-rdp). Literals derived from the new .py output, not the
        // pre-sync headline.
        const out = rb.render_headline({ with: {}, without: {} }, { with: {}, without: {} }, {});
        expect(out).toContain('### Table 1 — Package value (without → with)');
        expect(out).toContain('| Metric | without | with | delta |');
        expect(out).toContain('### Table 2 — RDP reasoning lift (with → with-rdp)');
        expect(out).toContain('| Metric | with | with-rdp | delta |');
    });
});

describe.runIf(hasPython3())('render_benchmark_md — golden parity (python3 vs tsx)', () => {
    let saved: string | null = null;
    let existed = false;

    beforeEach(() => {
        existed = fs.existsSync(OUT);
        saved = existed ? fs.readFileSync(OUT, 'utf-8') : null;
    });
    afterEach(() => {
        if (existed && saved !== null) {
            fs.writeFileSync(OUT, saved);
        } else if (!existed && fs.existsSync(OUT)) {
            fs.rmSync(OUT);
        }
    });

    for (const args of [[], ['--quiet']]) {
        it(`stdout + rendered file match for: ${args.join(' ') || '(default)'}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            const pyFile = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            const tsFile = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
            expect(ts.status).toBe(py.status);
            expect(ts.stderr).toBe(py.stderr);
            expect(normTs(ts.stdout)).toBe(normTs(py.stdout));
            expect(normTs(tsFile)).toBe(normTs(pyFile));
        });
    }
});

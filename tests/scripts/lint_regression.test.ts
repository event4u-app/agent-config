// Tests for src/scripts/lint_regression.ts (py2ts Phase 4 / Wave 4b).
//
// Two layers:
//   1. The pytest suite tests/test_lint_regression.py ported 1:1 — the pure
//      `compare` logic (CompareTests) plus the real-script EndToEndTests
//      against `--baseline HEAD`.
//   2. A golden-parity layer running python3 vs tsx on the REAL REPO,
//      byte-identical stdout/stderr/exit (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as reg from '../../src/scripts/lint_regression.js';




// --- Ported pytest: CompareTests — pure comparison logic, no git. ---

describe('lint_regression.compare — ported CompareTests', () => {
    it('identical maps produce empty delta', () => {
        const m = { 'a.md': { status: 'pass_with_warnings', codes: new Set(['long_rule']) } };
        const delta = reg.compare(m, m);
        expect(delta.regressions).toEqual([]);
        expect(delta.new_files).toEqual([]);
        expect(delta.improvements).toEqual([]);
    });

    it('new file with issues is reported', () => {
        const base = { 'a.md': { status: 'pass', codes: new Set<string>() } };
        const curr = {
            'a.md': { status: 'pass', codes: new Set<string>() },
            'b.md': { status: 'pass_with_warnings', codes: new Set(['long_rule']) },
        };
        const delta = reg.compare(base, curr);
        expect(delta.new_files.map((nf) => nf.file)).toEqual(['b.md']);
    });

    it('new clean file is not reported', () => {
        const base = {};
        const curr = { 'b.md': { status: 'pass', codes: new Set<string>() } };
        const delta = reg.compare(base, curr);
        expect(delta.new_files).toEqual([]);
    });

    it('status downgrade is a regression', () => {
        const base = { 'a.md': { status: 'pass', codes: new Set<string>() } };
        const curr = { 'a.md': { status: 'pass_with_warnings', codes: new Set(['long_rule']) } };
        const delta = reg.compare(base, curr);
        expect(delta.regressions).toHaveLength(1);
        expect(delta.regressions[0]!.new_codes).toEqual(['long_rule']);
    });

    it('status upgrade is an improvement', () => {
        const base = { 'a.md': { status: 'fail', codes: new Set(['missing_section']) } };
        const curr = { 'a.md': { status: 'pass', codes: new Set<string>() } };
        const delta = reg.compare(base, curr);
        expect(delta.improvements).toHaveLength(1);
        expect(delta.regressions).toEqual([]);
    });

    it('removed file is not a regression', () => {
        const base = { 'a.md': { status: 'pass_with_warnings', codes: new Set(['long_rule']) } };
        const delta = reg.compare(base, {});
        expect(delta.regressions).toEqual([]);
        expect(delta.new_files).toEqual([]);
    });
});

// --- Focused differential over the formatters + status map. ---

describe('lint_regression — formatters + status map', () => {
    it('build_status_map collapses results to {status, codes}', () => {
        const m = reg.build_status_map({
            results: [
                { file: 'a.md', status: 'fail', issues: [{ code: 'x' }, { code: 'y' }] },
                { file: 'b.md', status: 'pass', issues: [] },
            ],
        });
        expect(m['a.md']!.status).toBe('fail');
        expect([...m['a.md']!.codes].sort()).toEqual(['x', 'y']);
        expect(m['b.md']!.codes.size).toBe(0);
    });

    it('format_text reports the clean banner', () => {
        const out = reg.format_text({ regressions: [], improvements: [], new_files: [] });
        expect(out).toContain('=== Lint Regression Report ===');
        expect(out).toContain('✅  No regressions detected.');
    });

    it('format_text lists regressions and new files', () => {
        const out = reg.format_text({
            regressions: [{ file: 'a.md', was: 'pass', now: 'fail', new_codes: ['c1'] }],
            improvements: [],
            new_files: [{ file: 'b.md', status: 'pass_with_warnings', codes: ['c2'] }],
        });
        expect(out).toContain('❌  1 regression(s):');
        expect(out).toContain('  a.md: pass → fail  [c1]');
        expect(out).toContain('⚠️  1 new file(s) with issues:');
        expect(out).toContain('  b.md: pass_with_warnings  [c2]');
    });

    it('format_text shows "(same codes, stricter)" when no new codes', () => {
        const out = reg.format_text({
            regressions: [{ file: 'a.md', was: 'pass', now: 'fail', new_codes: [] }],
            improvements: [],
            new_files: [],
        });
        expect(out).toContain('  a.md: pass → fail  [(same codes, stricter)]');
    });

    it('format_markdown emits collapsible sections', () => {
        const out = reg.format_markdown({
            regressions: [{ file: 'a.md', was: 'pass', now: 'fail', new_codes: ['c1'] }],
            improvements: [{ file: 'c.md', was: 'fail', now: 'pass', removed_codes: ['c3'] }],
            new_files: [],
        });
        expect(out).toContain('## 📊 Lint Regression Report');
        expect(out).toContain('<summary>❌ 1 Regression</summary>');
        expect(out).toContain('| `a.md` | pass | fail | c1 |');
        expect(out).toContain('<summary>✅ 1 Improvement</summary>');
        expect(out).toContain('| `c.md` | fail | pass |');
    });

    it('format_markdown clean report has no details blocks', () => {
        const out = reg.format_markdown({ regressions: [], improvements: [], new_files: [] });
        expect(out).toContain('✅ No regressions detected.');
        expect(out).not.toContain('<details>');
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------


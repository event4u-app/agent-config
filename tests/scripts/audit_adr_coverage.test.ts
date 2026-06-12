// Tests for src/scripts/audit_adr_coverage.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (parse_fm, scan_area gap-check, render_area_readme title-casing
// + link path) plus a golden-parity layer that runs python3 vs tsx on the
// REAL docs/adrs tree for --report / --check (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as aac from '../../src/scripts/audit_adr_coverage.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_adr_coverage.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_adr_coverage.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('audit_adr_coverage — pure helpers', () => {
    it('parse_fm reads fields and strips space/quote padding', () => {
        const fm = aac.parse_fm('---\ndecision: "my-call"\nstatus: accepted \n---\nbody');
        expect(fm).toEqual({ decision: 'my-call', status: 'accepted' });
    });
    it('parse_fm returns {} when no frontmatter', () => {
        expect(aac.parse_fm('no fm')).toEqual({});
    });
    it('render_area_readme title-cases the decision and emits the relative contract link', () => {
        const out = aac.render_area_readme(
            'cost',
            { contract: 'cost-enforcement.md', scope: 'Budget ladder.' },
            [{ num: '0001', slug: 'foo-bar', path: '0001-foo-bar.md', decision: 'python-to-ts-migration', status: 'accepted', date: '2026-01-01' }],
        );
        expect(out).toContain('# ADRs — `cost`');
        expect(out).toContain('Python To Ts Migration');
        expect(out).toContain('| [0001](0001-foo-bar.md) |');
    });
    it('render_area_readme emits the placeholder row when no ADRs exist', () => {
        const out = aac.render_area_readme('cost', { contract: 'cost-enforcement.md', scope: 'x' }, []);
        expect(out).toContain('| _none yet_ | — | — | — | — |');
    });
});

describe('audit_adr_coverage — scan_area over the real tree', () => {
    it('returns [adrs, errs] arrays for a known area', () => {
        const [adrs, errs] = aac.scan_area('cost');
        expect(Array.isArray(adrs)).toBe(true);
        expect(Array.isArray(errs)).toBe(true);
    });
    it('returns empty for an area directory that does not exist', () => {
        const [adrs, errs] = aac.scan_area('definitely-not-an-area-xyz');
        expect(adrs).toEqual([]);
        expect(errs).toEqual([]);
    });
});

describe.runIf(hasPython3())('audit_adr_coverage — golden parity (python3 vs tsx)', () => {
    for (const args of [[], ['--check']]) {
        it(`byte-identical for: ${args.join(' ') || '(report)'}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        });
    }
});

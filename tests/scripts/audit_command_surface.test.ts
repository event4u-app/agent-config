// Tests for src/scripts/audit_command_surface.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (parse_frontmatter, keyword_vector, cosine) plus a golden
// parity layer that runs python3 vs tsx for every read mode (default report,
// --budget, --check-new, root-missing) and compares stdout/stderr/exit + the
// written reports byte-for-byte. The report files under agents/reports/ are
// snapshot + restored so the test leaves zero git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as acs from '../../src/scripts/audit_command_surface.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_command_surface.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_command_surface.py');
const REPORT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
const REPORT_FILES = [
    'command-surface.json',
    'command-surface.md',
    'command-budget-audit.json',
    'command-budget-audit.md',
];
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('audit_command_surface — parse_frontmatter', () => {
    it('reads description / name / tier / cluster / pack and strips quotes', () => {
        const fm = acs.parse_frontmatter(
            '---\ndescription: "do a thing"\nname: foo\ntier: 1\ncluster: "grp"\npack: \'core\'\n---\nbody',
        );
        expect(fm).toEqual({
            description: 'do a thing',
            name: 'foo',
            tier: 1,
            cluster: 'grp',
            pack: 'core',
        });
    });
    it('parses an inline aliases array', () => {
        const fm = acs.parse_frontmatter('---\naliases: ["a", b, "c"]\n---\n');
        expect(fm.aliases).toEqual(['a', 'b', 'c']);
    });
    it('parses a scalar aliases value', () => {
        const fm = acs.parse_frontmatter('---\naliases: solo\n---\n');
        expect(fm.aliases).toEqual(['solo']);
    });
    it('returns {} when there is no frontmatter', () => {
        expect(acs.parse_frontmatter('no fm here')).toEqual({});
    });
});

describe('audit_command_surface — keyword_vector + cosine', () => {
    it('drops stopwords and counts the rest', () => {
        const v = acs.keyword_vector('the quick brown fox and the lazy dog');
        expect(v.get('the')).toBeUndefined();
        expect(v.get('and')).toBeUndefined();
        expect(v.get('quick')).toBe(1);
        expect(v.get('brown')).toBe(1);
    });
    it('cosine is 0 for disjoint vectors and 1 for identical', () => {
        const a = acs.keyword_vector('alpha beta gamma');
        const b = acs.keyword_vector('delta epsilon zeta');
        expect(acs.cosine(a, b)).toBe(0);
        expect(acs.cosine(a, a)).toBeCloseTo(1, 10);
    });
    it('cosine returns 0 for an empty vector', () => {
        expect(acs.cosine(new Map(), acs.keyword_vector('alpha'))).toBe(0);
    });
});

describe.runIf(hasPython3())('audit_command_surface — golden parity (python3 vs tsx)', () => {
    const saved = new Map<string, string | null>();

    beforeEach(() => {
        saved.clear();
        for (const f of REPORT_FILES) {
            const p = path.join(REPORT_DIR, f);
            saved.set(f, fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null);
        }
    });
    afterEach(() => {
        for (const f of REPORT_FILES) {
            const p = path.join(REPORT_DIR, f);
            const prior = saved.get(f) ?? null;
            if (prior !== null) {
                fs.writeFileSync(p, prior);
            } else if (fs.existsSync(p)) {
                fs.rmSync(p);
            }
        }
    });

    function readReports(): Record<string, string> {
        const out: Record<string, string> = {};
        for (const f of REPORT_FILES) {
            const p = path.join(REPORT_DIR, f);
            out[f] = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
        }
        return out;
    }

    for (const args of [[], ['--budget'], ['--check-new']]) {
        it(`stdout/stderr/exit + reports match for: ${args.join(' ') || '(report)'}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            const pyReports = readReports();
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            const tsReports = readReports();
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            for (const f of REPORT_FILES) {
                expect(tsReports[f]).toBe(pyReports[f]);
            }
        });
    }

    it('exits 2 with matching stderr when --root is missing', () => {
        const missing = path.join(REPO_ROOT, 'definitely-not-a-dir-xyz');
        const py = spawnSync('python3', [PY_SCRIPT, '--root', missing], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--root', missing], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        expect(py.status).toBe(2);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.stdout).toBe(py.stdout);
    });
});

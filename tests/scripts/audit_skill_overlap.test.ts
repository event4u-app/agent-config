// Tests for src/scripts/audit_skill_overlap.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite existed for audit_skill_overlap.py, so this is a focused
// differential suite:
//   1. Unit checks of the pure helpers (_keyword_vector, _cosine).
//   2. Golden parity (python3 vs tsx) on the real repo. On the current
//      src/-based layout the script's bespoke `_skill_roots()` (which only
//      knows the legacy `.agent-src.uncondensed/skills` and
//      `packages/*/.agent-src.uncondensed/skills` layouts) finds NOTHING, so
//      both runtimes hit the "no skills" exit-3 path identically. To exercise
//      the happy path we temporarily symlink `.agent-src.uncondensed/skills`
//      → `src/skills` (the legacy fallback the script honours), run both, and
//      assert byte-identical stdout / JSON / MD across several thresholds,
//      then remove the temp symlink and restore the report files (zero git
//      drift). Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _cosine, _keyword_vector } from '../../src/scripts/audit_skill_overlap.js';
import { acquireGlobalStateLock } from './_global_state_lock.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_skill_overlap.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_skill_overlap.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const REPORT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
const OUT_JSON = path.join(REPORT_DIR, 'skill-overlap.json');
const OUT_MD = path.join(REPORT_DIR, 'skill-overlap.md');
const SKILLS_LINK = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function runTs(args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}
function runPy(args: string[]): { stdout: string; stderr: string; status: number | null } {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

describe('audit_skill_overlap — unit helpers', () => {
    it('_keyword_vector counts non-stopword tokens', () => {
        const v = _keyword_vector('router router fires and the for');
        expect(v.get('router')).toBe(2);
        expect(v.get('fires')).toBe(1);
        expect(v.has('and')).toBe(false);
        expect(v.has('the')).toBe(false);
    });
    it('_cosine of identical vectors is 1, disjoint is 0', () => {
        const a = _keyword_vector('alpha beta gamma delta');
        expect(_cosine(a, a)).toBeCloseTo(1.0, 10);
        const b = _keyword_vector('omega sigma kappa lambda');
        expect(_cosine(a, b)).toBe(0.0);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('audit_skill_overlap — golden parity (python3 vs tsx)', () => {
    let snapJson: string | null = null;
    let snapMd: string | null = null;
    let madeLink = false;
    let release: (() => void) | null = null;

    beforeEach(() => {
        release = acquireGlobalStateLock();
        snapJson = fs.existsSync(OUT_JSON) ? fs.readFileSync(OUT_JSON, 'utf-8') : null;
        snapMd = fs.existsSync(OUT_MD) ? fs.readFileSync(OUT_MD, 'utf-8') : null;
    });
    afterEach(() => {
        if (madeLink) {
            try {
                fs.rmSync(SKILLS_LINK, { force: true });
            } catch {
                // ignore
            }
            madeLink = false;
        }
        if (snapJson !== null) {
            fs.writeFileSync(OUT_JSON, snapJson, 'utf-8');
        } else if (fs.existsSync(OUT_JSON)) {
            fs.rmSync(OUT_JSON);
        }
        if (snapMd !== null) {
            fs.writeFileSync(OUT_MD, snapMd, 'utf-8');
        } else if (fs.existsSync(OUT_MD)) {
            fs.rmSync(OUT_MD);
        }
        if (release) {
            release();
            release = null;
        }
    });

    it('real-repo (no skill roots) → exit 3, byte-identical', () => {
        // No temp symlink: the bespoke root logic finds nothing.
        const p = runPy([]);
        const t = runTs([]);
        expect(p.status).toBe(3);
        expect(t.status).toBe(3);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
    });

    it('happy path via legacy-skills symlink: stdout/JSON/MD byte-identical', () => {
        // Activate the legacy fallback the script honours.
        fs.symlinkSync(path.join('..', 'src', 'skills'), SKILLS_LINK);
        madeLink = true;

        for (const args of [[], ['--threshold', '0.3'], ['--threshold', '0.5']]) {
            const p = runPy(args);
            const pJson = fs.readFileSync(OUT_JSON, 'utf-8');
            const pMd = fs.readFileSync(OUT_MD, 'utf-8');
            const t = runTs(args);
            const tJson = fs.readFileSync(OUT_JSON, 'utf-8');
            const tMd = fs.readFileSync(OUT_MD, 'utf-8');
            expect(t.status, `args=${args.join(' ')}`).toBe(p.status);
            expect(t.status).toBe(0);
            expect(t.stdout, `stdout args=${args.join(' ')}`).toBe(p.stdout);
            expect(tJson, `json args=${args.join(' ')}`).toBe(pJson);
            expect(tMd, `md args=${args.join(' ')}`).toBe(pMd);
        }
    });

    it('--quiet suppresses stdout but still writes (byte-identical JSON)', () => {
        fs.symlinkSync(path.join('..', 'src', 'skills'), SKILLS_LINK);
        madeLink = true;
        const p = runPy(['--quiet']);
        const pJson = fs.readFileSync(OUT_JSON, 'utf-8');
        const t = runTs(['--quiet']);
        const tJson = fs.readFileSync(OUT_JSON, 'utf-8');
        expect(t.stdout).toBe('');
        expect(p.stdout).toBe('');
        expect(tJson).toBe(pJson);
    });
});

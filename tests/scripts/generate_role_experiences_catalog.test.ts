// Tests for src/scripts/generate_role_experiences_catalog.ts (py2ts, ADR-096).
//
// No pytest suite exists, so this is a focused differential suite: the pure
// loader (`load_roles`) + `render` against the REAL repo, plus a golden-parity
// layer that runs python3 vs tsx on the real tree — byte-exact generated
// docs/role-experiences.md AND identical stdout/stderr/exit for --check and
// the argparse-error path (skipped without python3). The writer leaves zero
// on-disk drift (snapshot + restore).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as gen from '../../src/scripts/generate_role_experiences_catalog.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_role_experiences_catalog.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_role_experiences_catalog.py');
const OUT_PATH = path.join(REPO_ROOT, 'docs', 'role-experiences.md');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    path.join(
        REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('generate_role_experiences_catalog — loader + render (real repo)', () => {
    it('load_roles returns sorted, non-empty rows with the expected shape', () => {
        const roles = gen.load_roles();
        expect(roles.length).toBeGreaterThan(0);
        // sorted(glob) → component-wise sorted slugs.
        const slugs = roles.map((r) => r.slug);
        expect([...slugs].sort()).toEqual(slugs);
        for (const r of roles) {
            expect(typeof r.tagline).toBe('string');
            expect(r.rel).toBe(`../agents/roles/${r.slug}/index.md`);
            expect(r.status.length).toBeGreaterThan(0);
        }
    });

    it('render emits the header prose + the | Role | Tagline | Status | table', () => {
        const out = gen.render();
        expect(out.startsWith('# Role experiences — taglines at a glance\n')).toBe(true);
        expect(out).toContain('| Role | Tagline | Status |');
        expect(out).toContain('|---|---|---|');
        // every row links the display name / role and fences the status.
        for (const r of gen.load_roles()) {
            const name = r.display_name || r.role;
            expect(out).toContain(`| [${name}](${r.rel}) | ${r.tagline} | \`${r.status}\` |`);
        }
        expect(out.endsWith('\n')).toBe(true);
        expect(out.endsWith('\n\n')).toBe(false);
    });
});

describe.runIf(hasPython3())('generate_role_experiences_catalog — golden parity (python3 vs tsx)', () => {
    let bak: string | null = null;

    afterEach(() => {
        if (bak !== null) fs.writeFileSync(OUT_PATH, bak, 'utf-8');
        bak = null;
    });

    it('--check: identical stdout + stderr + exit code', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('--check --quiet: silent OK, identical across engines', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--check', '--quiet'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check', '--quiet'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('argparse error (--bogus): exit 2, identical usage/error on stderr', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--bogus'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(2);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('write: byte-identical docs/role-experiences.md, zero drift after restore', () => {
        bak = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf-8') : null;

        const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(0);
        const pyOut = fs.readFileSync(OUT_PATH, 'utf-8');

        if (bak !== null) fs.writeFileSync(OUT_PATH, bak, 'utf-8');

        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(0);
        const tsOut = fs.readFileSync(OUT_PATH, 'utf-8');

        expect(tsOut).toBe(pyOut);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
});

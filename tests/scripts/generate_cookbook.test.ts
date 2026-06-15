// Tests for src/scripts/generate_cookbook.ts (py2ts, ADR-096).
//
// No pytest suite exists, so this is a focused differential suite: the
// loaders + `render` against the REAL repo, the `validate_refs` anti-cargo-cult
// guard (a missing command/skill ref → BadRecipe), plus a golden-parity layer
// that runs python3 vs tsx on the real tree — byte-exact generated
// docs/cookbook.md AND identical stdout/stderr/exit for --check and the
// argparse-error path (skipped without python3). The writer leaves zero
// on-disk drift (snapshot + restore).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as gen from '../../src/scripts/generate_cookbook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_cookbook.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_cookbook.py');
const OUT_PATH = path.join(REPO_ROOT, 'docs', 'cookbook.md');
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

describe('generate_cookbook — loaders + render (real repo)', () => {
    it('load_seed returns the curated recipe list', () => {
        const seed = gen.load_seed();
        expect(seed.length).toBeGreaterThan(0);
        for (const r of seed) {
            expect(typeof r['title']).toBe('string');
            expect(typeof r['when']).toBe('string');
        }
    });

    it('load_flow returns each of the four work flows', () => {
        for (const fid of ['discovery', 'implementation', 'review', 'delivery']) {
            const f = gen.load_flow(fid);
            expect(typeof f).toBe('object');
            expect(Array.isArray(f['default_path'])).toBe(true);
        }
    });

    it('render emits the header, named recipes, and the four work flows', () => {
        const out = gen.render();
        expect(out.startsWith('# Cookbook — things you can do in a minute\n')).toBe(true);
        expect(out).toContain('## Named recipes');
        expect(out).toContain('## The four work flows');
        // command sequences are arrow-joined with `/`-prefixed code spans.
        expect(out).toMatch(/- \*\*Commands:\*\* `\/[^`]+`/);
        expect(out).toContain('flow\n'); // "### <Title> flow"
        expect(out.endsWith('\n')).toBe(true);
        expect(out.endsWith('\n\n')).toBe(false);
    });
});

describe('generate_cookbook — anti-cargo-cult guard (validate_refs)', () => {
    it('passes for refs that resolve in the real repo', () => {
        expect(() => gen.validate_refs('ok', ['review-changes'], ['code-review'])).not.toThrow();
    });

    it('throws BadRecipe naming a non-existent command', () => {
        expect(() => gen.validate_refs('bad', ['this-command-does-not-exist-xyz'], [])).toThrowError(
            /recipe 'bad' references non-existent command `this-command-does-not-exist-xyz`/,
        );
    });

    it('throws BadRecipe naming a non-existent skill', () => {
        expect(() => gen.validate_refs('bad', [], ['this-skill-does-not-exist-xyz'])).toThrowError(
            /recipe 'bad' references non-existent skill `this-skill-does-not-exist-xyz`/,
        );
    });
});

describe.runIf(hasPython3())('generate_cookbook — golden parity (python3 vs tsx)', () => {
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

    it('write: byte-identical docs/cookbook.md, zero drift after restore', () => {
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

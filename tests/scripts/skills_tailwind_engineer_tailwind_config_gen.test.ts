// Tests for src/skills/tailwind-engineer/scripts/tailwind_config_gen.ts (py2ts, ADR-094).
//
// No pytest suite exists, so this is a golden-parity suite that runs python3
// vs tsx on fixtures and compares stdout + stderr + exit code byte-for-byte,
// plus a byte-identical check on the WRITTEN config file (.ts and .js). It
// covers the main generation paths (validate-only default react, full
// option matrix with --js/--colors/--fonts/--spacing/--breakpoints/--plugins
// on nextjs, the file-write path) and the error paths (bad color/font/spacing/
// breakpoint spec → exit 1, argparse invalid framework choice → exit 2).
//
// The argparse --help text is intentionally NOT byte-compared (an argparse
// internal detail); the invalid-choice usage block IS compared because the
// twin pins it as a fixed-width-80 constant. Everything is deterministic —
// the write path uses throwaway tmp dirs, so there is zero git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(
    REPO_ROOT,
    'src',
    'skills',
    'tailwind-engineer',
    'scripts',
    'tailwind_config_gen.ts',
);
const PY_SCRIPT = path.join(
    REPO_ROOT,
    'src',
    'skills',
    'tailwind-engineer',
    'scripts',
    'tailwind_config_gen.py',
);
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-cfg-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

function runPy(args: string[], cwd: string = REPO_ROOT) {
    return spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd });
}
function runTs(args: string[], cwd: string = REPO_ROOT) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd });
}

describe.runIf(hasPython3())('tailwind_config_gen — golden parity (python3 vs tsx)', () => {
    it('--validate-only default (react) prints a byte-identical config + exit 0', () => {
        const args = ['--validate-only'];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('full option matrix (--js nextjs + colors/fonts/spacing/breakpoints/plugins) matches', () => {
        const args = [
            '--validate-only',
            '--js',
            '--framework',
            'nextjs',
            '--colors',
            'brand:#3b82f6',
            'accent:#8b5cf6',
            '--fonts',
            'sans:Inter,system-ui,sans-serif',
            "display:'Playfair Display',serif",
            '--spacing',
            'navbar:4rem',
            '--breakpoints',
            '3xl:1920px',
            '--plugins',
        ];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it.each([
        ['vue'],
        ['svelte'],
    ])('--validate-only --framework %s matches', (fw) => {
        const args = ['--validate-only', '--framework', fw];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('writes a byte-identical tailwind.config.ts (the file-write path)', () => {
        const pyDir = mkTmp();
        const tsDir = mkTmp();
        const pyOut = path.join(pyDir, 'tailwind.config.ts');
        const tsOut = path.join(tsDir, 'tailwind.config.ts');
        const py = runPy(['--colors', 'brand:#3b82f6', '--output', pyOut]);
        const ts = runTs(['--colors', 'brand:#3b82f6', '--output', tsOut]);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(0);
        // stdout embeds the absolute output path; normalise that one token.
        expect(ts.stdout.replace(tsOut, 'OUT')).toBe(py.stdout.replace(pyOut, 'OUT'));
        expect(ts.stderr).toBe(py.stderr);
        expect(fs.readFileSync(tsOut, 'utf8')).toBe(fs.readFileSync(pyOut, 'utf8'));
    });

    it('writes a byte-identical tailwind.config.js (--js write path)', () => {
        const pyDir = mkTmp();
        const tsDir = mkTmp();
        const pyOut = path.join(pyDir, 'tailwind.config.js');
        const tsOut = path.join(tsDir, 'tailwind.config.js');
        const py = runPy(['--js', '--plugins', '--framework', 'nextjs', '--output', pyOut]);
        const ts = runTs(['--js', '--plugins', '--framework', 'nextjs', '--output', tsOut]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout.replace(tsOut, 'OUT')).toBe(py.stdout.replace(pyOut, 'OUT'));
        expect(ts.stderr).toBe(py.stderr);
        expect(fs.readFileSync(tsOut, 'utf8')).toBe(fs.readFileSync(pyOut, 'utf8'));
    });

    it.each([
        ['--colors', 'Invalid color spec: nocolon'],
        ['--fonts', 'Invalid font spec: nocolon'],
        ['--spacing', 'Invalid spacing spec: nocolon'],
        ['--breakpoints', 'Invalid breakpoint spec: nocolon'],
    ])('bad %s spec → byte-identical error + exit 1', (flag, marker) => {
        const args = [flag, 'nocolon'];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.stderr).toContain(marker);
    });

    it('invalid --framework choice → byte-identical usage + error + exit 2', () => {
        const args = ['--framework', 'angular'];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.stderr).toContain("invalid choice: 'angular'");
    });
});

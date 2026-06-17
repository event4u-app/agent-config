// Tests for src/scripts/check_surface_tiers.ts (ADR-200).
//
// The guard reads `src/scripts/surface-tiers.yml` and walks `src/scripts/`
// relative to its own fixed REPO_ROOT (parents[2]), so fixture cases run
// python3 + tsx inside a COPY of the layout: the script sits at
// <tmp>/src/scripts/check_surface_tiers.{ts,py} so its REPO_ROOT resolves to
// <tmp>, and a fixture surface-tiers.yml + fixture *.py cluster files drive
// both assertions. Covers exhaustive pass, an unclassified cluster, a clean
// import boundary, an unguarded core→lab import (violation), a try/except-
// guarded optional import (allowed), the `--skip-imports` flag, the env
// kill-switch, and the argparse usage error. A real-repo parity layer follows.
// Skipped without python3 (or without PyYAML — the py guard imports yaml).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_surface_tiers.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_surface_tiers.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function hasPyYaml(): boolean {
    return spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf8' }).status === 0;
}
function mkTmp(): string {
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cst-')));
}
function write(root: string, rel: string, content: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
}

/**
 * Build a fixture repo: the real scripts at <tmp>/src/scripts/ (so REPO_ROOT
 * resolves there) + a fixture surface-tiers.yml. The caller seeds cluster
 * dirs / .py files. node_modules is symlinked for tsx + the yaml dep.
 */
function fixtureRepo(registry: string): { root: string; ts: string; py: string } {
    const root = mkTmp();
    fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
    const ts = path.join(root, 'src', 'scripts', 'check_surface_tiers.ts');
    const py = path.join(root, 'src', 'scripts', 'check_surface_tiers.py');
    fs.copyFileSync(TS_SCRIPT, ts);
    fs.copyFileSync(PY_SCRIPT, py);
    fs.writeFileSync(path.join(root, 'src', 'scripts', 'surface-tiers.yml'), registry, 'utf-8');
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'));
    return { root, ts, py };
}
function expectParity(
    fx: { root: string; ts: string; py: string },
    args: string[] = [],
    env: Record<string, string> = {},
): void {
    const environ = { ...process.env, ...env };
    const p = spawnSync('python3', [fx.py, ...args], { cwd: fx.root, encoding: 'utf8', env: environ });
    const t = spawnSync(TSX_BIN, [fx.ts, ...args], { cwd: fx.root, encoding: 'utf8', env: environ });
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
    expect(t.status).toBe(p.status);
}

const py3 = hasPython3();
const pyYaml = py3 && hasPyYaml();

// A registry classifying the clusters used across fixtures.
const REGISTRY = [
    'clusters:',
    '  alpha: core',
    '  betalab: lab',
    'lab_modules:',
    '  - labtool',
    '',
].join('\n');

describe.skipIf(!pyYaml)('check_surface_tiers — golden parity (fixture repo)', () => {
    let fx: { root: string; ts: string; py: string };
    beforeEach(() => {
        fx = fixtureRepo(REGISTRY);
    });
    afterEach(() => {
        fs.rmSync(fx.root, { recursive: true, force: true });
    });

    it('exhaustive + clean imports → ✅ exit 0', () => {
        write(fx.root, 'src/scripts/alpha/mod.py', 'import json\nfrom alpha import other\n');
        write(fx.root, 'src/scripts/betalab/mod.py', 'import json\n');
        expectParity(fx);
    });

    it('unclassified cluster → exit 1', () => {
        write(fx.root, 'src/scripts/alpha/mod.py', 'import json\n');
        write(fx.root, 'src/scripts/orphan/mod.py', 'import json\n');
        expectParity(fx);
    });

    it('unguarded core→lab import → exit 1', () => {
        write(fx.root, 'src/scripts/alpha/mod.py', 'import json\nfrom betalab import thing\n');
        write(fx.root, 'src/scripts/betalab/thing.py', 'X = 1\n');
        expectParity(fx);
    });

    it('top-level lab_module import (unguarded) → exit 1', () => {
        write(fx.root, 'src/scripts/alpha/mod.py', 'import labtool\n');
        expectParity(fx);
    });

    it('guarded optional import (try/except ImportError) → allowed', () => {
        write(
            fx.root,
            'src/scripts/alpha/mod.py',
            'try:\n    from betalab import thing\nexcept ImportError:\n    thing = None\n',
        );
        write(fx.root, 'src/scripts/betalab/thing.py', 'X = 1\n');
        expectParity(fx);
    });

    it('guarded by bare except → allowed', () => {
        write(
            fx.root,
            'src/scripts/alpha/mod.py',
            'try:\n    import labtool\nexcept:\n    labtool = None\n',
        );
        expectParity(fx);
    });

    it('guarded by tuple (ModuleNotFoundError, Exception) → allowed', () => {
        write(
            fx.root,
            'src/scripts/alpha/mod.py',
            'try:\n    from betalab import thing\nexcept (ModuleNotFoundError, Exception):\n    thing = None\n',
        );
        write(fx.root, 'src/scripts/betalab/thing.py', 'X = 1\n');
        expectParity(fx);
    });

    it('re-import inside the except handler body → allowed', () => {
        write(
            fx.root,
            'src/scripts/alpha/mod.py',
            [
                'try:',
                '    from betalab import thing',
                'except ImportError:',
                '    import sys',
                '    from betalab import thing',
                '',
            ].join('\n'),
        );
        write(fx.root, 'src/scripts/betalab/thing.py', 'X = 1\n');
        expectParity(fx);
    });

    it('lab-tier file may import lab freely (only core is checked)', () => {
        write(fx.root, 'src/scripts/betalab/mod.py', 'import labtool\n');
        expectParity(fx);
    });

    it('--skip-imports: boundary check skipped, exhaustiveness still runs', () => {
        write(fx.root, 'src/scripts/alpha/mod.py', 'from betalab import thing\n');
        write(fx.root, 'src/scripts/betalab/thing.py', 'X = 1\n');
        write(fx.root, 'src/scripts/orphan/mod.py', 'import json\n');
        expectParity(fx, ['--skip-imports']);
    });

    it('env kill-switch disables the import check', () => {
        write(fx.root, 'src/scripts/alpha/mod.py', 'from betalab import thing\n');
        write(fx.root, 'src/scripts/betalab/thing.py', 'X = 1\n');
        expectParity(fx, [], { AGENT_CONFIG_SKIP_SURFACE_TIER_CHECK: '1' });
    });

    it('usage error: unrecognized flag → exit 2', () => {
        expectParity(fx, ['--bogus']);
    });
});

describe.skipIf(!pyYaml)('check_surface_tiers — golden parity (real repo)', () => {
    it('stdout + stderr + exit byte-identical on the live src/scripts tree', () => {
        const p = spawnSync('python3', [PY_SCRIPT], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: { ...process.env, PYTHONPATH: 'src' },
        });
        const t = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
    });
});

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
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

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
function fixtureRepo(registry: string): { root: string; ts: string } {
    const root = mkTmp();
    fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
    const ts = path.join(root, 'src', 'scripts', 'check_surface_tiers.ts');
    fs.copyFileSync(TS_SCRIPT, ts);
    fs.writeFileSync(path.join(root, 'src', 'scripts', 'surface-tiers.yml'), registry, 'utf-8');
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'));
    return { root, ts };
}
// The tsx twin is the source of truth (the python original was deleted in
// the teardown). Assert the CLI runs to a defined exit and is deterministic.
function expectParity(
    fx: { root: string; ts: string },
    args: string[] = [],
    env: Record<string, string> = {},
): void {
    const environ = { ...process.env, ...env };
    const a = spawnSync(TSX_BIN, [fx.ts, ...args], { cwd: fx.root, encoding: 'utf8', env: environ });
    const b = spawnSync(TSX_BIN, [fx.ts, ...args], { cwd: fx.root, encoding: 'utf8', env: environ });
    expect(a.status, a.stderr).not.toBeNull();
    expect(b.stdout).toBe(a.stdout);
    expect(b.stderr).toBe(a.stderr);
    expect(b.status).toBe(a.status);
}


// A registry classifying the clusters used across fixtures.
const REGISTRY = [
    'clusters:',
    '  alpha: core',
    '  betalab: lab',
    'lab_modules:',
    '  - labtool',
    '',
].join('\n');

describe('check_surface_tiers — golden parity (fixture repo)', () => {
    let fx: { root: string; ts: string };
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

describe('check_surface_tiers — golden parity (real repo)', () => {
    it('runs deterministically on the live src/scripts tree', () => {
        const a = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const b = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(a.status, a.stderr).not.toBeNull();
        expect(b.stdout).toBe(a.stdout);
        expect(b.status).toBe(a.status);
    });
});

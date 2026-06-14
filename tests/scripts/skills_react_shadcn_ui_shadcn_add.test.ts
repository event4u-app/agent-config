// Tests for src/skills/react-shadcn-ui/scripts/shadcn_add.ts (py2ts, ADR-094).
//
// No pytest suite exists, so this is a golden-parity suite that runs python3
// vs tsx on synthetic fixtures and compares stdout + stderr + exit code
// byte-for-byte. It covers the main paths (no-init guard, dry-run command
// shape for add / add-all / overwrite, --list empty + sorted listing,
// already-installed guard, the components.json alias-default fallback) and
// the error paths (no components → print_help + exit 1, unrecognized flag →
// exit 2).
//
// No real `npx` is ever spawned: every "would run" path uses --dry-run, and
// the not-initialized / already-installed paths short-circuit before exec, so
// the suite is deterministic and side-effect-free (throwaway tmp dirs only).
// The argparse --help text is NOT byte-compared as a contract, but the
// no-components path runs print_help → stdout and we assert exit-code parity.
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
    'react-shadcn-ui',
    'scripts',
    'shadcn_add.ts',
);
const PY_SCRIPT = path.join(
    REPO_ROOT,
    'src',
    'skills',
    'react-shadcn-ui',
    'scripts',
    'shadcn_add.py',
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
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'shadcn-'));
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

function runPy(args: string[], cwd: string) {
    return spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd });
}
function runTs(args: string[], cwd: string) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd });
}
function assertParity(args: string[], cwd: string, expectedStatus?: number) {
    const py = runPy(args, cwd);
    const ts = runTs(args, cwd);
    expect(ts.status).toBe(py.status);
    if (expectedStatus !== undefined) {
        expect(ts.status).toBe(expectedStatus);
    }
    expect(ts.stdout).toBe(py.stdout);
    expect(ts.stderr).toBe(py.stderr);
    return ts;
}

/** Seed a project dir with a components.json + optional installed *.tsx set. */
function seed(installed: string[] | null, componentsJson = '{"aliases":{"components":"@/components"}}'): string {
    const d = mkTmp();
    if (componentsJson !== '') {
        fs.writeFileSync(path.join(d, 'components.json'), componentsJson);
    }
    if (installed) {
        const uiDir = path.join(d, 'components', 'ui');
        fs.mkdirSync(uiDir, { recursive: true });
        for (const c of installed) {
            fs.writeFileSync(path.join(uiDir, `${c}.tsx`), '');
        }
    }
    return d;
}

describe.runIf(hasPython3())('shadcn_add — golden parity (python3 vs tsx)', () => {
    it('--list with no components.json → "shadcn not initialized" + exit 1', () => {
        const d = mkTmp();
        assertParity(['--list'], d, 1);
    });

    it('add a component with no components.json → init-required + exit 1', () => {
        const d = mkTmp();
        const ts = assertParity(['button'], d, 1);
        expect(ts.stdout).toContain("shadcn not initialized. Run 'npx shadcn@latest init' first");
    });

    it('dry-run add (initialized) → "Would run: npx shadcn@latest add …" + exit 0', () => {
        const d = seed(null);
        const ts = assertParity(['button', 'card', '--dry-run'], d, 0);
        expect(ts.stdout).toBe('Would run: npx shadcn@latest add button card\n');
    });

    it('dry-run --all (initialized) → add --all command shape + exit 0', () => {
        const d = seed(null);
        const ts = assertParity(['--all', '--dry-run'], d, 0);
        expect(ts.stdout).toBe('Would run: npx shadcn@latest add --all\n');
    });

    it('dry-run --overwrite appends the --overwrite flag', () => {
        const d = seed(['button']);
        const ts = assertParity(['button', '--overwrite', '--dry-run'], d, 0);
        expect(ts.stdout).toBe('Would run: npx shadcn@latest add button --overwrite\n');
    });

    it('--list (initialized, empty ui dir) → "No components installed" + exit 0', () => {
        const d = seed(null);
        assertParity(['--list'], d, 0);
    });

    it('--list emits a sorted "- name" listing of installed *.tsx stems', () => {
        const d = seed(['button', 'card', 'alert-dialog']);
        const ts = assertParity(['--list'], d, 0);
        expect(ts.stdout).toBe('Installed components:\n  - alert-dialog\n  - button\n  - card\n');
    });

    it('already-installed component without --overwrite → guard message + exit 1', () => {
        const d = seed(['button']);
        const ts = assertParity(['button', 'dialog'], d, 1);
        expect(ts.stdout).toContain('Components already installed: button. Use --overwrite to reinstall');
    });

    it('components.json without an aliases key falls back to the default "components" dir', () => {
        const d = seed(['button', 'card', 'alert-dialog'], '{}');
        const ts = assertParity(['--list'], d, 0);
        expect(ts.stdout).toBe('Installed components:\n  - alert-dialog\n  - button\n  - card\n');
    });

    it('no components (and no --all/--list) → print_help to stdout + exit 1', () => {
        const d = seed(null);
        // --help text is not part of the byte contract, but exit-code + the
        // stdout/stderr split must match (print_help → stdout, then exit 1).
        assertParity([], d, 1);
    });

    it('unrecognized flag → byte-identical usage + error + exit 2', () => {
        const d = mkTmp();
        const ts = assertParity(['--bogus'], d, 2);
        expect(ts.stderr).toContain('unrecognized arguments: --bogus');
    });
});

// Contract tests for src/skills/react-shadcn-ui/scripts/shadcn_add.ts (py2ts,
// ADR-094). The tsx twin is the source of truth (the python original was
// deleted in the teardown). Covers the main paths (no-init guard, dry-run
// command shape for add / add-all / overwrite, --list empty + sorted listing,
// already-installed guard, the components.json alias-default fallback) and the
// error paths (no components → print_help + exit 1, unrecognized flag → exit 2).
//
// No real `npx` is ever spawned: every "would run" path uses --dry-run, and
// the not-initialized / already-installed paths short-circuit before exec, so
// the suite is deterministic and side-effect-free (throwaway tmp dirs only).
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
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

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

function runTs(args: string[], cwd: string) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd });
}
/** Run tsx, assert the exit code, return the result. */
function run(args: string[], cwd: string, expectedStatus: number) {
    const ts = runTs(args, cwd);
    expect(ts.status, ts.stderr).toBe(expectedStatus);
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

describe('shadcn_add — CLI contract', () => {
    it('--list with no components.json → "shadcn not initialized" + exit 1', () => {
        const ts = run(['--list'], mkTmp(), 1);
        expect(ts.stdout).toContain('shadcn not initialized');
    });

    it('add a component with no components.json → init-required + exit 1', () => {
        const ts = run(['button'], mkTmp(), 1);
        expect(ts.stdout).toContain("shadcn not initialized. Run 'npx shadcn@latest init' first");
    });

    it('dry-run add (initialized) → "Would run: npx shadcn@latest add …" + exit 0', () => {
        const ts = run(['button', 'card', '--dry-run'], seed(null), 0);
        expect(ts.stdout).toBe('Would run: npx shadcn@latest add button card\n');
    });

    it('dry-run --all (initialized) → add --all command shape + exit 0', () => {
        const ts = run(['--all', '--dry-run'], seed(null), 0);
        expect(ts.stdout).toBe('Would run: npx shadcn@latest add --all\n');
    });

    it('dry-run --overwrite appends the --overwrite flag', () => {
        const ts = run(['button', '--overwrite', '--dry-run'], seed(['button']), 0);
        expect(ts.stdout).toBe('Would run: npx shadcn@latest add button --overwrite\n');
    });

    it('--list (initialized, empty ui dir) → "No components installed" + exit 0', () => {
        const ts = run(['--list'], seed(null), 0);
        expect(ts.stdout).toContain('No components installed');
    });

    it('--list emits a sorted "- name" listing of installed *.tsx stems', () => {
        const ts = run(['--list'], seed(['button', 'card', 'alert-dialog']), 0);
        expect(ts.stdout).toBe('Installed components:\n  - alert-dialog\n  - button\n  - card\n');
    });

    it('already-installed component without --overwrite → guard message + exit 1', () => {
        const ts = run(['button', 'dialog'], seed(['button']), 1);
        expect(ts.stdout).toContain('Components already installed: button. Use --overwrite to reinstall');
    });

    it('components.json without an aliases key falls back to the default "components" dir', () => {
        const ts = run(['--list'], seed(['button', 'card', 'alert-dialog'], '{}'), 0);
        expect(ts.stdout).toBe('Installed components:\n  - alert-dialog\n  - button\n  - card\n');
    });

    it('no components (and no --all/--list) → print_help to stdout + exit 1', () => {
        // print_help emits argparse usage prose (COLUMNS-dependent), so assert
        // the exit code + stdout/stderr split + a stable usage-line token, not
        // byte-identical prose.
        const ts = run([], seed(null), 1);
        expect(ts.stdout).toMatch(/usage:\s+shadcn_add/u);
    });

    it('unrecognized flag → usage + error + exit 2', () => {
        const ts = run(['--bogus'], mkTmp(), 2);
        expect(ts.stderr).toContain('unrecognized arguments: --bogus');
    });
});

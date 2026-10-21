// A fresh git worktree of an agent-config SOURCE checkout — the shape a Superset
// worktree has — carries an executable `./agent-config` wrapper (tracked) but no
// `node_modules/` and no built `dist/` (both gitignored). The wrapper is present
// and cannot run: its deps are not there. These run the real manifest-derived
// hook commands under /bin/sh, in a fake HOME, with a stripped PATH.

import { spawnSync } from 'node:child_process';
import { chmodSync, closeSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { build_claude_hook_matrix } from '../../src/scripts/_lib/claude_settings_hooks.js';
import { stageRuntime } from '../../src/install/stagedRuntime.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MATRIX = build_claude_hook_matrix(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'));

let tmp: string;
let machine: string;
let worktree: string;
let globalBin: string;

function write(p: string, body: string, mode?: number): void {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, body);
    if (mode !== undefined) chmodSync(p, mode);
}

/** A source worktree exactly as git checks it out: wrapper and manifest, nothing built, no deps. */
function freshSourceWorktree(dir: string): void {
    write(path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'), 'schema_version: 1\n');
    // Stands in for `./agent-config -> src/scripts/agent-config` in a checkout
    // whose node_modules are missing: present, executable, and unable to run.
    write(
        path.join(dir, 'agent-config'),
        "#!/bin/sh\necho \"Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'yaml'\" >&2\nexit 1\n",
        0o755,
    );
}

/** An `agent-config` on PATH that works — a global `npm i -g` install. */
function workingGlobalCli(dir: string): void {
    write(path.join(dir, 'agent-config'), "#!/bin/sh\necho \"GLOBAL-CLI $*\"\n", 0o755);
}

function fixturePackage(dir: string): string {
    write(path.join(dir, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '9.9.9' }));
    write(path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'), 'schema_version: 1\n');
    write(
        path.join(dir, 'dist', 'hooks', 'dispatch.js'),
        "process.stdout.write('STAGED-DISPATCH ' + process.argv.slice(2, 6).join(' ') + '\\n');\n",
    );
    return dir;
}

function run(native: string, projectDir: string = worktree) {
    const stdinPath = path.join(tmp, 'stdin.json');
    writeFileSync(stdinPath, '{}');
    const fd = openSync(stdinPath, 'r');
    try {
        const res = spawnSync('/bin/sh', ['-c', MATRIX[native] as string], {
            cwd: projectDir,
            stdio: [fd, 'pipe', 'pipe'],
            encoding: 'utf-8',
            env: {
                PATH: `${globalBin}:/usr/bin:/bin`,
                HOME: tmp,
                EVENT4U_CONFIG_HOME: machine,
                CLAUDE_PROJECT_DIR: projectDir,
            },
            timeout: 30000,
        });
        expect(res.error).toBeUndefined();
        return res;
    } finally {
        closeSync(fd);
    }
}

beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'fresh-wt-'));
    machine = path.join(tmp, 'machine');
    worktree = path.join(tmp, 'worktree');
    globalBin = path.join(tmp, 'global-bin');
    mkdirSync(globalBin, { recursive: true });
    freshSourceWorktree(worktree);
    workingGlobalCli(globalBin);
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('a fresh source worktree with no node_modules', () => {
    it('does not hand the event to the local wrapper that cannot run (no staged runtime)', () => {
        // The v16.5.0 failure, minus the staged runtime that came later: every
        // event errored with ERR_MODULE_NOT_FOUND because `[ -x ./agent-config ]`
        // is true for a wrapper whose dependencies are absent.
        const res = run('SessionStart');
        expect(res.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
        expect(res.stdout).toContain('GLOBAL-CLI dispatch:hook');
    });

    it('every hook event avoids the broken wrapper, not only SessionStart', () => {
        for (const native of Object.keys(MATRIX)) {
            const res = run(native);
            expect(res.stderr, native).not.toContain('ERR_MODULE_NOT_FOUND');
            expect(res.status, native).toBe(0);
        }
    });

    it('reaches the staged runtime when one is staged, ahead of both wrapper and PATH', () => {
        stageRuntime({ packageRoot: fixturePackage(path.join(tmp, 'pkg')), runtimeRoot: path.join(machine, 'runtime'), nodePath: process.execPath });
        const res = run('SessionStart');
        expect(res.stdout).toContain('STAGED-DISPATCH --platform claude --event session_start');
        expect(res.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
    });

    it('a denying guard still denies through the PATH fallback a fresh worktree now takes', () => {
        // The route changed, so the property that matters most is re-checked on
        // it: a fail_closed concern exits 2 to refuse, and the hook command must
        // pass that 2 through rather than degrade it to "the hook ran".
        write(path.join(globalBin, 'agent-config'), '#!/bin/sh\necho "blocked by guard" >&2\nexit 2\n', 0o755);
        const res = run('PreToolUse');
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('blocked by guard');
    });

    it('two worktrees side by side take the same package-owned route, from one shared runtime', () => {
        // The hook command reads only CLAUDE_PROJECT_DIR and the shared,
        // read-only machine runtime, so parallel worktrees cannot pick each
        // other's wrapper — and since 17.0.0 neither picks its own either.
        const withDeps = path.join(tmp, 'worktree-with-deps');
        write(path.join(withDeps, 'agent-config'), '#!/bin/sh\necho "LOCAL-A $*"\n', 0o755);
        mkdirSync(path.join(withDeps, 'node_modules'), { recursive: true });
        const a = run('SessionStart', withDeps);
        const b = run('SessionStart', worktree);
        expect(a.stdout).toContain('GLOBAL-CLI dispatch:hook');
        expect(a.stdout).not.toContain('LOCAL-A');
        expect(b.stdout).toContain('GLOBAL-CLI dispatch:hook');
        expect(b.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
    });

    it('never uses the local wrapper, even once the checkout HAS its node_modules', () => {
        // 17.0.0 finding feaebdef733b: a project-tree wrapper is code the
        // repository controls, so it never runs as the user's hook. A maintainer
        // testing hook changes reinstalls to stage them (owner decision 2026-10-21).
        mkdirSync(path.join(worktree, 'node_modules'), { recursive: true });
        write(path.join(worktree, 'agent-config'), "#!/bin/sh\necho \"LOCAL-WRAPPER $*\"\n", 0o755);
        const res = run('SessionStart');
        expect(res.stdout).not.toContain('LOCAL-WRAPPER');
        expect(res.stdout).toContain('GLOBAL-CLI dispatch:hook');
    });
});

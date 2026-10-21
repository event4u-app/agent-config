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

function run(native: string) {
    const stdinPath = path.join(tmp, 'stdin.json');
    writeFileSync(stdinPath, '{}');
    const fd = openSync(stdinPath, 'r');
    try {
        const res = spawnSync('/bin/sh', ['-c', MATRIX[native] as string], {
            cwd: worktree,
            stdio: [fd, 'pipe', 'pipe'],
            encoding: 'utf-8',
            env: {
                PATH: `${globalBin}:/usr/bin:/bin`,
                HOME: tmp,
                EVENT4U_CONFIG_HOME: machine,
                CLAUDE_PROJECT_DIR: worktree,
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

    it('still uses the local wrapper once the checkout HAS its node_modules', () => {
        // The source runtime is not banned, only gated on its prerequisite — a
        // maintainer who ran `npm ci` in the worktree gets the local version.
        mkdirSync(path.join(worktree, 'node_modules'), { recursive: true });
        write(path.join(worktree, 'agent-config'), "#!/bin/sh\necho \"LOCAL-WRAPPER $*\"\n", 0o755);
        const res = run('SessionStart');
        expect(res.stdout).toContain('LOCAL-WRAPPER dispatch:hook');
    });
});

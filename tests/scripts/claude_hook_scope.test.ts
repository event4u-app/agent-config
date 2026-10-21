// `hooks:status` reported Claude hooks "missing" on a machine whose global
// install had registered them in `~/.claude/settings.json`, because it only ever
// looked at `<project>/.claude/settings.json`. It also reported "installed" for
// any project settings file that merely EXISTED, foreign hooks or none. These
// pin both directions, plus the four states the report now distinguishes.

import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claudeHookScope } from '../../src/scripts/_lib/claude_hook_scope.js';

let tmp: string;
let home: string;
let project: string;
let runtimeRoot: string;
let bin: string;

const AC_COMMAND = 'R=...; "$BIN" dispatch:hook --platform claude --event session_start';
const FOREIGN_COMMAND = 'superset hook session-start';

function write(p: string, body: string, mode?: number): void {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, body);
    if (mode !== undefined) chmodSync(p, mode);
}

function settings(file: string, commands: string[]): void {
    write(file, JSON.stringify({ hooks: { SessionStart: [{ hooks: commands.map((command) => ({ type: 'command', command })) }] } }));
}

function stagedRuntime(version: string): void {
    const current = path.join(runtimeRoot, 'current');
    write(path.join(current, 'dist', 'hooks', 'dispatch.js'), '// bundle\n');
    write(path.join(current, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version }));
    write(path.join(current, 'node'), `${process.execPath}\n`);
}

function scope() {
    return claudeHookScope({ projectRoot: project, home, runtimeRoot, pathEnv: bin });
}

beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'hook-scope-'));
    home = path.join(tmp, 'home');
    project = path.join(tmp, 'project');
    runtimeRoot = path.join(tmp, 'machine', 'runtime');
    bin = path.join(tmp, 'bin');
    for (const d of [home, project, bin]) mkdirSync(d, { recursive: true });
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('where the hooks are registered', () => {
    it('a global install is found in ~/.claude/settings.json, not reported missing', () => {
        settings(path.join(home, '.claude', 'settings.json'), [AC_COMMAND]);
        const s = scope();
        expect(s.registered_in).toEqual(['global']);
        expect(s.managed_commands.global).toBe(1);
        expect(s.state).not.toBe('not-installed');
    });

    it('a project settings file holding only foreign hooks is not an agent-config install', () => {
        settings(path.join(project, '.claude', 'settings.json'), [FOREIGN_COMMAND]);
        const s = scope();
        expect(s.registered_in).toEqual([]);
        expect(s.foreign_commands.project).toBe(1);
        expect(s.state).toBe('not-installed');
    });

    it('counts managed and foreign commands separately in the same file', () => {
        settings(path.join(home, '.claude', 'settings.json'), [AC_COMMAND, FOREIGN_COMMAND, FOREIGN_COMMAND]);
        const s = scope();
        expect(s.managed_commands.global).toBe(1);
        expect(s.foreign_commands.global).toBe(2);
    });

    it('reports both scopes when both carry managed hooks', () => {
        settings(path.join(home, '.claude', 'settings.json'), [AC_COMMAND]);
        settings(path.join(project, '.claude', 'settings.json'), [AC_COMMAND]);
        expect(scope().registered_in).toEqual(['global', 'project']);
    });
});

describe('the four states', () => {
    it('not-installed: no managed hook anywhere', () => {
        expect(scope().state).toBe('not-installed');
    });

    it('installed-not-executable: hooks registered, no runtime they can reach', () => {
        settings(path.join(home, '.claude', 'settings.json'), [AC_COMMAND]);
        const s = scope();
        expect(s.runtime).toBe('none');
        expect(s.state).toBe('installed-not-executable');
    });

    it('executable: hooks registered and the staged runtime present, with its version', () => {
        settings(path.join(home, '.claude', 'settings.json'), [AC_COMMAND]);
        stagedRuntime('16.6.0');
        const s = scope();
        expect(s.runtime).toBe('staged');
        expect(s.runtime_version).toBe('16.6.0');
        expect(s.state).toBe('executable');
    });

    it('observed-at-runtime: the last carrier probe reached a dispatcher', () => {
        settings(path.join(home, '.claude', 'settings.json'), [AC_COMMAND]);
        stagedRuntime('16.6.0');
        write(path.join(runtimeRoot, 'carrier.json'), JSON.stringify({ hosts: { claude: { host: 'claude', outcome: 'reached', date: '2026-10-21', version: '16.6.0' } } }));
        expect(scope().state).toBe('observed-at-runtime');
    });

    it('a probe that did NOT reach keeps the state at executable, never upgrades it', () => {
        settings(path.join(home, '.claude', 'settings.json'), [AC_COMMAND]);
        stagedRuntime('16.6.0');
        write(path.join(runtimeRoot, 'carrier.json'), JSON.stringify({ hosts: { claude: { host: 'claude', outcome: 'not-reached', date: '2026-10-21', version: '16.6.0' } } }));
        expect(scope().state).toBe('executable');
    });
});

describe('the runtime it resolves mirrors the hook command, in order', () => {
    beforeEach(() => settings(path.join(home, '.claude', 'settings.json'), [AC_COMMAND]));

    it('a fresh source worktree without node_modules does not count its wrapper as a runtime', () => {
        write(path.join(project, 'src', 'scripts', 'hook_manifest.yaml'), 'schema_version: 1\n');
        write(path.join(project, 'agent-config'), '#!/bin/sh\n', 0o755);
        write(path.join(bin, 'agent-config'), '#!/bin/sh\n', 0o755);
        expect(scope().runtime).toBe('path-cli');
    });

    it('the same wrapper counts once the checkout has its node_modules', () => {
        write(path.join(project, 'agent-config'), '#!/bin/sh\n', 0o755);
        mkdirSync(path.join(project, 'node_modules'), { recursive: true });
        expect(scope().runtime).toBe('local-wrapper');
    });

    it('a project-local npm install wins ahead of the staged runtime', () => {
        stagedRuntime('16.6.0');
        write(path.join(project, 'node_modules', '@event4u', 'agent-config', 'dist', 'hooks', 'dispatch.js'), '//\n');
        write(path.join(project, 'node_modules', '@event4u', 'agent-config', 'package.json'), JSON.stringify({ version: '16.7.0' }));
        const s = scope();
        expect(s.runtime).toBe('project-local');
        expect(s.runtime_version).toBe('16.7.0');
    });
});

describe('version skew is surfaced, not hidden', () => {
    it('warns when the staged runtime is older than the source checkout it serves', () => {
        // A maintainer editing a guard in a newer checkout, without a built
        // bundle, would otherwise get the OLDER staged guard silently.
        settings(path.join(home, '.claude', 'settings.json'), [AC_COMMAND]);
        stagedRuntime('16.5.0');
        write(path.join(project, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '16.6.0' }));
        write(path.join(project, 'src', 'scripts', 'hook_manifest.yaml'), 'schema_version: 1\n');
        const s = scope();
        expect(s.runtime).toBe('staged');
        expect(s.version_skew).toMatch(/16\.5\.0.*older.*16\.6\.0/);
    });

    it('no skew warning when the versions match', () => {
        settings(path.join(home, '.claude', 'settings.json'), [AC_COMMAND]);
        stagedRuntime('16.6.0');
        write(path.join(project, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '16.6.0' }));
        write(path.join(project, 'src', 'scripts', 'hook_manifest.yaml'), 'schema_version: 1\n');
        expect(scope().version_skew).toBeNull();
    });
});

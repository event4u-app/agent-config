// road-to-a-hook-carrier-that-is-never-silent 5.1 / 5.2: a plugin-only install
// (no project-local npm install, no `agent-config` on PATH) used to end every
// generated command in `|| exit 0` — no concern ran, the fail_closed guards
// included, and nothing said so. These run the SHIPPED hooks/hooks.json
// commands in an empty directory under a stripped PATH.
//
// The plugin branch is keyed on CLAUDE_PLUGIN_ROOT, which the host sets for a
// plugin's hooks only. The managed settings.json block carries the byte-same
// command (dedupe depends on it), and its no-dispatcher branch stays silent:
// that carrier is Phase 3's, where silence on a full layer is the decided
// behaviour.

import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PLUGIN_HOOKS = path.join(REPO_ROOT, 'hooks', 'hooks.json');

function pluginCommand(native: string): string {
    const hooks = (
        JSON.parse(readFileSync(PLUGIN_HOOKS, 'utf8')) as {
            hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
        }
    ).hooks;
    const command = hooks[native]?.[0]?.hooks[0]?.command;
    if (command === undefined) throw new Error(`no ${native} command in hooks/hooks.json`);
    return command;
}

describe('plugin hook command — no dispatcher reachable', () => {
    let ws: string;

    beforeEach(() => {
        ws = mkdtempSync(path.join(tmpdir(), 'plugin-nodispatch-'));
    });
    afterEach(() => {
        rmSync(ws, { recursive: true, force: true });
    });

    function run(native: string, pluginRoot: string | undefined) {
        const env: Record<string, string> = {
            PATH: '/usr/bin:/bin',
            HOME: ws,
            CLAUDE_PROJECT_DIR: ws,
        };
        if (pluginRoot !== undefined) env['CLAUDE_PLUGIN_ROOT'] = pluginRoot;
        // stdin from a file, not `input`: a branch that exits without reading stdin
        // races a piped write into EPIPE, which is the harness failing, not the hook.
        const stdinPath = path.join(ws, 'stdin.json');
        writeFileSync(stdinPath, '{}');
        const stdinFd = openSync(stdinPath, 'r');
        try {
            const res = spawnSync('/bin/sh', ['-c', pluginCommand(native)], {
                cwd: ws,
                stdio: [stdinFd, 'pipe', 'pipe'],
                encoding: 'utf-8',
                env,
                timeout: 30000,
            });
            expect(res.error).toBeUndefined();
            return res;
        } finally {
            closeSync(stdinFd);
        }
    }

    it('SessionStart prints one stderr line, one context line, and exits 0', () => {
        const res = run('SessionStart', path.join(ws, 'plugin'));
        expect(res.status).toBe(0);
        const errLines = res.stderr.split('\n').filter((l) => l !== '');
        expect(errLines).toHaveLength(1);
        expect(errLines[0]).toContain('no hook dispatcher');
        expect(errLines[0]).toContain('npm i -g @event4u/agent-config');
        expect(errLines[0]).toContain('npx -y @event4u/agent-config init');
        const outLines = res.stdout.split('\n').filter((l) => l !== '');
        expect(outLines).toHaveLength(1);
        for (const guard of ['block-no-verify', 'block-kernel-rule-writes', 'block-plumbing-writes']) {
            expect(outLines[0]).toContain(guard);
        }
    });

    it('a non-SessionStart event prints the stderr line only — no context line per tool call', () => {
        const res = run('PreToolUse', path.join(ws, 'plugin'));
        expect(res.status).toBe(0);
        expect(res.stderr.split('\n').filter((l) => l !== '')).toHaveLength(1);
        expect(res.stdout).toBe('');
    });

    it('without CLAUDE_PLUGIN_ROOT the branch stays silent (settings carrier, Phase 3)', () => {
        for (const native of ['SessionStart', 'PreToolUse']) {
            const res = run(native, undefined);
            expect(res.status).toBe(0);
            expect(res.stdout).toBe('');
            expect(res.stderr).toBe('');
        }
    });
});

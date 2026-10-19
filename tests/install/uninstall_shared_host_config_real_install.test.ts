/**
 * `surgical-uninstall`, on the path a consumer actually runs.
 *
 * The claim in `docs/CLAIMS.md` is key-level: uninstall removes only this
 * package's own entries from a shared host config, and a neighbour tool's
 * entries survive byte-identical — including inside a shared `hooks.<event>`
 * array. Until this file the claim's only `exec:` evidence was unit tests over
 * `json_pointers` and `host_hook_merge`, which drive the merge functions with
 * hand-built documents. Neither runs the installer, and neither touches the
 * writer the default consumer host goes through: a global `claude-code`
 * install registers its hooks in `~/.claude/settings.json` through
 * `claude_settings_hooks.ts`, and `uninstall --global` removes them through
 * `remove_managed_hooks` — a different function from the pointer subtraction
 * the unit tests pin.
 *
 * So this case drives the real bash orchestrator and the real uninstall CLI
 * into a throwaway HOME whose settings file already carries a neighbour's hook
 * group in the SAME `PreToolUse` array this package appends to, plus a
 * neighbour's top-level key, and compares bytes.
 *
 * HOME and EVENT4U_CONFIG_HOME are injected, never inherited, per the harness
 * contract in `docs/contracts/consumer-harness.md`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ORCHESTRATOR = path.join(REPO_ROOT, 'src', 'scripts', 'install');
const UNINSTALL = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_uninstall.ts');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

/** A neighbour package's hook group, in the matcher/hooks shape Claude Code reads. */
const FOREIGN_GROUP = {
    matcher: 'Bash',
    hooks: [{ type: 'command', command: 'npx other-agent-pack hook --event pre' }],
};

/** The settings file as the user had it before this package arrived. */
const BEFORE = { theme: 'dark', hooks: { PreToolUse: [FOREIGN_GROUP] } };

const made: string[] = [];

afterEach(() => {
    while (made.length > 0) fs.rmSync(made.pop() as string, { recursive: true, force: true });
});

function mkTmp(prefix: string): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    made.push(dir);
    return dir;
}

function env(home: string): NodeJS.ProcessEnv {
    return {
        ...process.env,
        HOME: home,
        EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
        AGENT_CONFIG_DEPLOY_INVENTORY: undefined,
        AGENT_CONFIG_INSTALLED_TOOLS: undefined,
        AGENT_CONFIG_NO_UI: '1',
        CI: '1',
    };
}

describe('surgical-uninstall — a real global claude-code install and uninstall', () => {
    it('removes only its own hook groups and leaves the neighbour byte-identical', () => {
        const home = mkTmp('surgical-home-');
        const cwd = mkTmp('surgical-cwd-');
        const settingsPath = path.join(home, '.claude', 'settings.json');
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        const beforeBytes = JSON.stringify(BEFORE, null, 2) + '\n';
        fs.writeFileSync(settingsPath, beforeBytes);

        const inst = spawnSync('bash', [ORCHESTRATOR, '--global', '--tools=claude-code', '--yes', '--quiet'], {
            cwd,
            encoding: 'utf8',
            timeout: 240_000,
            env: env(home),
        });
        expect(inst.status, `install failed:\n${inst.stdout}\n${inst.stderr}`).toBe(0);

        // The precondition the uninstall half depends on: this package really did
        // append to the neighbour's array rather than replace it or skip it.
        const installed = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
            theme?: string;
            hooks: Record<string, unknown[]>;
        };
        const pre = installed.hooks['PreToolUse'] ?? [];
        expect(pre.length, 'install wrote no PreToolUse group of its own').toBeGreaterThan(1);
        expect(JSON.stringify(pre[0])).toBe(JSON.stringify(FOREIGN_GROUP));
        expect(installed.theme).toBe('dark');
        // The credential deny rows are offered by `hooks:doctor`, never written
        // by the installer.
        expect(installed).not.toHaveProperty('permissions');

        const un = spawnSync(TSX, [UNINSTALL, '--global', '--tools', 'claude-code'], {
            cwd,
            encoding: 'utf8',
            timeout: 120_000,
            env: env(home),
        });
        expect(un.status, `uninstall failed:\n${un.stdout}\n${un.stderr}`).toBe(0);

        // Every key and every array entry this package added is gone, and what
        // the neighbour wrote is back to the exact bytes it started with.
        expect(fs.readFileSync(settingsPath, 'utf8')).toBe(beforeBytes);
    }, 400_000);
});

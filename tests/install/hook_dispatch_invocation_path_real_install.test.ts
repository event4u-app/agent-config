/**
 * `hook-dispatch-latency`, read off a real install instead of the bench's own tree.
 *
 * The claim says the CI latency gate measures the REAL invocation path: the
 * exact command an install writes, reaching one precompiled dispatcher. Its
 * evidence used to be `docs/hook-latency.json#invocation_path`, which records
 * what the gate timed in this repository — a statement about the bench, which
 * an installer that wrote a different command, or staged a different bundle,
 * would leave untouched.
 *
 * So this case runs the real bash orchestrator into a throwaway HOME and holds
 * the two halves of "what the gate times is what a consumer runs" equal:
 *
 *   1. for every event the gate times, the command in the installed
 *      `~/.claude/settings.json` is byte-identical to the command
 *      `bench_hook_latency --via-cli` executes;
 *   2. the dispatcher that command reaches on the installed copy is the bundle
 *      the gate reaches, byte for byte, and executing the installed command
 *      dispatches through it rather than falling through to the
 *      "no hook dispatcher reachable" exit.
 *
 * The latency figures themselves stay readings of the CI gate on GitHub-hosted
 * runners; a vitest wall-clock bound here would measure the shard, not the path.
 *
 * HOME and EVENT4U_CONFIG_HOME are injected, never inherited, per
 * `docs/contracts/consumer-harness.md`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { MANAGED_SIGNATURE } from '../../src/scripts/_lib/claude_settings_hooks.js';
import { EVENTS, NATIVE_EVENT, hooksJsonCommand } from '../../src/scripts/bench_hook_latency.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ORCHESTRATOR = path.join(REPO_ROOT, 'src', 'scripts', 'install');
const REPO_BUNDLE = path.join(REPO_ROOT, 'dist', 'hooks', 'dispatch.js');
const FALLTHROUGH = 'no hook dispatcher reachable';

const made: string[] = [];

afterEach(() => {
    while (made.length > 0) fs.rmSync(made.pop() as string, { recursive: true, force: true });
});

function mkTmp(prefix: string): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    made.push(dir);
    return dir;
}

/** The managed command the install wrote for one native event. */
function installedCommand(settings: { hooks?: Record<string, unknown> }, native: string): string {
    const groups = (settings.hooks?.[native] ?? []) as Array<{ hooks?: Array<{ command?: string }> }>;
    const commands = groups
        .flatMap((g) => g.hooks ?? [])
        .map((h) => h.command ?? '')
        .filter((c) => c.includes(MANAGED_SIGNATURE) || c.includes('dispatch.js'));
    expect(commands, `exactly one managed ${native} command expected`).toHaveLength(1);
    return commands[0] as string;
}

describe('hook-dispatch-latency — the timed path is the installed path', () => {
    it('installs the exact command the gate times, reaching the bundle the gate times', () => {
        expect(
            fs.existsSync(REPO_BUNDLE),
            'dist/hooks/dispatch.js is not built — run `npm run build:hooks`; the gate times this bundle',
        ).toBe(true);

        const home = mkTmp('hooklat-home-');
        const cwd = mkTmp('hooklat-cwd-');
        const project = mkTmp('hooklat-project-');
        const configHome = path.join(home, '.event4u', 'agent-config');

        const r = spawnSync('bash', [ORCHESTRATOR, '--global', '--tools=claude-code', '--yes', '--quiet'], {
            cwd,
            encoding: 'utf8',
            timeout: 180_000,
            // A maintainer's inventory/lock overrides must not steer a real
            // install out of the injected HOME.
            env: {
                ...process.env,
                HOME: home,
                EVENT4U_CONFIG_HOME: configHome,
                AGENT_CONFIG_NO_UI: '1',
                CI: '1',
                AGENT_CONFIG_DEPLOY_INVENTORY: undefined,
                AGENT_CONFIG_INSTALLED_TOOLS: undefined,
            },
        });
        expect(r.status, `install failed:\n${r.stdout}\n${r.stderr}`).toBe(0);

        const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8')) as {
            hooks?: Record<string, unknown>;
        };

        // Half 1 — every timed event: installed command === timed command.
        expect(EVENTS.length).toBeGreaterThan(0);
        for (const event of EVENTS) {
            const native = NATIVE_EVENT[event] ?? event;
            expect(installedCommand(settings, native), `${native}: installed command differs from the timed one`).toBe(
                hooksJsonCommand(event),
            );
        }

        // Half 2 — the dispatcher the installed command reaches is the timed bundle.
        const staged = path.join(configHome, 'runtime', 'current', 'dist', 'hooks', 'dispatch.js');
        expect(fs.existsSync(staged), 'the install staged no dispatcher bundle').toBe(true);
        expect(fs.readFileSync(staged).equals(fs.readFileSync(REPO_BUNDLE)), 'staged bundle differs from the timed one').toBe(
            true,
        );

        // Executing the installed command dispatches through that bundle. PATH
        // carries no `agent-config` and CLAUDE_PLUGIN_ROOT is set, so the only
        // way past the bundle branches is the fallthrough, which says so on stderr.
        const payload = JSON.stringify({
            session_id: 'harness-hook-latency',
            cwd: project,
            hook_event_name: 'pre_tool_use',
            tool_name: 'Read',
            tool_input: { file_path: path.join(project, 'README.md') },
        });
        const run = spawnSync('bash', ['-c', installedCommand(settings, 'PreToolUse')], {
            cwd: project,
            input: payload,
            encoding: 'utf8',
            timeout: 60_000,
            env: {
                HOME: home,
                EVENT4U_CONFIG_HOME: configHome,
                CLAUDE_PROJECT_DIR: project,
                CLAUDE_PLUGIN_ROOT: path.join(home, 'no-plugin'),
                PATH: '/usr/bin:/bin',
                AGENT_CONFIG_NO_UI: '1',
            },
        });
        expect(run.stderr ?? '', 'the installed command fell through instead of dispatching').not.toContain(FALLTHROUGH);
        expect(run.status, `installed dispatch exited non-zero:\n${run.stdout}\n${run.stderr}`).toBe(0);
    }, 240_000);
});

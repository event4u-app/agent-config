import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CorruptSettingsError,
    MANAGED_SIGNATURE,
    NO_DISPATCHER_CONTEXT,
    NO_DISPATCHER_STDERR,
    THINNED_DEAD_CARRIER_LINE,
    build_claude_hook_matrix,
    ensure_managed_hooks,
    remove_managed_hooks,
} from '../../src/scripts/_lib/claude_settings_hooks.js';

function expectedCommand(acEvent: string, native: string): string {
    const args =
        `--platform claude --event ${acEvent} --native-event ${native} ` +
        '--project-dir "$CLAUDE_PROJECT_DIR" --min-version 1';
    const thinned =
        native === 'SessionStart'
            ? `[ -z "$AC_HOOK_PROBE" ] && [ -f "$R/thinned" ] && { echo '${THINNED_DEAD_CARRIER_LINE}'; ` +
              'L=""; read -r L < "$R/thinned"; F=1; ' +
              'if [ -d "$L" ] && [ -d "$S/claude-rules" ]; then F=0; for f in "$S/claude-rules"/*.md; do ' +
              '[ -f "$f" ] || continue; t="$L/${f##*/}"; ' +
              'if [ ! -e "$t" ] || grep -qx "package: event4u/agent-config" "$t"; then ' +
              'cp "$f" "$t.ac-restore" && mv -f "$t.ac-restore" "$t" || F=1; fi; done; fi; ' +
              '[ "$F" = 0 ] && mv -f "$R/thinned" "$R/demoted"; }; '
            : '';
    return (
        'R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; ' +
        '[ -f "$S/node" ] && read -r N < "$S/node"; ' +
        'if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then ' +
        `exec "$N" "$S/dist/hooks/dispatch.js" ${args}; fi; ` +
        // Only an absolute agent-config outside the opened project is trusted
        // (17.0.0 finding feaebdef733b); nothing in the project tree runs.
        'BIN=$(command -v agent-config 2>/dev/null); [ "${BIN#/}" = "$BIN" ] && BIN=""; ' +
        '[ -n "$CLAUDE_PROJECT_DIR" ] && [ "${BIN#"$CLAUDE_PROJECT_DIR"/}" != "$BIN" ] && BIN=""; ' +
        `[ -n "$BIN" ] || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo '${NO_DISPATCHER_STDERR}' >&2;${
            native === 'SessionStart' ? ` echo '${NO_DISPATCHER_CONTEXT}';` : ''
        } }; ${thinned}exit 0; }; ` +
        `"$BIN" dispatch:hook ${args}`
    );
}

const MATRIX = {
    SessionStart: expectedCommand('session_start', 'SessionStart'),
    Stop: expectedCommand('stop', 'Stop'),
};

function read(p: string): Record<string, unknown> {
    return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
}

describe('claude_settings_hooks', () => {
    let root: string;
    let settings: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'csh-'));
        settings = join(root, 'settings.json');
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('creates the file with the managed matrix when absent', () => {
        const res = ensure_managed_hooks(settings, MATRIX);
        expect(res.changed).toBe(true);
        expect(res.events.sort()).toEqual(['SessionStart', 'Stop']);
        const data = read(settings);
        const hooks = data['hooks'] as Record<string, unknown[]>;
        expect(Object.keys(hooks).sort()).toEqual(['SessionStart', 'Stop']);
        const group = hooks['SessionStart'][0] as { hooks: { command: string }[] };
        expect(group.hooks[0].command).toContain(MANAGED_SIGNATURE);
    });

    it('is idempotent — second run produces zero diff', () => {
        ensure_managed_hooks(settings, MATRIX);
        const first = readFileSync(settings, 'utf8');
        const res = ensure_managed_hooks(settings, MATRIX);
        expect(res.changed).toBe(false);
        expect(readFileSync(settings, 'utf8')).toBe(first);
    });

    it('preserves user hooks on the same event (collision)', () => {
        writeFileSync(
            settings,
            JSON.stringify({
                hooks: {
                    SessionStart: [{ hooks: [{ type: 'command', command: 'my-custom-init.sh' }] }],
                },
                model: 'opus',
            }),
        );
        ensure_managed_hooks(settings, MATRIX);
        const data = read(settings);
        expect(data['model']).toBe('opus');
        const groups = (data['hooks'] as Record<string, unknown[]>)['SessionStart'] as Array<{
            hooks: { command: string }[];
        }>;
        expect(groups).toHaveLength(2);
        expect(groups[0].hooks[0].command).toBe('my-custom-init.sh');
        expect(groups[1].hooks[0].command).toContain(MANAGED_SIGNATURE);
    });

    it('replaces a stale managed entry in place instead of appending', () => {
        writeFileSync(
            settings,
            JSON.stringify({
                hooks: {
                    Stop: [
                        {
                            hooks: [
                                {
                                    type: 'command',
                                    command: `old-binary dispatch:hook --platform claude --event stop`,
                                },
                            ],
                        },
                    ],
                },
            }),
        );
        ensure_managed_hooks(settings, MATRIX);
        const groups = (read(settings)['hooks'] as Record<string, unknown[]>)['Stop'] as Array<{
            hooks: { command: string }[];
        }>;
        expect(groups).toHaveLength(1);
        expect(groups[0].hooks[0].command).toBe(MATRIX.Stop);
    });

    it('removal deletes exactly the managed entries and nothing else', () => {
        writeFileSync(
            settings,
            JSON.stringify({
                hooks: {
                    SessionStart: [{ hooks: [{ type: 'command', command: 'my-custom-init.sh' }] }],
                },
                permissions: { allow: ['Bash(ls)'] },
            }),
        );
        ensure_managed_hooks(settings, MATRIX);
        const res = remove_managed_hooks(settings);
        expect(res.changed).toBe(true);
        expect(res.events.sort()).toEqual(['SessionStart', 'Stop']);
        const data = read(settings);
        expect(data['permissions']).toEqual({ allow: ['Bash(ls)'] });
        const hooks = data['hooks'] as Record<string, unknown[]>;
        expect(Object.keys(hooks)).toEqual(['SessionStart']);
        const groups = hooks['SessionStart'] as Array<{ hooks: { command: string }[] }>;
        expect(groups).toHaveLength(1);
        expect(groups[0].hooks[0].command).toBe('my-custom-init.sh');
    });

    it('removal drops the hooks key entirely when only managed entries existed', () => {
        ensure_managed_hooks(settings, MATRIX);
        remove_managed_hooks(settings);
        expect('hooks' in read(settings)).toBe(false);
    });

    it('removal on a missing file is a no-op', () => {
        const res = remove_managed_hooks(join(root, 'nope.json'));
        expect(res.changed).toBe(false);
    });

    it('refuses to touch a corrupted settings file (byte-identical after)', () => {
        writeFileSync(settings, '{ this is not json');
        expect(() => ensure_managed_hooks(settings, MATRIX)).toThrow(CorruptSettingsError);
        expect(readFileSync(settings, 'utf8')).toBe('{ this is not json');
    });

    it('build_claude_hook_matrix derives the same commands as the plugin generator', () => {
        const manifest = join(root, 'hook_manifest.yaml');
        writeFileSync(
            manifest,
            [
                'schema_version: 1',
                'platforms:',
                '  claude:',
                '    session_start: [chat-history]',
                '    stop: [chat-history]',
                '    empty_event: []',
                'native_event_aliases:',
                '  claude:',
                '    SessionStart: session_start',
                '    Stop: stop',
                '',
            ].join('\n'),
        );
        const matrix = build_claude_hook_matrix(manifest);
        expect(Object.keys(matrix).sort()).toEqual(['SessionStart', 'Stop']);
        expect(matrix['SessionStart']).toBe(MATRIX.SessionStart);
        expect(matrix['Stop']).toBe(MATRIX.Stop);
    });
});

// road-to-hook-latency-repair Phase 2: the generated command must (a) exec
// the dispatcher bundle directly when a project install carries it, (b) fall
// back to the CLI when the bundle is absent, and (c) NEVER execute an
// unrelated consumer file that happens to sit at dist/hooks/dispatch.js
// (the hook_manifest.yaml guard — council 2026-08-03). These run the real
// generated bash line against staged workspaces.
describe('generated hook command — package-owned dispatchers only', () => {
    let ws: string;
    let project: string;
    let globalBin: string;

    beforeEach(() => {
        ws = mkdtempSync(join(tmpdir(), 'hookcmd-'));
        project = join(ws, 'project');
        globalBin = join(ws, 'global-bin');
        mkdirSync(project, { recursive: true });
        mkdirSync(globalBin, { recursive: true });
    });
    afterEach(() => {
        rmSync(ws, { recursive: true, force: true });
    });

    function runCommand(): void {
        const res = spawnSync('bash', ['-c', MATRIX.SessionStart], {
            input: '{}',
            encoding: 'utf-8',
            // A controlled machine: no staged runtime, and PATH holds only the
            // fixture CLI and the system dirs, so the real install never answers.
            env: { PATH: `${globalBin}:/usr/bin:/bin`, HOME: ws, EVENT4U_CONFIG_HOME: join(ws, 'machine'), CLAUDE_PROJECT_DIR: project },
            timeout: 30000,
        });
        expect(res.error).toBeUndefined();
    }

    function stageCliStub(dir: string, name: string): string {
        const log = join(ws, `${name}.log`);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'agent-config'), `#!/usr/bin/env bash\necho "$@" > "${log}"\n`, { mode: 0o755 });
        return log;
    }

    function stageBundleStub(dir: string): string {
        const log = join(ws, 'bundle-invoked.log');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, 'dispatch.js'),
            `require('fs').writeFileSync(${JSON.stringify(log)}, process.argv.slice(2).join(' '));\n`,
        );
        return log;
    }

    it('no staged runtime → the CLI on PATH fires with the dispatch:hook contract', () => {
        const cliLog = stageCliStub(globalBin, 'global-cli');
        runCommand();
        expect(existsSync(cliLog)).toBe(true);
        const argv = readFileSync(cliLog, 'utf8');
        expect(argv).toContain('dispatch:hook');
        expect(argv).toContain('--platform claude');
        expect(argv).toContain('--event session_start');
    });

    it('a project npm install, a source-checkout dist/ and a local wrapper never run (17.0.0 finding feaebdef733b)', () => {
        const cliLog = stageCliStub(globalBin, 'global-cli');
        const nmLog = stageBundleStub(join(project, 'node_modules', '@event4u', 'agent-config', 'dist', 'hooks'));
        stageBundleStub(join(project, 'dist', 'hooks'));
        mkdirSync(join(project, 'src', 'scripts'), { recursive: true });
        writeFileSync(join(project, 'src', 'scripts', 'hook_manifest.yaml'), 'schema_version: 1\n');
        const wrapperLog = stageCliStub(project, 'local-wrapper');
        runCommand();
        expect(existsSync(nmLog)).toBe(false);
        expect(existsSync(wrapperLog)).toBe(false);
        expect(existsSync(cliLog)).toBe(true);
    });
});

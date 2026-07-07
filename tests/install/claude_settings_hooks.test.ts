import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CorruptSettingsError,
    MANAGED_SIGNATURE,
    build_claude_hook_matrix,
    ensure_managed_hooks,
    remove_managed_hooks,
} from '../../src/scripts/_lib/claude_settings_hooks.js';

const MATRIX = {
    SessionStart:
        'BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; ' +
        '"$BIN" dispatch:hook --platform claude --event session_start ' +
        '--native-event SessionStart --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1',
    Stop:
        'BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; ' +
        '"$BIN" dispatch:hook --platform claude --event stop ' +
        '--native-event Stop --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1',
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

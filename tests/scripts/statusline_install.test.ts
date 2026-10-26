import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claudeSettingsPath, installTap, TAP_COMMAND, uninstallTap } from '../../src/scripts/_cli/cmd_statusline.js';

let home: string;
let env: Record<string, string>;

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-install-'));
    env = { EVENT4U_CONFIG_HOME: path.join(home, 'ac'), CLAUDE_CONFIG_DIR: path.join(home, '.claude') };
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

function writeSettings(o: unknown): void {
    fs.mkdirSync(path.dirname(claudeSettingsPath(env)), { recursive: true });
    fs.writeFileSync(claudeSettingsPath(env), JSON.stringify(o));
}
const readSettings = (): Record<string, unknown> => JSON.parse(fs.readFileSync(claudeSettingsPath(env), 'utf-8'));

describe('statusline install / uninstall', () => {
    it('wraps an existing status line and restores the same value', () => {
        const original = { type: 'command', command: 'ccline --theme x', padding: 1 };
        writeSettings({ model: 'opus', statusLine: original });
        expect(installTap(env).code).toBe(0);
        expect(readSettings()['statusLine']).toEqual({ type: 'command', command: TAP_COMMAND });
        expect(readSettings()['model']).toBe('opus');
        expect(uninstallTap(env).code).toBe(0);
        expect(readSettings()).toEqual({ model: 'opus', statusLine: original });
    });

    it('installs alone when there was no status line, and uninstall removes the key again', () => {
        writeSettings({ model: 'opus' });
        installTap(env);
        expect(readSettings()['statusLine']).toEqual({ type: 'command', command: TAP_COMMAND });
        uninstallTap(env);
        expect(readSettings()).toEqual({ model: 'opus' });
    });

    it('creates settings.json when none exists', () => {
        expect(installTap(env).code).toBe(0);
        expect(readSettings()['statusLine']).toEqual({ type: 'command', command: TAP_COMMAND });
    });

    it('a second install keeps the first recorded original', () => {
        const original = { type: 'command', command: 'mine' };
        writeSettings({ statusLine: original });
        installTap(env);
        expect(installTap(env).message).toMatch(/already installed/);
        uninstallTap(env);
        expect(readSettings()['statusLine']).toEqual(original);
    });

    it('uninstall leaves a status line it did not write alone', () => {
        writeSettings({ statusLine: { type: 'command', command: 'mine' } });
        expect(uninstallTap(env).message).toMatch(/not installed/);
        expect(readSettings()['statusLine']).toEqual({ type: 'command', command: 'mine' });
    });

    it('refuses a settings file that is not a JSON object, changing nothing', () => {
        fs.mkdirSync(path.dirname(claudeSettingsPath(env)), { recursive: true });
        fs.writeFileSync(claudeSettingsPath(env), '{ broken');
        expect(installTap(env).code).toBe(1);
        expect(fs.readFileSync(claudeSettingsPath(env), 'utf-8')).toBe('{ broken');
    });
});

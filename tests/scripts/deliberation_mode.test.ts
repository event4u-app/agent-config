// deliberation.mode resolution: session override > user-global setting > default,
// and the session id is refused before it can become a path segment.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    clearSessionOverride,
    readGlobalMode,
    resolveDeliberationMode,
    sessionOverridePath,
    validSessionId,
    writeSessionOverride,
} from '../../src/scripts/_lib/deliberation_mode.js';

const SID = '0b6f1c2e-1111-4a2b-9c3d-123456789abc';
let root: string;
let env: Record<string, string>;
let settings: string;

beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'deliberation-'));
    env = { EVENT4U_CONFIG_HOME: root };
    settings = path.join(root, 'settings', '.agent-settings.yml');
    mkdirSync(path.dirname(settings), { recursive: true });
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('readGlobalMode', () => {
    it('falls back to off, the default, when no layer sets it', () => {
        expect(readGlobalMode([settings])).toEqual({ mode: 'off', source: 'default', file: null });
    });

    it('reads the mode and names the layer that set it; a later layer wins', () => {
        const flat = path.join(root, 'agent-settings.yml');
        writeFileSync(flat, 'deliberation:\n  mode: auto\n');
        writeFileSync(settings, 'deliberation:\n  mode: offer\n');
        expect(readGlobalMode([flat, settings])).toEqual({ mode: 'offer', source: 'global', file: settings });
        expect(readGlobalMode([settings, flat])).toEqual({ mode: 'auto', source: 'global', file: flat });
    });

    it('reads a bare YAML 1.1 `off` (a boolean) as off', () => {
        writeFileSync(settings, 'deliberation:\n  mode: off\n');
        expect(readGlobalMode([settings]).mode).toBe('off');
    });

    it('ignores an unknown value and flags an unparseable layer without guessing', () => {
        writeFileSync(settings, 'deliberation:\n  mode: always\n');
        expect(readGlobalMode([settings]).source).toBe('default');
        writeFileSync(settings, 'deliberation: [unclosed\n');
        expect(readGlobalMode([settings])).toEqual({ mode: 'off', source: 'default', file: null, unreadable: true });
    });
});

describe('session ids', () => {
    it.each([SID, 'abcdef12', 'session_01-x'])('accepts %s', (id) => expect(validSessionId(id)).toBe(id));

    it.each(['../../etc', '..', 'a/b/c/d/e', 'abc', '', 'x'.repeat(129), '-leading-dash', 'with.dot.inside', 'a\\b\\c\\d\\e'])(
        'refuses %j',
        (id) => {
            expect(validSessionId(id)).toBeNull();
            expect(() => sessionOverridePath(id, env)).toThrow(/not a session id/);
        },
    );

    it('keeps every override inside state/deliberation under the user-global root', () => {
        expect(sessionOverridePath(SID, env)).toBe(path.join(root, 'state', 'deliberation', `${SID}.json`));
    });
});

describe('resolveDeliberationMode', () => {
    it('session override > global > default', () => {
        expect(resolveDeliberationMode({ sessionId: SID, settingsPaths: [settings], env }).source).toBe('default');
        writeFileSync(settings, 'deliberation:\n  mode: auto\n');
        expect(resolveDeliberationMode({ sessionId: SID, settingsPaths: [settings], env })).toMatchObject({ mode: 'auto', source: 'global', file: settings });
        const file = writeSessionOverride(SID, 'off', new Date('2026-11-26T08:00:00Z'), env);
        const e = resolveDeliberationMode({ sessionId: SID, settingsPaths: [settings], env });
        expect(e).toMatchObject({ mode: 'off', source: 'session', file, sessionId: SID });
        expect(e.global.mode).toBe('auto');
        // Another session is not affected.
        expect(resolveDeliberationMode({ sessionId: 'other-session-1', settingsPaths: [settings], env }).mode).toBe('auto');
    });

    it('writes the override atomically at 0600 and inherit removes it', () => {
        const file = writeSessionOverride(SID, 'auto', new Date('2026-11-26T08:00:00Z'), env);
        expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ v: 1, session: SID, mode: 'auto', at: '2026-11-26T08:00:00.000Z' });
        if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600);
        expect(clearSessionOverride(SID, env)).toBe(true);
        expect(existsSync(file)).toBe(false);
        expect(clearSessionOverride(SID, env)).toBe(false);
    });

    it('ignores a session file it did not write', () => {
        const file = sessionOverridePath(SID, env);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, '{"mode":"auto"}');
        expect(resolveDeliberationMode({ sessionId: SID, settingsPaths: [settings], env }).source).toBe('default');
    });

    it('never reads an override for an invalid id', () => {
        expect(resolveDeliberationMode({ sessionId: '../../x', settingsPaths: [settings], env })).toMatchObject({ source: 'default', sessionId: null });
    });
});

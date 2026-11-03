import { createHash } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    CLAUDE_KEYCHAIN_SERVICE,
    claudeHomeInfo,
    claudeKeychainService,
    codexHomeInfo,
    geminiCliHomeOverride,
    geminiHomeInfo,
} from '../../../src/scripts/_lib/provider_home.js';

const HOME = path.join(os.tmpdir(), 'ph-home');

describe('provider homes', () => {
    it.each([
        ['claude', claudeHomeInfo, 'CLAUDE_CONFIG_DIR', '.claude'],
        ['codex', codexHomeInfo, 'CODEX_HOME', '.codex'],
    ] as const)('%s: env wins, empty and whitespace fall back to the default', (_n, fn, varName, dir) => {
        const profile = path.join(HOME, '.agent-switch', 'x', 'p1', 'config');
        expect(fn({ HOME, [varName]: profile })).toEqual({ path: profile, source: 'env' });
        expect(fn({ HOME, [varName]: '' })).toEqual({ path: path.join(HOME, dir), source: 'default' });
        expect(fn({ HOME, [varName]: '   ' })).toEqual({ path: path.join(HOME, dir), source: 'default' });
        expect(fn({ HOME })).toEqual({ path: path.join(HOME, dir), source: 'default' });
    });

    it('expands a leading ~ against the injected home', () => {
        expect(claudeHomeInfo({ HOME, CLAUDE_CONFIG_DIR: '~/profiles/a' }).path).toBe(path.join(HOME, 'profiles', 'a'));
        expect(codexHomeInfo({ HOME, CODEX_HOME: '~' }).path).toBe(HOME);
    });

    it('gemini ignores GEMINI_CLI_HOME until its semantics are measured, but reports it', () => {
        const env = { HOME, GEMINI_CLI_HOME: '/elsewhere' };
        expect(geminiHomeInfo(env)).toEqual({ path: path.join(HOME, '.gemini'), source: 'default' });
        expect(geminiCliHomeOverride(env)).toBe('/elsewhere');
        expect(geminiCliHomeOverride({ HOME })).toBeNull();
    });
});

describe('claudeKeychainService', () => {
    it('is unsuffixed with no config-dir override', () => {
        expect(claudeKeychainService({ HOME })).toBe(CLAUDE_KEYCHAIN_SERVICE);
        expect(claudeKeychainService({ HOME, CLAUDE_CONFIG_DIR: '  ' })).toBe(CLAUDE_KEYCHAIN_SERVICE);
    });

    it('suffixes with sha256 over the NFC-normalised raw value, 8 hex', () => {
        const dir = '/Users/a/.agent-switch/claude/café/config'; // decomposed é
        const expected = createHash('sha256').update(dir.normalize('NFC'), 'utf8').digest('hex').slice(0, 8);
        const service = claudeKeychainService({ CLAUDE_CONFIG_DIR: dir });
        expect(service).toBe(`${CLAUDE_KEYCHAIN_SERVICE}-${expected}`);
        expect(service).toMatch(/^Claude Code-credentials-[0-9a-f]{8}$/);
        // Two profiles never share a service.
        expect(claudeKeychainService({ CLAUDE_CONFIG_DIR: '/p/one' })).not.toBe(claudeKeychainService({ CLAUDE_CONFIG_DIR: '/p/two' }));
    });
});

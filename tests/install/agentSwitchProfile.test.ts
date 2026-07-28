/**
 * Unit tests for `detectAgentSwitchProfile` / `resolveAgentSwitchRoot`
 * (road-to-reciprocal-ecosystem.md Phase 2).
 *
 * See src/install/agentSwitchProfile.ts for the module under test.
 */
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectAgentSwitchProfile, resolveAgentSwitchRoot } from '../../src/install/agentSwitchProfile.js';

describe('detectAgentSwitchProfile', () => {
    it('is inactive when neither provider env var is set', () => {
        expect(detectAgentSwitchProfile({})).toEqual({ active: false, provider: null, profile: null });
    });

    it('is inactive when the provider env vars point somewhere unrelated', () => {
        const env = { CLAUDE_CONFIG_DIR: join(sep, 'Users', 'matze', '.claude') };
        expect(detectAgentSwitchProfile(env)).toEqual({ active: false, provider: null, profile: null });
    });

    it('detects an active claude profile from CLAUDE_CONFIG_DIR under the default ~/.agent-switch root', () => {
        const home = process.platform === 'win32' ? 'C:\\Users\\matze' : '/Users/matze';
        const env = { CLAUDE_CONFIG_DIR: join(home, '.agent-switch', 'claude', 'work', 'config') };
        expect(detectAgentSwitchProfile(env)).toEqual({ active: true, provider: 'claude', profile: 'work' });
    });

    it('detects an active codex profile from CODEX_HOME', () => {
        const home = process.platform === 'win32' ? 'C:\\Users\\matze' : '/Users/matze';
        const env = { CODEX_HOME: join(home, '.agent-switch', 'codex', 'personal', 'config') };
        expect(detectAgentSwitchProfile(env)).toEqual({ active: true, provider: 'codex', profile: 'personal' });
    });

    it('claude wins over codex when both env vars resolve inside the AS tree', () => {
        const home = process.platform === 'win32' ? 'C:\\Users\\matze' : '/Users/matze';
        const env = {
            CLAUDE_CONFIG_DIR: join(home, '.agent-switch', 'claude', 'work', 'config'),
            CODEX_HOME: join(home, '.agent-switch', 'codex', 'personal', 'config'),
        };
        expect(detectAgentSwitchProfile(env)).toEqual({ active: true, provider: 'claude', profile: 'work' });
    });

    it('respects a custom AGENT_SWITCH_HOME root', () => {
        const root = join(sep, 'custom', 'as-root');
        const env = {
            AGENT_SWITCH_HOME: root,
            CLAUDE_CONFIG_DIR: join(root, 'claude', 'work', 'config'),
        };
        expect(detectAgentSwitchProfile(env)).toEqual({ active: true, provider: 'claude', profile: 'work' });
    });

    it('is inactive when the env var points outside a custom AGENT_SWITCH_HOME root', () => {
        const env = {
            AGENT_SWITCH_HOME: join(sep, 'custom', 'as-root'),
            CLAUDE_CONFIG_DIR: join(sep, 'somewhere', 'else', 'config'),
        };
        expect(detectAgentSwitchProfile(env)).toEqual({ active: false, provider: null, profile: null });
    });

    it('is inactive when the env var points AT the AS root itself (no profile segments)', () => {
        const root = join(sep, 'custom', 'as-root');
        const env = { AGENT_SWITCH_HOME: root, CLAUDE_CONFIG_DIR: root };
        expect(detectAgentSwitchProfile(env)).toEqual({ active: false, provider: null, profile: null });
    });

    it('is active but unparseable when only a provider segment is present (no profile name)', () => {
        const root = join(sep, 'custom', 'as-root');
        const env = { AGENT_SWITCH_HOME: root, CLAUDE_CONFIG_DIR: join(root, 'claude') };
        expect(detectAgentSwitchProfile(env)).toEqual({ active: true, provider: null, profile: null });
    });

    it('never checks HOME as a provider signal (too generic)', () => {
        const env = { HOME: join(sep, 'Users', 'matze', '.agent-switch', 'antigravity', 'work', 'config') };
        expect(detectAgentSwitchProfile(env)).toEqual({ active: false, provider: null, profile: null });
    });
});

describe('resolveAgentSwitchRoot', () => {
    it('returns null when inactive', () => {
        expect(resolveAgentSwitchRoot({})).toBeNull();
    });

    it('returns the resolved root for a custom AGENT_SWITCH_HOME', () => {
        const root = join(sep, 'custom', 'as-root');
        const env = { AGENT_SWITCH_HOME: root, CLAUDE_CONFIG_DIR: join(root, 'claude', 'work', 'config') };
        expect(resolveAgentSwitchRoot(env)).toBe(root);
    });

    it('returns the reconstructed default root when no override is set', () => {
        const home = process.platform === 'win32' ? 'C:\\Users\\matze' : '/Users/matze';
        const env = { CLAUDE_CONFIG_DIR: join(home, '.agent-switch', 'claude', 'work', 'config') };
        expect(resolveAgentSwitchRoot(env)).toBe(join(home, '.agent-switch'));
    });
});

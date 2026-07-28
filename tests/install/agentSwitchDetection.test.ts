/**
 * Tests for agent-switch detection (road-to-reciprocal-ecosystem § Phase 1
 * — S0.1 honest-null council verdict, 2026-07-28: a PASSIVE ROW ONLY, never
 * a proactive card). Two independent installed-signals — a binary on PATH,
 * or the `~/.agent-switch/` directory — and no network / version-currency
 * check at all.
 *
 * See src/install/agentSwitchDetection.ts for the module under test.
 */
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    AGENT_SWITCH_INSTALL_COMMAND,
    AGENT_SWITCH_NPM,
    AGENT_SWITCH_REPO,
    detectAgentSwitch,
    parseVersionOutput,
} from '../../src/install/agentSwitchDetection.js';

/** Write an executable stub file (POSIX mode bits) and return its path. */
function writeExecutable(dir: string, name: string, contents: string): string {
    const filePath = join(dir, name);
    writeFileSync(filePath, contents, 'utf-8');
    chmodSync(filePath, 0o755);
    return filePath;
}

describe('parseVersionOutput', () => {
    it('parses "agent-switch 1.6.1" to "1.6.1"', () => {
        expect(parseVersionOutput('agent-switch 1.6.1')).toBe('1.6.1');
    });

    it('parses "v1.6.1" to "1.6.1"', () => {
        expect(parseVersionOutput('v1.6.1')).toBe('1.6.1');
    });

    it('returns null for output with no dotted-number token', () => {
        expect(parseVersionOutput('command not found')).toBeNull();
    });

    it('returns null for empty output', () => {
        expect(parseVersionOutput('')).toBeNull();
    });
});

describe('detectAgentSwitch', () => {
    let home: string;
    let binDir: string;

    beforeEach(() => {
        home = mkdtempSync(join(tmpdir(), 'as-detect-home-'));
        binDir = mkdtempSync(join(tmpdir(), 'as-detect-bin-'));
    });
    afterEach(() => {
        rmSync(home, { recursive: true, force: true });
        rmSync(binDir, { recursive: true, force: true });
    });

    it('reports not installed when neither the binary nor ~/.agent-switch/ is present', () => {
        expect(detectAgentSwitch({ home, pathEnv: binDir })).toEqual({ installed: false, version: null });
    });

    it('reports installed with version null when only ~/.agent-switch/ exists (no binary on PATH)', () => {
        mkdirSync(join(home, '.agent-switch'));
        expect(detectAgentSwitch({ home, pathEnv: binDir })).toEqual({ installed: true, version: null });
    });

    it('reports installed when the binary is on PATH, probing version via the injected probe', () => {
        writeExecutable(binDir, 'agent-switch', '#!/bin/sh\nexit 0\n');
        const probeVersion = (): string => '1.6.1';
        const result = detectAgentSwitch({ home, pathEnv: binDir, probeVersion });
        expect(result).toEqual({ installed: true, version: '1.6.1' });
    });

    it('binary-on-PATH takes precedence even when ~/.agent-switch/ also exists', () => {
        writeExecutable(binDir, 'agent-switch', '#!/bin/sh\nexit 0\n');
        mkdirSync(join(home, '.agent-switch'));
        const probeVersion = (): string => '2.0.0';
        const result = detectAgentSwitch({ home, pathEnv: binDir, probeVersion });
        expect(result).toEqual({ installed: true, version: '2.0.0' });
    });

    it('parses the real spawned --version output ("agent-switch 1.6.1" shape) with no probeVersion override', () => {
        writeExecutable(binDir, 'agent-switch', '#!/bin/sh\necho "agent-switch 1.6.1"\nexit 0\n');
        const result = detectAgentSwitch({ home, pathEnv: binDir });
        expect(result).toEqual({ installed: true, version: '1.6.1' });
    });

    it('parses a "v1.6.1"-shaped real spawned --version output with no probeVersion override', () => {
        writeExecutable(binDir, 'agent-switch', '#!/bin/sh\necho "v1.6.1"\nexit 0\n');
        const result = detectAgentSwitch({ home, pathEnv: binDir });
        expect(result).toEqual({ installed: true, version: '1.6.1' });
    });

    it('reports version null for garbage --version output with no probeVersion override', () => {
        writeExecutable(binDir, 'agent-switch', '#!/bin/sh\necho "command not found"\nexit 1\n');
        const result = detectAgentSwitch({ home, pathEnv: binDir });
        expect(result).toEqual({ installed: true, version: null });
    });

    it('reports version null when the injected probeVersion throws', () => {
        writeExecutable(binDir, 'agent-switch', '#!/bin/sh\nexit 0\n');
        const probeVersion = (): string => { throw new Error('boom'); };
        const result = detectAgentSwitch({ home, pathEnv: binDir, probeVersion });
        expect(result).toEqual({ installed: true, version: null });
    });

    it('reports version null when the injected probeVersion itself returns null (e.g. timeout)', () => {
        writeExecutable(binDir, 'agent-switch', '#!/bin/sh\nexit 0\n');
        const probeVersion = (): null => null;
        const result = detectAgentSwitch({ home, pathEnv: binDir, probeVersion });
        expect(result).toEqual({ installed: true, version: null });
    });
});

describe('agent-switch constants', () => {
    it('install command is npm-global and identical across every OS (no per-OS map, unlike rtk)', () => {
        expect(AGENT_SWITCH_INSTALL_COMMAND).toBe('npm install -g @event4u/agent-switch');
    });

    it('carries the npm package name and the repo slug used to build the GitHub URL', () => {
        expect(AGENT_SWITCH_NPM).toBe('@event4u/agent-switch');
        expect(AGENT_SWITCH_REPO).toBe('event4u-app/agent-switch');
    });
});

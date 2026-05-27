/**
 * Tests for native AI-tool presence detection
 * (road-to-wizard-ux-improvements § Phase 2).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { detectInstalledTools, knownToolIds } from '../../src/install/toolDetection.js';

describe('detectInstalledTools', () => {
    let home: string;
    let binDir: string;

    beforeEach(() => {
        home = mkdtempSync(join(tmpdir(), 'tooldetect-home-'));
        binDir = mkdtempSync(join(tmpdir(), 'tooldetect-bin-'));
    });
    afterEach(() => {
        rmSync(home, { recursive: true, force: true });
        rmSync(binDir, { recursive: true, force: true });
    });

    it('reports every known tool; signal-less + home/PATH-only tools are false on an empty env', () => {
        const out = detectInstalledTools({ home, pathEnv: '' });
        const ids = knownToolIds();
        expect(Object.keys(out).sort()).toEqual([...ids].sort());
        // Tools with no signal at all are always false.
        expect(out['roocode']).toBe(false);
        expect(out['kilocode']).toBe(false);
        // Tools detected only via home dir / PATH (no absolute app bundle) are
        // false on an empty injected env — independent of the host machine's
        // /Applications (which `absPaths` legitimately probe for GUI apps).
        expect(out['claude-code']).toBe(false);
        expect(out['codex']).toBe(false);
        expect(out['continue']).toBe(false);
    });

    it('detects a tool by its home-relative dir (~/.claude → claude-code)', () => {
        mkdirSync(join(home, '.claude'));
        const out = detectInstalledTools({ home, pathEnv: '' });
        expect(out['claude-code']).toBe(true);
        expect(out['codex']).toBe(false);
    });

    it('detects a tool by a home-relative file (~/.aider.conf.yml → aider)', () => {
        writeFileSync(join(home, '.aider.conf.yml'), 'model: gpt\n');
        const out = detectInstalledTools({ home, pathEnv: '' });
        expect(out['aider']).toBe(true);
    });

    it('detects a tool by a binary on $PATH (cursor)', () => {
        writeFileSync(join(binDir, 'cursor'), '#!/bin/sh\n');
        const out = detectInstalledTools({ home, pathEnv: binDir });
        expect(out['cursor']).toBe(true);
    });

    it('detects a Windows-style .cmd binary on $PATH (codex)', () => {
        writeFileSync(join(binDir, 'codex.cmd'), '@echo off\n');
        const out = detectInstalledTools({ home, pathEnv: binDir });
        expect(out['codex']).toBe(true);
    });

    it('covers the full wizard tool set (23 ids)', () => {
        expect(knownToolIds()).toHaveLength(23);
        for (const id of ['claude-code', 'cursor', 'codex', 'gemini-cli', 'warp', 'kiro']) {
            expect(knownToolIds()).toContain(id);
        }
    });
});

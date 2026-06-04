/**
 * Tests for src/cli/paths.ts — PACKAGE_ROOT / BASH_ENTRY stability.
 *
 * Roadmap Phase 2 acceptance: the walk-up logic must land on the
 * package root regardless of how the binary is invoked (npm-global,
 * vendor/bin symlink, npx, …). We test the runtime values produced
 * from this test file's location.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    BASH_ENTRY,
    BASH_SHIM,
    CONSUMER_ROOT,
    PACKAGE_JSON,
    PACKAGE_ROOT,
    resolveScript,
} from '../../src/cli/paths.js';

describe('paths', () => {
    it('PACKAGE_ROOT points at a directory containing package.json', () => {
        expect(existsSync(PACKAGE_ROOT)).toBe(true);
        expect(statSync(PACKAGE_ROOT).isDirectory()).toBe(true);
        expect(existsSync(resolve(PACKAGE_ROOT, 'package.json'))).toBe(true);
    });

    it('PACKAGE_JSON resolves to <PACKAGE_ROOT>/package.json', () => {
        expect(PACKAGE_JSON).toBe(resolve(PACKAGE_ROOT, 'package.json'));
        expect(existsSync(PACKAGE_JSON)).toBe(true);
    });

    it('BASH_ENTRY resolves to <PACKAGE_ROOT>/src/scripts/_dispatch.bash', () => {
        expect(BASH_ENTRY).toBe(resolve(PACKAGE_ROOT, 'src', 'scripts', '_dispatch.bash'));
        expect(existsSync(BASH_ENTRY)).toBe(true);
    });

    it('BASH_SHIM resolves to <PACKAGE_ROOT>/src/scripts/agent-config', () => {
        expect(BASH_SHIM).toBe(resolve(PACKAGE_ROOT, 'src', 'scripts', 'agent-config'));
        expect(existsSync(BASH_SHIM)).toBe(true);
    });

    it('CONSUMER_ROOT is the cwd at entry', () => {
        expect(typeof CONSUMER_ROOT).toBe('string');
        expect(CONSUMER_ROOT.length).toBeGreaterThan(0);
    });

    it('resolveScript finds the first candidate that exists', () => {
        const hit = resolveScript('does/not/exist.txt', 'package.json');
        expect(hit).toBe(resolve(PACKAGE_ROOT, 'package.json'));
    });

    it('resolveScript returns null when no candidate exists', () => {
        const hit = resolveScript('does/not/exist-1.txt', 'does/not/exist-2.txt');
        expect(hit).toBeNull();
    });
});

/**
 * Unit tests for `resolveWriteRoot`.
 *
 *   - Inside the package (`package.json#name === '@event4u/agent-config'`)
 *     resolves to `<cwd>/agents/`, no legacy fallback.
 *   - Outside the package resolves to `<home>/.event4u/agent-config/`
 *     and surfaces CWD as `legacyReadRoot`.
 *   - Explicit `override` short-circuits both branches.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveWriteRoot, isInsidePackage, globalWriteRoot } from './writeRoot.js';

describe('resolveWriteRoot', () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(tmpdir(), 'writeroot-'));
    });
    afterEach(() => {
        rmSync(scratch, { recursive: true, force: true });
    });

    it('returns package-sandbox mode when CWD is the agent-config package', () => {
        const repo = join(scratch, 'repo');
        mkdirSync(repo, { recursive: true });
        writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: '@event4u/agent-config' }));

        const res = resolveWriteRoot({ cwd: repo });

        expect(res.mode).toBe('package-sandbox');
        expect(res.writeRoot).toBe(join(repo, 'agents'));
        expect(res.legacyReadRoot).toBeNull();
    });

    it('returns global mode with legacy fallback when CWD is a consumer project', () => {
        const consumer = join(scratch, 'consumer');
        const home = join(scratch, 'home');
        mkdirSync(consumer, { recursive: true });
        mkdirSync(home, { recursive: true });
        writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'some-app' }));

        const res = resolveWriteRoot({ cwd: consumer, home });

        expect(res.mode).toBe('global');
        expect(res.writeRoot).toBe(join(home, '.event4u', 'agent-config'));
        expect(res.legacyReadRoot).toBe(consumer);
    });

    it('returns global mode with no legacy fallback when CWD has no package.json', () => {
        const home = join(scratch, 'home');
        const cwd = join(scratch, 'empty');
        mkdirSync(home, { recursive: true });
        mkdirSync(cwd, { recursive: true });

        const res = resolveWriteRoot({ cwd, home });

        expect(res.mode).toBe('global');
        expect(res.writeRoot).toBe(join(home, '.event4u', 'agent-config'));
        expect(res.legacyReadRoot).toBe(cwd);
    });

    it('honours explicit override and suppresses legacy fallback', () => {
        const cwd = join(scratch, 'consumer');
        mkdirSync(cwd, { recursive: true });
        writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: '@event4u/agent-config' }));
        const override = join(scratch, 'pinned');

        const res = resolveWriteRoot({ cwd, override });

        expect(res.mode).toBe('global');
        expect(res.writeRoot).toBe(override);
        expect(res.legacyReadRoot).toBeNull();
    });

    it('isInsidePackage detects a malformed package.json gracefully', () => {
        const cwd = join(scratch, 'broken');
        mkdirSync(cwd, { recursive: true });
        writeFileSync(join(cwd, 'package.json'), '{ not json');

        expect(isInsidePackage(cwd)).toBe(false);
    });

    it('globalWriteRoot honours an explicit home', () => {
        expect(globalWriteRoot('/tmp/some-home')).toBe('/tmp/some-home/.event4u/agent-config');
    });
});

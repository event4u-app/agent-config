/**
 * Unit tests for `resolveWriteRoot`.
 *
 *   - Inside the package (`package.json#name === '@event4u/agent-config'`)
 *     resolves to `<cwd>/agents/` and surfaces CWD as `legacyReadRoot`
 *     so the wizard pre-populates from the maintainer's in-repo
 *     `.agent-settings.yml` and auto-migrates on finish.
 *   - Outside the package resolves to `<home>/.event4u/agent-config/`
 *     and surfaces CWD as `legacyReadRoot`.
 *   - Explicit `override` short-circuits both branches and suppresses
 *     `legacyReadRoot`.
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

    it('returns package-sandbox mode and surfaces repo root as legacy fallback', () => {
        const repo = join(scratch, 'repo');
        mkdirSync(repo, { recursive: true });
        writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: '@event4u/agent-config' }));

        const res = resolveWriteRoot({ cwd: repo });

        expect(res.mode).toBe('package-sandbox');
        expect(res.writeRoot).toBe(join(repo, 'agents'));
        // Maintainer's in-repo `.agent-settings.yml` must be readable
        // as legacy fallback so the wizard pre-populates from it.
        expect(res.legacyReadRoot).toBe(repo);
        // No project-scope opt-in inside the package — the writeRoot is
        // already in-repo so a project-scope toggle would be a no-op.
        expect(res.projectScopeRoot).toBeNull();
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
        // Consumer projects expose project-scope as an opt-in toggle so
        // the wizard can route writes back into the repo when the user
        // ticks the checkbox in Review.
        expect(res.projectScopeRoot).toBe(consumer);
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
        // Even without a package.json the CWD is exposed as a candidate
        // project-scope target — the wizard's checkbox copy clarifies
        // what "project" means; the resolver only carries the path.
        expect(res.projectScopeRoot).toBe(cwd);
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
        // Explicit override pins the root — no project-scope opt-in.
        expect(res.projectScopeRoot).toBeNull();
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

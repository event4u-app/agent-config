/**
 * Tests for the shared-write collision gate (road-to-reciprocal-
 * ecosystem.md Phase 2):
 *
 *   - unit tests for `sharedWriteTarget` / `resolveThroughSymlinks`
 *     (src/server/io/sharedWriteCheck.ts)
 *   - route-level tests for the 409 shared-write gate wired into
 *     `PUT /api/v1/settings` (src/server/routes/settings.ts)
 *
 * See src/server/io/sharedWriteCheck.ts for the module under test.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync, lstatSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sharedWriteTarget, resolveThroughSymlinks } from '../../src/server/io/sharedWriteCheck.js';
import { bootTestApp, authHeaders, fixtureSettings, settingsTemplate, type TestApp } from './helpers.js';

const INACTIVE_ENV = {};

/**
 * Active-AS env whose root is `root` itself (via `AGENT_SWITCH_HOME`).
 * Bounding the root at the test's own tmp dir keeps the upward `lstat`
 * walk from ever climbing above it — real machines have incidental
 * ancestor symlinks (macOS `/var` -> `/private/var`, `/tmp` ->
 * `/private/tmp`) that would otherwise false-positive a "no symlink on
 * the path" test the moment the walk is allowed to climb that far.
 */
function activeEnvRootedAt(root: string): NodeJS.ProcessEnv {
    return { AGENT_SWITCH_HOME: root, CLAUDE_CONFIG_DIR: join(root, 'claude', 'work', 'config') };
}

describe('sharedWriteTarget (unit)', () => {
    let dir: string;

    beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'shared-write-check-')); });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it('returns null when no AS profile is active, regardless of symlinks on disk', () => {
        const source = join(dir, 'source.yml');
        writeFileSync(source, 'a: 1\n');
        const link = join(dir, 'settings.yml');
        symlinkSync(source, link);
        expect(sharedWriteTarget(link, INACTIVE_ENV)).toBeNull();
    });

    it('returns the target itself when the target IS a symlink', () => {
        const source = join(dir, 'source.yml');
        writeFileSync(source, 'a: 1\n');
        const link = join(dir, 'settings.yml');
        symlinkSync(source, link);
        expect(sharedWriteTarget(link, activeEnvRootedAt(dir))).toBe(link);
    });

    it('returns the nearest symlinked ancestor when an ancestor dir is a symlink', () => {
        const realBase = join(dir, 'real-base');
        mkdirSync(join(realBase, 'nested'), { recursive: true });
        writeFileSync(join(realBase, 'nested', 'settings.yml'), 'a: 1\n');
        const linkedBase = join(dir, 'linked-base');
        symlinkSync(realBase, linkedBase);
        const target = join(linkedBase, 'nested', 'settings.yml');
        expect(sharedWriteTarget(target, activeEnvRootedAt(dir))).toBe(linkedBase);
    });

    it('returns null when active but no symlink sits on the path', () => {
        mkdirSync(join(dir, 'settings'), { recursive: true });
        const target = join(dir, 'settings', 'settings.yml');
        writeFileSync(target, 'a: 1\n');
        expect(sharedWriteTarget(target, activeEnvRootedAt(dir))).toBeNull();
    });

    it('returns null (never throws) when the target and its ancestors do not exist yet', () => {
        const target = join(dir, 'does', 'not', 'exist', 'settings.yml');
        expect(() => sharedWriteTarget(target, activeEnvRootedAt(dir))).not.toThrow();
        expect(sharedWriteTarget(target, activeEnvRootedAt(dir))).toBeNull();
    });
});

describe('resolveThroughSymlinks (unit)', () => {
    let dir: string;

    beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'shared-write-resolve-')); });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it('resolves a symlinked file to its real target', () => {
        const source = join(dir, 'source.yml');
        writeFileSync(source, 'a: 1\n');
        const link = join(dir, 'settings.yml');
        symlinkSync(source, link);
        expect(resolveThroughSymlinks(link)).toBe(realpathSync(source));
    });

    it('resolves through a symlinked ancestor dir even when the leaf does not exist yet', () => {
        const realBase = join(dir, 'real-base');
        mkdirSync(realBase, { recursive: true });
        const linkedBase = join(dir, 'linked-base');
        symlinkSync(realBase, linkedBase);
        const target = join(linkedBase, 'settings.yml'); // leaf does not exist
        expect(resolveThroughSymlinks(target)).toBe(join(realpathSync(realBase), 'settings.yml'));
    });

    it('resolves a fully nonexistent chain against the nearest existing ancestor, no throw', () => {
        const target = join(dir, 'a', 'b', 'c.yml');
        expect(() => resolveThroughSymlinks(target)).not.toThrow();
        expect(resolveThroughSymlinks(target)).toBe(join(realpathSync(dir), 'a', 'b', 'c.yml'));
    });

    it('is a no-op (modulo realpath normalization) when there are no symlinks', () => {
        const file = join(dir, 'plain.yml');
        writeFileSync(file, 'a: 1\n');
        expect(resolveThroughSymlinks(file)).toBe(realpathSync(file));
    });
});

describe('PUT /api/v1/settings — shared-write collision gate (route-level)', () => {
    const PORT = 41703;
    let ctx: TestApp;
    let sourceDir: string;
    let savedEnv: { AGENT_SWITCH_HOME: string | undefined; CLAUDE_CONFIG_DIR: string | undefined; CODEX_HOME: string | undefined };

    beforeEach(() => {
        savedEnv = {
            AGENT_SWITCH_HOME: process.env.AGENT_SWITCH_HOME,
            CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
            CODEX_HOME: process.env.CODEX_HOME,
        };
    });

    afterEach(async () => {
        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
        await ctx.cleanup();
        if (sourceDir !== undefined) rmSync(sourceDir, { recursive: true, force: true });
    });

    /**
     * Root the fake AS tree at `ctx.projectRoot` itself so the write
     * target (inside `ctx.projectRoot`) is actually inside the AS root
     * — `sharedWriteTarget` refuses to walk outside it (see the
     * module doc), so an unrelated env var pointing at some unrelated
     * `.agent-switch` tree would never trip the gate on a temp test
     * dir.
     */
    function activateAsProfileRootedAtProjectRoot(): void {
        process.env.AGENT_SWITCH_HOME = ctx.projectRoot;
        process.env.CLAUDE_CONFIG_DIR = join(ctx.projectRoot, 'claude', 'work', 'config');
    }

    async function currentMtime(): Promise<number> {
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/settings', headers: authHeaders(ctx.token, ctx.host),
        });
        return (res.json() as { lastModified: number }).lastModified;
    }

    /** Seed `ctx.projectRoot/settings/.agent-settings.yml` as a symlink to a real file elsewhere. */
    function seedSymlinkedSettings(): string {
        sourceDir = mkdtempSync(join(tmpdir(), 'shared-write-source-'));
        const source = join(sourceDir, '.agent-settings.yml');
        writeFileSync(source, settingsTemplate(), { mode: 0o600 });
        const linkPath = join(ctx.projectRoot, 'settings', '.agent-settings.yml');
        // bootTestApp always creates `settings/` (mode 0700); no file is
        // seeded here (seedSettings: false) so the symlink can take its place.
        symlinkSync(source, linkPath);
        return source;
    }

    it('blocks with 409 shared-write when an AS profile is active and the target is symlinked', async () => {
        ctx = await bootTestApp({ port: PORT, seedSettings: false });
        const source = seedSymlinkedSettings();
        activateAsProfileRootedAtProjectRoot();

        const ius = await currentMtime();
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json', 'if-unmodified-since': String(ius + 5) },
            payload: { values: fixtureSettings({ rule_loading_tier: 'minimal' }) },
        });
        expect(res.statusCode).toBe(409);
        const body = res.json() as { error: string; sharedPath: string; message: string };
        expect(body.error).toBe('shared-write');
        expect(body.sharedPath).toBe(join(ctx.projectRoot, 'settings', '.agent-settings.yml'));
        expect(body.message).toMatch(/agent-switch/);

        // No write happened — the source file is untouched.
        expect(readFileSync(source, 'utf8')).not.toMatch(/rule_loading_tier:\s*minimal\b/);
    });

    it('proceeds and writes through the symlink when confirmSharedWrite is true', async () => {
        ctx = await bootTestApp({ port: PORT, seedSettings: false });
        const source = seedSymlinkedSettings();
        activateAsProfileRootedAtProjectRoot();

        const ius = await currentMtime();
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json', 'if-unmodified-since': String(ius + 5) },
            payload: { values: fixtureSettings({ rule_loading_tier: 'minimal' }), confirmSharedWrite: true },
        });
        expect(res.statusCode).toBe(200);

        // The symlink itself survives — AC never breaks AS's symlink.
        const linkPath = join(ctx.projectRoot, 'settings', '.agent-settings.yml');
        expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
        expect(realpathSync(linkPath)).toBe(realpathSync(source));
        // The real source file — not the symlink slot — carries the new content.
        expect(readFileSync(source, 'utf8')).toMatch(/^rule_loading_tier:\s*minimal\b/m);
    });

    it('does not gate the write when no AS profile is active, even with a symlinked target', async () => {
        ctx = await bootTestApp({ port: PORT, seedSettings: false });
        seedSymlinkedSettings();
        delete process.env.AGENT_SWITCH_HOME;
        delete process.env.CLAUDE_CONFIG_DIR;
        delete process.env.CODEX_HOME;

        const ius = await currentMtime();
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json', 'if-unmodified-since': String(ius + 5) },
            payload: { values: fixtureSettings({ rule_loading_tier: 'minimal' }) },
        });
        expect(res.statusCode).toBe(200);
    });
});

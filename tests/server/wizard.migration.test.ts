/**
 * Wizard auto-migration acceptance.
 *
 *   POST /api/v1/wizard/finish (real run) must, after a successful 2PC
 *   commit, unlink `<legacyReadRoot>/.agent-settings.yml` and
 *   `<legacyReadRoot>/.agent-user.md` so the maintainer's old in-repo
 *   files do not shadow the new sandbox writes on next boot.
 *
 *   Dry-run must leave the legacy files alone.
 *   Missing legacy files must not produce an error (idempotent re-run).
 *   The list of removed paths is surfaced as `migratedFrom` in the
 *   response body.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';
import { authHeaders, fixtureSettings, fixtureUserMd, settingsTemplate } from './helpers.js';

interface MigrationCtx {
    app: FastifyInstance;
    writeRoot: string;
    legacyReadRoot: string;
    uiDir: string;
    token: string;
    host: string;
    cleanup: () => Promise<void>;
}

const PORT = 41606;

async function bootMigrationApp(opts: {
    dryRun?: boolean;
    seedLegacySettings?: boolean;
    seedLegacyUserMd?: string;
} = {}): Promise<MigrationCtx> {
    const legacyReadRoot = mkdtempSync(join(tmpdir(), 'agent-config-legacy-'));
    const writeRoot = mkdtempSync(join(tmpdir(), 'agent-config-sandbox-'));
    mkdirSync(join(writeRoot, 'state'), { recursive: true });

    if (opts.seedLegacySettings !== false) {
        writeFileSync(join(legacyReadRoot, '.agent-settings.yml'), settingsTemplate(), { mode: 0o600 });
    }
    if (opts.seedLegacyUserMd !== undefined) {
        writeFileSync(join(legacyReadRoot, '.agent-user.md'), opts.seedLegacyUserMd, { mode: 0o600 });
    }

    const uiDir = mkdtempSync(join(tmpdir(), 'agent-config-ui-'));
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');

    const token = 'x'.repeat(64);
    const app = await createApp({
        writeRoot,
        legacyReadRoot,
        mode: 'package-sandbox',
        uiDistDir: uiDir,
        token,
        expectedPort: PORT,
        logLevel: 'fatal',
        skipReplay: true,
        dryRun: opts.dryRun === true,
        packageRoot: resolve(process.cwd()),
    });
    await app.ready();

    const cleanup = async (): Promise<void> => {
        await app.close();
        rmSync(legacyReadRoot, { recursive: true, force: true });
        rmSync(writeRoot, { recursive: true, force: true });
        rmSync(uiDir, { recursive: true, force: true });
    };
    return { app, writeRoot, legacyReadRoot, uiDir, token, host: `127.0.0.1:${PORT}`, cleanup };
}

interface FinishBody { writtenPaths: string[]; txnId: string; migratedFrom?: string[] }

describe('wizard auto-migration', () => {
    let ctx: MigrationCtx;
    afterEach(async () => { await ctx.cleanup(); });

    it('POST /finish deletes legacy settings + user-md after successful commit', async () => {
        ctx = await bootMigrationApp({ seedLegacyUserMd: '# legacy user notes\n' });
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { settings: fixtureSettings({ cost_profile: 'balanced' }), userMd: fixtureUserMd() },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as FinishBody;
        expect(body.writtenPaths).toHaveLength(2);
        // New files live under writeRoot.
        expect(readFileSync(join(ctx.writeRoot, '.agent-settings.yml'), 'utf8')).toMatch(/cost_profile:\s*balanced/m);
        expect(readFileSync(join(ctx.writeRoot, '.agent-user.md'), 'utf8')).toMatch(/^---$/m);
        // Legacy files removed; migratedFrom lists both.
        expect(existsSync(join(ctx.legacyReadRoot, '.agent-settings.yml'))).toBe(false);
        expect(existsSync(join(ctx.legacyReadRoot, '.agent-user.md'))).toBe(false);
        expect(body.migratedFrom).toEqual([
            join(ctx.legacyReadRoot, '.agent-settings.yml'),
            join(ctx.legacyReadRoot, '.agent-user.md'),
        ]);
    });

    it('POST /finish only deletes the legacy files that actually existed', async () => {
        ctx = await bootMigrationApp(); // legacy settings yes, user-md no
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { settings: fixtureSettings({ cost_profile: 'minimal' }) },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as FinishBody;
        expect(body.migratedFrom).toEqual([join(ctx.legacyReadRoot, '.agent-settings.yml')]);
        expect(existsSync(join(ctx.legacyReadRoot, '.agent-settings.yml'))).toBe(false);
    });

    it('POST /finish is idempotent — re-run with no legacy files omits migratedFrom', async () => {
        ctx = await bootMigrationApp({ seedLegacySettings: false });
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { settings: fixtureSettings({ cost_profile: 'balanced' }) },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as FinishBody;
        expect(body.migratedFrom).toBeUndefined();
    });

    it('dry-run /finish leaves legacy files intact and skips migratedFrom', async () => {
        ctx = await bootMigrationApp({ dryRun: true, seedLegacyUserMd: '# legacy\n' });
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { settings: fixtureSettings({ cost_profile: 'balanced' }), userMd: fixtureUserMd() },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { ok: boolean; dryRun: boolean; preview: unknown; migratedFrom?: string[] };
        expect(body.dryRun).toBe(true);
        // No legacy deletion in dry-run.
        expect(existsSync(join(ctx.legacyReadRoot, '.agent-settings.yml'))).toBe(true);
        expect(existsSync(join(ctx.legacyReadRoot, '.agent-user.md'))).toBe(true);
        expect(body.migratedFrom).toBeUndefined();
    });
});

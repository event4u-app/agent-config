/**
 * `GET /api/v1/wizard/manifest` `installedPacks` field
 * (road-to-setup-experience § Phase 2).
 *
 * The wizard pre-checks a prior installation's packs — read from the
 * top-level `packs:` list the installer injects into
 * `settings/.agent-settings.yml`. Absent key → EMPTY list (never the whole
 * vocabulary, unlike the projection-side `installed_packs` semantics).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootTestApp, authHeaders, type TestApp } from './helpers.js';

const PORT = 41780;

interface ManifestBody { installedPacks: string[] }

function appendPacksBlock(projectRoot: string, packs: string[]): void {
    const path = join(projectRoot, 'settings', '.agent-settings.yml');
    const raw = readFileSync(path, 'utf8');
    const block = ['packs:', ...packs.map((p) => `  - ${p}`)].join('\n');
    writeFileSync(path, `${raw}\n${block}\n`, { mode: 0o600 });
}

describe('wizard manifest installedPacks', () => {
    let ctx: TestApp;
    afterEach(async () => { if (ctx) await ctx.cleanup(); });

    it('returns the packs: manifest sorted', async () => {
        ctx = await bootTestApp({ port: PORT, extendedSteps: true });
        appendPacksBlock(ctx.projectRoot, ['php', 'git', 'laravel']);
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/manifest', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        expect((res.json() as ManifestBody).installedPacks).toEqual(['git', 'laravel', 'php']);
    });

    it('returns an empty list when no packs: key exists', async () => {
        ctx = await bootTestApp({ port: PORT + 1, extendedSteps: true });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/manifest', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        expect((res.json() as ManifestBody).installedPacks).toEqual([]);
    });

    it('returns an empty list when no settings file exists', async () => {
        ctx = await bootTestApp({ port: PORT + 2, extendedSteps: true, seedSettings: false });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/manifest', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        expect((res.json() as ManifestBody).installedPacks).toEqual([]);
    });
});

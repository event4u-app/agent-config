/**
 * `GET /api/v1/wizard/manifest` `installedPacks` field
 * (road-to-setup-experience § Phase 2).
 *
 * The wizard pre-checks a prior installation's packs — read from the
 * top-level `packs:` list the installer injects into
 * `settings/.agent-settings.yml`. Absent key → EMPTY list (never the whole
 * vocabulary, unlike the projection-side `installed_packs` semantics).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
    let lockDir: string;
    const prevLockEnv = process.env['AGENT_CONFIG_WIZARD_TOOLS'];

    beforeEach(() => {
        // Point the wizard lockfile at a per-test temp path so the suite
        // never reads the developer's real ~/.event4u selection.
        lockDir = mkdtempSync(join(tmpdir(), 'agent-config-packslock-'));
        process.env['AGENT_CONFIG_WIZARD_TOOLS'] = join(lockDir, 'wizard-tools.json');
    });

    afterEach(async () => {
        if (ctx) await ctx.cleanup();
        rmSync(lockDir, { recursive: true, force: true });
        if (prevLockEnv === undefined) delete process.env['AGENT_CONFIG_WIZARD_TOOLS'];
        else process.env['AGENT_CONFIG_WIZARD_TOOLS'] = prevLockEnv;
    });

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

    it('unions the wizard-lockfile packs with the settings manifest', async () => {
        // Existing settings files never get the `packs:` block injected —
        // the lockfile is the persistence path for those machines
        // (council 2026-07-08 Q3, lockfile extension).
        writeFileSync(
            process.env['AGENT_CONFIG_WIZARD_TOOLS'] as string,
            JSON.stringify({ tools: ['claude-code'], packs: ['php', 'laravel'] }),
            { mode: 0o600 },
        );
        ctx = await bootTestApp({ port: PORT + 3, extendedSteps: true });
        appendPacksBlock(ctx.projectRoot, ['git']);
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/manifest', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        expect((res.json() as ManifestBody).installedPacks).toEqual(['git', 'laravel', 'php']);
    });

    it('reads lockfile packs alone when settings carry no packs: key', async () => {
        writeFileSync(
            process.env['AGENT_CONFIG_WIZARD_TOOLS'] as string,
            JSON.stringify({ tools: ['claude-code'], packs: ['finance-basic'] }),
            { mode: 0o600 },
        );
        ctx = await bootTestApp({ port: PORT + 4, extendedSteps: true });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/manifest', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        expect((res.json() as ManifestBody).installedPacks).toEqual(['finance-basic']);
    });
});

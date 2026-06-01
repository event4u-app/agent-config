/**
 * Wizard scope routing acceptance — road-to-global-only-install § Phase 2.3.
 *
 *   POST /api/v1/wizard/finish accepts an optional `scope` parameter:
 *     - `'global'` (default) writes under `writeRoot` (the global config dir).
 *     - `'project'` writes under `projectScopeRoot` (the consumer-project CWD)
 *       when the server resolved that root; otherwise HTTP 422.
 *     - Unknown values rejected with HTTP 422 + structured error.
 *   GET /api/v1/ping surfaces `projectScopeAvailable` so the UI can hide
 *   the checkbox when the opt-in is not available.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';
import { authHeaders, fixtureSettings, fixtureUserIdentity } from './helpers.js';

interface ScopeCtx {
    app: FastifyInstance;
    writeRoot: string;
    projectScopeRoot: string;
    uiDir: string;
    token: string;
    host: string;
    cleanup: () => Promise<void>;
}

const PORT = 41707;

async function bootScopeApp(opts: { withProjectScope?: boolean } = {}): Promise<ScopeCtx> {
    const writeRoot = mkdtempSync(join(tmpdir(), 'agent-config-global-'));
    const projectScopeRoot = mkdtempSync(join(tmpdir(), 'agent-config-project-'));
    mkdirSync(join(writeRoot, 'state'), { recursive: true });
    mkdirSync(join(projectScopeRoot, 'state'), { recursive: true });

    const uiDir = mkdtempSync(join(tmpdir(), 'agent-config-ui-'));
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');

    const token = 'x'.repeat(64);
    const app = await createApp({
        writeRoot,
        projectScopeRoot: opts.withProjectScope === false ? null : projectScopeRoot,
        mode: 'global',
        uiDistDir: uiDir,
        token,
        expectedPort: PORT,
        logLevel: 'fatal',
        skipReplay: true,
        packageRoot: resolve(process.cwd()),
    });
    await app.ready();

    const cleanup = async (): Promise<void> => {
        await app.close();
        rmSync(writeRoot, { recursive: true, force: true });
        rmSync(projectScopeRoot, { recursive: true, force: true });
        rmSync(uiDir, { recursive: true, force: true });
    };
    return { app, writeRoot, projectScopeRoot, uiDir, token, host: `127.0.0.1:${PORT}`, cleanup };
}

interface FinishBody { writtenPaths: string[]; txnId: string; scope?: 'global' | 'project' }

describe('wizard scope routing (Phase 2.3)', () => {
    let ctx: ScopeCtx;
    afterEach(async () => { await ctx.cleanup(); });

    it('GET /ping surfaces projectScopeAvailable=true when a project-scope root is set', async () => {
        ctx = await bootScopeApp();
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/ping',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { projectScopeAvailable: boolean; writeRoot: string };
        expect(body.projectScopeAvailable).toBe(true);
        expect(body.writeRoot).toBe(ctx.writeRoot);
    });

    it('GET /ping surfaces projectScopeAvailable=false when no project-scope root is set', async () => {
        ctx = await bootScopeApp({ withProjectScope: false });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/ping',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        expect((res.json() as { projectScopeAvailable: boolean }).projectScopeAvailable).toBe(false);
    });

    it("POST /finish with scope='global' (default) writes under writeRoot", async () => {
        ctx = await bootScopeApp();
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { settings: fixtureSettings({ rule_loading_tier: 'balanced' }), identity: fixtureUserIdentity() },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as FinishBody;
        expect(existsSync(join(ctx.writeRoot, 'settings', '.agent-settings.yml'))).toBe(true);
        expect(existsSync(join(ctx.projectScopeRoot, 'settings', '.agent-settings.yml'))).toBe(false);
        expect(body.scope).toBe('global');
        expect(readFileSync(join(ctx.writeRoot, 'settings', '.agent-settings.yml'), 'utf8')).toMatch(/rule_loading_tier:\s*balanced/m);
    });

    it("POST /finish with scope='project' writes under projectScopeRoot", async () => {
        ctx = await bootScopeApp();
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { scope: 'project', settings: fixtureSettings({ rule_loading_tier: 'minimal' }), identity: fixtureUserIdentity() },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as FinishBody;
        expect(body.scope).toBe('project');
        expect(existsSync(join(ctx.projectScopeRoot, 'settings', '.agent-settings.yml'))).toBe(true);
        expect(existsSync(join(ctx.writeRoot, 'settings', '.agent-settings.yml'))).toBe(false);
        expect(readFileSync(join(ctx.projectScopeRoot, 'settings', '.agent-settings.yml'), 'utf8')).toMatch(/rule_loading_tier:\s*minimal/m);
    });

    it("POST /finish with scope='project' is rejected (422) when no projectScopeRoot is set", async () => {
        ctx = await bootScopeApp({ withProjectScope: false });
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { scope: 'project', settings: fixtureSettings({ rule_loading_tier: 'balanced' }) },
        });
        expect(res.statusCode).toBe(422);
        const body = res.json() as { error: { code: string; fields?: Array<{ path: string }> } };
        expect(body.error.code).toBe('VALIDATION');
        expect(body.error.fields?.[0]?.path).toBe('scope');
    });

    it('POST /finish with an unknown scope value is rejected (422)', async () => {
        ctx = await bootScopeApp();
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { scope: 'nope', settings: fixtureSettings({ rule_loading_tier: 'balanced' }) },
        });
        expect(res.statusCode).toBe(422);
        const body = res.json() as { error: { code: string; fields?: Array<{ path: string }> } };
        expect(body.error.code).toBe('VALIDATION');
        expect(body.error.fields?.[0]?.path).toBe('scope');
    });
});

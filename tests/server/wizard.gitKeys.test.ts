/**
 * The wizard's finish write passes the same `git.*` gate the settings route
 * does: the user-global file never takes a non-default git value, and in every
 * scope a value that would reach a shell is refused.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';
import { authHeaders, fixtureSettings, fixtureUserIdentity } from './helpers.js';

const PORT = 41721;

interface Ctx { app: FastifyInstance; writeRoot: string; projectScopeRoot: string; token: string; host: string; cleanup: () => Promise<void> }

async function boot(): Promise<Ctx> {
    const writeRoot = mkdtempSync(join(tmpdir(), 'agent-config-global-'));
    const projectScopeRoot = mkdtempSync(join(tmpdir(), 'agent-config-project-'));
    mkdirSync(join(writeRoot, 'state'), { recursive: true });
    mkdirSync(join(projectScopeRoot, 'state'), { recursive: true });
    const uiDir = mkdtempSync(join(tmpdir(), 'agent-config-ui-'));
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');
    const token = 'x'.repeat(64);
    const app = await createApp({
        writeRoot, projectScopeRoot, mode: 'global', uiDistDir: uiDir, token, expectedPort: PORT,
        logLevel: 'fatal', skipReplay: true, packageRoot: resolve(process.cwd()),
    });
    await app.ready();
    const cleanup = async (): Promise<void> => {
        await app.close();
        for (const d of [writeRoot, projectScopeRoot, uiDir]) rmSync(d, { recursive: true, force: true });
    };
    return { app, writeRoot, projectScopeRoot, token, host: `127.0.0.1:${PORT}`, cleanup };
}

function settingsWithGit(git: Record<string, string>): Record<string, unknown> {
    const s = fixtureSettings();
    return { ...s, git: { ...(s['git'] as Record<string, unknown>), ...git } };
}

describe('wizard finish — the git.* gate', () => {
    let ctx: Ctx;
    afterEach(async () => { await ctx.cleanup(); });

    const finish = (payload: Record<string, unknown>) => ctx.app.inject({
        method: 'POST',
        url: '/api/v1/wizard/finish',
        headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
        payload,
    });

    it('refuses a non-default git value bound for the user-global file, and writes nothing', async () => {
        ctx = await boot();
        const res = await finish({ settings: settingsWithGit({ update_strategy: 'rebase' }), identity: fixtureUserIdentity() });
        expect(res.statusCode).toBe(422);
        const body = res.json() as { error: { fields?: Array<{ path: string; message: string }> } };
        expect(body.error.fields?.map((f) => f.path)).toContain('git.update_strategy');
        expect(body.error.fields?.[0]?.message).toContain('.git-convention.yml');
        expect(existsSync(join(ctx.writeRoot, 'settings', '.agent-settings.yml'))).toBe(false);
    });

    it('accepts the template defaults in the user-global file', async () => {
        ctx = await boot();
        const res = await finish({ settings: fixtureSettings(), identity: fixtureUserIdentity() });
        expect(res.statusCode).toBe(200);
    });

    it('writes a valid git value to the project scope', async () => {
        ctx = await boot();
        const res = await finish({ scope: 'project', settings: settingsWithGit({ update_strategy: 'rebase' }), identity: fixtureUserIdentity() });
        expect(res.statusCode).toBe(200);
        expect(readFileSync(join(ctx.projectScopeRoot, 'settings', '.agent-settings.yml'), 'utf8')).toMatch(/update_strategy:\s*rebase/);
    });

    it('refuses a git value that fails the convention check in the project scope too', async () => {
        ctx = await boot();
        const res = await finish({ scope: 'project', settings: settingsWithGit({ branch_pattern: '$(touch x)/{slug}' }), identity: fixtureUserIdentity() });
        expect(res.statusCode).toBe(422);
        expect(existsSync(join(ctx.projectScopeRoot, 'settings', '.agent-settings.yml'))).toBe(false);
    });
});

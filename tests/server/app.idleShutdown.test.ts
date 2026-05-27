/**
 * Browser-lifecycle watchdog — src/server/app.ts `idleShutdown`.
 *
 * Verifies the server self-shutdown contract that lets the local UI stop
 * the process when the browser window closes:
 *
 *   - POST /api/v1/shutdown (the pagehide sendBeacon target) fires onIdle.
 *   - The idle backstop arms only AFTER a client has connected, then fires
 *     onIdle once no activity arrives within timeoutMs.
 *   - It never fires while no client has connected (headless / manual).
 *   - onIdle fires at most once.
 *   - Without the idleShutdown option, /api/v1/shutdown is not registered.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';

const PORT = 41760;
const TOKEN = 'z'.repeat(64);

interface Built { app: FastifyInstance; onIdle: ReturnType<typeof vi.fn>; cleanup: () => Promise<void> }

async function build(mode: 'watchdog' | 'none'): Promise<Built> {
    const projectRoot = mkdtempSync(join(tmpdir(), 'agent-config-idle-'));
    const uiDir = mkdtempSync(join(tmpdir(), 'agent-config-idle-ui-'));
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');
    const onIdle = vi.fn();
    const app = await createApp({
        projectRoot,
        uiDistDir: uiDir,
        token: TOKEN,
        expectedPort: PORT,
        logLevel: 'fatal',
        skipReplay: true,
        ...(mode === 'none' ? {} : { idleShutdown: { onIdle, timeoutMs: 40, intervalMs: 10 } }),
    });
    await app.ready();
    return {
        app, onIdle,
        cleanup: async (): Promise<void> => {
            await app.close();
            rmSync(projectRoot, { recursive: true, force: true });
            rmSync(uiDir, { recursive: true, force: true });
        },
    };
}

const headers = { host: `127.0.0.1:${PORT}`, authorization: `Bearer ${TOKEN}` };
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('app idleShutdown watchdog', () => {
    let ctx: Built;
    afterEach(async () => { if (ctx) await ctx.cleanup(); });

    it('POST /api/v1/shutdown fires onIdle once (the pagehide beacon path)', async () => {
        ctx = await build('watchdog');
        const res = await ctx.app.inject({ method: 'POST', url: '/api/v1/shutdown', headers });
        expect(res.statusCode).toBe(200);
        expect((res.json() as { ok: boolean }).ok).toBe(true);
        // A second beacon must not re-fire.
        await ctx.app.inject({ method: 'POST', url: '/api/v1/shutdown', headers });
        expect(ctx.onIdle).toHaveBeenCalledTimes(1);
    });

    it('does not arm until a client connects, then fires after the idle timeout', async () => {
        ctx = await build('watchdog');
        // No request yet → disarmed even past the timeout.
        await wait(80);
        expect(ctx.onIdle).not.toHaveBeenCalled();
        // One authed request arms the backstop …
        await ctx.app.inject({ method: 'GET', url: '/api/v1/ping', headers });
        // … and with no further activity it fires.
        await wait(120);
        expect(ctx.onIdle).toHaveBeenCalledTimes(1);
    });

    it('does not register /api/v1/shutdown when idleShutdown is absent', async () => {
        ctx = await build('none');
        const res = await ctx.app.inject({ method: 'POST', url: '/api/v1/shutdown', headers });
        expect(res.statusCode).toBe(404);
    });
});

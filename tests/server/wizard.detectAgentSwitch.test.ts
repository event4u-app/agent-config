/**
 * Tests for GET /api/v1/wizard/detect-agent-switch and
 * POST /api/v1/wizard/dismiss-recommendation
 * (road-to-reciprocal-ecosystem § Phase 1 — S0.1 honest-null council
 * verdict, 2026-07-28: a PASSIVE ROW, never gated behind extended-mode —
 * same reasoning as detect-rtk).
 *
 * The route calls `detectAgentSwitch()` with no injection point, so
 * `installed`/`version` are machine-dependent — this file asserts only on
 * response SHAPE for those two fields. `dismissed` is fully deterministic
 * via `AGENT_CONFIG_WIZARD_DISMISSALS` pointed at a temp file.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootTestApp, authHeaders, type TestApp } from './helpers.js';

const PORT = 41830;

interface DetectAgentSwitchBody {
    installed: boolean;
    version: string | null;
    installCommand: string | null;
    repo: string;
    dismissed: boolean;
}

describe('GET /api/v1/wizard/detect-agent-switch', () => {
    let ctx: TestApp;
    let dismissalsDir: string;
    const prev = process.env['AGENT_CONFIG_WIZARD_DISMISSALS'];

    afterEach(async () => {
        if (ctx) await ctx.cleanup();
        if (dismissalsDir) rmSync(dismissalsDir, { recursive: true, force: true });
        if (prev === undefined) delete process.env['AGENT_CONFIG_WIZARD_DISMISSALS'];
        else process.env['AGENT_CONFIG_WIZARD_DISMISSALS'] = prev;
    });

    function setDismissalsEnv(): void {
        dismissalsDir = mkdtempSync(join(tmpdir(), 'wizard-dismissals-srv-'));
        process.env['AGENT_CONFIG_WIZARD_DISMISSALS'] = join(dismissalsDir, 'wizard-dismissals.json');
    }

    it('returns the full response shape and is reachable outside extended mode', async () => {
        setDismissalsEnv();
        ctx = await bootTestApp({ port: PORT, extendedSteps: false });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/detect-agent-switch', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as DetectAgentSwitchBody;
        expect(typeof body.installed).toBe('boolean');
        expect(body.version === null || typeof body.version === 'string').toBe(true);
        expect(body.installCommand === null || typeof body.installCommand === 'string').toBe(true);
        // Self-retiring shape: an install command is present only when NOT installed.
        expect(body.installed ? body.installCommand === null : typeof body.installCommand === 'string').toBe(true);
        expect(body.repo).toBe('event4u-app/agent-switch');
        expect(body.dismissed).toBe(false);
    });

    it('is also reachable in extended mode (available in BOTH wizard modes)', async () => {
        setDismissalsEnv();
        ctx = await bootTestApp({ port: PORT + 1, extendedSteps: true });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/detect-agent-switch', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
    });

    it('rejects an unauthenticated request with 401', async () => {
        setDismissalsEnv();
        ctx = await bootTestApp({ port: PORT + 2, extendedSteps: false });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/detect-agent-switch', headers: { host: ctx.host },
        });
        expect(res.statusCode).toBe(401);
    });

    it('reflects a prior dismissal as dismissed:true', async () => {
        setDismissalsEnv();
        ctx = await bootTestApp({ port: PORT + 3, extendedSteps: false });
        const post = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/dismiss-recommendation',
            headers: authHeaders(ctx.token, ctx.host),
            payload: { id: 'agent-switch' },
        });
        expect(post.statusCode).toBe(200);
        expect((post.json() as { ok: boolean; dismissed: string[] }).ok).toBe(true);
        expect((post.json() as { ok: boolean; dismissed: string[] }).dismissed).toContain('agent-switch');

        const get = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/detect-agent-switch', headers: authHeaders(ctx.token, ctx.host),
        });
        expect((get.json() as DetectAgentSwitchBody).dismissed).toBe(true);
    });

    it('rejects an unknown recommendation id with 422', async () => {
        setDismissalsEnv();
        ctx = await bootTestApp({ port: PORT + 4, extendedSteps: false });
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/dismiss-recommendation',
            headers: authHeaders(ctx.token, ctx.host),
            payload: { id: 'not-a-real-recommendation' },
        });
        expect(res.statusCode).toBe(422);
        const body = res.json() as { error?: { code?: string } };
        expect(body.error?.code).toBe('VALIDATION');
    });

    it('rejects an unauthenticated dismiss request with 401', async () => {
        setDismissalsEnv();
        ctx = await bootTestApp({ port: PORT + 5, extendedSteps: false });
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/dismiss-recommendation',
            headers: { host: ctx.host, 'content-type': 'application/json' },
            payload: { id: 'agent-switch' },
        });
        expect(res.statusCode).toBe(401);
    });
});

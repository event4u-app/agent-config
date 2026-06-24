/**
 * road-to-unified-setup § B0 acceptance: `install` and `setup` boot the
 * same Fastify server but report different landing steps via
 * `GET /api/v1/wizard/state` when no `wizard-state.json` is persisted.
 *
 *   install mode → extendedSteps=true, initialStep=0  (AI tools)
 *   setup   mode → extendedSteps=true, initialStep=4  (Identity)
 *
 * A persisted wizard state must override `initialStep` so a partial run
 * is never thrown away by a mode switch.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { bootTestApp, authHeaders, type TestApp } from './helpers.js';

interface StateBody {
    step: number;
    totalSteps: number;
    partial: Record<string, unknown>;
    startedAt: string | null;
    extendedSteps: boolean;
    wizardMode?: 'install' | 'setup' | null;
}

describe('wizard initialStep (B0 dispatch)', () => {
    let ctx: TestApp;

    afterEach(async () => { await ctx.cleanup(); });

    it('install mode lands on Step 1 (index 0) with 12 total steps', async () => {
        ctx = await bootTestApp({ port: 41610, extendedSteps: true, initialStep: 0 });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/state',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as StateBody;
        expect(body.step).toBe(0);
        expect(body.totalSteps).toBe(12);
        expect(body.extendedSteps).toBe(true);
        expect(body.startedAt).toBeNull();
    });

    it('setup mode lands on the first settings step (index 4) with 12 total steps', async () => {
        ctx = await bootTestApp({ port: 41611, extendedSteps: true, initialStep: 4 });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/state',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as StateBody;
        expect(body.step).toBe(4);
        expect(body.totalSteps).toBe(12);
        expect(body.extendedSteps).toBe(true);
        expect(body.startedAt).toBeNull();
    });

    it('non-extended setup falls back to the 8-step flow at index 0', async () => {
        ctx = await bootTestApp({ port: 41612, extendedSteps: false, initialStep: 0 });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/state',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as StateBody;
        expect(body.step).toBe(0);
        expect(body.totalSteps).toBe(8);
        expect(body.extendedSteps).toBe(false);
    });

    it('clamps out-of-range initialStep to the last step index', async () => {
        ctx = await bootTestApp({ port: 41613, extendedSteps: true, initialStep: 99 });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/state',
            headers: authHeaders(ctx.token, ctx.host),
        });
        const body = res.json() as StateBody;
        expect(body.step).toBe(11);
        expect(body.totalSteps).toBe(12);
    });

    it('clamps a negative initialStep to 0', async () => {
        ctx = await bootTestApp({ port: 41614, extendedSteps: true, initialStep: -5 });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/state',
            headers: authHeaders(ctx.token, ctx.host),
        });
        const body = res.json() as StateBody;
        expect(body.step).toBe(0);
    });

    it('surfaces wizardMode=install when the install command boots the server (B5)', async () => {
        ctx = await bootTestApp({ port: 41620, extendedSteps: true, initialStep: 0, wizardMode: 'install' });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/state',
            headers: authHeaders(ctx.token, ctx.host),
        });
        const body = res.json() as StateBody;
        expect(body.wizardMode).toBe('install');
    });

    it('surfaces wizardMode=setup when the setup command boots the server (B5)', async () => {
        ctx = await bootTestApp({ port: 41621, extendedSteps: true, initialStep: 4, wizardMode: 'setup' });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/state',
            headers: authHeaders(ctx.token, ctx.host),
        });
        const body = res.json() as StateBody;
        expect(body.wizardMode).toBe('setup');
    });

    it('reports wizardMode=null when ui:serve boots without a mode (B5)', async () => {
        ctx = await bootTestApp({ port: 41622, extendedSteps: true, initialStep: 0 });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/state',
            headers: authHeaders(ctx.token, ctx.host),
        });
        const body = res.json() as StateBody;
        expect(body.wizardMode).toBeNull();
    });

    it('persisted wizard-state overrides initialStep (resume wins)', async () => {
        ctx = await bootTestApp({ port: 41615, extendedSteps: true, initialStep: 0 });
        // Seed a partial run at step 5 — opening as `install` (initialStep=0)
        // must NOT throw away the user's progress.
        const post = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/state',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { step: 5, partial: { 'rule_loading_tier': 'balanced' } },
        });
        expect(post.statusCode).toBe(200);

        const get = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/state',
            headers: authHeaders(ctx.token, ctx.host),
        });
        const body = get.json() as StateBody;
        expect(body.step).toBe(5);
        expect(body.partial).toEqual({ 'rule_loading_tier': 'balanced' });
    });

});

/**
 * Phase 1.6 acceptance: wizard state + finish routes.
 *
 *   GET  /api/v1/wizard/state    → starts at step 0, totalSteps default 8,
 *                                  resumes prior partial after POST.
 *   POST /api/v1/wizard/state    → validates step; rejects negative.
 *   POST /api/v1/wizard/finish   → 2PC dual-write of settings + user-md;
 *                                  also drops the wizard-state.json on
 *                                  successful commit.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootTestApp, authHeaders, fixtureSettings, fixtureUserIdentity, type TestApp } from './helpers.js';

const PORT = 41605;

interface StateBody { step: number; totalSteps: number; partial: Record<string, unknown>; startedAt: string | null }
interface FinishBody { writtenPaths: string[]; txnId: string }
interface ErrorBody { error: { code: string; fields?: Array<{ path: string }> } }

describe('wizard state + finish', () => {
    let ctx: TestApp;

    beforeEach(async () => { ctx = await bootTestApp({ port: PORT }); });
    afterEach(async () => { await ctx.cleanup(); });

    it('GET /state returns the fresh-start tuple when nothing is persisted', async () => {
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/state', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as StateBody;
        expect(body.step).toBe(0);
        expect(body.totalSteps).toBe(8);
        expect(body.partial).toEqual({});
        expect(body.startedAt).toBeNull();
    });

    it('GET /state ignores a stale on-disk wizard-state.json (server boot = fresh)', async () => {
        // road-to-wizard-ux-improvements § Phase 1: a brand-new launch must
        // start fresh, never resume a step left on disk by a previous run.
        const stateDir = join(ctx.projectRoot, 'state');
        mkdirSync(stateDir, { recursive: true });
        writeFileSync(
            join(stateDir, 'wizard-state.json'),
            JSON.stringify({ step: 5, totalSteps: 7, partial: { cost_profile: 'balanced' }, startedAt: new Date().toISOString() }),
        );
        // This app booted with empty in-memory session state; the disk file
        // must be ignored.
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/state', headers: authHeaders(ctx.token, ctx.host),
        });
        const body = res.json() as StateBody;
        expect(body.step).toBe(0);
        expect(body.partial).toEqual({});
    });

    it('POST /state persists the partial and GET resumes it', async () => {
        const post = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/state',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { step: 3, partial: { 'personal.user_name': 'Matze', 'cost_profile': 'balanced' } },
        });
        expect(post.statusCode).toBe(200);
        expect((post.json() as { ok: boolean }).ok).toBe(true);
        // State file lives at the documented path.
        expect(existsSync(join(ctx.projectRoot, 'state', 'wizard-state.json'))).toBe(true);

        const get = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/state', headers: authHeaders(ctx.token, ctx.host),
        });
        const body = get.json() as StateBody;
        expect(body.step).toBe(3);
        expect(body.partial).toEqual({ 'personal.user_name': 'Matze', 'cost_profile': 'balanced' });
        expect(body.startedAt).not.toBeNull();
    });

    it('POST /state rejects a negative step with 422 VALIDATION', async () => {
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/state',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { step: -1, partial: {} },
        });
        expect(res.statusCode).toBe(422);
        expect((res.json() as ErrorBody).error.code).toBe('VALIDATION');
    });

    it('POST /finish commits settings + user-md in one 2PC transaction', async () => {
        // First seed a partial so we can prove /finish drops it.
        await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/state',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { step: 6, partial: {} },
        });
        expect(existsSync(join(ctx.projectRoot, 'state', 'wizard-state.json'))).toBe(true);

        const identity = fixtureUserIdentity();
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: {
                settings: fixtureSettings({ cost_profile: 'minimal' }),
                identity,
            },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as FinishBody;
        expect(body.writtenPaths).toHaveLength(2);
        expect(body.txnId.length).toBeGreaterThan(0);
        // Both files exist and hold the expected scalars.
        expect(readFileSync(join(ctx.projectRoot, 'settings', '.agent-settings.yml'), 'utf8')).toMatch(/^cost_profile:\s*minimal\b/m);
        expect(readFileSync(join(ctx.projectRoot, 'settings', '.agent-user.yml'), 'utf8')).toMatch(/name:\s*Matze/);
        // Marker cleaned up.
        expect(existsSync(join(ctx.projectRoot, 'state', `wizard-intent-${body.txnId}.json`))).toBe(false);
        // Wizard state file dropped on success.
        expect(existsSync(join(ctx.projectRoot, 'state', 'wizard-state.json'))).toBe(false);
    });

    it('POST /finish accepts a settings-only payload (identity omitted)', async () => {
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { settings: fixtureSettings({ cost_profile: 'balanced' }) },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as FinishBody;
        expect(body.writtenPaths).toHaveLength(1);
        expect(existsSync(join(ctx.projectRoot, 'settings', '.agent-user.yml'))).toBe(false);
    });

    it('POST /finish returns 422 when settings fail schema validation', async () => {
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { settings: { cost_profile: 'bogus' } },
        });
        expect(res.statusCode).toBe(422);
        const body = res.json() as ErrorBody;
        expect(body.error.code).toBe('VALIDATION');
        expect(body.error.fields?.some((f) => f.path === 'cost_profile')).toBe(true);
    });

    it('POST /finish returns 422 when identity fails schema validation', async () => {
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: {
                settings: fixtureSettings({ cost_profile: 'balanced' }),
                identity: { ...fixtureUserIdentity(), identity: { name: '' } },
            },
        });
        expect(res.statusCode).toBe(422);
        const body = res.json() as ErrorBody;
        expect(body.error.code).toBe('VALIDATION');
    });
});

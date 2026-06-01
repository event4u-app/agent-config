/**
 * Phase 1.6 acceptance: PUT /api/v1/settings — rejection paths.
 *
 * Covers every documented non-200 from the settings-api contract:
 *   - 412 PRECONDITION_REQUIRED when `If-Unmodified-Since` is missing
 *   - 422 VALIDATION when the payload fails the Zod schema
 *   - 409 CONFLICT when `If-Unmodified-Since` lags the on-disk mtime
 *   - 401 Unauthorized when the bearer token is missing/wrong
 *   - 421 Misdirected when the Host header is bogus
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootTestApp, authHeaders, fixtureSettings, type TestApp } from './helpers.js';

const PORT = 41603;

interface GetResponse { lastModified: number }
interface ErrorBody { error: { code: string; fields?: Array<{ path: string }> } }
interface ConflictBody extends ErrorBody { current: { values: Record<string, unknown>; lastModified: number } }

describe('PUT /api/v1/settings — rejection paths', () => {
    let ctx: TestApp;

    beforeEach(async () => { ctx = await bootTestApp({ port: PORT }); });
    afterEach(async () => { await ctx.cleanup(); });

    async function currentMtime(): Promise<number> {
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/settings', headers: authHeaders(ctx.token, ctx.host),
        });
        return (res.json() as GetResponse).lastModified;
    }

    it('returns 412 PRECONDITION_REQUIRED when If-Unmodified-Since header is missing', async () => {
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { values: fixtureSettings() },
        });
        expect(res.statusCode).toBe(412);
        expect((res.json() as ErrorBody).error.code).toBe('PRECONDITION_REQUIRED');
    });

    it('returns 422 VALIDATION with field paths when payload fails schema', async () => {
        const ius = await currentMtime();
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: {
                ...authHeaders(ctx.token, ctx.host),
                'content-type': 'application/json',
                'if-unmodified-since': String(ius + 5),
            },
            payload: { values: { rule_loading_tier: 'nope', cost: { budgets: { daily: -10 } } } },
        });
        expect(res.statusCode).toBe(422);
        const body = res.json() as ErrorBody;
        expect(body.error.code).toBe('VALIDATION');
        expect(body.error.fields?.length ?? 0).toBeGreaterThan(0);
    });

    it('returns 409 CONFLICT with current state when If-Unmodified-Since is stale', async () => {
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: {
                ...authHeaders(ctx.token, ctx.host),
                'content-type': 'application/json',
                'if-unmodified-since': '1', // ancient → stale
            },
            payload: { values: fixtureSettings({ rule_loading_tier: 'balanced' }) },
        });
        expect(res.statusCode).toBe(409);
        const body = res.json() as ConflictBody;
        expect(body.error.code).toBe('CONFLICT');
        expect(body.current.lastModified).toBeGreaterThan(1);
        expect(body.current.values).toHaveProperty('rule_loading_tier');
    });

    it('returns 401 when the bearer token is missing', async () => {
        const ius = await currentMtime();
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: { host: ctx.host, 'content-type': 'application/json', 'if-unmodified-since': String(ius + 5) },
            payload: { values: fixtureSettings() },
        });
        expect(res.statusCode).toBe(401);
    });

    it('returns 401 when the bearer token is wrong', async () => {
        const ius = await currentMtime();
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: {
                host: ctx.host,
                authorization: 'Bearer not-the-real-token',
                'content-type': 'application/json',
                'if-unmodified-since': String(ius + 5),
            },
            payload: { values: fixtureSettings() },
        });
        expect(res.statusCode).toBe(401);
    });

    it('returns 421 Misdirected on a bogus Host header', async () => {
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: { host: 'evil.example.com', authorization: `Bearer ${ctx.token}` },
        });
        expect(res.statusCode).toBe(421);
    });
});

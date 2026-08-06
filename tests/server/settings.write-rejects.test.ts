/**
 * Phase 1.6 acceptance: PUT /api/v1/settings — rejection paths.
 *
 * Covers every documented non-200 from the settings-api contract:
 *   - 412 PRECONDITION_REQUIRED when `If-Unmodified-Since` is missing
 *   - 422 VALIDATION when the payload fails the Zod schema
 *   - 409 CONFLICT when `If-Unmodified-Since` lags the on-disk mtime
 *   - 401 Unauthorized when the bearer token is missing/wrong
 *   - 421 Misdirected when the Host header is bogus
 *   - 409 guarded-keys when a class-C key changes without `confirmGuarded`
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

describe('PUT /api/v1/settings — the guarded-key gate', () => {
    let ctx: TestApp;

    beforeEach(async () => { ctx = await bootTestApp({ port: PORT + 1 }); });
    afterEach(async () => { await ctx.cleanup(); });

    async function mtime(): Promise<number> {
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/settings', headers: authHeaders(ctx.token, ctx.host),
        });
        return (res.json() as GetResponse).lastModified;
    }

    async function put(payload: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
        const ius = await mtime();
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: {
                ...authHeaders(ctx.token, ctx.host),
                'content-type': 'application/json',
                'if-unmodified-since': String(ius + 5),
            },
            payload,
        });
        return { status: res.statusCode, body: res.json() };
    }

    it('refuses an unconfirmed change to a class-C key and names it', async () => {
        const { status, body } = await put({ values: fixtureSettings({ rule_loading_tier: 'minimal' }) });
        expect(status).toBe(409);
        const b = body as { error: string; guardedKeys: string[]; classContractRead: boolean };
        expect(b.error).toBe('guarded-keys');
        expect(b.guardedKeys).toContain('rule_loading_tier');
        // The gate must say whether it actually read the contract. A refusal
        // because the contract was unreadable is a different fact from a
        // refusal because the key is genuinely guarded, and a caller that
        // cannot tell them apart will treat the first as the second forever.
        expect(b.classContractRead).toBe(true);
    });

    it('accepts the same change once a human has confirmed it', async () => {
        const { status } = await put({
            values: fixtureSettings({ rule_loading_tier: 'minimal' }),
            confirmGuarded: true,
        });
        expect(status).toBe(200);
    });

    it('does not fire when only class-A keys change', async () => {
        // Establish a known baseline first: fixtureSettings() is a
        // schema-defaulted tree, not the on-disk one, so overlaying a single
        // key on it still differs from disk in many places — including guarded
        // ones. Write it once with the confirmation, then diff against itself.
        expect((await put({ values: fixtureSettings(), confirmGuarded: true })).status).toBe(200);
        const base = fixtureSettings();
        const personal = { ...(base['personal'] as Record<string, unknown>), play_by_play: true };
        const { status } = await put({ values: { ...base, personal } });
        // An A-class change is exactly what the writer is FOR. If the gate
        // fired here the confirmation would be unskippable, and an
        // unskippable confirmation is one nobody reads.
        expect(status).toBe(200);
    });

    it('does not fire when nothing changed', async () => {
        expect((await put({ values: fixtureSettings(), confirmGuarded: true })).status).toBe(200);
        const { status } = await put({ values: fixtureSettings() });
        expect(status).toBe(200);
    });
});

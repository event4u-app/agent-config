/**
 * Phase 1.6 acceptance: `.agent-user.yml` route suite.
 *
 *   GET  /api/v1/user-md            → exists=false for fresh project,
 *                                     exists=true with identity + mtime once written
 *   GET  /api/v1/user-md/template   → template body from `templates/agent-user.yml`
 *   PUT  /api/v1/user-md            → create (no IUS header), update (IUS required),
 *                                     stale IUS → 409, invalid identity → 422
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseUserIdentity, composeUserIdentity } from '../../src/shared/userMd/utils.js';
import { userIdentitySchema } from '../../src/shared/userMd/schema.js';
import { bootTestApp, authHeaders, fixtureUserIdentity, type TestApp } from './helpers.js';

const PORT = 41604;

const VALID_IDENTITY = fixtureUserIdentity({ notes: 'This is fine.' });
const USER_YML_REL = join('settings', '.agent-user.yml');

interface GetUserMd { identity: Record<string, unknown> | null; exists: boolean; lastModified: number | null }
interface PutUserMd { lastModified: number; writtenPaths: string[] }
interface ErrorBody { error: { code: string; fields?: Array<{ path: string }> } }

describe('.agent-user.yml routes', () => {
    let ctx: TestApp;

    beforeEach(async () => { ctx = await bootTestApp({ port: PORT }); });
    afterEach(async () => { await ctx.cleanup(); });

    it('GET returns exists=false when the file is absent', async () => {
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/user-md', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as GetUserMd;
        expect(body.exists).toBe(false);
        expect(body.identity).toBeNull();
        expect(body.lastModified).toBeNull();
    });

    it('GET /template returns the package-shipped template body', async () => {
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/user-md/template', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = (res.json() as { body: string }).body;
        // Template MUST round-trip through the shared parser — the same
        // one the agent uses to consume the file at runtime.
        expect(() => parseUserIdentity(body)).not.toThrow();
        expect(body.length).toBeGreaterThan(0);
    });

    it('PUT creates the file when none exists (no If-Unmodified-Since needed)', async () => {
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/user-md',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { identity: VALID_IDENTITY },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as PutUserMd;
        expect(body.writtenPaths).toEqual([USER_YML_REL]);
        expect(Number.isInteger(body.lastModified)).toBe(true);

        const onDisk = readFileSync(join(ctx.projectRoot, USER_YML_REL), 'utf8');
        const parsed = userIdentitySchema.parse(parseUserIdentity(onDisk));
        expect(parsed).toEqual(VALID_IDENTITY);
        if (process.platform !== 'win32') {
            expect(statSync(join(ctx.projectRoot, USER_YML_REL)).mode & 0o777).toBe(0o600);
        }
    });

    it('PUT requires If-Unmodified-Since when the file exists (412 otherwise)', async () => {
        mkdirSync(join(ctx.projectRoot, 'settings'), { recursive: true, mode: 0o700 });
        writeFileSync(join(ctx.projectRoot, USER_YML_REL), composeUserIdentity(VALID_IDENTITY), { mode: 0o600 });
        const updated = fixtureUserIdentity({ name: 'Mathias', notes: 'This is fine.' });
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/user-md',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { identity: updated },
        });
        expect(res.statusCode).toBe(412);
        expect((res.json() as ErrorBody).error.code).toBe('PRECONDITION_REQUIRED');
    });

    it('PUT returns 409 CONFLICT with the current identity when If-Unmodified-Since is stale', async () => {
        mkdirSync(join(ctx.projectRoot, 'settings'), { recursive: true, mode: 0o700 });
        writeFileSync(join(ctx.projectRoot, USER_YML_REL), composeUserIdentity(VALID_IDENTITY), { mode: 0o600 });
        const updated = fixtureUserIdentity({ name: 'Mathias', notes: 'This is fine.' });
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/user-md',
            headers: {
                ...authHeaders(ctx.token, ctx.host),
                'content-type': 'application/json',
                'if-unmodified-since': '1',
            },
            payload: { identity: updated },
        });
        expect(res.statusCode).toBe(409);
        const body = res.json() as ErrorBody & { current: { identity: Record<string, unknown>; lastModified: number } };
        expect(body.error.code).toBe('CONFLICT');
        expect(body.current.identity).toEqual(VALID_IDENTITY);
        expect(body.current.lastModified).toBeGreaterThan(1);
    });

    it('PUT rejects invalid identity with 422 VALIDATION', async () => {
        // identity.name is required by userIdentitySchema → missing it trips refine.
        const bad = { ...VALID_IDENTITY, identity: { name: '' } };
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/user-md',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { identity: bad },
        });
        expect(res.statusCode).toBe(422);
        const body = res.json() as ErrorBody;
        expect(body.error.code).toBe('VALIDATION');
        expect(body.error.fields?.some((f) => f.path.startsWith('identity'))).toBe(true);
    });

    it('PUT rejects notes over the 8000-char cap with 422 VALIDATION', async () => {
        const huge = fixtureUserIdentity({ notes: 'x'.repeat(8001) });
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/user-md',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { identity: huge },
        });
        expect(res.statusCode).toBe(422);
        expect((res.json() as ErrorBody).error.code).toBe('VALIDATION');
    });
});

/**
 * Phase 1.6 acceptance: `.agent-user.md` route suite.
 *
 *   GET  /api/v1/user-md            → exists=false for fresh project,
 *                                     exists=true with body + mtime once written
 *   GET  /api/v1/user-md/template   → template body from `templates/agent-user.md`
 *   PUT  /api/v1/user-md            → create (no IUS header), update (IUS required),
 *                                     stale IUS → 409, malformed frontmatter → 422
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseUserMd } from '../../src/shared/userMd/utils.js';
import { bootTestApp, authHeaders, fixtureUserMd, type TestApp } from './helpers.js';

const PORT = 41604;

const VALID_BODY = fixtureUserMd({ notes: 'This is fine.' });

interface GetUserMd { body: string; exists: boolean; lastModified: number | null }
interface PutUserMd { lastModified: number; writtenPaths: string[] }
interface ErrorBody { error: { code: string; fields?: Array<{ path: string }> } }

describe('.agent-user.md routes', () => {
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
        expect(body.body).toBe('');
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
        expect(() => parseUserMd(body)).not.toThrow();
        expect(body.length).toBeGreaterThan(0);
    });

    it('PUT creates the file when none exists (no If-Unmodified-Since needed)', async () => {
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/user-md',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { body: VALID_BODY },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as PutUserMd;
        expect(body.writtenPaths).toEqual(['.agent-user.md']);
        expect(Number.isInteger(body.lastModified)).toBe(true);

        const onDisk = readFileSync(join(ctx.projectRoot, '.agent-user.md'), 'utf8');
        expect(onDisk).toBe(VALID_BODY);
        if (process.platform !== 'win32') {
            expect(statSync(join(ctx.projectRoot, '.agent-user.md')).mode & 0o777).toBe(0o600);
        }
    });

    it('PUT requires If-Unmodified-Since when the file exists (412 otherwise)', async () => {
        writeFileSync(join(ctx.projectRoot, '.agent-user.md'), VALID_BODY, { mode: 0o600 });
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/user-md',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { body: VALID_BODY.replace('Matze', 'Mathias') },
        });
        expect(res.statusCode).toBe(412);
        expect((res.json() as ErrorBody).error.code).toBe('PRECONDITION_REQUIRED');
    });

    it('PUT returns 409 CONFLICT with the current body when If-Unmodified-Since is stale', async () => {
        writeFileSync(join(ctx.projectRoot, '.agent-user.md'), VALID_BODY, { mode: 0o600 });
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/user-md',
            headers: {
                ...authHeaders(ctx.token, ctx.host),
                'content-type': 'application/json',
                'if-unmodified-since': '1',
            },
            payload: { body: VALID_BODY.replace('Matze', 'Mathias') },
        });
        expect(res.statusCode).toBe(409);
        const body = res.json() as ErrorBody & { current: { body: string; lastModified: number } };
        expect(body.error.code).toBe('CONFLICT');
        expect(body.current.body).toBe(VALID_BODY);
        expect(body.current.lastModified).toBeGreaterThan(1);
    });

    it('PUT rejects malformed frontmatter with 422 VALIDATION', async () => {
        const BAD = `---\nversion: 1\nidentity:\n  name: "unclosed\n---\n\n# Notes\n`;
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/user-md',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { body: BAD },
        });
        expect(res.statusCode).toBe(422);
        const body = res.json() as ErrorBody;
        expect(body.error.code).toBe('VALIDATION');
        // superRefine path is relative to the field — final joined path is
        // either `body` (length cap) or `body.body` (frontmatter refine).
        expect(body.error.fields?.some((f) => f.path.startsWith('body'))).toBe(true);
    });

    it('PUT rejects bodies over the 8000-char cap with 422 VALIDATION', async () => {
        const huge = `---\nversion: 1\n---\n` + 'x'.repeat(8001);
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/user-md',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { body: huge },
        });
        expect(res.statusCode).toBe(422);
        expect((res.json() as ErrorBody).error.code).toBe('VALIDATION');
    });
});

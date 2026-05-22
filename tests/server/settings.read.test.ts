/**
 * Phase 1.6 acceptance: GET /api/v1/settings.
 *
 * Asserts the documented response shape (`values`, `lastModified`,
 * `path`, `schema`) and the documented error paths (404 when the file
 * is missing, 500 with `YAML_PARSE` code when the file exists but is
 * not parseable as a YAML mapping).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { bootTestApp, authHeaders, type TestApp } from './helpers.js';

const PORT = 41600;

describe('GET /api/v1/settings', () => {
    let ctx: TestApp;

    beforeEach(async () => { ctx = await bootTestApp({ port: PORT }); });
    afterEach(async () => { await ctx.cleanup(); });

    it('returns values, lastModified, path, and the JSON schema', async () => {
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as {
            values: Record<string, unknown>;
            lastModified: number;
            path: string;
            schema: { definitions?: Record<string, unknown>; $ref?: string };
        };
        expect(body.path).toBe('.agent-settings.yml');
        expect(Number.isInteger(body.lastModified)).toBe(true);
        expect(body.lastModified).toBeGreaterThan(0);
        expect(typeof body.values).toBe('object');
        // Template placeholders survive parse — they're literal YAML strings.
        expect(body.values).toHaveProperty('cost_profile');
        // Schema is the zod-to-json-schema projection of `settingsSchema`.
        expect(body.schema).toBeDefined();
        const refOrDefs = '$ref' in body.schema || 'definitions' in body.schema;
        expect(refOrDefs).toBe(true);
    });

    it('returns 404 with NOT_FOUND when the file is missing', async () => {
        unlinkSync(join(ctx.projectRoot, '.agent-settings.yml'));
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(404);
        const body = res.json() as { error: { code: string } };
        expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 500 with YAML_PARSE when the file is corrupt', async () => {
        writeFileSync(
            join(ctx.projectRoot, '.agent-settings.yml'),
            '!!!\n: not yaml :\n  - [bad',
            { mode: 0o600 },
        );
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(500);
        const body = res.json() as { error: { code: string } };
        expect(body.error.code).toBe('YAML_PARSE');
    });

    it('returns 500 with YAML_PARSE when the file is not a mapping', async () => {
        // Array at root — js-yaml parses but our route refuses anything
        // that is not a top-level object.
        writeFileSync(join(ctx.projectRoot, '.agent-settings.yml'), '- a\n- b\n', { mode: 0o600 });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(500);
        expect((res.json() as { error: { code: string } }).error.code).toBe('YAML_PARSE');
    });

    it('surfaces legacy personal.user_name as legacyHints.user_name', async () => {
        // Pre-v2 file shape: `personal.user_name` still present on disk.
        // Zod strips it on PUT, but GET pulls it out of the raw parse so
        // the wizard can seed `.agent-user.md` &rarr; `identity.name`.
        writeFileSync(
            join(ctx.projectRoot, '.agent-settings.yml'),
            'personal:\n  user_name: "Matze"\n  ide: "phpstorm"\n',
            { mode: 0o600 },
        );
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { legacyHints: { user_name?: string } };
        expect(body.legacyHints).toEqual({ user_name: 'Matze' });
    });

    it('omits legacyHints.user_name when the legacy key is absent or blank', async () => {
        // Template ships without `personal.user_name`; whitespace-only
        // values are also dropped (the wizard would render the field
        // empty otherwise).
        writeFileSync(
            join(ctx.projectRoot, '.agent-settings.yml'),
            'personal:\n  user_name: "   "\n  ide: "phpstorm"\n',
            { mode: 0o600 },
        );
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { legacyHints: Record<string, unknown> };
        expect(body.legacyHints).toEqual({});
    });
});

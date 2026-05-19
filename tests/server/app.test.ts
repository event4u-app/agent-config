/**
 * Tests for src/server/app.ts — Fastify app security contract.
 *
 * Roadmap Phase 3 acceptance + council security mandate:
 *   - /api/v1/ping returns the documented zod shape when auth is good.
 *   - Bad Host header → HTTP 421.
 *   - Bad Origin header → HTTP 403.
 *   - Missing or wrong Bearer token → HTTP 401.
 *   - Static UI files (no /api/ prefix) bypass token gate.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';
import { PingResponseSchema } from '../../src/server/routes/ping.js';

const TOKEN = 'a'.repeat(64);
const PORT = 41555;
const HOST = `127.0.0.1:${PORT}`;

describe('createApp', () => {
    let app: FastifyInstance;
    let uiDir: string;

    beforeEach(async () => {
        uiDir = mkdtempSync(join(tmpdir(), 'agent-config-ui-test-'));
        writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');
        app = await createApp({
            projectRoot: '/tmp/fake-project',
            uiDistDir: uiDir,
            token: TOKEN,
            expectedPort: PORT,
            logLevel: 'fatal',
        });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        rmSync(uiDir, { recursive: true, force: true });
    });

    it('returns the ping shape for an authenticated /api/v1/ping request', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/ping',
            headers: { host: HOST, authorization: `Bearer ${TOKEN}` },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(() => PingResponseSchema.parse(body)).not.toThrow();
        expect(body).toMatchObject({ ok: true, projectRoot: '/tmp/fake-project' });
    });

    it('accepts the token via ?token= query param', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/ping?token=${TOKEN}`,
            headers: { host: HOST },
        });
        expect(res.statusCode).toBe(200);
    });

    it('rejects /api/* without a token (HTTP 401)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/ping',
            headers: { host: HOST },
        });
        expect(res.statusCode).toBe(401);
    });

    it('rejects /api/* with a wrong token (HTTP 401)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/ping',
            headers: { host: HOST, authorization: 'Bearer ' + 'b'.repeat(64) },
        });
        expect(res.statusCode).toBe(401);
    });

    it('rejects a non-localhost Host header (HTTP 421)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/ping',
            headers: { host: 'evil.com', authorization: `Bearer ${TOKEN}` },
        });
        expect(res.statusCode).toBe(421);
    });

    it('rejects a non-allow-listed Origin header (HTTP 403)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/ping',
            headers: {
                host: HOST,
                origin: 'https://evil.com',
                authorization: `Bearer ${TOKEN}`,
            },
        });
        expect(res.statusCode).toBe(403);
    });

    it('accepts an allow-listed Origin header', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/ping',
            headers: {
                host: HOST,
                origin: `http://127.0.0.1:${PORT}`,
                authorization: `Bearer ${TOKEN}`,
            },
        });
        expect(res.statusCode).toBe(200);
    });

    it('serves static UI files at / without requiring a token', async () => {
        const res = await app.inject({ method: 'GET', url: '/', headers: { host: HOST } });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('<!doctype html>');
    });
});

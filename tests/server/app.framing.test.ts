/**
 * Framing stance (reciprocal-ecosystem embed contract, Phase 2).
 *
 * AC refuses to be iframed — a host renders the UI top-level in its own
 * window. The decided stance is CSP `frame-ancestors 'none'`, served on the
 * static UI responses (header-only; a <meta> CSP would ignore it). This test
 * pins that the header ships and that the three security hooks still hold.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';

const TOKEN = 'b'.repeat(64);
const PORT = 41556;
const HOST = `127.0.0.1:${PORT}`;

describe('createApp — framing stance', () => {
    let app: FastifyInstance;
    let uiDir: string;

    beforeEach(async () => {
        uiDir = mkdtempSync(join(tmpdir(), 'agent-config-framing-test-'));
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

    it("serves CSP frame-ancestors 'none' on the static UI response", async () => {
        const res = await app.inject({ method: 'GET', url: '/', headers: { host: HOST } });
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-security-policy']).toBe("frame-ancestors 'none'");
    });

    it('still gates /api/* behind the Bearer token (hook unchanged)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/ping', headers: { host: HOST } });
        expect(res.statusCode).toBe(401);
    });

    it('still rejects a bad Host header with 421 (hook unchanged)', async () => {
        const res = await app.inject({ method: 'GET', url: '/', headers: { host: 'evil.example:80' } });
        expect(res.statusCode).toBe(421);
    });
});

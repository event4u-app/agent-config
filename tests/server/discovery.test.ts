/**
 * Tests for src/server/routes/discovery.ts — manifest exposure.
 *
 * Roadmap R3 Phase 3 acceptance:
 *   - Returns the full manifest on the happy path.
 *   - Honours `?slice=workspaces|packs|artefacts|unassigned`.
 *   - Returns 400 on an unknown slice.
 *   - Returns 503 when the manifest file is absent.
 *   - All standard app-level guards (auth, Host, Origin) still apply.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';

const TOKEN = 'a'.repeat(64);
const PORT = 41556;
const HOST = `127.0.0.1:${PORT}`;

const SAMPLE_MANIFEST = {
    version: 1,
    generated_at: '2026-05-19T00:00:00Z',
    scanner_version: 'test-1',
    checksum: 'sha256:deadbeef',
    workspaces: [
        {
            id: 'engineering',
            label: 'Engineering',
            description: 'Engineering workspace.',
            default_packs: ['engineering-base'],
        },
    ],
    packs: [
        {
            id: 'engineering-base',
            label: 'Engineering Base',
            description: 'Hygiene pack.',
            workspaces: ['engineering'],
            trust_level_default: 'core',
            artefact_count: 0,
        },
    ],
    artefacts: [],
    unassigned: [{ path: 'foo.md', category: 'skill', reason: 'no-workspace' }],
};

describe('discoveryRoute', () => {
    let app: FastifyInstance;
    let tmp: string;
    let uiDir: string;

    async function buildApp(opts: { withManifest: boolean }): Promise<void> {
        tmp = mkdtempSync(join(tmpdir(), 'agent-config-discovery-'));
        uiDir = join(tmp, 'ui');
        const distDir = join(tmp, 'discovery');
        mkdirSync(uiDir, { recursive: true });
        mkdirSync(distDir, { recursive: true });
        writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');
        const manifestPath = join(distDir, 'discovery-manifest.json');
        if (opts.withManifest) {
            writeFileSync(manifestPath, JSON.stringify(SAMPLE_MANIFEST));
        }
        app = await createApp({
            projectRoot: '/tmp/fake-project',
            uiDistDir: uiDir,
            token: TOKEN,
            expectedPort: PORT,
            logLevel: 'fatal',
            discoveryManifestPath: manifestPath,
        });
        await app.ready();
    }

    afterEach(async () => {
        await app.close();
        rmSync(tmp, { recursive: true, force: true });
    });

    describe('with manifest present', () => {
        beforeEach(async () => {
            await buildApp({ withManifest: true });
        });

        it('returns the full manifest on the happy path', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/discovery/manifest',
                headers: { host: HOST, authorization: `Bearer ${TOKEN}` },
            });
            expect(res.statusCode).toBe(200);
            const body = res.json() as { version: number; workspaces: unknown[]; packs: unknown[] };
            expect(body.version).toBe(1);
            expect(body.workspaces).toHaveLength(1);
            expect(body.packs).toHaveLength(1);
        });

        it.each(['workspaces', 'packs', 'artefacts', 'unassigned'] as const)(
            'returns only the %s slice when ?slice=%s',
            async (slice) => {
                const res = await app.inject({
                    method: 'GET',
                    url: `/api/v1/discovery/manifest?slice=${slice}`,
                    headers: { host: HOST, authorization: `Bearer ${TOKEN}` },
                });
                expect(res.statusCode).toBe(200);
                const body = res.json() as Record<string, unknown>;
                expect(Object.keys(body)).toEqual([slice]);
            },
        );

        it('rejects an unknown slice with HTTP 400', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/discovery/manifest?slice=bogus',
                headers: { host: HOST, authorization: `Bearer ${TOKEN}` },
            });
            expect(res.statusCode).toBe(400);
        });

        it('rejects unauthenticated requests with HTTP 401', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/discovery/manifest',
                headers: { host: HOST },
            });
            expect(res.statusCode).toBe(401);
        });
    });

    describe('without manifest', () => {
        beforeEach(async () => {
            await buildApp({ withManifest: false });
        });

        it('returns HTTP 503 when the manifest is missing', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/discovery/manifest',
                headers: { host: HOST, authorization: `Bearer ${TOKEN}` },
            });
            expect(res.statusCode).toBe(503);
            const body = res.json() as { error: string };
            expect(body.error).toContain('discovery manifest not available');
        });
    });
});

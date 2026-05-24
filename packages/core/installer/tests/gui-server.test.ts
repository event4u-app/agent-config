/**
 * Integration tests for `startGuiServer`. Boots the real HTTP server
 * (loopback, ephemeral port) against a fixture manifest written to a
 * tmp project root. Verifies static asset serving, CSRF injection,
 * security headers, host/origin gating, and PID file lifecycle.
 *
 * This is the lighter-weight stand-in for the roadmap's
 * `task installer-gui-e2e` Playwright slot — it exercises the same
 * code paths that the browser hits without the headless-browser
 * dependency.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startGuiServer } from '../src/gui/server.js';
import type { GuiServerHandle } from '../src/gui/types.js';
import { makeArtefact, makeManifest, makePack } from './_fixtures.js';

let proj: string;
let manifestPath: string;
let handle: GuiServerHandle;
let baseUrl: string;

function writeManifest(): string {
    const manifest = makeManifest({
        packs: [makePack({ id: 'a' })],
        artefacts: [makeArtefact({ path: '.agent-src.uncompressed/rules/foo.md', packs: ['a'] })],
    });
    const dir = join(proj, 'dist', 'discovery');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'discovery-manifest.json');
    writeFileSync(path, JSON.stringify(manifest));
    return path;
}

beforeEach(async () => {
    proj = mkdtempSync(join(tmpdir(), 'gui-server-'));
    manifestPath = writeManifest();
    handle = await startGuiServer({
        projectRoot: proj,
        manifestPath,
        noOpen: true,
        stdout: new PassThrough(),
    });
    baseUrl = handle.url.replace(/\/$/, '');
});

afterEach(async () => {
    await handle.close();
    rmSync(proj, { recursive: true, force: true });
});

describe('startGuiServer — boot + lifecycle', () => {
    it('binds to 127.0.0.1 with an ephemeral port', () => {
        expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
        expect(handle.port).toBeGreaterThan(0);
        expect(handle.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it('writes a PID file on boot and removes it on close', async () => {
        expect(existsSync(handle.pidFile)).toBe(true);
        const recorded = readFileSync(handle.pidFile, 'utf8').trim();
        expect(recorded).toMatch(/^\d+$/);
        expect(Number.parseInt(recorded, 10)).toBe(process.pid);
        await handle.close();
        expect(existsSync(handle.pidFile)).toBe(false);
    });
});

describe('startGuiServer — static assets', () => {
    it('serves index.html with the CSRF token injected', async () => {
        const res = await fetch(`${baseUrl}/`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/html');
        expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        const body = await res.text();
        expect(body).toContain(`content="${handle.csrfToken}"`);
        expect(body).not.toContain('__CSRF__');
    });

    it('serves app.css and app.js with the right content types', async () => {
        const css = await fetch(`${baseUrl}/app.css`);
        expect(css.status).toBe(200);
        expect(css.headers.get('content-type')).toContain('text/css');

        const js = await fetch(`${baseUrl}/app.js`);
        expect(js.status).toBe(200);
        expect(js.headers.get('content-type')).toContain('application/javascript');
    });

    it('404s an unknown asset path', async () => {
        const res = await fetch(`${baseUrl}/nope.html`);
        expect(res.status).toBe(404);
    });
});

describe('startGuiServer — security gates', () => {
    it('rejects requests with a non-loopback Host header', async () => {
        // Node's `fetch` rewrites the Host header — use raw http.request.
        const status = await new Promise<number>((resolve, reject) => {
            const req = httpRequest(
                { host: '127.0.0.1', port: handle.port, path: '/', method: 'GET', headers: { Host: 'evil.example.com' } },
                (res) => {
                    res.resume();
                    resolve(res.statusCode ?? 0);
                },
            );
            req.on('error', reject);
            req.end();
        });
        expect(status).toBe(403);
    });

    it('rejects POSTs with a non-loopback Origin', async () => {
        const res = await fetch(`${baseUrl}/api/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example.com' },
            body: JSON.stringify({ workspaces: ['engineering'], packs: ['a'], csrf: handle.csrfToken }),
        });
        expect(res.status).toBe(403);
    });
});

describe('startGuiServer — API wiring', () => {
    it('serves the loaded manifest at /api/manifest', async () => {
        const res = await fetch(`${baseUrl}/api/manifest`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.manifest.packs[0].id).toBe('a');
        expect(body.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it('enforces CSRF on /api/preview', async () => {
        const res = await fetch(`${baseUrl}/api/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: handle.url.replace(/\/$/, '') },
            body: JSON.stringify({ workspaces: ['engineering'], packs: ['a'], csrf: 'bad' }),
        });
        expect(res.status).toBe(403);
    });
});

// road-to-internal-ai-os-deployment Phase 1 Steps 2 + 3 — host binding +
// health endpoint. These tests do not share the outer beforeEach handle
// because they need a server bound to a different host / allowlist.

describe('startGuiServer — non-loopback bind (ADR-021)', () => {
    it('refuses to boot when host is non-loopback without allowedHosts', async () => {
        const tmpProj = mkdtempSync(join(tmpdir(), 'gui-host-'));
        const mp = (() => {
            const m = makeManifest({
                packs: [makePack({ id: 'a' })],
                artefacts: [makeArtefact({ path: '.agent-src.uncompressed/rules/foo.md', packs: ['a'] })],
            });
            const dir = join(tmpProj, 'dist', 'discovery');
            mkdirSync(dir, { recursive: true });
            const p = join(dir, 'discovery-manifest.json');
            writeFileSync(p, JSON.stringify(m));
            return p;
        })();
        await expect(
            startGuiServer({
                projectRoot: tmpProj,
                manifestPath: mp,
                host: '0.0.0.0',
                noOpen: true,
                stdout: new PassThrough(),
            }),
        ).rejects.toThrow(/allowedHosts/);
        rmSync(tmpProj, { recursive: true, force: true });
    });
});

describe('GET /api/v1/health', () => {
    it('returns 200 with status + version + uptime + config', async () => {
        const res = await fetch(`${baseUrl}/api/v1/health`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
        expect(body.uptime_seconds).toBeGreaterThanOrEqual(0);
        expect(typeof body.storage_mode).toBe('string');
        expect(typeof body.session_backend).toBe('string');
        expect(body.manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rate-limits repeated probes from the same IP', async () => {
        // First call resets the bucket for this IP after the previous
        // test. Second call within 1s must return 429.
        await fetch(`${baseUrl}/api/v1/health`);
        const second = await fetch(`${baseUrl}/api/v1/health`);
        expect(second.status).toBe(429);
        const body = await second.json();
        expect(body.error).toBe('rate_limited');
    });
});

/**
 * Tests for the GUI API handlers (`/api/manifest`, `/api/auto-detect`,
 * `/api/preview`, `/api/apply`, `/api/cancel`). Boots a real loopback
 * server per test so CSRF gating, JSON shape, and SSE framing are
 * exercised the same way the browser sees them.
 *
 * Source files for the install plan are staged in a tmp package root;
 * the project root is also a tmpdir so no real workspace is touched.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { handleApi, type ApiContext } from '../src/gui/handlers.js';
import type { LoadedManifest } from '../src/manifest-loader.js';
import { sha256OfString } from '../src/io/sha256.js';
import { __resetTaskState, TASK_CATALOG } from '../src/gui/task-exec.js';
import type { ExplainResult, ExplainRunner } from '../src/gui/explain-exec.js';
import { makeArtefact, makeManifest, makePack } from './_fixtures.js';

const CSRF = 'a'.repeat(64);
let pkg: string;
let proj: string;
let server: Server;
let baseUrl: string;

function writeSource(relPath: string, content: string): void {
    const abs = join(pkg, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
}

function buildContext(overrides: Partial<ApiContext> = {}): ApiContext {
    const manifest = makeManifest({
        packs: [makePack({ id: 'a' })],
        artefacts: [makeArtefact({ path: '.agent-src.uncompressed/rules/foo.md', packs: ['a'] })],
    });
    const json = JSON.stringify(manifest);
    const loaded: LoadedManifest = {
        manifest,
        sha256: sha256OfString(json),
        path: join(pkg, 'dist', 'discovery', 'discovery-manifest.json'),
    };
    return { csrfToken: CSRF, loaded, projectRoot: proj, ...overrides };
}

beforeEach(async () => {
    pkg = mkdtempSync(join(tmpdir(), 'gui-handlers-pkg-'));
    proj = mkdtempSync(join(tmpdir(), 'gui-handlers-proj-'));
    writeSource('.agent-src.uncompressed/rules/foo.md', 'foo body\n');
    const ctx = buildContext();
    server = createServer((req, res) => void handleApi(req, res, ctx));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(pkg, { recursive: true, force: true });
    rmSync(proj, { recursive: true, force: true });
});

describe('GET /api/manifest', () => {
    it('returns manifest + sha256', async () => {
        const res = await fetch(`${baseUrl}/api/manifest`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.manifest.packs[0].id).toBe('a');
        expect(body.sha256).toMatch(/^[a-f0-9]{64}$/);
    });
});

describe('GET /api/auto-detect', () => {
    it('returns signals (empty when no project markers)', async () => {
        const res = await fetch(`${baseUrl}/api/auto-detect`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.signals)).toBe(true);
    });
});

describe('POST /api/preview', () => {
    it('rejects bad csrf', async () => {
        const res = await fetch(`${baseUrl}/api/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaces: ['engineering'], packs: ['a'], acceptAdvisory: [], csrf: 'bad' }),
        });
        expect(res.status).toBe(403);
        expect((await res.json()).error).toBe('csrf_invalid');
    });

    it('returns plan summary for valid selection', async () => {
        const res = await fetch(`${baseUrl}/api/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaces: ['engineering'], packs: ['a'], acceptAdvisory: [], csrf: CSRF }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.packs).toHaveLength(1);
        expect(body.files).toBe(1);
    });

    it('rejects unknown pack with 400', async () => {
        const res = await fetch(`${baseUrl}/api/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaces: ['engineering'], packs: ['nope'], acceptAdvisory: [], csrf: CSRF }),
        });
        expect(res.status).toBe(400);
    });

    it('rejects non-object body', async () => {
        const res = await fetch(`${baseUrl}/api/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'null',
        });
        expect(res.status).toBe(400);
    });
});

describe('POST /api/cancel', () => {
    it('rejects bad csrf', async () => {
        const res = await fetch(`${baseUrl}/api/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaces: [], packs: [], acceptAdvisory: [], csrf: 'bad' }),
        });
        expect(res.status).toBe(403);
    });

    it('returns ok with valid csrf', async () => {
        const res = await fetch(`${baseUrl}/api/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaces: [], packs: [], acceptAdvisory: [], csrf: CSRF }),
        });
        expect(res.status).toBe(200);
        expect((await res.json()).ok).toBe(true);
    });
});

describe('POST /api/apply', () => {
    it('rejects bad csrf', async () => {
        const res = await fetch(`${baseUrl}/api/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaces: ['engineering'], packs: ['a'], acceptAdvisory: [], csrf: 'bad' }),
        });
        expect(res.status).toBe(403);
    });

    it('streams SSE events and writes the install', async () => {
        const res = await fetch(`${baseUrl}/api/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaces: ['engineering'], packs: ['a'], acceptAdvisory: [], csrf: CSRF }),
        });
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/event-stream');
        const text = await res.text();
        const events = text
            .split('\n\n')
            .filter((b) => b.startsWith('data:'))
            .map((b) => JSON.parse(b.slice(5).trim()));
        expect(events.some((e) => e.type === 'plan-file')).toBe(true);
        expect(events.some((e) => e.type === 'done')).toBe(true);
        const done = events.find((e) => e.type === 'done');
        expect(done.filesWritten).toBe(1);
        expect(done.lockfileSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(readFileSync(join(proj, '.augment/rules/foo.md'), 'utf8')).toBe('foo body\n');
    });

    it('emits error event for unknown pack', async () => {
        const res = await fetch(`${baseUrl}/api/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaces: ['engineering'], packs: ['nope'], acceptAdvisory: [], csrf: CSRF }),
        });
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain('"type":"error"');
        expect(text).toMatch(/unknown[_ ]pack/);
    });
});


describe('POST /api/open-lockfile', () => {
    it('rejects bad csrf', async () => {
        const res = await fetch(`${baseUrl}/api/open-lockfile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf: 'bad' }),
        });
        expect(res.status).toBe(403);
        expect((await res.json()).error).toBe('csrf_invalid');
    });

    it('returns 404 when lockfile is missing', async () => {
        const res = await fetch(`${baseUrl}/api/open-lockfile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf: CSRF }),
        });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('lockfile_not_found');
        expect(body.path).toContain('agent-config.lock.yml');
    });

    it('reports headless when lockfile exists but no display', async () => {
        mkdirSync(join(proj, 'agents'), { recursive: true });
        writeFileSync(join(proj, 'agents', 'agent-config.lock.yml'), 'version: 1\n');
        const prevDisplay = process.env['DISPLAY'];
        const prevWayland = process.env['WAYLAND_DISPLAY'];
        const prevPlatform = process.platform;
        delete process.env['DISPLAY'];
        delete process.env['WAYLAND_DISPLAY'];
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
        try {
            const res = await fetch(`${baseUrl}/api/open-lockfile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csrf: CSRF }),
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.ok).toBe(false);
            expect(body.reason).toBe('headless');
            expect(body.path).toContain('agent-config.lock.yml');
        } finally {
            if (prevDisplay !== undefined) process.env['DISPLAY'] = prevDisplay;
            if (prevWayland !== undefined) process.env['WAYLAND_DISPLAY'] = prevWayland;
            Object.defineProperty(process, 'platform', { value: prevPlatform, configurable: true });
        }
    });
});

describe('recovery endpoints', () => {
    /**
     * Spin a dedicated server with an injected RecoveryState so the
     * GET /POST endpoints see an "open log". The default beforeEach
     * server has no recovery and is closed first to free the port slot.
     */
    let recoveryServer: Server;
    let recoveryUrl: string;
    let logPath: string;
    let cleared: boolean;

    beforeEach(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        mkdirSync(join(proj, 'agents', 'runtime', 'gui'), { recursive: true });
        logPath = join(proj, 'agents', 'runtime', 'gui', 'install-test.log');
        writeFileSync(logPath,
            `${JSON.stringify({ kind: 'start', ts: 't1', workspaces: ['default'], packs: ['a'] })}\n` +
            `${JSON.stringify({ kind: 'plan', ts: 't1', path: '.augment/rules/foo.md' })}\n`,
            'utf8',
        );
        mkdirSync(join(proj, '.augment', 'rules'), { recursive: true });
        writeFileSync(join(proj, '.augment', 'rules', 'foo.md'), 'body\n');
        cleared = false;
        const ctx: ApiContext = {
            ...buildContext(),
            recovery: { logPath, plannedPaths: ['.augment/rules/foo.md'] },
            clearRecovery: () => { cleared = true; },
        };
        recoveryServer = createServer((req, res) => void handleApi(req, res, ctx));
        await new Promise<void>((resolve) => recoveryServer.listen(0, '127.0.0.1', resolve));
        const p = (recoveryServer.address() as AddressInfo).port;
        recoveryUrl = `http://127.0.0.1:${p}`;
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => recoveryServer.close(() => resolve()));
    });

    it('GET /api/recovery returns open=true with planned paths', async () => {
        const res = await fetch(`${recoveryUrl}/api/recovery`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.open).toBe(true);
        expect(body.logPath).toBe(logPath);
        expect(body.plannedPaths).toEqual(['.augment/rules/foo.md']);
    });

    it('POST /api/recovery/rollback rejects bad csrf', async () => {
        const res = await fetch(`${recoveryUrl}/api/recovery/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf: 'bad' }),
        });
        expect(res.status).toBe(403);
    });

    it('POST /api/recovery/rollback removes planned file + clears state', async () => {
        const target = join(proj, '.augment', 'rules', 'foo.md');
        expect(existsSync(target)).toBe(true);
        const res = await fetch(`${recoveryUrl}/api/recovery/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf: CSRF }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.removed).toEqual(['.augment/rules/foo.md']);
        expect(existsSync(target)).toBe(false);
        expect(cleared).toBe(true);
    });

    it('POST /api/recovery/discard truncates log without removing files', async () => {
        const target = join(proj, '.augment', 'rules', 'foo.md');
        const res = await fetch(`${recoveryUrl}/api/recovery/discard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf: CSRF }),
        });
        expect(res.status).toBe(200);
        expect((await res.json()).ok).toBe(true);
        expect(existsSync(target)).toBe(true);
        expect(readFileSync(logPath, 'utf8')).toBe('');
        expect(cleared).toBe(true);
    });
});

describe('recovery endpoints without open log', () => {
    it('GET /api/recovery returns open=false', async () => {
        const res = await fetch(`${baseUrl}/api/recovery`);
        expect(res.status).toBe(200);
        expect((await res.json())).toEqual({ open: false });
    });

    it('POST /api/recovery/rollback returns 404 when no log present', async () => {
        const res = await fetch(`${baseUrl}/api/recovery/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf: CSRF }),
        });
        expect(res.status).toBe(404);
        expect((await res.json()).error).toBe('no_open_log');
    });
});

describe('unknown route', () => {
    it('returns 404', async () => {
        const res = await fetch(`${baseUrl}/api/nope`);
        expect(res.status).toBe(404);
    });
});

// ──────────────────────────────────────────────────────────────────────
// Phase 1 — Task execution surface
// ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/task/catalog', () => {
    it('returns the frozen allowlist', async () => {
        const res = await fetch(`${baseUrl}/api/v1/task/catalog`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.tasks)).toBe(true);
        expect(body.tasks.length).toBe(TASK_CATALOG.length);
        const ids = body.tasks.map((t: { id: string }) => t.id);
        expect(ids).toContain('lint-skills');
        expect(ids).toContain('test');
        expect(ids).toContain('sync');
    });
});

describe('GET /api/v1/task/history', () => {
    beforeEach(() => __resetTaskState());

    it('returns an empty list initially', async () => {
        const res = await fetch(`${baseUrl}/api/v1/task/history`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.runs).toEqual([]);
    });
});

describe('POST /api/v1/task/run', () => {
    beforeEach(() => __resetTaskState());

    it('rejects bad csrf with 403', async () => {
        const res = await fetch(`${baseUrl}/api/v1/task/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 'lint-skills', csrf: 'bad' }),
        });
        expect(res.status).toBe(403);
        expect((await res.json()).error).toBe('csrf_invalid');
    });

    it('rejects missing id with 400', async () => {
        const res = await fetch(`${baseUrl}/api/v1/task/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csrf: CSRF }),
        });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('missing_id');
    });

    it('rejects unknown task id with 404', async () => {
        const res = await fetch(`${baseUrl}/api/v1/task/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 'rm-rf-root', csrf: CSRF }),
        });
        expect(res.status).toBe(404);
        expect((await res.json()).error).toBe('unknown_task');
    });
});

// ──────────────────────────────────────────────────────────────────────
// Phase 4 — Council inspection (read-only)
// ──────────────────────────────────────────────────────────────────────

function writeCouncilSession(id: string, manifest: Record<string, unknown>, response?: string): void {
    const dir = join(pkg, 'agents', 'runtime', 'council', 'sessions', id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
    if (response !== undefined) writeFileSync(join(dir, 'response.md'), response);
}

describe('GET /api/v1/council/recent', () => {
    it('returns empty list when sessions dir is absent', async () => {
        const res = await fetch(`${baseUrl}/api/v1/council/recent`);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ sessions: [] });
    });

    it('returns sessions newest first', async () => {
        writeCouncilSession('2026-05-01T10-00-00Z', {
            timestamp_utc: '2026-05-01T10:00:00Z',
            artefact: 'rules/foo.md',
            provider: 'openai',
            model: 'gpt-5',
            mode: 'review',
            input_tokens: 100,
            output_tokens: 50,
            actual_usd: 0.001,
        });
        writeCouncilSession('2026-05-02T10-00-00Z', {
            timestamp_utc: '2026-05-02T10:00:00Z',
            artefact: 'rules/bar.md',
            provider: 'anthropic',
            model: 'claude-4',
            mode: 'review',
        });
        const res = await fetch(`${baseUrl}/api/v1/council/recent`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.sessions).toHaveLength(2);
        expect(body.sessions[0].id).toBe('2026-05-02T10-00-00Z');
        expect(body.sessions[0].artefact).toBe('rules/bar.md');
        expect(body.sessions[1].id).toBe('2026-05-01T10-00-00Z');
    });
});

describe('GET /api/v1/council/session/:id', () => {
    it('rejects invalid id with 400', async () => {
        const res = await fetch(`${baseUrl}/api/v1/council/session/..%2Fetc`);
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('invalid_session_id');
    });

    it('returns 404 for missing session', async () => {
        const res = await fetch(`${baseUrl}/api/v1/council/session/2026-01-01T00-00-00Z`);
        expect(res.status).toBe(404);
        expect((await res.json()).error).toBe('session_not_found');
    });

    it('returns manifest + response.md for known session', async () => {
        writeCouncilSession(
            '2026-06-01T12-00-00Z',
            {
                timestamp_utc: '2026-06-01T12:00:00Z',
                artefact: 'rules/baz.md',
                provider: 'openai',
                model: 'gpt-5',
                mode: 'review',
            },
            '# Response body\n\nLooks good.\n',
        );
        const res = await fetch(`${baseUrl}/api/v1/council/session/2026-06-01T12-00-00Z`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.session.id).toBe('2026-06-01T12-00-00Z');
        expect(body.session.artefact).toBe('rules/baz.md');
        expect(body.response).toContain('Looks good');
    });
});


describe('GET /api/v1/explain/last', () => {
    async function withRunner(runner: ExplainRunner): Promise<string> {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        const ctx = buildContext({ explainRunner: runner });
        server = createServer((req, res) => void handleApi(req, res, ctx));
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const port = (server.address() as AddressInfo).port;
        return `http://127.0.0.1:${port}`;
    }

    it('returns 200 + trace payload on ok', async () => {
        const trace = {
            version: 1,
            generated_at: '2026-05-24T10:00:00Z',
            run_id: 'r-1',
            subject: 'work',
            inputs: null,
            route: null,
            council: null,
            memory: null,
            pack: null,
            assumptions: [],
            halt: null,
            provider: null,
        };
        const fake: ExplainRunner = async (): Promise<ExplainResult> => ({ kind: 'ok', trace });
        const url = await withRunner(fake);
        const res = await fetch(`${url}/api/v1/explain/last`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.trace.run_id).toBe('r-1');
        expect(body.trace.subject).toBe('work');
    });

    it('returns 404 + message when no trace is available', async () => {
        const fake: ExplainRunner = async (): Promise<ExplainResult> => ({
            kind: 'not_found',
            stderr: '❌ explain last: no .work-state.json found\n',
        });
        const url = await withRunner(fake);
        const res = await fetch(`${url}/api/v1/explain/last`);
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('no_trace');
        expect(body.message).toContain('no .work-state.json');
    });

    it('returns 500 + error payload when runner reports failure', async () => {
        const fake: ExplainRunner = async (): Promise<ExplainResult> => ({
            kind: 'error',
            exitCode: 2,
            stderr: 'boom',
            stdout: '',
        });
        const url = await withRunner(fake);
        const res = await fetch(`${url}/api/v1/explain/last`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('explain_failed');
        expect(body.exitCode).toBe(2);
        expect(body.message).toBe('boom');
    });

    it('returns 500 when runner throws', async () => {
        const fake: ExplainRunner = async (): Promise<ExplainResult> => {
            throw new Error('spawn ENOENT');
        };
        const url = await withRunner(fake);
        const res = await fetch(`${url}/api/v1/explain/last`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('explain_failed');
        expect(body.message).toContain('spawn ENOENT');
    });
});

/**
 * Workspace launcher E2E — Phase A Step 5 of
 * `road-to-frictionless-employee-workspace.md`.
 *
 * Boots the Fastify app in-process against a temp `writeRoot` +
 * temp `packageRoot` (seeded with one role fixture) and walks the
 * three flows the roadmap pins:
 *
 *   1. Pick a role → start a session → list the session.
 *   2. Append `host.turn` event → read the session log.
 *   3. Render the right-rail data sources (knowledge + documents +
 *      explain renderer) to confirm the surface contract holds
 *      end-to-end.
 *
 * Uses Playwright's `request` fixture only — no browser binaries
 * required so the spec runs from a stock `npm ci`. WCAG / focus-ring /
 * keyboard-path coverage is documented in
 * `docs/walkthroughs/daily-workspace-a11y.md` (waivers list there).
 */
import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

import { createApp } from '../../src/server/app.js';

async function findFreePort(): Promise<number> {
    return await new Promise<number>((res, rej) => {
        const srv = createServer();
        srv.unref();
        srv.on('error', rej);
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            if (addr === null || typeof addr === 'string') {
                rej(new Error('no address'));
                return;
            }
            const port = addr.port;
            srv.close(() => res(port));
        });
    });
}

const ROLE_INDEX_MD = `---
role: galabau
display_name: "Galabau owner"
tagline: "E2E fixture."
recommended_packs: [core]
install_path_hint: "test"
recruit_session_ref: null
status: draft
---

# Galabau

## Three first tasks

1. **Offer drafting** — turn a brief into an offer.
2. **Email reply** — reply in the right tone.
3. **Brief refinement** — refine a fuzzy brief.
`;

const ROLE_SKILLS_YML = `skills:
  - id: refine-prompt
    why: "Tightens fuzzy briefs."
`;

const TOKEN = 'b'.repeat(64);

let tmpWrite: string;
let tmpPackage: string;
let baseURL: string;
let api: APIRequestContext;
let shutdown: () => Promise<void>;

test.beforeAll(async () => {
    tmpWrite = mkdtempSync(join(tmpdir(), 'workspace-e2e-write-'));
    tmpPackage = mkdtempSync(join(tmpdir(), 'workspace-e2e-pkg-'));
    const roleDir = join(tmpPackage, 'agents', 'roles', 'galabau');
    mkdirSync(roleDir, { recursive: true });
    writeFileSync(join(roleDir, 'index.md'), ROLE_INDEX_MD);
    writeFileSync(join(roleDir, 'skills.yml'), ROLE_SKILLS_YML);

    const docsDir = join(tmpWrite, 'workspace', 'documents', 'offer');
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'sample.md'), '---\ntitle: Sample\nrole: galabau\n---\n\nbody');

    const knowDir = join(tmpPackage, 'agents', 'memory', 'knowledge', '20260525T000000Z');
    mkdirSync(knowDir, { recursive: true });
    writeFileSync(join(knowDir, 'manifest.json'), JSON.stringify({
        documents: [{ source: '/tmp/handbook.pdf', excerpt: 'Handbook.', pinned: true }],
    }));

    const port = await findFreePort();
    const uiDir = join(tmpWrite, 'ui');
    mkdirSync(uiDir, { recursive: true });
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');

    const app = await createApp({
        writeRoot: tmpWrite,
        uiDistDir: uiDir,
        token: TOKEN,
        expectedPort: port,
        logLevel: 'fatal',
        skipReplay: true,
        packageRoot: tmpPackage,
    });
    await app.listen({ port, host: '127.0.0.1' });
    baseURL = `http://127.0.0.1:${port}`;
    api = await request.newContext({
        baseURL,
        extraHTTPHeaders: { authorization: `Bearer ${TOKEN}` },
    });
    shutdown = async (): Promise<void> => { await app.close(); };
});

test.afterAll(async () => {
    await api.dispose();
    await shutdown();
    rmSync(tmpWrite, { recursive: true, force: true });
    rmSync(tmpPackage, { recursive: true, force: true });
});

test('flow 1 — pick a role, start a session, see it in the list', async () => {
    const roles = await api.get('/api/v1/workspace/roles');
    expect(roles.status()).toBe(200);
    const rolesBody = await roles.json() as { roles: Array<{ slug: string; first_tasks: unknown[] }> };
    expect(rolesBody.roles).toHaveLength(1);
    expect(rolesBody.roles[0]?.slug).toBe('galabau');
    expect(rolesBody.roles[0]?.first_tasks).toHaveLength(3);

    const tasks = await api.get('/api/v1/workspace/roles/galabau/tasks');
    expect(tasks.status()).toBe(200);

    const launch = await api.post('/api/v1/workspace/launch', {
        data: { role: 'galabau', task: 'Offer drafting' },
    });
    expect(launch.status()).toBe(200);
    const launchBody = await launch.json() as { id: string };
    expect(launchBody.id).toMatch(/^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$/);

    const sessions = await api.get('/api/v1/workspace/sessions');
    expect(sessions.status()).toBe(200);
    const sessionsBody = await sessions.json() as { sessions: Array<{ id: string }> };
    expect(sessionsBody.sessions).toHaveLength(1);
    expect(sessionsBody.sessions[0]?.id).toBe(launchBody.id);
});

test('flow 2 — append a host.turn event and read the log back', async () => {
    const launch = await api.post('/api/v1/workspace/launch', {
        data: { role: 'galabau', task: 'Email reply' },
    });
    const launchBody = await launch.json() as { id: string };
    const id = launchBody.id;

    const append = await api.post(`/api/v1/workspace/sessions/${id}/append`, {
        data: { kind: 'host.turn', data: { host_id: 'claude', input_tokens: 12 } },
    });
    expect(append.status()).toBe(200);

    const read = await api.get(`/api/v1/workspace/sessions/${id}`);
    expect(read.status()).toBe(200);
    const log = await read.json() as { log: Array<{ kind: string; data: { host_id?: string } }> };
    expect(log.log.length).toBe(2);
    expect(log.log[0]?.kind).toBe('launcher.input');
    expect(log.log[1]?.kind).toBe('host.turn');
    expect(log.log[1]?.data.host_id).toBe('claude');
});

test('flow 3 — right-rail data sources resolve end-to-end', async () => {
    const know = await api.get('/api/v1/workspace/knowledge');
    expect(know.status()).toBe(200);
    const knowBody = await know.json() as { chunks: Array<{ source: string; pinned: boolean }> };
    expect(knowBody.chunks.length).toBeGreaterThanOrEqual(1);
    expect(knowBody.chunks[0]?.pinned).toBe(true);

    const docs = await api.get('/api/v1/workspace/documents');
    expect(docs.status()).toBe(200);
    const docsBody = await docs.json() as { documents: Array<{ title: string }> };
    expect(docsBody.documents.length).toBeGreaterThanOrEqual(1);
    expect(docsBody.documents[0]?.title).toBe('Sample');

    const explain = await api.post('/api/v1/workspace/explain', {
        data: {
            mode: 'plain',
            body: { source: 'test', explain_text: 'The council ruled this is a stable pack.' },
        },
    });
    expect(explain.status()).toBe(200);
    const explainBody = await explain.json() as { text: string; glossary_hits: string[] };
    expect(explainBody.text).toContain('second-opinion check');
    expect(explainBody.text).toContain('ready-made setup');
    expect(explainBody.glossary_hits).toContain('council');
    expect(explainBody.glossary_hits).toContain('pack');
});

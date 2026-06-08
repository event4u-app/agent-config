/**
 * Tests for src/server/routes/workspace.ts — workspace surface API.
 *
 * Covers the seven endpoints declared in
 * `docs/contracts/daily-workspace.md` § Endpoints:
 *   - GET    /api/v1/workspace/roles
 *   - GET    /api/v1/workspace/roles/:role/tasks
 *   - GET    /api/v1/workspace/sessions
 *   - GET    /api/v1/workspace/sessions/:id
 *   - POST   /api/v1/workspace/launch
 *   - GET    /api/v1/workspace/knowledge
 *   - GET    /api/v1/workspace/documents
 * Plus the helper `POST /api/v1/workspace/sessions/:id/append` and
 * the explain renderer.
 *
 * Every test builds a temp `packageRoot` with a single role fixture
 * (galabau) so the role-listing endpoint has deterministic content.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';

const TOKEN = 'a'.repeat(64);
const PORT = 41557;
const HOST = `127.0.0.1:${PORT}`;
const AUTH = { host: HOST, authorization: `Bearer ${TOKEN}` };

const ROLE_INDEX_MD = `---
role: galabau
display_name: "Galabau owner"
tagline: "Customer offers and project briefs."
recommended_packs: [core, content]
install_path_hint: "MCP recommended"
recruit_session_ref: null
status: draft
---

# Role experience — Galabau owner

## Persona

You run a small Galabau shop.

## Three first tasks

1. **Offer drafting** — turn a brief into an offer. Prompt: [\`prompts/offer-from-brief.md\`](prompts/offer-from-brief.md).
2. **Email reply** — reply in the right tone. Prompt: [\`prompts/customer-email-reply.md\`](prompts/customer-email-reply.md).
3. **Brief refinement** — refine a fuzzy brief. Prompt: [\`prompts/project-brief-refine.md\`](prompts/project-brief-refine.md).

## Recommended packs

- \`core\` — always-on.
- \`content\` — editorial-craft.
`;

const ROLE_SKILLS_YML = `skills:
  - id: refine-prompt
    why: "Tightens fuzzy briefs."
  - id: voice-and-tone-design
    why: "Locks the voice."
`;

describe('workspaceRoute', () => {
    let app: FastifyInstance;
    let tmpWrite: string;
    let tmpPackage: string;
    let uiDir: string;

    beforeEach(async () => {
        tmpWrite = mkdtempSync(join(tmpdir(), 'agent-config-workspace-write-'));
        tmpPackage = mkdtempSync(join(tmpdir(), 'agent-config-workspace-pkg-'));
        uiDir = join(tmpWrite, 'ui');
        mkdirSync(uiDir, { recursive: true });
        writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');

        const roleDir = join(tmpPackage, 'agents', 'roles', 'galabau');
        mkdirSync(roleDir, { recursive: true });
        writeFileSync(join(roleDir, 'index.md'), ROLE_INDEX_MD);
        writeFileSync(join(roleDir, 'skills.yml'), ROLE_SKILLS_YML);

        app = await createApp({
            writeRoot: tmpWrite,
            uiDistDir: uiDir,
            token: TOKEN,
            expectedPort: PORT,
            logLevel: 'fatal',
            skipReplay: true,
            packageRoot: tmpPackage,
        });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        rmSync(tmpWrite, { recursive: true, force: true });
        rmSync(tmpPackage, { recursive: true, force: true });
    });

    it('lists roles from agents/roles/<slug>/', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/workspace/roles', headers: AUTH });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { roles: Array<{ slug: string; display_name: string; first_tasks: unknown[] }> };
        expect(body.roles).toHaveLength(1);
        expect(body.roles[0]?.slug).toBe('galabau');
        expect(body.roles[0]?.display_name).toBe('Galabau owner');
        expect(body.roles[0]?.first_tasks).toHaveLength(3);
    });

    it('returns a role’s tasks and skill shortlist', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/workspace/roles/galabau/tasks',
            headers: AUTH,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { role: string; tasks: Array<{ name: string; prompt: string }>; skills: Array<{ id: string }> };
        expect(body.role).toBe('galabau');
        expect(body.tasks).toHaveLength(3);
        expect(body.tasks[0]?.prompt).toBe('offer-from-brief.md');
        expect(body.skills).toHaveLength(2);
        expect(body.skills[0]?.id).toBe('refine-prompt');
    });

    it('returns 404 for an unknown role', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/workspace/roles/ghost/tasks',
            headers: AUTH,
        });
        expect(res.statusCode).toBe(404);
    });

    it('returns an empty session list when no sessions exist yet', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/workspace/sessions', headers: AUTH });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { sessions: unknown[] };
        expect(body.sessions).toEqual([]);
    });

    it('POSTs /workspace/launch and writes a session JSONL header', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/workspace/launch',
            headers: { ...AUTH, 'content-type': 'application/json' },
            payload: { role: 'galabau', task: 'Offer drafting', host: 'local' },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { id: string; role: string; task: string };
        expect(body.role).toBe('galabau');
        expect(body.task).toBe('Offer drafting');
        expect(body.id).toMatch(/^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$/);

        const list = await app.inject({ method: 'GET', url: '/api/v1/workspace/sessions', headers: AUTH });
        const listBody = list.json() as { sessions: Array<{ id: string; role: string; task: string }> };
        expect(listBody.sessions).toHaveLength(1);
        expect(listBody.sessions[0]?.id).toBe(body.id);
        expect(listBody.sessions[0]?.role).toBe('galabau');
    });

    it('rejects /workspace/launch with HTTP 400 when role or task is missing', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/workspace/launch',
            headers: { ...AUTH, 'content-type': 'application/json' },
            payload: { role: '', task: '' },
        });
        expect(res.statusCode).toBe(400);
    });

    it('appends to a session log and reads it back via /sessions/:id', async () => {
        const launch = await app.inject({
            method: 'POST',
            url: '/api/v1/workspace/launch',
            headers: { ...AUTH, 'content-type': 'application/json' },
            payload: { role: 'galabau', task: 'Offer drafting' },
        });
        const launchBody = launch.json() as { id: string };
        const id = launchBody.id;

        const append = await app.inject({
            method: 'POST',
            url: `/api/v1/workspace/sessions/${id}/append`,
            headers: { ...AUTH, 'content-type': 'application/json' },
            payload: { kind: 'host.turn', data: { host_id: 'local', input_tokens: 12 } },
        });
        expect(append.statusCode).toBe(200);

        const read = await app.inject({ method: 'GET', url: `/api/v1/workspace/sessions/${id}`, headers: AUTH });
        expect(read.statusCode).toBe(200);
        const body = read.json() as { log: Array<{ kind: string; data: Record<string, unknown> }> };
        expect(body.log).toHaveLength(2);
        expect(body.log[0]?.kind).toBe('launcher.input');
        expect(body.log[1]?.kind).toBe('host.turn');
    });

    it('returns 404 for an unknown session id', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/workspace/sessions/no-such', headers: AUTH });
        expect(res.statusCode).toBe(404);
    });

    it('lists knowledge chunks from agents/memory/knowledge/<id>/manifest.json', async () => {
        const knowDir = join(tmpPackage, 'agents', 'memory', 'knowledge', '20260525T000000Z');
        mkdirSync(knowDir, { recursive: true });
        writeFileSync(join(knowDir, 'manifest.json'), JSON.stringify({
            documents: [
                { source: '/tmp/a.pdf', excerpt: 'a', pinned: true },
                { source: '/tmp/b.md', excerpt: 'b', pinned: false },
            ],
        }));
        const res = await app.inject({ method: 'GET', url: '/api/v1/workspace/knowledge', headers: AUTH });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { chunks: Array<{ source: string; pinned: boolean }> };
        expect(body.chunks).toHaveLength(2);
        expect(body.chunks[0]?.source).toBe('/tmp/a.pdf');
        expect(body.chunks[0]?.pinned).toBe(true);
    });

    it('lists documents from workspace/documents/<type>/<slug>.md ordered by mtime', async () => {
        const docsDir = join(tmpWrite, 'workspace', 'documents', 'offer');
        mkdirSync(docsDir, { recursive: true });
        writeFileSync(join(docsDir, 'a.md'), '---\ntitle: A\nrole: galabau\n---\n\nbody');
        writeFileSync(join(docsDir, 'b.md'), '---\ntitle: B\nrole: consultant\n---\n\nbody');
        const res = await app.inject({ method: 'GET', url: '/api/v1/workspace/documents', headers: AUTH });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { documents: Array<{ slug: string; title: string; role: string }> };
        expect(body.documents).toHaveLength(2);
        const slugs = body.documents.map((d) => d.slug).sort();
        expect(slugs).toEqual(['a', 'b']);
    });

    it('translates technical vocabulary in plain mode via /workspace/explain', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/workspace/explain',
            headers: { ...AUTH, 'content-type': 'application/json' },
            payload: {
                mode: 'plain',
                body: { source: 'test', explain_text: 'The council ruled this is a stable pack.' },
            },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { text: string; glossary_hits: string[] };
        expect(body.text).toContain('second-opinion check');
        expect(body.text).toContain('ready-made setup');
        expect(body.glossary_hits).toContain('council');
        expect(body.glossary_hits).toContain('pack');
    });

    it('passes technical text through unchanged in technical mode', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/workspace/explain',
            headers: { ...AUTH, 'content-type': 'application/json' },
            payload: {
                mode: 'technical',
                body: { source: 'test', explain_text: 'The council ruled this is a stable pack.' },
            },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { text: string; glossary_hits: string[] };
        expect(body.text).toBe('The council ruled this is a stable pack.');
        expect(body.glossary_hits).toEqual([]);
    });

    it('rejects /workspace/explain with HTTP 400 for an unknown mode', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/workspace/explain',
            headers: { ...AUTH, 'content-type': 'application/json' },
            payload: { mode: 'foobar', body: {} },
        });
        expect(res.statusCode).toBe(400);
    });

    // --- host-tier detection on launch (ADR-068) ---------------------------

    it('launch reports the effective host tier (Tier-3 host → handoff)', async () => {
        const res = await app.inject({
            method: 'POST', url: '/api/v1/workspace/launch',
            headers: { ...AUTH, 'content-type': 'application/json' },
            payload: { role: 'galabau', task: 'offer', host: 'augment' },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as Record<string, unknown>;
        expect(body['id']).toBeTruthy();              // session still recorded
        expect(body['effective_tier']).toBe(3);
        expect(body['mode']).toBe('handoff');
        expect(body['known']).toBe(true);
    });

    it('launch with an unknown host fails soft to Tier 3', async () => {
        const res = await app.inject({
            method: 'POST', url: '/api/v1/workspace/launch',
            headers: { ...AUTH, 'content-type': 'application/json' },
            payload: { role: 'galabau', task: 'offer', host: 'local' },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as Record<string, unknown>;
        expect(body['effective_tier']).toBe(3);
        expect(body['known']).toBe(false);            // unknown → safe handoff default
    });

    // --- Tier-3 inbox (ADR-065) — ships dark behind AGENT_CONFIG_TIER3_INBOX --

    it('inbox is disabled by default (flag off → 404)', async () => {
        delete process.env['AGENT_CONFIG_TIER3_INBOX'];
        const res = await app.inject({
            method: 'POST', url: '/api/v1/workspace/inbox',
            headers: { ...AUTH, 'content-type': 'application/json' },
            payload: { role: 'galabau', task: 'offer', prompt: 'RENDERED' },
        });
        expect(res.statusCode).toBe(404);
    });

    it('inbox write + read round-trips when the flag is on', async () => {
        process.env['AGENT_CONFIG_TIER3_INBOX'] = '1';
        try {
            const write = await app.inject({
                method: 'POST', url: '/api/v1/workspace/inbox',
                headers: { ...AUTH, 'content-type': 'application/json' },
                payload: { role: 'galabau', task: 'offer', prompt: 'RENDERED PROMPT BODY', session: 's1' },
            });
            expect(write.statusCode).toBe(200);
            const { id, banner } = write.json() as { id: string; banner: string };
            expect(id).toBeTruthy();
            expect(banner.toLowerCase()).toContain('copy');

            const read = await app.inject({
                method: 'GET', url: `/api/v1/workspace/inbox/${id}`, headers: AUTH,
            });
            expect(read.statusCode).toBe(200);
            expect((read.json() as { body: string }).body).toContain('RENDERED PROMPT BODY');
        } finally {
            delete process.env['AGENT_CONFIG_TIER3_INBOX'];
        }
    });

    it('inbox write rejects missing fields (400) when enabled', async () => {
        process.env['AGENT_CONFIG_TIER3_INBOX'] = '1';
        try {
            const res = await app.inject({
                method: 'POST', url: '/api/v1/workspace/inbox',
                headers: { ...AUTH, 'content-type': 'application/json' },
                payload: { role: 'galabau' },
            });
            expect(res.statusCode).toBe(400);
        } finally {
            delete process.env['AGENT_CONFIG_TIER3_INBOX'];
        }
    });

    it('inbox write pre-renders a skill_hint into the hand-off (ADR-066)', async () => {
        process.env['AGENT_CONFIG_TIER3_INBOX'] = '1';
        try {
            const write = await app.inject({
                method: 'POST', url: '/api/v1/workspace/inbox',
                headers: { ...AUTH, 'content-type': 'application/json' },
                payload: { role: 'galabau', task: 'offer', prompt: 'Draft an offer.',
                           skill_hint: 'doc-coauthoring' },
            });
            expect(write.statusCode).toBe(200);
            const { id } = write.json() as { id: string };
            const read = await app.inject({
                method: 'GET', url: `/api/v1/workspace/inbox/${id}`, headers: AUTH,
            });
            const body = (read.json() as { body: string }).body;
            expect(body).toContain('Draft an offer.');
            expect(body).toContain('## Skill context: doc-coauthoring');
        } finally {
            delete process.env['AGENT_CONFIG_TIER3_INBOX'];
        }
    });

    it('inbox read of a missing id returns 404 when enabled', async () => {
        process.env['AGENT_CONFIG_TIER3_INBOX'] = '1';
        try {
            const res = await app.inject({
                method: 'GET', url: '/api/v1/workspace/inbox/nope', headers: AUTH,
            });
            expect(res.statusCode).toBe(404);
        } finally {
            delete process.env['AGENT_CONFIG_TIER3_INBOX'];
        }
    });
});

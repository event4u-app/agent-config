/**
 * `/api/v1/workspace/*` — surface contract for the daily-workspace tab
 * in the modern Preact shell.
 *
 * Mirrors the endpoints declared in
 * `docs/contracts/daily-workspace.md` § Endpoints. Each handler reads
 * from the on-disk role / session / knowledge / document layout and
 * returns JSON; no Python subprocess is shelled out. The Python CLI
 * modules in `src/cli/python/workspace_*.py` keep their
 * standalone surface for non-GUI callers but this route is the
 * canonical path the WorkspacePage hits.
 *
 * Storage layout (all under the server's `writeRoot`):
 *   - Sessions: `<writeRoot>/workspace/sessions/<yyyy-mm-dd>/<id>.jsonl`
 *   - Documents: `<writeRoot>/workspace/documents/<type>/<slug>.md`
 *   - Knowledge namespace: `<packageRoot>/agents/memory/knowledge/`
 *
 * Roles live under `<packageRoot>/agents/roles/<slug>/` and are read
 * verbatim — never written from the GUI.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { readdir, readFile, mkdir, writeFile, stat, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import yaml from 'js-yaml';

export interface WorkspaceRouteOptions {
    writeRoot: string;
    packageRoot: string;
    dryRun?: boolean;
}

export interface RoleTask {
    name: string;
    intent: string;
    prompt: string;
}

export interface Role {
    slug: string;
    display_name: string;
    tagline: string;
    status: 'stable' | 'beta' | 'draft' | string;
    recommended_packs: string[];
    install_path_hint: string;
    first_tasks: RoleTask[];
    skills: Array<{ id: string; why: string }>;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseFrontmatter(text: string): { fm: Record<string, unknown>; body: string } {
    const match = FRONTMATTER.exec(text);
    if (match === null) return { fm: {}, body: text };
    const fmText = match[1] ?? '';
    let parsed: unknown;
    try {
        parsed = yaml.load(fmText);
    } catch {
        return { fm: {}, body: text.slice(match[0].length) };
    }
    const fm = (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
        ? (parsed as Record<string, unknown>)
        : {};
    return { fm, body: text.slice(match[0].length) };
}

function firstTasksFromBody(body: string): RoleTask[] {
    // The role-experience contract pins three first tasks as a numbered list
    // under "## Three first tasks". Parse the items along with their
    // `prompts/<name>.md` references for the task picker.
    const out: RoleTask[] = [];
    const section = /## Three first tasks([\s\S]*?)(?:\n## |\n# |$)/.exec(body);
    if (section === null) return out;
    const list = section[1] ?? '';
    // Match item header (number + bold name) and the rest-of-line; the prompt
    // reference is parsed in a second pass so the prompt is optional without
    // collapsing the intent into the empty string.
    const item = /\n\s*\d+\.\s+\*\*([^*]+)\*\*\s*[—-]\s*([^\n]+)/g;
    let m: RegExpExecArray | null;
    while ((m = item.exec(list)) !== null) {
        const name = (m[1] ?? '').trim();
        const rest = (m[2] ?? '').trim();
        const promptMatch = /Prompt:\s*\[`prompts\/([^`]+)`\]/.exec(rest);
        const prompt = promptMatch !== null ? (promptMatch[1] ?? '').trim() : '';
        const intent = (promptMatch !== null ? rest.slice(0, promptMatch.index) : rest).trim().replace(/[.]?\s*$/, '').trim();
        if (name !== '') out.push({ name, intent, prompt });
    }
    return out;
}

function parseSkillsYml(text: string): Array<{ id: string; why: string }> {
    let parsed: unknown;
    try {
        parsed = yaml.load(text);
    } catch {
        return [];
    }
    if (parsed === null || typeof parsed !== 'object') return [];
    const skills = (parsed as Record<string, unknown>)['skills'];
    if (!Array.isArray(skills)) return [];
    const out: Array<{ id: string; why: string }> = [];
    for (const entry of skills) {
        if (entry === null || typeof entry !== 'object') continue;
        const rec = entry as Record<string, unknown>;
        const id = typeof rec['id'] === 'string' ? (rec['id'] as string) : '';
        const why = typeof rec['why'] === 'string' ? (rec['why'] as string) : '';
        if (id !== '') out.push({ id, why });
    }
    return out;
}

async function loadRole(slug: string, packageRoot: string): Promise<Role | null> {
    const root = join(packageRoot, 'agents', 'roles', slug);
    const indexPath = join(root, 'index.md');
    if (!existsSync(indexPath)) return null;
    const indexText = await readFile(indexPath, 'utf8');
    const { fm, body } = parseFrontmatter(indexText);
    const skillsPath = join(root, 'skills.yml');
    const skills = existsSync(skillsPath)
        ? parseSkillsYml(await readFile(skillsPath, 'utf8'))
        : [];

    const recommended = Array.isArray(fm['recommended_packs'])
        ? (fm['recommended_packs'] as unknown[]).filter((v): v is string => typeof v === 'string')
        : [];

    return {
        slug: typeof fm['role'] === 'string' ? (fm['role'] as string) : slug,
        display_name: typeof fm['display_name'] === 'string' ? (fm['display_name'] as string) : slug,
        tagline: typeof fm['tagline'] === 'string' ? (fm['tagline'] as string) : '',
        status: typeof fm['status'] === 'string' ? (fm['status'] as string) : 'draft',
        recommended_packs: recommended,
        install_path_hint: typeof fm['install_path_hint'] === 'string' ? (fm['install_path_hint'] as string) : '',
        first_tasks: firstTasksFromBody(body),
        skills,
    };
}

async function listRoles(packageRoot: string): Promise<Role[]> {
    const rolesDir = join(packageRoot, 'agents', 'roles');
    if (!existsSync(rolesDir)) return [];
    const entries = await readdir(rolesDir, { withFileTypes: true });
    const slugs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort();
    const roles: Role[] = [];
    for (const slug of slugs) {
        const r = await loadRole(slug, packageRoot);
        if (r !== null) roles.push(r);
    }
    return roles;
}

function newSessionId(): string {
    const now = new Date();
    const iso = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const hex = randomBytes(4).toString('hex');
    return `${iso}-${hex}`;
}

function dayDir(writeRoot: string, date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return join(writeRoot, 'workspace', 'sessions', `${y}-${m}-${d}`);
}

interface SessionMeta {
    id: string;
    role: string;
    task: string;
    started_at: string;
    path: string;
}

async function listSessions(writeRoot: string, limit = 20): Promise<SessionMeta[]> {
    const root = join(writeRoot, 'workspace', 'sessions');
    if (!existsSync(root)) return [];
    const days = await readdir(root, { withFileTypes: true });
    const dayDirs = days.filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse();
    const out: SessionMeta[] = [];
    for (const day of dayDirs) {
        const dayPath = join(root, day);
        const files = await readdir(dayPath);
        const jsonl = files.filter((f) => f.endsWith('.jsonl')).sort().reverse();
        for (const f of jsonl) {
            const p = join(dayPath, f);
            const id = basename(f, '.jsonl');
            const first = await peekFirstLine(p);
            const data = first?.data as Record<string, unknown> | undefined;
            out.push({
                id,
                role: typeof data?.['role'] === 'string' ? (data['role'] as string) : '',
                task: typeof data?.['task'] === 'string' ? (data['task'] as string) : '',
                started_at: typeof first?.ts === 'string' ? (first.ts as string) : '',
                path: p,
            });
            if (out.length >= limit) return out;
        }
    }
    return out;
}

interface SessionRecord {
    ts: string;
    kind: string;
    data: unknown;
}

async function peekFirstLine(path: string): Promise<SessionRecord | null> {
    try {
        const text = await readFile(path, 'utf8');
        const nl = text.indexOf('\n');
        const line = nl >= 0 ? text.slice(0, nl) : text;
        if (line.trim() === '') return null;
        return JSON.parse(line) as SessionRecord;
    } catch {
        return null;
    }
}

async function readSessionLog(path: string): Promise<SessionRecord[]> {
    try {
        const text = await readFile(path, 'utf8');
        const lines = text.split('\n').filter((l) => l.trim() !== '');
        const out: SessionRecord[] = [];
        for (const line of lines) {
            try {
                out.push(JSON.parse(line) as SessionRecord);
            } catch {
                // skip malformed line
            }
        }
        return out;
    } catch {
        return [];
    }
}

interface KnowledgeChunk {
    id: string;
    source: string;
    excerpt: string;
    pinned: boolean;
}

async function listKnowledge(packageRoot: string, limit = 50): Promise<KnowledgeChunk[]> {
    const root = join(packageRoot, 'agents', 'memory', 'knowledge');
    if (!existsSync(root)) return [];
    const out: KnowledgeChunk[] = [];
    const ingests = await readdir(root, { withFileTypes: true });
    for (const ing of ingests) {
        if (!ing.isDirectory()) continue;
        const manifestPath = join(root, ing.name, 'manifest.json');
        if (!existsSync(manifestPath)) continue;
        try {
            const raw = await readFile(manifestPath, 'utf8');
            const manifest = JSON.parse(raw) as { documents?: Array<{ source?: string; excerpt?: string; pinned?: boolean }> };
            const docs = manifest.documents ?? [];
            for (const d of docs) {
                out.push({
                    id: `${ing.name}:${out.length}`,
                    source: typeof d.source === 'string' ? d.source : '',
                    excerpt: typeof d.excerpt === 'string' ? d.excerpt : '',
                    pinned: d.pinned === true,
                });
                if (out.length >= limit) return out;
            }
        } catch {
            // skip malformed manifest
        }
    }
    return out;
}

interface DocumentSummary {
    type: string;
    slug: string;
    title: string;
    role: string;
    updated_at: string;
    path: string;
}

async function listDocuments(writeRoot: string, limit = 20): Promise<DocumentSummary[]> {
    const root = join(writeRoot, 'workspace', 'documents');
    if (!existsSync(root)) return [];
    const out: DocumentSummary[] = [];
    const types = await readdir(root, { withFileTypes: true });
    for (const t of types) {
        if (!t.isDirectory()) continue;
        const typeDir = join(root, t.name);
        const files = await readdir(typeDir);
        for (const f of files) {
            if (!f.endsWith('.md') || f.endsWith('.history.jsonl')) continue;
            const p = join(typeDir, f);
            const text = await readFile(p, 'utf8').catch(() => '');
            const { fm } = parseFrontmatter(text);
            const s = await stat(p);
            out.push({
                type: t.name,
                slug: basename(f, '.md'),
                title: typeof fm['title'] === 'string' ? (fm['title'] as string) : basename(f, '.md'),
                role: typeof fm['role'] === 'string' ? (fm['role'] as string) : '',
                updated_at: s.mtime.toISOString(),
                path: p,
            });
        }
    }
    out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return out.slice(0, limit);
}

interface ExplainPayload {
    mode: 'plain' | 'technical';
    role?: string;
    body: { source: string; confidence?: string; freshness?: string; explain_text?: string };
}

const GLOSSARY: Record<string, { plain: string; technical: string }> = {
    'council': { plain: 'second-opinion check', technical: 'AI council deliberation' },
    'trust': { plain: 'reliability score', technical: 'trust-level enum (core/community/etc.)' },
    'pack': { plain: 'ready-made setup', technical: 'install pack manifest' },
    'orchestration': { plain: 'multi-step workflow', technical: 'orchestrated command graph' },
    'contract': { plain: 'guarantee', technical: 'contract document under docs/contracts/' },
    'advisory': { plain: 'recommendation', technical: 'advisory-tier output' },
};

function renderExplain(payload: ExplainPayload): { text: string; glossary_hits: string[] } {
    const text = payload.body.explain_text ?? '';
    if (payload.mode === 'technical') return { text, glossary_hits: [] };
    let translated = text;
    const hits: string[] = [];
    for (const [tech, mapping] of Object.entries(GLOSSARY)) {
        const re = new RegExp(`\\b${tech}\\b`, 'gi');
        if (re.test(translated)) {
            hits.push(tech);
            translated = translated.replace(re, mapping.plain);
        }
    }
    return { text: translated, glossary_hits: hits };
}

export function workspaceRoute(opts: WorkspaceRouteOptions): FastifyPluginAsync {
    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/workspace/roles', async () => {
            const roles = await listRoles(opts.packageRoot);
            return { roles };
        });

        app.get('/api/v1/workspace/roles/:role/tasks', async (request, reply) => {
            const params = request.params as { role: string };
            const r = await loadRole(params.role, opts.packageRoot);
            if (r === null) {
                await reply.code(404).send({ error: 'role not found', slug: params.role });
                return reply;
            }
            return { role: r.slug, tasks: r.first_tasks, skills: r.skills };
        });

        app.get('/api/v1/workspace/sessions', async (request) => {
            const query = request.query as Record<string, unknown> | undefined;
            const limit = typeof query?.['limit'] === 'string' ? parseInt(query['limit'], 10) : 20;
            const sessions = await listSessions(opts.writeRoot, Number.isFinite(limit) ? limit : 20);
            return { sessions };
        });

        app.get('/api/v1/workspace/sessions/:id', async (request, reply) => {
            const params = request.params as { id: string };
            const sessions = await listSessions(opts.writeRoot, 200);
            const found = sessions.find((s) => s.id === params.id);
            if (found === undefined) {
                await reply.code(404).send({ error: 'session not found', id: params.id });
                return reply;
            }
            const log = await readSessionLog(found.path);
            return { id: found.id, role: found.role, task: found.task, log };
        });

        app.post('/api/v1/workspace/launch', async (request, reply) => {
            const body = request.body as Record<string, unknown> | undefined;
            const role = typeof body?.['role'] === 'string' ? (body['role'] as string) : '';
            const task = typeof body?.['task'] === 'string' ? (body['task'] as string) : '';
            const host = typeof body?.['host'] === 'string' ? (body['host'] as string) : 'local';
            if (role === '' || task === '') {
                await reply.code(400).send({ error: 'role and task are required' });
                return reply;
            }
            const id = newSessionId();
            if (opts.dryRun !== true) {
                const dir = dayDir(opts.writeRoot);
                await mkdir(dir, { recursive: true });
                const path = join(dir, `${id}.jsonl`);
                const record: SessionRecord = {
                    ts: new Date().toISOString(),
                    kind: 'launcher.input',
                    data: { role, task, host_tier: 'tier-1', host_id: host },
                };
                await writeFile(path, `${JSON.stringify(record)}\n`, 'utf8');
            }
            return { id, role, task, host, dryRun: opts.dryRun === true };
        });

        app.post('/api/v1/workspace/sessions/:id/append', async (request, reply) => {
            const params = request.params as { id: string };
            const body = request.body as Record<string, unknown> | undefined;
            const kind = typeof body?.['kind'] === 'string' ? (body['kind'] as string) : '';
            const data = body?.['data'] ?? {};
            if (kind === '') {
                await reply.code(400).send({ error: 'kind is required' });
                return reply;
            }
            const sessions = await listSessions(opts.writeRoot, 200);
            const found = sessions.find((s) => s.id === params.id);
            if (found === undefined) {
                await reply.code(404).send({ error: 'session not found', id: params.id });
                return reply;
            }
            const record: SessionRecord = { ts: new Date().toISOString(), kind, data };
            if (opts.dryRun !== true) {
                await appendFile(found.path, `${JSON.stringify(record)}\n`, 'utf8');
            }
            return { id: params.id, appended: record, dryRun: opts.dryRun === true };
        });

        app.get('/api/v1/workspace/knowledge', async (request) => {
            const query = request.query as Record<string, unknown> | undefined;
            const limit = typeof query?.['limit'] === 'string' ? parseInt(query['limit'], 10) : 50;
            const chunks = await listKnowledge(opts.packageRoot, Number.isFinite(limit) ? limit : 50);
            return { chunks };
        });

        app.get('/api/v1/workspace/documents', async (request) => {
            const query = request.query as Record<string, unknown> | undefined;
            const limit = typeof query?.['limit'] === 'string' ? parseInt(query['limit'], 10) : 20;
            const documents = await listDocuments(opts.writeRoot, Number.isFinite(limit) ? limit : 20);
            return { documents };
        });

        app.post('/api/v1/workspace/explain', async (request, reply) => {
            const body = request.body as ExplainPayload | undefined;
            if (body === undefined || (body.mode !== 'plain' && body.mode !== 'technical')) {
                await reply.code(400).send({ error: 'mode must be "plain" or "technical"' });
                return reply;
            }
            const rendered = renderExplain(body);
            return { mode: body.mode, ...rendered };
        });
    };
    return plugin;
}

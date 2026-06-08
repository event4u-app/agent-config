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
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import yaml from 'js-yaml';

const execFileAsync = promisify(execFile);

// Python-authoritative document read path (ADR-062 Part B, Option 4). When
// encrypt-at-rest is on, document bodies live as AES-256-GCM `.md.enc` files
// the Node runtime must not decrypt itself — so the recent-documents rail
// reads through the Python store CLI, which owns encryption. The script is
// resolved from THIS server source tree (never the content packageRoot), so
// it resolves identically in tests and in an installed consumer.
const WORKSPACE_DOCS_CLI = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', 'cli', 'python', 'workspace_documents.py',
);

// Sessions are also Python-authoritative (ADR-064 store 3b). They are
// per-record encrypted when the flag is on, so Node never reads/writes the
// JSONL directly — every session op routes through this CLI, which owns
// encryption (uniform, like documents; session appends are human-turn-paced
// so the per-op subprocess cost is imperceptible). `--root` is always
// `<writeRoot>/workspace/sessions`, which the CLI validates.
const WORKSPACE_SESSIONS_CLI = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', 'cli', 'python', 'workspace_sessions.py',
);

function sessionsRoot(writeRoot: string): string {
    return join(writeRoot, 'workspace', 'sessions');
}

// Tier-3 host hand-off inbox (ADR-023 Tier 3 / ADR-065). Plaintext, ephemeral,
// Python-authoritative. Ships dark behind AGENT_CONFIG_TIER3_INBOX (default
// off) until the hand-off UX is validated.
const WORKSPACE_INBOX_CLI = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', 'cli', 'python', 'workspace_inbox.py',
);

function inboxRoot(writeRoot: string): string {
    return join(writeRoot, 'workspace', 'inbox');
}

// Host-tier detection (ADR-068). Side-effect-free (PATH probe only). launch
// reports the effective tier so the caller knows whether the host is CLI-
// drivable (Tier 1) or needs the inbox hand-off (Tier 3). The Tier-1 drive
// loop is unbuilt — launch reports the tier, it does not claim a drive.
const WORKSPACE_HOSTS_CLI = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', 'cli', 'python', 'workspace_hosts.py',
);

// Role-prompt placeholder rendering (ADR-069). Python-authoritative + pure:
// it fills `{{name}}` placeholders from caller inputs and returns the
// `skill_hint` for the caller to act on — it never appends a skill body
// (the inbox owns that, ADR-066). Reads role prompts from the read-only
// `<packageRoot>/agents/roles` tree, never the write root.
const WORKSPACE_RENDER_CLI = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', 'cli', 'python', 'workspace_render.py',
);

function rolesRoot(packageRoot: string): string {
    return join(packageRoot, 'agents', 'roles');
}

// Tier-1 drive executor (ADR-070). On a tier-1 launch the server renders the
// task prompt, drives one host turn via this CLI, and records the result.
// Single-turn, fail-closed: any drive failure becomes a host.error record +
// (best-effort) a Tier-3 inbox hand-off so the user is never stuck.
const WORKSPACE_DRIVE_CLI = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', 'cli', 'python', 'workspace_drive.py',
);

interface HostTier {
    effective_tier: number;
    cli_present: boolean;
    known: boolean;
    mode: string;
}

// --- launch-drive orchestration helpers (ADR-070 PR-2) ---------------------

// Append one event to the session store (Python-authoritative, encrypted when
// the flag is on). Best-effort: a launch must still respond even if the append
// fails — the failure is logged, never thrown into the response path.
async function appendSession(writeRoot: string, id: string, kind: string, data: unknown): Promise<boolean> {
    try {
        await execFileAsync(
            'python3',
            [WORKSPACE_SESSIONS_CLI, 'append', id, '--kind', kind,
             '--data-json', JSON.stringify(data), '--root', sessionsRoot(writeRoot)],
            { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 },
        );
        return true;
    } catch {
        return false;
    }
}

// Render a task prompt (ADR-069) → {rendered, skill_hint} or {error}. Inputs
// flow via a temp JSON file (values can be multi-line). A missing-required /
// undeclared-placeholder error is returned, never thrown.
async function renderTaskPrompt(
    packageRoot: string, writeRoot: string, role: string, promptName: string, inputs: Record<string, unknown>,
): Promise<{ rendered: string; skill_hint: string | null } | { error: string }> {
    await mkdir(join(writeRoot, 'workspace'), { recursive: true });
    const tmp = join(writeRoot, 'workspace', `.launch-render-${randomUUID()}.json`);
    await writeFile(tmp, JSON.stringify(inputs), 'utf8');
    try {
        const { stdout } = await execFileAsync(
            'python3',
            [WORKSPACE_RENDER_CLI, 'render', '--role', role, '--prompt', promptName,
             '--inputs-json', tmp, '--root', rolesRoot(packageRoot), '--json'],
            { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 },
        );
        return JSON.parse(stdout) as { rendered: string; skill_hint: string | null };
    } catch (err) {
        return { error: ((err as { stderr?: string }).stderr ?? 'render failed').trim() };
    } finally {
        await rm(tmp, { force: true });
    }
}

// Drive one Tier-1 host turn (ADR-070). Returns the uniform turn record
// (`ok:true` or `ok:false` with `error_kind`). The CLI prints the turn JSON on
// stdout for both outcomes (exit 1 on failure) — capture stdout either way.
async function driveHostTurn(writeRoot: string, host: string, rendered: string): Promise<Record<string, unknown>> {
    await mkdir(join(writeRoot, 'workspace'), { recursive: true });
    const tmp = join(writeRoot, 'workspace', `.launch-drive-${randomUUID()}.md`);
    await writeFile(tmp, rendered, 'utf8');
    try {
        let stdout: string;
        try {
            ({ stdout } = await execFileAsync(
                'python3',
                [WORKSPACE_DRIVE_CLI, 'drive', '--host', host, '--prompt-file', tmp, '--json'],
                { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
            ));
        } catch (err) {
            stdout = (err as { stdout?: string }).stdout ?? '';
        }
        if (stdout.trim() === '') return { ok: false, host, error: 'no drive output', error_kind: 'spawn-failed' };
        return JSON.parse(stdout) as Record<string, unknown>;
    } finally {
        await rm(tmp, { force: true });
    }
}

// Best-effort Tier-3 inbox hand-off when driving is unavailable / failed. Only
// writes when the flag is on; never throws into the response path.
async function degradeToInbox(
    writeRoot: string, role: string, task: string, rendered: string, skillHint: string | null,
): Promise<string | null> {
    if (!tier3InboxEnabled()) return null;
    await mkdir(inboxRoot(writeRoot), { recursive: true });
    const tmp = join(inboxRoot(writeRoot), `.launch-handoff-${randomUUID()}.tmp`);
    await writeFile(tmp, rendered, 'utf8');
    try {
        const { stdout } = await execFileAsync(
            'python3',
            [WORKSPACE_INBOX_CLI, 'write', '--role', role, '--task', task, '--body-file', tmp,
             ...(skillHint ? ['--skill-hint', skillHint] : []), '--root', inboxRoot(writeRoot)],
            { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 },
        );
        const res = JSON.parse(stdout) as { path?: string };
        return res.path ?? null;
    } catch {
        return null;
    }
}

// Resolve a task name → its prompt file basename (sans .md) from the role's
// "Three first tasks" list. Null when the task has no prompt mapping.
function promptNameForTask(role: Role, task: string): string | null {
    const match = role.first_tasks.find((t) => t.name === task);
    if (match === undefined || match.prompt === '') return null;
    return match.prompt.replace(/\.md$/, '');
}

async function detectHostTier(host: string): Promise<HostTier> {
    try {
        const { stdout } = await execFileAsync(
            'python3', [WORKSPACE_HOSTS_CLI, 'detect', host, '--json'],
            { timeout: 5_000 },
        );
        const r = JSON.parse(stdout) as Record<string, unknown>;
        return {
            effective_tier: typeof r['effective_tier'] === 'number' ? (r['effective_tier'] as number) : 3,
            cli_present: r['cli_present'] === true,
            known: r['known'] === true,
            mode: typeof r['mode'] === 'string' ? (r['mode'] as string) : 'handoff',
        };
    } catch {
        // Detector unavailable → safe default: treat as Tier-3 hand-off.
        return { effective_tier: 3, cli_present: false, known: false, mode: 'handoff' };
    }
}

function tier3InboxEnabled(): boolean {
    const v = (process.env['AGENT_CONFIG_TIER3_INBOX'] ?? '').trim().toLowerCase();
    return v !== '' && v !== '0' && v !== 'false' && v !== 'off';
}

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

interface SessionMeta {
    id: string;
    role: string;
    task: string;
    started_at: string;
}

interface SessionRecord {
    ts: string;
    kind: string;
    data: unknown;
}

// Python-authoritative session reads (ADR-064 store 3b): the store CLI
// returns decrypted records whether the JSONL is plaintext or per-record
// encrypted. A spawn failure degrades to an empty result rather than 500.
async function listSessions(writeRoot: string, limit = 20): Promise<SessionMeta[]> {
    if (!existsSync(sessionsRoot(writeRoot))) return [];
    try {
        const { stdout } = await execFileAsync(
            'python3',
            [WORKSPACE_SESSIONS_CLI, 'list', '--json',
             '--root', sessionsRoot(writeRoot), '--limit', String(limit)],
            { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 },
        );
        const rows = JSON.parse(stdout || '[]') as Array<Record<string, unknown>>;
        return rows.map((r) => ({
            id: typeof r['session_id'] === 'string' ? (r['session_id'] as string) : '',
            role: typeof r['role'] === 'string' ? (r['role'] as string) : '',
            task: typeof r['task'] === 'string' ? (r['task'] as string) : '',
            started_at: typeof r['started_at'] === 'string' ? (r['started_at'] as string) : '',
        }));
    } catch {
        return [];
    }
}

async function readSessionLog(writeRoot: string, id: string): Promise<SessionRecord[]> {
    try {
        const { stdout } = await execFileAsync(
            'python3',
            [WORKSPACE_SESSIONS_CLI, 'read', id, '--json', '--root', sessionsRoot(writeRoot)],
            { timeout: 10_000, maxBuffer: 16 * 1024 * 1024 },
        );
        return JSON.parse(stdout || '[]') as SessionRecord[];
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
    // Python-authoritative read (ADR-062 Part B): the store CLI returns
    // decrypted summaries whether the bodies are plaintext `.md` or encrypted
    // `.md.enc`. A spawn failure (no python3, script error) degrades to an
    // empty rail rather than 500-ing the whole workspace page.
    try {
        const { stdout } = await execFileAsync(
            'python3',
            [WORKSPACE_DOCS_CLI, 'list', '--json', '--root', root, '--limit', String(limit)],
            { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 },
        );
        const rows = JSON.parse(stdout || '[]') as Array<Record<string, unknown>>;
        return rows.map((r) => ({
            type: typeof r['type'] === 'string' ? (r['type'] as string) : '',
            slug: typeof r['slug'] === 'string' ? (r['slug'] as string) : '',
            title: typeof r['title'] === 'string' ? (r['title'] as string) : '',
            role: typeof r['role'] === 'string' ? (r['role'] as string) : '',
            updated_at: typeof r['updated_at'] === 'string' ? (r['updated_at'] as string) : '',
            path: typeof r['path'] === 'string' ? (r['path'] as string) : '',
        }));
    } catch {
        return [];
    }
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
            const log = await readSessionLog(opts.writeRoot, params.id);
            if (log.length === 0) {
                await reply.code(404).send({ error: 'session not found', id: params.id });
                return reply;
            }
            // role/task come from the opening launcher.input record.
            const first = log[0]?.data as Record<string, unknown> | undefined;
            const role = typeof first?.['role'] === 'string' ? (first['role'] as string) : '';
            const task = typeof first?.['task'] === 'string' ? (first['task'] as string) : '';
            return { id: params.id, role, task, log };
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
            // Effective host tier (ADR-068) — informational: Tier 1 = the host
            // is CLI-drivable (drive loop still unbuilt → mode tier1-drive-
            // pending); Tier 3 = use the inbox hand-off (POST /inbox). Detection
            // is side-effect-free; it never drives or spawns the host.
            const inputs = (body?.['inputs'] !== null && typeof body?.['inputs'] === 'object' && !Array.isArray(body?.['inputs']))
                ? (body['inputs'] as Record<string, unknown>)
                : {};
            const tier = await detectHostTier(host);
            if (opts.dryRun === true) {
                return { id: 'dry-run', role, task, host, dryRun: true, driven: false, ...tier };
            }
            // Python-authoritative write (ADR-064): the store CLI owns the
            // session-id minting + per-record encryption when the flag is on.
            // A fresh id per launch → no shared-session append race.
            const { stdout } = await execFileAsync(
                'python3',
                [WORKSPACE_SESSIONS_CLI, 'start', '--role', role, '--task', task,
                 '--host', host, '--root', sessionsRoot(opts.writeRoot)],
                { timeout: 10_000 },
            );
            const id = stdout.trim();
            const base = { id, role, task, host, dryRun: false, ...tier };

            // Tier-1 drive (ADR-070 PR-2). The session header is always written
            // above (backwards-compatible); driving is additive and opt-in:
            // it only happens for a tier-1 host whose task resolves to a prompt.
            const roleObj = await loadRole(role, opts.packageRoot);
            const promptName = roleObj !== null ? promptNameForTask(roleObj, task) : null;
            if (promptName === null) {
                // No prompt for this task — header-only (the legacy contract).
                // Signal explicitly when inputs were supplied but ignored.
                return { ...base, driven: false, reason: 'no-prompt-for-task',
                         ...(Object.keys(inputs).length > 0 ? { ignored_inputs: true } : {}) };
            }

            const r = await renderTaskPrompt(opts.packageRoot, opts.writeRoot, role, promptName, inputs);
            if ('error' in r) {
                await appendSession(opts.writeRoot, id, 'host.error', { error_kind: 'render-error', error: r.error });
                return { ...base, driven: false, error_kind: 'render-error', error: r.error };
            }

            if (tier.effective_tier !== 1) {
                // Tier-3 host → best-effort inbox hand-off (the rendered prompt
                // is what the user pastes); header already records the launch.
                const handoff = await degradeToInbox(opts.writeRoot, role, task, r.rendered, r.skill_hint);
                if (handoff !== null) await appendSession(opts.writeRoot, id, 'inbox.handoff', { path: handoff });
                return { ...base, driven: false, ...(handoff !== null ? { handoff } : {}) };
            }

            const turn = await driveHostTurn(opts.writeRoot, host, r.rendered);
            if (turn['ok'] === true) {
                await appendSession(opts.writeRoot, id, 'host.turn', turn);
                return { ...base, driven: true, turn };
            }
            // Drive failed → record host.error + best-effort inbox degrade.
            await appendSession(opts.writeRoot, id, 'host.error', turn);
            const handoff = await degradeToInbox(opts.writeRoot, role, task, r.rendered, r.skill_hint);
            if (handoff !== null) await appendSession(opts.writeRoot, id, 'inbox.handoff', { path: handoff });
            return { ...base, driven: false, error_kind: turn['error_kind'], error: turn['error'],
                     ...(handoff !== null ? { handoff } : {}) };
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
            if (opts.dryRun === true) {
                return { id: params.id, appended: { kind, data }, dryRun: true };
            }
            // Python-authoritative append (ADR-064): nested data flows verbatim
            // via --data-json (the flat --data k=v cannot carry it). The CLI
            // rejects an unknown kind / missing session with exit 1 → 404.
            try {
                await execFileAsync(
                    'python3',
                    [WORKSPACE_SESSIONS_CLI, 'append', params.id, '--kind', kind,
                     '--data-json', JSON.stringify(data),
                     '--root', sessionsRoot(opts.writeRoot)],
                    { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 },
                );
            } catch {
                await reply.code(404).send({ error: 'session not found or invalid kind', id: params.id });
                return reply;
            }
            return { id: params.id, appended: { kind, data }, dryRun: false };
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

        // Role-prompt rendering (ADR-069). Fills `{{name}}` placeholders from
        // the supplied inputs and returns `{rendered, skill_hint}`. Pure: the
        // skill body is NOT appended here — the caller (inbox hand-off / Tier-1
        // pre-render) decides whether to attach it via the returned hint.
        // A missing required input or an undeclared placeholder → 400.
        app.post('/api/v1/workspace/render', async (request, reply) => {
            const body = request.body as Record<string, unknown> | undefined;
            const role = typeof body?.['role'] === 'string' ? (body['role'] as string) : '';
            const prompt = typeof body?.['prompt'] === 'string' ? (body['prompt'] as string) : '';
            const inputs = (body?.['inputs'] !== null && typeof body?.['inputs'] === 'object' && !Array.isArray(body?.['inputs']))
                ? (body['inputs'] as Record<string, unknown>)
                : {};
            if (role === '' || prompt === '') {
                await reply.code(400).send({ error: 'role and prompt are required' });
                return reply;
            }
            if (opts.dryRun === true) {
                return { role, prompt, rendered: '', skill_hint: null, dryRun: true };
            }
            // Inputs flow via a temp JSON file (mirrors the inbox body-file
            // path) — values can be large / multi-line. The CLI exits 1 on a
            // missing-required / undeclared-placeholder error → surfaced as 400.
            await mkdir(join(opts.writeRoot, 'workspace'), { recursive: true });
            const tmp = join(opts.writeRoot, 'workspace', `.render-${randomUUID()}.json`);
            await writeFile(tmp, JSON.stringify(inputs), 'utf8');
            try {
                const { stdout } = await execFileAsync(
                    'python3',
                    [WORKSPACE_RENDER_CLI, 'render', '--role', role, '--prompt', prompt,
                     '--inputs-json', tmp, '--root', rolesRoot(opts.packageRoot), '--json'],
                    { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 },
                );
                return JSON.parse(stdout) as Record<string, unknown>;
            } catch (err) {
                const stderr = (err as { stderr?: string }).stderr ?? '';
                await reply.code(400).send({ error: stderr.trim() || 'render failed', role, prompt });
                return reply;
            } finally {
                await rm(tmp, { force: true });
            }
        });

        // Tier-3 host hand-off inbox (ADR-065). Ships dark: when the flag is
        // off, the endpoints report disabled rather than write anything.
        app.post('/api/v1/workspace/inbox', async (request, reply) => {
            if (!tier3InboxEnabled()) {
                await reply.code(404).send({ error: 'tier-3 inbox disabled (set AGENT_CONFIG_TIER3_INBOX=1)' });
                return reply;
            }
            const body = request.body as Record<string, unknown> | undefined;
            const role = typeof body?.['role'] === 'string' ? (body['role'] as string) : '';
            const task = typeof body?.['task'] === 'string' ? (body['task'] as string) : '';
            const prompt = typeof body?.['prompt'] === 'string' ? (body['prompt'] as string) : '';
            const session = typeof body?.['session'] === 'string' ? (body['session'] as string) : '';
            const skillHint = typeof body?.['skill_hint'] === 'string' ? (body['skill_hint'] as string) : '';
            if (role === '' || task === '' || prompt === '') {
                await reply.code(400).send({ error: 'role, task and prompt are required' });
                return reply;
            }
            if (opts.dryRun === true) return { id: 'dry-run', dryRun: true };
            // Python-authoritative write. The rendered prompt is passed via a
            // temp body-file (it can be large / multi-line). Tier auto-detection
            // and skill-body pre-rendering are deferred (ADR-065) — the caller
            // supplies the already-rendered prompt.
            const tmp = join(inboxRoot(opts.writeRoot), `.write-${randomUUID()}.tmp`);
            await mkdir(inboxRoot(opts.writeRoot), { recursive: true });
            await writeFile(tmp, prompt, 'utf8');
            try {
                const { stdout } = await execFileAsync(
                    'python3',
                    [WORKSPACE_INBOX_CLI, 'write', '--role', role, '--task', task,
                     '--body-file', tmp, ...(session ? ['--session', session] : []),
                     ...(skillHint ? ['--skill-hint', skillHint] : []),
                     '--root', inboxRoot(opts.writeRoot)],
                    { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 },
                );
                return JSON.parse(stdout) as Record<string, unknown>;
            } finally {
                await rm(tmp, { force: true });
            }
        });

        app.get('/api/v1/workspace/inbox/:id', async (request, reply) => {
            if (!tier3InboxEnabled()) {
                await reply.code(404).send({ error: 'tier-3 inbox disabled' });
                return reply;
            }
            const params = request.params as { id: string };
            try {
                const { stdout } = await execFileAsync(
                    'python3',
                    [WORKSPACE_INBOX_CLI, 'read', params.id, '--root', inboxRoot(opts.writeRoot)],
                    { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 },
                );
                return { id: params.id, body: stdout };
            } catch {
                await reply.code(404).send({ error: 'hand-off not found', id: params.id });
                return reply;
            }
        });
    };
    return plugin;
}

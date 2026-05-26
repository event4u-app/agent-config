/**
 * WorkspacePage — daily-workspace surface for the modern Preact shell.
 *
 * Renders the v0 floor pinned in
 * `docs/contracts/daily-workspace.md` § Shape (v0) plus the deferred
 * wires this roadmap (`road-to-frictionless-employee-workspace.md`)
 * closes: knowledge citations rail, recent-documents rail, and the
 * plain-explain toggle.
 *
 * Layout: role-grid (left) · task picker + session strip (centre) ·
 * right-rail (knowledge / recent-docs / plain-explain). The page
 * starts in "pick a role" mode; selecting a role surfaces its three
 * first tasks (from `agents/roles/<slug>/index.md`) and the priority
 * skill shortlist. Clicking a task POSTs `/workspace/launch` which
 * writes the session JSONL header — the host-agent turn loop is
 * outside scope (Tier 1 handoff per ADR-023).
 *
 * Hard cuts honoured from Phase A scope:
 *   - No cross-role switching at runtime (lives in Phase B Step 5).
 *   - No live agent reply rendering (host-agent conversation event
 *     surface from ADR-023 Tier 1 is its own substrate).
 *
 * Session strip lists the 20 most-recent sessions across all days.
 * Knowledge + recent-docs panels degrade gracefully when their
 * sources are empty (shows the contract's "no sources yet" state).
 */

import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { apiFetch, ApiCallError } from '../api.js';

interface RoleTask {
    name: string;
    intent: string;
    prompt: string;
}

interface Role {
    slug: string;
    display_name: string;
    tagline: string;
    status: string;
    recommended_packs: string[];
    first_tasks: RoleTask[];
    skills: Array<{ id: string; why: string }>;
}

interface SessionMeta {
    id: string;
    role: string;
    task: string;
    started_at: string;
}

interface KnowledgeChunk {
    id: string;
    source: string;
    excerpt: string;
    pinned: boolean;
}

interface DocumentSummary {
    type: string;
    slug: string;
    title: string;
    role: string;
    updated_at: string;
}

type ExplainMode = 'plain' | 'technical';

const roles = signal<Role[]>([]);
const sessions = signal<SessionMeta[]>([]);
const knowledge = signal<KnowledgeChunk[]>([]);
const recentDocs = signal<DocumentSummary[]>([]);
const selectedRole = signal<string | null>(null);
const loaded = signal(false);
const loadError = signal<string | null>(null);
const launchBanner = signal<string | null>(null);
const explainMode = signal<ExplainMode>('plain');

async function load(): Promise<void> {
    loadError.value = null;
    try {
        const [r, s, k, d] = await Promise.all([
            apiFetch<{ roles: Role[] }>('/api/v1/workspace/roles'),
            apiFetch<{ sessions: SessionMeta[] }>('/api/v1/workspace/sessions?limit=20'),
            apiFetch<{ chunks: KnowledgeChunk[] }>('/api/v1/workspace/knowledge?limit=20'),
            apiFetch<{ documents: DocumentSummary[] }>('/api/v1/workspace/documents?limit=20'),
        ]);
        roles.value = r.roles;
        sessions.value = s.sessions;
        knowledge.value = k.chunks;
        recentDocs.value = d.documents;
        loaded.value = true;
    } catch (err) {
        if (err instanceof ApiCallError) {
            loadError.value = err.body?.error?.message ?? err.message;
        } else {
            loadError.value = err instanceof Error ? err.message : String(err);
        }
    }
}

async function launch(role: string, task: string): Promise<void> {
    launchBanner.value = null;
    try {
        const res = await apiFetch<{ id: string; role: string; task: string }>(
            '/api/v1/workspace/launch',
            { method: 'POST', body: { role, task, host: 'local' } },
        );
        launchBanner.value = `Started session ${res.id} (${res.role} · ${res.task}).`;
        const s = await apiFetch<{ sessions: SessionMeta[] }>('/api/v1/workspace/sessions?limit=20');
        sessions.value = s.sessions;
    } catch (err) {
        if (err instanceof ApiCallError) {
            launchBanner.value = err.body?.error?.message ?? err.message;
        } else {
            launchBanner.value = err instanceof Error ? err.message : String(err);
        }
    }
}

function RoleCard({ role }: { role: Role }): preact.JSX.Element {
    const active = selectedRole.value === role.slug;
    // Cross-role switching (Phase B Step 5): clicking a different role
    // while a role is already selected swaps the task picker; the
    // session strip stays intact (per-user sessions span roles).
    return (
        <button
            type="button"
            class={`ac-workspace__role${active ? ' ac-workspace__role--active' : ''}`}
            aria-current={active ? 'true' : undefined}
            aria-label={`Pick role ${role.display_name}`}
            onClick={(): void => {
                selectedRole.value = role.slug;
                launchBanner.value = null;
            }}
        >
            <span class="ac-workspace__role-name">{role.display_name}</span>
            <span class="ac-workspace__role-status" data-status={role.status}>{role.status}</span>
            <span class="ac-workspace__role-tagline">{role.tagline}</span>
        </button>
    );
}

function TaskPicker({ role }: { role: Role }): preact.JSX.Element {
    return (
        <section class="ac-workspace__tasks" aria-labelledby="task-heading">
            <h2 id="task-heading" class="ac-workspace__heading">First tasks · {role.display_name}</h2>
            {role.first_tasks.length === 0 ? (
                <p class="ac-workspace__empty">No tasks scaffolded yet for this role.</p>
            ) : (
                <ul class="ac-workspace__task-list">
                    {role.first_tasks.map((t) => (
                        <li key={t.name} class="ac-workspace__task">
                            <div class="ac-workspace__task-head">
                                <span class="ac-workspace__task-name">{t.name}</span>
                                <button
                                    type="button"
                                    class="ac-button ac-button--primary"
                                    onClick={(): void => { void launch(role.slug, t.name); }}
                                >
                                    Start session
                                </button>
                            </div>
                            <p class="ac-workspace__task-intent">{t.intent}</p>
                            {t.prompt !== '' ? (
                                <code class="ac-workspace__task-prompt">prompts/{t.prompt}</code>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
            {role.skills.length > 0 ? (
                <details class="ac-workspace__skills">
                    <summary>Skill shortlist ({role.skills.length})</summary>
                    <ul class="ac-workspace__skill-list">
                        {role.skills.slice(0, 5).map((s) => (
                            <li key={s.id} class="ac-workspace__skill"><code>{s.id}</code> — {s.why}</li>
                        ))}
                        {role.skills.length > 5 ? (
                            <li class="ac-workspace__skill-more">+ {role.skills.length - 5} more</li>
                        ) : null}
                    </ul>
                </details>
            ) : null}
        </section>
    );
}

function SessionStrip(): preact.JSX.Element {
    return (
        <section class="ac-workspace__sessions" aria-labelledby="sessions-heading">
            <h2 id="sessions-heading" class="ac-workspace__heading">Recent sessions</h2>
            {sessions.value.length === 0 ? (
                <p class="ac-workspace__empty">No sessions yet — pick a role and start one.</p>
            ) : (
                <ul class="ac-workspace__session-list">
                    {sessions.value.map((s) => (
                        <li key={s.id} class="ac-workspace__session">
                            <span class="ac-workspace__session-id">{s.id.slice(0, 16)}</span>
                            <span class="ac-workspace__session-role">{s.role}</span>
                            <span class="ac-workspace__session-task">{s.task}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function KnowledgePane(): preact.JSX.Element {
    return (
        <section class="ac-workspace__knowledge" aria-labelledby="knowledge-heading">
            <h2 id="knowledge-heading" class="ac-workspace__heading">Knowledge sources</h2>
            {knowledge.value.length === 0 ? (
                <p class="ac-workspace__empty">No sources yet. Run <code>/knowledge:ingest &lt;path&gt;</code> to add documents.</p>
            ) : (
                <ol class="ac-workspace__citation-list">
                    {knowledge.value.map((c, idx) => (
                        <li key={c.id} class="ac-workspace__citation">
                            <span class="ac-workspace__citation-marker" aria-label={`Citation ${idx + 1}`}>[{idx + 1}]</span>
                            <a
                                href={`file://${c.source}`}
                                class="ac-workspace__citation-source"
                                title="Open source in OS default app"
                            >
                                {c.source.split('/').pop() ?? c.source}
                            </a>
                            {c.pinned ? <span class="ac-workspace__citation-pin" aria-label="pinned">★</span> : null}
                            <p class="ac-workspace__citation-excerpt">{c.excerpt.slice(0, 200)}{c.excerpt.length > 200 ? '…' : ''}</p>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

function RecentDocs(): preact.JSX.Element {
    return (
        <section class="ac-workspace__recent" aria-labelledby="recent-heading">
            <h2 id="recent-heading" class="ac-workspace__heading">Recent documents</h2>
            {recentDocs.value.length === 0 ? (
                <p class="ac-workspace__empty">No documents yet. Saved drafts land here.</p>
            ) : (
                <ul class="ac-workspace__doc-list">
                    {recentDocs.value.map((d) => (
                        <li key={`${d.type}/${d.slug}`} class="ac-workspace__doc">
                            <span class="ac-workspace__doc-type" data-type={d.type}>{d.type}</span>
                            <span class="ac-workspace__doc-title">{d.title}</span>
                            <time class="ac-workspace__doc-time" dateTime={d.updated_at}>
                                {d.updated_at.slice(0, 10)}
                            </time>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function ExplainToggle(): preact.JSX.Element {
    const mode = explainMode.value;
    return (
        <fieldset class="ac-workspace__explain">
            <legend class="ac-workspace__heading">Explanation style</legend>
            <label class="ac-workspace__explain-option">
                <input
                    type="radio"
                    name="explain-mode"
                    value="plain"
                    checked={mode === 'plain'}
                    onChange={(): void => { explainMode.value = 'plain'; }}
                    aria-label="Plain language"
                />
                <span>Plain language</span>
            </label>
            <label class="ac-workspace__explain-option">
                <input
                    type="radio"
                    name="explain-mode"
                    value="technical"
                    checked={mode === 'technical'}
                    onChange={(): void => { explainMode.value = 'technical'; }}
                    aria-label="Technical detail"
                />
                <span>Technical detail</span>
            </label>
            <p class="ac-workspace__explain-hint">
                {mode === 'plain'
                    ? 'Replies use everyday words. Toggle to see the technical view.'
                    : 'Replies keep the technical vocabulary. Toggle for the plain view.'}
            </p>
        </fieldset>
    );
}

export function WorkspacePage(): preact.JSX.Element {
    useEffect(() => { void load(); }, []);

    if (loadError.value !== null) {
        return (
            <div class="ac-page ac-page--error">
                <h1>Workspace</h1>
                <p class="ac-banner ac-banner--error">{loadError.value}</p>
            </div>
        );
    }
    if (!loaded.value) {
        return (
            <div class="ac-page">
                <h1>Workspace</h1>
                <p>Loading…</p>
            </div>
        );
    }

    const role = selectedRole.value !== null
        ? roles.value.find((r) => r.slug === selectedRole.value) ?? null
        : null;

    return (
        <div class="ac-page ac-workspace">
            <header class="ac-page__header">
                <h1>Workspace</h1>
                <p class="ac-page__subtitle">
                    Pick a role, pick a first task, run it.
                </p>
            </header>
            {launchBanner.value !== null
                ? <p class="ac-banner" role="status">{launchBanner.value}</p>
                : null}
            <div class="ac-workspace__grid">
                <section class="ac-workspace__roles" aria-labelledby="roles-heading">
                    <h2 id="roles-heading" class="ac-workspace__heading">Roles</h2>
                    {roles.value.length === 0 ? (
                        <p class="ac-workspace__empty">No roles installed.</p>
                    ) : (
                        <div class="ac-workspace__role-grid">
                            {roles.value.map((r) => <RoleCard key={r.slug} role={r} />)}
                        </div>
                    )}
                </section>
                <main class="ac-workspace__main" aria-label="Tasks and sessions">
                    {role !== null ? <TaskPicker role={role} /> : (
                        <p class="ac-workspace__empty">Pick a role on the left to see its first tasks.</p>
                    )}
                    <SessionStrip />
                </main>
                <aside class="ac-workspace__rail" aria-label="Knowledge and documents">
                    <KnowledgePane />
                    <RecentDocs />
                    <ExplainToggle />
                </aside>
            </div>
        </div>
    );
}

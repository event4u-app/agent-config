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

interface PromptInput {
    name: string;
    required: boolean;
    shape: string;
}

interface RoleTask {
    name: string;
    intent: string;
    prompt: string;
    inputs?: PromptInput[];
    skill_hint?: string | null;
}

interface DrivenTurn {
    text: string;
    model?: string | null;
    usage?: { input_tokens?: number; output_tokens?: number } | null;
}

// Shape of a /workspace/launch response (ADR-071/074). Only `driven` is always
// present; the rest are outcome-specific.
interface LaunchResult {
    id: string;
    role: string;
    task: string;
    driven: boolean;
    turn?: DrivenTurn;
    reason?: string;
    error_kind?: string;
    error?: string;
    handoff?: string;
    host_killed?: boolean;
    recovered?: boolean;
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
// Drive integration (ADR-075). Tasks-with-input-specs for the selected role,
// the inline form's open task + field values, the in-flight flag, and the last
// driven turn / outcome.
const selectedTasks = signal<RoleTask[]>([]);
const openTask = signal<string | null>(null);
const formInputs = signal<Record<string, string>>({});
const launching = signal(false);
const launchResult = signal<LaunchResult | null>(null);
const showFullTurn = signal(false);

const DRIVE_HOST = 'claude-code';      // v0: single hard-coded tier-1 host (council)
const TURN_COLLAPSE_CHARS = 2000;      // collapse long turns behind "Show full"

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

// Fetch the selected role's tasks WITH their prompt input specs (ADR-075) so
// the inline form can be built. Falls back to the role's embedded first_tasks
// (no input specs) if the fetch fails.
async function loadTasks(slug: string, fallback: RoleTask[]): Promise<void> {
    try {
        const res = await apiFetch<{ tasks: RoleTask[] }>(`/api/v1/workspace/roles/${slug}/tasks`);
        selectedTasks.value = res.tasks;
    } catch {
        selectedTasks.value = fallback;
    }
}

async function launch(role: string, task: string, inputs: Record<string, string>): Promise<void> {
    launchBanner.value = null;
    launching.value = true;
    showFullTurn.value = false;
    try {
        const res = await apiFetch<LaunchResult>(
            '/api/v1/workspace/launch',
            { method: 'POST', body: { role, task, inputs, host: DRIVE_HOST } },
        );
        launchResult.value = res;
        launchBanner.value = bannerFor(res);
        openTask.value = null;                 // collapse the form on a completed launch
        const s = await apiFetch<{ sessions: SessionMeta[] }>('/api/v1/workspace/sessions?limit=20');
        sessions.value = s.sessions;
    } catch (err) {
        launchResult.value = null;
        if (err instanceof ApiCallError) {
            launchBanner.value = err.body?.error?.message ?? err.message;
        } else {
            launchBanner.value = err instanceof Error ? err.message : String(err);
        }
    } finally {
        launching.value = false;
    }
}

// One human-readable banner per launch outcome (ADR-071/074).
function bannerFor(r: LaunchResult): string {
    if (r.driven) {
        return r.recovered === true
            ? `Host recovered — drove the turn for ${r.role} · ${r.task}.`
            : `Drove the turn for ${r.role} · ${r.task}.`;
    }
    if (r.host_killed === true) {
        return `Host ${DRIVE_HOST} is paused after repeated failures — handed off to the inbox.`;
    }
    if (r.error_kind === 'render-error') {
        return `Couldn't fill the prompt: ${r.error ?? 'missing input'}.`;
    }
    if (r.reason === 'no-prompt-for-task') {
        return `Recorded the session — this task has no runnable prompt yet.`;
    }
    if (typeof r.handoff === 'string') {
        return `Prepared a hand-off — open ${r.handoff} and paste it into your host.`;
    }
    return `Recorded the session ${r.id} (${r.role} · ${r.task}).`;
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
                launchResult.value = null;
                openTask.value = null;
                formInputs.value = {};
                selectedTasks.value = role.first_tasks;   // immediate; refined with input specs
                void loadTasks(role.slug, role.first_tasks);
            }}
        >
            <span class="ac-workspace__role-name">{role.display_name}</span>
            <span class="ac-workspace__role-status" data-status={role.status}>{role.status}</span>
            <span class="ac-workspace__role-tagline">{role.tagline}</span>
        </button>
    );
}

// Inline input form for one task (ADR-075): one field per declared prompt
// input, required marked, `shape` as the placeholder hint. Submit drives.
function TaskForm({ role, task }: { role: string; task: RoleTask }): preact.JSX.Element {
    const specs = task.inputs ?? [];
    const values = formInputs.value;
    const missingRequired = specs.some((s) => s.required && (values[s.name] ?? '').trim() === '');
    return (
        <form
            class="ac-workspace__task-form"
            onSubmit={(e): void => {
                e.preventDefault();
                if (!missingRequired && !launching.value) void launch(role, task.name, formInputs.value);
            }}
        >
            {specs.length === 0 ? (
                <p class="ac-workspace__form-note">No inputs — runs the prompt as-is.</p>
            ) : specs.map((s) => (
                <label key={s.name} class="ac-workspace__field">
                    <span class="ac-workspace__field-label">
                        {s.name}{s.required ? <span class="ac-workspace__req" aria-hidden="true"> *</span> : null}
                    </span>
                    <textarea
                        class="ac-workspace__field-input"
                        placeholder={s.shape}
                        required={s.required}
                        aria-label={`${s.name}${s.required ? ' (required)' : ''}`}
                        value={values[s.name] ?? ''}
                        onInput={(e): void => {
                            formInputs.value = { ...formInputs.value, [s.name]: (e.target as HTMLTextAreaElement).value };
                        }}
                    />
                </label>
            ))}
            <div class="ac-workspace__form-actions">
                <button type="submit" class="ac-button ac-button--primary" disabled={missingRequired || launching.value}>
                    {launching.value ? 'Running…' : 'Run task'}
                </button>
                <button type="button" class="ac-button" onClick={(): void => { openTask.value = null; }}>Cancel</button>
            </div>
        </form>
    );
}

// The driven turn's assistant text (ADR-075). Long turns collapse behind a
// "Show full" toggle so a 4k-token response can't break the layout chrome.
function TurnResult(): preact.JSX.Element | null {
    const r = launchResult.value;
    if (r === null || !r.driven || r.turn === undefined) return null;
    const text = r.turn.text ?? '';
    const long = text.length > TURN_COLLAPSE_CHARS;
    const shown = long && !showFullTurn.value ? `${text.slice(0, TURN_COLLAPSE_CHARS)}…` : text;
    const usage = r.turn.usage;
    return (
        <section class="ac-workspace__turn" aria-label="Host turn result">
            <h2 class="ac-workspace__heading">Result · {r.task}</h2>
            <pre class="ac-workspace__turn-text">{shown}</pre>
            {long ? (
                <button type="button" class="ac-button" onClick={(): void => { showFullTurn.value = !showFullTurn.value; }}>
                    {showFullTurn.value ? 'Show less' : 'Show full'}
                </button>
            ) : null}
            {usage != null ? (
                <p class="ac-workspace__turn-meta">
                    {r.turn.model ?? DRIVE_HOST} · in {usage.input_tokens ?? 0} / out {usage.output_tokens ?? 0} tokens
                </p>
            ) : null}
        </section>
    );
}

function TaskPicker({ role }: { role: Role }): preact.JSX.Element {
    const tasks = selectedTasks.value.length > 0 ? selectedTasks.value : role.first_tasks;
    return (
        <section class="ac-workspace__tasks" aria-labelledby="task-heading">
            <h2 id="task-heading" class="ac-workspace__heading">First tasks · {role.display_name}</h2>
            {tasks.length === 0 ? (
                <p class="ac-workspace__empty">No tasks scaffolded yet for this role.</p>
            ) : (
                <ul class="ac-workspace__task-list">
                    {tasks.map((t) => (
                        <li key={t.name} class="ac-workspace__task">
                            <div class="ac-workspace__task-head">
                                <span class="ac-workspace__task-name">{t.name}</span>
                                <button
                                    type="button"
                                    class="ac-button ac-button--primary"
                                    aria-expanded={openTask.value === t.name}
                                    onClick={(): void => {
                                        openTask.value = openTask.value === t.name ? null : t.name;
                                        formInputs.value = {};
                                        launchResult.value = null;
                                    }}
                                >
                                    {openTask.value === t.name ? 'Close' : 'Start session'}
                                </button>
                            </div>
                            <p class="ac-workspace__task-intent">{t.intent}</p>
                            {t.prompt !== '' ? (
                                <code class="ac-workspace__task-prompt">prompts/{t.prompt}</code>
                            ) : null}
                            {openTask.value === t.name ? <TaskForm role={role.slug} task={t} /> : null}
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
                    <TurnResult />
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

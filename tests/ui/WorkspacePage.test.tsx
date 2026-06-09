/**
 * WorkspacePage tests — Phase A Step 1 of
 * `road-to-frictionless-employee-workspace.md`.
 *
 * Eight cases cover the visible surface: initial load (loading +
 * loaded states), role-grid render, role selection swaps the task
 * picker, session-strip render with non-empty + empty fixtures,
 * launch POSTs `/workspace/launch` and refreshes the session strip,
 * knowledge / recent-docs panels render or fall back to empty state,
 * explain-mode toggle flips between plain and technical.
 *
 * Module-level signals inside WorkspacePage are reset by re-importing
 * the module via `vi.resetModules()` in `beforeEach`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';

interface Call { method: string; path: string; body: unknown }

interface FixtureOverrides {
    roles?: unknown;
    sessions?: unknown;
    knowledge?: unknown;
    documents?: unknown;
    tasks?: unknown;
    launch?: { status: number; body: unknown };
    continueTurn?: { status: number; body: unknown };
    health?: unknown;
    hosts?: unknown;
}

function installWorkspaceFetchMock(overrides: FixtureOverrides = {}): { calls: Call[]; restore: () => void } {
    const calls: Call[] = [];
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        const body = init?.body !== undefined ? JSON.parse(init.body as string) : undefined;
        calls.push({ method, path, body });

        if (path === '/api/v1/workspace/roles') {
            const payload = overrides.roles ?? {
                roles: [
                    {
                        slug: 'galabau',
                        display_name: 'Galabau owner',
                        tagline: 'Customer offers and project briefs.',
                        status: 'draft',
                        recommended_packs: ['core'],
                        first_tasks: [
                            { name: 'Offer drafting', intent: 'Draft an offer from a brief.', prompt: 'offer-from-brief.md' },
                            { name: 'Email reply', intent: 'Reply in the right tone.', prompt: 'customer-email-reply.md' },
                        ],
                        skills: [
                            { id: 'refine-prompt', why: 'Tightens fuzzy customer briefs.' },
                            { id: 'voice-and-tone-design', why: 'Locks the voice.' },
                        ],
                    },
                    {
                        slug: 'content-creator',
                        display_name: 'Content creator',
                        tagline: 'Storyboards and series.',
                        status: 'beta',
                        recommended_packs: ['content'],
                        first_tasks: [],
                        skills: [],
                    },
                ],
            };
            return new Response(JSON.stringify(payload), { status: 200 });
        }
        if (/\/api\/v1\/workspace\/roles\/[^/]+\/tasks$/.test(path) && method === 'GET') {
            const slug = path.split('/')[5];   // /api/v1/workspace/roles/<slug>/tasks
            if (overrides.tasks === undefined && slug !== 'galabau') {
                return new Response(JSON.stringify({ role: slug, tasks: [], skills: [] }), { status: 200 });
            }
            const payload = overrides.tasks ?? {
                role: 'galabau',
                tasks: [
                    { name: 'Offer drafting', intent: 'Draft an offer from a brief.', prompt: 'offer-from-brief.md',
                      inputs: [{ name: 'brief', required: true, shape: 'the customer brief' },
                               { name: 'notes', required: false, shape: 'extra notes' }],
                      skill_hint: 'doc-coauthoring' },
                    { name: 'Email reply', intent: 'Reply in the right tone.', prompt: 'customer-email-reply.md',
                      inputs: [], skill_hint: null },
                ],
                skills: [{ id: 'refine-prompt', why: 'Tightens fuzzy customer briefs.' }],
            };
            return new Response(JSON.stringify(payload), { status: 200 });
        }
        if (path.startsWith('/api/v1/workspace/sessions') && method === 'GET') {
            const payload = overrides.sessions ?? {
                sessions: [
                    { id: '20260525T120400Z-abcd1234', role: 'galabau', task: 'Offer drafting', started_at: '2026-05-25T12:04:00Z' },
                ],
            };
            return new Response(JSON.stringify(payload), { status: 200 });
        }
        if (path.startsWith('/api/v1/workspace/knowledge')) {
            const payload = overrides.knowledge ?? {
                chunks: [
                    { id: 'k:1', source: '/tmp/handbook.pdf', excerpt: 'Handbook excerpt.', pinned: false },
                ],
            };
            return new Response(JSON.stringify(payload), { status: 200 });
        }
        if (path.startsWith('/api/v1/workspace/documents')) {
            const payload = overrides.documents ?? {
                documents: [
                    { type: 'offer', slug: 'offer-001', title: 'Offer 001', role: 'galabau', updated_at: '2026-05-25T11:00:00Z' },
                ],
            };
            return new Response(JSON.stringify(payload), { status: 200 });
        }
        if (path.startsWith('/api/v1/workspace/drive-health') && method === 'GET') {
            const payload = overrides.health ?? { health: {} };
            return new Response(JSON.stringify(payload), { status: 200 });
        }
        if (path === '/api/v1/workspace/hosts' && method === 'GET') {
            const payload = overrides.hosts ?? { hosts: [
                { id: 'claude-code', cli_present: true, effective_tier: 1 },
                { id: 'codex', cli_present: true, effective_tier: 1 },
                { id: 'gemini', cli_present: false, effective_tier: 3 },
            ] };
            return new Response(JSON.stringify(payload), { status: 200 });
        }
        if (path === '/api/v1/workspace/launch' && method === 'POST') {
            const ov = overrides.launch;
            if (ov !== undefined) return new Response(JSON.stringify(ov.body), { status: ov.status });
            const reqBody = body as { role: string; task: string };
            return new Response(JSON.stringify({
                id: '20260525T130000Z-deadbeef',
                role: reqBody.role,
                task: reqBody.task,
                driven: true,
                turn: { text: 'Here is your drafted offer.', model: 'claude-code', usage: { input_tokens: 12, output_tokens: 40 } },
            }), { status: 200 });
        }
        if (/\/api\/v1\/workspace\/sessions\/[^/]+\/continue$/.test(path) && method === 'POST') {
            const ov = overrides.continueTurn;
            if (ov !== undefined) return new Response(JSON.stringify(ov.body), { status: ov.status });
            const id = path.split('/')[5];
            return new Response(JSON.stringify({
                id, role: 'galabau', task: 'Offer drafting', driven: true,
                turn: { text: 'Shorter offer.', model: 'claude-code', usage: { input_tokens: 8, output_tokens: 20 } },
            }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { calls, restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { vi.resetModules(); try { sessionStorage.clear(); } catch { /* jsdom */ } });
afterEach(() => { cleanup(); try { sessionStorage.clear(); } catch { /* jsdom */ } });

describe('WorkspacePage', () => {
    it('renders the roles, sessions, knowledge, and documents panels after load', async () => {
        const mock = installWorkspaceFetchMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, findAllByText } = render(<WorkspacePage />);
            await findByText('Roles');
            await findByText('Galabau owner');
            await findByText('Content creator');
            await findByText('Recent sessions');
            await findByText('Knowledge sources');
            await findByText('Recent documents');
            const explainHeadings = await findAllByText('Explanation style');
            expect(explainHeadings.length).toBeGreaterThan(0);
            expect(mock.calls.some((c) => c.path === '/api/v1/workspace/roles')).toBe(true);
            expect(mock.calls.some((c) => c.path.startsWith('/api/v1/workspace/sessions'))).toBe(true);
        } finally {
            mock.restore();
        }
    });

    it('shows the role tagline + status badge in the role grid', async () => {
        const mock = installWorkspaceFetchMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText } = render(<WorkspacePage />);
            await findByText('Customer offers and project briefs.');
            await findByText('Storyboards and series.');
            await findByText('beta');
            await findByText('draft');
        } finally {
            mock.restore();
        }
    });

    it('reveals the task picker after the user picks a role', async () => {
        const mock = installWorkspaceFetchMock({
            // Empty sessions so the task-name text is unambiguous.
            sessions: { sessions: [] },
        });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, findByRole, queryByText } = render(<WorkspacePage />);
            await findByText('Pick a role on the left to see its first tasks.');
            const galabauBtn = await findByRole('button', { name: /Pick role Galabau owner/ });
            fireEvent.click(galabauBtn);
            await findByText('First tasks · Galabau owner');
            await findByText('Offer drafting');
            await findByText('Email reply');
            expect(queryByText('Pick a role on the left to see its first tasks.')).toBeNull();
        } finally {
            mock.restore();
        }
    });

    it('renders the empty-state for a role with no scaffolded tasks', async () => {
        const mock = installWorkspaceFetchMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, findByRole } = render(<WorkspacePage />);
            const creatorBtn = await findByRole('button', { name: /Pick role Content creator/ });
            fireEvent.click(creatorBtn);
            await findByText('First tasks · Content creator');
            await findByText('No tasks scaffolded yet for this role.');
        } finally {
            mock.restore();
        }
    });

    it('opens the input form, drives the task, and renders the turn', async () => {
        const mock = installWorkspaceFetchMock({ sessions: { sessions: [] } });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, findByRole, findAllByRole } = render(<WorkspacePage />);
            fireEvent.click(await findByRole('button', { name: /Pick role Galabau owner/ }));
            await findByText('Offer drafting');
            // Start session expands the inline form (it does not POST yet).
            fireEvent.click((await findAllByRole('button', { name: /Start session/ }))[0]!);
            const brief = await findByRole('textbox', { name: /brief \(required\)/ });
            // Required not filled → Run task is disabled, no POST yet.
            expect((await findByRole('button', { name: /Run task/ })).hasAttribute('disabled')).toBe(true);
            expect(mock.calls.some((c) => c.path === '/api/v1/workspace/launch')).toBe(false);
            fireEvent.input(brief, { target: { value: 'Build a 20m hedge.' } });
            fireEvent.click(await findByRole('button', { name: /Run task/ }));
            await waitFor(() => {
                expect(mock.calls.filter((c) => c.path === '/api/v1/workspace/launch' && c.method === 'POST').length).toBe(1);
            });
            const launch = mock.calls.find((c) => c.path === '/api/v1/workspace/launch');
            expect(launch?.body).toMatchObject({
                role: 'galabau', task: 'Offer drafting', host: 'claude-code',
                inputs: { brief: 'Build a 20m hedge.' },
            });
            await findByText('Here is your drafted offer.');   // driven turn rendered
        } finally {
            mock.restore();
        }
    });

    it('shows the hand-off banner when a launch degrades to the inbox', async () => {
        const mock = installWorkspaceFetchMock({
            sessions: { sessions: [] },
            launch: { status: 200, body: {
                id: '20260525T130000Z-deadbeef', role: 'galabau', task: 'Offer drafting',
                driven: false, handoff: '/home/u/.event4u/agent-config/workspace/inbox/x.md',
            } },
        });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, findByRole, findAllByRole } = render(<WorkspacePage />);
            fireEvent.click(await findByRole('button', { name: /Pick role Galabau owner/ }));
            await findByText('Offer drafting');
            fireEvent.click((await findAllByRole('button', { name: /Start session/ }))[0]!);
            fireEvent.input(await findByRole('textbox', { name: /brief \(required\)/ }), { target: { value: 'x' } });
            fireEvent.click(await findByRole('button', { name: /Run task/ }));
            await findByText(/Prepared a hand-off — open .*inbox\/x\.md/);
        } finally {
            mock.restore();
        }
    });

    it('shows a render-error banner when a required input rejection comes back', async () => {
        const mock = installWorkspaceFetchMock({
            sessions: { sessions: [] },
            launch: { status: 200, body: {
                id: '20260525T130000Z-deadbeef', role: 'galabau', task: 'Offer drafting',
                driven: false, error_kind: 'render-error', error: 'missing required input(s): brief',
            } },
        });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, findByRole, findAllByRole } = render(<WorkspacePage />);
            fireEvent.click(await findByRole('button', { name: /Pick role Galabau owner/ }));
            await findByText('Offer drafting');
            fireEvent.click((await findAllByRole('button', { name: /Start session/ }))[0]!);
            fireEvent.input(await findByRole('textbox', { name: /brief \(required\)/ }), { target: { value: 'x' } });
            fireEvent.click(await findByRole('button', { name: /Run task/ }));
            await findByText(/Couldn't fill the prompt: missing required/);
        } finally {
            mock.restore();
        }
    });

    it('shows the "no sources yet" empty state when the knowledge namespace is empty', async () => {
        const mock = installWorkspaceFetchMock({ knowledge: { chunks: [] } });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText } = render(<WorkspacePage />);
            await findByText('Knowledge sources');
            await findByText(/No sources yet/);
        } finally {
            mock.restore();
        }
    });

    it('shows the empty state when no sessions or documents exist', async () => {
        const mock = installWorkspaceFetchMock({
            sessions: { sessions: [] },
            documents: { documents: [] },
        });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText } = render(<WorkspacePage />);
            await findByText(/No sessions yet/);
            await findByText(/No documents yet/);
        } finally {
            mock.restore();
        }
    });

    it('toggles the plain-explain mode between plain and technical', async () => {
        const mock = installWorkspaceFetchMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByLabelText, findByText } = render(<WorkspacePage />);
            await findByText(/Replies use everyday words/);
            const technical = await findByLabelText('Technical detail');
            fireEvent.click(technical);
            await findByText(/Replies keep the technical vocabulary/);
            const plain = await findByLabelText('Plain language');
            fireEvent.click(plain);
            await findByText(/Replies use everyday words/);
        } finally {
            mock.restore();
        }
    });

    it('sends a follow-up that continues the session and renders the new turn', async () => {
        const mock = installWorkspaceFetchMock({ sessions: { sessions: [] } });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, findByRole, findAllByRole } = render(<WorkspacePage />);
            fireEvent.click(await findByRole('button', { name: /Pick role Galabau owner/ }));
            await findByText('Offer drafting');
            fireEvent.click((await findAllByRole('button', { name: /Start session/ }))[0]!);
            fireEvent.input(await findByRole('textbox', { name: /brief \(required\)/ }), { target: { value: 'Build a hedge.' } });
            fireEvent.click(await findByRole('button', { name: /Run task/ }));
            await findByText('Here is your drafted offer.');   // first turn drove
            // The follow-up box appears under the result; sending it continues.
            const followup = await findByRole('textbox', { name: /Follow-up prompt/ });
            fireEvent.input(followup, { target: { value: 'make it shorter' } });
            fireEvent.click(await findByRole('button', { name: /Send follow-up/ }));
            await waitFor(() => {
                const cont = mock.calls.filter((c) => /\/continue$/.test(c.path) && c.method === 'POST');
                expect(cont.length).toBe(1);
            });
            const cont = mock.calls.find((c) => /\/continue$/.test(c.path));
            expect(cont?.path).toBe('/api/v1/workspace/sessions/20260525T130000Z-deadbeef/continue');
            expect(cont?.body).toMatchObject({ prompt: 'make it shorter' });
            await findByText('Shorter offer.');                // continued turn rendered
        } finally {
            mock.restore();
        }
    });

    it('does not show a follow-up box until a turn has driven', async () => {
        const mock = installWorkspaceFetchMock({
            sessions: { sessions: [] },
            launch: { status: 200, body: {
                id: '20260525T130000Z-deadbeef', role: 'galabau', task: 'Offer drafting',
                driven: false, handoff: '/x/inbox/y.md',
            } },
        });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, findByRole, findAllByRole, queryByRole } = render(<WorkspacePage />);
            fireEvent.click(await findByRole('button', { name: /Pick role Galabau owner/ }));
            await findByText('Offer drafting');
            fireEvent.click((await findAllByRole('button', { name: /Start session/ }))[0]!);
            fireEvent.input(await findByRole('textbox', { name: /brief \(required\)/ }), { target: { value: 'x' } });
            fireEvent.click(await findByRole('button', { name: /Run task/ }));
            await findByText(/Prepared a hand-off/);
            expect(queryByRole('textbox', { name: /Follow-up prompt/ })).toBeNull();   // not driven → no follow-up
        } finally {
            mock.restore();
        }
    });

    it('drive-health panel shows "All hosts healthy" when nothing is tripped', async () => {
        const mock = installWorkspaceFetchMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText } = render(<WorkspacePage />);
            await findByText('Host health');
            await findByText('All hosts healthy.');
        } finally {
            mock.restore();
        }
    });

    it('drive-health panel surfaces an auto-recovering killed host', async () => {
        const mock = installWorkspaceFetchMock({
            health: { health: {
                codex: { killed: true, kill_reason: 'auto', consecutive_failures: 5, trip_count: 1,
                         total_success: 2, total_failure: 5, last_error_kind: 'timeout' },
            } },
        });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText } = render(<WorkspacePage />);
            await findByText('codex');
            await findByText(/paused — auto-recovering/);
            await findByText(/5 fail streak · timeout/);
        } finally {
            mock.restore();
        }
    });

    it('host picker lists hosts and disables an uninstalled one', async () => {
        const mock = installWorkspaceFetchMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByRole } = render(<WorkspacePage />);
            const select = await findByRole('combobox', { name: /Host agent/ }) as HTMLSelectElement;
            const opts = Array.from(select.options);
            expect(opts.map((o) => o.value)).toEqual(['claude-code', 'codex', 'gemini']);
            const gemini = opts.find((o) => o.value === 'gemini')!;
            expect(gemini.disabled).toBe(true);                 // cli_present: false
            expect(gemini.textContent).toContain('not installed');
            expect(opts.find((o) => o.value === 'codex')!.disabled).toBe(false);
        } finally {
            mock.restore();
        }
    });

    it('launch sends the picked host', async () => {
        const mock = installWorkspaceFetchMock({ sessions: { sessions: [] } });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, findByRole, findAllByRole } = render(<WorkspacePage />);
            const select = await findByRole('combobox', { name: /Host agent/ });
            fireEvent.change(select, { target: { value: 'codex' } });
            fireEvent.click(await findByRole('button', { name: /Pick role Galabau owner/ }));
            await findByText('Offer drafting');
            fireEvent.click((await findAllByRole('button', { name: /Start session/ }))[0]!);
            fireEvent.input(await findByRole('textbox', { name: /brief \(required\)/ }), { target: { value: 'x' } });
            fireEvent.click(await findByRole('button', { name: /Run task/ }));
            await waitFor(() => {
                expect(mock.calls.some((c) => c.path === '/api/v1/workspace/launch' && c.method === 'POST')).toBe(true);
            });
            const launch = mock.calls.find((c) => c.path === '/api/v1/workspace/launch');
            expect(launch?.body).toMatchObject({ host: 'codex' });
        } finally {
            mock.restore();
        }
    });

    it('surfaces a load error when /api/v1/workspace/roles fails', async () => {
        const original = global.fetch;
        global.fetch = vi.fn(async (url: string | URL | Request) => {
            const path = typeof url === 'string' ? url : url.toString();
            if (path === '/api/v1/workspace/roles') {
                return new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }), { status: 500 });
            }
            return new Response(JSON.stringify({ sessions: [], chunks: [], documents: [] }), { status: 200 });
        }) as unknown as typeof fetch;
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText } = render(<WorkspacePage />);
            await findByText(/boom/);
        } finally {
            global.fetch = original;
        }
    });
});

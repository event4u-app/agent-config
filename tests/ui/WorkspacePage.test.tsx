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
    launch?: { status: number; body: unknown };
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
        if (path === '/api/v1/workspace/launch' && method === 'POST') {
            const ov = overrides.launch;
            if (ov !== undefined) return new Response(JSON.stringify(ov.body), { status: ov.status });
            const reqBody = body as { role: string; task: string };
            return new Response(JSON.stringify({
                id: '20260525T130000Z-deadbeef',
                role: reqBody.role,
                task: reqBody.task,
            }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { calls, restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { cleanup(); });

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

    it('POSTs /workspace/launch when the user clicks Start session', async () => {
        const mock = installWorkspaceFetchMock({ sessions: { sessions: [] } });
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, findByRole, findAllByRole } = render(<WorkspacePage />);
            const galabauBtn = await findByRole('button', { name: /Pick role Galabau owner/ });
            fireEvent.click(galabauBtn);
            await findByText('Offer drafting');
            const startButtons = await findAllByRole('button', { name: /Start session/ });
            fireEvent.click(startButtons[0]!);
            await waitFor(() => {
                const launches = mock.calls.filter((c) => c.path === '/api/v1/workspace/launch' && c.method === 'POST');
                expect(launches.length).toBe(1);
            });
            const launch = mock.calls.find((c) => c.path === '/api/v1/workspace/launch');
            expect(launch?.body).toMatchObject({ role: 'galabau', task: 'Offer drafting', host: 'local' });
            await findByText(/Started session 20260525T130000Z-deadbeef/);
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

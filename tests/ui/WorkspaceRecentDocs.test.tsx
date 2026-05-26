/**
 * RecentDocs golden tests — Phase A Step 3 of
 * `road-to-frictionless-employee-workspace.md`.
 *
 * Mirrors the fixture shapes used by
 * `tests/test_workspace_documents.py` (Python) so the right-rail's
 * TS golden output stays aligned with the Python backend's
 * canonical document store. Covers the five surface states:
 *
 *   1. Empty store → "No documents yet." empty state.
 *   2. One document → single row, type badge + title + date.
 *   3. Two documents of different types → both rows visible, badges
 *      differentiate visually (data-type attr).
 *   4. Five documents → mtime-descending sort honoured by the server
 *      side, frontend renders the order it receives.
 *   5. Twenty (max) documents → frontend caps at the server's limit.
 *
 * The frontend never owns sort or trim — both are server-side
 * (`workspace.ts § listDocuments`). These tests assert the render
 * contract only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/preact';

interface DocFixture { type: string; slug: string; title: string; role: string; updated_at: string }

function installMock(documents: DocFixture[]): { restore: () => void } {
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request) => {
        const path = typeof url === 'string' ? url : url.toString();
        if (path === '/api/v1/workspace/roles') return new Response(JSON.stringify({ roles: [] }), { status: 200 });
        if (path.startsWith('/api/v1/workspace/sessions')) return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
        if (path.startsWith('/api/v1/workspace/knowledge')) return new Response(JSON.stringify({ chunks: [] }), { status: 200 });
        if (path.startsWith('/api/v1/workspace/documents')) return new Response(JSON.stringify({ documents }), { status: 200 });
        return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 });
    }) as unknown as typeof fetch;
    return { restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { cleanup(); });

function makeDocs(n: number): DocFixture[] {
    const types = ['offer', 'mail-draft', 'memo', 'brief', 'video-script'];
    const out: DocFixture[] = [];
    for (let i = 0; i < n; i++) {
        const day = String(i + 1).padStart(2, '0');
        out.push({
            type: types[i % types.length] ?? 'offer',
            slug: `doc-${i}`,
            title: `Document ${i}`,
            role: i % 2 === 0 ? 'galabau' : 'consultant',
            updated_at: `2026-05-${day}T10:00:00Z`,
        });
    }
    return out;
}

describe('RecentDocs — golden render against document fixtures', () => {
    it('renders the empty-state when no documents exist', async () => {
        const mock = installMock([]);
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Recent documents');
            await findByText(/No documents yet/);
            expect(container.querySelectorAll('.ac-workspace__doc').length).toBe(0);
        } finally {
            mock.restore();
        }
    });

    it('renders a single document with type badge and title', async () => {
        const mock = installMock(makeDocs(1));
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Recent documents');
            await findByText('Document 0');
            const rows = container.querySelectorAll('.ac-workspace__doc');
            expect(rows.length).toBe(1);
            const badge = rows[0]?.querySelector('.ac-workspace__doc-type');
            expect(badge?.getAttribute('data-type')).toBe('offer');
        } finally {
            mock.restore();
        }
    });

    it('renders two documents of different types', async () => {
        const mock = installMock(makeDocs(2));
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Document 0');
            await findByText('Document 1');
            const badges = Array.from(container.querySelectorAll('.ac-workspace__doc-type'))
                .map((n) => n.getAttribute('data-type'));
            expect(badges).toEqual(['offer', 'mail-draft']);
        } finally {
            mock.restore();
        }
    });

    it('renders five documents — server-side sort order is honoured verbatim', async () => {
        const fixture = makeDocs(5);
        const mock = installMock(fixture);
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Document 0');
            const titles = Array.from(container.querySelectorAll('.ac-workspace__doc-title'))
                .map((n) => n.textContent);
            // Frontend renders the order it receives — fixture is index-asc.
            expect(titles).toEqual(['Document 0', 'Document 1', 'Document 2', 'Document 3', 'Document 4']);
        } finally {
            mock.restore();
        }
    });

    it('renders twenty (max) documents without truncation', async () => {
        const mock = installMock(makeDocs(20));
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Document 0');
            const rows = container.querySelectorAll('.ac-workspace__doc');
            expect(rows.length).toBe(20);
        } finally {
            mock.restore();
        }
    });
});

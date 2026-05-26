/**
 * WorkspaceKnowledgePane golden tests — Phase A Step 2 of
 * `road-to-frictionless-employee-workspace.md`.
 *
 * Asserts the inline-citations rail renders correctly against five
 * fixture shapes: 0, 1, 2, 5, and "max" (20) citations. Click on a
 * citation source emits a `file://` href so the OS default-app
 * handler picks it up (the right-rail does not embed a viewer; the
 * host is the OS).
 *
 * Render path goes through the WorkspacePage shell because the rail
 * is a sub-section in the contract diagram; isolating just the
 * <KnowledgePane> would skip the empty-state coverage that ships
 * inside `WorkspacePage`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/preact';

interface KnowledgeChunk { id: string; source: string; excerpt: string; pinned: boolean }

function installMock(chunks: KnowledgeChunk[]): { restore: () => void } {
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request) => {
        const path = typeof url === 'string' ? url : url.toString();
        if (path === '/api/v1/workspace/roles') {
            return new Response(JSON.stringify({ roles: [] }), { status: 200 });
        }
        if (path.startsWith('/api/v1/workspace/sessions')) {
            return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
        }
        if (path.startsWith('/api/v1/workspace/knowledge')) {
            return new Response(JSON.stringify({ chunks }), { status: 200 });
        }
        if (path.startsWith('/api/v1/workspace/documents')) {
            return new Response(JSON.stringify({ documents: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 });
    }) as unknown as typeof fetch;
    return { restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { cleanup(); });

function makeChunks(n: number): KnowledgeChunk[] {
    const out: KnowledgeChunk[] = [];
    for (let i = 0; i < n; i++) {
        out.push({
            id: `k:${i}`,
            source: `/tmp/handbook-${i}.pdf`,
            excerpt: `Excerpt for chunk ${i}.`,
            pinned: i % 3 === 0,
        });
    }
    return out;
}

describe('KnowledgePane — golden render against citation count', () => {
    it('renders the "no sources yet" empty state with 0 citations', async () => {
        const mock = installMock([]);
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Knowledge sources');
            await findByText(/No sources yet\. Run/);
            expect(container.querySelectorAll('.ac-workspace__citation').length).toBe(0);
        } finally {
            mock.restore();
        }
    });

    it('renders a single citation with marker [1] and a file:// link', async () => {
        const mock = installMock(makeChunks(1));
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Knowledge sources');
            await findByText('handbook-0.pdf');
            const markers = container.querySelectorAll('.ac-workspace__citation-marker');
            expect(markers.length).toBe(1);
            expect(markers[0]?.textContent).toBe('[1]');
            const link = container.querySelector('.ac-workspace__citation-source') as HTMLAnchorElement | null;
            expect(link?.getAttribute('href')).toBe('file:///tmp/handbook-0.pdf');
        } finally {
            mock.restore();
        }
    });

    it('renders exactly two citations with markers [1] and [2]', async () => {
        const mock = installMock(makeChunks(2));
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Knowledge sources');
            await findByText('handbook-0.pdf');
            await findByText('handbook-1.pdf');
            const markers = Array.from(container.querySelectorAll('.ac-workspace__citation-marker'))
                .map((n) => n.textContent);
            expect(markers).toEqual(['[1]', '[2]']);
        } finally {
            mock.restore();
        }
    });

    it('renders five citations with sequential markers [1]..[5] and pinned flag', async () => {
        const mock = installMock(makeChunks(5));
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Knowledge sources');
            const markers = Array.from(container.querySelectorAll('.ac-workspace__citation-marker'))
                .map((n) => n.textContent);
            expect(markers).toEqual(['[1]', '[2]', '[3]', '[4]', '[5]']);
            // Chunks 0 and 3 are pinned (i % 3 === 0).
            const pinned = container.querySelectorAll('.ac-workspace__citation-pin');
            expect(pinned.length).toBe(2);
        } finally {
            mock.restore();
        }
    });

    it('renders the "max" (20) citations rendering — server is the trim authority', async () => {
        const mock = installMock(makeChunks(20));
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Knowledge sources');
            const items = container.querySelectorAll('.ac-workspace__citation');
            expect(items.length).toBe(20);
            const lastMarker = items[items.length - 1]?.querySelector('.ac-workspace__citation-marker');
            expect(lastMarker?.textContent).toBe('[20]');
        } finally {
            mock.restore();
        }
    });
});

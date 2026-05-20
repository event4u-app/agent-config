/**
 * UserMdPanel round-trip unit test — roadmap Phase 2.5.
 *
 * Verifies the read/edit/save loop against a mocked /api/v1/user-md:
 *   - GET on mount populates the textarea with the existing body + mtime
 *   - editing the textarea updates the signal
 *   - Save PUTs the new body with If-Unmodified-Since carrying the GET mtime
 *   - the banner reflects the writtenPaths returned by the server
 *
 * Also covers the "file does not exist" branch — GET returns exists=false,
 * the template route fills the body, and Save omits the lock header.
 *
 * Module-level signals are reset via vi.resetModules() in beforeEach.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';

interface Call { method: string; path: string; body: unknown; headers: Record<string, string> }

interface MockOpts {
    exists?: boolean;
    body?: string;
    lastModified?: number | null;
    template?: string;
}

function installFetchMock(opts: MockOpts = {}): { calls: Call[]; restore: () => void } {
    const exists = opts.exists ?? true;
    const body = opts.body ?? '# hello\n';
    const lastModified = opts.lastModified ?? (exists ? 1700000000000 : null);
    const template = opts.template ?? '# template\n';
    const calls: Call[] = [];
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        const headers = (init?.headers as Record<string, string> | undefined) ?? {};
        const reqBody = init?.body !== undefined ? JSON.parse(init.body as string) : undefined;
        calls.push({ method, path, body: reqBody, headers });

        if (path === '/api/v1/user-md' && method === 'GET') {
            return new Response(JSON.stringify({ body, exists, lastModified }), { status: 200 });
        }
        if (path === '/api/v1/user-md/template' && method === 'GET') {
            return new Response(JSON.stringify({ body: template }), { status: 200 });
        }
        if (path === '/api/v1/user-md' && method === 'PUT') {
            return new Response(JSON.stringify({
                lastModified: 1700000000999,
                writtenPaths: ['.agent-user.md'],
            }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { calls, restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { cleanup(); });

describe('UserMdPanel', () => {
    it('round-trips: GET → edit → PUT with If-Unmodified-Since and writtenPaths banner', async () => {
        const mock = installFetchMock({ exists: true, body: '# hello\n', lastModified: 1700000000000 });
        try {
            const { UserMdPanel } = await import('../../src/ui/pages/UserMdPanel.js');
            const { findByText, getByRole } = render(<UserMdPanel />);

            await findByText('Body');
            const textarea = document.getElementById('user-md-body') as HTMLTextAreaElement | null;
            expect(textarea).not.toBeNull();
            expect(textarea!.value).toBe('# hello\n');

            fireEvent.input(textarea!, { target: { value: '# updated\n' } });
            fireEvent.click(getByRole('button', { name: /^Save$/ }));

            await waitFor(() => {
                const puts = mock.calls.filter((c) => c.path === '/api/v1/user-md' && c.method === 'PUT');
                expect(puts.length).toBe(1);
            });
            const put = mock.calls.find((c) => c.path === '/api/v1/user-md' && c.method === 'PUT');
            expect(put?.headers['If-Unmodified-Since']).toBe('1700000000000');
            expect(put?.body).toEqual({ body: '# updated\n' });

            await findByText('Saved (.agent-user.md).');
        } finally {
            mock.restore();
        }
    });

    it('first-write branch: GET exists=false → template loaded, PUT without If-Unmodified-Since', async () => {
        const mock = installFetchMock({ exists: false, body: '', lastModified: null, template: '# starter\n' });
        try {
            const { UserMdPanel } = await import('../../src/ui/pages/UserMdPanel.js');
            const { findByText, getByRole } = render(<UserMdPanel />);

            await findByText('Body');
            const textarea = document.getElementById('user-md-body') as HTMLTextAreaElement | null;
            expect(textarea?.value).toBe('# starter\n');

            fireEvent.click(getByRole('button', { name: /^Save$/ }));
            await waitFor(() => {
                const puts = mock.calls.filter((c) => c.path === '/api/v1/user-md' && c.method === 'PUT');
                expect(puts.length).toBe(1);
            });
            const put = mock.calls.find((c) => c.path === '/api/v1/user-md' && c.method === 'PUT');
            expect(put?.headers['If-Unmodified-Since']).toBeUndefined();
            expect(put?.body).toEqual({ body: '# starter\n' });
        } finally {
            mock.restore();
        }
    });
});

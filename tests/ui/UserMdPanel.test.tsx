/**
 * UserMdPanel round-trip unit test — roadmap Phase 2.5 / A5.
 *
 * Verifies the read/edit/save loop against a mocked /api/v1/user-md, now
 * driven by the structured UserMdForm (no raw textarea). The form parses
 * the loaded body via @shared/userMd/formAdapter, the user edits a
 * specific field, and Save PUTs the recomposed markdown with
 * If-Unmodified-Since carrying the GET mtime.
 *
 * Also covers the "file does not exist" branch — GET returns exists=false,
 * the template route fills the body, Save sends the template body verbatim
 * (no user edits) and omits the lock header.
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

const FIXTURE_BODY = [
    '---',
    'version: 1',
    'identity:',
    '    name: "Original"',
    'language: "en"',
    'role:',
    '    - "engineer"',
    'style:',
    '    formality: "informal"',
    '    pace: "pragmatic"',
    'voice_sample: "Keep it crisp."',
    'last_updated: "2026-05-19"',
    '---',
    '',
    '# hello',
    '',
].join('\n');

const TEMPLATE_BODY = [
    '---',
    'version: 1',
    'identity:',
    '    name: ""',
    'language: "en"',
    'role:',
    '    - ""',
    'style:',
    '    formality: "informal"',
    '    pace: "pragmatic"',
    'voice_sample: ""',
    'last_updated: "1970-01-01"',
    '---',
    '',
    '# starter',
    '',
].join('\n');

function installFetchMock(opts: MockOpts = {}): { calls: Call[]; restore: () => void } {
    const exists = opts.exists ?? true;
    const body = opts.body ?? FIXTURE_BODY;
    const lastModified = opts.lastModified ?? (exists ? 1700000000000 : null);
    const template = opts.template ?? TEMPLATE_BODY;
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
    it('round-trips: GET → edit Name field → PUT with If-Unmodified-Since and writtenPaths banner', async () => {
        const mock = installFetchMock({ exists: true, lastModified: 1700000000000 });
        try {
            const { UserMdPanel } = await import('../../src/ui/pages/UserMdPanel.js');
            const { findByText, getByRole } = render(<UserMdPanel />);

            await findByText('Name');
            const nameInput = document.getElementById('umd-name') as HTMLInputElement | null;
            expect(nameInput).not.toBeNull();
            expect(nameInput!.value).toBe('Original');

            fireEvent.input(nameInput!, { target: { value: 'Matze' } });
            fireEvent.click(getByRole('button', { name: /^Save$/ }));

            await waitFor(() => {
                const puts = mock.calls.filter((c) => c.path === '/api/v1/user-md' && c.method === 'PUT');
                expect(puts.length).toBe(1);
            });
            const put = mock.calls.find((c) => c.path === '/api/v1/user-md' && c.method === 'PUT');
            expect(put?.headers['If-Unmodified-Since']).toBe('1700000000000');
            const putBody = (put?.body as { body: string }).body;
            expect(putBody).toContain('name: Matze');
            expect(putBody).toContain('# hello');

            await findByText('Saved (.agent-user.md).');
        } finally {
            mock.restore();
        }
    });

    it('first-write branch: GET exists=false → template loaded, Save sends template verbatim without If-Unmodified-Since', async () => {
        const mock = installFetchMock({ exists: false, body: '', lastModified: null });
        try {
            const { UserMdPanel } = await import('../../src/ui/pages/UserMdPanel.js');
            const { findByText, getByRole } = render(<UserMdPanel />);

            await findByText('Name');
            fireEvent.click(getByRole('button', { name: /^Save$/ }));
            await waitFor(() => {
                const puts = mock.calls.filter((c) => c.path === '/api/v1/user-md' && c.method === 'PUT');
                expect(puts.length).toBe(1);
            });
            const put = mock.calls.find((c) => c.path === '/api/v1/user-md' && c.method === 'PUT');
            expect(put?.headers['If-Unmodified-Since']).toBeUndefined();
            expect((put?.body as { body: string }).body).toBe(TEMPLATE_BODY);
        } finally {
            mock.restore();
        }
    });
});

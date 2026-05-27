/**
 * UserMdPanel round-trip unit test — roadmap Phase 2.5 / A5.
 *
 * Verifies the read/edit/save loop against a mocked /api/v1/user-md, now
 * driven by the structured UserMdForm (no raw textarea). The panel
 * consumes the parsed identity object directly, the user edits a
 * specific field, and Save PUTs `{ identity }` with If-Unmodified-Since
 * carrying the GET mtime.
 *
 * Also covers the "file does not exist" branch — GET returns exists=false,
 * the template route fills the form via parseUserIdentity, Save sends
 * the parsed-template identity (no user edits) and omits the lock header.
 *
 * Module-level signals are reset via vi.resetModules() in beforeEach.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';

interface Call { method: string; path: string; body: unknown; headers: Record<string, string> }

interface MockOpts {
    exists?: boolean;
    identity?: Record<string, unknown> | null;
    lastModified?: number | null;
    template?: string;
}

const FIXTURE_IDENTITY: Record<string, unknown> = {
    version: 1,
    identity: { name: 'Original' },
    language: 'en',
    role: ['engineer'],
    style: { pace: 'pragmatic' },
    voice_sample: 'Keep it crisp.',
    last_updated: '2026-05-19',
};

const TEMPLATE_BODY = [
    'version: 1',
    'identity:',
    '    name: ""',
    'language: "en"',
    'role:',
    '    - ""',
    'style:',
    '    pace: "pragmatic"',
    'voice_sample: ""',
    'last_updated: "1970-01-01"',
    '',
].join('\n');

function installFetchMock(opts: MockOpts = {}): { calls: Call[]; restore: () => void } {
    const exists = opts.exists ?? true;
    const identity = opts.identity !== undefined ? opts.identity : (exists ? FIXTURE_IDENTITY : null);
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
            return new Response(JSON.stringify({ identity, exists, lastModified }), { status: 200 });
        }
        if (path === '/api/v1/user-md/template' && method === 'GET') {
            return new Response(JSON.stringify({ body: template }), { status: 200 });
        }
        if (path === '/api/v1/user-md' && method === 'PUT') {
            return new Response(JSON.stringify({
                lastModified: 1700000000999,
                writtenPaths: ['settings/.agent-user.yml'],
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
            const putIdentity = (put?.body as { identity: Record<string, unknown> }).identity;
            expect((putIdentity.identity as { name: string }).name).toBe('Matze');
            expect(putIdentity.role).toEqual(['engineer']);
            expect(putIdentity.voice_sample).toBe('Keep it crisp.');

            await findByText('Saved (settings/.agent-user.yml).');
        } finally {
            mock.restore();
        }
    });

    it('first-write branch: GET exists=false → template loaded, Save sends parsed-template identity without If-Unmodified-Since', async () => {
        const mock = installFetchMock({ exists: false, lastModified: null });
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
            const putIdentity = (put?.body as { identity: Record<string, unknown> }).identity;
            expect(putIdentity.version).toBe(1);
            expect((putIdentity.identity as { name: string }).name).toBe('');
            expect(putIdentity.language).toBe('en');
            expect(putIdentity.role).toEqual(['']);
            expect(putIdentity.last_updated).toBe('1970-01-01');
        } finally {
            mock.restore();
        }
    });
});

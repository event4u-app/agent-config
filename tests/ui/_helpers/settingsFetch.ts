/**
 * Shared fetch mock for SettingsPage tests.
 *
 * Captures every call and lets each test override the PUT response with a
 * status/error pair to exercise the validation/lock branches. Restored via
 * the returned `restore()` (call it in a finally block).
 */
import { vi } from 'vitest';

export interface Call {
    method: string;
    path: string;
    body: unknown;
    headers: Record<string, string>;
}

export interface SettingsFetchMock {
    calls: Call[];
    restore: () => void;
}

export interface PutOverride {
    status: number;
    error: { code: string; message: string; fields?: Array<{ path: string; message: string }> };
}

export function installSettingsFetchMock(putOverride?: PutOverride): SettingsFetchMock {
    const calls: Call[] = [];
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        const headers = (init?.headers as Record<string, string> | undefined) ?? {};
        const body = init?.body !== undefined ? JSON.parse(init.body as string) : undefined;
        calls.push({ method, path, body, headers });

        if (path === '/api/v1/settings' && method === 'GET') {
            return new Response(JSON.stringify({
                values: { 'personal.user_name': 'Matze' },
                lastModified: 1700000000000,
                path: '.agent-settings.yml',
                schema: {
                    type: 'object',
                    properties: {
                        personal: {
                            type: 'object',
                            properties: { user_name: { type: 'string' } },
                        },
                    },
                },
            }), { status: 200 });
        }
        if (path === '/api/v1/settings/diff' && method === 'POST') {
            return new Response(JSON.stringify({
                changes: [{ path: 'personal.user_name', from: 'Matze', to: 'Mathias' }],
            }), { status: 200 });
        }
        if (path === '/api/v1/settings' && method === 'PUT') {
            if (putOverride !== undefined) {
                return new Response(JSON.stringify({ error: putOverride.error }), { status: putOverride.status });
            }
            return new Response(JSON.stringify({
                lastModified: 1700000000001,
                writtenPaths: ['.agent-settings.yml'],
            }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { calls, restore: (): void => { global.fetch = original; } };
}

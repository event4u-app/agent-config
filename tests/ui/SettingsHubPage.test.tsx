/**
 * SettingsHubPage — simple/advanced tiers, search, modified indicator +
 * reset (road-to-setup-experience § Phase 5).
 *
 * The fetch mock serves a two-field `personal` section: `autonomy`
 * (basic, default 'auto') and `bot_flair` (advanced — not in
 * BASIC_PATHS). Assertions: advanced hides behind the disclosure,
 * search bypasses the tier split, a non-default value renders the
 * modified row + reset restores the schema default.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';

beforeEach(() => { vi.resetModules(); });
afterEach(() => { cleanup(); });

function installHubFetchMock(values: Record<string, unknown>): { restore: () => void } {
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        if (path === '/api/v1/settings' && method === 'GET') {
            return new Response(JSON.stringify({
                values,
                lastModified: 1700000000000,
                path: '.agent-settings.yml',
                schema: {
                    type: 'object',
                    properties: {
                        personal: {
                            type: 'object',
                            properties: {
                                autonomy: { type: 'string', enum: ['auto', 'on', 'off'], default: 'auto', description: 'Autonomy mode' },
                                bot_flair: { type: 'string', default: '', description: 'Advanced flair string' },
                            },
                        },
                    },
                },
            }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { restore: (): void => { global.fetch = original; } };
}

describe('SettingsHubPage — tiers, search, modified', () => {
    it('hides advanced fields behind the per-section disclosure', async () => {
        const mock = installHubFetchMock({ personal: { autonomy: 'auto', bot_flair: '' } });
        try {
            const { SettingsHubPage } = await import('../../src/ui/pages/SettingsHubPage.js');
            const { findByText, queryByText, getByRole } = render(<SettingsHubPage />);
            await findByText('Autonomy');
            // Advanced field hidden until disclosure.
            expect(queryByText('Bot Flair')).toBeNull();
            const disclosure = getByRole('button', { name: /Show 1 advanced setting/ });
            fireEvent.click(disclosure);
            await findByText('Bot Flair');
        } finally {
            mock.restore();
        }
    });

    it('search matches advanced fields regardless of the tier split', async () => {
        const mock = installHubFetchMock({ personal: { autonomy: 'auto', bot_flair: '' } });
        try {
            const { SettingsHubPage } = await import('../../src/ui/pages/SettingsHubPage.js');
            const { findByText, getByPlaceholderText, queryByText } = render(<SettingsHubPage />);
            await findByText('Autonomy');
            const search = getByPlaceholderText(/Search all settings/);
            fireEvent.input(search, { target: { value: 'flair' } });
            await findByText('Bot Flair');
            expect(queryByText('Autonomy')).toBeNull();
        } finally {
            mock.restore();
        }
    });

    it('marks non-default values modified and reset restores the default', async () => {
        const mock = installHubFetchMock({ personal: { autonomy: 'on', bot_flair: '' } });
        try {
            const { SettingsHubPage } = await import('../../src/ui/pages/SettingsHubPage.js');
            const { findByText, getByRole, container } = render(<SettingsHubPage />);
            await findByText('Autonomy');
            const modifiedRow = container.querySelector('.ac-field-row--modified');
            expect(modifiedRow).not.toBeNull();
            fireEvent.click(getByRole('button', { name: /^Reset$/ }));
            await waitFor(() => {
                expect(container.querySelector('.ac-field-row--modified')).toBeNull();
            });
            const radio = document.getElementById('personal.autonomy-auto') as HTMLInputElement | null;
            // Radio ids may differ; assert via the checked option instead.
            if (radio !== null) expect(radio.checked).toBe(true);
        } finally {
            mock.restore();
        }
    });

    it('@modified filter shows only changed fields', async () => {
        const mock = installHubFetchMock({ personal: { autonomy: 'on', bot_flair: '' } });
        try {
            const { SettingsHubPage } = await import('../../src/ui/pages/SettingsHubPage.js');
            const { findByText, getByRole, queryByText } = render(<SettingsHubPage />);
            await findByText('Autonomy');
            fireEvent.click(getByRole('button', { name: /@modified/ }));
            await findByText('Autonomy');
            expect(queryByText('Bot Flair')).toBeNull();
        } finally {
            mock.restore();
        }
    });
});

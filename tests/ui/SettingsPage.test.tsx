/**
 * SettingsPage happy-path unit test — roadmap Phase 2.5.
 *
 * Mounts SettingsPage with a mocked /api/v1/settings + /api/v1/settings/diff +
 * PUT /api/v1/settings. Asserts: GET on mount, Preview & Save opens the
 * diff modal, Save inside the modal calls PUT exactly once with the current
 * values and the If-Unmodified-Since header carrying the mtime from GET.
 *
 * Module-level signals inside SettingsPage are reset by re-importing the
 * module via vi.resetModules() in beforeEach.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { installSettingsFetchMock } from './_helpers/settingsFetch.js';

beforeEach(() => { vi.resetModules(); });
afterEach(() => { cleanup(); });

describe('SettingsPage — happy path', () => {
    it('loads, opens the diff modal on Preview & Save, then PUTs once with If-Unmodified-Since', async () => {
        const mock = installSettingsFetchMock();
        try {
            const { SettingsPage } = await import('../../src/ui/pages/SettingsPage.js');
            const { findByText, getByRole } = render(<SettingsPage />);

            // The user name field is humanised from `user_name` → "User Name".
            await findByText('User Name');
            expect(mock.calls.some((c) => c.path === '/api/v1/settings' && c.method === 'GET')).toBe(true);

            const input = document.getElementById('personal.user_name') as HTMLInputElement | null;
            expect(input).not.toBeNull();
            fireEvent.input(input!, { target: { value: 'Mathias' } });

            // Preview & Save → diff modal opens.
            fireEvent.click(getByRole('button', { name: /Preview & Save/ }));
            await findByText('Confirm changes');

            // Save in the modal → exactly one PUT with optimistic lock + nested values.
            fireEvent.click(getByRole('button', { name: /^Save$/ }));
            await waitFor(() => {
                const puts = mock.calls.filter((c) => c.path === '/api/v1/settings' && c.method === 'PUT');
                expect(puts.length).toBe(1);
            });
            const put = mock.calls.find((c) => c.path === '/api/v1/settings' && c.method === 'PUT');
            expect(put?.headers['If-Unmodified-Since']).toBe('1700000000000');
            // SchemaForm writes values nested via setValueAt → personal.user_name.
            expect(put?.body).toMatchObject({ values: { personal: { user_name: 'Mathias' } } });
        } finally {
            mock.restore();
        }
    });
});

/**
 * SettingsPage error-path unit test — roadmap Phase 2.5, lines 226–228.
 *
 * Exercises the 422 VALIDATION branch:
 *   - banner switches to the top-level copy from copyErrors
 *   - inline FieldError appears on the errored field
 *   - the diff modal closes
 *   - focus moves to the first errored field
 *
 * Module-level signals inside SettingsPage are reset by re-importing the
 * module via vi.resetModules() in beforeEach.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { installSettingsFetchMock } from './_helpers/settingsFetch.js';

beforeEach(() => { vi.resetModules(); });
afterEach(() => { cleanup(); });

describe('SettingsPage — error paths', () => {
    it('renders inline field errors on 422, closes the diff modal, and focuses the first field', async () => {
        const mock = installSettingsFetchMock({
            status: 422,
            error: {
                code: 'VALIDATION',
                message: 'invalid',
                fields: [{ path: 'personal.user_name', message: 'expected string, received boolean' }],
            },
        });
        try {
            const { SettingsPage } = await import('../../src/ui/pages/SettingsPage.js');
            const { findByText, getByRole, queryByText } = render(<SettingsPage />);

            await findByText('User Name');
            const input = document.getElementById('personal.user_name') as HTMLInputElement | null;
            expect(input).not.toBeNull();
            fireEvent.input(input!, { target: { value: 'Mathias' } });

            fireEvent.click(getByRole('button', { name: /Preview & Save/ }));
            await findByText('Confirm changes');
            fireEvent.click(getByRole('button', { name: /^Save$/ }));

            // Banner from copyErrors + inline field error from fieldErrorMap.
            await findByText('Some fields need attention before saving.');
            await findByText(/Expected string/i);

            // Modal closes so the user can act on the inline error.
            await waitFor(() => expect(queryByText('Confirm changes')).toBeNull());

            // Focus lands on the first errored field (queued via microtask).
            await waitFor(() => expect(document.activeElement).toBe(input));
        } finally {
            mock.restore();
        }
    });
});

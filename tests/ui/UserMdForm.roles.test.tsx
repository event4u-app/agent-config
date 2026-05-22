/**
 * UserMdForm roles-list unit test.
 *
 * `defaultFrontmatter()` seeds `role: ['']` so the YAML stays well-shaped
 * before the user types anything. The form must not render that empty
 * placeholder as a chip — earlier versions surfaced an empty pill with a
 * disabled `×` button. The chip list is filtered at render time so the
 * placeholder stays out of the DOM until a real role is added.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { UserMdForm, type UserMdFormValue } from '../../src/ui/forms/UserMdForm.js';
import { defaultFrontmatter } from '../../src/shared/userMd/formAdapter.js';

afterEach(() => { cleanup(); });

function makeValue(roles: string[]): UserMdFormValue {
    return {
        frontmatter: { ...defaultFrontmatter(), role: roles },
        content: '',
    };
}

describe('UserMdForm role chips', () => {
    it('renders no chip when role is the seeded empty placeholder', () => {
        const { getByTestId } = render(
            <UserMdForm value={makeValue([''])} onChange={(): void => {}} />,
        );
        const list = getByTestId('umd-role-list');
        expect(list.querySelectorAll('li.ac-chip').length).toBe(0);
    });

    it('renders no chip when role array is empty', () => {
        const { getByTestId } = render(
            <UserMdForm value={makeValue([])} onChange={(): void => {}} />,
        );
        const list = getByTestId('umd-role-list');
        expect(list.querySelectorAll('li.ac-chip').length).toBe(0);
    });

    it('renders only non-empty roles, skipping interleaved empty strings', () => {
        const { getByTestId } = render(
            <UserMdForm value={makeValue(['', 'engineer', '', 'founder'])} onChange={(): void => {}} />,
        );
        const list = getByTestId('umd-role-list');
        const labels = Array.from(list.querySelectorAll('li.ac-chip span')).map((el) => el.textContent);
        expect(labels).toEqual(['engineer', 'founder']);
    });

    it('disables the remove button when only one non-empty role remains', () => {
        const { getByLabelText } = render(
            <UserMdForm value={makeValue(['', 'engineer', ''])} onChange={(): void => {}} />,
        );
        const removeBtn = getByLabelText('Remove engineer') as HTMLButtonElement;
        expect(removeBtn.disabled).toBe(true);
    });

    it('addRole drops the empty placeholder when the first real role is added', () => {
        let captured: UserMdFormValue | null = null;
        const { getByPlaceholderText, getByRole } = render(
            <UserMdForm
                value={makeValue([''])}
                onChange={(next): void => { captured = next; }}
            />,
        );
        const input = getByPlaceholderText('Add a role and press Enter') as HTMLInputElement;
        fireEvent.input(input, { target: { value: 'engineer' } });
        fireEvent.click(getByRole('button', { name: /^Add role$/ }));
        expect(captured).not.toBeNull();
        expect(captured!.frontmatter.role).toEqual(['engineer']);
    });
});

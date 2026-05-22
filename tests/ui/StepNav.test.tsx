/**
 * StepNav unit tests — Finish-button visibility / disabled contract.
 *
 * Covers the two post-finish UX rules added alongside the close-window
 * banner:
 *   - `canFinish=false` on the last step → button stays mounted but is
 *     `disabled` so the user gets a clear "nothing to save" affordance.
 *   - `completed=true` → button is removed from the DOM entirely so the
 *     terminal page has no actionable footer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { StepNav } from '../../src/ui/wizard/StepNav.js';

afterEach(() => { cleanup(); });

function renderNav(overrides: Partial<Parameters<typeof StepNav>[0]> = {}): ReturnType<typeof render> {
    return render(
        <StepNav
            canGoPrev
            canGoNext={false}
            canSkip={false}
            isLast
            busy={false}
            onPrev={(): void => {}}
            onNext={(): void => {}}
            onFinish={(): void => {}}
            {...overrides}
        />,
    );
}

describe('StepNav — Finish button states', () => {
    it('renders Finish enabled when canFinish=true (default)', () => {
        const { getByRole } = renderNav();
        const btn = getByRole('button', { name: /Finish/ }) as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
    });

    it('disables Finish when canFinish=false (no unsaved changes)', () => {
        const { getByRole } = renderNav({ canFinish: false });
        const btn = getByRole('button', { name: /Finish/ }) as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
    });

    it('removes Finish entirely when completed=true', () => {
        const { queryByRole } = renderNav({ completed: true });
        expect(queryByRole('button', { name: /Finish/ })).toBeNull();
    });

    it('completed=true wins over canFinish=true', () => {
        const { queryByRole } = renderNav({ canFinish: true, completed: true });
        expect(queryByRole('button', { name: /Finish/ })).toBeNull();
    });
});

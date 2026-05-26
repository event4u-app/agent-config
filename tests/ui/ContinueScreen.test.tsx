/**
 * ContinueScreen unit tests — road-to-unified-setup § Phase B5.
 *
 * Verifies the two CTAs map to the right callback, the busy flag
 * disables both, and the copy mentions the next 6 steps. The actual
 * gating (only renders when wizardMode === 'install' && stepIndex === 3
 * && !continueAcknowledged) is asserted in WizardPage.continueScreen
 * integration tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';

import { ContinueScreen } from '../../src/ui/wizard/ContinueScreen.js';

afterEach(() => { cleanup(); });

function renderScreen(overrides: Partial<{ busy: boolean }>): {
    onContinue: ReturnType<typeof vi.fn>;
    onFinishHere: ReturnType<typeof vi.fn>;
    container: HTMLElement;
} {
    const onContinue = vi.fn();
    const onFinishHere = vi.fn();
    const { container } = render(
        <ContinueScreen
            busy={overrides.busy ?? false}
            onContinue={onContinue}
            onFinishHere={onFinishHere}
        />,
    );
    return { onContinue, onFinishHere, container };
}

describe('ContinueScreen', () => {
    it('renders the install-handoff copy mentioning the 6 follow-up steps', () => {
        const { container } = renderScreen({});
        expect(container.textContent).toContain('Install complete');
        expect(container.textContent).toContain('6 more steps');
    });

    it('Continue with setup invokes onContinue only', () => {
        const { onContinue, onFinishHere, container } = renderScreen({});
        const btn = Array.from(container.querySelectorAll('button'))
            .find((b) => (b.textContent ?? '').toLowerCase().includes('continue'));
        expect(btn).toBeDefined();
        fireEvent.click(btn!);
        expect(onContinue).toHaveBeenCalledTimes(1);
        expect(onFinishHere).not.toHaveBeenCalled();
    });

    it('Finish install here invokes onFinishHere only', () => {
        const { onContinue, onFinishHere, container } = renderScreen({});
        const btn = Array.from(container.querySelectorAll('button'))
            .find((b) => (b.textContent ?? '').toLowerCase().includes('finish'));
        expect(btn).toBeDefined();
        fireEvent.click(btn!);
        expect(onFinishHere).toHaveBeenCalledTimes(1);
        expect(onContinue).not.toHaveBeenCalled();
    });

    it('busy=true disables both CTAs', () => {
        const { container } = renderScreen({ busy: true });
        const buttons = container.querySelectorAll('button');
        expect(buttons.length).toBe(2);
        for (const b of buttons) {
            expect((b as HTMLButtonElement).disabled).toBe(true);
        }
    });
});

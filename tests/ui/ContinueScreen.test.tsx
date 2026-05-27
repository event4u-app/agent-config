/**
 * ContinueScreen unit tests — road-to-wizard-ux-improvements § Phase 6.
 *
 * The screen is now presentational: the in-body "Continue with setup" /
 * "Finish install here" buttons were removed (the wizard footer's Next +
 * "Finish install here" skip action drive the handoff). These tests assert the
 * copy and that no action buttons render. The footer wiring + gating (only when
 * wizardMode === 'install' && stepIndex === 3 && !continueAcknowledged) is
 * covered by the WizardPage flow tests + StepNav tests.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';

import { ContinueScreen } from '../../src/ui/wizard/ContinueScreen.js';

afterEach(() => { cleanup(); });

describe('ContinueScreen', () => {
    it('renders the install-handoff heading', () => {
        const { container } = render(<ContinueScreen />);
        expect(container.textContent).toContain('Install complete');
    });

    it('documents Next and Finish install here as the footer actions', () => {
        const { container } = render(<ContinueScreen />);
        const text = container.textContent ?? '';
        expect(text).toContain('Next');
        expect(text).toContain('Finish install here');
    });

    it('renders no in-body action buttons (the footer owns the actions)', () => {
        const { container } = render(<ContinueScreen />);
        expect(container.querySelectorAll('button').length).toBe(0);
    });
});

/**
 * Wizard step header — step counter, title, subtitle, progress strip.
 *
 * Non-interactive by design: jumping back to earlier steps is exposed on
 * the final Review page as a clickable list, not as a chip rail in the
 * header. Keeps the header read-only while the user fills the current
 * step.
 */

import { ProgressBar } from './ProgressBar.js';
import type { WizardStep } from './steps.js';

export interface StepHeaderProps {
    step: WizardStep;
    index: number;
    total: number;
}

export function StepHeader({ step, index, total }: StepHeaderProps): preact.JSX.Element {
    return (
        <header class="ac-page__header ac-wizard__header">
            <p class="ac-wizard__step-count">Step {index + 1} of {total}</p>
            <div class="ac-wizard__header-text">
                <h1>{step.title}</h1>
                <p class="ac-wizard__subtitle">{step.subtitle}</p>
            </div>
            <ProgressBar current={index} total={total} />
        </header>
    );
}

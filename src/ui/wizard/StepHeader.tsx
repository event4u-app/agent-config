/**
 * Wizard step header — title, subtitle, progress strip.
 *
 * Title is always an h1 (only one per wizard page). Subtitle uses a
 * normal paragraph so the muted-text token can apply.
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
            <div class="ac-wizard__header-text">
                <p class="ac-wizard__step-count">Step {index + 1} of {total}</p>
                <h1>{step.title}</h1>
                <p class="ac-wizard__subtitle">{step.subtitle}</p>
            </div>
            <ProgressBar current={index} total={total} />
        </header>
    );
}

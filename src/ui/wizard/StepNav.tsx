/**
 * Wizard step navigation footer.
 *
 * Back / Skip / Next or Finish. The Finish variant is rendered only on
 * the last step; the caller wires it to `commitMulti` via the wizard
 * finish API.
 */

export interface StepNavProps {
    canGoPrev: boolean;
    canGoNext: boolean;
    canSkip: boolean;
    isLast: boolean;
    busy: boolean;
    /**
     * When the last step has nothing to save (no settings diff and no
     * user-md edits) the Finish button is rendered disabled. Defaults to
     * `true` so callers that omit the prop keep the old click-through
     * behavior.
     */
    canFinish?: boolean;
    /**
     * Set after a successful `/wizard/finish` round-trip — suppresses the
     * Finish button entirely so the page reads as terminal.
     */
    completed?: boolean;
    onPrev: () => void;
    onNext: () => void;
    onSkip?: () => void;
    onFinish: () => void;
    nextLabel?: string;
}

export function StepNav(props: StepNavProps): preact.JSX.Element {
    const canFinish = props.canFinish ?? true;
    const completed = props.completed ?? false;
    return (
        <div class="ac-form__actions ac-wizard__nav">
            <button
                type="button"
                class="ac-button"
                disabled={!props.canGoPrev || props.busy}
                onClick={props.onPrev}
            >
                Back
            </button>
            {props.canSkip && props.onSkip !== undefined ? (
                <button
                    type="button"
                    class="ac-button ac-wizard__skip"
                    disabled={props.busy}
                    onClick={props.onSkip}
                >
                    Skip
                </button>
            ) : null}
            {props.isLast ? (
                completed ? null : (
                    <button
                        type="button"
                        class="ac-button ac-button--primary"
                        disabled={props.busy || !canFinish}
                        onClick={props.onFinish}
                    >
                        {props.busy ? 'Saving…' : 'Finish & save'}
                    </button>
                )
            ) : (
                <button
                    type="button"
                    class="ac-button ac-button--primary"
                    disabled={!props.canGoNext || props.busy}
                    onClick={props.onNext}
                >
                    {props.nextLabel ?? 'Next'}
                </button>
            )}
        </div>
    );
}

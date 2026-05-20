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
    onPrev: () => void;
    onNext: () => void;
    onSkip?: () => void;
    onFinish: () => void;
    nextLabel?: string;
}

export function StepNav(props: StepNavProps): preact.JSX.Element {
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
                <button
                    type="button"
                    class="ac-button ac-button--primary"
                    disabled={props.busy}
                    onClick={props.onFinish}
                >
                    {props.busy ? 'Saving…' : 'Finish & save'}
                </button>
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

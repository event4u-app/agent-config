import type { ComponentChildren } from 'preact';

export function FieldError(
    { id, children }: { id: string; children: ComponentChildren },
): preact.JSX.Element {
    return (
        <p class="ac-field__error" id={id} role="alert" aria-live="polite">
            {children}
        </p>
    );
}

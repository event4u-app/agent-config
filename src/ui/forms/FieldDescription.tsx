import type { ComponentChildren } from 'preact';

export function FieldDescription(
    { id, children }: { id: string; children: ComponentChildren },
): preact.JSX.Element {
    return (
        <p class="ac-field__description" id={id}>
            {children}
        </p>
    );
}

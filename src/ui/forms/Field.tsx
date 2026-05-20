/**
 * Field — wraps every form primitive with the shared label / description /
 * error layout. Per Phase 2 accessibility note:
 *   - every primitive has an `<label for>`,
 *   - errors are announced via `aria-live="polite"`,
 *   - focus management is the caller's job (SchemaForm focuses the
 *     first errored input on submit-failure).
 */

import type { ComponentChildren } from 'preact';
import { FieldDescription } from './FieldDescription.js';
import { FieldError } from './FieldError.js';

export interface FieldProps {
    id: string;
    label: string;
    description?: string | undefined;
    error?: string | undefined;
    children: ComponentChildren;
}

export function Field({ id, label, description, error, children }: FieldProps): preact.JSX.Element {
    const descId = description !== undefined ? `${id}-desc` : undefined;
    const errId = error !== undefined ? `${id}-err` : undefined;
    return (
        <div class="ac-field" data-invalid={error !== undefined ? 'true' : undefined}>
            <label class="ac-field__label" for={id}>{label}</label>
            {description !== undefined ? (
                <FieldDescription id={descId!}>{description}</FieldDescription>
            ) : null}
            <div class="ac-field__control" aria-describedby={descId} aria-errormessage={errId}>
                {children}
            </div>
            {error !== undefined ? <FieldError id={errId!}>{error}</FieldError> : null}
        </div>
    );
}

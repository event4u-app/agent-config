import { useState } from 'preact/hooks';
import { Field } from './Field.js';

export interface AutocompleteProps {
    id: string;
    name: string;
    label: string;
    value: string;
    suggestions: string[];
    description?: string | undefined;
    error?: string | undefined;
    placeholder?: string | undefined;
    onChange: (next: string) => void;
}

/**
 * Free-text input with non-binding suggestions. Datalist semantics —
 * the user may type anything; the suggestions only hint at common values.
 * Used for `personal.ide`, `project.upstream_repo`, and similar string
 * fields the schema models as `z.string()` (no enum).
 */
export function Autocomplete(props: AutocompleteProps): preact.JSX.Element {
    const [listId] = useState(() => `${props.id}-list`);
    return (
        <Field id={props.id} label={props.label} description={props.description} error={props.error}>
            <input
                class="ac-input"
                type="text"
                id={props.id}
                name={props.name}
                value={props.value}
                placeholder={props.placeholder}
                list={listId}
                aria-invalid={props.error !== undefined ? 'true' : undefined}
                onInput={(e): void => props.onChange((e.currentTarget as HTMLInputElement).value)}
            />
            <datalist id={listId}>
                {props.suggestions.map((s) => (
                    <option key={s} value={s} />
                ))}
            </datalist>
        </Field>
    );
}

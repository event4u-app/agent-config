import { Field } from './Field.js';

export interface TextInputProps {
    id: string;
    name: string;
    label: string;
    value: string;
    description?: string | undefined;
    error?: string | undefined;
    placeholder?: string | undefined;
    onChange: (next: string) => void;
}

export function TextInput(props: TextInputProps): preact.JSX.Element {
    return (
        <Field id={props.id} label={props.label} description={props.description} error={props.error}>
            <input
                class="ac-input"
                type="text"
                id={props.id}
                name={props.name}
                value={props.value}
                placeholder={props.placeholder}
                aria-invalid={props.error !== undefined ? 'true' : undefined}
                onInput={(e): void => props.onChange((e.currentTarget as HTMLInputElement).value)}
            />
        </Field>
    );
}

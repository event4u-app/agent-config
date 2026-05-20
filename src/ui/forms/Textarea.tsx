import { Field } from './Field.js';

export interface TextareaProps {
    id: string;
    name: string;
    label: string;
    value: string;
    description?: string | undefined;
    error?: string | undefined;
    placeholder?: string | undefined;
    rows?: number | undefined;
    onChange: (next: string) => void;
}

export function Textarea(props: TextareaProps): preact.JSX.Element {
    return (
        <Field id={props.id} label={props.label} description={props.description} error={props.error}>
            <textarea
                class="ac-textarea"
                id={props.id}
                name={props.name}
                rows={props.rows ?? 6}
                placeholder={props.placeholder}
                aria-invalid={props.error !== undefined ? 'true' : undefined}
                onInput={(e): void => props.onChange((e.currentTarget as HTMLTextAreaElement).value)}
            >
                {props.value}
            </textarea>
        </Field>
    );
}

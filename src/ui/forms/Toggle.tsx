import { Field } from './Field.js';

export interface ToggleProps {
    id: string;
    name: string;
    label: string;
    value: boolean;
    description?: string | undefined;
    error?: string | undefined;
    onChange: (next: boolean) => void;
}

export function Toggle(props: ToggleProps): preact.JSX.Element {
    return (
        <Field id={props.id} label={props.label} description={props.description} error={props.error}>
            <label class="ac-toggle">
                <input
                    type="checkbox"
                    id={props.id}
                    name={props.name}
                    checked={props.value}
                    aria-invalid={props.error !== undefined ? 'true' : undefined}
                    onChange={(e): void => props.onChange((e.currentTarget as HTMLInputElement).checked)}
                />
                <span class="ac-toggle__track" aria-hidden="true"></span>
                <span class="ac-toggle__state">{props.value ? 'On' : 'Off'}</span>
            </label>
        </Field>
    );
}

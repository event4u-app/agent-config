import { Field } from './Field.js';

export interface RadioOption {
    value: string;
    label?: string | undefined;
}

export interface RadioProps {
    id: string;
    name: string;
    label: string;
    value: string;
    options: RadioOption[];
    description?: string | undefined;
    error?: string | undefined;
    onChange: (next: string) => void;
}

export function Radio(props: RadioProps): preact.JSX.Element {
    // Enums render as native <select> rather than radio-group when > 3 options
    // to keep dense forms readable. The component name keeps the schema-driven
    // mapping simple (enum → Radio); the actual control is "best fit".
    const useSelect = props.options.length > 3;
    return (
        <Field id={props.id} label={props.label} description={props.description} error={props.error}>
            {useSelect ? (
                <select
                    class="ac-input"
                    id={props.id}
                    name={props.name}
                    value={props.value}
                    aria-invalid={props.error !== undefined ? 'true' : undefined}
                    onChange={(e): void => props.onChange((e.currentTarget as HTMLSelectElement).value)}
                >
                    {props.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label ?? (opt.value === '' ? '(none)' : opt.value)}
                        </option>
                    ))}
                </select>
            ) : (
                <div class="ac-radio-group" role="radiogroup" aria-labelledby={`${props.id}-label`}>
                    {props.options.map((opt) => {
                        const optId = `${props.id}-${opt.value || 'none'}`;
                        return (
                            <label class="ac-radio" key={opt.value} for={optId}>
                                <input
                                    type="radio"
                                    id={optId}
                                    name={props.name}
                                    value={opt.value}
                                    checked={opt.value === props.value}
                                    onChange={(): void => props.onChange(opt.value)}
                                />
                                <span>{opt.label ?? (opt.value === '' ? '(none)' : opt.value)}</span>
                            </label>
                        );
                    })}
                </div>
            )}
        </Field>
    );
}

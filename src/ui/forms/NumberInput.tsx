import { Field } from './Field.js';

export interface NumberInputProps {
    id: string;
    name: string;
    label: string;
    value: number;
    description?: string | undefined;
    error?: string | undefined;
    min?: number | undefined;
    max?: number | undefined;
    step?: number | undefined;
    integer?: boolean | undefined;
    onChange: (next: number) => void;
}

export function NumberInput(props: NumberInputProps): preact.JSX.Element {
    const step = props.step ?? (props.integer === true ? 1 : 'any');
    return (
        <Field id={props.id} label={props.label} description={props.description} error={props.error}>
            <input
                class="ac-input"
                type="number"
                id={props.id}
                name={props.name}
                value={Number.isFinite(props.value) ? String(props.value) : '0'}
                min={props.min}
                max={props.max}
                step={typeof step === 'number' ? step : step}
                aria-invalid={props.error !== undefined ? 'true' : undefined}
                onInput={(e): void => {
                    const raw = (e.currentTarget as HTMLInputElement).value;
                    const n = raw === '' ? 0 : Number(raw);
                    props.onChange(Number.isFinite(n) ? n : 0);
                }}
            />
        </Field>
    );
}

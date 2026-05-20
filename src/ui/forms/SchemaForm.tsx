/**
 * Schema-driven renderer. Walks the JSON schema flattened by
 * `flattenSchema`, picks the right primitive per leaf kind, and pipes
 * value reads/writes through `getValueAt` / `setValueAt`.
 *
 * The form is uncontrolled relative to the schema (the schema is
 * static for a session) but fully controlled relative to values —
 * the caller owns the values signal and the per-field error map.
 */

import type { ComponentChildren } from 'preact';
import { TextInput } from './TextInput.js';
import { NumberInput } from './NumberInput.js';
import { Toggle } from './Toggle.js';
import { Radio } from './Radio.js';
import { Textarea } from './Textarea.js';
import {
    flattenSchema,
    getValueAt,
    setValueAt,
    type JsonSchemaLeaf,
    type JsonValue,
    type FlatField,
    type Section,
} from './schemaTypes.js';

export interface SchemaFormProps {
    schema: JsonSchemaLeaf;
    values: Record<string, JsonValue>;
    errors?: Record<string, string>;
    onChange: (next: Record<string, JsonValue>) => void;
    actions?: ComponentChildren;
}

function pathKey(path: string[]): string {
    return path.join('.');
}

function renderField(
    field: FlatField,
    values: Record<string, JsonValue>,
    errors: Record<string, string>,
    onChange: (next: Record<string, JsonValue>) => void,
): preact.JSX.Element | null {
    const id = pathKey(field.path);
    const name = id;
    const raw = getValueAt(values, field.path);
    const err = errors[id];

    const update = (v: JsonValue): void => {
        onChange(setValueAt(values, field.path, v));
    };

    switch (field.kind) {
        case 'string': {
            const v = typeof raw === 'string' ? raw : '';
            // Long-form free text → Textarea. Pattern: anything ending in
            // `_patterns`, or array-shaped text. Default = single line.
            if (v.length > 80) {
                return (
                    <Textarea
                        id={id}
                        name={name}
                        label={field.label}
                        description={field.description}
                        error={err}
                        value={v}
                        onChange={update}
                    />
                );
            }
            return (
                <TextInput
                    id={id}
                    name={name}
                    label={field.label}
                    description={field.description}
                    error={err}
                    value={v}
                    onChange={update}
                />
            );
        }
        case 'enum': {
            const v = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
            const opts = (field.options ?? []).map((o) => ({ value: String(o) }));
            return (
                <Radio
                    id={id}
                    name={name}
                    label={field.label}
                    description={field.description}
                    error={err}
                    value={v}
                    options={opts}
                    onChange={update}
                />
            );
        }
        case 'number':
        case 'integer': {
            const v = typeof raw === 'number' ? raw : 0;
            return (
                <NumberInput
                    id={id}
                    name={name}
                    label={field.label}
                    description={field.description}
                    error={err}
                    value={v}
                    integer={field.kind === 'integer'}
                    min={field.min}
                    max={field.max}
                    onChange={update}
                />
            );
        }
        case 'boolean': {
            const v = typeof raw === 'boolean' ? raw : false;
            return (
                <Toggle
                    id={id}
                    name={name}
                    label={field.label}
                    description={field.description}
                    error={err}
                    value={v}
                    onChange={update}
                />
            );
        }
        case 'array-of-strings': {
            const list = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
            const v = (list as string[]).join('\n');
            return (
                <Textarea
                    id={id}
                    name={name}
                    label={field.label}
                    description={`${field.description ?? ''} (one entry per line)`.trim()}
                    error={err}
                    value={v}
                    onChange={(next): void => {
                        const items = next.split('\n').map((s) => s.trim()).filter((s) => s !== '');
                        update(items as unknown as JsonValue);
                    }}
                />
            );
        }
        default:
            return null;
    }
}

function SectionBlock({
    section,
    values,
    errors,
    onChange,
}: {
    section: Section;
    values: Record<string, JsonValue>;
    errors: Record<string, string>;
    onChange: (next: Record<string, JsonValue>) => void;
}): preact.JSX.Element {
    return (
        <section class="ac-section" aria-labelledby={`section-${pathKey(section.path)}`}>
            <h2 class="ac-section__title" id={`section-${pathKey(section.path)}`}>
                {section.label}
            </h2>
            {section.description !== undefined ? (
                <p class="ac-section__description">{section.description}</p>
            ) : null}
            <div class="ac-section__fields">
                {section.fields.map((f) => (
                    <div key={pathKey(f.path)}>{renderField(f, values, errors, onChange)}</div>
                ))}
            </div>
        </section>
    );
}

export function SchemaForm(props: SchemaFormProps): preact.JSX.Element {
    const sections = flattenSchema(props.schema);
    const errors = props.errors ?? {};
    return (
        <form class="ac-form" onSubmit={(e): void => e.preventDefault()}>
            {sections.map((s) => (
                <SectionBlock
                    key={pathKey(s.path)}
                    section={s}
                    values={props.values}
                    errors={errors}
                    onChange={props.onChange}
                />
            ))}
            {props.actions !== undefined ? <div class="ac-form__actions">{props.actions}</div> : null}
        </form>
    );
}

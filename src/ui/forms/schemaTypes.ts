/**
 * Minimal JSON-Schema-7 shape the UI consumes.
 *
 * The backend ships the schema via `GET /api/v1/settings.schema` (and
 * the `schema` field of the settings GET response). We don't pull
 * `@types/json-schema` into the UI bundle to keep gzip footprint low;
 * this hand-cut interface matches what `zod-to-json-schema` emits for
 * `settingsSchema` (target=jsonSchema7, no `$ref`s thanks to inlining).
 */

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export interface JsonSchemaLeaf {
    type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | string;
    description?: string;
    default?: JsonValue;
    enum?: Array<string | number>;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    properties?: Record<string, JsonSchemaLeaf>;
    required?: string[];
    items?: JsonSchemaLeaf;
    additionalProperties?: boolean | JsonSchemaLeaf;
}

export type FieldKind =
    | 'string'
    | 'enum'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'array-of-strings'
    | 'unsupported';

export interface FlatField {
    path: string[];
    kind: FieldKind;
    label: string;
    description?: string | undefined;
    options?: Array<string | number> | undefined;
    min?: number | undefined;
    max?: number | undefined;
}

export interface Section {
    path: string[];
    label: string;
    description?: string | undefined;
    fields: FlatField[];
}

function humanise(key: string): string {
    return key
        .replace(/_/g, ' ')
        .replace(/\./g, ' › ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function leafKind(leaf: JsonSchemaLeaf): FieldKind {
    if (leaf.enum !== undefined && leaf.enum.length > 0) return 'enum';
    if (leaf.type === 'integer') return 'integer';
    if (leaf.type === 'number') return 'number';
    if (leaf.type === 'boolean') return 'boolean';
    if (leaf.type === 'string') return 'string';
    if (leaf.type === 'array' && leaf.items?.type === 'string') return 'array-of-strings';
    return 'unsupported';
}

function toField(path: string[], leaf: JsonSchemaLeaf): FlatField {
    const kind = leafKind(leaf);
    return {
        path,
        kind,
        label: humanise(path[path.length - 1] ?? ''),
        description: leaf.description,
        options: leaf.enum,
        min: leaf.minimum,
        max: leaf.maximum,
    };
}

/**
 * Walks the schema one level deep into objects, flattening each top-level
 * key into a section whose `fields` are its direct leaves. Deeper nested
 * objects (`cost.budgets`, `chat_history.text_limits`) become nested
 * sections — depth ≤ 2 per roadmap Phase 2.
 */
export function flattenSchema(root: JsonSchemaLeaf): Section[] {
    const sections: Section[] = [];
    const top = root.properties ?? {};
    for (const [key, leaf] of Object.entries(top)) {
        if (leaf.type === 'object' && leaf.properties !== undefined) {
            const fields: FlatField[] = [];
            for (const [subKey, subLeaf] of Object.entries(leaf.properties)) {
                if (subLeaf.type === 'object' && subLeaf.properties !== undefined) {
                    for (const [leafKey, deep] of Object.entries(subLeaf.properties)) {
                        fields.push(toField([key, subKey, leafKey], deep));
                    }
                } else {
                    fields.push(toField([key, subKey], subLeaf));
                }
            }
            sections.push({
                path: [key],
                label: humanise(key),
                description: leaf.description,
                fields,
            });
        } else {
            // Top-level scalar — group under a synthetic "general" section
            const general = sections.find((s) => s.path[0] === '__general');
            const field = toField([key], leaf);
            if (general === undefined) {
                sections.unshift({
                    path: ['__general'],
                    label: 'General',
                    fields: [field],
                });
            } else {
                general.fields.push(field);
            }
        }
    }
    return sections;
}

export function getValueAt(obj: Record<string, JsonValue>, path: string[]): JsonValue | undefined {
    let cur: JsonValue | undefined = obj;
    for (const seg of path) {
        if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
        cur = (cur as Record<string, JsonValue>)[seg];
    }
    return cur;
}

export function setValueAt(
    obj: Record<string, JsonValue>,
    path: string[],
    value: JsonValue,
): Record<string, JsonValue> {
    if (path.length === 0) return obj;
    const [head, ...rest] = path;
    if (head === undefined) return obj;
    const next: Record<string, JsonValue> = { ...obj };
    if (rest.length === 0) {
        next[head] = value;
        return next;
    }
    const child = next[head];
    const childObj =
        child !== null && typeof child === 'object' && !Array.isArray(child)
            ? (child as Record<string, JsonValue>)
            : {};
    next[head] = setValueAt(childObj, rest, value);
    return next;
}

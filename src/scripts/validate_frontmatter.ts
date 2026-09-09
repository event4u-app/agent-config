#!/usr/bin/env tsx
/**
 * validate_frontmatter.ts — frontmatter validator (Draft-07 subset).
 *
 * Ported from the retired Python `src/scripts/validate_frontmatter.py` (ADR-200 —
 * Python→TS migration, Phase 4 / Wave 4a). The public surface, CLI flags,
 * exit codes, stdout/stderr split, and finding-message strings are pinned
 * byte-for-byte by tests. The retired Python implementation was deleted in the same
 * PR; the dispatcher resolves this `.ts`.
 *
 * Validates the YAML frontmatter of an agent artefact (skill, rule, command,
 * persona) against its JSON-Schema in `src/scripts/schemas/`.
 *
 * Public surface (snake_case preserved, byte-for-byte error parity):
 *   - SchemaError (class with the same fields + `format`)
 *   - parse_frontmatter(text) -> [data|null, lineOffset]
 *   - strict_yaml_error(text) -> error string | null
 *   - load_schema(artefactType) -> schema object (throws on missing)
 *   - apply_schema_defaults(data, schema) -> data (in place)
 *   - validate(data, schema) -> SchemaError[]
 *
 * Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour. The lenient subset
 * parser (used for schema validation) supports scalar / boolean / integer /
 * inline-list / block-list / one-level-nested-block. The `strict_yaml_error`
 * gate uses the `yaml` package as the source of truth (same parser real
 * consumers use), mirroring PyYAML in the original.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { artefact_roots } from './_lib/agent_src.js';
import { KERNEL_RULE_ID_SET } from './_lib/kernel_rules.js';
import {
    frequency_prose_conflicts,
    has_frequency_override,
    is_frequency,
} from './_lib/obligation_frequency.js';

// Free-form YAML value alias. The lenient subset parser produces strings,
// numbers, booleans, the empty string, nested objects, and arrays of those.
// Documented `any`-free alias per the porting contract.
export type YamlValue =
    | string
    | number
    | boolean
    | null
    | YamlValue[]
    | { [key: string]: YamlValue };

const _FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

// --- SchemaError -----------------------------------------------------------

export class SchemaError {
    readonly path: string;
    readonly rule: string;
    readonly message: string;
    readonly severity: string; // "error" (fatal) | "warning" (advisory)

    constructor(pathStr: string, rule: string, message: string, severity = 'error') {
        this.path = pathStr;
        this.rule = rule;
        this.message = message;
        this.severity = severity;
    }

    format(file?: string | null, line?: number | null): string {
        let prefix = file ?? '<data>';
        if (line !== undefined && line !== null) {
            prefix = `${prefix}:${line}`;
        }
        const marker = this.severity === 'warning' ? '⚠️ ' : '';
        return `${prefix} – ${marker}${this.rule} at ${this.path} – ${this.message}`;
    }
}

// --- Frontmatter parser (stdlib-only, YAML subset) -------------------------

/**
 * Extract and parse the YAML frontmatter block.
 *
 * Returns `[parsed, lineOffset]`. `lineOffset` is the 1-based line number
 * where the frontmatter body begins. Mirrors `parse_frontmatter`.
 */
export function parse_frontmatter(
    text: string,
): [Record<string, YamlValue> | null, number] {
    const match = _FRONTMATTER_RE.exec(text);
    if (!match) {
        return [null, 0];
    }
    const body = match[1] ?? '';
    const before = text.slice(0, match.index);
    const lineOffset = countNewlines(before) + 2; // +2 for `---\n`
    return [_parse_yaml_block(body), lineOffset];
}

function countNewlines(s: string): number {
    let n = 0;
    for (let i = 0; i < s.length; i += 1) {
        if (s.charCodeAt(i) === 10) {
            n += 1;
        }
    }
    return n;
}

// --- Strict-YAML gate ------------------------------------------------------
//
// The `yaml` package is the strict source of truth (same parser real
// consumers use). Tests can disable it via `_set_yaml(null)` to exercise the
// structural fallback, mirroring the Python tests' `monkeypatch.setattr(V,
// "_yaml", None)`.

type YamlLoader = (body: string) => YamlValue;

const _defaultYaml: YamlLoader = (body) =>
    parseYaml(body, { version: '1.1' }) as YamlValue;

let _yaml: YamlLoader | null = _defaultYaml;

/** Test seam: swap the strict YAML loader (pass `null` for the fallback). */
export function _set_yaml(loader: YamlLoader | null): void {
    _yaml = loader;
}

/** Restore the default strict YAML loader. */
export function _reset_yaml(): void {
    _yaml = _defaultYaml;
}

/**
 * Reject frontmatter that the lenient subset parser accepts but a real
 * YAML parser rejects.
 *
 * `_parse_yaml_block` is deliberately forgiving (it strips matching outer
 * quotes without checking the inner content), so malformed frontmatter such
 * as `description: "say "hi" now"` (unescaped inner quotes) or
 * `description: a: b` (a bare `": "` that reads as a nested mapping)
 * sails through schema validation here — then fails to load in stricter
 * consumers (Zed, any PyYAML-based reader). This gate closes that gap.
 *
 * Returns a one-line error message, or `null` when the frontmatter is valid
 * YAML. When the strict loader is available it is the source of truth;
 * otherwise the stdlib structural fallback catches the two known top-level
 * shapes so the gate never silently no-ops.
 */
export function strict_yaml_error(text: string): string | null {
    const match = _FRONTMATTER_RE.exec(text);
    if (!match) {
        return null; // missing frontmatter is flagged elsewhere
    }
    const body = match[1] ?? '';

    if (_yaml !== null) {
        let loaded: YamlValue;
        try {
            loaded = _yaml(body);
        } catch (exc) {
            const msg = exc instanceof Error ? exc.message : String(exc);
            return `invalid YAML: ${msg.split('\n')[0] ?? ''}`;
        }
        if (loaded !== null && loaded !== undefined && !isPlainObject(loaded)) {
            return 'frontmatter is not a mapping';
        }
        return null;
    }

    return _structural_yaml_error(body);
}

/**
 * Stdlib fallback for `strict_yaml_error` when the YAML loader is unavailable.
 *
 * Covers the two shapes that have actually shipped broken: a double-quoted
 * scalar with an unescaped inner `"`, and a bare scalar containing `": "`
 * (or a trailing `:`) that a YAML parser reads as a nested mapping. Only
 * top-level `key: value` lines are checked — the real parser covers the
 * nested case when present.
 */
function _structural_yaml_error(body: string): string | null {
    for (const raw of body.split('\n')) {
        if (
            raw === '' ||
            /\s/.test(raw[0] ?? '') ||
            raw.trimStart().startsWith('#')
        ) {
            continue;
        }
        const m = /^([\w-]+):\s*(.*)$/.exec(raw.replace(/\s+$/, ''));
        if (!m) {
            continue;
        }
        const key = m[1] as string;
        const val = (m[2] as string).trim();
        if (val === '') {
            continue;
        }
        if (val.startsWith('"')) {
            if (val.length === 1 || !val.endsWith('"')) {
                return `${key}: unterminated double-quoted value`;
            }
            const inner = val.slice(1, -1);
            if (inner.replace(/\\"/g, '').includes('"')) {
                return `${key}: unescaped double-quote inside a double-quoted value (escape it as \\")`;
            }
        } else if (
            !val.startsWith("'") &&
            !(val.startsWith('[') && val.endsWith(']'))
        ) {
            if (val.includes(': ') || val.endsWith(':')) {
                return `${key}: unquoted value contains ": " (reads as a mapping) — wrap the value in quotes`;
            }
        }
    }
    return null;
}

function _coerce(value: string): YamlValue {
    const v = value.trim();
    if (v === '') {
        return '';
    }
    if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
    ) {
        return v.slice(1, -1);
    }
    if (v.toLowerCase() === 'true') {
        return true;
    }
    if (v.toLowerCase() === 'false') {
        return false;
    }
    if (/^-?[0-9]+$/.test(v)) {
        return Number.parseInt(v, 10);
    }
    return v;
}

function _parse_inline_list(value: string): YamlValue[] {
    const inner = value.trim().slice(1, -1).trim();
    if (!inner) {
        return [];
    }
    return _split_commas(inner).map((item) => _coerce(item));
}

function _split_commas(text: string): string[] {
    const parts: string[] = [];
    let buf: string[] = [];
    let quote: string | null = null;
    for (const ch of text) {
        if (quote) {
            buf.push(ch);
            if (ch === quote) {
                quote = null;
            }
        } else if (ch === '"' || ch === "'") {
            quote = ch;
            buf.push(ch);
        } else if (ch === ',') {
            parts.push(buf.join('').trim());
            buf = [];
        } else {
            buf.push(ch);
        }
    }
    if (buf.length > 0) {
        parts.push(buf.join('').trim());
    }
    return parts;
}

const _KEY_RE = /^([\w-]+):\s*([\s\S]*)$/;

function _parse_yaml_block(body: string): Record<string, YamlValue> {
    const result: Record<string, YamlValue> = {};
    const lines = body.split('\n');
    let i = 0;
    while (i < lines.length) {
        const line = lines[i] ?? '';
        const stripped = line.replace(/\s+$/, '');
        const trimmed = stripped.trimStart();
        if (trimmed === '' || trimmed.startsWith('#')) {
            i += 1;
            continue;
        }
        if (line.length > 0 && /\s/.test(line[0] ?? '')) {
            // orphan indented line — skip
            i += 1;
            continue;
        }
        const m = _KEY_RE.exec(stripped);
        if (!m) {
            i += 1;
            continue;
        }
        const key = m[1] as string;
        const raw = (m[2] as string).trim();
        if (raw === '') {
            // Nested block or block list — peek ahead.
            const peek = i + 1 < lines.length ? (lines[i + 1] ?? '') : '';
            if (peek.trimStart().startsWith('- ')) {
                const [items, consumed] = _consume_block_list(lines, i + 1);
                result[key] = items;
                i += 1 + consumed;
                continue;
            }
            if (peek.length > 0 && /\s/.test(peek[0] ?? '')) {
                const [nested, consumed] = _consume_nested_block(lines, i + 1);
                result[key] = nested;
                i += 1 + consumed;
                continue;
            }
            result[key] = '';
        } else if (raw.startsWith('[') && raw.endsWith(']')) {
            result[key] = _parse_inline_list(raw);
        } else {
            result[key] = _coerce(raw);
        }
        i += 1;
    }
    return result;
}

function _consume_block_list(lines: string[], start: number): [YamlValue[], number] {
    const items: YamlValue[] = [];
    let i = start;
    let itemIndent: number | null = null;
    while (i < lines.length) {
        const line = lines[i] ?? '';
        if (line.trim() === '') {
            i += 1;
            continue;
        }
        const stripped = line.trimStart();
        const leading = line.length - stripped.length;
        if (!stripped.startsWith('- ')) {
            break;
        }
        if (itemIndent === null) {
            itemIndent = leading;
        } else if (leading !== itemIndent) {
            break;
        }
        const itemBody = stripped.slice(2).trim();
        const m = _KEY_RE.exec(itemBody);
        if (m) {
            const mapping: Record<string, YamlValue> = {};
            const key = m[1] as string;
            const raw = (m[2] as string).trim();
            mapping[key] = raw !== '' ? _coerce(raw) : '';
            const contIndent = itemIndent + 2; // `- ` is two chars
            i += 1;
            while (i < lines.length) {
                const cont = lines[i] ?? '';
                if (cont.trim() === '') {
                    i += 1;
                    continue;
                }
                const contStripped = cont.trimStart();
                const contLeading = cont.length - contStripped.length;
                if (contStripped.startsWith('- ')) {
                    break;
                }
                if (contLeading <= itemIndent) {
                    break;
                }
                const cm = _KEY_RE.exec(contStripped);
                if (cm && contLeading >= contIndent) {
                    const ckey = cm[1] as string;
                    const cval = (cm[2] as string).trim();
                    mapping[ckey] = cval !== '' ? _coerce(cval) : '';
                    i += 1;
                } else {
                    break;
                }
            }
            items.push(mapping);
            continue;
        }
        items.push(_coerce(itemBody));
        i += 1;
    }
    return [items, i - start];
}

function _consume_nested_block(
    lines: string[],
    start: number,
): [Record<string, YamlValue>, number] {
    const nested: Record<string, YamlValue> = {};
    let i = start;
    let blockIndent: number | null = null;
    while (i < lines.length) {
        const line = lines[i] ?? '';
        if (line.trim() === '') {
            i += 1;
            continue;
        }
        if (!(line.length > 0 && /\s/.test(line[0] ?? ''))) {
            break;
        }
        const indent = line.length - line.trimStart().length;
        if (blockIndent === null) {
            blockIndent = indent;
        } else if (indent < blockIndent) {
            break;
        }
        const stripped = line.trim();
        if (stripped.startsWith('#')) {
            i += 1;
            continue;
        }
        const m = _KEY_RE.exec(stripped);
        if (!m) {
            i += 1;
            continue;
        }
        const key = m[1] as string;
        const raw = (m[2] as string).trim();
        if (raw.startsWith('[') && raw.endsWith(']')) {
            nested[key] = _parse_inline_list(raw);
        } else if (raw === '') {
            const peek = i + 1 < lines.length ? (lines[i + 1] ?? '') : '';
            const peekStripped = peek.trimStart();
            const peekIndent = peekStripped ? peek.length - peekStripped.length : -1;
            if (peekStripped.startsWith('- ') && peekIndent > indent) {
                const [items, consumed] = _consume_block_list(lines, i + 1);
                nested[key] = items;
                i += 1 + consumed;
                continue;
            }
            nested[key] = '';
        } else {
            nested[key] = _coerce(raw);
        }
        i += 1;
    }
    return [nested, i - start];
}

// --- Schema loader ---------------------------------------------------------

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const _SCHEMA_DIR = path.join(_HERE, 'schemas');
const _SCHEMA_CACHE = new Map<string, Record<string, YamlValue>>();

export function load_schema(artefactType: string): Record<string, YamlValue> {
    const cached = _SCHEMA_CACHE.get(artefactType);
    if (cached !== undefined) {
        return cached;
    }
    const schemaPath = path.join(_SCHEMA_DIR, `${artefactType}.schema.json`);
    if (!fs.existsSync(schemaPath)) {
        // Mirror Python `FileNotFoundError`; callers catch by name.
        const err = new Error(
            `No schema for artefact type '${artefactType}' at ${schemaPath}`,
        ) as Error & { code?: string };
        err.code = 'ENOENT';
        throw err;
    }
    const data = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as Record<
        string,
        YamlValue
    >;
    _SCHEMA_CACHE.set(artefactType, data);
    return data;
}

// --- Schema-default injection ----------------------------------------------

function isPlainObject(v: unknown): v is Record<string, YamlValue> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _object_defaults(schema: Record<string, YamlValue>): Record<string, YamlValue> {
    const out: Record<string, YamlValue> = {};
    const props = schema.properties;
    if (!isPlainObject(props)) {
        return out;
    }
    for (const [subKey, subSchemaRaw] of Object.entries(props)) {
        if (!isPlainObject(subSchemaRaw)) {
            continue;
        }
        const subSchema = subSchemaRaw;
        if ('default' in subSchema) {
            out[subKey] = subSchema.default as YamlValue;
        } else if (subSchema.type === 'object') {
            const nested = _object_defaults(subSchema);
            if (Object.keys(nested).length > 0) {
                out[subKey] = nested;
            }
        }
    }
    return out;
}

export function apply_schema_defaults(
    data: Record<string, YamlValue> | YamlValue,
    schema: Record<string, YamlValue>,
): YamlValue {
    if (!isPlainObject(data)) {
        return data;
    }
    const props = schema.properties;
    if (!isPlainObject(props)) {
        return data;
    }
    for (const [key, propRaw] of Object.entries(props)) {
        if (!isPlainObject(propRaw)) {
            continue;
        }
        const prop = propRaw;
        if ('default' in prop) {
            if (!(key in data)) {
                data[key] = prop.default as YamlValue;
            }
            continue;
        }
        if (prop.type === 'object') {
            const existing = data[key];
            if (key in data && isPlainObject(existing)) {
                _fill_object_defaults(existing, prop);
            } else if (!(key in data)) {
                const reconstructed = _object_defaults(prop);
                if (Object.keys(reconstructed).length > 0) {
                    data[key] = reconstructed;
                }
            }
        }
    }
    return data;
}

function _fill_object_defaults(
    obj: Record<string, YamlValue>,
    schema: Record<string, YamlValue>,
): void {
    const props = schema.properties;
    if (!isPlainObject(props)) {
        return;
    }
    for (const [subKey, subSchemaRaw] of Object.entries(props)) {
        if (!isPlainObject(subSchemaRaw)) {
            continue;
        }
        const subSchema = subSchemaRaw;
        if ('default' in subSchema) {
            if (!(subKey in obj)) {
                obj[subKey] = subSchema.default as YamlValue;
            }
        } else if (subSchema.type === 'object' && isPlainObject(obj[subKey])) {
            _fill_object_defaults(obj[subKey] as Record<string, YamlValue>, subSchema);
        }
    }
}

// --- Validator core (Draft-07 subset) --------------------------------------

function _typename(value: YamlValue): string {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return 'boolean';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'integer' : 'number';
    }
    if (typeof value === 'string') {
        return 'string';
    }
    if (Array.isArray(value)) {
        return 'array';
    }
    if (isPlainObject(value)) {
        return 'object';
    }
    return typeof value;
}

function _matchesType(expected: string, data: YamlValue): boolean | null {
    // Returns null when the schema type keyword is unsupported.
    switch (expected) {
        case 'object':
            return isPlainObject(data);
        case 'array':
            return Array.isArray(data);
        case 'string':
            return typeof data === 'string';
        case 'integer':
            return typeof data === 'number' && Number.isInteger(data);
        case 'number':
            return typeof data === 'number';
        case 'boolean':
            return typeof data === 'boolean';
        case 'null':
            return data === null;
        default:
            return null;
    }
}

export function validate(data: YamlValue, schema: Record<string, YamlValue>): SchemaError[] {
    const errors: SchemaError[] = [];
    _validate_node(data, schema, '$', errors);
    return errors;
}

function _validate_node(
    data: YamlValue,
    schema: Record<string, YamlValue>,
    pathStr: string,
    errors: SchemaError[],
): void {
    const expectedType = schema.type;
    if (expectedType !== undefined) {
        const expected = expectedType as string;
        // Booleans excluded from integer/number (mirrors Python bool/int split).
        if (
            (expected === 'integer' || expected === 'number') &&
            typeof data === 'boolean'
        ) {
            errors.push(
                new SchemaError(pathStr, 'type', `Expected ${expected}, got boolean`),
            );
            return;
        }
        const ok = _matchesType(expected, data);
        if (ok === null) {
            errors.push(
                new SchemaError(pathStr, 'type', `Unsupported schema type '${expected}'`),
            );
            return;
        }
        if (!ok) {
            errors.push(
                new SchemaError(
                    pathStr,
                    'type',
                    `Expected ${expected}, got ${_typename(data)}`,
                ),
            );
            return;
        }
    }

    if (isPlainObject(data)) {
        _validate_object(data, schema, pathStr, errors);
    } else if (Array.isArray(data)) {
        _validate_array(data, schema, pathStr, errors);
    } else if (typeof data === 'string') {
        _validate_string(data, schema, pathStr, errors);
    } else if (typeof data === 'number' && Number.isInteger(data)) {
        _validate_integer(data, schema, pathStr, errors);
    }

    // enum is type-independent
    if ('enum' in schema) {
        const enumValues = schema.enum;
        if (Array.isArray(enumValues) && !enumContains(enumValues, data)) {
            errors.push(
                new SchemaError(
                    pathStr,
                    'enum',
                    `Value ${pyRepr(data)} is not one of ${pyListRepr(enumValues)}`,
                ),
            );
        }
    }
}

function enumContains(enumValues: YamlValue[], data: YamlValue): boolean {
    return enumValues.some((v) => v === data);
}

function _validate_object(
    data: Record<string, YamlValue>,
    schema: Record<string, YamlValue>,
    pathStr: string,
    errors: SchemaError[],
): void {
    const required = Array.isArray(schema.required) ? (schema.required as YamlValue[]) : [];
    for (const key of required) {
        if (typeof key === 'string' && !(key in data)) {
            errors.push(
                new SchemaError(`${pathStr}.${key}`, 'required', `Missing required property '${key}'`),
            );
        }
    }

    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    const additional = 'additionalProperties' in schema ? schema.additionalProperties : true;

    for (const [key, value] of Object.entries(data)) {
        const childPath = `${pathStr}.${key}`;
        if (key in properties) {
            const childSchema = properties[key];
            if (isPlainObject(childSchema)) {
                _validate_node(value, childSchema, childPath, errors);
            }
        } else if (additional === false) {
            errors.push(
                new SchemaError(
                    childPath,
                    'additionalProperties',
                    `Unknown property '${key}' not allowed`,
                ),
            );
        }
    }
}

function _validate_array(
    data: YamlValue[],
    schema: Record<string, YamlValue>,
    pathStr: string,
    errors: SchemaError[],
): void {
    const itemsSchema = schema.items;
    if (itemsSchema !== undefined && isPlainObject(itemsSchema)) {
        data.forEach((item, index) => {
            _validate_node(item, itemsSchema, `${pathStr}[${index}]`, errors);
        });
    }
    const minItems = schema.minItems;
    if (typeof minItems === 'number' && data.length < minItems) {
        errors.push(
            new SchemaError(pathStr, 'minItems', `Array has ${data.length} items, need ≥ ${minItems}`),
        );
    }
}

function _validate_string(
    data: string,
    schema: Record<string, YamlValue>,
    pathStr: string,
    errors: SchemaError[],
): void {
    const pattern = schema.pattern;
    if (typeof pattern === 'string' && !pyReSearch(pattern, data)) {
        errors.push(
            new SchemaError(pathStr, 'pattern', `Value ${pyRepr(data)} does not match /${pattern}/`),
        );
    }
    const minLen = schema.minLength;
    if (typeof minLen === 'number' && data.length < minLen) {
        errors.push(
            new SchemaError(pathStr, 'minLength', `String length ${data.length} < ${minLen}`, 'warning'),
        );
    }
    const maxLen = schema.maxLength;
    if (typeof maxLen === 'number' && data.length > maxLen) {
        errors.push(
            new SchemaError(pathStr, 'maxLength', `String length ${data.length} > ${maxLen}`, 'warning'),
        );
    }
}

function _validate_integer(
    data: number,
    schema: Record<string, YamlValue>,
    pathStr: string,
    errors: SchemaError[],
): void {
    const minimum = schema.minimum;
    if (typeof minimum === 'number' && data < minimum) {
        errors.push(new SchemaError(pathStr, 'minimum', `${data} < ${minimum}`));
    }
}

// --- Python repr / regex parity helpers ------------------------------------

/**
 * Python `re.search` semantics over a pattern that originated from a JSON
 * schema. JSON-schema patterns are ECMA-flavoured; the small set used in the
 * repo schemas (`^...$`, character classes, anchors) is compatible with the
 * JS engine. Compiled fresh per call to mirror Python's stateless `re.search`.
 */
function pyReSearch(pattern: string, value: string): boolean {
    try {
        return new RegExp(pattern).test(value);
    } catch {
        // An invalid pattern in Python would raise at match time; replicate by
        // treating it as a non-match so the error surfaces as a pattern failure.
        return false;
    }
}

/** Python `repr()` of a scalar for the enum/pattern message parity. */
function pyRepr(value: YamlValue): string {
    if (typeof value === 'string') {
        return `'${value}'`;
    }
    if (value === null) {
        return 'None';
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    return String(value);
}

/** Python `repr()` of the schema's `enum` list for the message parity. */
function pyListRepr(values: YamlValue[]): string {
    return `[${values.map((v) => pyRepr(v)).join(', ')}]`;
}

/**
 * Rule-only checks for `obligation_frequency` — the field the coverage join
 * reads.
 *
 * Two obligations, at two severities:
 *
 *  - **Required, as an error.** A rule with no declared period cannot be joined
 *    against its carrier's firing frequency, so the audit reports it
 *    `unclassified` — which is a hole in the finding, not a pass. Making it
 *    mandatory at authoring time is the pin: a NEW rule with a per-turn
 *    obligation and no turn-carrier is caught here rather than in a later audit.
 *
 *  - **Prose agreement, as a warning.** A keyword heuristic will be noisy, so it
 *    never fails a build.
 *
 * The nine kernel rules are exempt, and the exemption is DERIVED from
 * `_lib/kernel_rules.ts` — the same locked set `block_kernel_rule_writes.ts`
 * enforces. They are not exempt because kernel rules are special; they are
 * exempt because that guard denies the write, so requiring the field would make
 * `task ci` unsatisfiable for any agent. Deriving it rather than hand-listing it
 * closes the exemption automatically: the moment a rule leaves the kernel, the
 * field becomes required with no edit here.
 */
export function check_obligation_frequency(
    filePath: string,
    text: string,
    data: Record<string, YamlValue>,
): SchemaError[] {
    const id = path.basename(filePath).replace(/\.md$/, '');
    if (KERNEL_RULE_ID_SET.has(id)) return [];

    const declared = data['obligation_frequency'];
    if (!is_frequency(declared)) {
        return [
            new SchemaError(
                '$.obligation_frequency',
                'required',
                "Missing required property 'obligation_frequency' — how often this rule's " +
                    'obligation comes due. Without it check_enforcement_coverage cannot join ' +
                    "the rule against its carrier's firing frequency and reports it unclassified.",
            ),
        ];
    }
    if (has_frequency_override(text)) return [];

    const conflicts = frequency_prose_conflicts(text, declared);
    if (conflicts.length === 0) return [];
    return [
        new SchemaError(
            '$.obligation_frequency',
            'frequency-prose-drift',
            `declared '${declared}', but the prose reads as ${conflicts.join(' / ')} — ` +
                'either the declaration or the prose moved. Silence an audited mismatch with a ' +
                '`# frequency-override: <reason>` comment in the frontmatter.',
            'warning',
        ),
    ];
}

/**
 * Shape check for a skill's optional `scope:` write-scope declaration.
 *
 * WHAT IT CHECKS, and only this: when `scope:` is present it carries exactly ONE
 * of `verification_command` / `verification_reason`. The `access` enum, the
 * `pattern` shape and the closed key set are `skill.schema.json`'s and are
 * already enforced by {@link validate} — including through `skill_linter`, which
 * calls the same validator. This covers the one constraint JSON Schema cannot
 * express in the subset implemented here: **exactly one of two optional
 * siblings**. `oneOf` / `anyOf` / `not` are not implemented (nor are
 * `minProperties` / `maxProperties`), so a schema-only attempt would be silently
 * inert — which is worse than absent, because it reads as enforced.
 *
 * WHY EXACTLY ONE. Neither branch is a formality. A declaration with NEITHER is a
 * scope claim nobody can check and nobody has excused, which is the pro-forma
 * field the whole shape exists to avoid. A declaration with BOTH reads as
 * "verified, with an excuse attached" — and the excuse is the half a reader would
 * act on, so the pair is strictly less informative than either alone.
 *
 * WHY IT LIVES HERE AND NOT IN `skill_linter.ts`. It was written there and
 * `check_source_size_budget` refused it: `skill_linter.ts` is 4,742 lines, the
 * ratchet sums lines ABOVE 1,500 per file, and 63 added lines were 63 new
 * violations against a shrink-only baseline. Extracting the body to `_lib` still
 * left the import plus the call, i.e. +2, and a ratchet turns one way. This file
 * is 1,120 lines, so the same code costs zero — and it sits beside
 * {@link check_obligation_frequency}, the existing precedent for an
 * artefact-specific check that the generic validator cannot express.
 *
 * WHAT IT DOES NOT CHECK, stated plainly: whether the declared paths are the
 * paths the skill actually writes. Nothing observes a skill's writes, so that
 * half is model-carried and `scope:` is a declaration, not a control.
 */
export function check_scope_declaration(data: Record<string, YamlValue>): SchemaError[] {
    const scope = data['scope'];
    if (scope === null || typeof scope !== 'object' || Array.isArray(scope)) return [];
    const keys = scope as Record<string, YamlValue>;
    const hasCommand = typeof keys['verification_command'] === 'string';
    const hasReason = typeof keys['verification_reason'] === 'string';
    if (hasCommand && hasReason) {
        return [
            new SchemaError(
                '$.scope',
                'scope-verification-both',
                'declares BOTH verification_command and verification_reason — exactly one. A reason ' +
                    'beside a command reads as a verified claim with an excuse attached, and the excuse ' +
                    'is the half a reader would act on.',
            ),
        ];
    }
    if (!hasCommand && !hasReason) {
        return [
            new SchemaError(
                '$.scope',
                'scope-verification-missing',
                'declares neither verification_command nor verification_reason — exactly one. A scope ' +
                    'claim with no command and no stated reason is unfalsifiable, which is the ' +
                    'pro-forma field this declaration exists to avoid.',
            ),
        ];
    }
    return [];
}

// --- CLI entry point -------------------------------------------------------

/** Yield `[artefact_type, path]` pairs for all lintable artefacts. */
export function _iter_artefacts(root: string): Array<[string, string]> {
    const targets: Array<[string, string]> = [];
    const mapping: Array<[string, string[]]> = [
        ['skill', _rglobSorted(path.join(root, 'skills'), 'SKILL.md')],
        ['rule', _rglobSorted(path.join(root, 'rules'), '*.md')],
        ['command', _rglobSorted(path.join(root, 'commands'), '*.md')],
        ['subagent', _rglobSorted(path.join(root, 'subagents'), '*.md')],
        [
            'persona',
            _globSorted(path.join(root, 'personas'), '*.md').filter(
                (f) => path.basename(f).toLowerCase() !== 'readme.md',
            ),
        ],
    ];
    for (const [artefactType, files] of mapping) {
        for (const f of files) {
            if (_isSymlink(f)) {
                continue;
            }
            targets.push([artefactType, f]);
        }
    }
    return targets;
}

// argparse parity. `prog` matches the retired Python implementation's `sys.argv[0]` basename
// (`validate_frontmatter.py`) so the usage/error text is byte-identical to the
// pre-migration CLI the golden corpus captured.
const _PROG = 'validate_frontmatter.py';
const _USAGE = `usage: ${_PROG} [-h] [--root ROOT]\n`;
const _HELP =
    _USAGE +
    '\n' +
    'Validate agent-artefact frontmatter against JSON-Schema.\n' +
    '\n' +
    'optional arguments:\n' +
    '  -h, --help   show this help message and exit\n' +
    '  --root ROOT  Source root to scan. Default: every artefact root discovered by\n' +
    '               src/scripts/_lib/agent_src.artefact_roots() (legacy +\n' +
    '               packages/*).\n';

/** Emit argparse's `usage:\n{prog}: error: {msg}\n` to stderr and exit 2. */
function _argError(msg: string): number {
    process.stderr.write(_USAGE);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    return 2;
}

export function _main(argv: string[]): number {
    let rootArg: string | null = null;
    const unrecognized: string[] = [];
    // Mirror argparse: `--root <value>` / `--root=<value>`, `-h`/`--help`,
    // and `error: unrecognized arguments: ...` for anything else.
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] as string;
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(_HELP);
            return 0;
        }
        if (arg === '--root') {
            const next = argv[i + 1];
            if (next === undefined) {
                return _argError('argument --root: expected one argument');
            }
            rootArg = next;
            i += 1;
        } else if (arg.startsWith('--root=')) {
            rootArg = arg.slice('--root='.length);
        } else {
            unrecognized.push(arg);
        }
    }
    if (unrecognized.length > 0) {
        return _argError(`unrecognized arguments: ${unrecognized.join(' ')}`);
    }

    let roots: string[];
    if (rootArg !== null) {
        if (!_isDir(rootArg)) {
            process.stderr.write(`error: source root not found: ${rootArg}\n`);
            return 2;
        }
        roots = [rootArg];
    } else {
        roots = artefact_roots();
        if (roots.length === 0) {
            process.stderr.write(
                'error: no artefact roots found ' +
                    '(checked .agent-src.uncondensed/ and packages/*/.agent-src.uncondensed/)\n',
            );
            return 2;
        }
    }

    let total = 0;
    let failing = 0;
    let warned = 0;
    for (const root of roots) {
        for (const [artefactType, p] of _iter_artefacts(root)) {
            total += 1;
            const text = fs.readFileSync(p, 'utf-8');
            const yamlErr = strict_yaml_error(text);
            if (yamlErr !== null) {
                failing += 1;
                process.stdout.write(
                    `❌ [${artefactType}] ${p}: invalid-yaml at (frontmatter) – ${yamlErr}\n`,
                );
                // Frontmatter doesn't parse — schema results would be noise.
                continue;
            }
            const [data] = parse_frontmatter(text);
            if (data === null) {
                // Other tooling flags missing frontmatter; don't double-report.
                continue;
            }
            const schema = load_schema(artefactType);
            // Inject schema defaults before validation so artefacts that omit a
            // field equal to its default still satisfy `required`
            // (road-to-abstraction-reduction.md Phase 1).
            apply_schema_defaults(data, schema);
            const errors = validate(data, schema);
            if (artefactType === 'rule') {
                errors.push(...check_obligation_frequency(p, text, data));
            }
            if (artefactType === 'skill') {
                errors.push(...check_scope_declaration(data));
            }
            const fatal = errors.filter((e) => e.severity === 'error');
            const warnings = errors.filter((e) => e.severity === 'warning');
            if (fatal.length > 0) {
                failing += 1;
            }
            if (warnings.length > 0) {
                warned += 1;
            }
            for (const error of errors) {
                const marker = error.severity === 'warning' ? '⚠️ ' : '❌ ';
                process.stdout.write(
                    `${marker}[${artefactType}] ${p}: ${error.rule} at ${error.path} – ${error.message}\n`,
                );
            }
        }
    }

    process.stdout.write(
        `\n== Frontmatter schema: ${total} artefacts, ${failing} failing, ${warned} with warnings ==\n`,
    );
    return failing > 0 ? 1 : 0;
}

// --- Filesystem helpers (pathlib parity) -----------------------------------

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isSymlink(p: string): boolean {
    try {
        return fs.lstatSync(p).isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * `Path.rglob(pattern)` for the two patterns the validator uses: an exact
 * filename (`SKILL.md`) or a `*.md` glob. Recursive, sorted by full path
 * (mirrors `sorted(...rglob(...))` over `PosixPath`).
 */
function _rglobSorted(dir: string, pattern: string): string[] {
    const out: string[] = [];
    const matchExact = !pattern.includes('*');
    const suffix = pattern.startsWith('*') ? pattern.slice(1) : pattern;
    const walk = (d: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (matchExact ? entry.name === pattern : entry.name.endsWith(suffix)) {
                out.push(full);
            }
        }
    };
    walk(dir);
    out.sort();
    return out;
}

/** `Path.glob(pattern)` — non-recursive, sorted. Only `*.md` is used. */
function _globSorted(dir: string, pattern: string): string[] {
    const out: string[] = [];
    const suffix = pattern.startsWith('*') ? pattern.slice(1) : pattern;
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        if (!entry.isDirectory() && entry.name.endsWith(suffix)) {
            out.push(path.join(dir, entry.name));
        }
    }
    out.sort();
    return out;
}

// Run the CLI only when executed directly (via tsx / the dispatcher), not
// when imported by a test.
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const isCliEntry =
    _isCliEntry();
if (isCliEntry) {
    process.exit(_main(process.argv.slice(2)));
}

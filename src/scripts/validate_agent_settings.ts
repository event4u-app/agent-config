#!/usr/bin/env tsx
/**
 * Agent-settings schema validator (rule_loading_tier untangle, 2026-06-01).
 *
 * TypeScript twin of `src/scripts/validate_agent_settings.py` (ADR-090,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — no flags,
 * exit codes (0 every file validates, 1 schema violation, 3 bootstrap
 * failure), stdout output (GitHub `::error::` annotations + summary line),
 * the same template-placeholder substitution, the same checked-file set
 * (template + local settings via the `_lib/agent_settings` twin), and the
 * same Draft-07 enum/type constraints from the shared schema JSON. No
 * behaviour changes — latent bugs replicated.
 *
 * DIVERGENCE NOTE (documented per ADR-090 §6): the underlying jsonschema
 * error PROSE is Python-version-dependent. This twin reproduces the schema's
 * enum/type constraint set and the error LOCATION + sort order; the exact
 * jsonschema message wording is approximated. For a clean repo (the only
 * golden-parity invocation in CI) no violations fire, so the OK summary line
 * is byte-identical. See docs/migration/divergences/src-scripts-validate_agent_settings.md.
 *
 * Validates `src/config/agent-settings.template.yml` and any local
 * `.agent-settings.yml` against `scripts/schemas/agent-settings.schema.json`.
 *
 * Exit codes:
 * - 0 — every checked file validates.
 * - 1 — at least one schema violation (unknown enum value, wrong type).
 * - 3 — bootstrap failure (missing dependency / schema file).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { project_settings_path } from './_lib/agent_settings.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/validate_agent_settings.ts → two dirs up is the repo root.
// Mirrors the Python `Path(__file__).resolve().parent.parent.parent`.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'src', 'scripts', 'schemas', 'agent-settings.schema.json');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'src', 'config', 'agent-settings.template.yml');
const LOCAL_PATHS = [project_settings_path(REPO_ROOT)];

// Installer-default substitutions, mirroring scripts/install.py so the
// template validates as it would after a fresh `balanced` install.
const PLACEHOLDERS: Record<string, string> = {
    __RULE_LOADING_TIER__: 'balanced',
    __USER_TYPE__: '',
};

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _load_yaml(p: string, substitute: boolean): Record<string, unknown> | null {
    if (!_isFile(p)) {
        return null;
    }
    let text = fs.readFileSync(p, 'utf-8');
    if (substitute) {
        for (const [placeholder, value] of Object.entries(PLACEHOLDERS)) {
            text = text.split(placeholder).join(value);
        }
    }
    let raw: unknown;
    try {
        // PyYAML safe_load uses YAML 1.1 semantics; match that so bare
        // off/on/yes/no coerce identically.
        raw = parseYaml(text, { version: '1.1' });
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stdout.write(`::error file=${p}::malformed YAML: ${msg}\n`);
        return {};
    }
    if (raw === null || raw === undefined) {
        return {};
    }
    if (!_isPlainObject(raw)) {
        process.stdout.write(`::error file=${p}::top-level must be a mapping\n`);
        return {};
    }
    return raw;
}

interface SchemaError {
    path: string[];
    message: string;
}

// --- Minimal Draft-07 validator (subset: type, enum, properties) -------------
//
// The shared schema only uses `type` (object/string), `enum` (string enums at
// fixed nested paths), `properties`, and `additionalProperties: true` (no
// constraint). This validator covers exactly that surface. Errors carry the
// instance path (mirrors jsonschema `error.path`) and an approximated message.

interface JsonSchema {
    type?: string;
    enum?: unknown[];
    properties?: Record<string, JsonSchema>;
    additionalProperties?: boolean | JsonSchema;
}

function _iter_errors(doc: unknown, schema: JsonSchema, atPath: string[]): SchemaError[] {
    const errors: SchemaError[] = [];

    if (schema.type !== undefined) {
        if (!_matchesType(doc, schema.type)) {
            errors.push({
                path: atPath,
                message: `${_pyRepr(doc)} is not of type ${_pyStr(schema.type)}`,
            });
            // jsonschema continues to other keywords, but a type mismatch
            // typically short-circuits sub-property descent. Return here.
            return errors;
        }
    }

    if (schema.enum !== undefined) {
        if (!schema.enum.some((e) => _deepEq(e, doc))) {
            const opts = schema.enum.map((e) => _pyRepr(e)).join(', ');
            errors.push({
                path: atPath,
                message: `${_pyRepr(doc)} is not one of [${opts}]`,
            });
        }
    }

    if (schema.properties && _isPlainObject(doc)) {
        for (const [key, subSchema] of Object.entries(schema.properties)) {
            if (Object.prototype.hasOwnProperty.call(doc, key)) {
                errors.push(..._iter_errors(doc[key], subSchema, [...atPath, key]));
            }
        }
    }

    return errors;
}

function _matchesType(v: unknown, t: string): boolean {
    switch (t) {
        case 'object':
            return _isPlainObject(v);
        case 'string':
            return typeof v === 'string';
        case 'array':
            return Array.isArray(v);
        case 'number':
            return typeof v === 'number';
        case 'integer':
            return typeof v === 'number' && Number.isInteger(v);
        case 'boolean':
            return typeof v === 'boolean';
        case 'null':
            return v === null;
        default:
            return true;
    }
}

function _deepEq(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

/** Approximate Python repr for primitives used in enum/type messages. */
function _pyRepr(v: unknown): string {
    if (typeof v === 'string') {
        return `'${v}'`;
    }
    if (v === null) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    if (_isPlainObject(v) || Array.isArray(v)) {
        return JSON.stringify(v);
    }
    return String(v);
}

function _pyStr(v: unknown): string {
    return typeof v === 'string' ? `'${v}'` : String(v);
}

function _validate(p: string, doc: Record<string, unknown>, schema: JsonSchema): number {
    const errors = _iter_errors(doc, schema, []);
    // sorted(validator.iter_errors(doc), key=lambda e: list(e.path))
    errors.sort((a, b) => _cmpPath(a.path, b.path));
    if (errors.length === 0) {
        return 0;
    }
    for (const err of errors) {
        const loc = err.path.map((x) => String(x)).join('.') || '<root>';
        process.stdout.write(`::error file=${p}::${loc}: ${err.message}\n`);
    }
    return errors.length;
}

function _cmpPath(a: string[], b: string[]): number {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        if ((a[i] as string) < (b[i] as string)) return -1;
        if ((a[i] as string) > (b[i] as string)) return 1;
    }
    return a.length - b.length;
}

export function main(): number {
    if (!_isFile(SCHEMA_PATH)) {
        process.stdout.write(`::error::schema missing: ${SCHEMA_PATH}\n`);
        return 3;
    }
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8')) as JsonSchema;

    let total_errors = 0;
    let checked = 0;

    const template = _load_yaml(TEMPLATE_PATH, true);
    if (template === null) {
        process.stdout.write(`::error file=${TEMPLATE_PATH}::template missing\n`);
        return 1;
    }
    total_errors += _validate(TEMPLATE_PATH, template, schema);
    checked += 1;

    for (const local of LOCAL_PATHS) {
        const doc = _load_yaml(local, false);
        if (doc === null) {
            continue;
        }
        total_errors += _validate(local, doc, schema);
        checked += 1;
    }

    if (total_errors) {
        process.stdout.write(
            `agent-settings schema: ${total_errors} violation(s) across ${checked} file(s)\n`,
        );
        return 1;
    }
    process.stdout.write(`agent-settings schema: OK (${checked} file(s) validated)\n`);
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { REPO_ROOT, SCHEMA_PATH, TEMPLATE_PATH, PLACEHOLDERS, _iter_errors };

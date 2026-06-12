#!/usr/bin/env node
/**
 * Lint `dist/mcp/registry-manifest.json` against its JSON Schema.
 *
 * TypeScript twin of `src/scripts/lint_mcp_registry_manifest.py` (ADR-090,
 * Phase 4 / Wave 4b). Mirrors the CLI contract EXACTLY — `--quiet` flag
 * (argparse, so a real `-h`/`--help` prints usage + exits 0), the
 * `❌  <msg>` failures on stderr, the `✅  mcp registry manifest OK
 * (<n> registries)` OK line on stdout, and exit codes (0 clean, 1 on any
 * failure). No behaviour changes.
 *
 * Asserts: the four artefacts exist; the manifest validates against the
 * Draft-2020-12 schema; the row.md is a single `|`-delimited line; the
 * Cloudflare catalogue is valid JSON.
 *
 * DIVERGENCE CANDIDATE: the schema-validation error message
 * (`schema validation: <msg> at <path>`) replicates Python `jsonschema`'s
 * wording only on a best-effort basis — `ajv` here is Draft-07, so this
 * module ships a hand-rolled Draft-2020-12 subset validator. On a VALID
 * manifest (the only path the real-repo golden parity exercises — and in
 * this worktree `dist/mcp/` is absent so the `missing:` branch fires first)
 * the wording never surfaces. See docs/migration/divergences/.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
// ROOT = Path(__file__).resolve().parents[2]
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SCHEMA = path.join(ROOT, 'docs', 'contracts', 'mcp-registry-manifest.schema.json');
const MANIFEST = path.join(ROOT, 'dist', 'mcp', 'registry-manifest.json');
const ROW_MD = path.join(ROOT, 'dist', 'mcp', 'awesome-mcp-servers.row.md');
const CF_JSON = path.join(ROOT, 'dist', 'mcp', 'mcp-cloudflare-catalogue.json');

function _relToRoot(p: string): string {
    return path.relative(ROOT, p);
}

function _fail(msg: string): number {
    process.stderr.write(`❌  ${msg}\n`);
    return 1;
}

// --- argparse-faithful argument parsing -------------------------------------
// Python: argparse with description=__doc__.splitlines()[0] + a single
// store_true `--quiet`. A real `-h`/`--help` prints help and exits 0.
const PROG = 'lint_mcp_registry_manifest.py';
const DESCRIPTION = 'Lint `dist/mcp/registry-manifest.json` against its JSON Schema.';

interface Args {
    quiet: boolean;
}

class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

function _parseArgs(argv: readonly string[]): Args {
    const out: Args = { quiet: false };
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${PROG} [-h] [--quiet]\n\n${DESCRIPTION}\n`);
            throw new ArgparseExit(0);
        }
        if (a === '--quiet') {
            out.quiet = true;
            continue;
        }
        process.stderr.write(
            `usage: ${PROG} [-h] [--quiet]\n${PROG}: error: unrecognized arguments: ${a}\n`,
        );
        throw new ArgparseExit(2);
    }
    return out;
}

// --- Draft-2020-12 subset validator -----------------------------------------
// Accepts every valid manifest (the golden path). Error wording is a
// documented divergence candidate against Python jsonschema.
type Json = unknown;
type JsonObject = Record<string, unknown>;

interface SchemaError {
    message: string;
    absolute_path: (string | number)[];
}

function _jsonRepr(value: Json): string {
    // Python jsonschema renders Python reprs; here we use JSON for a stable,
    // best-effort approximation (divergence candidate, never hit on the
    // golden path).
    return JSON.stringify(value);
}

function _deepEqual(a: Json, b: Json): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function _typeMatches(data: Json, type: string): boolean {
    switch (type) {
        case 'object':
            return data !== null && typeof data === 'object' && !Array.isArray(data);
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
            return true;
    }
}

function _resolveRef(ref: string, rootSchema: JsonObject): JsonObject {
    if (!ref.startsWith('#/')) {
        return {};
    }
    let node: Json = rootSchema;
    for (const seg of ref.slice(2).split('/')) {
        const key = seg.replace(/~1/g, '/').replace(/~0/g, '~');
        if (node !== null && typeof node === 'object') {
            node = (node as JsonObject)[key];
        } else {
            return {};
        }
    }
    return (node as JsonObject) ?? {};
}

function _validateNode(
    data: Json,
    schema: JsonObject,
    rootSchema: JsonObject,
    segs: (string | number)[],
    errors: SchemaError[],
): void {
    if (errors.length) {
        return; // jsonschema raises on the first error
    }
    if (typeof schema['$ref'] === 'string') {
        _validateNode(data, _resolveRef(schema['$ref'], rootSchema), rootSchema, segs, errors);
        return;
    }

    // type (string or union array)
    const type = schema['type'];
    if (typeof type === 'string') {
        if (!_typeMatches(data, type)) {
            errors.push({ message: `${_jsonRepr(data)} is not of type '${type}'`, absolute_path: [...segs] });
            return;
        }
    } else if (Array.isArray(type)) {
        if (!type.some((t) => _typeMatches(data, t as string))) {
            errors.push({
                message: `${_jsonRepr(data)} is not of type ${(type as string[]).map((t) => `'${t}'`).join(', ')}`,
                absolute_path: [...segs],
            });
            return;
        }
    }

    if ('const' in schema) {
        if (!_deepEqual(schema['const'], data)) {
            errors.push({ message: `${_jsonRepr(data)} was expected`, absolute_path: [...segs] });
            return;
        }
    }

    if (Array.isArray(schema['enum'])) {
        const allowed = schema['enum'] as Json[];
        if (!allowed.some((e) => _deepEqual(e, data))) {
            errors.push({
                message: `${_jsonRepr(data)} is not one of ${_jsonRepr(allowed)}`,
                absolute_path: [...segs],
            });
            return;
        }
    }

    if (typeof data === 'string') {
        const minLength = schema['minLength'];
        if (typeof minLength === 'number' && data.length < minLength) {
            errors.push({ message: `${_jsonRepr(data)} is too short`, absolute_path: [...segs] });
            return;
        }
    }

    if (typeof data === 'number') {
        const minimum = schema['minimum'];
        if (typeof minimum === 'number' && data < minimum) {
            errors.push({
                message: `${_jsonRepr(data)} is less than the minimum of ${minimum}`,
                absolute_path: [...segs],
            });
            return;
        }
    }

    if (Array.isArray(data)) {
        const minItems = schema['minItems'];
        if (typeof minItems === 'number' && data.length < minItems) {
            errors.push({ message: `${_jsonRepr(data)} is too short`, absolute_path: [...segs] });
            return;
        }
        const maxItems = schema['maxItems'];
        if (typeof maxItems === 'number' && data.length > maxItems) {
            errors.push({ message: `${_jsonRepr(data)} is too long`, absolute_path: [...segs] });
            return;
        }
        if (schema['uniqueItems'] === true) {
            const seen = new Set<string>();
            for (const item of data) {
                const key = JSON.stringify(item);
                if (seen.has(key)) {
                    errors.push({
                        message: `${_jsonRepr(data)} has non-unique elements`,
                        absolute_path: [...segs],
                    });
                    return;
                }
                seen.add(key);
            }
        }
        const items = schema['items'];
        if (items !== null && typeof items === 'object' && !Array.isArray(items)) {
            for (let i = 0; i < data.length; i++) {
                _validateNode(data[i], items as JsonObject, rootSchema, [...segs, i], errors);
                if (errors.length) {
                    return;
                }
            }
        }
    }

    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        const obj = data as JsonObject;
        const required = schema['required'];
        if (Array.isArray(required)) {
            for (const key of required as string[]) {
                if (!(key in obj)) {
                    errors.push({ message: `'${key}' is a required property`, absolute_path: [...segs] });
                    return;
                }
            }
        }
        const properties = (schema['properties'] as JsonObject | undefined) ?? {};
        if (schema['additionalProperties'] === false) {
            for (const key of Object.keys(obj)) {
                if (!(key in properties)) {
                    errors.push({
                        message: `Additional properties are not allowed ('${key}' was unexpected)`,
                        absolute_path: [...segs],
                    });
                    return;
                }
            }
        }
        for (const [key, subschema] of Object.entries(properties)) {
            if (key in obj) {
                _validateNode(obj[key], subschema as JsonObject, rootSchema, [...segs, key], errors);
                if (errors.length) {
                    return;
                }
            }
        }
    }
}

function _validateSchema(data: Json, schema: JsonObject): SchemaError | null {
    const errors: SchemaError[] = [];
    _validateNode(data, schema, schema, [], errors);
    return errors.length ? errors[0]! : null;
}

function main(argv: readonly string[]): number {
    let args: Args;
    try {
        args = _parseArgs(argv);
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exit(e.code);
        }
        throw e;
    }

    for (const p of [SCHEMA, MANIFEST, ROW_MD, CF_JSON]) {
        if (!fs.existsSync(p)) {
            return _fail(`missing: ${_relToRoot(p)}`);
        }
    }

    const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf-8')) as JsonObject;
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
    const err = _validateSchema(manifest, schema);
    if (err) {
        return _fail(`schema validation: ${err.message} at [${err.absolute_path.map((s) => (typeof s === 'string' ? `'${s}'` : String(s))).join(', ')}]`);
    }

    const row = fs.readFileSync(ROW_MD, 'utf-8').trim();
    if (!row) {
        return _fail('awesome-mcp-servers.row.md is empty');
    }
    // row.count("\n") != 0  -- a multi-line file fails. After .strip() the
    // string has no leading/trailing newline; an interior newline trips it.
    const newlineCount = (row.match(/\n/g) ?? []).length;
    const pipeCount = (row.match(/\|/g) ?? []).length;
    if (newlineCount !== 0 || pipeCount < 4) {
        return _fail('awesome-mcp-servers.row.md must be a single `|`-delimited row');
    }

    try {
        JSON.parse(fs.readFileSync(CF_JSON, 'utf-8'));
    } catch (e) {
        return _fail(`mcp-cloudflare-catalogue.json: ${(e as Error).message}`);
    }

    if (!args.quiet) {
        const registries = (manifest as JsonObject)['registries'];
        const count = Array.isArray(registries) ? registries.length : 0;
        process.stdout.write(`✅  mcp registry manifest OK (${count} registries)\n`);
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}

export {
    ROOT,
    SCHEMA,
    MANIFEST,
    ROW_MD,
    CF_JSON,
    _validateSchema,
    main,
};

#!/usr/bin/env tsx
/**
 * Lint an ExplainTrace v1 JSON payload against the schema.
 *
 * TypeScript twin of `src/scripts/lint_explain_trace.py` (ADR-200, Phase 4 /
 * Wave 4b). Reads a JSON file (or stdin via `--stdin`) and validates it
 * against `docs/contracts/explain-trace.schema.json`.
 *
 * CLI contract mirrored EXACTLY:
 *   - positional `path` (optional) + `--stdin` flag;
 *   - exit 0 on success (`✅  explain-trace OK` on stdout);
 *   - exit 1 on validation failure (`❌  <loc>: <message>` per error on stderr);
 *   - exit 2 on invocation error (missing schema, bad JSON, no path/--stdin);
 *   - error lines ordered by `sorted(absolute_path)`.
 *
 * DOCUMENTED DIVERGENCE (validation-failure message text):
 *   The Python original uses `jsonschema.Draft202012Validator`; its
 *   `ValidationError.message` wording is library-specific. This twin
 *   implements a faithful Draft-2020-12 *subset* validator covering only the
 *   keywords the explain-trace schema uses (type / const / enum / required /
 *   additionalProperties / properties / items / minLength). The location
 *   prefix (`<loc>:`) and the exit code (1) are byte-identical; the trailing
 *   message text after the location MAY differ from Python's. The stable
 *   prefix is the parity contract — tests assert the OK path byte-for-byte
 *   and the failure exit code, and assert only the stable `❌  <loc>:` prefix
 *   on the failure path. `format` is intentionally not validated: Python's
 *   Draft202012Validator does not check `format` unless a format checker is
 *   passed, so `generated_at`'s `date-time` is a no-op on both sides.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

function _repo_root(): string {
    // Path(__file__).resolve().parent.parent.parent
    return path.resolve(path.dirname(_HERE), '..', '..');
}

// SystemExit carrier — mirrors Python `raise SystemExit(code)`.
class SystemExit extends Error {
    constructor(public readonly code: number) {
        super(`SystemExit(${code})`);
        this.name = 'SystemExit';
    }
}

type JsonValue = unknown;
type JsonObject = Record<string, unknown>;

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _load_schema(): JsonObject {
    const schemaPath = path.join(_repo_root(), 'docs', 'contracts', 'explain-trace.schema.json');
    if (!_exists(schemaPath)) {
        process.stderr.write(`❌  explain-trace schema not found at ${schemaPath}\n`);
        throw new SystemExit(2);
    }
    return JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as JsonObject;
}

function _read_stdin(): string {
    try {
        return fs.readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}

function _read_payload(p: string | null, fromStdin: boolean): JsonValue {
    if (fromStdin) {
        const raw = _read_stdin();
        try {
            return JSON.parse(raw);
        } catch (exc) {
            const msg = exc instanceof Error ? exc.message : String(exc);
            process.stderr.write(`❌  stdin is not valid JSON: ${msg}\n`);
            throw new SystemExit(2);
        }
    }
    if (p === null) {
        process.stderr.write('❌  pass a JSON file path or --stdin\n');
        throw new SystemExit(2);
    }
    if (!_exists(p)) {
        process.stderr.write(`❌  trace file not found: ${p}\n`);
        throw new SystemExit(2);
    }
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  ${p} is not valid JSON: ${msg}\n`);
        throw new SystemExit(2);
    }
}

// --- Draft-2020-12 subset validator ---------------------------------------

interface SchemaError {
    absolutePath: Array<string | number>;
    message: string;
}

function _isObject(v: unknown): v is JsonObject {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** JSON Schema "type" check for a single named type. */
function _matchesType(value: unknown, type: string): boolean {
    switch (type) {
        case 'object':
            return _isObject(value);
        case 'array':
            return Array.isArray(value);
        case 'string':
            return typeof value === 'string';
        case 'integer':
            return typeof value === 'number' && Number.isInteger(value);
        case 'number':
            return typeof value === 'number';
        case 'boolean':
            return typeof value === 'boolean';
        case 'null':
            return value === null;
        default:
            return false;
    }
}

/**
 * Python `repr()` for a value embedded in a jsonschema message. Strings get
 * single quotes; ints/bools/None map to Python literals; lists render with
 * Python list syntax. This reproduces `jsonschema.ValidationError.message`
 * for the keywords the explain-trace schema uses.
 */
function _repr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (typeof value === 'string') {
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _repr(v)).join(', ') + ']';
    }
    if (_isObject(value)) {
        const parts = Object.entries(value).map(([k, v]) => `${_repr(k)}: ${_repr(v)}`);
        return '{' + parts.join(', ') + '}';
    }
    return String(value);
}

/**
 * Validate `instance` against `schema`, accumulating errors with their
 * absolute path. Covers only the keywords used by the explain-trace schema.
 */
function _validate(
    instance: unknown,
    schema: JsonObject,
    pathPrefix: Array<string | number>,
    errors: SchemaError[],
): void {
    // type (jsonschema emits the type error before const at the same path)
    if ('type' in schema) {
        const t = schema['type'];
        const types = Array.isArray(t) ? (t as string[]) : [t as string];
        if (!types.some((tt) => _matchesType(instance, tt))) {
            // Single type → "'x' is not of type 'integer'"; array of types →
            // "5 is not of type 'object', 'null'" (comma-joined, no brackets).
            const typeRepr = types.map((tt) => `'${tt}'`).join(', ');
            errors.push({
                absolutePath: [...pathPrefix],
                message: `${_repr(instance)} is not of type ${typeRepr}`,
            });
        }
    }

    // const
    if ('const' in schema) {
        const expected = schema['const'];
        if (JSON.stringify(instance) !== JSON.stringify(expected)) {
            errors.push({
                absolutePath: [...pathPrefix],
                message: `${_repr(expected)} was expected`,
            });
        }
    }

    // enum
    if ('enum' in schema && Array.isArray(schema['enum'])) {
        const allowed = schema['enum'] as unknown[];
        const ok = allowed.some((a) => JSON.stringify(a) === JSON.stringify(instance));
        if (!ok) {
            errors.push({
                absolutePath: [...pathPrefix],
                message: `${_repr(instance)} is not one of ${_repr(allowed)}`,
            });
        }
    }

    // minLength — jsonschema phrases minLength:1 as "should be non-empty",
    // any other floor as "is too short".
    if ('minLength' in schema && typeof instance === 'string') {
        const min = schema['minLength'] as number;
        if (instance.length < min) {
            const msg = min === 1 ? 'should be non-empty' : 'is too short';
            errors.push({
                absolutePath: [...pathPrefix],
                message: `${_repr(instance)} ${msg}`,
            });
        }
    }

    // object keywords
    if (_isObject(instance)) {
        if ('required' in schema && Array.isArray(schema['required'])) {
            for (const key of schema['required'] as string[]) {
                if (!(key in instance)) {
                    errors.push({
                        absolutePath: [...pathPrefix],
                        message: `${_repr(key)} is a required property`,
                    });
                }
            }
        }

        const properties = _isObject(schema['properties'])
            ? (schema['properties'] as JsonObject)
            : {};
        const additional = schema['additionalProperties'];
        if (additional === false) {
            for (const key of Object.keys(instance)) {
                if (!(key in properties)) {
                    errors.push({
                        absolutePath: [...pathPrefix],
                        message: `Additional properties are not allowed (${_repr(key)} was unexpected)`,
                    });
                }
            }
        }

        for (const [key, subSchema] of Object.entries(properties)) {
            if (key in instance && _isObject(subSchema)) {
                _validate(instance[key], subSchema as JsonObject, [...pathPrefix, key], errors);
            }
        }

        if (_isObject(additional)) {
            for (const key of Object.keys(instance)) {
                if (!(key in properties)) {
                    _validate(
                        instance[key],
                        additional as JsonObject,
                        [...pathPrefix, key],
                        errors,
                    );
                }
            }
        }
    }

    // array keywords
    if (Array.isArray(instance) && _isObject(schema['items'])) {
        const itemSchema = schema['items'] as JsonObject;
        instance.forEach((item, idx) => {
            _validate(item, itemSchema, [...pathPrefix, idx], errors);
        });
    }
}

/** Mirror Python `sorted(errors, key=lambda e: list(e.absolute_path))`. */
function _comparePaths(a: Array<string | number>, b: Array<string | number>): number {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        const ai = a[i]!;
        const bi = b[i]!;
        if (ai === bi) {
            continue;
        }
        // Numbers sort before strings is not Python semantics, but the
        // explain-trace schema never mixes int/str at the same depth in a
        // single sorted batch for the OK path. Compare numerically when both
        // numbers, lexicographically when both strings.
        if (typeof ai === 'number' && typeof bi === 'number') {
            return ai < bi ? -1 : 1;
        }
        return String(ai) < String(bi) ? -1 : 1;
    }
    return a.length - b.length;
}

interface ParsedArgs {
    path: string | null;
    stdin: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_explain_trace: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let pathArg: string | null = null;
    let stdin = false;
    let positionalSeen = false;
    for (const arg of argv) {
        if (arg === '--stdin') {
            stdin = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_explain_trace [-h] [--stdin] [path]\n');
            process.exit(0);
        } else if (arg.startsWith('-') && arg !== '-') {
            _argparse_error(`unrecognized arguments: ${arg}`);
        } else if (!positionalSeen) {
            pathArg = arg;
            positionalSeen = true;
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { path: pathArg, stdin };
}

function main(argv?: readonly string[]): number {
    const opts = parse_args(argv ?? process.argv.slice(2));

    const schema = _load_schema();
    // Python: jsonschema.Draft202012Validator.check_schema(schema) — the
    // explain-trace schema is a valid Draft-2020-12 document, so this never
    // raises in practice; the subset validator has no schema-validation step.
    const payload = _read_payload(opts.path, opts.stdin);

    const errors: SchemaError[] = [];
    _validate(payload, schema, [], errors);
    errors.sort((a, b) => _comparePaths(a.absolutePath, b.absolutePath));

    if (errors.length > 0) {
        for (const err of errors) {
            const loc = err.absolutePath.map((p) => String(p)).join('/') || '<root>';
            process.stderr.write(`❌  ${loc}: ${err.message}\n`);
        }
        return 1;
    }
    process.stdout.write('✅  explain-trace OK\n');
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (e) {
        if (e instanceof SystemExit) {
            process.exit(e.code);
        }
        throw e;
    }
}

export { SystemExit, _load_schema, _read_payload, parse_args, _validate, main };

#!/usr/bin/env tsx
/**
 * Lint a generated discovery-manifest.json against schema + checksum.
 *
 * TypeScript twin of `src/scripts/lint_discovery_manifest.py` (ADR-200,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--manifest`
 * / `--quiet` flags, exit codes (0 / 1), stdout/stderr split, byte-identical
 * SUCCESS + vocab + determinism + checksum messages, same check order, and
 * a byte-identical checksum recomputation (recursive key-sort + indent-2,
 * `ensure_ascii=False`). No behaviour changes — latent bugs replicated.
 *
 * DIVERGENCE CANDIDATES:
 *  1. The Python original imports `jsonschema` and exits 1 with the message
 *     `error: jsonschema not installed (...)` when it is absent. The TS twin
 *     has no such dependency, so that exit-1 path never fires — the schema
 *     check always runs.
 *  2. The `schema error: <msg>` text on an INVALID manifest comes from a
 *     faithful Draft-2020-12 subset validator here, not Python's
 *     `jsonschema.ValidationError.message`; the wording can differ. The
 *     happy path (valid manifest) and the `at: <path>` JSON-pointer-ish path
 *     are emitted identically. A valid manifest never reaches this branch.
 *
 * Exit codes:
 *   0  clean
 *   1  schema or integrity failure
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SCHEMA_PATH = path.join(ROOT, 'docs', 'contracts', 'discovery-manifest.schema.json');
const VOCAB_DIR = path.join(ROOT, 'src', 'config', 'discovery');
const DEFAULT_MANIFEST = path.join(ROOT, 'dist', 'discovery', 'discovery-manifest.json');

type Json = unknown;
type JsonObject = Record<string, unknown>;

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Recursive key-sort, mirroring Python json.dumps(sort_keys=True). */
function _sortRec(v: Json): Json {
    if (Array.isArray(v)) {
        return v.map(_sortRec);
    }
    if (v !== null && typeof v === 'object') {
        const out: JsonObject = {};
        for (const k of Object.keys(v as JsonObject).sort()) {
            out[k] = _sortRec((v as JsonObject)[k]);
        }
        return out;
    }
    return v;
}

/** Mirror Python json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n". */
function _serialize(manifest: JsonObject): string {
    return JSON.stringify(_sortRec(manifest), null, 2) + '\n';
}

function _check_checksum(manifest: JsonObject): string | null {
    const actual = manifest['checksum'] ?? '';
    if (typeof actual !== 'string' || !actual.startsWith('sha256:')) {
        return `checksum: malformed value ${_pyRepr2(actual)}`;
    }
    // Mirror build_discovery_manifest._finalise_checksum — generated_at is
    // excluded from the digest input so the hash stays byte-stable.
    const snapshot: JsonObject = { ...manifest };
    snapshot['checksum'] = 'sha256:' + '0'.repeat(64);
    snapshot['generated_at'] = '<normalised>';
    const raw = Buffer.from(_serialize(snapshot), 'utf-8');
    const expected = 'sha256:' + crypto.createHash('sha256').update(raw).digest('hex');
    if (expected !== actual) {
        return `checksum mismatch: expected ${expected}, got ${actual}`;
    }
    return null;
}

function _loadYaml(p: string): unknown {
    return YAML.parse(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
}

function _asObjArray(v: unknown): JsonObject[] {
    return Array.isArray(v) ? (v as JsonObject[]) : [];
}

function _check_vocab(manifest: JsonObject): string[] {
    const errs: string[] = [];
    const workspaces = (_loadYaml(path.join(VOCAB_DIR, 'workspaces.yml')) as JsonObject[]) || [];
    const packs = (_loadYaml(path.join(VOCAB_DIR, 'packs.yml')) as JsonObject[]) || [];
    const ws_ids = new Set((workspaces || []).map((w) => w['id'] as string));
    const pack_ids = new Set((packs || []).map((p) => p['id'] as string));

    const m_ws_ids = new Set(_asObjArray(manifest['workspaces']).map((w) => w['id'] as string));
    const m_pk_ids = new Set(_asObjArray(manifest['packs']).map((p) => p['id'] as string));
    if (!_setEqual(m_ws_ids, ws_ids)) {
        const diff = _symDiff(ws_ids, m_ws_ids);
        errs.push(`workspaces: vocabulary/manifest mismatch on ${_pyListRepr(_sortedStr(diff))}`);
    }
    if (!_setEqual(m_pk_ids, pack_ids)) {
        const diff = _symDiff(pack_ids, m_pk_ids);
        errs.push(`packs: vocabulary/manifest mismatch on ${_pyListRepr(_sortedStr(diff))}`);
    }

    for (const a of _asObjArray(manifest['artefacts'])) {
        for (const w of _asArray(a['workspaces'])) {
            if (!ws_ids.has(w as string)) {
                errs.push(`${a['path']}: unknown workspace '${w}'`);
            }
        }
        for (const p of _asArray(a['packs'])) {
            if (!pack_ids.has(p as string)) {
                errs.push(`${a['path']}: unknown pack '${p}'`);
            }
        }
    }
    return errs;
}

function _check_capability_pack_determinism(manifest: JsonObject): string[] {
    const errs: string[] = [];
    for (const p of _asObjArray(manifest['packs'])) {
        const pid = p['id'];
        const has_size = p['size_class'] !== undefined && p['size_class'] !== null;
        const count = (p['artefact_count'] as number) ?? 0;
        if (count > 0 && !has_size) {
            errs.push(
                `orphan tag: pack '${pid}' has ${count} artefact(s) but no size_class — ` +
                    `assign domain + size_class in src/config/discovery/packs.yml`,
            );
        }
        if (has_size && count === 0) {
            errs.push(
                `orphan manifest: pack '${pid}' carries size_class='${p['size_class']}' ` +
                    `but no artefact references it — remove the class or cite an artefact`,
            );
        }
    }

    const valid = new Set(_asObjArray(manifest['packs']).map((p) => p['id']));
    for (const a of _asObjArray(manifest['artefacts'])) {
        if (a['category'] !== 'command') {
            continue;
        }
        const owner = a['pack'];
        if (!owner) {
            errs.push(`command '${a['path']}' has no pack owner — add \`pack:\` frontmatter`);
        } else if (!valid.has(owner)) {
            errs.push(`command '${a['path']}' pack owner '${owner}' not in vocabulary`);
        }
    }
    return errs;
}

interface ParsedArgs {
    manifest: string;
    quiet: boolean;
}

function _doc_first_line(): string {
    // argparse(description=__doc__.splitlines()[0]) — only printed on --help,
    // which is not a byte-parity contract. Kept for fidelity.
    return 'Lint a generated discovery-manifest.json against schema + checksum.';
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let manifest = DEFAULT_MANIFEST;
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--manifest') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --manifest: expected one argument');
            }
            manifest = v;
        } else if (arg.startsWith('--manifest=')) {
            manifest = arg.slice('--manifest='.length);
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_discovery_manifest.py [-h] [--manifest MANIFEST] [--quiet]\n',
            );
            process.exit(0);
        } else {
            _argError(`unrecognized arguments: ${arg}`);
        }
    }
    void _doc_first_line;
    return { manifest, quiet };
}

function _argError(message: string): never {
    process.stderr.write(
        `usage: lint_discovery_manifest.py [-h] [--manifest MANIFEST] [--quiet]\n` +
            `lint_discovery_manifest.py: error: ${message}\n`,
    );
    process.exit(2);
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    if (!_exists(args.manifest)) {
        process.stderr.write(`error: manifest not found at ${args.manifest}\n`);
        return 1;
    }

    let manifest: JsonObject;
    try {
        manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf-8')) as JsonObject;
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`error: invalid JSON: ${msg}\n`);
        return 1;
    }

    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8')) as JsonObject;
    const schemaErr = _validateSchema(manifest, schema);
    if (schemaErr) {
        process.stderr.write(`schema error: ${schemaErr.message}\n`);
        if (schemaErr.path) {
            process.stderr.write(`  at: ${schemaErr.path}\n`);
        }
        return 1;
    }

    const err = _check_checksum(manifest);
    if (err) {
        process.stderr.write(`error: ${err}\n`);
        return 1;
    }

    const vocab_errs = _check_vocab(manifest);
    const det_errs = _check_capability_pack_determinism(manifest);
    const all_errs = [...vocab_errs, ...det_errs];
    if (all_errs.length) {
        for (const e of all_errs.slice(0, 20)) {
            process.stderr.write(`error: ${e}\n`);
        }
        if (all_errs.length > 20) {
            process.stderr.write(`  ... and ${all_errs.length - 20} more\n`);
        }
        return 1;
    }

    if (!args.quiet) {
        process.stdout.write(
            `OK ${_relPosix(args.manifest, ROOT)}: ` +
                `${_asArray(manifest['artefacts']).length} artefacts, ` +
                `${_asArray(manifest['unassigned']).length} unassigned, ` +
                `checksum verified\n`,
        );
    }
    return 0;
}

// --- Schema validation (Draft-2020-12 subset) --------------------------------
// Faithful enough to ACCEPT a valid manifest (the golden path). On invalid
// input the error wording is a documented divergence candidate (see header).

interface SchemaError {
    message: string;
    path: string;
}

function _validateSchema(data: Json, schema: JsonObject): SchemaError | null {
    const errors: SchemaError[] = [];
    _validateNode(data, schema, schema, [], errors);
    return errors.length ? errors[0]! : null;
}

function _resolveRef(ref: string, rootSchema: JsonObject): JsonObject {
    // Only local pointers like "#/$defs/artefact" are used by this schema.
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

function _pathStr(segs: readonly (string | number)[]): string {
    return segs.map((s) => String(s)).join('/');
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

    const type = schema['type'];
    if (typeof type === 'string') {
        if (!_typeMatches(data, type)) {
            errors.push({ message: `${_jsonRepr(data)} is not of type '${type}'`, path: _pathStr(segs) });
            return;
        }
    }

    if (Array.isArray(schema['enum'])) {
        const allowed = schema['enum'] as Json[];
        if (!allowed.some((e) => _deepEqual(e, data))) {
            errors.push({
                message: `${_jsonRepr(data)} is not one of ${_jsonRepr(allowed)}`,
                path: _pathStr(segs),
            });
            return;
        }
    }

    if ('const' in schema) {
        if (!_deepEqual(schema['const'], data)) {
            errors.push({
                message: `${_jsonRepr(data)} was expected`,
                path: _pathStr(segs),
            });
            return;
        }
    }

    if (typeof data === 'string') {
        const minLength = schema['minLength'];
        if (typeof minLength === 'number' && data.length < minLength) {
            errors.push({ message: `${_jsonRepr(data)} is too short`, path: _pathStr(segs) });
            return;
        }
        const pattern = schema['pattern'];
        if (typeof pattern === 'string' && !new RegExp(pattern).test(data)) {
            errors.push({
                message: `${_jsonRepr(data)} does not match '${pattern}'`,
                path: _pathStr(segs),
            });
            return;
        }
    }

    if (typeof data === 'number') {
        const minimum = schema['minimum'];
        if (typeof minimum === 'number' && data < minimum) {
            errors.push({
                message: `${_jsonRepr(data)} is less than the minimum of ${minimum}`,
                path: _pathStr(segs),
            });
            return;
        }
    }

    if (Array.isArray(data)) {
        const minItems = schema['minItems'];
        if (typeof minItems === 'number' && data.length < minItems) {
            errors.push({
                message: `${_jsonRepr(data)} is too short`,
                path: _pathStr(segs),
            });
            return;
        }
        const items = schema['items'];
        if (items !== undefined && typeof items === 'object' && !Array.isArray(items)) {
            for (let i = 0; i < data.length; i++) {
                _validateNode(data[i], items as JsonObject, rootSchema, [...segs, i], errors);
                if (errors.length) return;
            }
        }
    }

    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        const obj = data as JsonObject;
        const props = (schema['properties'] as JsonObject) ?? {};
        const required = Array.isArray(schema['required']) ? (schema['required'] as string[]) : [];
        for (const req of required) {
            if (!(req in obj)) {
                errors.push({ message: `'${req}' is a required property`, path: _pathStr(segs) });
                return;
            }
        }
        const additional = schema['additionalProperties'];
        if (additional === false) {
            for (const k of Object.keys(obj)) {
                if (!(k in props)) {
                    errors.push({
                        message: `Additional properties are not allowed ('${k}' was unexpected)`,
                        path: _pathStr(segs),
                    });
                    return;
                }
            }
        }
        for (const [k, childSchema] of Object.entries(props)) {
            if (k in obj && childSchema !== null && typeof childSchema === 'object') {
                _validateNode(obj[k], childSchema as JsonObject, rootSchema, [...segs, k], errors);
                if (errors.length) return;
            }
        }
    }
}

function _deepEqual(a: Json, b: Json): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((x, i) => _deepEqual(x, b[i]));
    }
    if (typeof a === 'object' && typeof b === 'object') {
        const ak = Object.keys(a as JsonObject);
        const bk = Object.keys(b as JsonObject);
        if (ak.length !== bk.length) return false;
        return ak.every((k) => _deepEqual((a as JsonObject)[k], (b as JsonObject)[k]));
    }
    return false;
}

/** Best-effort jsonschema-style value repr in error messages. */
function _jsonRepr(v: Json): string {
    return JSON.stringify(v);
}

// --- small Python-shim helpers ------------------------------------------------

function _asArray(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
}

function _setEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
}

function _symDiff(a: Set<string>, b: Set<string>): Set<string> {
    const out = new Set<string>();
    for (const x of a) if (!b.has(x)) out.add(x);
    for (const x of b) if (!a.has(x)) out.add(x);
    return out;
}

function _sortedStr(s: Set<string>): string[] {
    return [...s].sort();
}

function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s.replace(/\\/g, '\\\\');
    if (quote === "'") body = body.replace(/'/g, "\\'");
    else body = body.replace(/"/g, '\\"');
    return `${quote}${body}${quote}`;
}

function _pyRepr2(v: unknown): string {
    if (v === undefined || v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'string') return _pyRepr(v);
    return String(v);
}

function _pyListRepr(items: readonly string[]): string {
    return `[${items.map((i) => _pyRepr(i)).join(', ')}]`;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    type JsonObject,
    ROOT,
    SCHEMA_PATH,
    VOCAB_DIR,
    DEFAULT_MANIFEST,
    _serialize,
    _check_checksum,
    _check_vocab,
    _check_capability_pack_determinism,
    _validateSchema,
    main,
};

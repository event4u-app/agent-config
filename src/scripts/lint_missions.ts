#!/usr/bin/env tsx
/**
 * WARN-ONLY mission manifest and catalog linter.
 *
 * TypeScript twin of `src/scripts/lint_missions.py` (ADR-200, Python→TypeScript
 * migration). The CLI contract is mirrored EXACTLY — argparse flags
 * (`--strict` / `--quiet` / `--check-precondition MISSION REPO`, `-h`/`--help`
 * exit 0, unknown arg → exit 2), the scan order (`sorted(MISSIONS_ROOT.iterdir())`
 * minus dot-dirs), byte-identical finding lines, the missing-schema short-circuit
 * (exit 2 strict / 0 otherwise), the stdout/stderr split, and exit codes
 * (0 warn-only / 1 strict+ERROR). snake_case kept.
 *
 * The Python original uses the `jsonschema` Draft7Validator; this twin
 * hand-rolls a Draft-07 validator covering exactly the keyword set the two
 * mission schemas use (type, required, additionalProperties [false | schema],
 * properties, $ref [#/definitions], pattern, enum, minLength, maxLength,
 * minItems, minProperties, items) and reproduces jsonschema's exact
 * `ValidationError.message` text + `iter_errors` ordering (collected, then
 * sorted by the path key) so the `<loc>: <message>` finding detail stays
 * byte-identical. `format: uri` and `default` are non-asserting in Draft-07
 * (jsonschema does not check `format` by default) — mirrored as no-ops.
 *
 * Validates every src/missions/<mission>/mission.yaml against mission.schema.json and
 * every catalog referenced by those manifests against
 * mission-catalog.schema.json. Also enforces the command-prefix allowlist on
 * every `command:` field found in catalog entries.
 *
 * Additionally exposes a --check-precondition mode (stub) documenting the
 * single-mission-per-branch guard; the live-repo git checks are left as a stub.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import YAML from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SCHEMAS_DIR = path.join(path.dirname(_HERE), 'schemas');
// Mutable bindings so tests can sandbox the scan target / schema dir (mirrors
// the pytest monkeypatch.setattr seam used by sibling lint twins).
let MISSIONS_ROOT = path.join(REPO_ROOT, 'src', 'missions');
let MISSION_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'mission.schema.json');
let CATALOG_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'mission-catalog.schema.json');

function _setMissionsRootForTest(p: string): void {
    MISSIONS_ROOT = p;
}
function _setMissionSchemaPathForTest(p: string): void {
    MISSION_SCHEMA_PATH = p;
}
function _setCatalogSchemaPathForTest(p: string): void {
    CATALOG_SCHEMA_PATH = p;
}

// ---------------------------------------------------------------------------
// Safe-command allowlist (mirrors mission-catalog.schema.json definition)
// ---------------------------------------------------------------------------
const SAFE_COMMAND_RE =
    /^(composer|php|php artisan|git|sed|rector|vendor\/bin\/[a-zA-Z0-9._/-]+)( .+)?$/;

/** Return True if cmd matches the safe-prefix allowlist. */
function _is_safe_command(cmd: string): boolean {
    return SAFE_COMMAND_RE.test(cmd.trim());
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

interface Finding {
    severity: string;
    rule: string;
    file: string;
    detail: string;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _asObject(v: JsonValue | undefined): JsonObject | null {
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
        return v as JsonObject;
    }
    return null;
}

// ---------------------------------------------------------------------------
// YAML / schema loading
// ---------------------------------------------------------------------------

/**
 * `yaml.safe_load` equivalent: PyYAML-faithful (YAML 1.1, lenient dup keys).
 *
 * PyYAML's `safe_load` boolean resolver does NOT treat the single-letter forms
 * `y`/`Y`/`n`/`N` as booleans (only the `yes|no|true|false|on|off` family) — but
 * the `yaml` npm lib's 1.1 schema does. Override the core bool tag so bare
 * `y`/`n` stay strings, matching PyYAML exactly (a latent-fidelity requirement).
 */
const _PY_BOOL_RE =
    /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/;
const _PY_BOOL_TAG = {
    tag: 'tag:yaml.org,2002:bool',
    test: _PY_BOOL_RE,
    resolve: (str: string): boolean => /^(?:y|t|on)/i.test(str),
    default: true,
};
function _safeLoad(text: string): JsonValue {
    const doc = YAML.parse(text, {
        version: '1.1',
        uniqueKeys: false,
        customTags: (tags: unknown[]) => [
            _PY_BOOL_TAG as unknown,
            ...(tags as Array<{ tag?: string; test?: unknown }>).filter(
                (t) => !(t.tag === 'tag:yaml.org,2002:bool' && t.test !== undefined),
            ),
        ],
    } as never) as JsonValue;
    return doc ?? null;
}

function _load_schema(p: string): JsonObject {
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw) as JsonObject;
}

/**
 * Return path relative to REPO_ROOT when possible; otherwise the absolute
 * string (mirrors `Path.relative_to` raising ValueError outside the root).
 */
function _rel(p: string): string {
    const r = path.relative(REPO_ROOT, p);
    if (r === '' || r.startsWith('..') || path.isAbsolute(r)) {
        return p;
    }
    return r.split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Python repr (for jsonschema message fidelity)
// ---------------------------------------------------------------------------

function _pyRepr(v: JsonValue): string {
    if (v === null) {
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    if (typeof v === 'number') {
        return String(v);
    }
    if (typeof v === 'string') {
        return _pyStrRepr(v);
    }
    if (Array.isArray(v)) {
        return `[${v.map((x) => _pyRepr(x)).join(', ')}]`;
    }
    const obj = v as JsonObject;
    const parts = Object.keys(obj).map((k) => `${_pyStrRepr(k)}: ${_pyRepr(obj[k] as JsonValue)}`);
    return `{${parts.join(', ')}}`;
}

/** Python `repr()` of a string (single-quote preference). */
function _pyStrRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// ---------------------------------------------------------------------------
// Draft-07 validator (reproducing jsonschema's message + iter_errors ordering)
// ---------------------------------------------------------------------------

interface SchemaError {
    path: Array<string | number>;
    message: string;
}

function _typeMatches(data: JsonValue, type: string): boolean {
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
    let node: JsonValue = rootSchema;
    for (const seg of ref.slice(2).split('/')) {
        const key = seg.replace(/~1/g, '/').replace(/~0/g, '~');
        const obj = _asObject(node);
        if (obj !== null) {
            node = obj[key] as JsonValue;
        } else {
            return {};
        }
    }
    return (_asObject(node) ?? {}) as JsonObject;
}

/**
 * Validate `data` against `schema`, collecting EVERY error (mirroring
 * `jsonschema.Draft7Validator.iter_errors`, which does not short-circuit) in
 * the same emission order jsonschema uses for this schema's keyword set. The
 * caller sorts by the path key, matching `sorted(..., key=lambda e: list(e.path))`.
 */
function _validateNode(
    data: JsonValue,
    schema: JsonObject,
    rootSchema: JsonObject,
    segs: Array<string | number>,
    errors: SchemaError[],
): void {
    if (typeof schema['$ref'] === 'string') {
        _validateNode(data, _resolveRef(schema['$ref'] as string, rootSchema), rootSchema, segs, errors);
        return;
    }

    const type = schema['type'];
    if (typeof type === 'string') {
        if (!_typeMatches(data, type)) {
            errors.push({ path: [...segs], message: `${_pyRepr(data)} is not of type '${type}'` });
            // jsonschema does not descend into properties/items once the type
            // is wrong, so stop validating this node's other keywords.
            return;
        }
    }

    const enumVals = schema['enum'];
    if (Array.isArray(enumVals)) {
        if (!enumVals.some((e) => _deepEqual(e as JsonValue, data))) {
            errors.push({
                path: [...segs],
                message: `${_pyRepr(data)} is not one of ${_pyRepr(enumVals as JsonValue)}`,
            });
        }
    }

    // string keywords
    if (typeof data === 'string') {
        const minLength = schema['minLength'];
        if (typeof minLength === 'number' && _pyLen(data) < minLength) {
            errors.push({
                path: [...segs],
                message:
                    minLength === 1
                        ? `${_pyRepr(data)} should be non-empty`
                        : `${_pyRepr(data)} is too short`,
            });
        }
        const maxLength = schema['maxLength'];
        if (typeof maxLength === 'number' && _pyLen(data) > maxLength) {
            errors.push({ path: [...segs], message: `${_pyRepr(data)} is too long` });
        }
        const pattern = schema['pattern'];
        if (typeof pattern === 'string' && !new RegExp(pattern).test(data)) {
            // jsonschema renders the pattern via `repr()` (`{pattern!r}`), so a
            // backslash in the pattern is doubled — use _pyStrRepr, not raw quotes.
            errors.push({
                path: [...segs],
                message: `${_pyRepr(data)} does not match ${_pyStrRepr(pattern)}`,
            });
        }
    }

    // array keywords
    if (Array.isArray(data)) {
        const minItems = schema['minItems'];
        if (typeof minItems === 'number' && data.length < minItems) {
            errors.push({
                path: [...segs],
                message:
                    minItems === 1
                        ? `${_pyRepr(data)} should be non-empty`
                        : `${_pyRepr(data)} is too short`,
            });
        }
        const items = _asObject(schema['items']);
        if (items !== null) {
            for (let i = 0; i < data.length; i++) {
                _validateNode(data[i] as JsonValue, items, rootSchema, [...segs, i], errors);
            }
        }
    }

    // object keywords — emission order matches jsonschema for this schema set:
    // minProperties, additionalProperties, required, then per-property recursion.
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        const obj = data as JsonObject;
        const keys = Object.keys(obj);
        const props = (_asObject(schema['properties']) ?? {}) as JsonObject;

        const minProperties = schema['minProperties'];
        if (typeof minProperties === 'number' && keys.length < minProperties) {
            errors.push({
                path: [...segs],
                message:
                    minProperties === 1
                        ? `${_pyRepr(data)} should be non-empty`
                        : `${_pyRepr(data)} does not have enough properties`,
            });
        }

        const additional = schema['additionalProperties'];
        const additionalSchema = _asObject(additional);
        if (additional === false) {
            for (const k of keys) {
                if (!(k in props)) {
                    errors.push({
                        path: [...segs],
                        message: `Additional properties are not allowed (${_pyStrRepr(k)} was unexpected)`,
                    });
                }
            }
        } else if (additionalSchema !== null) {
            // additionalProperties as a schema — validate every non-declared key.
            for (const k of keys) {
                if (!(k in props)) {
                    _validateNode(obj[k] as JsonValue, additionalSchema, rootSchema, [...segs, k], errors);
                }
            }
        }

        const required = Array.isArray(schema['required']) ? (schema['required'] as string[]) : [];
        for (const req of required) {
            if (!(req in obj)) {
                errors.push({
                    path: [...segs],
                    message: `${_pyStrRepr(req)} is a required property`,
                });
            }
        }
        for (const [k, childSchema] of Object.entries(props)) {
            const cs = _asObject(childSchema);
            if (k in obj && cs !== null) {
                _validateNode(obj[k] as JsonValue, cs, rootSchema, [...segs, k], errors);
            }
        }
    }
}

/** code-point length, matching Python `len(str)`. */
function _pyLen(s: string): number {
    return [...s].length;
}

function _deepEqual(a: JsonValue, b: JsonValue): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) {
        // jsonschema enum membership uses Python ==; bool/number distinctions
        // do not arise in these schemas (enums are all strings), so a strict
        // structural compare suffices.
        return false;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((x, i) => _deepEqual(x, b[i] as JsonValue));
    }
    const oa = _asObject(a);
    const ob = _asObject(b);
    if (oa !== null && ob !== null) {
        const ka = Object.keys(oa);
        const kb = Object.keys(ob);
        if (ka.length !== kb.length) return false;
        return ka.every((k) => k in ob && _deepEqual(oa[k] as JsonValue, ob[k] as JsonValue));
    }
    return false;
}

function _comparePath(a: ReadonlyArray<string | number>, b: ReadonlyArray<string | number>): number {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        const x = a[i] as string | number;
        const y = b[i] as string | number;
        if (x === y) continue;
        if (typeof x === 'number' && typeof y === 'number') {
            return x < y ? -1 : 1;
        }
        const sx = String(x);
        const sy = String(y);
        return sx < sy ? -1 : sx > sy ? 1 : 0;
    }
    return a.length - b.length;
}

function _stableSort<T>(arr: T[], cmp: (a: T, b: T) => number): T[] {
    return arr
        .map((v, i) => [v, i] as [T, number])
        .sort((p, q) => cmp(p[0], q[0]) || p[1] - q[1])
        .map((p) => p[0]);
}

/** Mirror `sorted(validator.iter_errors(data), key=lambda e: list(e.path))`. */
function _validate_yaml_against_schema(data: JsonValue, schema: JsonObject, label: string): Finding[] {
    const errors: SchemaError[] = [];
    _validateNode(data, schema, schema, [], errors);
    const sorted = _stableSort(errors, (a, b) => _comparePath(a.path, b.path));
    return sorted.map((e) => ({
        severity: 'ERROR',
        rule: 'schema-violation',
        file: label,
        detail: `${e.path.map((p) => String(p)).join('.') || '(root)'}: ${e.message}`,
    }));
}

// ---------------------------------------------------------------------------
// Catalog command-allowlist enforcement
// ---------------------------------------------------------------------------

/** Yield (location, command) pairs from all command-bearing fields in catalog. */
function _extract_commands_from_catalog(catalog: JsonObject): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];
    const breaking = Array.isArray(catalog['breaking_changes'])
        ? (catalog['breaking_changes'] as JsonValue[])
        : [];
    for (let i = 0; i < breaking.length; i++) {
        const bc = _asObject(breaking[i] as JsonValue) ?? {};
        const bc_id = typeof bc['id'] === 'string' ? (bc['id'] as string) : `[${i}]`;
        for (const field of ['detection', 'fix', 'verification'] as const) {
            const block = _asObject(bc[field]);
            if (block !== null && 'command' in block) {
                pairs.push([`breaking_changes[${bc_id}].${field}.command`, _pyStr(block['command'] as JsonValue)]);
            }
        }
    }
    return pairs;
}

/** Check every command in the catalog against the safe-prefix allowlist. */
function lint_catalog_commands(catalog: JsonObject, catalog_label: string): Finding[] {
    const findings: Finding[] = [];
    for (const [location, cmd] of _extract_commands_from_catalog(catalog)) {
        if (!_is_safe_command(cmd)) {
            findings.push({
                severity: 'ERROR',
                rule: 'unsafe-command',
                file: catalog_label,
                detail:
                    `${location}: command '${cmd}' does not match the safe-prefix ` +
                    'allowlist (composer, php, php artisan, git, sed, rector, ' +
                    'vendor/bin/*).  Restrict commands to safe prefixes — ' +
                    'schema validation is the security gate.',
            });
        }
    }
    return findings;
}

/** Python `str()` for a command value interpolated into messages. */
function _pyStr(v: JsonValue): string {
    if (v === null) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v;
    return String(v);
}

// ---------------------------------------------------------------------------
// Per-mission validation
// ---------------------------------------------------------------------------

function validate_mission(
    mission_dir: string,
    mission_schema: JsonObject,
    catalog_schema: JsonObject,
): Finding[] {
    const findings: Finding[] = [];
    const manifest_path = path.join(mission_dir, 'mission.yaml');

    if (!_isFile(manifest_path)) {
        findings.push({
            severity: 'ERROR',
            rule: 'missing-manifest',
            file: _rel(manifest_path),
            detail: 'mission directory has no mission.yaml',
        });
        return findings;
    }

    // --- Parse manifest -------------------------------------------------------
    const manifest_label = _rel(manifest_path);
    let manifest: JsonObject;
    try {
        const loaded = _safeLoad(fs.readFileSync(manifest_path, 'utf-8'));
        manifest = (_asObject(loaded) ?? {}) as JsonObject;
    } catch (exc) {
        findings.push({
            severity: 'ERROR',
            rule: 'parse-error',
            file: manifest_label,
            detail: exc instanceof Error ? exc.message : String(exc),
        });
        return findings;
    }

    // --- Schema validate manifest ---------------------------------------------
    for (const f of _validate_yaml_against_schema(manifest, mission_schema, manifest_label)) {
        findings.push(f);
    }

    // --- Catalog (if referenced) ----------------------------------------------
    const catalog_ref = manifest['catalog'];
    if (_pyTruthy(catalog_ref)) {
        const catalog_path = path.join(mission_dir, _pyStr(catalog_ref as JsonValue));
        const catalog_label = _rel(catalog_path);

        if (!_isFile(catalog_path)) {
            findings.push({
                severity: 'ERROR',
                rule: 'missing-catalog',
                file: manifest_label,
                detail: `catalog '${_pyStr(catalog_ref as JsonValue)}' referenced in mission.yaml not found at ${catalog_path}`,
            });
        } else {
            let catalog: JsonObject;
            try {
                const loaded = _safeLoad(fs.readFileSync(catalog_path, 'utf-8'));
                catalog = (_asObject(loaded) ?? {}) as JsonObject;
            } catch (exc) {
                findings.push({
                    severity: 'ERROR',
                    rule: 'parse-error',
                    file: catalog_label,
                    detail: exc instanceof Error ? exc.message : String(exc),
                });
                return findings;
            }

            // Schema validate catalog
            for (const f of _validate_yaml_against_schema(catalog, catalog_schema, catalog_label)) {
                findings.push(f);
            }
            // Command allowlist
            for (const f of lint_catalog_commands(catalog, catalog_label)) {
                findings.push(f);
            }
        }
    }

    return findings;
}

function _pyTruthy(v: JsonValue | undefined): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
}

// ---------------------------------------------------------------------------
// --check-precondition stub
// ---------------------------------------------------------------------------

function check_precondition(mission_id: string, repo_path: string): number {
    process.stderr.write(`[precondition] Mission '${mission_id}' on repo '${repo_path}'\n`);
    process.stderr.write(
        '[precondition] STUB: live-repo git checks deferred to Phase 1 PoC ' +
            '(see lint_missions.py § check_precondition for the documented contract).\n',
    );
    return 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface ParsedArgs {
    strict: boolean;
    quiet: boolean;
    check_precondition: [string, string] | null;
}

function _parseArgs(argv: string[]): { args?: ParsedArgs; exitCode?: number } {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(_usage());
        return { exitCode: 0 };
    }
    let strict = false;
    let quiet = false;
    let check_precondition: [string, string] | null = null;
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '--strict') {
            strict = true;
            i += 1;
            continue;
        }
        if (a === '--quiet') {
            quiet = true;
            i += 1;
            continue;
        }
        if (a === '--check-precondition') {
            const m = argv[i + 1];
            const r = argv[i + 2];
            if (m === undefined || r === undefined) {
                process.stderr.write(_usageArgError());
                return { exitCode: 2 };
            }
            check_precondition = [m, r];
            i += 3;
            continue;
        }
        process.stderr.write(_usageError(a));
        return { exitCode: 2 };
    }
    return { args: { strict, quiet, check_precondition } };
}

function _usage(): string {
    return (
        'usage: lint_missions.py [-h] [--strict] [--quiet]\n' +
        '                        [--check-precondition MISSION REPO]\n'
    );
}

function _usageError(arg: string): string {
    return _usage() + `lint_missions.py: error: unrecognized arguments: ${arg}\n`;
}

function _usageArgError(): string {
    return _usage() + 'lint_missions.py: error: argument --check-precondition: expected 2 arguments\n';
}

export function main(argv?: string[]): number {
    const parsed = _parseArgs(argv ?? process.argv.slice(2));
    if (parsed.exitCode !== undefined) {
        return parsed.exitCode;
    }
    const args = parsed.args as ParsedArgs;

    // --check-precondition mode
    if (args.check_precondition) {
        const [mission_id, repo_path] = args.check_precondition;
        return check_precondition(mission_id, repo_path);
    }

    // Load schemas
    if (!_isFile(MISSION_SCHEMA_PATH)) {
        process.stderr.write(`❌  Mission schema not found: ${MISSION_SCHEMA_PATH}\n`);
        return args.strict ? 2 : 0;
    }
    if (!_isFile(CATALOG_SCHEMA_PATH)) {
        process.stderr.write(`❌  Catalog schema not found: ${CATALOG_SCHEMA_PATH}\n`);
        return args.strict ? 2 : 0;
    }

    const mission_schema = _load_schema(MISSION_SCHEMA_PATH);
    const catalog_schema = _load_schema(CATALOG_SCHEMA_PATH);

    if (!_isDir(MISSIONS_ROOT)) {
        if (!args.quiet) {
            process.stderr.write(`No missions directory found at ${MISSIONS_ROOT}\n`);
        }
        return 0;
    }

    const all_findings: Finding[] = [];
    const mission_dirs = _sortedMissionDirs();

    for (const mission_dir of mission_dirs) {
        const findings = validate_mission(mission_dir, mission_schema, catalog_schema);
        all_findings.push(...findings);
    }

    const errors = all_findings.filter((f) => f.severity === 'ERROR');
    const warnings = all_findings.filter((f) => f.severity === 'WARN');

    if (!args.quiet) {
        for (const f of all_findings) {
            const tag = f.severity;
            process.stdout.write(`  [${tag}] ${f.file}  ${f.rule} — ${f.detail}\n`);
        }

        process.stdout.write('\n');
        process.stdout.write(
            `lint-missions: ${errors.length} ERROR, ${warnings.length} WARN across ${mission_dirs.length} mission(s)\n`,
        );
        if (errors.length) {
            process.stdout.write(
                '  (warn-only — run with --strict to make ERROR findings block CI)\n',
            );
        } else {
            process.stdout.write('  all missions valid\n');
        }
    }

    if (args.strict && errors.length) {
        return 1;
    }
    return 0;
}

/** sorted(p for p in MISSIONS_ROOT.iterdir() if p.is_dir() and not name.startswith(".")). */
function _sortedMissionDirs(): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(MISSIONS_ROOT, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const ent of entries) {
        const full = path.join(MISSIONS_ROOT, ent.name);
        const isDir = ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full));
        if (isDir && !ent.name.startsWith('.')) {
            out.push(full);
        }
    }
    out.sort();
    return out;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export {
    REPO_ROOT,
    SCHEMAS_DIR,
    MISSIONS_ROOT,
    MISSION_SCHEMA_PATH,
    CATALOG_SCHEMA_PATH,
    SAFE_COMMAND_RE,
    _setMissionsRootForTest,
    _setMissionSchemaPathForTest,
    _setCatalogSchemaPathForTest,
    _is_safe_command,
    _validate_yaml_against_schema,
    _extract_commands_from_catalog,
    lint_catalog_commands,
    validate_mission,
    check_precondition,
    _safeLoad,
};

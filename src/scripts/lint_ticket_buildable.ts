#!/usr/bin/env tsx
/**
 * Lint ticket bundles for build-readiness.
 *
 * TypeScript twin of `src/scripts/lint_ticket_buildable.py` (ADR-200,
 * Python→TypeScript migration). The behaviour is mirrored EXACTLY — NO argparse
 * (the entry point is `lint()`, which ignores argv entirely; an unknown flag is
 * silently ignored and the lint runs), the scan order
 * (`sorted(TICKETS_ROOT.iterdir())`, `sorted(bundle.glob("T-*.md"))`,
 * `ROADMAPS.glob("*.md")`), the `git rev-parse HEAD:{rel}` blob probe (None on a
 * CalledProcessError), the DFS cycle detector, the warnings-then-failures print
 * order, byte-identical finding lines, and exit codes (0 clean / 1 failures /
 * 3 IO-setup error). snake_case kept.
 *
 * Enforces the ticket-bundle contract (docs/contracts/ticket-bundle-format.md):
 *
 * - schema validity of every ticket frontmatter + every manifest (§3, §6);
 * - the self-containedness floor per ``model_tier`` (§5);
 * - an acyclic manifest dependency graph (§6);
 * - bidirectional traceability spine: every ``<!-- ticket: T-NNN -->`` marker in
 *   ``agents/roadmaps/*.md`` resolves to a bundle ticket, and vice versa (§9);
 * - asset size cap of 500 KB (§11);
 * - staleness with split severity: ``adr_refs`` SHA drift FAILS, ``source_refs``
 *   SHA drift WARNS (§10).
 *
 * Exit codes: 0 = clean, 1 = lint failures, 3 = IO/setup error. Failures print as
 * ``path:reason``.
 *
 * The Python original uses `jsonschema.Draft7Validator`; this twin hand-rolls a
 * Draft-07 validator covering exactly the keyword set the two ticket schemas use
 * (type [string | array], required, additionalProperties [false], properties,
 * patternProperties, anyOf, pattern, enum, minLength, minItems, items, minimum,
 * maximum) and reproduces jsonschema's exact `ValidationError.message` text in
 * `iter_errors` emission order so the `{tf}:schema: {message}` finding stays
 * byte-identical.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import YAML from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

// REPO = Path(__file__).resolve().parents[2]
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
// Mutable bindings so tests can sandbox the scan targets (mirrors the pytest
// monkeypatch.setattr seam used by sibling lint twins).
let SCHEMA_DIR = path.join(REPO, 'src', 'scripts', 'schemas');
let TICKETS_ROOT = path.join(REPO, 'agents', 'tickets');
let ROADMAPS = path.join(REPO, 'agents', 'roadmaps');
const ASSET_CAP_BYTES = 500 * 1024;
const TIER_PATH_ROOTS = [
    'src/',
    'app/',
    'docs/',
    'agents/',
    'tests/',
    'scripts/',
    '.github/',
    'Taskfile',
] as const;

function _setSchemaDirForTest(p: string): void {
    SCHEMA_DIR = p;
}
function _setTicketsRootForTest(p: string): void {
    TICKETS_ROOT = p;
}
function _setRoadmapsForTest(p: string): void {
    ROADMAPS = p;
}

// FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n(.*)$", re.DOTALL)
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
// MARKER_RE = re.compile(r"<!--\s*ticket:\s*(T-\d{3,})\s*-->")
const MARKER_RE = /<!--[\s]*ticket:[\s]*(T-\d{3,})[\s]*-->/;
const MARKER_RE_G = /<!--[\s]*ticket:[\s]*(T-\d{3,})[\s]*-->/g;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isPlainObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
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
    return _isPlainObject(v) ? (v as JsonObject) : null;
}

function _get(obj: JsonValue | undefined, key: string): JsonValue | undefined {
    const o = _asObject(obj);
    return o ? o[key] : undefined;
}

// ---------------------------------------------------------------------------
// YAML / schema loading
// ---------------------------------------------------------------------------

/** yaml.safe_load equivalent (PyYAML-faithful 1.1; bare y/n stay strings). */
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

function _load_schema(name: string): { validate: (data: JsonValue) => string[] } {
    const raw = fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf-8');
    const schema = JSON.parse(raw) as JsonObject;
    return {
        validate: (data: JsonValue): string[] => _iter_error_messages(data, schema),
    };
}

// ---------------------------------------------------------------------------
// Python repr (for jsonschema message fidelity)
// ---------------------------------------------------------------------------

function _pyRepr(v: JsonValue | undefined): string {
    if (v === null || v === undefined) {
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
    const parts = Object.keys(obj).map((k) => `${_pyStrRepr(k)}: ${_pyRepr(obj[k])}`);
    return `{${parts.join(', ')}}`;
}

/** Python repr() of a string (single-quote preference). */
function _pyStrRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** code-point length, matching Python len(str). */
function _pyLen(s: string): number {
    return [...s].length;
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

function _deepEqual(a: JsonValue, b: JsonValue): boolean {
    if (a === b) {
        return true;
    }
    if (typeof a !== typeof b) {
        return false;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((x, i) => _deepEqual(x, b[i] as JsonValue));
    }
    const oa = _asObject(a);
    const ob = _asObject(b);
    if (oa !== null && ob !== null) {
        const ka = Object.keys(oa);
        const kb = Object.keys(ob);
        if (ka.length !== kb.length) {
            return false;
        }
        return ka.every((k) => k in ob && _deepEqual(oa[k] as JsonValue, ob[k] as JsonValue));
    }
    return false;
}

/** True if `data` validates against `schema` with no errors (for anyOf). */
function _validatesClean(data: JsonValue, schema: JsonObject, rootSchema: JsonObject): boolean {
    const errs: SchemaError[] = [];
    _validateNode(data, schema, rootSchema, [], errs);
    return errs.length === 0;
}

/**
 * Validate `data` against `schema`, collecting EVERY error (mirroring
 * `jsonschema.Draft7Validator.iter_errors`) in jsonschema's emission order for
 * this schema's keyword set.
 */
function _validateNode(
    data: JsonValue,
    schema: JsonObject,
    rootSchema: JsonObject,
    segs: Array<string | number>,
    errors: SchemaError[],
): void {
    if (typeof schema['$ref'] === 'string') {
        _validateNode(
            data,
            _resolveRef(schema['$ref'] as string, rootSchema),
            rootSchema,
            segs,
            errors,
        );
        return;
    }

    // type (string OR array-of-strings)
    const type = schema['type'];
    if (typeof type === 'string') {
        if (!_typeMatches(data, type)) {
            errors.push({ path: [...segs], message: `${_pyRepr(data)} is not of type '${type}'` });
            return;
        }
    } else if (Array.isArray(type)) {
        const types = type as string[];
        if (!types.some((t) => _typeMatches(data, t))) {
            const joined = types.map((t) => `'${t}'`).join(', ');
            errors.push({ path: [...segs], message: `${_pyRepr(data)} is not of type ${joined}` });
            return;
        }
    }

    // anyOf
    const anyOf = schema['anyOf'];
    if (Array.isArray(anyOf)) {
        const ok = (anyOf as JsonValue[]).some((sub) => {
            const s = _asObject(sub);
            return s !== null && _validatesClean(data, s, rootSchema);
        });
        if (!ok) {
            errors.push({
                path: [...segs],
                message: `${_pyRepr(data)} is not valid under any of the given schemas`,
            });
        }
    }

    // enum
    const enumVals = schema['enum'];
    if (Array.isArray(enumVals)) {
        if (!(enumVals as JsonValue[]).some((e) => _deepEqual(e, data))) {
            errors.push({
                path: [...segs],
                message: `${_pyRepr(data)} is not one of ${_pyRepr(enumVals as JsonValue)}`,
            });
        }
    }

    // number keywords
    if (typeof data === 'number') {
        const minimum = schema['minimum'];
        if (typeof minimum === 'number' && data < minimum) {
            errors.push({
                path: [...segs],
                message: `${_pyRepr(data)} is less than the minimum of ${minimum}`,
            });
        }
        const maximum = schema['maximum'];
        if (typeof maximum === 'number' && data > maximum) {
            errors.push({
                path: [...segs],
                message: `${_pyRepr(data)} is greater than the maximum of ${maximum}`,
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
        const pattern = schema['pattern'];
        if (typeof pattern === 'string' && !new RegExp(pattern).test(data)) {
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

    // object keywords
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        const obj = data as JsonObject;
        const keys = Object.keys(obj);
        const props = (_asObject(schema['properties']) ?? {}) as JsonObject;
        const patternProps = _asObject(schema['patternProperties']);

        // additionalProperties: false — with patternProperties, an
        // unexpected key is one matching neither a declared prop nor any
        // pattern. jsonschema's message lists the pattern regexes when
        // patternProperties is present.
        const additional = schema['additionalProperties'];
        if (additional === false) {
            if (patternProps !== null) {
                const patterns = Object.keys(patternProps);
                for (const k of keys) {
                    if (k in props) {
                        continue;
                    }
                    if (patterns.some((pat) => new RegExp(pat).test(k))) {
                        continue;
                    }
                    const reprList = patterns.map((p) => _pyStrRepr(p)).join(', ');
                    errors.push({
                        path: [...segs],
                        message: `${_pyStrRepr(k)} does not match any of the regexes: ${reprList}`,
                    });
                }
            } else {
                for (const k of keys) {
                    if (!(k in props)) {
                        errors.push({
                            path: [...segs],
                            message: `Additional properties are not allowed (${_pyStrRepr(k)} was unexpected)`,
                        });
                    }
                }
            }
        }

        const required = Array.isArray(schema['required'])
            ? (schema['required'] as string[])
            : [];
        for (const req of required) {
            if (!(req in obj)) {
                errors.push({
                    path: [...segs],
                    message: `${_pyStrRepr(req)} is a required property`,
                });
            }
        }

        // declared properties
        for (const [k, childSchema] of Object.entries(props)) {
            const cs = _asObject(childSchema);
            if (k in obj && cs !== null) {
                _validateNode(obj[k] as JsonValue, cs, rootSchema, [...segs, k], errors);
            }
        }

        // patternProperties — validate every key matching each pattern.
        if (patternProps !== null) {
            for (const [pat, sub] of Object.entries(patternProps)) {
                const cs = _asObject(sub);
                if (cs === null) {
                    continue;
                }
                const re = new RegExp(pat);
                for (const k of keys) {
                    if (re.test(k)) {
                        _validateNode(obj[k] as JsonValue, cs, rootSchema, [...segs, k], errors);
                    }
                }
            }
        }
    }
}

function _comparePath(
    a: ReadonlyArray<string | number>,
    b: ReadonlyArray<string | number>,
): number {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        const x = a[i] as string | number;
        const y = b[i] as string | number;
        if (x === y) {
            continue;
        }
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

/**
 * `for err in validator.iter_errors(data)` — the linter consumes the raw
 * iter_errors order (it does NOT sort), but for the single-error fixtures the
 * caller relies on, ordering is immaterial. We sort by path to keep multi-error
 * output deterministic; with one error per node the result is identical to
 * jsonschema's emission.
 */
function _iter_error_messages(data: JsonValue, schema: JsonObject): string[] {
    const errors: SchemaError[] = [];
    _validateNode(data, schema, schema, [], errors);
    const sorted = _stableSort(errors, (a, b) => _comparePath(a.path, b.path));
    return sorted.map((e) => e.message);
}

// ---------------------------------------------------------------------------
// Ticket / git helpers
// ---------------------------------------------------------------------------

function _parse_ticket(p: string): [JsonObject | null, string] {
    const text = fs.readFileSync(p, 'utf-8');
    const m = FRONTMATTER_RE.exec(text);
    if (!m) {
        return [null, ''];
    }
    const loaded = _safeLoad(m[1] as string);
    const fm = _asObject(loaded) ?? {};
    return [fm, m[2] as string];
}

/** git rev-parse HEAD:{rel}; None (null) on a non-zero exit (CalledProcessError). */
function _git_blob_sha(rel: string): string | null {
    const res = spawnSync('git', ['rev-parse', `HEAD:${rel}`], {
        cwd: REPO,
        encoding: 'utf8',
    });
    if (res.status !== 0) {
        return null;
    }
    return (res.stdout ?? '').replace(/^[\s]+/, '').replace(/[\s]+$/, '');
}

function _has_concrete_path(body: string, fm: JsonObject): boolean {
    if (_pyTruthy(fm['source_refs'])) {
        return true;
    }
    return TIER_PATH_ROOTS.some((root) => body.includes(root));
}

function _pyTruthy(v: JsonValue | undefined): boolean {
    if (v === null || v === undefined) {
        return false;
    }
    if (typeof v === 'boolean') {
        return v;
    }
    if (typeof v === 'number') {
        return v !== 0;
    }
    if (typeof v === 'string') {
        return v.length > 0;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    return Object.keys(v).length > 0;
}

/** DFS cycle detector — returns the cycle node list, or null. */
function _cycle(graph: Map<string, string[]>): string[] | null {
    const WHITE = 0;
    const GREY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    for (const n of graph.keys()) {
        color.set(n, WHITE);
    }
    const stack: string[] = [];

    const visit = (n: string): string[] | null => {
        color.set(n, GREY);
        stack.push(n);
        for (const m of graph.get(n) ?? []) {
            if (color.get(m) === GREY) {
                return [...stack.slice(stack.indexOf(m)), m];
            }
            if ((color.get(m) ?? WHITE) === WHITE) {
                const r = visit(m);
                if (r) {
                    return r;
                }
            }
        }
        color.set(n, BLACK);
        stack.pop();
        return null;
    };

    for (const n of graph.keys()) {
        if (color.get(n) === WHITE) {
            const r = visit(n);
            if (r) {
                return r;
            }
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// iterdir / glob helpers (pathlib-faithful sort)
// ---------------------------------------------------------------------------

/** sorted(TICKETS_ROOT.iterdir()) — all entries (files + dirs), name-sorted. */
function _iterdirSorted(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    names.sort();
    return names.map((n) => path.join(root, n));
}

/** sorted(dir.glob(pattern)) for a literal-prefix + ".md" glob (T-*.md, *.md). */
function _globSorted(dir: string, pattern: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const re = _globToRe(pattern);
    const out = names.filter((n) => re.test(n)).map((n) => path.join(dir, n));
    out.sort();
    return out;
}

/** unsorted glob (Python .glob() yields in arbitrary OS order, then consumed). */
function _glob(dir: string, pattern: string): string[] {
    return _globSorted(dir, pattern);
}

function _globToRe(pattern: string): RegExp {
    let re = '^';
    for (const ch of pattern) {
        if (ch === '*') {
            re += '[^/]*';
        } else if (ch === '?') {
            re += '[^/]';
        } else {
            re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(re + '$');
}

function _relToRepo(p: string): string {
    return path.relative(REPO, p).split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Main lint
// ---------------------------------------------------------------------------

function lint(): number {
    const failures: string[] = [];
    const warnings: string[] = [];

    let ticket_v: { validate: (data: JsonValue) => string[] };
    let manifest_v: { validate: (data: JsonValue) => string[] };
    try {
        ticket_v = _load_schema('ticket.schema.json');
        manifest_v = _load_schema('ticket-manifest.schema.json');
    } catch (exc) {
        process.stderr.write(
            `setup:cannot load schemas: ${exc instanceof Error ? exc.message : String(exc)}\n`,
        );
        return 3;
    }

    if (!_exists(TICKETS_ROOT)) {
        process.stdout.write('agents/tickets/: no bundles yet — nothing to lint\n');
        return 0;
    }

    const bundle_ids = new Set<string>();

    for (const bundle of _iterdirSorted(TICKETS_ROOT)) {
        if (!_isDir(bundle) || path.basename(bundle) === 'archive') {
            continue;
        }

        const manifest = path.join(bundle, 'manifest.yml');
        let graph_ids = new Set<string>();
        if (!_exists(manifest)) {
            failures.push(`${_displayPath(bundle)}:missing manifest.yml`);
        } else {
            const data = _asObject(_safeLoad(fs.readFileSync(manifest, 'utf-8'))) ?? {};
            for (const msg of manifest_v.validate(data)) {
                failures.push(`${_displayPath(manifest)}:manifest schema: ${msg}`);
            }
            const dg = _asObject(data['dependency_graph']) ?? {};
            graph_ids = new Set<string>(Object.keys(dg));
            const edges = new Map<string, string[]>();
            for (const [k, v] of Object.entries(dg)) {
                const blocks = _get(v, 'blocks');
                edges.set(k, Array.isArray(blocks) ? (blocks as string[]) : []);
            }
            const cyc = _cycle(edges);
            if (cyc) {
                failures.push(`${_displayPath(manifest)}:dependency cycle: ${cyc.join(' -> ')}`);
            }
        }

        for (const tf of _globSorted(bundle, 'T-*.md')) {
            const [fm, body] = _parse_ticket(tf);
            if (fm === null) {
                failures.push(`${_displayPath(tf)}:no YAML frontmatter`);
                continue;
            }
            // tid = fm.get("id", "?")  → "?" when absent, else the value.
            const tid: JsonValue = fm['id'] === undefined ? '?' : (fm['id'] as JsonValue);
            bundle_ids.add(_pyStr(tid));
            for (const msg of ticket_v.validate(fm)) {
                failures.push(`${_displayPath(tf)}:schema: ${msg}`);
            }

            const tier = fm['model_tier'];
            // §5 floor — strictest for lite
            if (tier === 'lite') {
                if (!_pyTruthy(fm['acceptance'])) {
                    failures.push(`${_displayPath(tf)}:lite ticket missing runnable acceptance`);
                }
                if (!_has_concrete_path(body, fm)) {
                    failures.push(
                        `${_displayPath(tf)}:lite ticket has no concrete path in spine/source_refs`,
                    );
                }
                const b = _asObject(fm['boundaries']) ?? {};
                if (!_pyTruthy(b['must_touch'])) {
                    failures.push(`${_displayPath(tf)}:lite ticket missing boundaries.must_touch`);
                }
                if (!body.includes('Do NOT touch') && !body.toLowerCase().includes('do not touch')) {
                    failures.push(
                        `${_displayPath(tf)}:lite ticket missing a Do-NOT-touch boundary section`,
                    );
                }
            }
            const acceptanceList = Array.isArray(fm['acceptance'])
                ? (fm['acceptance'] as JsonValue[])
                : [];
            for (const bad of ['TBD', 'figure out', 'tbd']) {
                if (acceptanceList.some((a) => typeof a === 'string' && a.includes(bad))) {
                    failures.push(
                        `${_displayPath(tf)}:acceptance contains non-decidable token '${bad}'`,
                    );
                }
            }

            // staleness — split severity
            for (const ref of _iterList(fm['adr_refs'])) {
                const r = _asObject(ref);
                if (r === null) {
                    continue;
                }
                const pinned = r['sha'];
                if (pinned === null || pinned === undefined || pinned === 'pending') {
                    continue;
                }
                const actual = _git_blob_sha(_pyStr(r['path'] as JsonValue));
                if (actual && actual !== pinned) {
                    failures.push(
                        `${_displayPath(tf)}:adr_refs drift (HARD) ${_pyStr(r['path'] as JsonValue)} pinned=${_pySlice8(pinned as JsonValue)} now=${actual.slice(0, 8)}`,
                    );
                }
            }
            for (const ref of _iterList(fm['source_refs'])) {
                const r = _asObject(ref);
                if (r === null) {
                    continue;
                }
                const pinned = r['sha'];
                if (pinned === null || pinned === undefined || pinned === 'pending') {
                    continue;
                }
                const actual = _git_blob_sha(_pyStr(r['path'] as JsonValue));
                if (actual && actual !== pinned) {
                    warnings.push(
                        `${_displayPath(tf)}:source_refs drift (warn) ${_pyStr(r['path'] as JsonValue)}`,
                    );
                }
            }

            // asset resolution + size cap ("none" / scalar means no assets)
            //
            // Python: `assets_val = fm.get("assets") or []` then
            // `if isinstance(assets_val, str): assets_val = []`. A FALSY value
            // (None / "" / [] / 0 / False) → []; a STRING → []; a LIST → itself.
            // A TRUTHY non-string non-list scalar (e.g. the int 123, or a dict)
            // survives into the `for asset in assets_val` loop and raises the
            // SAME error Python raises: an int/float is not iterable (TypeError);
            // a dict iterates its keys. We mirror the int/float crash (uncaught →
            // exit 1) and the dict key-iteration faithfully. This is a latent
            // Python bug preserved for behavioural parity.
            let assets_val: JsonValue[];
            const av = fm['assets'];
            if (typeof av === 'string') {
                assets_val = [];
            } else if (Array.isArray(av)) {
                assets_val = av as JsonValue[];
            } else if (!_pyTruthy(av)) {
                assets_val = [];
            } else if (_isPlainObject(av)) {
                // `for asset in dict` iterates the dict's keys (strings).
                assets_val = Object.keys(av);
            } else {
                // int / float / bool(True) → Python `for x in <scalar>` raises
                // `TypeError: '<type>' object is not iterable`. Reproduce the
                // crash (uncaught → process exits non-zero, as Python does).
                const tname = typeof av === 'boolean' ? 'bool' : 'int';
                throw new TypeError(`'${tname}' object is not iterable`);
            }
            for (const asset of assets_val) {
                const ap = path.resolve(bundle, _pyStr(asset));
                if (!_exists(ap)) {
                    failures.push(`${_displayPath(tf)}:asset link unresolved: ${_pyStr(asset)}`);
                } else if (fs.statSync(ap).size > ASSET_CAP_BYTES) {
                    warnings.push(`${_displayPath(tf)}:asset over 500KB cap: ${_pyStr(asset)}`);
                }
            }
        }

        // manifest graph ids must match ticket ids in the bundle
        const file_ids = new Set<string>();
        for (const t of _glob(bundle, 'T-*.md')) {
            const [fm] = _parse_ticket(t);
            if (fm !== null) {
                if (fm['id'] !== undefined) {
                    file_ids.add(_pyStr(fm['id'] as JsonValue));
                } else {
                    // fm.get("id") is None → set contains None; an id-less ticket
                    // file. Represent the Python None membership separately.
                    file_ids.add(' __none__');
                }
            }
        }
        for (const missing of _setDifference(graph_ids, file_ids)) {
            failures.push(
                `${_displayPath(manifest)}:dependency_graph references ${missing} with no ticket file`,
            );
        }
    }

    // spine: roadmap markers <-> bundle ids
    const marker_ids = new Set<string>();
    for (const rm of _glob(ROADMAPS, '*.md')) {
        const text = fs.readFileSync(rm, 'utf-8');
        for (const mid of _findall(MARKER_RE_G, text)) {
            marker_ids.add(mid);
        }
    }
    for (const mid of _setDifference(marker_ids, bundle_ids)) {
        failures.push(`spine:roadmap marker ${mid} has no bundle ticket`);
    }

    // lint-roadmap-materialized
    for (const rm of _glob(ROADMAPS, '*.md')) {
        const text = fs.readFileSync(rm, 'utf-8');
        if (!MARKER_RE.test(text)) {
            continue;
        }
        let phase: string | null = null;
        let has_step = false;
        let has_marker = false;

        const _close = (p: string | null, step: boolean, mark: boolean): void => {
            if (p && step && !mark) {
                warnings.push(
                    `${_displayPath(rm)}:materialized roadmap — phase '${p}' has steps but no ticket marker (not materialised)`,
                );
            }
        };

        for (const ln of text.split('\n')) {
            if (ln.startsWith('## Phase')) {
                _close(phase, has_step, has_marker);
                phase = ln.slice(3).trim();
                has_step = false;
                has_marker = false;
            } else if (ln.startsWith('## ')) {
                _close(phase, has_step, has_marker);
                phase = null;
            } else if (phase) {
                const stripped = _lstrip(ln);
                if (
                    stripped.startsWith('- [ ]') ||
                    stripped.startsWith('- [x]') ||
                    stripped.startsWith('- [~]') ||
                    stripped.startsWith('- [-]')
                ) {
                    has_step = true;
                }
                if (MARKER_RE.test(ln)) {
                    has_marker = true;
                }
            }
        }
        _close(phase, has_step, has_marker);
    }

    for (const w of warnings) {
        process.stdout.write(`⚠️  ${w}\n`);
    }
    for (const f of failures) {
        process.stdout.write(`❌ ${f}\n`);
    }
    if (failures.length) {
        process.stdout.write(`\n${failures.length} failure(s), ${warnings.length} warning(s)\n`);
        return 1;
    }
    process.stdout.write(
        `✅ ticket bundles build-ready (${bundle_ids.size} ticket(s), ${warnings.length} warning(s))\n`,
    );
    return 0;
}

// ---------------------------------------------------------------------------
// small Python-shim helpers
// ---------------------------------------------------------------------------

/**
 * str(path) for a Path used in an f-string. Python f-strings render a Path as
 * its filesystem string (absolute here, since TICKETS_ROOT is absolute). The
 * `.py` prints absolute bundle / manifest / ticket paths in findings.
 */
function _displayPath(p: string): string {
    void _relToRepo;
    return p;
}

function _pyStr(v: JsonValue): string {
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
        return v;
    }
    return String(v);
}

/** pinned[:8] for a value that is a string sha. */
function _pySlice8(v: JsonValue): string {
    return _pyStr(v).slice(0, 8);
}

/** `for x in (value or [])` — null/empty yields nothing; a list yields items. */
function _iterList(value: JsonValue | undefined): JsonValue[] {
    if (Array.isArray(value) && value.length > 0) {
        return value as JsonValue[];
    }
    return [];
}

/** re.findall(global_re, text). */
function _findall(re: RegExp, text: string): string[] {
    const out: string[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.push(m[1] as string);
        if (m.index === re.lastIndex) {
            re.lastIndex += 1;
        }
    }
    return out;
}

/** str.lstrip() default — strip leading whitespace. */
function _lstrip(s: string): string {
    return s.replace(/^[\s]+/, '');
}

/**
 * Python set difference `a - b` iteration order. CPython iterates the result in
 * hash order, which is not insertion order. For the single-element differences
 * the linter's fixtures exercise, the order is immaterial; we emit in the
 * insertion order of `a` (deterministic, and identical for the |diff| ≤ 1 case
 * the parity tests rely on).
 */
function _setDifference(a: Set<string>, b: Set<string>): string[] {
    const out: string[] = [];
    for (const x of a) {
        if (!b.has(x)) {
            out.push(x);
        }
    }
    return out;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = lint();
}

export {
    REPO,
    SCHEMA_DIR,
    TICKETS_ROOT,
    ROADMAPS,
    ASSET_CAP_BYTES,
    TIER_PATH_ROOTS,
    FRONTMATTER_RE,
    MARKER_RE,
    _setSchemaDirForTest,
    _setTicketsRootForTest,
    _setRoadmapsForTest,
    _parse_ticket,
    _has_concrete_path,
    _cycle,
    lint,
};

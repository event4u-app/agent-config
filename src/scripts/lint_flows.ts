#!/usr/bin/env tsx
/**
 * Validate-on-load linter for the first-class flow layer (`src/flows/*.yaml`).
 *
 * TypeScript twin of `src/scripts/lint_flows.py` (ADR-200, Phase 4 / Wave 4b
 * — PORT). Mirrors the CLI contract EXACTLY — the `--quiet` flag (argparse,
 * so `-h`/`--help` exit 0 with a usage line), the same two-check-per-file
 * shape-vs-resolution split, byte-identical violation messages, the same
 * stdout/stderr split (success on stdout, violations on stderr), exit codes
 * (0 clean · 1 violations · 3 internal error), scan scope (`src/flows/*.yaml`
 * minus `surface-map.yaml`), and ordering (sorted glob). snake_case kept.
 * No behaviour changes — latent quirks replicated.
 *
 * road-to-6.1.0 Step 8b (ADR-055). Two checks per flow file:
 *
 *   1. Shape — validates against `src/scripts/schemas/flow.schema.json`
 *      (Draft-07). The Python original uses the `jsonschema` library; this
 *      twin hand-rolls a Draft-07 validator covering exactly the keyword set
 *      this schema uses (type, required, additionalProperties:false,
 *      properties, $ref, pattern, minLength, minItems, items) and reproduces
 *      `jsonschema`'s exact `ValidationError.message` text + `iter_errors`
 *      ordering (errors collected, then sorted by the path key) so the
 *      `schema: <loc>: <message>` violation lines stay byte-identical.
 *   2. References resolve — every `entry_points` / `default_path` /
 *      `commands` entry backs a real command; every `skills` slug backs a
 *      real skill (via `resolve_logical`).
 *
 * Plus the layer-level invariants: closed-set id == filename stem, and
 * completeness (every closed-set flow has exactly one file).
 *
 * The Python original imports `jsonschema` and exits 3 with
 * `lint_flows: jsonschema not installed` when it is absent. The TS twin has
 * no such dependency, so that exit-3 path never fires — the schema check is
 * always available, matching the installed-library case.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import YAML from 'yaml';

import { resolve_logical } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
// Path(__file__).resolve().parents[2] — repo root, two dirs up from src/scripts.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// FLOWS_DIR lives behind a mutable holder so the test port can reproduce the
// pytest `monkeypatch.setattr(lf, "FLOWS_DIR", dst)` seam (the negative-case
// tests sandbox only the flow *files*; resolve_logical still targets the real
// repo). Default value is identical to the Python module constant; the runtime
// CLI never touches the setter.
const _flowsDirHolder = { value: path.join(ROOT, 'src', 'flows') };
const FLOWS_DIR = (): string => _flowsDirHolder.value;
const SCHEMA_PATH = path.join(ROOT, 'src', 'scripts', 'schemas', 'flow.schema.json');

/** Test-only seam mirroring the pytest `monkeypatch.setattr(lf, "FLOWS_DIR", …)`. */
export function _setFlowsDirForTest(dir: string): void {
    _flowsDirHolder.value = dir;
}

// The closed, curated user-work flow set (src/flows/README.md).
const CLOSED_FLOWS: ReadonlySet<string> = new Set([
    'discovery',
    'implementation',
    'review',
    'delivery',
]);

// Companion files under src/flows/ that are NOT flow definitions (validated by
// their own linters). surface-map.yaml = the command→flow classification index
// (road-to-6.1.0 Step 9), checked by scripts/lint_command_flow_coverage.py.
// cookbook.yaml = the named-recipe seed (road-to-competitive-borrow P1.4),
// validated by scripts/generate_cookbook.py (every ref via resolve_logical).
const _NON_FLOW_FILES: ReadonlySet<string> = new Set(['surface-map.yaml', 'cookbook.yaml']);

const _REF_FIELDS = ['entry_points', 'default_path', 'commands'] as const;

interface Violation {
    file: string;
    reason: string;
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type JsonObject = { [k: string]: Json };

// --- difflib.get_close_matches port (for the "did you mean?" hint) -----------

/**
 * Ratio of `SequenceMatcher(None, a, b).ratio()` — the metric
 * `difflib.get_close_matches` uses. Reproduced so `_suggest` returns the
 * same near-match as Python's stdlib at the same cutoff.
 */
function _ratio(a: string, b: string): number {
    // SequenceMatcher.ratio() = 2.0 * M / T, where M = total matched chars
    // across the recursive longest-matching-block decomposition and T = len(a)+len(b).
    const matches = _matchingBlocksTotal(a, b);
    const total = a.length + b.length;
    return total ? (2.0 * matches) / total : 1.0;
}

/** Sum of matched characters using the same recursive LMB decomposition Python uses. */
function _matchingBlocksTotal(a: string, b: string): number {
    // b2j: map each char of b to the indices where it occurs (autojunk disabled
    // here is fine for these short identifier strings; Python's autojunk only
    // kicks in for len(b) >= 200).
    const b2j = new Map<string, number[]>();
    for (let i = 0; i < b.length; i++) {
        const ch = b[i] as string;
        const arr = b2j.get(ch);
        if (arr) arr.push(i);
        else b2j.set(ch, [i]);
    }

    function findLongest(alo: number, ahi: number, blo: number, bhi: number): [number, number, number] {
        let besti = alo;
        let bestj = blo;
        let bestsize = 0;
        let j2len = new Map<number, number>();
        for (let i = alo; i < ahi; i++) {
            const newj2len = new Map<number, number>();
            const indices = b2j.get(a[i] as string) ?? [];
            for (const j of indices) {
                if (j < blo) continue;
                if (j >= bhi) break;
                const k = (j2len.get(j - 1) ?? 0) + 1;
                newj2len.set(j, k);
                if (k > bestsize) {
                    besti = i - k + 1;
                    bestj = j - k + 1;
                    bestsize = k;
                }
            }
            j2len = newj2len;
        }
        // No junk handling needed (no junk set).
        return [besti, bestj, bestsize];
    }

    let total = 0;
    const queue: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]];
    while (queue.length) {
        const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number];
        const [i, j, k] = findLongest(alo, ahi, blo, bhi);
        if (k > 0) {
            total += k;
            if (alo < i && blo < j) {
                queue.push([alo, i, blo, j]);
            }
            if (i + k < ahi && j + k < bhi) {
                queue.push([i + k, ahi, j + k, bhi]);
            }
        }
    }
    return total;
}

/** Port of difflib.get_close_matches(word, possibilities, n=1, cutoff=0.6). */
function _getCloseMatch(word: string, possibilities: readonly string[]): string | null {
    let best: { score: number; value: string } | null = null;
    for (const cand of possibilities) {
        const score = _ratio(word, cand);
        if (score >= 0.6) {
            if (best === null || score > best.score) {
                best = { score, value: cand };
            }
        }
    }
    return best ? best.value : null;
}

// --- Python repr of a JSON value (for schema-error message fidelity) ---------

/** Mirror Python's `repr()` of a value as `jsonschema` embeds it in messages. */
function _pyRepr(v: Json): string {
    if (v === null) {
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    if (typeof v === 'number') {
        return Number.isInteger(v) ? String(v) : String(v);
    }
    if (typeof v === 'string') {
        return _pyStrRepr(v);
    }
    if (Array.isArray(v)) {
        return `[${v.map((x) => _pyRepr(x)).join(', ')}]`;
    }
    // dict
    const obj = v as JsonObject;
    const parts = Object.keys(obj).map((k) => `${_pyStrRepr(k)}: ${_pyRepr(obj[k] as Json)}`);
    return `{${parts.join(', ')}}`;
}

/** Python `repr()` of a string (single-quote preference). */
function _pyStrRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// --- Draft-07 validator (reproducing jsonschema's message + ordering) --------

interface SchemaError {
    path: Array<string | number>;
    message: string;
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
        if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
            node = (node as JsonObject)[key] as Json;
        } else {
            return {};
        }
    }
    return (node as JsonObject) ?? {};
}

/**
 * Validate `data` against `schema`, collecting EVERY error (mirroring
 * `jsonschema.Draft7Validator.iter_errors`, which does not short-circuit) in
 * the same emission order jsonschema uses for this schema's keyword set. The
 * caller sorts by the path key, matching `sorted(..., key=lambda e: list(e.path))`.
 */
function _validateNode(
    data: Json,
    schema: JsonObject,
    rootSchema: JsonObject,
    segs: Array<string | number>,
    errors: SchemaError[],
): void {
    if (typeof schema['$ref'] === 'string') {
        _validateNode(data, _resolveRef(schema['$ref'], rootSchema), rootSchema, segs, errors);
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

    // string keywords
    if (typeof data === 'string') {
        const minLength = schema['minLength'];
        if (typeof minLength === 'number' && data.length < minLength) {
            // jsonschema renders minLength:1 specially as "should be non-empty".
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
                message: `${_pyRepr(data)} does not match '${pattern}'`,
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
        const items = schema['items'];
        if (items !== undefined && typeof items === 'object' && !Array.isArray(items)) {
            for (let i = 0; i < data.length; i++) {
                _validateNode(data[i] as Json, items as JsonObject, rootSchema, [...segs, i], errors);
            }
        }
    }

    // object keywords — emission order: additionalProperties, then required,
    // then per-property recursion (matches jsonschema for this schema).
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        const obj = data as JsonObject;
        const props = (schema['properties'] as JsonObject) ?? {};
        const additional = schema['additionalProperties'];
        if (additional === false) {
            for (const k of Object.keys(obj)) {
                if (!(k in props)) {
                    errors.push({
                        path: [...segs],
                        message: `Additional properties are not allowed (${_pyStrRepr(k)} was unexpected)`,
                    });
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
            if (k in obj && childSchema !== null && typeof childSchema === 'object') {
                _validateNode(obj[k] as Json, childSchema as JsonObject, rootSchema, [...segs, k], errors);
            }
        }
    }
}

/** Mirror `sorted(validator.iter_errors(data), key=lambda e: list(e.path))`. */
function _sortedSchemaErrors(data: Json, schema: JsonObject): SchemaError[] {
    const errors: SchemaError[] = [];
    _validateNode(data, schema, schema, [], errors);
    // Stable sort by path (element-wise, like Python list comparison). Paths in
    // this schema are [str...] / [str, int]; the first element is always a
    // string (or the list is empty for root), so no int↔str comparison occurs.
    return _stableSort(errors, (a, b) => _comparePath(a.path, b.path));
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

// --- resolution helpers ------------------------------------------------------

function _command_exists(ref: string): boolean {
    return resolve_logical(`commands/${ref}.md`) !== null;
}

function _skill_exists(slug: string): boolean {
    return resolve_logical(`skills/${slug}/SKILL.md`) !== null;
}

/** Best-effort universe of logical command refs for "did you mean?" hints. */
function _known_command_refs(): Set<string> {
    const base = path.join(ROOT, 'dist/agent-src', 'commands');
    if (!_isDir(base)) {
        return new Set();
    }
    const out = new Set<string>();
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            } else if (ent.name.endsWith('.md')) {
                const rel = path.relative(base, full).split(path.sep).join('/');
                out.add(rel.replace(/\.md$/, ''));
            }
        }
    };
    walk(base);
    return out;
}

function _known_skill_slugs(): Set<string> {
    const base = path.join(ROOT, 'src', 'skills');
    if (!_isDir(base)) {
        return new Set();
    }
    const out = new Set<string>();
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const ent of entries) {
        if (ent.isDirectory() && _isFile(path.join(base, ent.name, 'SKILL.md'))) {
            out.add(ent.name);
        }
    }
    return out;
}

/** Return a ` — did you mean 'X'?` hint, or '' if no close match. */
export function _suggest(ref: string, universe: Set<string>): string {
    // difflib.get_close_matches(ref, sorted(universe), n=1, cutoff=0.6)
    const match = _getCloseMatch(ref, [...universe].sort());
    return match ? ` — did you mean '${match}'?` : '';
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _rel(p: string): string {
    // Path.relative_to(ROOT) raises ValueError when p is outside ROOT; the
    // Python original then returns str(path). Mirror with the absolute path.
    const r = path.relative(ROOT, p);
    if (r === '' || r.startsWith('..') || path.isAbsolute(r)) {
        return p;
    }
    return r.split(path.sep).join('/');
}

/**
 * `yaml.safe_load` equivalent: YAML 1.1 core, returns null on empty doc.
 *
 * `uniqueKeys: false` reproduces PyYAML's lenient duplicate-key handling
 * (last value wins); the `yaml` npm default rejects duplicate map keys, which
 * PyYAML does not — a latent-behaviour parity requirement.
 */
function _safeLoad(text: string): Json {
    const doc = YAML.parse(text, { version: '1.1', uniqueKeys: false }) as Json;
    return doc ?? null;
}

// --- per-file check ----------------------------------------------------------

function _check_file(
    filePath: string,
    schema: JsonObject,
    knownCmds: Set<string>,
    knownSkills: Set<string>,
): Violation[] {
    const rel = _rel(filePath);
    const vios: Violation[] = [];

    let data: Json;
    try {
        data = _safeLoad(fs.readFileSync(filePath, 'utf-8'));
    } catch (exc) {
        return [{ file: rel, reason: `not valid YAML: ${_yamlErrMessage(exc)}` }];
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return [{ file: rel, reason: 'top-level YAML must be a mapping' }];
    }
    const dataObj = data as JsonObject;

    // 1. Shape
    for (const err of _sortedSchemaErrors(dataObj, schema)) {
        const loc = err.path.map((p) => String(p)).join('/') || '(root)';
        vios.push({ file: rel, reason: `schema: ${loc}: ${err.message}` });
    }

    // 3. Closed set + id == stem
    const flowId = dataObj['id'];
    const stem = path.basename(filePath).replace(/\.yaml$/, '');
    if (flowId !== stem) {
        vios.push({ file: rel, reason: `id '${_idStr(flowId)}' must equal filename stem '${stem}'` });
    }
    if (typeof flowId !== 'string' || !CLOSED_FLOWS.has(flowId)) {
        vios.push({
            file: rel,
            reason:
                `id '${_idStr(flowId)}' not in the closed flow set ` +
                `${_sortedListRepr(CLOSED_FLOWS)} — a new flow needs an ADR`,
        });
    }

    // 2. References resolve
    for (const field of _REF_FIELDS) {
        const refs = dataObj[field];
        for (const ref of Array.isArray(refs) ? refs : []) {
            if (typeof ref === 'string' && !_command_exists(ref)) {
                vios.push({
                    file: rel,
                    reason:
                        `${field}: command '${ref}' does not resolve ` +
                        `(no commands/${ref}.md)` +
                        `${_suggest(ref, knownCmds)}`,
                });
            }
        }
    }
    const skills = dataObj['skills'];
    for (const slug of Array.isArray(skills) ? skills : []) {
        if (typeof slug === 'string' && !_skill_exists(slug)) {
            vios.push({
                file: rel,
                reason:
                    `skills: skill '${slug}' does not resolve ` +
                    `(no skills/${slug}/SKILL.md)` +
                    `${_suggest(slug, knownSkills)}`,
            });
        }
    }
    return vios;
}

/**
 * Mirror Python's `data.get("id")` interpolated into an f-string. `None` →
 * the string "None"; a non-string scalar renders via str(). Only used in the
 * id-mismatch / closed-set messages (both fire when id is wrong).
 */
function _idStr(v: Json | undefined): string {
    if (v === undefined || v === null) {
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    return String(v);
}

/** Python `str(sorted(CLOSED_FLOWS))` — a list repr of sorted strings. */
function _sortedListRepr(s: ReadonlySet<string>): string {
    const sorted = [...s].sort();
    return `[${sorted.map((x) => _pyStrRepr(x)).join(', ')}]`;
}

/** Best-effort YAML error message (the Python text differs; flagged divergence). */
function _yamlErrMessage(exc: unknown): string {
    return exc instanceof Error ? exc.message : String(exc);
}

// --- main --------------------------------------------------------------------

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    // argparse: --quiet flag, -h/--help prints usage and exits 0.
    if (args.includes('-h') || args.includes('--help')) {
        process.stdout.write(_usage());
        return 0;
    }
    const unknown = args.filter((a) => a !== '--quiet');
    if (unknown.length > 0) {
        process.stderr.write(_usageError(unknown[0] as string));
        return 2;
    }
    const quiet = args.includes('--quiet');

    const flowsDir = FLOWS_DIR();
    if (!_isDir(flowsDir)) {
        process.stderr.write(`flows dir not found: ${flowsDir}\n`);
        return 3;
    }
    if (!_isFile(SCHEMA_PATH)) {
        process.stderr.write(`schema not found: ${SCHEMA_PATH}\n`);
        return 3;
    }

    let files: string[];
    const vios: Violation[] = [];
    try {
        const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8')) as JsonObject;
        const knownCmds = _known_command_refs();
        const knownSkills = _known_skill_slugs();
        files = _sortedYamlFiles(flowsDir).filter(
            (p) => !_NON_FLOW_FILES.has(path.basename(p)),
        );
        const seenIds = new Set<string>();
        for (const p of files) {
            for (const v of _check_file(p, schema, knownCmds, knownSkills)) {
                vios.push(v);
            }
            const data = _safeLoad(fs.readFileSync(p, 'utf-8'));
            if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
                const id = (data as JsonObject)['id'];
                if (typeof id === 'string') {
                    seenIds.add(id);
                }
            }
        }

        // 4. Completeness — every closed-set flow has a file
        const missing = [...CLOSED_FLOWS].filter((id) => !seenIds.has(id)).sort();
        for (const flowId of missing) {
            vios.push({
                file: `src/flows/${flowId}.yaml`,
                reason: `closed-set flow '${flowId}' has no file`,
            });
        }
    } catch (exc) {
        process.stderr.write(`lint_flows: internal error: ${exc instanceof Error ? exc.message : String(exc)}\n`);
        return 3;
    }

    if (vios.length > 0) {
        process.stderr.write(`lint_flows: ${vios.length} violation(s):\n`);
        for (const v of vios) {
            process.stderr.write(`  ${v.file}: ${v.reason}\n`);
        }
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `lint_flows: OK — ${files.length} flow file(s), ` +
                `${CLOSED_FLOWS.size} closed-set flows all present.\n`,
        );
    }
    return 0;
}

/** sorted(FLOWS_DIR.glob("*.yaml")). */
function _sortedYamlFiles(dir: string): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = entries
        .filter((name) => name.endsWith('.yaml'))
        .map((name) => path.join(dir, name))
        .filter((p) => _isFile(p));
    out.sort();
    return out;
}

function _usage(): string {
    return 'usage: lint_flows.py [-h] [--quiet]\n';
}

function _usageError(arg: string): string {
    return (
        'usage: lint_flows.py [-h] [--quiet]\n' +
        `lint_flows.py: error: unrecognized arguments: ${arg}\n`
    );
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ROOT, FLOWS_DIR, SCHEMA_PATH, CLOSED_FLOWS };

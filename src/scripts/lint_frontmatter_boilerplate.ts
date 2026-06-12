#!/usr/bin/env node
/**
 * Fail when an artefact carries a frontmatter field equal to its schema default.
 *
 * TypeScript twin of `src/scripts/lint_frontmatter_boilerplate.py` (ADR-090,
 * Phase 4 / Wave 4b). Mirrors the Python CLI contract exactly: `--quiet`,
 * scan scope + ordering (skills / rules / commands / personas via
 * `artefact_roots()`), finding messages, stdout/stderr split, exit codes
 * (0 clean, 1 boilerplate present). No behaviour changes.
 *
 * The frontmatter loader (`validate_frontmatter.apply_schema_defaults`) injects
 * the default at read time, so omitting the field is always behaviour-preserving.
 *
 * NOTE (divergence candidate — DC-1): the Python original imports
 * `_CATEGORIES`, `_iter`, `_plan_drops` from `migrate_frontmatter_defaults.py`,
 * which has no `.ts` twin yet (out of this batch's scope). To keep TS-only
 * dispatcher resolution working, those three helpers (and `_same`) are inlined
 * here, faithfully replicating the Python logic 1:1. This is code duplication,
 * not a behaviour change — flagged for de-duplication once
 * `migrate_frontmatter_defaults` is ported.
 *
 * Exit codes: 0 clean · 1 at least one boilerplate field present.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots } from './_lib/agent_src.js';
import {
    load_schema,
    parse_frontmatter,
    type YamlValue,
} from './validate_frontmatter.js';

// ROOT = Path(__file__).resolve().parents[2].
const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// --- Inlined from migrate_frontmatter_defaults.py (DC-1) --------------------

// (subdir, glob, schema name). The glob is "*.md" for recursing categories and
// "SKILL.md" for skills; personas use a non-recursive glob.
const _CATEGORIES: ReadonlyArray<[string, string, string]> = [
    ['skills', 'SKILL.md', 'skill'],
    ['rules', '*.md', 'rule'],
    ['commands', '*.md', 'command'],
    ['personas', '*.md', 'persona'],
];

function _isPlainObject(v: unknown): v is Record<string, YamlValue> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Type-safe equality. `True == 1` and `1.0 == 1` must NOT match across types
 * (preflight Decision C). bool is checked first because in Python
 * `isinstance(True, int)` is True. JSON-from-YAML has no int/float split, so
 * numeric equality is plain `===`; booleans never equal numbers here.
 */
function _same(value: YamlValue, def: YamlValue): boolean {
    if (typeof def === 'boolean') {
        return typeof value === 'boolean' && value === def;
    }
    if (typeof value === 'boolean') {
        return false;
    }
    if (typeof def === 'number') {
        return typeof value === 'number' && value === def;
    }
    if (typeof def === 'string') {
        return typeof value === 'string' && value === def;
    }
    if (def === null) {
        return value === null;
    }
    if (Array.isArray(def)) {
        return Array.isArray(value) && _deepEq(value, def);
    }
    if (_isPlainObject(def)) {
        return _isPlainObject(value) && _deepEq(value, def);
    }
    return false;
}

/** Structural equality for arrays / plain objects (Python `==` on list/dict). */
function _deepEq(a: YamlValue, b: YamlValue): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((x, i) => _eqValue(x, b[i] as YamlValue));
    }
    if (_isPlainObject(a) && _isPlainObject(b)) {
        const ka = Object.keys(a);
        const kb = Object.keys(b);
        if (ka.length !== kb.length) {
            return false;
        }
        return ka.every((k) => k in b && _eqValue(a[k] as YamlValue, b[k] as YamlValue));
    }
    return false;
}

/** Plain Python `==` (NOT type-safe — used only inside container comparison). */
function _eqValue(a: YamlValue, b: YamlValue): boolean {
    if (Array.isArray(a) || _isPlainObject(a) || Array.isArray(b) || _isPlainObject(b)) {
        return _deepEq(a, b);
    }
    return a === b;
}

interface PlanDrops {
    top: Set<string>;
    full: Set<string>;
    partial: Map<string, Set<string>>;
}

function _plan_drops(
    fm: Record<string, YamlValue>,
    schema: Record<string, YamlValue>,
): PlanDrops {
    const top = new Set<string>();
    const full = new Set<string>();
    const partial = new Map<string, Set<string>>();
    const props = _isPlainObject(schema['properties']) ? schema['properties'] : {};
    for (const [key, propRaw] of Object.entries(props)) {
        if (!_isPlainObject(propRaw)) {
            continue;
        }
        const prop = propRaw;
        if ('default' in prop) {
            if (key in fm && _same(fm[key] as YamlValue, prop['default'] as YamlValue)) {
                top.add(key);
            }
        } else if (prop['type'] === 'object' && _isPlainObject(fm[key])) {
            const fmBlock = fm[key] as Record<string, YamlValue>;
            const subProps = _isPlainObject(prop['properties']) ? prop['properties'] : {};
            const droppable = new Set<string>();
            for (const [sk, spRaw] of Object.entries(subProps)) {
                if (
                    _isPlainObject(spRaw) &&
                    'default' in spRaw &&
                    sk in fmBlock &&
                    _same(fmBlock[sk] as YamlValue, spRaw['default'] as YamlValue)
                ) {
                    droppable.add(sk);
                }
            }
            if (droppable.size === 0) {
                continue;
            }
            const present = new Set(Object.keys(fmBlock));
            // present <= droppable  (subset)
            const isSubset = [...present].every((p) => droppable.has(p));
            if (isSubset) {
                full.add(key);
            } else {
                partial.set(key, droppable);
            }
        }
    }
    return { top, full, partial };
}

/**
 * Mirror `validate_frontmatter._iter_artefacts` exactly: skills / rules /
 * commands recurse; personas are non-recursive (glob, not rglob) so advisor
 * personas and the `_template-specialist/` scaffold are never visited.
 * Skips symlinks and personas README.md.
 */
function* _iter(category_subdir: string, glob: string): Generator<string> {
    for (const root of artefact_roots()) {
        const base = path.join(root, category_subdir);
        if (!_exists(base)) {
            continue;
        }
        const recurse = category_subdir !== 'personas';
        const paths = recurse ? _rglob(base, glob) : _glob(base, glob);
        for (const p of paths.sort()) {
            if (_isFileNonSymlink(p)) {
                if (category_subdir === 'personas' && path.basename(p).toLowerCase() === 'readme.md') {
                    continue;
                }
                yield p;
            }
        }
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isFileNonSymlink(p: string): boolean {
    try {
        const st = fs.lstatSync(p);
        return st.isFile() && !st.isSymbolicLink();
    } catch {
        return false;
    }
}

/** Match a Python glob pattern that is either a literal name or `*.md`. */
function _globMatch(name: string, glob: string): boolean {
    if (glob === '*.md') {
        return name.endsWith('.md');
    }
    return name === glob;
}

/** Non-recursive glob (Path.glob) over immediate children. */
function _glob(dir: string, glob: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const e of entries) {
        if (_globMatch(e.name, glob)) {
            out.push(path.join(dir, e.name));
        }
    }
    return out;
}

/** Recursive glob (Path.rglob) matching `glob` at any depth. */
function _rglob(dir: string, glob: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(current, e.name);
            if (_globMatch(e.name, glob)) {
                out.push(full);
            }
            // rglob descends into directories (and symlinked dirs) regardless.
            let isDir = e.isDirectory();
            if (e.isSymbolicLink()) {
                try {
                    isDir = fs.statSync(full).isDirectory();
                } catch {
                    isDir = false;
                }
            }
            if (isDir) {
                walk(full);
            }
        }
    };
    walk(dir);
    return out;
}

// --- Linter body ------------------------------------------------------------

function _violations(filePath: string, schema: Record<string, YamlValue>): string[] {
    const text = fs.readFileSync(filePath, 'utf-8');
    const [fm] = parse_frontmatter(text);
    if (!_isPlainObject(fm)) {
        return [];
    }
    const { top, full, partial } = _plan_drops(fm, schema);
    const fields: string[] = [...top].sort().concat([...full].sort());
    for (const block of [...partial.keys()].sort()) {
        for (const s of [...partial.get(block)!].sort()) {
            fields.push(`${block}.${s}`);
        }
    }
    return fields;
}

function main(argv: readonly string[]): number {
    const quiet = _parse_args(argv);

    let total = 0;
    let offenders = 0;
    for (const [subdir, glob, schemaName] of _CATEGORIES) {
        const schema = load_schema(schemaName);
        for (const p of _iter(subdir, glob)) {
            total += 1;
            const fields = _violations(p, schema);
            if (fields.length > 0) {
                offenders += 1;
                const rel = path.relative(ROOT, p).split(path.sep).join('/');
                process.stdout.write(
                    `❌  ${rel}: frontmatter field(s) equal to schema default — ` +
                        `omit them: ${fields.join(', ')}\n`,
                );
            }
        }
    }

    if (offenders > 0) {
        process.stderr.write(
            `\n== frontmatter-boilerplate: ${offenders}/${total} artefact(s) carry a ` +
                'defaulted field. Omit it (the loader injects the default) or run ' +
                '`python3 scripts/migrate_frontmatter_defaults.py`. ==\n',
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write(
            `✅  lint-frontmatter-boilerplate: ${total} artefact(s) clean.\n`,
        );
    }
    return 0;
}

function _parse_args(argv: readonly string[]): boolean {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_frontmatter_boilerplate [-h] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(
                `lint_frontmatter_boilerplate: error: unrecognized arguments: ${arg}\n`,
            );
            process.exit(2);
        }
    }
    return quiet;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}

export {
    ROOT,
    _CATEGORIES,
    _same,
    _plan_drops,
    _iter,
    _violations,
    main,
    type PlanDrops,
};

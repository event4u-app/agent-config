#!/usr/bin/env node
/**
 * Migrate artefact frontmatter to omit fields equal to their schema default.
 *
 * TypeScript twin of `src/scripts/migrate_frontmatter_defaults.py` (ADR-090 —
 * Python→TS migration, Phase 8 / Wave 8e). Public surface mirrors the Python
 * module exactly: same CLI flags (`--dry-run`, `--deltas PATH`), same exit code
 * (0), same stdout summary, and byte-identical rewritten files + dry-run delta
 * report.
 *
 * Phase 2 of `road-to-abstraction-reduction.md`. For every skill / rule /
 * command / persona, drop any frontmatter field whose value equals the
 * `default` declared in its `scripts/schemas/*.json` (preflight Decision C:
 * value-equals-default, type-safe). Fields without a schema default
 * (`skill.execution.type`, `command.type`, `rule.validator_ignore`) are never
 * touched.
 *
 * The loader injects the same defaults at read time
 * (`validate_frontmatter.apply_schema_defaults`), so consumers see the field
 * present regardless. Idempotent: a second run is a no-op.
 *
 * Imports its two readers from the ported `validate_frontmatter` twin
 * (`load_schema`, `parse_frontmatter`) and `artefact_roots` from the
 * `agent_src` twin — re-imports rather than inlines the legacy-source
 * resolution, per ADR-051.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

import { load_schema, parse_frontmatter } from './validate_frontmatter.js';
import type { YamlValue } from './validate_frontmatter.js';
import { artefact_roots } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/migrate_frontmatter_defaults.ts → parents[2] is the package root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_DELTAS = path.join(
    ROOT,
    'agents',
    'evidence',
    'analysis',
    'abstraction-reduction-deltas.md',
);

// (subdir, glob, schema name)
const _CATEGORIES: ReadonlyArray<readonly [string, string, string]> = [
    ['skills', 'SKILL.md', 'skill'],
    ['rules', '*.md', 'rule'],
    ['commands', '*.md', 'command'],
    ['personas', '*.md', 'persona'],
];

const _FM_RE_OPEN = '---\n';

type SchemaObj = Record<string, YamlValue>;

function _isPlainObject(v: unknown): v is Record<string, YamlValue> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Type-safe equality. `True == 1` and `1.0 == 1` must NOT match across types
 * (preflight Decision C). bool is checked first because in Python
 * `isinstance(True, int)` is True.
 *
 * In TS the loaded YAML / JSON distinguishes boolean from number natively, so
 * `typeof` discrimination reproduces Python's `isinstance` checks. Schema
 * defaults are loaded from JSON, where integers and floats are both `number`;
 * Python's `type(value) is type(default)` would treat `1` (int) and `1.0`
 * (float) as different types. JSON has no int/float distinction, so a default
 * written as `1` and a value parsed as `1` are both `number` and compare equal
 * — matching how a JSON-sourced schema and a YAML-1.1-sourced value behave in
 * the Python twin too (both parse `1` to `int`, `1.0` to `float`). Mixed
 * int/float defaults do not occur in these schemas.
 */
function _same(value: YamlValue, defaultVal: YamlValue): boolean {
    if (typeof defaultVal === 'boolean') {
        return typeof value === 'boolean' && value === defaultVal;
    }
    if (typeof value === 'boolean') {
        return false;
    }
    if (typeof value !== typeof defaultVal) {
        return false;
    }
    if (Array.isArray(value) || Array.isArray(defaultVal)) {
        if (!Array.isArray(value) || !Array.isArray(defaultVal)) {
            return false;
        }
        return _deepEqual(value, defaultVal);
    }
    if (_isPlainObject(value) || _isPlainObject(defaultVal)) {
        if (!_isPlainObject(value) || !_isPlainObject(defaultVal)) {
            return false;
        }
        return _deepEqual(value, defaultVal);
    }
    return value === defaultVal;
}

/** Python `==` for lists/dicts of scalars (structural equality). */
function _deepEqual(a: YamlValue, b: YamlValue): boolean {
    if (a === b) {
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((x, i) => _deepEqual(x, b[i] as YamlValue));
    }
    if (_isPlainObject(a) && _isPlainObject(b)) {
        const ak = Object.keys(a);
        const bk = Object.keys(b);
        if (ak.length !== bk.length) {
            return false;
        }
        return ak.every((k) => k in b && _deepEqual(a[k] as YamlValue, b[k] as YamlValue));
    }
    return false;
}

interface DropPlan {
    top: Set<string>;
    full: Set<string>;
    partial: Map<string, Set<string>>;
}

function _plan_drops(fm: SchemaObj, schema: SchemaObj): DropPlan {
    const top = new Set<string>();
    const full = new Set<string>();
    const partial = new Map<string, Set<string>>();
    const props = _isPlainObject(schema.properties) ? schema.properties : {};
    for (const [key, propRaw] of Object.entries(props)) {
        if (!_isPlainObject(propRaw)) {
            continue;
        }
        const prop = propRaw;
        if ('default' in prop) {
            if (key in fm && _same(fm[key]!, prop.default as YamlValue)) {
                top.add(key);
            }
        } else if (prop.type === 'object' && _isPlainObject(fm[key])) {
            const subProps = _isPlainObject(prop.properties) ? prop.properties : {};
            const fmBlock = fm[key] as Record<string, YamlValue>;
            const droppable = new Set<string>();
            for (const [sk, spRaw] of Object.entries(subProps)) {
                if (
                    _isPlainObject(spRaw) &&
                    'default' in spRaw &&
                    sk in fmBlock &&
                    _same(fmBlock[sk]!, spRaw.default as YamlValue)
                ) {
                    droppable.add(sk);
                }
            }
            if (droppable.size === 0) {
                continue;
            }
            const present = new Set(Object.keys(fmBlock));
            // present <= droppable (subset) → drop the whole block.
            let subset = true;
            for (const k of present) {
                if (!droppable.has(k)) {
                    subset = false;
                    break;
                }
            }
            if (subset) {
                full.add(key);
            } else {
                partial.set(key, droppable);
            }
        }
    }
    return { top, full, partial };
}

function _indent(line: string): number {
    let n = 0;
    while (n < line.length && line[n] === ' ') {
        n += 1;
    }
    return n;
}

function _rewrite_fm_body(body: string, plan: DropPlan): string {
    const lines = body.split('\n');
    const out: string[] = [];
    let skippingBlock = false;
    let currentBlock: string | null = null;
    for (const line of lines) {
        const stripped = line.trim();
        const ind = _indent(line);
        if (skippingBlock) {
            if (stripped === '' || ind > 0) {
                continue;
            }
            skippingBlock = false;
            currentBlock = null;
        }
        if (ind === 0 && stripped && !stripped.startsWith('#')) {
            const key = stripped.split(':', 1)[0]!.trim();
            if (plan.top.has(key)) {
                continue;
            }
            if (plan.full.has(key)) {
                skippingBlock = true;
                continue;
            }
            currentBlock = plan.partial.has(key) ? key : null;
            out.push(line);
            continue;
        }
        if (currentBlock !== null && ind > 0 && stripped.includes(':')) {
            const subKey = stripped.split(':', 1)[0]!.trim();
            const droppable = plan.partial.get(currentBlock);
            if (droppable && droppable.has(subKey)) {
                continue;
            }
        }
        out.push(line);
    }
    return out.join('\n');
}

/** Python `str.count("\n")`. */
function _countNewlines(s: string): number {
    let n = 0;
    for (let i = 0; i < s.length; i += 1) {
        if (s.charCodeAt(i) === 10) {
            n += 1;
        }
    }
    return n;
}

function _migrate_file(p: string, schema: SchemaObj): number {
    const text = fs.readFileSync(p, 'utf-8');
    const [fmRaw] = parse_frontmatter(text);
    if (!_isPlainObject(fmRaw)) {
        return 0;
    }
    const fm = fmRaw as SchemaObj;
    const plan = _plan_drops(fm, schema);
    if (plan.top.size === 0 && plan.full.size === 0 && plan.partial.size === 0) {
        return 0;
    }
    if (!text.startsWith(_FM_RE_OPEN)) {
        return 0;
    }
    const end = text.indexOf('\n---\n', _FM_RE_OPEN.length);
    if (end === -1) {
        return 0;
    }
    const body = text.slice(_FM_RE_OPEN.length, end);
    const newBody = _rewrite_fm_body(body, plan);
    if (newBody === body) {
        return 0;
    }
    const newText = _FM_RE_OPEN + newBody + text.slice(end);
    const removed = _countNewlines(body) - _countNewlines(newBody);
    fs.writeFileSync(p, newText, 'utf-8');
    return removed;
}

// --- Path iteration (mirrors validate_frontmatter._iter_artefacts) ----------

function _isFileNoSymlink(p: string): boolean {
    try {
        const l = fs.lstatSync(p);
        if (l.isSymbolicLink()) {
            return false;
        }
        return l.isFile();
    } catch {
        return false;
    }
}

/** Non-recursive `Path.glob("*.md")` (personas). */
function _globNonRecursive(base: string, glob: string): string[] {
    const ext = glob === '*.md' ? '.md' : null;
    let names: string[];
    try {
        names = fs.readdirSync(base);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const n of names) {
        if (ext !== null ? n.endsWith(ext) : n === glob) {
            out.push(path.join(base, n));
        }
    }
    return out;
}

/** Recursive `Path.rglob(<glob>)` — matches a literal filename or `*.md`. */
function _rglob(base: string, glob: string): string[] {
    const matchName = (name: string): boolean =>
        glob === '*.md' ? name.endsWith('.md') : name === glob;
    const out: string[] = [];
    const walk = (dir: string): void => {
        let ents: fs.Dirent[];
        try {
            ents = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of ents) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.isSymbolicLink()) {
                // pathlib.rglob follows directory symlinks; recurse if it points
                // to a directory, otherwise treat as a candidate file.
                try {
                    if (fs.statSync(full).isDirectory()) {
                        walk(full);
                        continue;
                    }
                } catch {
                    /* dangling symlink — treat as a (non-dir) match candidate */
                }
                if (matchName(ent.name)) {
                    out.push(full);
                }
            } else if (matchName(ent.name)) {
                out.push(full);
            }
        }
    };
    walk(base);
    return out;
}

function _pyPathCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Mirror `validate_frontmatter._iter_artefacts` exactly: skills / rules /
 * commands recurse; personas are non-recursive (`glob`, not `rglob`) so advisor
 * personas and the `_template-specialist/` scaffold are never migrated.
 */
function* _iter(categorySubdir: string, glob: string): Generator<string> {
    for (const root of artefact_roots()) {
        const base = path.join(root, categorySubdir);
        if (!fs.existsSync(base)) {
            continue;
        }
        const paths =
            categorySubdir === 'personas'
                ? _globNonRecursive(base, glob)
                : _rglob(base, glob);
        paths.sort(_pyPathCmp);
        for (const p of paths) {
            if (_isFileNoSymlink(p)) {
                if (categorySubdir === 'personas' && path.basename(p).toLowerCase() === 'readme.md') {
                    continue;
                }
                yield p;
            }
        }
    }
}

// --- Python-style number formatting for the summary ------------------------

/** Right-align an int in `width` columns (Python `{n:5d}`). */
function _rjustInt(n: number, width: number): string {
    return String(n).padStart(width, ' ');
}

/** Left-align in `width` columns (Python `{s:8s}`). */
function _ljust(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

export function run(apply: boolean, deltasPath: string): number {
    const perClassLines = new Map<string, number>();
    const perClassFiles = new Map<string, number>();
    const addLines = (k: string, n: number): void => {
        perClassLines.set(k, (perClassLines.get(k) ?? 0) + n);
    };
    const addFiles = (k: string): void => {
        perClassFiles.set(k, (perClassFiles.get(k) ?? 0) + 1);
    };

    for (const [subdir, glob, schemaName] of _CATEGORIES) {
        const schema = load_schema(schemaName) as SchemaObj;
        for (const p of _iter(subdir, glob)) {
            let removed: number;
            if (apply) {
                removed = _migrate_file(p, schema);
            } else {
                // Dry-run: compute the delta without writing.
                const text = fs.readFileSync(p, 'utf-8');
                const [fmRaw] = parse_frontmatter(text);
                if (!_isPlainObject(fmRaw) || !text.startsWith(_FM_RE_OPEN)) {
                    continue;
                }
                const end = text.indexOf('\n---\n', _FM_RE_OPEN.length);
                if (end === -1) {
                    continue;
                }
                const body = text.slice(_FM_RE_OPEN.length, end);
                const plan = _plan_drops(fmRaw as SchemaObj, schema);
                const newBody = _rewrite_fm_body(body, plan);
                removed = _countNewlines(body) - _countNewlines(newBody);
            }
            if (removed) {
                addLines(schemaName, removed);
                addFiles(schemaName);
            }
        }
    }

    let totalLines = 0;
    for (const v of perClassLines.values()) {
        totalLines += v;
    }
    let totalFiles = 0;
    for (const v of perClassFiles.values()) {
        totalFiles += v;
    }
    const verb = !apply ? 'would remove' : 'removed';
    const out: string[] = [];
    out.push(`frontmatter-default migration (${!apply ? 'dry-run' : 'apply'}):`);
    for (const [, , schemaName] of _CATEGORIES) {
        if (perClassFiles.get(schemaName)) {
            out.push(
                `  ${_ljust(schemaName, 8)}: ${verb} ${_rjustInt(perClassLines.get(schemaName) ?? 0, 5)} lines ` +
                    `across ${perClassFiles.get(schemaName)} files`,
            );
        }
    }
    out.push(`  ${_ljust('TOTAL', 8)}: ${verb} ${totalLines} lines across ${totalFiles} files`);

    if (!apply) {
        _write_deltas(deltasPath, perClassLines, perClassFiles, totalLines, totalFiles);
        out.push(`  delta report → ${_relativeTo(deltasPath, ROOT)}`);
    }
    process.stdout.write(out.join('\n') + '\n');
    return 0;
}

/**
 * Python `Path.relative_to(ROOT)` — POSIX-style relative path. Raises
 * `ValueError` when the path is not a subpath of `base` (replicated: the Python
 * twin would crash with an uncaught ValueError → exit 1; the default deltas path
 * is under ROOT, so this only fires for an out-of-ROOT `--deltas`).
 */
function _relativeTo(p: string, base: string): string {
    const abs = path.resolve(p);
    const baseAbs = path.resolve(base);
    const rel = path.relative(baseAbs, abs);
    if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) {
        throw new Error(
            `'${abs}' is not in the subpath of '${baseAbs}' OR one path is relative and the other is absolute.`,
        );
    }
    // Python `Path.relative_to(base)` returns `.` when path == base.
    return rel === '' ? '.' : rel.split(path.sep).join('/');
}

function _write_deltas(
    p: string,
    lines: Map<string, number>,
    files: Map<string, number>,
    totalLines: number,
    totalFiles: number,
): void {
    const rows = _CATEGORIES.filter(([, , sn]) => files.get(sn))
        .map(([, , sn]) => `| ${sn} | ${files.get(sn) ?? 0} | ${lines.get(sn) ?? 0} |`)
        .join('\n');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(
        p,
        '# Abstraction-reduction — frontmatter line-count delta\n\n' +
            '> Dry-run prediction from `scripts/migrate_frontmatter_defaults.py ' +
            '--dry-run` (road-to-abstraction-reduction.md Phase 2 § Step 2). Lines\n' +
            '> are frontmatter lines dropped because their value equalled the\n' +
            '> schema default; the loader re-injects them at read time.\n\n' +
            '| Class | Files touched | Lines removed |\n' +
            '|---|---:|---:|\n' +
            `${rows}\n` +
            `| **TOTAL** | **${totalFiles}** | **${totalLines}** |\n`,
        'utf-8',
    );
}

interface Args {
    dry_run: boolean;
    deltas: string;
}

function parse_args(argv: string[]): Args {
    const out: Args = { dry_run: false, deltas: DEFAULT_DELTAS };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i]!;
        if (a === '--dry-run') {
            out.dry_run = true;
        } else if (a === '--deltas' || a.startsWith('--deltas=')) {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                out.deltas = a.slice(eq + 1);
            } else {
                i += 1;
                const v = argv[i];
                if (v === undefined) {
                    process.stderr.write('error: argument --deltas: expected one argument\n');
                    process.exit(2);
                }
                out.deltas = v;
            }
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: migrate_frontmatter_defaults [-h] [--dry-run] [--deltas DELTAS]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    return run(!args.dry_run, args.deltas);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    process.exit(main());
}

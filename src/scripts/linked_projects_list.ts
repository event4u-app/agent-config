#!/usr/bin/env node
/**
 * `agent-config linked-projects:list` — list opted-in IDE-attached siblings.
 *
 * TypeScript twin of `linked_projects_list.py` (Phase 8 / Wave 8e).
 *
 * Phase 4 of `road-to-leaner-core-and-discovery`; closes the ADR-032 follow-up
 * "expose the detector as a CLI subcommand for consumer reach". Pure wrapper over
 * `scripts/_lib/linked_projects.detect_linked_projects` + the
 * `agents/settings/.agent-settings.local.yml` → `linked_projects[]` opt-in
 * cascade. No detection logic is duplicated here.
 *
 * Prints opted-in siblings (`path · detected_via · large`). `--all` shows every
 * detected sibling with its opt-in status; `--format json` is machine-readable.
 * Read-only, no network.
 *
 * Usage:
 *   node linked_projects_list.js [--all] [--format text|json] [--root PATH]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { detect_linked_projects, type LinkedProjectEntry } from './_lib/linked_projects.js';

const _HERE = fileURLToPath(import.meta.url);

const LOCAL_SETTINGS = path.join('agents', 'settings', '.agent-settings.local.yml');

/** Map resolved sibling path → include flag from the local settings cascade. */
function _opt_in_map(root: string): Map<string, boolean> {
    const f = path.join(root, LOCAL_SETTINGS);
    if (!_isFile(f)) {
        return new Map();
    }
    let data: unknown;
    try {
        data = parseYaml(fs.readFileSync(f, 'utf-8'), { version: '1.1' }) ?? {};
    } catch {
        return new Map();
    }
    const out = new Map<string, boolean>();
    const projects = _asObj(data)['linked_projects'];
    const list = Array.isArray(projects) ? projects : [];
    for (const entry of list) {
        if (_isObj(entry) && _pyTruthy((entry as Record<string, unknown>)['path'])) {
            const e = entry as Record<string, unknown>;
            const include = _pyBool(e['include']);
            try {
                out.set(_resolveUser(_str(e['path'])), include);
            } catch {
                // Python OSError fallback → key on the raw path.
                out.set(_str(e['path']), include);
            }
        }
    }
    return out;
}

interface Row extends LinkedProjectEntry {
    include: boolean | null;
}

export function collect(root: string, show_all: boolean): Row[] {
    const detected = detect_linked_projects(root);
    const opt_in = _opt_in_map(root);
    const rows: Row[] = [];
    for (const d of detected) {
        const include = opt_in.has(d.path) ? (opt_in.get(d.path) as boolean) : null; // None = undecided
        if (!show_all && include !== true) {
            continue;
        }
        rows.push({ ...d, include });
    }
    return rows;
}

export function render_text(rows: Row[], show_all: boolean): string {
    if (rows.length === 0) {
        const scope = show_all ? 'detected' : 'opted-in';
        return `No ${scope} linked-project siblings. (Attach a sibling repo in your IDE and opt in.)`;
    }
    const lines = ['| path | detected via | large | opted in |', '|---|---|---|---|'];
    for (const r of rows) {
        const inc = r.include === true ? 'yes' : r.include === false ? 'no' : 'undecided';
        lines.push(`| ${r.path} | ${r.detected_via} | ${r.large ? 'yes' : 'no'} | ${inc} |`);
    }
    return lines.join('\n');
}

function _argError(msg: string): never {
    process.stderr.write(
        'usage: linked_projects_list.py [-h] [--all] [--format {text,json}]\n' +
            '                               [--root ROOT]\n',
    );
    process.stderr.write(`linked_projects_list.py: error: ${msg}\n`);
    process.exit(2);
}

interface ParsedArgs {
    all: boolean;
    format: 'text' | 'json';
    root: string;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { all: false, format: 'text', root: '.' };
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(
                'List opted-in IDE-attached sibling projects (read-only).\n',
            );
            process.exit(0);
        } else if (a === '--all') {
            out.all = true;
        } else if (a === '--format') {
            const v = argv[i + 1];
            if (v === undefined) _argError('argument --format: expected one argument');
            _checkFormat(v as string);
            out.format = v as 'text' | 'json';
            i += 1;
        } else if (a.startsWith('--format=')) {
            const v = a.slice('--format='.length);
            _checkFormat(v);
            out.format = v as 'text' | 'json';
        } else if (a === '--root') {
            const v = argv[i + 1];
            if (v === undefined) _argError('argument --root: expected one argument');
            out.root = v as string;
            i += 1;
        } else if (a.startsWith('--root=')) {
            out.root = a.slice('--root='.length);
        } else if (a.startsWith('-') && a !== '-') {
            _argError(`unrecognized arguments: ${a}`);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
        i += 1;
    }
    return out;
}

function _checkFormat(v: string): void {
    if (v !== 'text' && v !== 'json') {
        _argError(`argument --format: invalid choice: '${v}' (choose from 'text', 'json')`);
    }
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const root = _resolveAbs(args.root);
    const rows = collect(root, args.all);
    if (args.format === 'json') {
        process.stdout.write(
            _pyJsonDumpsIndent2({ root, siblings: rows }) + '\n',
        );
    } else {
        process.stdout.write(render_text(rows, args.all) + '\n');
    }
    return 0;
}

// ---------- helpers ----------

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _asObj(v: unknown): Record<string, unknown> {
    return _isObj(v) ? (v as Record<string, unknown>) : {};
}

function _isObj(v: unknown): boolean {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _str(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    return String(v);
}

/** Python bool(entry.get("include")) — truthiness, not strict equality. */
function _pyBool(v: unknown): boolean {
    return _pyTruthy(v);
}

function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/** Python Path(p).expanduser().resolve() — expands ~, follows symlinks. */
function _resolveUser(p: string): string {
    let expanded = p;
    if (p === '~') {
        expanded = os.homedir();
    } else if (p.startsWith('~/') || p.startsWith('~' + path.sep)) {
        expanded = path.join(os.homedir(), p.slice(2));
    }
    return _resolvePath(expanded);
}

/** Python Path(args.root).resolve() — absolute + symlink-resolved. */
function _resolveAbs(p: string): string {
    return _resolvePath(p);
}

/**
 * Mirror Python pathlib `.resolve()` — absolute, symlink-following, with a
 * prefix-resolution fallback for non-existent leaves (matches the
 * `_resolve_path` helper in the linked_projects twin).
 */
function _resolvePath(p: string): string {
    const abs = path.resolve(p);
    try {
        return fs.realpathSync(abs);
    } catch {
        // fall through to prefix resolution
    }
    let cur = abs;
    const tail: string[] = [];
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur) {
            return abs; // reached the filesystem root without resolving
        }
        tail.push(path.basename(cur));
        cur = parent;
        try {
            const base = fs.realpathSync(cur);
            tail.reverse();
            return path.join(base, ...tail);
        } catch {
            // keep walking up
        }
    }
}

/** Mirror json.dumps(obj, indent=2). */
function _pyJsonDumpsIndent2(obj: unknown): string {
    return _dumpValue(obj, 0);
}

function _dumpValue(value: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return _dumpString(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => padInner + _dumpValue(v, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const items = entries.map(
        ([k, v]) => padInner + _dumpString(k) + ': ' + _dumpValue(v, depth + 1),
    );
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
}

function _dumpString(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
        else if (code < 0x7f) out += ch;
        else if (code <= 0xffff) out += '\\u' + code.toString(16).padStart(4, '0');
        else {
            const v = code - 0x10000;
            const hi = 0xd800 + (v >> 10);
            const lo = 0xdc00 + (v & 0x3ff);
            out += '\\u' + hi.toString(16).padStart(4, '0');
            out += '\\u' + lo.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

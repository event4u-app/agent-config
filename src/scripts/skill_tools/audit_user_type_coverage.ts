#!/usr/bin/env node
/**
 * Block D · D3 — audit_user_type_coverage.
 *
 * TypeScript twin of `src/scripts/skill_tools/audit_user_type_coverage.py`
 * (ADR-092, Phase 8 Wave 8h). Mirrors the Python CLI contract EXACTLY —
 * flags (`--user-types-dir`, `--search-root`, `--json`), exit code (0
 * always), stdout split, byte-identical human table AND byte-identical JSON
 * (`json.dump(..., indent=2)`, ensure_ascii default).
 *
 * Coverage audit for the user-type axis. User-types are **CLI-only** in v1
 * (see `docs/contracts/adr-user-types-axis.md` and Phase 4 step 3 of
 * `agents/roadmaps/step-6-user-types-axis.md`) — skills do NOT declare a
 * `user-types:` frontmatter key, so persona-style citation counting does
 * not apply. Instead this script:
 *
 *   - Inventories every user-type file in the source directory.
 *   - Scans skills, commands, and `docs/` for `--user-type=<id>` mentions.
 *   - Flags **orphan references** (CLI mention to a non-existent id) and
 *     **never-referenced** user-types (file exists but nobody cites it).
 *
 * Inputs:
 *   --user-types-dir DIR — directory holding user-type Markdown files
 *   --search-root DIR    — root to recurse for `--user-type=<id>` mentions
 *   --json               — machine-readable output
 *
 * Output: per-user-type reference count + status (ok / never-referenced /
 * orphan). Exit code: 0 always (advisory, not a CI gate).
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/skill_tools/audit_user_type_coverage.ts → parents[3] of the .py
// (skill_tools → scripts → src → repo root) is the package root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const DEFAULT_USER_TYPES = path.join(ROOT, '.agent-src.uncondensed', 'user-types');
export const DEFAULT_SEARCH_ROOT = path.join(ROOT, '.agent-src.uncondensed');
export const REFERENCE_THRESHOLD = 1; // user-type with 0 references → flagged.

// Matches `--user-type=<id>` in command markdown, skill prose, docs.
// re.compile(r"--user-type=([\w-]+)") — \w is ASCII for the real ids.
const _REFERENCE_RE = /--user-type=([\w-]+)/gu;

/** Mirror Python len(str) — count Unicode code points. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n++;
    }
    return n;
}

function _read_block(filePath: string): string {
    const text = fs.readFileSync(filePath, 'utf-8');
    if (!text.startsWith('---')) {
        return '';
    }
    const end = text.indexOf('\n---', 3);
    return end !== -1 ? text.slice(3, end) : '';
}

export function _frontmatter_value(block: string, key: string): string | null {
    const re = new RegExp(`^${_reEscape(key)}[\\s]*:[\\s]*(.+)$`, 'mu');
    const m = re.exec(block);
    if (!m) {
        return null;
    }
    let val = (m[1] as string).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
    }
    return val;
}

/** Mirror Python re.escape for the small ASCII keys these tools use. */
function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function _load_user_types(userTypesDir: string): Set<string> {
    const ids = new Set<string>();
    if (!_isDir(userTypesDir)) {
        return ids;
    }
    for (const md of _globMd(userTypesDir)) {
        if (path.basename(md).toLowerCase() === 'readme.md') {
            continue;
        }
        const block = _read_block(md);
        const slug = _frontmatter_value(block, 'id') ?? _stem(md);
        ids.add(slug);
    }
    // Walk one level deeper to skip `_template/` etc.
    for (const md of _globMdOneLevel(userTypesDir)) {
        // if "_template" in md.parts: continue
        if (_parts(md).includes('_template')) {
            continue;
        }
        const block = _read_block(md);
        const slug = _frontmatter_value(block, 'id') ?? path.basename(path.dirname(md));
        ids.add(slug);
    }
    return ids;
}

export function _count_references(searchRoot: string, skipDir: string): Map<string, number> {
    const counts = new Map<string, number>();
    if (!_isDir(searchRoot)) {
        return counts;
    }
    const skipResolved = _isDir(skipDir) ? path.resolve(skipDir) : null;
    // search_root.rglob("*.md") — recursive, OS-order; counting is
    // order-independent so totals are deterministic.
    for (const md of _rglobMd(searchRoot)) {
        // Don't count references inside the user-types dir itself.
        if (skipResolved !== null && _resolvedParents(path.resolve(md)).includes(skipResolved)) {
            continue;
        }
        const text = fs.readFileSync(md, 'utf-8');
        _REFERENCE_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = _REFERENCE_RE.exec(text)) !== null) {
            const slug = m[1] as string;
            counts.set(slug, (counts.get(slug) ?? 0) + 1);
        }
    }
    return counts;
}

export interface UserTypeRow {
    user_type: string;
    references: number;
    threshold: number;
    status: string;
}

export function audit(userTypesDir: string, searchRoot: string): UserTypeRow[] {
    const ids = _load_user_types(userTypesDir);
    const references = _count_references(searchRoot, userTypesDir);
    const rows: UserTypeRow[] = [];
    // for slug in sorted(ids):
    const sortedIds = [...ids].sort(_pyCmp);
    for (const slug of sortedIds) {
        const count = references.get(slug) ?? 0;
        const status = count >= REFERENCE_THRESHOLD ? 'ok' : 'never-referenced';
        rows.push({
            user_type: slug,
            references: count,
            threshold: REFERENCE_THRESHOLD,
            status,
        });
    }
    // for slug in sorted(references.keys()):
    const sortedRefs = [...references.keys()].sort(_pyCmp);
    for (const slug of sortedRefs) {
        if (!ids.has(slug)) {
            rows.push({
                user_type: slug,
                references: references.get(slug) as number,
                threshold: REFERENCE_THRESHOLD,
                status: 'orphan',
            });
        }
    }
    return rows;
}

/** Python str comparison — code-point ordering. */
function _pyCmp(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

/** Mirror Python `f"{s:<{w}}"` (left-justify) over code-point width. */
function _ljust(s: string, w: number): string {
    const len = pyLen(s);
    return len >= w ? s : s + ' '.repeat(w - len);
}

/** Mirror Python `f"{n:>5}"` (right-justify width 5). */
function _rjust5(s: string): string {
    return s.length >= 5 ? s : ' '.repeat(5 - s.length) + s;
}

function _print_human(rows: UserTypeRow[]): string[] {
    if (rows.length === 0) {
        return ['(no user-types found)'];
    }
    const lines: string[] = [];
    const width = Math.max(...rows.map((r) => pyLen(r.user_type)));
    lines.push(`  ${_ljust('user-type', width)}  refs   status`);
    lines.push(`  ${'-'.repeat(width)}  -----  ----------------`);
    for (const r of rows) {
        lines.push(`  ${_ljust(r.user_type, width)}  ${_rjust5(String(r.references))}  ${r.status}`);
    }
    const flagged = rows.filter((r) => r.status !== 'ok');
    if (flagged.length > 0) {
        lines.push(`\n  ${flagged.length} user-type(s) flagged (never-referenced or orphan).`);
    }
    return lines;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _stem(p: string): string {
    const base = path.basename(p);
    const ext = path.extname(base);
    return ext ? base.slice(0, base.length - ext.length) : base;
}

/** pathlib Path.parts equivalent — split the path into components. */
function _parts(p: string): string[] {
    return p.split(path.sep).filter((c) => c !== '');
}

/** Resolved ancestor dirs (mirror pathlib Path.resolve().parents membership). */
function _resolvedParents(resolved: string): string[] {
    const out: string[] = [];
    let cur = resolved;
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur) {
            break;
        }
        out.push(parent);
        cur = parent;
    }
    return out;
}

/** Sorted *.md directly under a dir (mirrors `sorted(dir.glob("*.md"))`). */
function _globMd(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const name of names) {
        if (!name.endsWith('.md')) {
            continue;
        }
        const full = path.join(dir, name);
        try {
            if (fs.statSync(full).isFile()) {
                out.push(name);
            }
        } catch {
            // skip
        }
    }
    out.sort();
    return out.map((name) => path.join(dir, name));
}

/** Sorted one-level-deep *.md (mirrors `sorted(dir.glob("*<slash>*.md"))`). */
function _globMdOneLevel(dir: string): string[] {
    let subs: string[];
    try {
        subs = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const sub of subs) {
        const subDir = path.join(dir, sub);
        let isDir = false;
        try {
            isDir = fs.statSync(subDir).isDirectory();
        } catch {
            isDir = false;
        }
        if (!isDir) {
            continue;
        }
        let files: string[];
        try {
            files = fs.readdirSync(subDir);
        } catch {
            continue;
        }
        for (const name of files) {
            if (!name.endsWith('.md')) {
                continue;
            }
            const full = path.join(subDir, name);
            try {
                if (fs.statSync(full).isFile()) {
                    out.push(full);
                }
            } catch {
                // skip
            }
        }
    }
    // Python `sorted(glob("*<slash>*.md"))` sorts Path objects component-wise;
    // matching the joined-relative-path order is equivalent here because the
    // prefix (`dir`) is shared and the only varying components are
    // `<sub>/<name>.md`. Sort by the resulting paths' component tuples.
    out.sort((a, b) => _pyPathCmp(path.relative(dir, a), path.relative(dir, b)));
    return out;
}

/** Component-wise comparison of two relative paths (pathlib part-wise sort). */
function _pyPathCmp(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const ca = pa[i] as string;
        const cb = pb[i] as string;
        if (ca < cb) {
            return -1;
        }
        if (ca > cb) {
            return 1;
        }
    }
    return pa.length - pb.length;
}

/** Recursive *.md under a root (mirrors `search_root.rglob("*.md")`). */
function _rglobMd(root: string): string[] {
    const out: string[] = [];
    const stack: string[] = [root];
    while (stack.length > 0) {
        const dir = stack.pop() as string;
        let names: string[];
        try {
            names = fs.readdirSync(dir);
        } catch {
            continue;
        }
        for (const name of names) {
            const full = path.join(dir, name);
            let st: fs.Stats;
            try {
                st = fs.statSync(full);
            } catch {
                continue;
            }
            if (st.isDirectory()) {
                stack.push(full);
            } else if (st.isFile() && name.endsWith('.md')) {
                out.push(full);
            }
        }
    }
    return out;
}

// --- json.dumps(indent=2) emulation (ensure_ascii=True default) -------------

function _pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function pyJsonDumpsIndent2(obj: Json, level = 0): string {
    if (obj === null) {
        return 'null';
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + pyJsonDumpsIndent2(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) => `${pad}${_pyJsonStr(k)}: ${pyJsonDumpsIndent2((obj as Record<string, Json>)[k], level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

// --- argparse surface --------------------------------------------------------

const PROG = 'audit_user_type_coverage.py';

interface Args {
    user_types_dir: string;
    search_root: string;
    json: boolean;
}

function _argError(message: string): never {
    process.stderr.write(`${PROG}: error: ${message}\n`);
    process.exit(2);
}

export function parse_args(argv: string[]): Args {
    const args: Args = {
        user_types_dir: DEFAULT_USER_TYPES,
        search_root: DEFAULT_SEARCH_ROOT,
        json: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--json') {
            args.json = true;
        } else if (a === '--user-types-dir') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --user-types-dir: expected one argument');
            }
            args.user_types_dir = v;
        } else if (a.startsWith('--user-types-dir=')) {
            args.user_types_dir = a.slice('--user-types-dir='.length);
        } else if (a === '--search-root') {
            const v = argv[++i];
            if (v === undefined) {
                _argError('argument --search-root: expected one argument');
            }
            args.search_root = v;
        } else if (a.startsWith('--search-root=')) {
            args.search_root = a.slice('--search-root='.length);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const rows = audit(args.user_types_dir, args.search_root);
    if (args.json) {
        process.stdout.write(pyJsonDumpsIndent2({ rows }));
        process.stdout.write('\n');
    } else {
        const lines = _print_human(rows);
        process.stdout.write(lines.join('\n') + '\n');
    }
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}

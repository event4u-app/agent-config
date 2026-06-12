#!/usr/bin/env tsx
/**
 * Materialise the `with` and `without` clones for the package-impact A/B bench.
 *
 * TypeScript twin of `src/scripts/bench_ab_clone.py` (ADR-090 py2ts
 * Phase 8 / Wave 8d). The CLI contract mirrors the Python original
 * EXACTLY — `--refresh`, `--variant`, `--print-shape-hash`, exit codes,
 * stdout/stderr split, byte-identical written manifest
 * (`json.dumps(indent=2)` + trailing newline) and the
 * `target_shape_hash` (sha256 over the same surface definition + the
 * sorted fixture tree). No behaviour changes; latent Python bugs are
 * replicated and flagged as divergence candidates.
 *
 * Phase 1 Step 2 of `agents/roadmaps/road-to-package-impact-benchmark.md`.
 *
 * The fixture lives at `internal/bench/ab/fixture/`. Both clones are byte-identical
 * copies of the fixture; the `with` clone additionally receives the agent-config
 * surface (`.claude/`, `.augment/`, `AGENTS.md`, `CLAUDE.md`) so a Claude Code
 * session run inside it sees the same files a consumer project would after
 * running the installer.
 *
 * Idempotent: re-running without `--refresh` leaves an existing clone alone. With
 * `--refresh`, the target clone is removed and rebuilt from scratch.
 *
 * The clones tree (`internal/bench/ab/clones/`) is gitignored — only this script's
 * output schema is committed.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// Python: Path(__file__).resolve().parents[2] → repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const AB_ROOT = path.join(REPO_ROOT, 'internal', 'bench', 'ab');
const FIXTURE = path.join(AB_ROOT, 'fixture');
const CLONES = path.join(AB_ROOT, 'clones');

// Surfaces the `with` clone inherits from the package root.
const WITH_SURFACES: readonly string[] = ['.claude', '.augment', 'AGENTS.md', 'CLAUDE.md'];

function die(msg: string): never {
    process.stderr.write(`bench_ab_clone: ${msg}\n`);
    process.exit(1);
}

/**
 * Copy tree, dereferencing symlinks.
 *
 * The package installs the `.claude/` surface as a tree of symlinks into
 * `dist/agent-src/`. Cloning the surface as symlinks would carry pointers that
 * resolve against the package root, not the clone — meaning a Claude Code
 * session inside the clone could not actually read the rule bodies. Deref
 * at copy time produces standalone files inside the clone.
 */
function copytree_preserve(src: string, dst: string): void {
    if (_exists(dst)) {
        fs.rmSync(dst, { recursive: true, force: true });
    }
    // shutil.copytree(src, dst, symlinks=False) — dereference symlinks.
    _copytreeDeref(src, dst);
}

/** shutil.copytree with symlinks=False semantics (deref) + copy2 metadata. */
function _copytreeDeref(src: string, dst: string): void {
    fs.mkdirSync(dst, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const ent of entries) {
        const s = path.join(src, ent.name);
        const d = path.join(dst, ent.name);
        // Resolve symlink-to-dir vs symlink-to-file by stat (deref).
        const st = fs.statSync(s);
        if (st.isDirectory()) {
            _copytreeDeref(s, d);
        } else {
            fs.copyFileSync(s, d);
            _copyStat(s, d);
        }
    }
    _copyStat(src, dst);
}

/** shutil.copy2 preserves mtime/atime + mode; mirror the parts that matter. */
function _copyStat(src: string, dst: string): void {
    try {
        const st = fs.statSync(src);
        fs.chmodSync(dst, st.mode);
        fs.utimesSync(dst, st.atime, st.mtime);
    } catch {
        // Best-effort; metadata copy must never fail the clone.
    }
}

/** Copy the fixture into the target, then layer the variant-specific surface. */
export function materialise_clone(variant: string, target: string): void {
    fs.mkdirSync(target, { recursive: true });
    // Mirror the fixture — Python iterates FIXTURE.iterdir() (OS order).
    for (const entry of _iterdir(FIXTURE)) {
        const dest = path.join(target, path.basename(entry));
        if (_isDir(entry)) {
            copytree_preserve(entry, dest);
        } else {
            fs.copyFileSync(entry, dest);
            _copyStat(entry, dest);
        }
    }
    // Layer the agent-config surface onto the `with` variant
    if (variant === 'with') {
        for (const surface of WITH_SURFACES) {
            const src = path.join(REPO_ROOT, surface);
            if (!_exists(src)) {
                // Best-effort: a missing surface is reported but does not fail
                process.stderr.write(
                    `bench_ab_clone: surface '${surface}' missing in package root; ` +
                        'with-clone may not be representative\n',
                );
                continue;
            }
            const dest = path.join(target, surface);
            if (_isDir(src)) {
                copytree_preserve(src, dest);
            } else {
                fs.copyFileSync(src, dest);
                _copyStat(src, dest);
            }
        }
    }
}

/**
 * Stable hash of the fixture tree + the with-surface list.
 *
 * Used by Phase 2's cache key. Recomputing this here keeps the cache code
 * and the clone code reading the same surface definition.
 */
export function target_shape_hash(): string {
    const h = createHash('sha256');
    // Python: b"with-surfaces:" + json.dumps(WITH_SURFACES).encode() + b"\n".
    // json.dumps(tuple) → JSON array with default separators (", " / ": ").
    h.update(Buffer.from(`with-surfaces:${_jsonDumpsCompact(WITH_SURFACES)}\n`, 'utf-8'));
    for (const p of _rglobSorted(FIXTURE)) {
        if (!_isFile(p)) {
            continue;
        }
        const rel = path.relative(FIXTURE, p).split(path.sep).join('/');
        h.update(Buffer.from(`${rel}\n`, 'utf-8'));
        h.update(fs.readFileSync(p));
        h.update(Buffer.from('\n', 'utf-8'));
    }
    return h.digest('hex').slice(0, 16);
}

/** Drop a small manifest so other scripts can verify the clone shape. */
export function write_manifest(variant: string, target: string): void {
    const manifest = {
        variant,
        target_shape_hash: target_shape_hash(),
        with_surfaces: [...WITH_SURFACES],
        fixture_relpath: path.relative(REPO_ROOT, FIXTURE).split(path.sep).join('/'),
    };
    fs.writeFileSync(path.join(target, '.bench-ab-manifest.json'), `${_pyJsonDumps(manifest, 2)}\n`, 'utf-8');
}

export function clone(variant: string, opts: { refresh: boolean }): string {
    const target = path.join(CLONES, variant);
    if (_exists(target) && !opts.refresh) {
        process.stdout.write(
            `bench_ab_clone: ${variant} clone already present at ${target} (use --refresh to rebuild)\n`,
        );
        return target;
    }
    if (_exists(target)) {
        fs.rmSync(target, { recursive: true, force: true });
    }
    materialise_clone(variant, target);
    write_manifest(variant, target);
    process.stdout.write(`bench_ab_clone: built ${variant} clone at ${target}\n`);
    return target;
}

interface ParsedArgs {
    refresh: boolean;
    variant: 'with' | 'without' | 'both';
    print_shape_hash: boolean;
}

export function parse_args(argv: string[]): ParsedArgs {
    let refresh = false;
    let variant: 'with' | 'without' | 'both' = 'both';
    let print_shape_hash = false;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--refresh') {
            refresh = true;
            i += 1;
            continue;
        }
        if (arg === '--print-shape-hash') {
            print_shape_hash = true;
            i += 1;
            continue;
        }
        if (arg === '--variant') {
            const next = argv[i + 1];
            if (next === undefined) {
                _argparseError('argument --variant: expected one argument');
            }
            variant = _checkVariant(next as string);
            i += 2;
            continue;
        }
        if (arg.startsWith('--variant=')) {
            variant = _checkVariant(arg.slice('--variant='.length));
            i += 1;
            continue;
        }
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: bench_ab_clone [-h] [--refresh] [--variant {with,without,both}] [--print-shape-hash]\n',
            );
            process.exit(0);
        }
        _argparseError(`unrecognized arguments: ${arg}`);
    }
    return { refresh, variant, print_shape_hash };
}

function _checkVariant(v: string): 'with' | 'without' | 'both' {
    if (v === 'with' || v === 'without' || v === 'both') {
        return v;
    }
    _argparseError(
        `argument --variant: invalid choice: ${_pyRepr(v)} (choose from 'with', 'without', 'both')`,
    );
}

function _argparseError(msg: string): never {
    process.stderr.write(`bench_ab_clone: error: ${msg}\n`);
    process.exit(2);
}

export function main(argv?: string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (!_exists(FIXTURE)) {
        die(`fixture missing at ${FIXTURE}`);
    }
    if (args.print_shape_hash) {
        process.stdout.write(`${target_shape_hash()}\n`);
        return 0;
    }
    const variants: readonly string[] = args.variant === 'both' ? ['with', 'without'] : [args.variant];
    for (const v of variants) {
        clone(v, { refresh: args.refresh });
    }
    return 0;
}

// --- pathlib / Python parity helpers ----------------------------------------

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

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Path.iterdir() — NOT sorted (OS order). */
function _iterdir(dir: string): string[] {
    return fs.readdirSync(dir).map((name) => path.join(dir, name));
}

/** sorted(root.rglob("*")) — every descendant, sorted component-wise (pathlib). */
function _rglobSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            out.push(full);
            // rglob descends into real directories (rglob does not follow
            // symlinks to dirs by default on the relevant CPython versions).
            if (ent.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort(_pathPartsCompare);
    return out;
}

/** Compare two paths the way pathlib compares `Path` objects: component-wise. */
function _pathPartsCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x < y) return -1;
        if (x > y) return 1;
    }
    return pa.length - pb.length;
}

/** Mirror repr(x) for the argparse invalid-choice message. */
function _pyRepr(v: string): string {
    return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// --- JSON serializers — json.dumps parity (ensure_ascii=True) ---------------

/** json.dumps(value) with DEFAULT separators (", " / ": "), no indent. */
function _jsonDumpsCompact(value: unknown): string {
    return _escapeNonAscii(_dumpsCompact(value));
}

function _dumpsCompact(value: unknown): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStrAscii(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _dumpsCompact(v)).join(', ')}]`;
    }
    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const items = Object.keys(obj).map((k) => `${_jsonStrAscii(k)}: ${_dumpsCompact(obj[k])}`);
        return `{${items.join(', ')}}`;
    }
    return _jsonStrAscii(String(value));
}

/** json.dumps(value, indent=2). */
function _pyJsonDumps(value: unknown, indent: number): string {
    return _escapeNonAscii(_dumpsIndent(value, indent, 0));
}

function _dumpsIndent(value: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStrAscii(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpsIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map((k) => `${pad}${_jsonStrAscii(k)}: ${_dumpsIndent(obj[k], indent, depth + 1)}`);
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

function _jsonNum(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    out += ch;
                }
        }
    }
    return `${out}"`;
}

function _escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            for (let i = 0; i < ch.length; i += 1) {
                out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}

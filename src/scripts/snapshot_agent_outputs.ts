#!/usr/bin/env tsx
/**
 * Snapshot the agent-config build outputs for byte-identity verification.
 *
 * TypeScript twin of `src/scripts/snapshot_agent_outputs.py` (ADR-092,
 * Phase 8 / Wave 8b). Mirrors the CLI contract EXACTLY — the `--out` flag,
 * exit codes, the stdout/stderr split, byte-identical stdout AND the
 * byte-identical written snapshot JSON (`json.dumps(indent=2,
 * sort_keys=True, ensure_ascii=False) + "\n"`).
 *
 * Used by monorepo Phase 4 (physical layout move) to assert that the
 * pre-move and post-move `task sync` + `task build-discovery` outputs
 * match byte-for-byte except for `artefacts[].path` values.
 *
 * Captures sha256 of every file under:
 *   - dist/agent-src/
 *   - .augment/
 *   - dist/discovery/discovery-manifest.json (also stores parsed copy
 *     with paths stripped so the post-move diff is path-only)
 *
 * Also exported (the Python `_build_snapshot`, `_logical_path`, `_SKIP_DIRS`,
 * `_SKIP_NAMES`) for `verify_physical_move.ts`, mirroring the Python
 * `from snapshot_agent_outputs import (...)`.
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/snapshot_agent_outputs.ts → parents[2] of the .py file is repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_OUT = path.join(ROOT, 'dist', 'migration', 'pre-move-snapshot.json');

const TARGETS: readonly string[] = [
    path.join(ROOT, 'dist/agent-src'),
    path.join(ROOT, '.augment'),
];
const MANIFEST = path.join(ROOT, 'dist', 'discovery', 'discovery-manifest.json');

// Runtime artefacts that never participate in byte-identity verification.
// Eval last-run.json + pytest caches are gitignored; including them just
// adds noise when the worktree is clean.
export const _SKIP_NAMES: ReadonlySet<string> = new Set(['last-run.json']);
export const _SKIP_DIRS: ReadonlySet<string> = new Set([
    '.pytest_cache',
    '__pycache__',
    '.mypy_cache',
    '.ruff_cache',
    'node_modules',
    '.DS_Store',
]);

// JSON values mirroring the parsed manifest content.
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _sha256(p: string): string {
    const h = crypto.createHash('sha256');
    h.update(fs.readFileSync(p));
    return h.digest('hex');
}

/** POSIX relative path of `child` under `ROOT`. */
function _relToRootPosix(child: string): string {
    return path.relative(ROOT, child).split(path.sep).join('/');
}

/**
 * Mirror Python `Path(child).relative_to(ROOT)` — throws when `child` is not
 * under ROOT (the print site replicates the Python ValueError → exit 1; the
 * traceback prose itself is Python-version-dependent and not matched).
 */
function _pyRelativeTo(child: string): string {
    const rel = path.relative(ROOT, child);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
        throw new Error(`'${child}' is not in the subpath of '${ROOT}'`);
    }
    return rel.split(path.sep).join('/');
}

/** `sorted(root.rglob("*"))` — every descendant path, pathlib-sorted. */
function _rglobSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            out.push(full);
            if (e.isDirectory() && !e.isSymbolicLink()) {
                walk(full);
            }
        }
    };
    walk(root);
    // Mirror pathlib's sorted() — component-wise lexicographic comparison.
    out.sort(_pathCompare);
    return out;
}

/** Mirror Python `sorted(Path…)` — component-wise comparison on POSIX parts. */
function _pathCompare(a: string, b: string): number {
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

function _hash_tree(root: string): Record<string, string> {
    if (!_exists(root)) {
        return {};
    }
    const hashes: Record<string, string> = {};
    for (const p of _rglobSorted(root)) {
        let st: fs.Stats;
        try {
            st = fs.statSync(p);
        } catch {
            continue;
        }
        if (!st.isFile()) {
            continue;
        }
        const name = path.basename(p);
        if (_SKIP_NAMES.has(name)) {
            continue;
        }
        const parts = _relToRootPosix(p).split('/');
        if (parts.some((part) => _SKIP_DIRS.has(part))) {
            continue;
        }
        hashes[_relToRootPosix(p)] = _sha256(p);
    }
    return hashes;
}

/**
 * Strip any source-root prefix (legacy or packages/*) so the diff
 * compares the artefact's logical identity, not its physical location.
 * Non-source paths are returned unchanged.
 */
export function _logical_path(rel: string): string {
    const posix = rel.replace(/\\/g, '/');
    if (posix.startsWith('.agent-src.uncondensed/')) {
        return posix.slice('.agent-src.uncondensed/'.length);
    }
    if (posix.startsWith('packages/')) {
        const marker = '/.agent-src.uncondensed/';
        const idx = posix.indexOf(marker);
        if (idx !== -1) {
            return posix.slice(idx + marker.length);
        }
    }
    return posix;
}

function _asObj(v: Json | undefined): { [k: string]: Json } | null {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return v;
    }
    return null;
}

function _strField(v: Json | undefined): string {
    return typeof v === 'string' ? v : '';
}

/** Mirror Python tuple-comparison sort key `(a, b)` on two string keys. */
function _tupleCompare(a: [string, string], b: [string, string]): number {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    if (a[1] < b[1]) return -1;
    if (a[1] > b[1]) return 1;
    return 0;
}

function _manifest_path_stripped(manifestPath: string): { [k: string]: Json } | null {
    if (!_exists(manifestPath)) {
        return null;
    }
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { [k: string]: Json };
    // Strip `path` from every artefact so the diff is path-only, then
    // re-sort by (category, checksum) so the list order is content-stable.
    const artefactsRaw = data['artefacts'];
    const artefacts = Array.isArray(artefactsRaw) ? artefactsRaw : [];
    for (const a of artefacts) {
        const o = _asObj(a);
        if (o) {
            delete o['path'];
        }
    }
    artefacts.sort((a, b) => {
        const oa = _asObj(a);
        const ob = _asObj(b);
        return _tupleCompare(
            [oa ? _strField(oa['category']) : '', oa ? _strField(oa['checksum']) : ''],
            [ob ? _strField(ob['category']) : '', ob ? _strField(ob['checksum']) : ''],
        );
    });
    data['artefacts'] = artefacts;
    // Normalise unassigned / documented_unassigned to logical paths and
    // re-sort so the post-move diff is content-only.
    for (const key of ['unassigned', 'documented_unassigned']) {
        const entriesRaw = data[key];
        const entries = Array.isArray(entriesRaw) ? entriesRaw : [];
        for (const e of entries) {
            const o = _asObj(e);
            if (o && 'path' in o) {
                o['path'] = _logical_path(_strField(o['path']));
            }
        }
        entries.sort((a, b) => {
            const oa = _asObj(a);
            const ob = _asObj(b);
            return _tupleCompare(
                [oa ? _strField(oa['path']) : '', oa ? _strField(oa['category']) : ''],
                [ob ? _strField(ob['path']) : '', ob ? _strField(ob['category']) : ''],
            );
        });
        data[key] = entries;
    }
    // Drop volatile fields.
    delete data['generated_at'];
    delete data['checksum'];
    delete data['scanner_version'];
    return data;
}

export interface Snapshot {
    schema_version: string;
    trees: Record<string, Record<string, string>>;
    manifest_sha256: string | null;
    manifest_path_stripped: { [k: string]: Json } | null;
}

export function _build_snapshot(): Snapshot {
    const trees: Record<string, Record<string, string>> = {};
    for (const tgt of TARGETS) {
        const key = _relToRootPosix(tgt);
        trees[key] = _hash_tree(tgt);
    }
    return {
        schema_version: '1',
        trees,
        manifest_sha256: _exists(MANIFEST) ? _sha256(MANIFEST) : null,
        manifest_path_stripped: _manifest_path_stripped(MANIFEST),
    };
}

// --- json.dumps(indent=2, sort_keys=True, ensure_ascii=False) replica -------

function _jsonDumps(obj: unknown): string {
    const pad = '  ';
    const enc = (value: unknown, depth: number): string => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (keys.length === 0) return '{}';
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    };
    const encStr = (s: string): string => {
        // ensure_ascii=False — only escape the JSON-mandated control chars.
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else out += ch;
        }
        return out + '"';
    };
    return enc(obj, 0);
}

interface ParsedArgs {
    out: string;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { out: DEFAULT_OUT };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--out' || a.startsWith('--out=')) {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                out.out = a.slice(eq + 1);
            } else {
                const next = argv[i + 1];
                if (next === undefined) {
                    process.stderr.write(
                        'snapshot_agent_outputs: error: argument --out: expected one argument\n',
                    );
                    process.exit(2);
                }
                out.out = next;
                i += 1;
            }
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: snapshot_agent_outputs [-h] [--out OUT]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const snap = _build_snapshot();
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, _jsonDumps(snap) + '\n', 'utf-8');
    let nFiles = 0;
    for (const t of Object.values(snap.trees)) {
        nFiles += Object.keys(t).length;
    }
    process.stdout.write(`Snapshot: ${_pyRelativeTo(path.resolve(args.out))}\n`);
    process.stdout.write(`  files hashed     : ${nFiles}\n`);
    process.stdout.write(`  trees            : ${_pyListRepr(Object.keys(snap.trees))}\n`);
    const manifestSha = snap.manifest_sha256
        ? snap.manifest_sha256.slice(0, 16)
        : 'MISSING';
    process.stdout.write(`  manifest sha256  : ${manifestSha}\n`);
    return 0;
}

/** Mirror Python `str(list(...))` for a list of strings: `['a', 'b']`. */
function _pyListRepr(items: string[]): string {
    return '[' + items.map((s) => `'${s}'`).join(', ') + ']';
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

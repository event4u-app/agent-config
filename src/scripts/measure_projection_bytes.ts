#!/usr/bin/env node
/**
 * Measure per-tool projection bytes.
 *
 * TypeScript twin of `src/scripts/measure_projection_bytes.py` (ADR-094 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the CLI contract EXACTLY:
 * flags (`--json`, `--regenerate`), exit codes (0 / 2 when `task` is missing
 * for --regenerate), byte-identical stdout/stderr. No behaviour changes.
 *
 * Phase 2.1 deliverable for `agents/roadmaps/step-1-v2-feedback-followup.md`
 * (council finding U1 — the 0.45 % source/dist headline metric measures the
 * wrong boundary). Replaces the single headline figure with per-tool numbers
 * and an explicit projection-method label.
 *
 * Usage:
 *     measure_projection_bytes           # human-readable
 *     measure_projection_bytes --json    # machine-readable
 *     measure_projection_bytes --regenerate
 *         # runs `task clean-tools && task generate-tools` with *all* tools
 *         # enabled (via temporary agents/.agent-tools.yml override) before
 *         # measuring, then restores the original `agents/.agent-tools.yml`.
 *
 * Output is intentionally non-cached and read fresh from disk every run.
 *
 * NOTE: the .py references the legacy `.agent-src.uncondensed` surface in its
 * SURFACES table; this faithful twin replicates that literal byte-for-byte.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/measure_projection_bytes.ts → parents[2] is the repo root.
const PROJECT_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// (surface, kind, projection-method). Surface paths are relative to the repo
// root. `kind` is "dir" (walk recursively) or "file" (single file size).
const SURFACES: Array<[string, string, string]> = [
    ['.agent-src.uncondensed', 'dir', 'verbose source (input)'],
    ['dist/agent-src', 'dir', 'source projection (path-rewrite + .npmignore)'],
    ['.augment', 'dir', 'Augment Code — copies (rules) + symlinks (skills/cmds)'],
    ['.claude', 'dir', 'Claude Code — pure symlinks'],
    ['.cursor', 'dir', 'Cursor — per-rule `.mdc` materialized + symlinks'],
    ['.clinerules', 'dir', 'Cline — pure symlinks'],
    ['.windsurf', 'dir', 'Windsurf — per-rule wave-8 `.md` + symlinks'],
    ['.windsurfrules', 'file', 'Windsurf legacy — concatenated single file'],
    ['GEMINI.md', 'file', 'Gemini CLI — symlink → AGENTS.md'],
];

interface Row {
    surface: string;
    kind: string;
    method: string;
    files: number;
    symlinks: number;
    bytes_materialized: number;
    exists: boolean;
}

/** Return [file_count, symlink_count, materialized_bytes] for *path*. */
function _measureDir(p: string): [number, number, number] {
    if (!_exists(p)) {
        return [0, 0, 0];
    }
    let files = 0;
    let links = 0;
    let size = 0;
    for (const entry of _rglob(p)) {
        const lst = _lstat(entry);
        if (lst && lst.isSymbolicLink()) {
            links += 1;
        } else if (lst && lst.isFile()) {
            files += 1;
            try {
                size += fs.statSync(entry).size;
            } catch {
                // OSError — skip.
            }
        }
    }
    return [files, links, size];
}

function _measureFile(p: string): [number, number, number] {
    const lst = _lstat(p);
    if (lst && lst.isSymbolicLink()) {
        return [0, 1, 0];
    }
    if (lst && lst.isFile()) {
        return [1, 0, fs.statSync(p).size];
    }
    return [0, 0, 0];
}

function collect(): Row[] {
    const rows: Row[] = [];
    for (const [surface, kind, method] of SURFACES) {
        const p = path.join(PROJECT_ROOT, surface);
        const [files, links, size] = kind === 'dir' ? _measureDir(p) : _measureFile(p);
        rows.push({
            surface,
            kind,
            method,
            files,
            symlinks: links,
            bytes_materialized: size,
            exists: files + links > 0,
        });
    }
    return rows;
}

function _temporarilyEnableAllTools(): string | null {
    const toolsFile = path.join(PROJECT_ROOT, 'agents', '.agent-tools.yml');
    if (!_isFile(toolsFile)) {
        return null;
    }
    const original = fs.readFileSync(toolsFile, 'utf-8');
    const data = (parseYaml(original, { version: '1.1' }) as Record<string, unknown>) || {};
    data['tools'] = [
        'claude-code',
        'claude-desktop',
        'augment',
        'copilot',
        'cursor',
        'windsurf',
        'cline',
        'gemini',
    ];
    fs.writeFileSync(
        toolsFile,
        '# TEMPORARY override by measure_projection_bytes.py — restored on exit\n' +
            stringifyYaml(data, { sortMapEntries: false }),
    );
    return original;
}

function regenerateAll(): void {
    const backup = _temporarilyEnableAllTools();
    try {
        _runChecked(['task', 'clean-tools']);
        _runChecked(['task', 'generate-tools']);
    } finally {
        if (backup !== null) {
            fs.writeFileSync(path.join(PROJECT_ROOT, 'agents', '.agent-tools.yml'), backup);
        }
    }
}

function renderTable(rows: Row[]): string {
    const width = Math.max(...rows.map((r) => _pyLen(r.surface)));
    const lines: string[] = [
        `${_ljust('Surface', width)}  Files  Symlinks  Bytes        Method`,
    ];
    lines.push('-'.repeat(width + 50));
    for (const r of rows) {
        lines.push(
            `${_ljust(r.surface, width)}  ${_rjust(String(r.files), 5)}  ${_rjust(String(r.symlinks), 8)}  ` +
                `${_rjust(_commaGroup(r.bytes_materialized), 10)}  ${r.method}`,
        );
    }
    return lines.join('\n');
}

interface Args {
    json: boolean;
    regenerate: boolean;
}

function parse_args(argv: string[]): Args {
    const args: Args = { json: false, regenerate: false };
    for (const a of argv) {
        if (a === '--json') {
            args.json = true;
        } else if (a === '--regenerate') {
            args.regenerate = true;
        } else {
            process.stderr.write(`measure_projection_bytes: error: unrecognized arguments: ${a}\n`);
            process.exitCode = 2;
            throw new ArgExit();
        }
    }
    return args;
}

class ArgExit extends Error {}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    const args = parse_args(rawArgv);
    if (args.regenerate) {
        if (!_which('task')) {
            process.stderr.write('❌  `task` CLI required for --regenerate\n');
            return 2;
        }
        regenerateAll();
    }
    const rows = collect();
    if (args.json) {
        process.stdout.write(_jsonDumpsIndent2({ surfaces: rows.map(_rowToJson) }) + '\n');
    } else {
        process.stdout.write(renderTable(rows) + '\n');
    }
    return 0;
}

// --- JSON shaping ------------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function _rowToJson(r: Row): Json {
    // Preserve the dict key order from the .py literal.
    return {
        surface: r.surface,
        kind: r.kind,
        method: r.method,
        files: r.files,
        symlinks: r.symlinks,
        bytes_materialized: r.bytes_materialized,
        exists: r.exists,
    };
}

function _jsonDumpsIndent2(obj: Json): string {
    return _jsonDumps(obj, 2);
}

/** json.dumps(obj, indent=2) — sort_keys False, ensure_ascii True. */
function _jsonDumps(obj: Json, indent: number): string {
    const pad = ' '.repeat(indent);

    function enc(value: Json, depth: number): string {
        if (value === null) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as { [k: string]: Json };
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k]!, depth + 1));
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }

    function encStr(s: string): string {
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
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }

    return enc(obj, 0);
}

// --- Python helpers ----------------------------------------------------------

/**
 * Recursive walk of a directory matching Path.rglob("*") — yields every
 * descendant (files, dirs, symlinks) without following symlinked dirs into
 * their targets (rglob does not traverse symlink targets).
 */
function _rglob(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        // Sort for deterministic traversal (order does not affect the sums).
        entries.sort((a, b) => _pyStrCmp(a.name, b.name));
        for (const e of entries) {
            const full = path.join(dir, e.name);
            out.push(full);
            // Recurse into real directories only (not symlinked dirs — Path.rglob
            // does not follow symlinks).
            if (e.isDirectory() && !e.isSymbolicLink()) {
                walk(full);
            }
        }
    };
    walk(root);
    return out;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p); // follows symlinks; matches Path.exists()
        return true;
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

function _lstat(p: string): fs.Stats | null {
    try {
        return fs.lstatSync(p);
    } catch {
        return null;
    }
}

/** Python f"{n:,}" — thousands grouped with commas. */
function _commaGroup(n: number): string {
    const neg = n < 0;
    const s = Math.abs(n).toString();
    let out = '';
    for (let i = 0; i < s.length; i++) {
        if (i > 0 && (s.length - i) % 3 === 0) out += ',';
        out += s[i];
    }
    return neg ? `-${out}` : out;
}

function _which(cmd: string): string | null {
    if (cmd.includes(path.sep) || cmd.includes('/')) {
        return _isExecutable(cmd) ? cmd : null;
    }
    const pathEnv = process.env['PATH'] ?? '';
    const dirs = pathEnv.split(path.delimiter);
    const exts = process.platform === 'win32' ? (process.env['PATHEXT'] ?? '').split(';') : [''];
    for (const dir of dirs) {
        if (!dir) continue;
        for (const ext of exts) {
            const candidate = path.join(dir, cmd + ext);
            if (_isExecutable(candidate)) return candidate;
        }
    }
    return null;
}

function _isExecutable(p: string): boolean {
    try {
        const st = fs.statSync(p);
        if (!st.isFile()) return false;
        if (process.platform === 'win32') return true;
        return (st.mode & 0o111) !== 0;
    } catch {
        return false;
    }
}

/** subprocess.run(cmd, check=True, capture_output=True) — throw on non-zero. */
function _runChecked(cmd: string[]): void {
    const res = spawnSync(cmd[0]!, cmd.slice(1), { encoding: 'utf-8' });
    if (res.error) {
        throw res.error;
    }
    if (res.status !== 0) {
        throw new Error(`Command '${cmd.join(' ')}' returned non-zero exit status ${res.status}.`);
    }
}

function _pyLen(s: string): number {
    return Array.from(s).length;
}

function _ljust(s: string, width: number): string {
    const len = _pyLen(s);
    return len >= width ? s : s + ' '.repeat(width - len);
}

function _rjust(s: string, width: number): string {
    const len = _pyLen(s);
    return len >= width ? s : ' '.repeat(width - len) + s;
}

function _pyStrCmp(a: string, b: string): number {
    const ca = Array.from(a);
    const cb = Array.from(b);
    const n = Math.min(ca.length, cb.length);
    for (let i = 0; i < n; i++) {
        const x = ca[i]!.codePointAt(0)!;
        const y = cb[i]!.codePointAt(0)!;
        if (x !== y) return x - y;
    }
    return ca.length - cb.length;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    try {
        process.exitCode = main();
    } catch (e) {
        if (e instanceof ArgExit) {
            process.exitCode = process.exitCode ?? 2;
        } else {
            throw e;
        }
    }
}

/**
 * `agent-config uninstall` — remove bridge markers (Phase 4.1) (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_uninstall.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output, same filesystem effects. No behaviour changes — latent quirks are
 * replicated and flagged inline, not fixed.
 *
 * Removes the per-tool bridge marker files this package created (the files
 * listed in `PROJECT_BRIDGE_MARKERS` for project scope, the lockfile entries
 * for global scope). User-deployed content in `~/.claude/skills/` etc. is left
 * in place — uninstall removes the *link* between the project and
 * agent-config, not the content the user may still want. Use `--purge` to also
 * delete the deployed content directories (opt-in, destructive).
 *
 * Idempotent: removing an already-absent marker is a no-op success. Refuses to
 * operate on a non-empty drift unless `--force` is passed.
 *
 * Schema v2 (P2.2): when the manifest carries per-tool `files[]` and
 * `merged_keys[]` inventories, uninstall walks them instead of the hardcoded
 * `PROJECT_BRIDGE_MARKERS` map. JSON merges are subtracted key-by-key so
 * neighbour packages' contributions to the same shared file (e.g.
 * `.cursor/hooks.json`) survive. Bridge files that are JSON documents are
 * deleted only when subtraction left them empty; if a sibling tool still owns
 * keys there, the file stays.
 *
 * Two-phase commit: the tool entry is rewritten with `status: "uninstalling"`
 * before any deletion, deletions / subtractions run, then the entry is removed
 * on success. A crash between the two phases leaves the manifest in a state
 * `cmd_prune` recognises (the orphaned `files[]` of an `uninstalling` tool
 * resurface for cleanup). Manifests without `files[]` fall back to the legacy
 * v1 path unchanged.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `process.exitCode` is set; `process.exit()` is never called. argparse
 *   usage errors throw `ArgparseExit(2)`; `-h`/`--help` throws
 *   `ArgparseExit(0)`. Python's `raise SystemExit(main())` propagates the int
 *   return → `process.exitCode`.
 * - `from scripts.install import …` and `from scripts._lib import …` resolve to
 *   the `.ts` twins (never a `.py`). The Python dual-path import collapses to a
 *   single static import here.
 * - JSON byte-parity: `json.dumps(new_doc, indent=2)` (Python default
 *   `ensure_ascii=True`, `sort_keys=False`) → `_jsonDumpsIndentAscii(doc, 2)`
 *   + `"\n"`, written through `fs_atomic.write_atomic`. Dict insertion order is
 *   preserved (JS object key order matches Python dict order for our string
 *   keys).
 * - `collections.defaultdict(list)` → a `Map<string, T[]>` populated in
 *   first-seen key order; iteration order matches Python's insertion order.
 * - `shutil.rmtree` → `fs.rmSync(..., {recursive:true})`; `Path.unlink` →
 *   `fs.unlinkSync`. `OSError` catches → JS `catch` with the error's message
 *   interpolated, matching Python's `({exc})` formatting (str(OSError) ==
 *   the strerror-shaped message).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as fs_atomic from '../_lib/fs_atomic.js';
import * as installed_lock from '../_lib/installed_lock.js';
import * as installed_tools from '../_lib/installed_tools.js';
import { resolve_project_root } from '../_lib/agent_settings.js';
import { subtract_pointers } from '../_lib/json_pointers.js';
import { PROJECT_BRIDGE_MARKERS, USER_SCOPE_PATHS } from '../install.js';

type AnyDict = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Python-runtime parity helpers
// ---------------------------------------------------------------------------

/** argparse usage-error / help sentinel: exit 2 for errors, 0 for --help. */
class ArgparseExit extends Error {
    code: number;
    constructor(code: number) {
        super(`ArgparseExit(${code})`);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

interface OutSink {
    write(text: string): void;
}
const _stdout: OutSink = { write: (t) => process.stdout.write(t) };
const _stderr: OutSink = { write: (t) => process.stderr.write(t) };
function _print(out: OutSink, line = ''): void {
    out.write(line + '\n');
}

/** `os.path.expanduser` — expand a leading `~`. */
function expanduser(p: string): string {
    if (p === '~' || p.startsWith('~/')) {
        const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
        return home + p.slice(1);
    }
    return p;
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
function _exists(p: string): boolean {
    try {
        fs.lstatSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isPlainObject(value: unknown): value is AnyDict {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// --- JSON byte-parity (ensure_ascii=True, sort_keys=False, insertion order) ---

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        const ch = s[i];
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
                if (code < 0x20 || code > 0x7e) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    out += ch;
                }
        }
    }
    return out + '"';
}

function _jsonScalarAscii(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            if (Number.isNaN(value)) return 'NaN';
            return value > 0 ? 'Infinity' : '-Infinity';
        }
        return String(value);
    }
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpIndentAscii(value: unknown, indent: number, depth: number): string {
    const scalar = _jsonScalarAscii(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpIndentAscii(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as AnyDict;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${_jsonStrAscii(k)}: ${_dumpIndentAscii(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

/** `json.dumps(data, indent=2)` — Python default (ensure_ascii, sort_keys=False). */
function _jsonDumpsIndentAscii(value: unknown, indent: number): string {
    return _dumpIndentAscii(value, indent, 0);
}

// ---------------------------------------------------------------------------

/** Resolve the project root using the shared Phase-3 helper. */
function _resolve_project_root(arg: string | null): string {
    const [root] = resolve_project_root(arg);
    return root;
}

function _filter_tools(all_tools: Iterable<string>, requested: string | null): string[] {
    const pool = [...all_tools];
    if (!requested || requested.trim() === 'all') {
        return pool;
    }
    const wanted = new Set(
        requested
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t),
    );
    return pool.filter((t) => wanted.has(t));
}

function _remove_project_marker(
    project_root: string,
    tool: string,
    opts: { dry_run: boolean },
): [string, boolean] {
    const rel = PROJECT_BRIDGE_MARKERS[tool];
    if (!rel) {
        return [`${tool}: no project marker registered (skipped)`, false];
    }
    const target = path.join(project_root, rel);
    if (!_exists(target)) {
        return [`${tool}: ${rel} already absent`, false];
    }
    if (opts.dry_run) {
        return [`${tool}: would remove ${rel}`, true];
    }
    try {
        fs.unlinkSync(target);
        return [`${tool}: removed ${rel}`, true];
    } catch (exc) {
        return [`${tool}: ❌ failed to remove ${rel} (${_osErr(exc)})`, false];
    }
}

function _remove_global_content(
    tool: string,
    opts: { dry_run: boolean; purge: boolean },
): [string, boolean] {
    const anchor = USER_SCOPE_PATHS[tool];
    if (!anchor) {
        return [`${tool}: no global anchor registered (skipped)`, false];
    }
    const target = expanduser(anchor);
    if (!_exists(target)) {
        return [`${tool}: ${anchor} already absent`, false];
    }
    if (!opts.purge) {
        return [`${tool}: ${anchor} preserved (pass --purge to delete)`, false];
    }
    if (opts.dry_run) {
        return [`${tool}: would purge ${anchor}`, true];
    }
    try {
        if (_isDir(target)) {
            fs.rmSync(target, { recursive: true, force: false });
        } else {
            fs.unlinkSync(target);
        }
        return [`${tool}: purged ${anchor}`, true];
    } catch (exc) {
        return [`${tool}: ❌ failed to purge ${anchor} (${_osErr(exc)})`, false];
    }
}

/** Render an OSError-shaped message: Python `str(OSError)` is the strerror. */
function _osErr(exc: unknown): string {
    const e = exc as NodeJS.ErrnoException;
    // Node's Error.message already carries the strerror-shaped text used by
    // Python's `{exc}` interpolation for the common ENOENT/EISDIR/EACCES paths.
    return e && e.message ? e.message : String(exc);
}

// ---------------------------------------------------------------------------
// Schema v2 helpers (P2.2 — manifest-driven uninstall)
// ---------------------------------------------------------------------------

/**
 * Whether `entry` carries v2 per-tool inventories.
 *
 * A tool entry counts as v2 when at least one of `files[]` or `merged_keys[]`
 * is non-empty. Tools written by older installers have neither and fall
 * through to the legacy `PROJECT_BRIDGE_MARKERS` path.
 */
function _is_v2_entry(entry: AnyDict): boolean {
    return Boolean(_listOf(entry['files']).length) || Boolean(_listOf(entry['merged_keys']).length);
}

function _listOf(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

/**
 * Resolve a manifest-recorded path against the project root.
 *
 * `files[].path` and `merged_keys[].file` are written as absolute paths by the
 * installer but a relative path is accepted for portability and resolved
 * against `project_root`. Returns the absolute path.
 */
function _resolve_recorded_path(project_root: string, recorded: string): string {
    if (path.isAbsolute(recorded)) {
        return recorded;
    }
    return path.resolve(project_root, recorded);
}

/**
 * Persist `status` on the named tool entry and return the new list.
 *
 * Two-phase commit anchor (P2.2): writing `status: uninstalling` before any
 * deletion gives `cmd_prune` a stable signal to clean up after a crash
 * mid-uninstall.
 */
function _set_tool_status(
    manifest_path: string,
    version: string,
    tools: AnyDict[],
    name: string,
    status: string,
    opts: { deploy_roots: string[] | null },
): AnyDict[] {
    const new_tools: AnyDict[] = [];
    for (let entry of tools) {
        if (entry['name'] === name) {
            entry = { ...entry, status };
        }
        new_tools.push(entry);
    }
    installed_tools.write_manifest(manifest_path, version, new_tools, {
        deploy_roots: opts.deploy_roots,
    });
    return new_tools;
}

/**
 * Subtract this tool's `merged_keys` from every referenced JSON file.
 *
 * Returns `[warnings, emptied_files, touched_files]`.
 */
function _subtract_merged_keys(
    entry: AnyDict,
    project_root: string,
    opts: { dry_run: boolean },
): [string[], Set<string>, Set<string>] {
    const warnings: string[] = [];
    const emptied = new Set<string>();
    const touched = new Set<string>();
    const merged_keys = _listOf(entry['merged_keys']) as AnyDict[];
    if (!merged_keys.length) {
        return [warnings, emptied, touched];
    }
    // defaultdict(list) with first-seen key order.
    const by_file = new Map<string, AnyDict[]>();
    for (const record of merged_keys) {
        const file = String(record['file']);
        if (!by_file.has(file)) {
            by_file.set(file, []);
        }
        by_file.get(file)!.push(record);
    }
    for (const [file_label, records] of by_file) {
        const target = _resolve_recorded_path(project_root, file_label);
        touched.add(target);
        if (!_exists(target)) {
            warnings.push(`${file_label}: absent — skipping ${records.length} pointer(s)`);
            continue;
        }
        let doc: unknown;
        try {
            doc = JSON.parse(fs.readFileSync(target, { encoding: 'utf-8' }));
        } catch (exc) {
            warnings.push(`${file_label}: unparseable JSON (${_jsonExc(exc, target)}); skipped`);
            continue;
        }
        if (!_isPlainObject(doc)) {
            warnings.push(`${file_label}: not a JSON object; skipped`);
            continue;
        }
        const [new_doc, sub_warnings] = subtract_pointers(
            doc,
            records.map((r) => ({
                json_pointer: String(r['json_pointer']),
                value_hash: (r['value_hash'] as string | null | undefined) ?? null,
            })),
        );
        for (const w of sub_warnings) {
            warnings.push(`${file_label}${w.pointer}: ${w.reason}`);
        }
        if (opts.dry_run) {
            if (Object.keys(new_doc).length === 0) {
                emptied.add(target);
            }
            continue;
        }
        if (Object.keys(new_doc).length > 0) {
            fs_atomic.write_atomic(target, _jsonDumpsIndentAscii(new_doc, 2) + '\n');
        } else {
            emptied.add(target);
        }
    }
    return [warnings, emptied, touched];
}

/** Render the message Python's `({exc})` produces for OSError / JSONDecodeError. */
function _jsonExc(exc: unknown, _target: string): string {
    return _osErr(exc);
}

/**
 * Delete `files[]` entries by kind; honour --purge for deployed.
 *
 * `touched_files` is the set of JSON paths this tool recorded `merged_keys`
 * against. A JSON bridge is preserved only when it was touched (shared with
 * neighbour tools) AND subtraction left foreign keys behind. Untouched JSON
 * bridges are owned solely by this tool and removed with the rest.
 */
function _delete_tool_files(
    entry: AnyDict,
    project_root: string,
    opts: {
        dry_run: boolean;
        purge: boolean;
        emptied_files: Set<string>;
        touched_files: Set<string>;
    },
): [string[], string[]] {
    const deleted: string[] = [];
    const skipped: string[] = [];
    for (const record of _listOf(entry['files']) as AnyDict[]) {
        const target = _resolve_recorded_path(project_root, String(record['path']));
        const kind = record['kind'];
        const label = target;
        if (kind === 'bridge') {
            const is_shared_json =
                _exists(label) &&
                path.extname(label) === '.json' &&
                opts.touched_files.has(label) &&
                !opts.emptied_files.has(label);
            if (is_shared_json) {
                skipped.push(`bridge ${label}: foreign keys preserved`);
                continue;
            }
            if (!_exists(label)) {
                skipped.push(`bridge ${label}: already absent`);
                continue;
            }
            if (opts.dry_run) {
                deleted.push(`would remove bridge ${label}`);
                continue;
            }
            try {
                fs.unlinkSync(label);
                deleted.push(`removed bridge ${label}`);
            } catch (exc) {
                skipped.push(`bridge ${label}: ❌ ${_osErr(exc)}`);
            }
        } else if (kind === 'marker') {
            if (!_exists(label)) {
                skipped.push(`marker ${label}: already absent`);
                continue;
            }
            if (opts.dry_run) {
                deleted.push(`would remove marker ${label}`);
                continue;
            }
            try {
                fs.unlinkSync(label);
                deleted.push(`removed marker ${label}`);
            } catch (exc) {
                skipped.push(`marker ${label}: ❌ ${_osErr(exc)}`);
            }
        } else if (kind === 'deployed') {
            if (!opts.purge) {
                skipped.push(`deployed ${label}: preserved (pass --purge)`);
                continue;
            }
            if (!_exists(label)) {
                skipped.push(`deployed ${label}: already absent`);
                continue;
            }
            if (opts.dry_run) {
                deleted.push(`would purge deployed ${label}`);
                continue;
            }
            try {
                if (_isDir(label)) {
                    fs.rmSync(label, { recursive: true, force: false });
                } else {
                    fs.unlinkSync(label);
                }
                deleted.push(`purged deployed ${label}`);
            } catch (exc) {
                skipped.push(`deployed ${label}: ❌ ${_osErr(exc)}`);
            }
        } else {
            // Python: `f"{label}: unknown kind={kind!r}"` — repr() of the value.
            skipped.push(`${label}: unknown kind=${_pyRepr(kind)}`);
        }
    }
    return [deleted, skipped];
}

/** Minimal `repr()` for the values `kind` can hold (str | None). */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    return String(value);
}

interface Options {
    global_mode: boolean;
    tools: string | null;
    project: string | null;
    dry_run: boolean;
    purge: boolean;
    force: boolean;
}

function _parse(argv: string[]): Options {
    const prog = 'agent-config uninstall';
    // argparse wraps usage to terminal width (80 cols when piped). The exact
    // 3-line break points are reproduced verbatim for byte-parity on the
    // error path (the only path that re-emits usage to stderr).
    const usage =
        'usage: agent-config uninstall [-h] [--global] [--tools TOOLS]\n' +
        '                              [--project PROJECT] [--dry-run] [--purge]\n' +
        '                              [--force]\n';

    const emitError = (msg: string): never => {
        _stderr.write(usage);
        _stderr.write(`${prog}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };

    const opts: Options = {
        global_mode: false,
        tools: null,
        project: null,
        dry_run: false,
        purge: false,
        force: false,
    };

    const takeValue = (tok: string, i: number): [string, number] => {
        const eq = tok.indexOf('=');
        if (eq >= 0) {
            return [tok.slice(eq + 1), i + 1];
        }
        const val = argv[i + 1];
        if (val === undefined) {
            emitError(`argument ${tok}: expected one argument`);
        }
        return [val as string, i + 2];
    };

    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        const flag = tok.includes('=') ? tok.slice(0, tok.indexOf('=')) : tok;
        if (flag === '-h' || flag === '--help') {
            _stdout.write(usage);
            throw new ArgparseExit(0);
        } else if (flag === '--global') {
            opts.global_mode = true;
            i += 1;
        } else if (flag === '--tools') {
            const [v, ni] = takeValue(tok, i);
            opts.tools = v;
            i = ni;
        } else if (flag === '--project') {
            const [v, ni] = takeValue(tok, i);
            opts.project = v;
            i = ni;
        } else if (flag === '--dry-run') {
            opts.dry_run = true;
            i += 1;
        } else if (flag === '--purge') {
            opts.purge = true;
            i += 1;
        } else if (flag === '--force') {
            opts.force = true;
            i += 1;
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }
    return opts;
}

function _uninstall_project(opts: Options): number {
    const project_root = _resolve_project_root(opts.project);
    const manifest_path = installed_tools.manifest_path(project_root);
    const manifest = installed_tools.read_manifest(manifest_path);
    if (manifest === null && !opts.force) {
        _print(_stderr, `❌  no project lockfile at ${manifest_path}`);
        _print(_stderr, '    pass --force to uninstall by --tools=<list> without manifest');
        return 1;
    }
    let pool: string[] = (
        manifest ? (_listOf(manifest['tools']) as AnyDict[]) : []
    ).map((e) => String(e['name'] ?? ''));
    if (!pool.length && opts.tools) {
        pool = opts.tools
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t);
    }
    const tools = _filter_tools(pool, opts.tools);
    if (!tools.length) {
        _print(_stdout, 'ℹ️   no tools to uninstall');
        return 0;
    }
    _print(
        _stdout,
        `${opts.dry_run ? '[dry-run] ' : ''}uninstalling ${tools.length} tool(s) from ${project_root}:`,
    );

    // --force path without a manifest falls straight to the legacy
    // bridge-marker map; v2 inventories are not available off-manifest.
    if (manifest === null) {
        for (const tool of tools) {
            const [line] = _remove_project_marker(project_root, tool, { dry_run: opts.dry_run });
            _print(_stdout, `  · ${line}`);
        }
        return 0;
    }

    const version = String(manifest['agent_config_version'] ?? '');
    const deploy_roots = (manifest['deploy_roots'] as string[] | undefined) || null;
    let tool_entries = [...(_listOf(manifest['tools']) as AnyDict[])];
    const removed_names: string[] = [];

    for (const tool of tools) {
        let entry = tool_entries.find((e) => e['name'] === tool) ?? null;
        if (entry === null) {
            // Tool requested but not in the manifest — legacy marker fallback.
            const [line, removed] = _remove_project_marker(project_root, tool, {
                dry_run: opts.dry_run,
            });
            _print(_stdout, `  · ${line}`);
            if (removed && !opts.dry_run) {
                removed_names.push(tool);
            }
            continue;
        }

        if (!_is_v2_entry(entry)) {
            // v1 entry — keep the legacy single-marker behaviour.
            const [line, removed] = _remove_project_marker(project_root, tool, {
                dry_run: opts.dry_run,
            });
            _print(_stdout, `  · ${line}`);
            if (removed && !opts.dry_run) {
                removed_names.push(tool);
            }
            continue;
        }

        const files_n = _listOf(entry['files']).length;
        const merges_n = _listOf(entry['merged_keys']).length;
        _print(
            _stdout,
            `  · ${tool}: v2 uninstall ` + `(${files_n} file(s), ${merges_n} merge pointer(s))`,
        );

        // Phase 1: flag the entry as uninstalling so a crash here is
        // recoverable by `cmd_prune` (P2.1).
        if (!opts.dry_run) {
            tool_entries = _set_tool_status(
                manifest_path,
                version,
                tool_entries,
                tool,
                'uninstalling',
                { deploy_roots },
            );
            entry = tool_entries.find((e) => e['name'] === tool) ?? entry;
        }

        // Phase 2: subtract this tool's JSON merge contributions.
        const [warnings, emptied, touched] = _subtract_merged_keys(entry, project_root, {
            dry_run: opts.dry_run,
        });
        for (const w of warnings) {
            _print(_stdout, `      ⚠️  ${w}`);
        }

        // Phase 3: delete files[] entries — bridge files are kept when
        // subtraction left foreign keys behind.
        const [deleted, skipped] = _delete_tool_files(entry, project_root, {
            dry_run: opts.dry_run,
            purge: opts.purge,
            emptied_files: emptied,
            touched_files: touched,
        });
        for (const d of deleted) {
            _print(_stdout, `      ✓  ${d}`);
        }
        for (const s of skipped) {
            _print(_stdout, `      ↷  ${s}`);
        }

        if (!opts.dry_run) {
            removed_names.push(tool);
        }
    }

    // Phase 4: drop uninstalled entries; persist the manifest atomically.
    if (removed_names.length && !opts.dry_run) {
        const remaining = tool_entries.filter((e) => !removed_names.includes(String(e['name'])));
        installed_tools.write_manifest(manifest_path, version, remaining, { deploy_roots });
        _print(_stdout, `✅  manifest updated (${removed_names.length} entries removed)`);
    }
    return 0;
}

function _uninstall_global(opts: Options): number {
    const lock_path = installed_lock.lockfile_path();
    const write_path = installed_lock.lockfile_write_path();
    const lock = installed_lock.read_lockfile(lock_path);
    if (lock === null && !opts.force) {
        _print(_stderr, `❌  no global lockfile at ${lock_path}`);
        return 1;
    }
    let pool: string[] = lock ? [...(lock.tools ?? [])] : [];
    if (!pool.length && opts.tools) {
        pool = opts.tools
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t);
    }
    const tools = _filter_tools(pool, opts.tools);
    if (!tools.length) {
        _print(_stdout, 'ℹ️   no tools to uninstall');
        return 0;
    }
    _print(
        _stdout,
        `${opts.dry_run ? '[dry-run] ' : ''}uninstalling ${tools.length} tool(s) from global scope:`,
    );
    const removed_names: string[] = [];
    for (const tool of tools) {
        const [line, removed] = _remove_global_content(tool, {
            dry_run: opts.dry_run,
            purge: opts.purge,
        });
        _print(_stdout, `  · ${line}`);
        if (removed && !opts.dry_run) {
            removed_names.push(tool);
        }
    }
    if (lock !== null && !opts.dry_run) {
        const remaining = (lock.tools ?? []).filter((t) => !tools.includes(t));
        const version = String((lock as unknown as AnyDict)['agent_config_version'] ?? '');
        if (remaining.length) {
            installed_lock.write_lockfile(version, remaining, { path: write_path });
            // Drop the legacy file if it differs from the canonical write
            // target so the namespace migration completes on uninstall.
            if (lock_path !== write_path) {
                try {
                    fs.unlinkSync(lock_path);
                } catch {
                    // pass
                }
            }
            _print(
                _stdout,
                `✅  lockfile updated (${tools.length} entries removed, ${remaining.length} kept)`,
            );
        } else {
            // Python iterates a set `{lock_path, write_path}` (order
            // irrelevant — both unlinks are best-effort, no output depends
            // on order); a deduped list reproduces it.
            const targets = lock_path === write_path ? [write_path] : [lock_path, write_path];
            for (const target of targets) {
                try {
                    fs.unlinkSync(target);
                } catch {
                    // pass
                }
            }
            _print(_stdout, `✅  lockfile deleted (${write_path})`);
        }
    }
    return 0;
}

export function main(argv: string[] | null = null): number {
    const opts = _parse(argv !== null ? [...argv] : process.argv.slice(2));
    if (opts.global_mode) {
        return _uninstall_global(opts);
    }
    return _uninstall_project(opts);
}

// CLI entry guard — set process.exitCode; never call process.exit().
const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (exc) {
        if (exc instanceof ArgparseExit) {
            process.exitCode = exc.code;
        } else {
            throw exc;
        }
    }
}

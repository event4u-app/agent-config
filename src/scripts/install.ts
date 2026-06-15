#!/usr/bin/env tsx
/**
 * Agent Config — Project Bridge Installer (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/install.py` (ADR-200, py2ts migration).
 * The CLI contract mirrors the Python original EXACTLY — same flags, same
 * exit codes, same stdout/stderr split, byte-identical emitted output,
 * same filesystem effects, same subprocess argv/cwd/env. No behaviour
 * changes — latent quirks are replicated and flagged inline, not fixed.
 *
 * Generates project bridge files (.agent-settings.yml, .vscode/settings.json,
 * etc.) so that supported AI tools can discover agent-config from the project.
 *
 * On first run in a project that still has the legacy flat-file
 * `.agent-settings` (key=value), the installer migrates it to the new YAML
 * format in `.agent-settings.yml`, leaves a one-shot backup as
 * `.agent-settings.backup.key-value`, and deletes the legacy file. This runs
 * exactly once; subsequent runs are idempotent.
 *
 * Usage:
 *   tsx src/scripts/install.ts                     # defaults: rule_loading_tier=balanced
 *   tsx src/scripts/install.ts --profile=minimal   # set rule_loading_tier=minimal (kernel only)
 *   tsx src/scripts/install.ts --force             # accepted (no-op): installs always overwrite
 *   tsx src/scripts/install.ts --skip-bridges      # only create .agent-settings.yml
 *   tsx src/scripts/install.ts --project <dir>     # override project root
 *
 * Idempotent — safe to run multiple times. A run always refreshes every
 * deployed file with the current package content; user configuration
 * (.agent-settings.yml) is merged by the settings layer, never clobbered.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `fail()` mirrors Python's `sys.exit(1)`: it prints the doctor hint then
 *   throws a `SystemExitError(1)` sentinel caught at the CLI entry guard,
 *   which sets `process.exitCode`. We never call `process.exit()` (per the
 *   migration contract) — every termination flows through a settable
 *   `process.exitCode`.
 * - argparse errors (`parser.error`, unknown flags, bad `--scope` choice)
 *   throw `ArgparseExit(2)` — argparse's exit code for usage errors.
 * - `-h`/`--help` throws `ArgparseExit(0)` after printing usage.
 * - JSON byte-parity: `json.dumps(..., indent=4, ensure_ascii=False)` →
 *   `_jsonDumpsIndent(data, 4, false)`; `indent=2, sort_keys=False` →
 *   `_jsonDumpsIndent(data, 2, false)`; `separators=(",",":")` (compact
 *   NDJSON) → `_jsonDumpsCompact`. Dict insertion order is preserved (JS
 *   object key order matches Python dict order for our string keys).
 * - `_lib.*` and `config.*` imports resolve to the `.ts` twins (never a
 *   `.py`). The Python dual-path try/except (`scripts._lib.X` vs `_lib.X`)
 *   collapses to a single static import here.
 * - The lazy `_load_*_module()` helpers in the Python are eager static
 *   imports here; the sys.path bootstrap they performed is a Python-only
 *   import-resolution detail with no observable effect.
 * - `scripts._cli.cmd_migrate` has NO `.ts` twin yet, so `_run_migrate_to_global`
 *   spawns `python3` against the real `cmd_migrate.py` and inherits its
 *   stdout + exit code. The Python original runs it in-process writing to
 *   `sys.stdout`; the observable contract (stdout text + exit code) is
 *   identical. Inline reason at the call site.
 * - `webbrowser.open` → a platform open spawn (`open`/`xdg-open`/`start`),
 *   best-effort and never fatal, matching the Python's bare-except guard.
 * - `threading.Thread` draining child stderr → an async line reader; the
 *   80-line cap + observable stderr-tail behaviour is preserved.
 * - `signal.SIGTERM`/`SIGKILL` + `os.kill(pid, 0)` liveness → `process.kill`.
 */

import { spawnSync, spawn } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import * as readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build_merge_entries } from './_lib/json_pointers.js';
import * as installed_lock from './_lib/installed_lock.js';
import * as global_deploy_inventory from './_lib/global_deploy_inventory.js';
import * as installed_tools from './_lib/installed_tools.js';
import * as user_global_paths from './_lib/user_global_paths.js';
import * as claude_desktop_bundler from './_lib/claude_desktop_bundler.js';
import { find_project_root_with_anchor, load_agent_settings } from './_lib/agent_settings.js';
import { detect_module_roots } from './_lib/module_detection.js';
import {
    TIER_TO_CLAUDE_MODEL,
    read_model_tier,
    render_native_model_md,
} from './_lib/model_tier.js';

// ---------------------------------------------------------------------------
// Python-runtime parity helpers
// ---------------------------------------------------------------------------

const _HERE = fileURLToPath(import.meta.url);

/** Mirror of Python `sys.exit(code)` raised by `fail()`. Caught at the CLI entry. */
class SystemExitError extends Error {
    constructor(public readonly code: number) {
        super(`system-exit-${code}`);
    }
}

/** argparse usage-error / help exit (code 2 / 0). */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/** `os.path.expanduser` — expand a leading `~` / `~user` (we only handle `~`). */
function expanduser(p: string): string {
    if (p === '~') return os.homedir();
    if (p.startsWith('~/') || p.startsWith('~\\')) {
        return path.join(os.homedir(), p.slice(2));
    }
    return p;
}

/** `Path.resolve()` — absolute, symlink-resolved where possible. */
function resolvePath(p: string): string {
    try {
        return fs.realpathSync(path.resolve(p));
    } catch {
        return path.resolve(p);
    }
}

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function pathExists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function isSymlink(p: string): boolean {
    try {
        return fs.lstatSync(p).isSymbolicLink();
    } catch {
        return false;
    }
}

function readText(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

function writeText(p: string, content: string): void {
    fs.writeFileSync(p, content, 'utf-8');
}

/** `path.mkdir(parents=True, exist_ok=True)`. */
function mkdirp(p: string): void {
    fs.mkdirSync(p, { recursive: true });
}

/**
 * `sorted(Path.glob(pattern))` with PyYAML/pathlib component-wise ordering.
 * We only need a non-recursive `*.glob("<pat>")`; pathlib sorts the matched
 * paths lexicographically by their string form, which for sibling entries in
 * one directory is plain string sort — matched here.
 */
function sortedGlobStems(directory: string, suffix: string): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(directory);
    } catch {
        return [];
    }
    const stems: string[] = [];
    for (const name of entries) {
        if (name.endsWith(suffix)) {
            stems.push(name.slice(0, name.length - suffix.length));
        }
    }
    // pathlib glob yields full paths; sorted() compares the path strings.
    // The directory prefix is common, so sorting by full path == sorting by
    // filename, == sorting by stem+suffix. Sort by the full filename to match.
    stems.sort((a, b) => {
        const fa = a + suffix;
        const fb = b + suffix;
        return fa < fb ? -1 : fa > fb ? 1 : 0;
    });
    return stems;
}

/** Number of `.zip` files directly under `directory` (count only). */
function countZips(directory: string): number {
    if (!isDir(directory)) return 0;
    let n = 0;
    for (const name of fs.readdirSync(directory)) {
        if (name.endsWith('.zip')) n += 1;
    }
    return n;
}

/** `hashlib.sha256(data).hexdigest()` of a file's bytes, or null when unreadable. */
function sha256OfFile(p: string): string | null {
    let data: Buffer;
    try {
        data = fs.readFileSync(p);
    } catch {
        return null;
    }
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Atomic write mirroring the Python `tempfile.mkstemp(...) → os.fdopen → write
 * → os.chmod(0o644) → os.replace` pattern in `_write_consumer_bridge_marker`
 * and `_write_per_tool_project_anchors`. Temp file lives in the same dir so
 * the rename is atomic; cleanup-on-failure mirrors the Python `except` arm.
 */
function atomicWrite0644(target: string, body: string, prefix: string): void {
    const dir = path.dirname(target);
    const tmpName = path.join(
        dir,
        `${prefix}${process.pid}.${crypto.randomBytes(6).toString('hex')}.yml.tmp`,
    );
    let fd: number | null = null;
    try {
        fd = fs.openSync(tmpName, 'wx', 0o644);
        fs.writeFileSync(fd, body, 'utf-8');
        fs.closeSync(fd);
        fd = null;
        fs.chmodSync(tmpName, 0o644);
        fs.renameSync(tmpName, target);
    } catch (err) {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            } catch {
                /* fd may already be closed */
            }
        }
        try {
            fs.unlinkSync(tmpName);
        } catch {
            /* best-effort cleanup */
        }
        throw err;
    }
}

/**
 * `datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")` — second-precision
 * UTC stamp with a `Z` suffix.
 */
function utcStamp(now?: Date): string {
    const d = now ?? new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
    );
}

// --- JSON byte-parity (ensure_ascii=False; insertion order) ---

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function _jsonStrNoAscii(s: string): string {
    // json.dumps(ensure_ascii=False): escape control chars + " + \, keep >=0x20
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
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
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    out += ch;
                }
        }
    }
    return out + '"';
}

function _jsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            if (Number.isNaN(value)) return 'NaN';
            return value > 0 ? 'Infinity' : '-Infinity';
        }
        // Our payloads carry only integers; render as-is.
        return String(value);
    }
    if (typeof value === 'string') return _jsonStrNoAscii(value);
    return null;
}

function _dumpIndent(value: unknown, indent: number, depth: number): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${_jsonStrNoAscii(k)}: ${_dumpIndent(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrNoAscii(String(value));
}

/** `json.dumps(data, indent=N, ensure_ascii=False)` (sort_keys=False). */
function jsonDumpsIndent(value: unknown, indent: number): string {
    return _dumpIndent(value, indent, 0);
}

/** `json.dumps(obj, separators=(",", ":"))` — compact, ensure_ascii=False here. */
function jsonDumpsCompact(value: unknown): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    if (Array.isArray(value)) {
        return '[' + value.map((v) => jsonDumpsCompact(v)).join(',') + ']';
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        return (
            '{' +
            Object.keys(obj)
                .map((k) => `${_jsonStrNoAscii(k)}:${jsonDumpsCompact(obj[k])}`)
                .join(',') +
            '}'
        );
    }
    return _jsonStrNoAscii(String(value));
}

/** Lazy YAML safe_load mirroring PyYAML (version 1.1), `{}` on every error. */
function yamlSafeLoad(text: string): unknown {
    let YAML: typeof import('yaml');
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        YAML = require('yaml') as typeof import('yaml');
    } catch {
        return null; // ImportError → callers collapse to {}
    }
    try {
        const data = YAML.parse(text, { version: '1.1' });
        return data;
    } catch {
        return undefined; // YAMLError sentinel — callers collapse to {}
    }
}

// ---------------------------------------------------------------------------
// Module-level constants (install.py:51-116)
// ---------------------------------------------------------------------------

const DEFAULT_PROFILE = 'balanced';
const SUPPORTED_PROFILES: readonly string[] = ['minimal', 'balanced', 'full'];
const RULE_LOADING_TIER_PLACEHOLDER = '__RULE_LOADING_TIER__';
const USER_TYPE_PLACEHOLDER = '__USER_TYPE__';
const USER_TYPES_DIR = 'user-types';

const SETTINGS_FILE = '.agent-settings.yml';
const LEGACY_SETTINGS_FILE = '.agent-settings';
const LEGACY_BACKUP_FILE = '.agent-settings.backup.key-value';

const SETTINGS_SUBDIR: readonly string[] = ['agents', 'settings'];

function _canonical_settings_target(project_root: string): string {
    return path.join(project_root, ...SETTINGS_SUBDIR, SETTINGS_FILE);
}

function _resolve_settings_read(project_root: string): string {
    const canonical = _canonical_settings_target(project_root);
    if (pathExists(canonical)) return canonical;
    const legacy = path.join(project_root, SETTINGS_FILE);
    if (pathExists(legacy)) return legacy;
    return canonical;
}

const LEGACY_RENAME_MAP: Record<string, string> = {
    cost_profile: 'rule_loading_tier',
    ide: 'personal.ide',
    open_edited_files: 'personal.open_edited_files',
    user_name: 'personal.user_name',
    rtk_installed: 'personal.rtk_installed',
    minimal_output: 'personal.minimal_output',
    play_by_play: 'personal.play_by_play',
    pr_comment_bot_icon: 'project.pr_comment_bot_icon',
    pr_template: 'project.pr_template',
    upstream_repo: 'project.upstream_repo',
    improvement_pr_branch_prefix: 'project.improvement_pr_branch_prefix',
    github_pr_reply_method: 'github.pr_reply_method',
    eloquent_access_style: 'eloquent.access_style',
    skill_improvement_pipeline: 'pipelines.skill_improvement',
    subagent_implementer_model: 'subagents.implementer_model',
    subagent_judge_model: 'subagents.judge_model',
    subagent_max_parallel: 'subagents.max_parallel',
};

// --- Output helpers (module-mutable globals, like the Python QUIET/PROGRESS_NDJSON) ---

const state = {
    QUIET: false,
    PROGRESS_NDJSON: false,
};

function _emit_progress(obj: Record<string, unknown>): void {
    if (!state.PROGRESS_NDJSON) return;
    process.stdout.write(jsonDumpsCompact(obj) + '\n');
}

function _emit_progress_terminal(rc: number): void {
    if (!state.PROGRESS_NDJSON) return;
    if (rc === 0) {
        _emit_progress({ type: 'done' });
    } else {
        _emit_progress({ type: 'error', code: 'E_INSTALL', exitCode: rc });
    }
}

function info(msg: string): void {
    if (!state.QUIET) process.stdout.write(`  ${msg}\n`);
}

function success(msg: string): void {
    if (!state.QUIET) process.stdout.write(`  ✅  ${msg}\n`);
}

function skip(msg: string): void {
    if (!state.QUIET) process.stdout.write(`  ⏭️  ${msg}\n`);
}

function warn(msg: string): void {
    process.stderr.write(`  ⚠️  ${msg}\n`);
}

/** Mirror of Python `fail()`: prints the doctor hint, then `sys.exit(1)`. */
function fail(msg: string): never {
    process.stderr.write(`  ❌  ${msg}\n`);
    process.stderr.write(
        '      Diagnose: `./agent-config doctor` ' +
            '(or `--check <id>` for a single category)\n',
    );
    throw new SystemExitError(1);
}

// --- Package detection ---

function detect_package_root(project_root: string): string {
    const npm_path = path.join(project_root, 'node_modules', '@event4u', 'agent-config');
    if (isDir(npm_path)) return resolvePath(npm_path);

    if (pathExists(path.join(project_root, 'src', 'config', 'profiles', 'minimal.ini'))) {
        return project_root;
    }

    fail(
        'Could not find agent-config package. Install via ' +
            '`npx @event4u/agent-config init` or `npm install -g @event4u/agent-config`.',
    );
}

function detect_package_type(package_root: string): string {
    if (package_root.split(path.sep).includes('node_modules')) return 'npm';
    return 'local';
}

function detect_package_type_for_project(project_root: string, package_root: string): string {
    const npm_path = resolvePath(
        path.join(project_root, 'node_modules', '@event4u', 'agent-config'),
    );
    const package_resolved = resolvePath(package_root);
    if (package_resolved === npm_path) return 'npm';
    return detect_package_type(package_root);
}

// --- Conflict resolution ---

function _is_interactive(): boolean {
    try {
        return Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
    } catch {
        return false;
    }
}

function _resolve_file_conflict(_target: string, _force_hint: boolean): string {
    // del force_hint / del target — deploys always overwrite our own content.
    return 'write';
}

// --- File utilities ---

function ensure_directory(p: string): void {
    mkdirp(p);
}

function write_file(p: string, content: string): void {
    ensure_directory(path.dirname(p));
    writeText(p, content);
}

function read_json_file(p: string): Record<string, unknown> {
    let data: unknown;
    try {
        data = JSON.parse(readText(p));
    } catch {
        warn(`Invalid JSON in ${p}, treating as empty`);
        return {};
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        warn(`Unexpected JSON shape in ${p}, treating as empty`);
        return {};
    }
    return data as Record<string, unknown>;
}

function write_json_file(p: string, data: unknown): void {
    const content = jsonDumpsIndent(data, 4) + '\n';
    write_file(p, content);
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `copy.deepcopy` for JSON-shaped values. */
function deepcopy<T>(v: T): T {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map((x) => deepcopy(x)) as unknown as T;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>)) {
        out[k] = deepcopy((v as Record<string, unknown>)[k]);
    }
    return out as unknown as T;
}

function deep_merge(
    base: Record<string, unknown>,
    overlay: Record<string, unknown>,
): Record<string, unknown> {
    const result = deepcopy(base);
    for (const key of Object.keys(overlay)) {
        const value = overlay[key];
        if (
            Object.prototype.hasOwnProperty.call(result, key) &&
            _isPlainObject(result[key]) &&
            _isPlainObject(value)
        ) {
            result[key] = deep_merge(
                result[key] as Record<string, unknown>,
                value as Record<string, unknown>,
            );
        } else {
            result[key] = deepcopy(value);
        }
    }
    return result;
}

/** Deep structural equality for JSON-shaped values (Python dict `==`). */
function jsonEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((v, i) => jsonEqual(v, b[i]));
    }
    if (_isPlainObject(a) && _isPlainObject(b)) {
        const ka = Object.keys(a);
        const kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        return ka.every(
            (k) => Object.prototype.hasOwnProperty.call(b, k) && jsonEqual(a[k], (b as Record<string, unknown>)[k]),
        );
    }
    return false;
}

function merge_json_file(
    p: string,
    new_data: Record<string, unknown>,
    _force: boolean,
    label: string,
): Record<string, unknown>[] {
    // del force — our keys are always applied; the flag never gates a write.
    const new_entries = build_merge_entries(label, new_data) as unknown as Record<
        string,
        unknown
    >[];

    if (!pathExists(p)) {
        write_json_file(p, new_data);
        success(`${label} created`);
        return new_entries;
    }

    const existing = read_json_file(p);
    const merged = deep_merge(existing, new_data);

    if (jsonEqual(merged, existing)) {
        skip(`${label} already configured`);
        return new_entries;
    }

    write_json_file(p, merged);
    success(`${label} updated`);
    return new_entries;
}

// ---------------------------------------------------------------------------
// Legacy settings migration
// ---------------------------------------------------------------------------

function _parse_legacy_settings(text: string): [Record<string, string>, string[]] {
    const values: Record<string, string> = {};
    const unknown: string[] = [];
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        if (!line.includes('=')) continue;
        const eq = line.indexOf('=');
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        if (!key) continue;
        values[key] = value;
        if (!(key in LEGACY_RENAME_MAP)) unknown.push(key);
    }
    return [values, unknown];
}

const _BARE_ID_RE = /^[a-z][a-z0-9_]*$/;

function _yaml_scalar(value: string): string {
    if (value === '') return '""';
    if (value === 'true' || value === 'false') return value;
    if (value.length > 0 && /^[0-9]+$/.test(value)) return value; // str.isdigit()
    if (_BARE_ID_RE.test(value)) return value;
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function _replace_template_value(template: string, dotted_path: string, value: string): string {
    return _replace_template_value_raw(template, dotted_path, _yaml_scalar(value));
}

function _replace_template_value_raw(template: string, dotted_path: string, raw_yaml: string): string {
    const parts = dotted_path.split('.');
    if (parts.length === 0) return template;

    const sections = parts.slice(0, parts.length - 1);
    const key = parts[parts.length - 1];
    const target_indent = '  '.repeat(sections.length);

    const header_re = /^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*$/;
    const scalar_re = /^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*\S.*$/;

    const current_path: (string | null)[] = new Array(sections.length).fill(null);

    const endsNl = template.endsWith('\n');
    const lines = template.split('\n');
    // Python splitlines() drops a trailing empty produced by a final newline.
    if (endsNl && lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx] as string;
        const stripped = line.trim();
        if (!stripped || stripped.startsWith('#')) continue;

        const m_header = header_re.exec(line);
        if (m_header) {
            const indent = m_header[1] as string;
            const name = m_header[2] as string;
            const depth = Math.floor(indent.length / 2);
            if (depth < sections.length) {
                current_path[depth] = name;
                for (let d = depth + 1; d < sections.length; d += 1) {
                    current_path[d] = null;
                }
            }
            continue;
        }

        const m_scalar = scalar_re.exec(line);
        if (!m_scalar) continue;
        const indent = m_scalar[1] as string;
        const name = m_scalar[2] as string;
        if (name !== key || indent !== target_indent) continue;
        if (!arrayEqual(current_path, sections)) continue;
        lines[idx] = `${indent}${key}: ${raw_yaml}`;
        return lines.join('\n') + (endsNl ? '\n' : '');
    }
    return template;
}

function arrayEqual(a: (string | null)[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
}

function _append_unknown_legacy(
    rendered: string,
    legacy_values: Record<string, string>,
    unknown_keys: string[],
): string {
    if (unknown_keys.length === 0) return rendered;
    const block = [
        '',
        '# Unknown keys from the legacy .agent-settings — review and drop.',
        '_legacy:',
    ];
    for (const key of [...unknown_keys].sort()) {
        block.push(`  ${key}: ${_yaml_scalar(legacy_values[key] as string)}`);
    }
    const suffix = block.join('\n') + '\n';
    if (rendered.endsWith('\n')) return rendered + suffix;
    return rendered + '\n' + suffix;
}

function _migrate_legacy_if_present(project_root: string, template_body: string): string | null {
    const legacy_target = path.join(project_root, LEGACY_SETTINGS_FILE);
    if (!isFile(legacy_target)) return null;

    const legacy_text = readText(legacy_target);
    const [values, unknown] = _parse_legacy_settings(legacy_text);

    let rendered = template_body;
    for (const flat_key of Object.keys(values)) {
        if (flat_key in LEGACY_RENAME_MAP) {
            rendered = _replace_template_value(
                rendered,
                LEGACY_RENAME_MAP[flat_key] as string,
                values[flat_key] as string,
            );
        }
    }
    rendered = _append_unknown_legacy(rendered, values, unknown);

    const backup_target = path.join(project_root, LEGACY_BACKUP_FILE);
    writeText(backup_target, legacy_text);
    fs.unlinkSync(legacy_target);

    info(`Migrated legacy ${LEGACY_SETTINGS_FILE} → ${SETTINGS_FILE}`);
    info(`Backup saved to ${LEGACY_BACKUP_FILE}`);
    if (unknown.length > 0) {
        warn(`Legacy keys not in rename map preserved under _legacy: ${[...unknown].sort().join(', ')}`);
    }
    return rendered;
}

// --- Bridge generators ---

function _parse_profile_ini(p: string): Record<string, string> {
    const values: Record<string, string> = {};
    for (const raw of readText(p).split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith(';') || line.startsWith('#')) continue;
        if (!line.includes('=')) continue;
        const eq = line.indexOf('=');
        values[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return values;
}

const _PLACEHOLDER_RE = /__[A-Z][A-Z0-9_]*__/g;

function _render_template(template: string, profile_values: Record<string, string>): string {
    let body = template;
    for (const key of Object.keys(profile_values)) {
        const placeholder = `__${key.toUpperCase()}__`;
        if (body.includes(placeholder)) {
            body = body.split(placeholder).join(profile_values[key]);
        }
    }
    const leftover = [...new Set(body.match(_PLACEHOLDER_RE) ?? [])].sort();
    if (leftover.length > 0) {
        fail('Template has unfilled placeholders after profile render: ' + leftover.join(', '));
    }
    return body;
}

function _load_valid_user_types(package_root: string): string[] {
    const directory = path.join(package_root, USER_TYPES_DIR);
    if (!isDir(directory)) return [];
    return sortedGlobStems(directory, '.yml');
}

function _validate_user_type(package_root: string, value: string): string {
    const cleaned = (value || '').trim();
    if (!cleaned) return '';
    const valid = _load_valid_user_types(package_root);
    if (valid.length === 0) {
        fail(`--user-type=${cleaned} requested but no user-types/*.yml present under ${package_root}`);
    }
    if (!valid.includes(cleaned)) {
        fail(
            `Unknown --user-type=${cleaned}. Valid: ${valid.join(', ')} ` +
                '(empty string disables the filter).',
        );
    }
    return cleaned;
}

function _inject_packs(body: string, packs: string[]): string {
    if (packs.length === 0) return body;
    const block = 'packs:\n' + packs.map((p) => `  - ${p}\n`).join('');
    // splitlines(keepends=True)
    const lines = splitlinesKeepends(body);
    const out: string[] = [];
    let inserted = false;
    for (const line of lines) {
        out.push(line);
        if (!inserted && line.startsWith('rule_loading_tier:')) {
            if (!line.endsWith('\n')) {
                out[out.length - 1] = line + '\n';
            }
            out.push(block);
            inserted = true;
        }
    }
    if (!inserted) {
        if (out.length > 0 && !(out[out.length - 1] as string).endsWith('\n')) {
            out[out.length - 1] = (out[out.length - 1] as string) + '\n';
        }
        out.push(block);
    }
    return out.join('');
}

/** Python str.splitlines(keepends=True) for `\n`-terminated text. */
function splitlinesKeepends(text: string): string[] {
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (text[i] === '\n') {
            out.push(text.slice(start, i + 1));
            start = i + 1;
        }
    }
    if (start < text.length) out.push(text.slice(start));
    return out;
}

function ensure_agent_settings(
    project_root: string,
    package_root: string,
    profile: string,
    force: boolean,
    user_type: string = '',
    packs: string[] | null = null,
): void {
    const target = _canonical_settings_target(project_root);
    const profile_source = path.join(package_root, 'src', 'config', 'profiles', `${profile}.ini`);
    const template_source = path.join(package_root, 'src', 'config', 'agent-settings.template.yml');

    if (!pathExists(profile_source)) fail(`Missing profile preset: ${profile_source}`);
    if (!pathExists(template_source)) fail(`Missing settings template: ${template_source}`);

    const template = readText(template_source);
    if (!template.includes(RULE_LOADING_TIER_PLACEHOLDER)) {
        fail(`Template is missing placeholder ${RULE_LOADING_TIER_PLACEHOLDER}`);
    }
    if (!template.includes(USER_TYPE_PLACEHOLDER)) {
        fail(`Template is missing placeholder ${USER_TYPE_PLACEHOLDER}`);
    }
    const profile_values = _parse_profile_ini(profile_source);
    if (profile_values['rule_loading_tier'] !== profile) {
        // {v!r} → Python repr of a str (single-quoted) or None.
        const got = 'rule_loading_tier' in profile_values
            ? `'${profile_values['rule_loading_tier']}'`
            : 'None';
        fail(
            `Profile preset ${path.basename(profile_source)} has rule_loading_tier=` +
                `${got} but --profile=${profile}`,
        );
    }
    profile_values['user_type'] = _validate_user_type(package_root, user_type);
    let template_body = _render_template(template, profile_values);
    template_body = _inject_packs(template_body, packs ?? []);

    // ADR-038: relocate an existing repo-root .agent-settings.yml.
    const legacy_root = path.join(project_root, SETTINGS_FILE);
    if (isFile(legacy_root) && !pathExists(target)) {
        mkdirp(path.dirname(target));
        writeText(target, readText(legacy_root));
        fs.unlinkSync(legacy_root);
        success(`Migrated ${SETTINGS_FILE} → agents/settings/${SETTINGS_FILE} (ADR-038)`);
        return;
    }

    const legacy_target = path.join(project_root, LEGACY_SETTINGS_FILE);
    if (isFile(legacy_target) && pathExists(target)) {
        warn(
            `Both ${SETTINGS_FILE} and legacy ${LEGACY_SETTINGS_FILE} exist. ` +
                `Skipping migration to avoid overwriting ${SETTINGS_FILE}. ` +
                'Delete one of them manually and re-run.',
        );
        return;
    }

    const migrated = _migrate_legacy_if_present(project_root, template_body);
    if (migrated !== null) {
        write_file(target, migrated);
        success(`${SETTINGS_FILE} migrated from legacy key=value`);
        return;
    }

    if (pathExists(target) && !force) {
        skip(`${SETTINGS_FILE} already exists`);
        return;
    }

    mkdirp(path.dirname(target));
    write_file(target, template_body);
    const user_type_value = profile_values['user_type'] ?? '';
    const suffix = user_type_value ? `, user_type=${user_type_value}` : '';
    success(`${SETTINGS_FILE} created (rule_loading_tier=${profile}${suffix})`);
}

function ensure_vscode_bridge(project_root: string, package_type: string, force: boolean): void {
    const plugin_paths: Record<string, string> = {
        npm: './node_modules/@event4u/agent-config/plugin/agent-config',
    };
    const plugin_path = plugin_paths[package_type] ?? './plugin/agent-config';
    const bridge = { 'chat.pluginLocations': { [plugin_path]: true } };
    merge_json_file(
        path.join(project_root, '.vscode', 'settings.json'),
        bridge,
        force,
        '.vscode/settings.json',
    );
}

function ensure_augment_bridge(project_root: string, force: boolean): Record<string, unknown>[] {
    const bridge = { enabledPlugins: { 'agent-config@event4u': true } };
    return merge_json_file(
        path.join(project_root, '.augment', 'settings.json'),
        bridge,
        force,
        '.augment/settings.json',
    );
}

const AUGMENT_USER_DIR = path.join(os.homedir(), '.augment');
const AUGMENT_USER_HOOKS_DIR = path.join(AUGMENT_USER_DIR, 'hooks');
const AUGMENT_DISPATCHER_TRAMPOLINE = 'augment-dispatcher.sh';
const AUGMENT_LEGACY_TRAMPOLINES: readonly string[] = [
    'augment-chat-history.sh',
    'augment-roadmap-progress.sh',
    'augment-onboarding-gate.sh',
    'augment-context-hygiene.sh',
];
const AUGMENT_DISPATCHER_BINDINGS: ReadonlyArray<readonly [string, string]> = [
    ['session_start', 'SessionStart'],
    ['session_end', 'SessionEnd'],
    ['stop', 'Stop'],
    ['pre_tool_use', 'PreToolUse'],
    ['post_tool_use', 'PostToolUse'],
];

function _deploy_augment_trampoline(package_root: string, name: string, force: boolean): string | null {
    const src = path.join(package_root, 'scripts', 'hooks', name);
    if (!pathExists(src)) {
        skip(`augment trampoline missing in package: ${src}`);
        return null;
    }
    mkdirp(AUGMENT_USER_HOOKS_DIR);
    const dst = path.join(AUGMENT_USER_HOOKS_DIR, name);
    const src_text = readText(src);
    if (pathExists(dst) && readText(dst) === src_text && !force) {
        skip(`~/.augment/hooks/${name} already up to date`);
    } else {
        writeText(dst, src_text);
        fs.chmodSync(dst, 0o755);
        success(`~/.augment/hooks/${name} installed`);
    }
    return dst;
}

function _remove_legacy_augment_trampolines(): void {
    for (const name of AUGMENT_LEGACY_TRAMPOLINES) {
        const legacy = path.join(AUGMENT_USER_HOOKS_DIR, name);
        try {
            if (isFile(legacy)) {
                fs.unlinkSync(legacy);
                skip(`removed legacy ~/.augment/hooks/${name}`);
            }
        } catch {
            /* OSError → ignore */
        }
    }
}

function ensure_augment_user_hooks(package_root: string, force: boolean): Record<string, unknown>[] {
    const dst = _deploy_augment_trampoline(package_root, AUGMENT_DISPATCHER_TRAMPOLINE, force);
    if (dst === null) return [];

    _remove_legacy_augment_trampolines();

    const per_event: Record<string, unknown[]> = {};
    for (const [ac_event, native] of AUGMENT_DISPATCHER_BINDINGS) {
        const cmd = `${dst} ${ac_event} ${native}`;
        const entry = { hooks: [{ type: 'command', command: cmd }] };
        (per_event[native] ??= []).push(entry);
    }

    const settings_patch = { hooks: per_event };
    return merge_json_file(
        path.join(AUGMENT_USER_DIR, 'settings.json'),
        settings_patch,
        force,
        '~/.augment/settings.json',
    );
}

const CLAUDE_PLUGIN_ID = 'agent-config@event4u-agent-config';
const CLAUDE_LEGACY_PLUGIN_IDS: readonly string[] = [
    'agent-conf@event4u',
    'agent-config@event4u',
];

function _heal_legacy_claude_plugin_ids(p: string): string[] {
    if (!pathExists(p)) return [];
    const data = read_json_file(p);
    const enabled = data['enabledPlugins'];
    if (!_isPlainObject(enabled)) return [];
    const removed = CLAUDE_LEGACY_PLUGIN_IDS.filter((pid) => pid in enabled);
    if (removed.length === 0) return [];
    for (const pid of removed) {
        delete (enabled as Record<string, unknown>)[pid];
    }
    write_json_file(p, data);
    return removed;
}

function ensure_claude_bridge(project_root: string, force: boolean): Record<string, unknown>[] {
    const target = path.join(project_root, '.claude', 'settings.json');
    const healed = _heal_legacy_claude_plugin_ids(target);
    for (const pid of healed) {
        success(`.claude/settings.json: removed stale plugin id \`${pid}\``);
    }
    const bridge = { enabledPlugins: { [CLAUDE_PLUGIN_ID]: true } };
    return merge_json_file(target, bridge, force || healed.length > 0, '.claude/settings.json');
}

const CURSOR_DISPATCHER_BINDINGS: ReadonlyArray<readonly [string, string]> = [
    ['session_start', 'sessionStart'],
    ['session_end', 'sessionEnd'],
    ['stop', 'stop'],
    ['user_prompt_submit', 'beforeSubmitPrompt'],
    ['post_tool_use', 'postToolUse'],
];

function _cursor_dispatch_command(ac_event: string, native: string): string {
    return (
        `./agent-config dispatch:hook ` +
        `--platform cursor --event ${ac_event} ` +
        `--native-event ${native}`
    );
}

function ensure_cursor_bridge(project_root: string, force: boolean): Record<string, unknown>[] {
    const hooks: Record<string, unknown[]> = {};
    for (const [ac_event, native] of CURSOR_DISPATCHER_BINDINGS) {
        (hooks[native] ??= []).push({ command: _cursor_dispatch_command(ac_event, native) });
    }
    const bridge = { version: 1, hooks };
    return merge_json_file(
        path.join(project_root, '.cursor', 'hooks.json'),
        bridge,
        force,
        '.cursor/hooks.json',
    );
}

const CURSOR_USER_DIR = path.join(os.homedir(), '.cursor');
const CURSOR_USER_HOOKS_DIR = path.join(CURSOR_USER_DIR, 'hooks');
const CURSOR_DISPATCHER_TRAMPOLINE = 'cursor-dispatcher.sh';

function ensure_cursor_user_hooks(package_root: string, force: boolean): Record<string, unknown>[] {
    const src = path.join(package_root, 'scripts', 'hooks', CURSOR_DISPATCHER_TRAMPOLINE);
    if (!pathExists(src)) {
        skip(`cursor trampoline missing in package: ${src}`);
        return [];
    }

    mkdirp(CURSOR_USER_HOOKS_DIR);
    const dst = path.join(CURSOR_USER_HOOKS_DIR, CURSOR_DISPATCHER_TRAMPOLINE);
    const src_text = readText(src);
    if (pathExists(dst) && readText(dst) === src_text && !force) {
        skip(`~/.cursor/hooks/${CURSOR_DISPATCHER_TRAMPOLINE} already up to date`);
    } else {
        writeText(dst, src_text);
        fs.chmodSync(dst, 0o755);
        success(`~/.cursor/hooks/${CURSOR_DISPATCHER_TRAMPOLINE} installed`);
    }

    const hooks: Record<string, unknown[]> = {};
    for (const [ac_event, native] of CURSOR_DISPATCHER_BINDINGS) {
        (hooks[native] ??= []).push({ command: `${dst} ${ac_event} ${native}` });
    }

    const settings_patch = { version: 1, hooks };
    return merge_json_file(
        path.join(CURSOR_USER_DIR, 'hooks.json'),
        settings_patch,
        force,
        '~/.cursor/hooks.json',
    );
}

const CLINE_DISPATCHER_BINDINGS: ReadonlyArray<readonly [string, string]> = [
    ['session_start', 'TaskStart'],
    ['session_start', 'TaskResume'],
    ['session_end', 'TaskComplete'],
    ['stop', 'TaskCancel'],
    ['user_prompt_submit', 'UserPromptSubmit'],
    ['post_tool_use', 'PostToolUse'],
];

/** `shlex.quote` — POSIX shell single-quote escaping. */
function shlexQuote(s: string): string {
    if (s === '') return "''";
    if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
    return "'" + s.replace(/'/g, "'\"'\"'") + "'";
}

function clineProjectHookBody(native_event: string, ac_event: string, workspace_quoted: string): string {
    // Faithful render of CLINE_PROJECT_HOOK_TEMPLATE.format(...). The Python
    // template uses doubled braces ({{ }}) that .format() collapses to single.
    return (
        '#!/usr/bin/env bash\n' +
        '# Generated by event4u/agent-config install.py — DO NOT EDIT.\n' +
        `# Project-scope Cline hook for ${native_event} → agent-config ${ac_event}.\n` +
        '# Phase 7.6 (docs/contracts/hook-architecture-v1.md).\n' +
        'set -u\n' +
        'EVENT_DATA="$(cat)"\n' +
        `WORKSPACE_ROOT=${workspace_quoted}\n` +
        'cd "$WORKSPACE_ROOT" 2>/dev/null || { printf \'%s\\n\' \'{}\'; exit 0; }\n' +
        'if [ ! -x ./agent-config ]; then\n' +
        '    printf \'%s\\n\' \'{}\'\n' +
        '    exit 0\n' +
        'fi\n' +
        'printf \'%s\' "$EVENT_DATA" \\\n' +
        '    | ./agent-config dispatch:hook \\\n' +
        '        --platform cline \\\n' +
        `        --event ${ac_event} \\\n` +
        `        --native-event ${native_event} \\\n` +
        '        >/dev/null 2>&1 || true\n' +
        'printf \'%s\\n\' \'{}\'\n' +
        'exit 0\n'
    );
}

function ensure_cline_bridge(project_root: string, force: boolean): void {
    const hooks_dir = path.join(project_root, '.clinerules', 'hooks');
    mkdirp(hooks_dir);

    const workspace_quoted = shlexQuote(resolvePath(project_root));
    let written = 0;
    for (const [ac_event, native_event] of CLINE_DISPATCHER_BINDINGS) {
        const target = path.join(hooks_dir, native_event);
        const body = clineProjectHookBody(native_event, ac_event, workspace_quoted);
        if (pathExists(target) && readText(target) === body && !force) {
            continue;
        }
        if (pathExists(target) && !force) {
            skip(`.clinerules/hooks/${native_event} exists, needs update (use --force)`);
            continue;
        }
        writeText(target, body);
        fs.chmodSync(target, 0o755);
        written += 1;
    }
    if (written) {
        success(`.clinerules/hooks/ — ${written} script(s) installed`);
    } else {
        skip('.clinerules/hooks/ already up to date');
    }
}

const CLINE_USER_DIR = path.join(os.homedir(), 'Documents', 'Cline', 'Hooks');
const CLINE_DISPATCHER_TRAMPOLINE = 'cline-dispatcher.sh';

function ensure_cline_user_hooks(package_root: string, force: boolean): void {
    const src = path.join(package_root, 'scripts', 'hooks', CLINE_DISPATCHER_TRAMPOLINE);
    if (!pathExists(src)) {
        skip(`cline trampoline missing in package: ${src}`);
        return;
    }

    mkdirp(CLINE_USER_DIR);
    const trampoline = path.join(CLINE_USER_DIR, CLINE_DISPATCHER_TRAMPOLINE);
    const src_text = readText(src);
    if (pathExists(trampoline) && readText(trampoline) === src_text && !force) {
        skip(`~/Documents/Cline/Hooks/${CLINE_DISPATCHER_TRAMPOLINE} already up to date`);
    } else {
        writeText(trampoline, src_text);
        fs.chmodSync(trampoline, 0o755);
        success(`~/Documents/Cline/Hooks/${CLINE_DISPATCHER_TRAMPOLINE} installed`);
    }

    const trampoline_quoted = shlexQuote(trampoline);
    for (const [ac_event, native_event] of CLINE_DISPATCHER_BINDINGS) {
        const wrapper = path.join(CLINE_USER_DIR, native_event);
        const body =
            '#!/usr/bin/env bash\n' +
            '# Generated by event4u/agent-config install.py — DO NOT EDIT.\n' +
            `# User-scope Cline hook for ${native_event} → agent-config ${ac_event}.\n` +
            `exec ${trampoline_quoted} ${ac_event} ${native_event}\n`;
        if (pathExists(wrapper) && readText(wrapper) === body && !force) {
            continue;
        }
        writeText(wrapper, body);
        fs.chmodSync(wrapper, 0o755);
    }
}

const WINDSURF_DISPATCHER_BINDINGS: ReadonlyArray<readonly [string, string]> = [
    ['session_start', 'post_setup_worktree'],
    ['user_prompt_submit', 'pre_user_prompt'],
    ['stop', 'post_cascade_response'],
];

function _windsurf_dispatch_command(ac_event: string, native: string): string {
    return (
        `./agent-config dispatch:hook ` +
        `--platform windsurf --event ${ac_event} ` +
        `--native-event ${native}`
    );
}

function ensure_windsurf_bridge(project_root: string, force: boolean): Record<string, unknown>[] {
    const hooks: Record<string, unknown[]> = {};
    for (const [ac_event, native] of WINDSURF_DISPATCHER_BINDINGS) {
        (hooks[native] ??= []).push({
            command: _windsurf_dispatch_command(ac_event, native),
            show_output: false,
        });
    }
    const bridge = { hooks };
    return merge_json_file(
        path.join(project_root, '.windsurf', 'hooks.json'),
        bridge,
        force,
        '.windsurf/hooks.json',
    );
}

const WINDSURF_USER_DIR = path.join(os.homedir(), '.codeium', 'windsurf');
const WINDSURF_USER_HOOKS_DIR = path.join(WINDSURF_USER_DIR, 'hooks');
const WINDSURF_DISPATCHER_TRAMPOLINE = 'windsurf-dispatcher.sh';

function ensure_windsurf_user_hooks(package_root: string, force: boolean): Record<string, unknown>[] {
    const src = path.join(package_root, 'scripts', 'hooks', WINDSURF_DISPATCHER_TRAMPOLINE);
    if (!pathExists(src)) {
        skip(`windsurf trampoline missing in package: ${src}`);
        return [];
    }

    mkdirp(WINDSURF_USER_HOOKS_DIR);
    const dst = path.join(WINDSURF_USER_HOOKS_DIR, WINDSURF_DISPATCHER_TRAMPOLINE);
    const src_text = readText(src);
    if (pathExists(dst) && readText(dst) === src_text && !force) {
        skip(`~/.codeium/windsurf/hooks/${WINDSURF_DISPATCHER_TRAMPOLINE} already up to date`);
    } else {
        writeText(dst, src_text);
        fs.chmodSync(dst, 0o755);
        success(`~/.codeium/windsurf/hooks/${WINDSURF_DISPATCHER_TRAMPOLINE} installed`);
    }

    const hooks: Record<string, unknown[]> = {};
    for (const [ac_event, native] of WINDSURF_DISPATCHER_BINDINGS) {
        (hooks[native] ??= []).push({
            command: `${dst} ${ac_event} ${native}`,
            show_output: false,
        });
    }

    const settings_patch = { hooks };
    return merge_json_file(
        path.join(WINDSURF_USER_DIR, 'hooks.json'),
        settings_patch,
        force,
        '~/.codeium/windsurf/hooks.json',
    );
}

const GEMINI_DISPATCHER_BINDINGS: ReadonlyArray<readonly [string, string, string]> = [
    ['session_start', 'SessionStart', ''],
    ['session_end', 'SessionEnd', ''],
    ['stop', 'AfterAgent', ''],
    ['user_prompt_submit', 'BeforeAgent', ''],
    ['post_tool_use', 'AfterTool', '.*'],
];

function _gemini_dispatch_command(ac_event: string, native: string): string {
    return (
        `./agent-config dispatch:hook ` +
        `--platform gemini --event ${ac_event} ` +
        `--native-event ${native}`
    );
}

function _gemini_hooks_dict(
    command_factory: (ac_event: string, native: string) => string,
): Record<string, unknown[]> {
    const out: Record<string, unknown[]> = {};
    for (const [ac_event, native, matcher] of GEMINI_DISPATCHER_BINDINGS) {
        (out[native] ??= []).push({
            matcher,
            hooks: [{ type: 'command', command: command_factory(ac_event, native) }],
        });
    }
    return out;
}

function ensure_gemini_bridge(project_root: string, force: boolean): Record<string, unknown>[] {
    const bridge = { hooks: _gemini_hooks_dict(_gemini_dispatch_command) };
    return merge_json_file(
        path.join(project_root, '.gemini', 'settings.json'),
        bridge,
        force,
        '.gemini/settings.json',
    );
}

const GEMINI_USER_DIR = path.join(os.homedir(), '.gemini');
const GEMINI_USER_HOOKS_DIR = path.join(GEMINI_USER_DIR, 'hooks');
const GEMINI_DISPATCHER_TRAMPOLINE = 'gemini-dispatcher.sh';

function ensure_gemini_user_hooks(package_root: string, force: boolean): Record<string, unknown>[] {
    const src = path.join(package_root, 'scripts', 'hooks', GEMINI_DISPATCHER_TRAMPOLINE);
    if (!pathExists(src)) {
        skip(`gemini trampoline missing in package: ${src}`);
        return [];
    }

    mkdirp(GEMINI_USER_HOOKS_DIR);
    const dst = path.join(GEMINI_USER_HOOKS_DIR, GEMINI_DISPATCHER_TRAMPOLINE);
    const src_text = readText(src);
    if (pathExists(dst) && readText(dst) === src_text && !force) {
        skip(`~/.gemini/hooks/${GEMINI_DISPATCHER_TRAMPOLINE} already up to date`);
    } else {
        writeText(dst, src_text);
        fs.chmodSync(dst, 0o755);
        success(`~/.gemini/hooks/${GEMINI_DISPATCHER_TRAMPOLINE} installed`);
    }

    const settings_patch = {
        hooks: _gemini_hooks_dict((ac_event, native) => `${dst} ${ac_event} ${native}`),
    };
    return merge_json_file(
        path.join(GEMINI_USER_DIR, 'settings.json'),
        settings_patch,
        force,
        '~/.gemini/settings.json',
    );
}

function ensure_copilot_bridge(project_root: string, force: boolean): void {
    const target = path.join(project_root, '.github', 'plugin', 'marketplace.json');
    const bridge = {
        marketplace: {
            name: 'event4u-agent-marketplace',
            plugins: [
                {
                    id: 'agent-config@event4u',
                    repository: 'https://github.com/event4u-app/agent-config',
                },
            ],
        },
    };
    if (pathExists(target) && !force) {
        skip('.github/plugin/marketplace.json already exists');
        return;
    }
    write_json_file(target, bridge);
    success('.github/plugin/marketplace.json created');
}

const ROOCODE_MARKER = `# Agent Config bridge

This file marks the project as an \`event4u/agent-config\` consumer.

Roo Code reads \`.roo/rules/*.md\` as system-level instructions. The
canonical rule and skill source lives under \`.augment/\` (Augment
portability mirror — see \`AGENTS.md\` for orientation).

## How to use

- These rules load automatically on every Roo Code session — no
  manual action required.
- Switch Roo Code modes (Architect / Code / Ask / Debug / Custom)
  via the mode switcher to invoke different cognition profiles;
  every mode still sees these rules.
- Slash commands and skills live under \`.augment/commands/\` and
  \`.augment/skills/\`. Roo Code does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See \`docs/setup/per-ide/roocode.md\` for the full activation guide.

Run \`./agent-config --help\` for available commands.
`;

function ensure_roocode_bridge(project_root: string, force: boolean): void {
    const target = path.join(project_root, '.roo', 'rules', 'agent-config.md');
    if (pathExists(target) && !force) {
        skip('.roo/rules/agent-config.md already exists');
        return;
    }
    write_file(target, ROOCODE_MARKER);
    success('.roo/rules/agent-config.md created');
}

const CLAUDE_DESKTOP_MARKER = `# Agent Config bridge — Claude Desktop

This file marks the project as an \`event4u/agent-config\` consumer.

Claude Desktop is a **global-scope** tool — it reads config from
\`~/Library/Application Support/Claude/\` (macOS) and does not
auto-discover project files. This marker is informational only.

To wire Claude Desktop to this project's rules, run:
\`npx @event4u/agent-config init --ai claude-desktop --global\`

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;

function ensure_claude_desktop_bridge(project_root: string, force: boolean): void {
    const target = path.join(project_root, '.claude-desktop', 'agent-config.md');
    if (pathExists(target) && !force) {
        skip('.claude-desktop/agent-config.md already exists');
        return;
    }
    write_file(target, CLAUDE_DESKTOP_MARKER);
    success('.claude-desktop/agent-config.md created');
}

const AIDER_MARKER = `# Agent Config bridge — Aider

This file marks the project as an \`event4u/agent-config\` consumer.

Aider does not auto-discover this file. To activate it, add the
following to \`.aider.conf.yml\` (create if missing):

\`\`\`yaml
read:
  - .aider/agent-config.md
\`\`\`

Or pass \`--read .aider/agent-config.md\` on the command line.

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;

function ensure_aider_bridge(project_root: string, force: boolean): void {
    const target = path.join(project_root, '.aider', 'agent-config.md');
    if (pathExists(target) && !force) {
        skip('.aider/agent-config.md already exists');
        return;
    }
    write_file(target, AIDER_MARKER);
    success('.aider/agent-config.md created');
}

const CODEX_MARKER = `# Agent Config bridge — Codex CLI

This file marks the project as an \`event4u/agent-config\` consumer.

Codex CLI auto-discovers \`AGENTS.md\` at the project root — that file
is the canonical entry point. This marker is informational and tells
developers where the rules and skills live.

Canonical rule and skill source: \`.augment/\` (see project \`AGENTS.md\`).
`;

function ensure_codex_bridge(project_root: string, force: boolean): void {
    const target = path.join(project_root, '.codex', 'agent-config.md');
    if (pathExists(target) && !force) {
        skip('.codex/agent-config.md already exists');
        return;
    }
    write_file(target, CODEX_MARKER);
    success('.codex/agent-config.md created');
}

const CONTINUE_MARKER = `# Agent Config bridge — Continue.dev

This file marks the project as an \`event4u/agent-config\` consumer.

Continue.dev auto-discovers \`.continue/rules/*.md\` as system-level
rules per session. The canonical rule and skill source lives under
\`.augment/\` (Augment portability mirror — see \`AGENTS.md\` for
orientation).
`;

function ensure_continue_bridge(project_root: string, force: boolean): void {
    const target = path.join(project_root, '.continue', 'rules', 'agent-config.md');
    if (pathExists(target) && !force) {
        skip('.continue/rules/agent-config.md already exists');
        return;
    }
    write_file(target, CONTINUE_MARKER);
    success('.continue/rules/agent-config.md created');
}

const KILOCODE_MARKER = `# Agent Config bridge — Kilo Code

This file marks the project as an \`event4u/agent-config\` consumer.

Kilo Code auto-discovers \`.kilocode/rules/*.md\` as system-level rules
per session. The canonical rule and skill source lives under
\`.augment/\` (Augment portability mirror — see \`AGENTS.md\` for
orientation).

## How to use

- These rules load automatically on every Kilo Code session — no
  manual action required.
- Switch Kilo Code modes (Architect / Code / Ask / Debug /
  Orchestrator) via the mode switcher to invoke different
  cognition profiles; every mode still sees these rules.
- Slash commands and skills live under \`.augment/commands/\` and
  \`.augment/skills/\`. Kilo Code does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See \`docs/setup/per-ide/kilocode.md\` for the full activation guide.
`;

function ensure_kilocode_bridge(project_root: string, force: boolean): void {
    const target = path.join(project_root, '.kilocode', 'rules', 'agent-config.md');
    if (pathExists(target) && !force) {
        skip('.kilocode/rules/agent-config.md already exists');
        return;
    }
    write_file(target, KILOCODE_MARKER);
    success('.kilocode/rules/agent-config.md created');
}

const ZED_MARKER = `# Agent Config bridge — Zed

This file marks the project as an \`event4u/agent-config\` consumer.

Zed reads \`.rules\` at the project root as system-level instructions —
that file is the canonical entry point. This marker is informational
and tells developers where the rules and skills live.

To activate agent-config under Zed, point Zed's \`.rules\` at the
canonical source (or symlink it):

\`\`\`
# Append to .rules at project root
@.augment/AGENTS.md
\`\`\`

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;

function ensure_zed_bridge(project_root: string, force: boolean): void {
    const target = path.join(project_root, '.zed', 'agent-config.md');
    if (pathExists(target) && !force) {
        skip('.zed/agent-config.md already exists');
        return;
    }
    write_file(target, ZED_MARKER);
    success('.zed/agent-config.md created');
}

const JETBRAINS_MARKER = `# Agent Config bridge — JetBrains AI Assistant

This file marks the project as an \`event4u/agent-config\` consumer.

JetBrains AI Assistant reads custom prompts and guidelines from
project-level config (\`.idea/\`) and user-scope settings. This marker
is informational — to wire agent-config into JetBrains AI, point the
assistant's custom-prompts path at \`.augment/\` or copy the relevant
rules into your JetBrains profile.

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;

function ensure_jetbrains_bridge(project_root: string, force: boolean): void {
    const target = path.join(project_root, '.jetbrains', 'agent-config.md');
    if (pathExists(target) && !force) {
        skip('.jetbrains/agent-config.md already exists');
        return;
    }
    write_file(target, JETBRAINS_MARKER);
    success('.jetbrains/agent-config.md created');
}

const KIRO_MARKER = `# Agent Config bridge — Kiro

This file marks the project as an \`event4u/agent-config\` consumer.

Kiro auto-discovers \`.kiro/steering/*.md\` as steering documents per
session. The canonical rule and skill source lives under \`.augment/\`
(Augment portability mirror — see \`AGENTS.md\` for orientation).

## How to use

- Steering documents load automatically on every Kiro session — no
  manual action required.
- For structured, plan-first work, use Kiro's **Spec** workflow
  (the agent produces a spec → tasks → implementation under your
  review). For free-form work, use **Vibe**. Both honor these
  steering documents.
- Slash commands and skills live under \`.augment/commands/\` and
  \`.augment/skills/\`. Kiro does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See \`docs/setup/per-ide/kiro.md\` for the full activation guide.
`;

function ensure_kiro_bridge(project_root: string, force: boolean): void {
    const target = path.join(project_root, '.kiro', 'steering', 'agent-config.md');
    if (pathExists(target) && !force) {
        skip('.kiro/steering/agent-config.md already exists');
        return;
    }
    write_file(target, KIRO_MARKER);
    success('.kiro/steering/agent-config.md created');
}

// --- Post-install smoke test ---

const SMOKE_PROBE_EVENTS: ReadonlyArray<readonly [string, string]> = [
    ['augment', 'session_start'],
    ['claude', 'SessionStart'],
    ['cursor', 'beforeShellExecution'],
    ['cline', 'session_start'],
    ['windsurf', 'post_setup_worktree'],
    ['gemini', 'SessionStart'],
];

const SMOKE_BRIDGE_PATHS: Record<string, string> = {
    augment: '.augment/settings.json',
    claude: '.claude/settings.json',
    cursor: '.cursor/hooks.json',
    cline: '.clinerules/hooks',
    windsurf: '.windsurf/hooks.json',
    gemini: '.gemini/settings.json',
};

function dirHasEntries(p: string): boolean {
    try {
        return fs.readdirSync(p).length > 0;
    } catch {
        return false;
    }
}

function _smoke_test_hooks(project_root: string, package_root: string): number {
    const dispatcher = path.join(package_root, 'scripts', 'hooks', 'dispatch_hook.py');
    const manifest = path.join(package_root, 'scripts', 'hook_manifest.yaml');
    if (!isFile(dispatcher) || !isFile(manifest)) return 0;

    const failed: string[] = [];
    const skipped: string[] = [];
    const passed: string[] = [];

    for (const [platform, native] of SMOKE_PROBE_EVENTS) {
        const rel_bridge = SMOKE_BRIDGE_PATHS[platform] ?? '';
        const bridge_path = rel_bridge ? path.join(project_root, rel_bridge) : null;
        const bridge_present = Boolean(
            bridge_path && (isFile(bridge_path) || (isDir(bridge_path) && dirHasEntries(bridge_path))),
        );
        if (!bridge_present) {
            skipped.push(platform);
            continue;
        }
        const cmd = [
            dispatcher,
            '--manifest',
            manifest,
            '--platform',
            platform,
            '--event',
            'session_start',
            '--native-event',
            native,
            '--dry-run',
        ];
        let res;
        try {
            res = spawnSync('python3', cmd, {
                input: '{}',
                encoding: 'utf-8',
                cwd: project_root,
                timeout: 10000,
            });
        } catch (exc) {
            failed.push(`${platform}: ${String(exc)}`);
            continue;
        }
        // spawnSync surfaces ENOENT / timeout via res.error rather than throwing.
        if (res.error) {
            failed.push(`${platform}: ${String(res.error)}`);
            continue;
        }
        const returncode = res.status ?? 1;
        if (returncode !== 0) {
            const errTail = (res.stderr || '').trim().slice(0, 120);
            failed.push(`${platform}: exit=${returncode} ${errTail}`);
            continue;
        }
        let plan: unknown;
        try {
            plan = JSON.parse(res.stdout || '{}');
        } catch {
            failed.push(`${platform}: dispatcher did not emit JSON plan`);
            continue;
        }
        const concerns = _isPlainObject(plan) ? (plan as Record<string, unknown>)['concerns'] : undefined;
        if (!Array.isArray(concerns)) {
            failed.push(`${platform}: plan.concerns missing or not a list`);
            continue;
        }
        passed.push(platform);
    }

    if (!state.QUIET) {
        if (passed.length) success(`hook smoke passed: ${passed.join(', ')}`);
        if (skipped.length) skip(`hook smoke skipped (bridge not installed): ${skipped.join(', ')}`);
        for (const line of failed) warn(`hook smoke failed — ${line}`);
    }
    return failed.length ? 1 : 0;
}

// --- Global user-level install (ADR-007) ---

const USER_SCOPE_PATHS: Record<string, string> = {
    'claude-code': '~/.claude/',
    'claude-desktop': '~/Library/Application Support/Claude/',
    cursor: '~/.cursor/',
    windsurf: '~/.codeium/windsurf/',
    cline: '~/Documents/Cline/Rules/',
    'gemini-cli': '~/.gemini/',
    copilot: '~/.copilot/',
    augment: '~/.augment/',
    aider: '~/.aider.conf.yml',
    codex: '~/.codex/',
    roocode: '~/.roo/',
    continue: '~/.continue/',
    kilocode: '~/.kilocode/',
    zed: '~/.config/zed/',
    jetbrains: '~/.config/JetBrains/',
    kiro: '~/.kiro/',
    qoder: '~/.qoder/',
    opencode: '~/.opencode/',
    trae: '~/.trae/',
    antigravity: '~/.agents/',
    codebuddy: '~/.codebuddy/',
    droid: '~/.factory/',
    warp: '~/.warp/',
};

const SCOPE_SUPPORT: Record<string, string> = {
    'claude-code': 'global',
    'claude-desktop': 'global',
    cursor: 'global',
    windsurf: 'global',
    cline: 'global',
    'gemini-cli': 'global',
    copilot: 'both',
    augment: 'global',
    aider: 'global',
    codex: 'global',
    roocode: 'global',
    continue: 'global',
    kilocode: 'global',
    zed: 'global',
    jetbrains: 'global',
    kiro: 'global',
    qoder: 'global',
    opencode: 'global',
    trae: 'global',
    antigravity: 'global',
    codebuddy: 'global',
    droid: 'global',
    warp: 'global',
};

const PROJECT_BRIDGE_MARKERS: Record<string, string> = {
    'claude-code': '.claude/settings.json',
    'claude-desktop': '.claude-desktop/agent-config.md',
    cursor: '.cursor/hooks.json',
    windsurf: '.windsurf/hooks.json',
    cline: '.clinerules/hooks',
    'gemini-cli': '.gemini/settings.json',
    copilot: '.github/plugin/marketplace.json',
    augment: '.augment/settings.json',
    aider: '.aider/agent-config.md',
    codex: '.codex/agent-config.md',
    roocode: '.roo/rules/agent-config.md',
    continue: '.continue/rules/agent-config.md',
    kilocode: '.kilocode/rules/agent-config.md',
    zed: '.zed/agent-config.md',
    jetbrains: '.jetbrains/agent-config.md',
    kiro: '.kiro/steering/agent-config.md',
};

const _CLAUDE_SKILL_BUNDLE: ReadonlyArray<readonly [string, string]> = [
    ['dist/agent-src/rules', 'rules'],
    ['dist/agent-src/skills', 'skills'],
    ['dist/agent-src/commands', 'commands'],
    ['dist/agent-src/personas', 'personas'],
];

const GLOBAL_DEPLOY_SOURCES: Record<string, ReadonlyArray<readonly [string, string]>> = {
    'claude-code': _CLAUDE_SKILL_BUNDLE,
    augment: [
        ['dist/agent-src/rules', 'rules'],
        ['dist/agent-src/skills', 'skills'],
        ['dist/agent-src/commands', 'commands'],
        ['dist/agent-src/contexts', 'contexts'],
        ['dist/agent-src/personas', 'personas'],
        ['dist/agent-src/templates', 'templates'],
    ],
    cursor: [
        ['dist/agent-src/rules', 'rules'],
        ['dist/agent-src/commands', 'commands'],
        ['dist/agent-src/personas', 'personas'],
    ],
    windsurf: [['dist/agent-src/rules', 'rules']],
    cline: [['dist/agent-src/rules', '']],
    'gemini-cli': _CLAUDE_SKILL_BUNDLE,
    codex: _CLAUDE_SKILL_BUNDLE,
    continue: _CLAUDE_SKILL_BUNDLE,
    roocode: _CLAUDE_SKILL_BUNDLE,
    kilocode: _CLAUDE_SKILL_BUNDLE,
    qoder: _CLAUDE_SKILL_BUNDLE,
    opencode: _CLAUDE_SKILL_BUNDLE,
    trae: _CLAUDE_SKILL_BUNDLE,
    antigravity: _CLAUDE_SKILL_BUNDLE,
    codebuddy: _CLAUDE_SKILL_BUNDLE,
    droid: _CLAUDE_SKILL_BUNDLE,
    warp: _CLAUDE_SKILL_BUNDLE,
    kiro: [
        ['dist/agent-src/rules', 'rules'],
        ['dist/agent-src/skills', 'steering'],
        ['dist/agent-src/personas', 'personas'],
    ],
};

const _CLAUDE_DESKTOP_MARKER_TEMPLATE_HEAD = `# agent-config — Claude Desktop marker

Installed by \`@event4u/agent-config\` (user scope, ADR-007).

`;

/** Render of _CLAUDE_DESKTOP_MARKER_TEMPLATE.format(...) — byte-faithful. */
function claudeDesktopMarkerBody(
    lockfile: string,
    anchor: string,
    bundles_dir: string,
    bundle_count: number,
): string {
    return (
        '# agent-config — Claude Desktop marker\n' +
        '\n' +
        'Installed by `@event4u/agent-config` (user scope, ADR-007).\n' +
        '\n' +
        `- Lockfile:    \`${lockfile}\`\n` +
        `- Anchor:      \`${anchor}\`\n` +
        `- Skill bundles: \`${bundles_dir}\` (${bundle_count} ZIPs)\n` +
        '\n' +
        '## Import skills into Claude Desktop\n' +
        '\n' +
        'Claude Desktop has no filesystem skill-discovery convention — skills are\n' +
        'imported manually via the Customize → Skills UI.\n' +
        '\n' +
        '1. Open Claude Desktop → **Settings → Customize → Skills**.\n' +
        '2. Click the **Upload skill** button.\n' +
        `3. Browse to \`${bundles_dir}\` and pick the \`<skill-name>.zip\` files you\n` +
        '   want to install. One ZIP = one skill.\n' +
        '4. Repeat per skill. Claude Desktop keeps each upload until you remove it.\n' +
        '\n' +
        'The bundle directory is regenerated on every\n' +
        '`npx @event4u/agent-config init --tools=claude-desktop` run (only\n' +
        'changed skills are rewritten — content-hash idempotency).\n' +
        '\n' +
        'To remove this marker, delete this file.\n'
    );
}
void _CLAUDE_DESKTOP_MARKER_TEMPLATE_HEAD;

const _CLAUDE_DESKTOP_BUNDLES_SUBPATH = 'claude-desktop/bundles';

const GLOBAL_ROOT = path.join(os.homedir(), '.event4u', 'agent-config');
const GLOBAL_USER_SETTINGS_PATH = path.join(GLOBAL_ROOT, '.agent-user.yml');
const GLOBAL_AGENT_SETTINGS_PATH = path.join(GLOBAL_ROOT, '.agent-settings.yml');
void GLOBAL_USER_SETTINGS_PATH;

function _bridge_marker(tool_id: string, scope: string): string {
    if (scope === 'global') return USER_SCOPE_PATHS[tool_id] ?? '';
    return PROJECT_BRIDGE_MARKERS[tool_id] ?? '';
}

function _validate_scope(tools: Set<string>, scope: string, was_all: boolean): Set<string> {
    if (scope !== 'project' && scope !== 'global') {
        fail(`_validate_scope: unknown scope '${scope}'`);
    }
    if (process.env['AGENT_CONFIG_DEV_MODE'] === '1') return tools;
    const incompatible = [...tools]
        .filter((t) => {
            const sup = SCOPE_SUPPORT[t] ?? 'both';
            return sup !== 'both' && sup !== scope;
        })
        .sort();
    if (incompatible.length === 0) return tools;
    if (was_all) {
        return new Set([...tools].filter((t) => !incompatible.includes(t)));
    }
    const hint =
        scope === 'global' ? 'drop --global (project is the default scope)' : 'use --global';
    fail(`--tools: ${incompatible.join(', ')} does not support --${scope} scope (${hint})`);
}

function _enforce_consumer_global_only(scope: string): void {
    if (scope !== 'project') return;
    if (process.env['AGENT_CONFIG_DEV_MODE'] === '1') return;
    fail(
        '--scope=project is reserved for maintainers (ADR-020 — consumer ' +
            'installs are global-only). Set AGENT_CONFIG_DEV_MODE=1 to opt in. ' +
            'See docs/maintainers/dev-mode.md.',
    );
}

function _enforce_not_source_repo(scope: string, project_root: string): void {
    if (scope === 'global') return;
    if (process.env['AGENT_CONFIG_ALLOW_SELF_INSTALL'] === '1') return;
    const [is_source, signature] = _is_agent_config_source_repo(project_root);
    if (!is_source) return;
    fail(
        'Refusing to install agent-config into its own source checkout ' +
            `(detected: ${signature}). The source repo is global-only — a ` +
            'project-scope install would recreate the .augment/ .claude/ .cursor/ ' +
            'projection trees in the repo (double token cost). Run `task sync` to ' +
            'regenerate them from .agent-src.uncondensed/ instead, or set ' +
            'AGENT_CONFIG_ALLOW_SELF_INSTALL=1 to force.',
    );
}

// --- Three-layer settings reader ---

function _load_yaml_doc(p: string): Record<string, unknown> {
    if (!pathExists(p) || !isFile(p)) return {};
    let text: string;
    try {
        text = readText(p);
    } catch {
        return {};
    }
    const data = yamlSafeLoad(text);
    return _isPlainObject(data) ? (data as Record<string, unknown>) : {};
}

function _load_default_settings(package_root: string): Record<string, unknown> {
    const template_source = path.join(package_root, 'src', 'config', 'agent-settings.template.yml');
    if (!pathExists(template_source)) return {};
    let text: string;
    try {
        text = readText(template_source);
    } catch {
        return {};
    }
    const rendered = text
        .split(RULE_LOADING_TIER_PLACEHOLDER)
        .join(DEFAULT_PROFILE)
        .split(USER_TYPE_PLACEHOLDER)
        .join('');
    const data = yamlSafeLoad(rendered);
    return _isPlainObject(data) ? (data as Record<string, unknown>) : {};
}

function read_layered_settings(
    package_root: string,
    project_root: string | null = null,
): Record<string, unknown> {
    let merged = _load_default_settings(package_root);
    merged = deep_merge(merged, _load_yaml_doc(GLOBAL_AGENT_SETTINGS_PATH));
    if (project_root !== null) {
        const project_file = _resolve_settings_read(project_root);
        merged = deep_merge(merged, _load_yaml_doc(project_file));
    }
    return merged;
}
void read_layered_settings;

interface Options {
    profile: string;
    user_type: string;
    force: boolean;
    skip_bridges: boolean;
    augment_user_hooks: boolean;
    cursor_user_hooks: boolean;
    cline_user_hooks: boolean;
    windsurf_user_hooks: boolean;
    gemini_user_hooks: boolean;
    project: string | null;
    package: string | null;
    quiet: boolean;
    tools: string; // post-merge it's always a string
    ai: string | null;
    packs: string[]; // normalized to list post-parse
    no_smoke: boolean;
    global_install: boolean;
    scope: string | null;
    custom_path: string | null;
    offline: boolean;
    minimal: boolean;
    interactive: boolean;
    no_ui: boolean;
    dry_run: boolean;
    apply_payload: string | null;
}

function _resolve_scope(
    opts: Options,
    detected: string,
    detect_reason: string,
    custom_path: string | null,
): string {
    if (opts.scope === 'project') return 'project';
    if (opts.scope === 'global') return 'global';
    if (opts.scope === 'prompt') {
        return _run_scope_prompt(opts, detect_reason || 'forced by --scope=prompt', custom_path);
    }
    if (opts.scope === 'auto') {
        if (detected === 'prompt') return _run_scope_prompt(opts, detect_reason, custom_path);
        if (!state.QUIET) info(`Scope: ${detected} (auto-detected; ${detect_reason})`);
        return detected;
    }

    if (opts.global_install) return 'global';

    if (detected === 'prompt') return _run_scope_prompt(opts, detect_reason, custom_path);
    if (!state.QUIET) {
        info(
            `Scope detection: ${detected} (${detect_reason}). Using project default for ` +
                'backward compatibility; pass --scope=auto to honor detection.',
        );
    }
    return 'project';
}

function _run_scope_prompt(opts: Options, reason: string, custom_path: string | null): string {
    if (!process.stdin.isTTY && custom_path === null) {
        fail(
            'Ambiguous install scope detected and stdin is not a TTY. ' +
                'Pass --scope=project|global (or --custom-path=<dir>) to override.',
        );
    }
    const choice = prompt_scope_choice(reason);
    if (choice === 'project') return 'project';
    if (choice === 'global') return 'global';
    let cp = custom_path;
    if (cp === null) {
        let raw: string | null;
        raw = _read_line('Custom destination path: ');
        if (raw === null) {
            fail('Custom-path prompt aborted (EOF on stdin)');
        }
        if (!raw) fail('Custom-path prompt requires a non-empty path');
        cp = resolvePath(expanduser(raw));
        opts.custom_path = cp;
    }
    if (!state.QUIET) info(`Custom destination: ${cp}`);
    return 'project';
}

const SCOPE_DETECT_MANIFESTS: readonly string[] = [
    'package.json',
    'composer.json',
    'pyproject.toml',
    'Cargo.toml',
    'go.mod',
    'Gemfile',
];
const SCOPE_DETECT_AI_DIRS: readonly string[] = [
    '.claude',
    '.cursor',
    '.windsurf',
    '.augment',
    '.clinerules',
    '.copilot',
    '.gemini',
    '.codex',
    '.aider',
    '.continue',
    '.roo',
    '.kilocode',
];
const SCOPE_DETECT_AI_FILES: readonly string[] = [
    'CLAUDE.md',
    'AGENTS.md',
    'GEMINI.md',
    '.windsurfrules',
    '.aider.conf.yml',
];

function detect_scope(cwd: string): [string, string] {
    if (pathExists(_resolve_settings_read(cwd))) {
        return ['project', `existing ${SETTINGS_FILE}`];
    }

    const has_manifest = SCOPE_DETECT_MANIFESTS.find((m) => pathExists(path.join(cwd, m))) ?? null;
    const has_ai_dir = SCOPE_DETECT_AI_DIRS.find((d) => isDir(path.join(cwd, d))) ?? null;
    const has_ai_file = SCOPE_DETECT_AI_FILES.find((f) => pathExists(path.join(cwd, f))) ?? null;

    if (has_manifest && (has_ai_dir || has_ai_file)) {
        const marker = has_ai_dir || has_ai_file;
        return ['prompt', `manifest (${has_manifest}) + AI-tool config (${marker})`];
    }

    return ['global', 'no project-scope signals'];
}

// --- Interactive prompts ---

const SCOPE_CUSTOM = 'custom';

/** `input(prompt).strip()` — returns null on EOF (Python raises EOFError). */
function _read_line(prompt_text: string): string | null {
    const line = readLineSyncRaw(prompt_text);
    if (line === null) return null;
    return line.trim();
}

/**
 * Synchronous single-line read from stdin with a prompt on stdout (no newline),
 * mirroring CPython `input()`. Returns null at EOF. Implemented via a blocking
 * fd read because Node has no built-in sync stdin line read.
 */
function readLineSyncRaw(promptText: string): string | null {
    process.stdout.write(promptText);
    const buf = Buffer.alloc(1);
    const bytes: number[] = [];
    let sawAny = false;
    for (;;) {
        let n: number;
        try {
            n = fs.readSync(0, buf, 0, 1, null);
        } catch (err) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code === 'EAGAIN') {
                continue;
            }
            if (code === 'EOF') {
                break;
            }
            throw err;
        }
        if (n === 0) break; // EOF
        sawAny = true;
        const ch = buf[0] as number;
        if (ch === 0x0a) {
            // strip a trailing \r (CRLF)
            if (bytes.length > 0 && bytes[bytes.length - 1] === 0x0d) bytes.pop();
            return Buffer.from(bytes).toString('utf-8');
        }
        bytes.push(ch);
    }
    if (!sawAny && bytes.length === 0) return null; // EOFError
    return Buffer.from(bytes).toString('utf-8');
}

function prompt_scope_choice(reason: string): string {
    process.stdout.write('\n');
    info(`Ambiguous install scope: ${reason}.`);
    info('Choose where to install:');
    process.stdout.write('  1) Project — install into the current directory\n');
    process.stdout.write('  2) User    — install into ~/ (recommended; one install per machine)\n');
    process.stdout.write('  3) Custom  — specify an explicit destination path\n');
    process.stdout.write('\n');
    let attempts = 0;
    while (attempts < 3) {
        const reply = _read_line('Choose [1/2/3]: ');
        if (reply === null) {
            fail('Scope prompt aborted (EOF on stdin); pass --scope=project|global to override');
        }
        if (['1', 'project', 'p'].includes(reply)) return 'project';
        if (['2', 'global', 'user', 'u', 'g'].includes(reply)) return 'global';
        if (['3', 'custom', 'c'].includes(reply)) return SCOPE_CUSTOM;
        attempts += 1;
        warn(`Invalid choice '${reply}'. Enter 1, 2, or 3.`);
    }
    fail('Scope prompt aborted (3 invalid replies); pass --scope=project|global to override');
}

function prompt_collision_choice(p: string): string {
    process.stdout.write('\n');
    warn(`Existing file at ${p}`);
    info('Choose how to handle the collision:');
    process.stdout.write('  1) Merge              — append our content, preserve theirs\n');
    process.stdout.write('  2) Backup and replace — rename existing to .bak.<ts>, write fresh\n');
    process.stdout.write('  3) Abort              — leave the file untouched, exit non-zero\n');
    process.stdout.write('\n');
    let attempts = 0;
    while (attempts < 3) {
        const reply = _read_line('Choose [1/2/3]: ');
        if (reply === null) {
            fail(`Collision prompt aborted (EOF on stdin) for ${p}`);
        }
        if (['1', 'merge', 'm'].includes(reply)) return 'merge';
        if (['2', 'backup', 'b'].includes(reply)) return 'backup';
        if (['3', 'abort', 'a'].includes(reply)) return 'abort';
        attempts += 1;
        warn(`Invalid choice '${reply}'. Enter 1, 2, or 3.`);
    }
    fail(`Collision prompt aborted (3 invalid replies) for ${p}`);
}
void prompt_collision_choice;

// --- Manifest / inventory helpers (lazy-import twins are eager static here) ---

function _sha256_of_file(p: string): string | null {
    return sha256OfFile(p);
}

function _file_entry(p: string, kind: string, hash_content: boolean): Record<string, unknown> {
    return {
        path: p,
        kind,
        sha256: hash_content ? _sha256_of_file(p) : null,
    };
}

type DeployResult = [number, number, string, string[]];

function _files_by_tool_from_deploy(
    deploy_results: Record<string, DeployResult>,
): Record<string, Record<string, unknown>[]> {
    const out: Record<string, Record<string, unknown>[]> = {};
    for (const tool_id of Object.keys(deploy_results)) {
        const [, , status, paths] = deploy_results[tool_id] as DeployResult;
        if (status === 'deployed') {
            out[tool_id] = paths.map((p) => _file_entry(p, 'deployed', true));
        } else if (status === 'marker') {
            out[tool_id] = paths.map((p) => _file_entry(p, 'marker', true));
        } else {
            out[tool_id] = [];
        }
    }
    return out;
}

function _files_by_tool_from_bridges(
    tools: Set<string>,
    project_root: string,
    scope: string,
): Record<string, Record<string, unknown>[]> {
    const out: Record<string, Record<string, unknown>[]> = {};
    for (const tool_id of [...tools].sort()) {
        const marker = _bridge_marker(tool_id, scope);
        if (!marker) continue;
        let marker_path = marker;
        if (!path.isAbsolute(marker_path)) {
            marker_path = path.join(project_root, marker_path);
        }
        out[tool_id] = [_file_entry(marker_path, 'bridge', false)];
    }
    return out;
}

function _update_installed_tools_manifest(
    project_root: string,
    tools: Set<string>,
    scope: string,
    force: boolean,
    files_by_tool: Record<string, Record<string, unknown>[]> | null = null,
    merged_keys_by_tool: Record<string, Record<string, unknown>[]> | null = null,
): number {
    const target = installed_tools.manifest_path(project_root);
    const existing = (installed_tools.read_manifest(target) ?? {}) as Record<string, unknown>;
    let entries = Array.isArray(existing['tools'])
        ? ([...(existing['tools'] as unknown[])] as Record<string, unknown>[])
        : [];

    const version = installed_lock.current_package_version();

    for (const tool_id of [...tools].sort()) {
        const marker = _bridge_marker(tool_id, scope);
        if (!marker) continue;
        const files = files_by_tool ? (files_by_tool[tool_id] ?? null) : null;
        const merged_keys = merged_keys_by_tool ? (merged_keys_by_tool[tool_id] ?? null) : null;
        try {
            entries = installed_tools.upsert_tool(entries, {
                name: tool_id,
                scope,
                bridge_marker: marker,
                force,
                files,
                merged_keys,
            });
        } catch (exc) {
            if (exc instanceof installed_tools.ScopeMismatchError) {
                if (!state.QUIET) {
                    warn(String(exc.message));
                    info(`  Manifest: ${target}`);
                    info('  Override: re-run with `--force` to rewrite the entry');
                }
                return 1;
            }
            throw exc;
        }
    }

    installed_tools.write_manifest(target, version, entries);
    if (!state.QUIET) {
        const rel = isRelativeTo(target, project_root) ? path.relative(project_root, target) : target;
        info(`Manifest updated: ${rel}`);
    }
    return 0;
}

/** `Path.is_relative_to`. */
function isRelativeTo(child: string, parent: string): boolean {
    const rel = path.relative(parent, child);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// --- Global content deployment ---

function _resolve_package_root_for_global(): string {
    const here = resolvePath(_HERE);
    const candidate = path.dirname(path.dirname(path.dirname(here)));
    if (!pathExists(path.join(candidate, 'src', 'config', 'profiles', 'minimal.ini'))) {
        fail(
            `Could not locate agent-config package root from ${here}. ` +
                'Expected src/config/profiles/minimal.ini at the parent directory.',
        );
    }
    return candidate;
}

const CONSUMER_BRIDGE_MARKER_RELPATH = path.join('agents', '.event4u-bridge.yml');

const MIGRATE_LEGACY_YAML_FILES: readonly string[] = ['.agent-settings.yml', '.agent-user.yml'];
const MIGRATE_LEGACY_TOOL_DIRS: readonly string[] = ['.augment', '.claude', '.cursor'];
const AGENT_CONFIG_PACKAGE_NAME = '@event4u/agent-config';

// Return `[is_source_repo, signature]` for the maintainer auto-detect.
// Signature #2: `.agent-src.uncondensed/` exists at `project_root` (legacy
// layout) OR under `packages/<name>/` (current layout) — both unique to the
// source repo. Hits skip the ADR-020 migration prompt automatically.
function _is_agent_config_source_repo(project_root: string): [boolean, string] {
    if (process.env['AGENT_CONFIG_CONSUMER_MODE'] === '1') {
        return [false, 'consumer-mode-override'];
    }

    const pkg_json = path.join(project_root, 'package.json');
    if (isFile(pkg_json)) {
        let data: unknown = {};
        try {
            data = JSON.parse(readText(pkg_json));
        } catch {
            data = {};
        }
        if (_isPlainObject(data) && (data as Record<string, unknown>)['name'] === AGENT_CONFIG_PACKAGE_NAME) {
            return [true, 'package.json:name'];
        }
    }

    if (isDir(path.join(project_root, '.agent-src.uncondensed'))) {
        return [true, '.agent-src.uncondensed/'];
    }
    const packages_dir = path.join(project_root, 'packages');
    if (isDir(packages_dir)) {
        for (const child of fs.readdirSync(packages_dir)) {
            if (isDir(path.join(packages_dir, child, '.agent-src.uncondensed'))) {
                return [true, `packages/${child}/.agent-src.uncondensed/`];
            }
        }
    }

    const installer_self = path.join(project_root, 'scripts', 'install.py');
    try {
        if (isFile(installer_self) && resolvePath(installer_self) === resolvePath(_HERE)) {
            return [true, 'src/scripts/install.py (self)'];
        }
    } catch {
        /* OSError → pass */
    }

    return [false, ''];
}

function _detect_legacy_for_migration(project_root: string): string[] {
    if (process.env['AGENT_CONFIG_DEV_MODE'] === '1') return [];

    const [is_source, signature] = _is_agent_config_source_repo(project_root);
    if (is_source) {
        if (!state.QUIET) {
            warn(
                'Maintainer mode auto-detected — agent-config source repo ' +
                    `(signature: ${signature}). Skipping ADR-020 migration ` +
                    'prompt; the working tree stays intact. Set ' +
                    'AGENT_CONFIG_CONSUMER_MODE=1 to override for end-to-end ' +
                    'consumer-flow testing.',
            );
        }
        return [];
    }

    if (isFile(path.join(project_root, CONSUMER_BRIDGE_MARKER_RELPATH))) return [];

    const found: string[] = [];
    for (const name of MIGRATE_LEGACY_YAML_FILES) {
        if (isFile(path.join(project_root, name))) {
            found.push(name);
        } else if (isFile(path.join(project_root, 'settings', name))) {
            found.push(`settings/${name}`);
        }
    }
    for (const name of MIGRATE_LEGACY_TOOL_DIRS) {
        const p = path.join(project_root, name);
        if (isDir(p) && !isSymlink(p)) {
            found.push(`${name}/`);
        }
    }
    return found.sort();
}

function _prompt_migrate_to_global(project_root: string, artefacts: string[]): boolean {
    if (!state.QUIET) {
        process.stdout.write('\n');
        warn('Legacy project-local artefacts detected — pre-ADR-020 layout:');
        for (const rel of artefacts) {
            info(`  ${path.join(project_root, rel)}`);
        }
        info('The unified `agent-config migrate` sweeps these in one pass.');
        info('The wizard recreates fresh config afterwards.');
    }

    if (!_is_interactive()) {
        if (!state.QUIET) info('Non-interactive mode → defaulting to YES (run migration).');
        return true;
    }

    let attempts = 0;
    while (attempts < 3) {
        const reply = _read_line('Run `agent-config migrate` now? [Y/n]: ');
        if (reply === null) return false;
        if (reply === '' || ['y', 'yes'].includes(reply.toLowerCase())) return true;
        if (['n', 'no'].includes(reply.toLowerCase())) return false;
        attempts += 1;
        warn(`Invalid choice '${reply}'. Enter Y or n.`);
    }
    return false;
}

function _run_migrate_to_global(project_root: string): number {
    // The .py runs `scripts._cli.cmd_migrate.main([], cwd, out=sys.stdout)`
    // in-process. cmd_migrate has no .ts twin yet, so we spawn python3 against
    // the real cmd_migrate.py with the same cwd and inherited stdio — the
    // observable contract (stdout text + exit code) is identical. The
    // `-c` bootstrap inserts the package root on sys.path exactly as the
    // Python's _run_migrate_to_global does before the package-qualified import.
    const pkg_root = path.dirname(path.dirname(resolvePath(_HERE)));
    const bootstrap =
        'import sys; ' +
        `sys.path.insert(0, ${pyStrLiteral(pkg_root)}); ` +
        'import importlib; ' +
        'mod=None\n' +
        'try:\n' +
        '    mod=importlib.import_module("scripts._cli.cmd_migrate")\n' +
        'except ImportError:\n' +
        '    try:\n' +
        '        mod=importlib.import_module("_cli.cmd_migrate")\n' +
        '    except ImportError as exc:\n' +
        '        sys.stderr.write("MIGRATE_UNAVAILABLE:%s" % exc); sys.exit(99)\n' +
        'from pathlib import Path\n' +
        `sys.exit(mod.main([], cwd=Path(${pyStrLiteral(project_root)}), out=sys.stdout))\n`;
    const res = spawnSync('python3', ['-c', bootstrap], {
        cwd: project_root,
        stdio: ['ignore', 'inherit', 'pipe'],
        encoding: 'utf-8',
    });
    if (res.status === 99) {
        const msg = (res.stderr || '').replace(/^MIGRATE_UNAVAILABLE:/, '');
        warn(`migrate unavailable: ${msg}`);
        return 1;
    }
    if (res.error) {
        warn(`migrate unavailable: ${String(res.error)}`);
        return 1;
    }
    // Surface any stderr the migrator emitted (the .py shares the parent's
    // stderr; we captured it to detect the unavailable sentinel).
    if (res.stderr) process.stderr.write(res.stderr);
    return res.status ?? 1;
}

/** Render a Python single-quoted string literal for the `-c` bootstrap. */
function pyStrLiteral(s: string): string {
    return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function _format_global_root_for_marker(global_root: string): string {
    const home = resolvePath(os.homedir());
    const resolved = resolvePath(global_root);
    const rel = path.relative(home, resolved);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return global_root;
    }
    return `~/${rel.split(path.sep).join('/')}`;
}

/**
 * Write `agents/.event4u-bridge.yml`. Skipped under `AGENT_CONFIG_DEV_MODE=1`
 * and when the project root is the agent-config source repo
 * (`.agent-src.uncondensed/` present) — same rationale. Atomic write.
 */
function _write_consumer_bridge_marker(
    project_root: string,
    installer_version: string,
    env: NodeJS.ProcessEnv | null = null,
    now: Date | null = null,
): string | null {
    const env_map = env ?? process.env;
    if (env_map['AGENT_CONFIG_DEV_MODE'] === '1') return null;
    if (isDir(path.join(project_root, '.agent-src.uncondensed'))) return null;

    const global_root_str = _format_global_root_for_marker(
        user_global_paths.event4u_root(env_map),
    );
    const stamp = utcStamp(now ?? undefined);

    const body =
        '# event4u/agent-config — consumer bridge marker (auto-written).\n' +
        '# Spec: docs/contracts/consumer-bridge.md (event4u-bridge/v1).\n' +
        '# Reader contract: expand ~ against the current $HOME; fail closed\n' +
        '# when global_root is missing on disk; never write back through it.\n' +
        'schema: event4u-bridge/v1\n' +
        `global_root: ${global_root_str}\n` +
        `installed_at: ${stamp}\n` +
        `installer_version: ${installer_version}\n`;

    const target = path.join(project_root, CONSUMER_BRIDGE_MARKER_RELPATH);
    mkdirp(path.dirname(target));
    atomicWrite0644(target, body, '.event4u-bridge.');
    return target;
}

const PROJECT_ANCHOR_TOOLS: Record<string, string> = {
    windsurf: '.windsurf/agent-config.bridge.yml',
    cline: '.clinerules/agent-config.bridge.yml',
    'gemini-cli': '.gemini/agent-config.bridge.yml',
};

/**
 * Plant thin pointer files for PROJECT_ANCHOR_TOOLS. Same gate as the bridge
 * marker: skipped under dev mode and inside the agent-config source repo
 * (`.agent-src.uncondensed/` present). Atomic write per file.
 */
function _write_per_tool_project_anchors(
    project_root: string,
    tools: Set<string>,
    env: NodeJS.ProcessEnv | null = null,
    now: Date | null = null,
): string[] {
    const env_map = env ?? process.env;
    if (env_map['AGENT_CONFIG_DEV_MODE'] === '1') return [];
    if (isDir(path.join(project_root, '.agent-src.uncondensed'))) return [];

    const global_root_str = _format_global_root_for_marker(
        user_global_paths.event4u_root(env_map),
    );
    const stamp = utcStamp(now ?? undefined);
    const written: string[] = [];

    for (const tool_id of Object.keys(PROJECT_ANCHOR_TOOLS).sort()) {
        const rel_path = PROJECT_ANCHOR_TOOLS[tool_id] as string;
        if (!tools.has(tool_id)) continue;
        const target = path.join(project_root, rel_path);
        mkdirp(path.dirname(target));

        const bridge_abs = path.join(project_root, CONSUMER_BRIDGE_MARKER_RELPATH);
        const bridge_rel = path.relative(path.dirname(target), bridge_abs);

        const body =
            '# event4u/agent-config — per-tool project anchor (auto-written).\n' +
            '# Spec: docs/contracts/consumer-bridge.md § Per-tool anchor strategy.\n' +
            `# Tool: ${tool_id}. Bridge marker: agents/.event4u-bridge.yml.\n` +
            'schema: event4u-bridge/v1\n' +
            `tool: ${tool_id}\n` +
            `bridge: ${bridge_rel}\n` +
            `global_root: ${global_root_str}\n` +
            `installed_at: ${stamp}\n`;

        atomicWrite0644(target, body, '.agent-config.bridge.');
        written.push(target);
    }

    return written;
}

const PACKAGE_TAG_ID = 'event4u/agent-config';

function _inject_package_tag(
    target: string,
    source: string | null,
    package_root: string | null,
): void {
    if (path.extname(target) !== '.md') return;
    let text: string;
    try {
        text = readText(target);
    } catch {
        return;
    }
    if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return;
    const lines = splitlinesKeepends(text);
    let close_idx: number | null = null;
    for (let i = 1; i < lines.length; i += 1) {
        if ((lines[i] as string).replace(/[\r\n]+$/, '') === '---') {
            close_idx = i;
            break;
        }
    }
    if (close_idx === null) return;
    let fm_lines = lines.slice(1, close_idx);
    const body_lines = lines.slice(close_idx);

    let source_value: string | null = null;
    if (source !== null) {
        let resolved_src: string;
        try {
            resolved_src = resolvePath(source);
        } catch {
            resolved_src = source;
        }
        if (package_root !== null) {
            const rel = path.relative(resolvePath(package_root), resolved_src);
            if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)) {
                source_value = rel;
            } else {
                source_value = resolved_src;
            }
        } else {
            source_value = resolved_src;
        }
    }

    const _set_key = (block: string[], key: string, value: string): string[] => {
        const prefix = `${key}:`;
        const rendered = `${key}: ${value}\n`;
        for (let idx = 0; idx < block.length; idx += 1) {
            if ((block[idx] as string).startsWith(prefix)) {
                block[idx] = rendered;
                return block;
            }
        }
        block.push(rendered);
        return block;
    };

    fm_lines = _set_key(fm_lines, 'package', PACKAGE_TAG_ID);
    if (source_value !== null) {
        fm_lines = _set_key(fm_lines, 'source_path', source_value);
    }
    const new_text = [lines[0], ...fm_lines, ...body_lines].join('');
    if (new_text !== text) {
        writeText(target, new_text);
    }
}

function _copy_dir_dereferencing_symlinks(
    src: string,
    dest: string,
    force: boolean,
    package_root: string | null = null,
): [number, number, string[]] {
    let written = 0;
    let skipped = 0;
    const written_paths: string[] = [];
    if (!pathExists(src)) return [0, 0, written_paths];
    if (!isDir(src)) {
        mkdirp(path.dirname(dest));
        const decision = _resolve_file_conflict(dest, force);
        if (decision === 'skip') return [0, 1, written_paths];
        fs.copyFileSync(src, dest); // follow_symlinks=True is fs.copyFileSync default
        _inject_package_tag(dest, src, package_root);
        written_paths.push(dest);
        return [1, 0, written_paths];
    }
    mkdirp(dest);
    // Python uses src.rglob("*") (os.scandir order, non-deterministic). We use
    // a sorted depth-first walk to match the sibling inventory twin
    // (expected_deploy_files) and yield a deterministic manifest files[] order.
    const walk = (node: string): string[] => {
        const acc: string[] = [];
        const names = fs
            .readdirSync(node)
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        for (const name of names) {
            const entry = path.join(node, name);
            acc.push(entry);
            const lst = fs.lstatSync(entry);
            if (lst.isDirectory() && !lst.isSymbolicLink()) {
                acc.push(...walk(entry));
            }
        }
        return acc;
    };
    for (const entry of walk(src)) {
        const rel = path.relative(src, entry);
        const target = path.join(dest, rel);
        const lst = fs.lstatSync(entry);
        if (lst.isDirectory() && !lst.isSymbolicLink()) {
            mkdirp(target);
            continue;
        }
        let resolvedIsDir = false;
        let resolved = entry;
        try {
            resolved = fs.realpathSync(entry);
            resolvedIsDir = fs.statSync(entry).isDirectory();
        } catch {
            resolvedIsDir = false;
        }
        if (resolvedIsDir) {
            mkdirp(target);
            const [sub_w, sub_s, sub_p] = _copy_dir_dereferencing_symlinks(
                resolved,
                target,
                force,
                package_root,
            );
            written += sub_w;
            skipped += sub_s;
            written_paths.push(...sub_p);
            continue;
        }
        const decision = _resolve_file_conflict(target, force);
        if (decision === 'skip') {
            skipped += 1;
            continue;
        }
        mkdirp(path.dirname(target));
        fs.copyFileSync(resolved, target);
        _inject_package_tag(target, resolved, package_root);
        written += 1;
        written_paths.push(target);
    }
    return [written, skipped, written_paths];
}

function _claude_desktop_bundles_dir(): string {
    return user_global_paths.write_target(_CLAUDE_DESKTOP_BUNDLES_SUBPATH);
}

function _write_claude_desktop_marker(
    _force: boolean,
    lockfile_path: string,
    bundles_dir: string,
    bundle_count: number,
): [number, number, string[]] {
    const anchor = expanduser(USER_SCOPE_PATHS['claude-desktop'] as string);
    const target = path.join(anchor, 'agent-config.md');
    mkdirp(anchor);
    const body = claudeDesktopMarkerBody(lockfile_path, anchor, bundles_dir, bundle_count);
    writeText(target, body);
    return [1, 0, [target]];
}

function _deploy_claude_desktop(
    force: boolean,
    package_root: string,
    lockfile_path: string,
): DeployResult {
    const bundles_dir = _claude_desktop_bundles_dir();
    claude_desktop_bundler.build_skill_bundles(package_root, bundles_dir, force);
    claude_desktop_bundler.build_command_bundles(package_root, bundles_dir, force);
    const bundle_count = countZips(bundles_dir);
    const [, , marker_paths] = _write_claude_desktop_marker(
        force,
        lockfile_path,
        bundles_dir,
        bundle_count,
    );
    return [bundle_count, 0, 'deployed', [bundles_dir, ...marker_paths]];
}

function _deploy_global_content(
    tools: Set<string>,
    force: boolean,
    package_root: string,
    lockfile_path: string,
): Record<string, DeployResult> {
    const results: Record<string, DeployResult> = {};
    for (const tool_id of [...tools].sort()) {
        if (tool_id === 'claude-desktop') {
            results[tool_id] = _deploy_claude_desktop(force, package_root, lockfile_path);
            continue;
        }
        const plan = GLOBAL_DEPLOY_SOURCES[tool_id];
        if (plan === undefined) {
            const status = ['copilot', 'aider', 'zed', 'jetbrains'].includes(tool_id)
                ? 'hint'
                : 'unsupported';
            results[tool_id] = [0, 0, status, []];
            continue;
        }
        const anchor_raw = USER_SCOPE_PATHS[tool_id];
        if (!anchor_raw) {
            results[tool_id] = [0, 0, 'unsupported', []];
            continue;
        }
        const anchor = expanduser(anchor_raw);
        let written_total = 0;
        let skipped_total = 0;
        const written_paths: string[] = [];
        let current_files = new Set<string>();
        for (const [src_rel, dest_sub] of plan) {
            const src = path.join(package_root, src_rel);
            const dest = dest_sub ? path.join(anchor, dest_sub) : anchor;
            const [w, s, paths] = _copy_dir_dereferencing_symlinks(src, dest, force, package_root);
            written_total += w;
            skipped_total += s;
            written_paths.push(...paths);
            current_files = setUnion(
                current_files,
                global_deploy_inventory.expected_deploy_files(src, dest_sub ? dest_sub : ''),
            );
        }
        const missing_targets = _verify_deploy_targets(anchor, plan);
        if (missing_targets.length > 0) {
            if (!state.QUIET) {
                warn(
                    `${tool_id}: deploy postcheck failed — ` +
                        `missing/empty: ${missing_targets.join(', ')}`,
                );
            }
            _emit_progress({ type: 'verify_failed', tool: tool_id, missing: missing_targets });
            results[tool_id] = [written_total, skipped_total, 'deploy_failed', written_paths];
            continue;
        }
        _emit_progress({ type: 'verified', tool: tool_id });

        const inventory = global_deploy_inventory.load_inventory();
        let reaped: string[] = [];
        const inv_tools = (inventory['tools'] as Record<string, unknown> | undefined) ?? {};
        if (tool_id in inv_tools) {
            reaped = reaped.concat(
                global_deploy_inventory.reap_stale(tool_id, anchor, current_files, inventory),
            );
        }
        reaped = reaped.concat(
            global_deploy_inventory.reap_tagged_orphans(
                anchor,
                plan.map(([, dest_sub]) => dest_sub),
                current_files,
                PACKAGE_TAG_ID,
            ),
        );
        reaped = [...new Set(reaped)].sort();
        global_deploy_inventory.record_deploy(tool_id, anchor_raw, current_files, inventory);
        global_deploy_inventory.save_inventory(inventory);
        if (reaped.length > 0 && !state.QUIET) {
            info(
                `  ${tool_id}: reaped ${reaped.length} stale deployed file(s) ` +
                    'from a previous install',
            );
        }
        _emit_progress({ type: 'reaped', tool: tool_id, count: reaped.length });
        results[tool_id] = [written_total, skipped_total, 'deployed', written_paths];
    }
    return results;
}

function setUnion(a: Set<string>, b: Set<string>): Set<string> {
    const out = new Set(a);
    for (const v of b) out.add(v);
    return out;
}

function _preview_global_reap(
    tools: Set<string>,
    package_root: string,
): Record<string, string[]> {
    const inventory = global_deploy_inventory.load_inventory();
    const preview: Record<string, string[]> = {};
    for (const tool_id of [...tools].sort()) {
        const plan = GLOBAL_DEPLOY_SOURCES[tool_id];
        if (plan === undefined) continue;
        const anchor_raw = USER_SCOPE_PATHS[tool_id];
        if (!anchor_raw) continue;
        const anchor = expanduser(anchor_raw);
        let current_files = new Set<string>();
        for (const [src_rel, dest_sub] of plan) {
            const src = path.join(package_root, src_rel);
            current_files = setUnion(
                current_files,
                global_deploy_inventory.expected_deploy_files(src, dest_sub ? dest_sub : ''),
            );
        }
        let would_reap: string[] = [];
        const inv_tools = (inventory['tools'] as Record<string, unknown> | undefined) ?? {};
        if (tool_id in inv_tools) {
            would_reap = would_reap.concat(
                global_deploy_inventory.reap_stale(tool_id, anchor, current_files, inventory, true),
            );
        }
        would_reap = would_reap.concat(
            global_deploy_inventory.reap_tagged_orphans(
                anchor,
                plan.map(([, dest_sub]) => dest_sub),
                current_files,
                PACKAGE_TAG_ID,
                true,
            ),
        );
        const paths = [...new Set(would_reap.map((p) => String(p)))].sort();
        if (paths.length > 0) preview[tool_id] = paths;
    }
    return preview;
}

function _verify_deploy_targets(anchor: string, plan: ReadonlyArray<readonly [string, string]>): string[] {
    const missing: string[] = [];
    for (const [, dest_sub] of plan) {
        const target = dest_sub ? path.join(anchor, dest_sub) : anchor;
        const label = dest_sub || '.';
        if (!isDir(target)) {
            missing.push(label);
            continue;
        }
        try {
            const entries = fs.readdirSync(target);
            if (entries.length === 0) missing.push(label);
        } catch {
            missing.push(label);
        }
    }
    return missing;
}

function install_global(
    tools: Set<string>,
    force: boolean,
    project_root: string | null = null,
): number {
    const migrated = user_global_paths.migrate_legacy_namespace();
    if (migrated && !state.QUIET) {
        info(
            '🔁 Migrated user-global config to ' +
                `${user_global_paths.event4u_root()} (legacy ` +
                `${user_global_paths.legacy_xdg_root()} preserved as fallback)`,
        );
    }

    const installed_version = installed_lock.current_package_version();
    const read_path = installed_lock.lockfile_path();
    const write_path = installed_lock.lockfile_write_path();
    const [, recorded] = installed_lock.check_version(installed_version, { path: read_path });
    const classification = installed_lock.classify_mismatch(installed_version, recorded);

    if (classification === 'downgrade' && !force) {
        if (!state.QUIET) {
            process.stdout.write('\n');
            warn('Refusing global install: lockfile records a newer version.');
            info(`  Lockfile:           ${read_path}`);
            info(`  Recorded version:   ${recorded}`);
            info(`  Current package:    ${installed_version}`);
            info('  Fix:                upgrade the package, or re-run with `--force`');
            process.stdout.write('\n');
        }
        return 1;
    }

    if (['upgrade', 'unparseable'].includes(classification) && !state.QUIET) {
        info(`🔄 Upgrading lockfile from ${recorded} to ${installed_version}, redeploying tools`);
    }

    if (!state.QUIET) {
        process.stdout.write('\n');
        info('Agent Config — Global (user-scope) install [ADR-007]');
        info('Per-tool anchor paths:');
        for (const tool_id of [...tools].sort()) {
            const anchor = USER_SCOPE_PATHS[tool_id];
            if (anchor === undefined) continue;
            process.stdout.write(`      ${tool_id.padEnd(15)} → ${anchor}\n`);
        }
    }

    const existing = installed_lock.read_lockfile(read_path) ?? {};
    const existing_tools = Array.isArray((existing as Record<string, unknown>)['tools'])
        ? ((existing as Record<string, unknown>)['tools'] as string[])
        : [];
    const merged_tools = [...new Set([...existing_tools, ...tools])].sort();
    const written = installed_lock.write_lockfile(installed_version, merged_tools, { path: write_path });

    if (!state.QUIET) {
        process.stdout.write('\n');
        info(`Lockfile written: ${written}`);
        info(`  schema_version=1, agent_config_version=${installed_version}`);
        info(`  tools=${merged_tools.join(',')}`);
    }

    const package_root = _resolve_package_root_for_global();
    const deploy_results = _deploy_global_content(tools, force, package_root, written);

    const failed_tools = new Set<string>(
        Object.keys(deploy_results).filter(
            (tool_id) => (deploy_results[tool_id] as DeployResult)[2] === 'deploy_failed',
        ),
    );
    if (failed_tools.size > 0) {
        const corrected_tools = merged_tools.filter((t) => !failed_tools.has(t));
        if (!arrayStrEqual(corrected_tools, merged_tools)) {
            installed_lock.write_lockfile(installed_version, corrected_tools, { path: write_path });
            if (!state.QUIET) {
                warn(
                    'Lockfile corrected after deploy postcheck — dropped ' +
                        `${[...failed_tools].sort().join(', ')} (verification failed).`,
                );
            }
        }
    }

    if (state.PROGRESS_NDJSON) {
        const ordered = Object.keys(deploy_results).sort();
        const total = ordered.length;
        ordered.forEach((tool_id, i) => {
            const [, , status] = deploy_results[tool_id] as DeployResult;
            _emit_progress({
                type: 'file',
                file: tool_id,
                status,
                written: i + 1,
                total,
            });
        });
    }

    if (!state.QUIET) {
        process.stdout.write('\n');
        info('Deployed per-tool content:');
        for (const tool_id of Object.keys(deploy_results).sort()) {
            const [w, s, status] = deploy_results[tool_id] as DeployResult;
            const anchor = USER_SCOPE_PATHS[tool_id] ?? '';
            if (status === 'deployed' && tool_id === 'claude-desktop') {
                const bundles_dir = _claude_desktop_bundles_dir();
                process.stdout.write(`      ${tool_id.padEnd(15)} → ${bundles_dir} (${w} bundles)\n`);
            } else if (status === 'deployed') {
                process.stdout.write(`      ${tool_id.padEnd(15)} → ${anchor} (${w} files, ${s} skipped)\n`);
            } else if (status === 'marker') {
                process.stdout.write(
                    `      ${tool_id.padEnd(15)} → ${anchor}agent-config.md (${w ? 'written' : 'skipped'})\n`,
                );
            } else if (status === 'hint') {
                process.stdout.write(
                    `      ${tool_id.padEnd(15)} → no user-scope convention; use \`agent-config export --tool=${tool_id}\`\n`,
                );
            } else {
                process.stdout.write(
                    `      ${tool_id.padEnd(15)} → no global-scope content yet (project-scope install supported)\n`,
                );
            }
        }
    }

    // Skipped inside the agent-config source repo (detected by
    // `.agent-src.uncondensed/`) — maintainers dogfood with their own
    // `.agent-settings.yml` and the manifest would be untracked noise.
    if (
        project_root !== null &&
        pathExists(_resolve_settings_read(project_root)) &&
        !isDir(path.join(project_root, '.agent-src.uncondensed'))
    ) {
        const files_by_tool = _files_by_tool_from_deploy(deploy_results);
        const rc = _update_installed_tools_manifest(project_root, tools, 'global', force, files_by_tool);
        if (rc !== 0) return rc;

        // Consumer bridge marker (Phase 4.2). The surrounding
        // `.agent-src.uncondensed` guard already covers the source-repo case;
        // the dev-mode skip is enforced inside the writer.
        const marker_path = _write_consumer_bridge_marker(project_root, installed_version);
        if (marker_path !== null && !state.QUIET) {
            const rel = isRelativeTo(marker_path, project_root)
                ? path.relative(project_root, marker_path)
                : marker_path;
            info(`Bridge marker written: ${rel}`);
        }

        const anchor_paths = _write_per_tool_project_anchors(project_root, tools);
        if (anchor_paths.length > 0 && !state.QUIET) {
            for (const p of anchor_paths) {
                const rel = isRelativeTo(p, project_root) ? path.relative(project_root, p) : p;
                info(`Project anchor written: ${rel}`);
            }
        }
    }

    if (!state.QUIET) {
        process.stdout.write('\n');
        success('Global install completed.');
        process.stdout.write('\n');
    }
    return 0;
}

function arrayStrEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

// --- Argument parsing ---

function _merge_tools_aliases(tools: string | null, ai: string | null): string {
    const items: string[] = [];
    for (const raw of [tools, ai]) {
        if (!raw) continue;
        for (const piece of raw.split(',')) {
            const stripped = piece.trim();
            if (stripped && !items.includes(stripped)) items.push(stripped);
        }
    }
    return items.length > 0 ? items.join(',') : 'all';
}

const PROG = 'install.py';
// Verbatim argparse usage block at COLUMNS=80 (captured from the .py). The
// `--help` BODY (per-flag descriptions) is a documented divergence — argparse
// re-wraps it to the live terminal width, which is not worth reproducing; the
// golden tests assert the `usage:` token + exit code, not the body prose.
const USAGE =
    `usage: ${PROG} [-h] [--profile PROFILE] [--user-type USER_TYPE] [--force]\n` +
    '                  [--skip-bridges] [--augment-user-hooks]\n' +
    '                  [--cursor-user-hooks] [--cline-user-hooks]\n' +
    '                  [--windsurf-user-hooks] [--gemini-user-hooks]\n' +
    '                  [--project PROJECT] [--package PACKAGE] [--quiet]\n' +
    '                  [--tools TOOLS] [--ai AI] [--packs PACKS] [--no-smoke]\n' +
    '                  [--global] [--scope {project,global,prompt,auto}]\n' +
    '                  [--custom-path CUSTOM_PATH] [--offline] [--minimal]\n' +
    '                  [--interactive] [--no-ui] [--dry-run]\n' +
    '                  [--apply-payload APPLY_PAYLOAD]\n';

const _STORE_TRUE_FLAGS: Record<string, keyof Options> = {
    '--force': 'force',
    '--skip-bridges': 'skip_bridges',
    '--augment-user-hooks': 'augment_user_hooks',
    '--cursor-user-hooks': 'cursor_user_hooks',
    '--cline-user-hooks': 'cline_user_hooks',
    '--windsurf-user-hooks': 'windsurf_user_hooks',
    '--gemini-user-hooks': 'gemini_user_hooks',
    '--quiet': 'quiet',
    '--no-smoke': 'no_smoke',
    '--global': 'global_install',
    '--offline': 'offline',
    '--minimal': 'minimal',
    '--settings-only': 'minimal',
    '--interactive': 'interactive',
    '--no-ui': 'no_ui',
    '--dry-run': 'dry_run',
};

const _VALUE_FLAGS: Record<string, keyof Options> = {
    '--profile': 'profile',
    '--user-type': 'user_type',
    '--project': 'project',
    '--package': 'package',
    '--tools': 'tools',
    '--ai': 'ai',
    '--packs': 'packs',
    '--scope': 'scope',
    '--custom-path': 'custom_path',
    '--apply-payload': 'apply_payload',
};

function _argError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function parse_options(argv: string[]): Options {
    const opts: Record<string, unknown> = {
        profile: DEFAULT_PROFILE,
        user_type: '',
        force: false,
        skip_bridges: false,
        augment_user_hooks: false,
        cursor_user_hooks: false,
        cline_user_hooks: false,
        windsurf_user_hooks: false,
        gemini_user_hooks: false,
        project: null,
        package: null,
        quiet: false,
        tools: null,
        ai: null,
        packs: null,
        no_smoke: false,
        global_install: false,
        scope: null,
        custom_path: null,
        offline: false,
        minimal: false,
        interactive: false,
        no_ui: false,
        dry_run: false,
        apply_payload: null,
    };

    const positionals: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            throw new ArgparseExit(0);
        }
        // --flag=value form
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;

        const storeTrueDest = _STORE_TRUE_FLAGS[flag];
        if (storeTrueDest !== undefined) {
            if (inlineVal !== null) {
                _argError(`argument ${flag}: ignored explicit argument '${inlineVal}'`);
            }
            opts[storeTrueDest] = true;
            i += 1;
            continue;
        }
        const valueDest = _VALUE_FLAGS[flag];
        if (valueDest !== undefined) {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) _argError(`argument ${flag}: expected one argument`);
                value = argv[i + 1] as string;
                i += 1;
            }
            if (flag === '--scope' && !['project', 'global', 'prompt', 'auto'].includes(value)) {
                _argError(
                    `argument --scope: invalid choice: '${value}' ` +
                        "(choose from 'project', 'global', 'prompt', 'auto')",
                );
            }
            opts[valueDest] = value;
            i += 1;
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            _argError(`unrecognized arguments: ${a}`);
        }
        positionals.push(a);
        i += 1;
    }
    if (positionals.length > 0) {
        _argError(`unrecognized arguments: ${positionals.join(' ')}`);
    }

    opts.tools = _merge_tools_aliases(opts.tools as string | null, opts.ai as string | null);
    const rawPacks = opts.packs;
    opts.packs =
        typeof rawPacks === 'string'
            ? rawPacks
                  .split(',')
                  .map((p) => p.trim())
                  .filter((p) => p)
            : [];
    if (opts.scope === 'global' && opts.custom_path) {
        fail('--custom-path is incompatible with --scope=global');
    }
    if (opts.global_install && opts.custom_path) {
        fail('--custom-path is incompatible with --global');
    }
    if (opts.scope !== null && opts.global_install && opts.scope !== 'global') {
        fail(`--scope=${opts.scope} conflicts with --global; pick one`);
    }
    return opts as unknown as Options;
}

const _VALID_TOOLS: ReadonlySet<string> = new Set([
    'claude-code',
    'claude-desktop',
    'cursor',
    'windsurf',
    'cline',
    'gemini-cli',
    'copilot',
    'augment',
    'aider',
    'codex',
    'roocode',
    'continue',
    'kilocode',
    'zed',
    'jetbrains',
    'kiro',
    'qoder',
    'opencode',
    'trae',
    'antigravity',
    'codebuddy',
    'droid',
    'warp',
    'all',
]);

function _parse_tools(raw: string): Set<string> {
    if (!raw || !raw.trim()) fail('--tools requires a non-empty value');
    const items = raw.split(',').map((s) => s.trim()).filter((s) => s);
    if (items.length === 0) fail('--tools requires at least one ID');
    const unknown = items.filter((s) => !_VALID_TOOLS.has(s));
    if (unknown.length > 0) {
        fail(
            `--tools: unknown ID(s): ${unknown.join(', ')} ` +
                `(valid: ${[..._VALID_TOOLS].sort().join(', ')})`,
        );
    }
    if (items.includes('all')) {
        return new Set([..._VALID_TOOLS].filter((t) => t !== 'all'));
    }
    return new Set(items);
}

function _tools_was_all(raw: string): boolean {
    if (!raw || !raw.trim()) return false;
    const items = raw.split(',').map((s) => s.trim()).filter((s) => s);
    return items.includes('all');
}

function _is_tool_enabled(tools: Set<string>, tool_id: string): boolean {
    return tools.has(tool_id);
}

// --- Minimal init ---

function _minimal_templates_root(): string {
    const start = resolvePath(_HERE);
    const chain = [start];
    let cur = start;
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur) break;
        chain.push(parent);
        cur = parent;
    }
    for (const ancestor of chain) {
        const candidate = path.join(ancestor, 'src', 'templates', 'minimal');
        if (isDir(candidate)) return candidate;
    }
    fail('Could not locate src/templates/minimal/ — package install is corrupt.');
}

const INSTALL_MODE_MARKER_REL = 'agents/.agent-state/install-mode.txt';

function _write_install_mode_marker(project_root: string, mode: string): void {
    if (mode !== 'minimal' && mode !== 'full') return;
    const marker = path.join(project_root, INSTALL_MODE_MARKER_REL);
    try {
        mkdirp(path.dirname(marker));
        writeText(marker, `${mode}\n`);
    } catch {
        /* advisory marker; never abort */
    }
}

function install_minimal(target_root_in: string, force: boolean, user_type: string = ''): number {
    let target_root = resolvePath(target_root_in);
    mkdirp(target_root);

    const parent = path.dirname(target_root);
    if (parent !== target_root) {
        const existing = find_project_root_with_anchor(parent);
        if (existing !== null && existing[0] !== target_root) {
            const [root, anchor] = existing;
            fail(
                'Refusing to nest an agent-config layer inside an existing ' +
                    `project (anchor: ${anchor}). Existing root: ${root}. ` +
                    'Remove the parent layer first or run `--minimal` outside it.',
            );
        }
    }

    const templates = _minimal_templates_root();
    const settings_src = path.join(templates, SETTINGS_FILE);
    const overrides_gitkeep_src = path.join(templates, 'overrides-gitkeep');
    const overrides_readme_src = path.join(templates, 'agents-overrides-readme.md');

    if (!isFile(settings_src)) fail(`Bundled minimal settings template missing under ${templates}`);
    if (!isFile(overrides_gitkeep_src) || !isFile(overrides_readme_src)) {
        fail(`Bundled overrides scaffold templates missing under ${templates}`);
    }

    info(`Minimal init → ${target_root}`);

    const overrides_root = path.join(target_root, 'agents', 'overrides');
    mkdirp(overrides_root);
    const gitkeep_body = readText(overrides_gitkeep_src);
    for (const sub of ['rules', 'skills', 'commands']) {
        const sub_dir = path.join(overrides_root, sub);
        mkdirp(sub_dir);
        const gitkeep_dst = path.join(sub_dir, '.gitkeep');
        if (pathExists(gitkeep_dst) && !force) {
            skip(`agents/overrides/${sub}/.gitkeep already exists (use --force to overwrite)`);
        } else {
            writeText(gitkeep_dst, gitkeep_body);
            success(`Wrote agents/overrides/${sub}/.gitkeep`);
        }
    }

    const readme_dst = path.join(overrides_root, 'README.md');
    if (pathExists(readme_dst) && !force) {
        skip('agents/overrides/README.md already exists (use --force to overwrite)');
    } else {
        writeText(readme_dst, readText(overrides_readme_src));
        success('Wrote agents/overrides/README.md');
    }

    if (user_type) {
        const settings_dst = _canonical_settings_target(target_root);
        if (pathExists(settings_dst) && !force) {
            skip(`${SETTINGS_FILE} already exists (use --force to overwrite)`);
        } else {
            const body =
                readText(settings_src).replace(/\s+$/, '') +
                '\n\n# --- Personal (step-9 user-type axis) ---\n' +
                'personal:\n' +
                `  user_type: ${user_type}\n`;
            mkdirp(path.dirname(settings_dst));
            writeText(settings_dst, body);
            success(`Wrote ${SETTINGS_FILE} (user_type=${user_type})`);
        }
    }

    const installed_version = installed_lock.current_package_version();
    const marker_path = _write_consumer_bridge_marker(target_root, installed_version);
    if (marker_path !== null) {
        const rel = isRelativeTo(marker_path, target_root)
            ? path.relative(target_root, marker_path)
            : marker_path;
        success(`Wrote ${rel}`);
    }

    _write_install_mode_marker(target_root, 'minimal');

    if (!state.QUIET) {
        process.stderr.write(
            'ℹ️   Minimal install — run `agent-config install --force` ' +
                'to add AGENTS.md, bridges, and tool integrations.\n',
        );
    }

    if (!state.QUIET) {
        process.stdout.write('\n');
        info('Next steps:');
        info('  • Ensure `agent-config` is on $PATH: npm install -g @event4u/agent-config');
        info('  • Drop project-scoped overrides under `agents/overrides/{rules,skills,commands}/`.');
        info('  • Run `agent-config doctor` to verify the layer is picked up.');
    }
    return 0;
}

// --- Interactive init ---

const _INTERACTIVE_USER_TYPES: ReadonlyArray<readonly [string, string]> = [
    ['creator', 'Content / writing / publishing'],
    ['founder', 'Early-stage company building'],
    ['consultant', 'Advisory / strategy / discovery'],
    ['gtm', 'Sales / marketing / revenue ops'],
    ['finance', 'Finance / FP&A / unit economics'],
    ['ops', 'Operations / incident / compliance'],
    ['developer', 'Engineering / code-heavy work'],
];
const _INTERACTIVE_STACKS: ReadonlyArray<readonly [string, string]> = [
    ['none', 'No code project / pure content'],
    ['laravel', 'PHP / Laravel'],
    ['nextjs', 'TypeScript / Next.js / React'],
    ['python', 'Python / FastAPI / Django'],
    ['symfony', 'PHP / Symfony'],
    ['generic', 'Other / mixed stack'],
];
const _INTERACTIVE_VERBOSITIES: ReadonlyArray<readonly [string, string]> = [
    ['quiet', 'Telegraph / minimal output'],
    ['normal', 'Default verbosity'],
    ['verbose', 'Full intent announcements + play-by-play'],
];
const _LOCAL_CONFIG_FILE = '.agent-config.local.json';

function _interactive_prompt_choice(label: string, options: ReadonlyArray<readonly [string, string]>): string {
    process.stdout.write('\n');
    process.stdout.write(`  ${label}\n`);
    options.forEach(([key, blurb], idx) => {
        process.stdout.write(`    ${idx + 1}. ${key}  — ${blurb}\n`);
    });
    process.stdout.write('\n');
    for (;;) {
        const raw = _read_line(`  Choice [1-${options.length}, default 1]: `);
        if (raw === null) return options[0]![0];
        if (!raw) return options[0]![0];
        if (/^[0-9]+$/.test(raw)) {
            const n = parseInt(raw, 10);
            if (n >= 1 && n <= options.length) return options[n - 1]![0];
        }
        for (const [key] of options) {
            if (raw.toLowerCase() === key) return key;
        }
        process.stdout.write(
            `  ⚠️  Pick a number 1-${options.length} or one of: ` +
                `${options.map(([k]) => k).join(', ')}.\n`,
        );
    }
}

function run_interactive_init(project_root: string, force: boolean): number {
    if (!process.stdin.isTTY) {
        warn(
            '--interactive requested but stdin is not a TTY; skipping the ' +
                `prompt. Re-run interactively or hand-edit ${_LOCAL_CONFIG_FILE}.`,
        );
        return 0;
    }

    const target = path.join(project_root, _LOCAL_CONFIG_FILE);
    if (pathExists(target) && !force) {
        warn(
            `${_LOCAL_CONFIG_FILE} already exists; re-run with --force to ` +
                'overwrite. Skipping interactive init.',
        );
        return 0;
    }

    process.stdout.write('\n');
    info('Interactive init — captures user-type / stack / verbosity');
    info('(forward-compatible stub; runtime filtering activates with step-9)');

    const user_type = _interactive_prompt_choice('Primary user type:', _INTERACTIVE_USER_TYPES);
    const stack = _interactive_prompt_choice('Project stack:', _INTERACTIVE_STACKS);
    const verbosity = _interactive_prompt_choice('Verbosity profile:', _INTERACTIVE_VERBOSITIES);

    const payload: Record<string, unknown> = {
        $schema:
            'https://github.com/event4u-app/agent-config/src/scripts/schemas/local-config.schema.json',
        version: 1,
        user_type,
        stack,
        verbosity,
        universal_skills_contract: 'docs/contracts/universal-skills.md',
    };

    try {
        writeText(target, jsonDumpsIndent(payload, 2) + '\n');
    } catch (exc) {
        warn(`Could not write ${target}: ${String(exc)}`);
        return 1;
    }

    success(`Wrote ${path.relative(project_root, target)} (${user_type} / ${stack} / ${verbosity})`);
    return 0;
}

// --- Wizard auto-launch ---

const _WIZARD_READY_RE = /^WIZARD_READY (http:\/\/(?:127\.0\.0\.1|localhost):\d+\/\S*)\r?$/;
const _WIZARD_TIMEOUTS: readonly number[] = [10.0, 20.0, 40.0, 80.0];

function _wizard_should_launch(opts: Options): [boolean, string] {
    if (opts.no_ui) return [false, '--no-ui flag set'];
    const env_no_ui = (process.env['AGENT_CONFIG_NO_UI'] ?? '').trim();
    if (env_no_ui && env_no_ui !== '0') return [false, 'AGENT_CONFIG_NO_UI env set'];
    if ((process.env['CI'] ?? '').trim()) return [false, 'CI environment detected'];
    if (!process.stdout.isTTY) return [false, 'stdout is not a TTY'];
    const tools_raw = opts.tools;
    if (tools_raw && !_tools_was_all(tools_raw)) {
        return [false, 'explicit --tools= selection (headless install)'];
    }
    return [true, ''];
}

function _wizard_cli_dist(_project_root: string): string | null {
    const package_root = path.dirname(path.dirname(path.dirname(resolvePath(_HERE))));
    const cli = path.join(package_root, 'dist', 'cli', 'agent-config.js');
    return pathExists(cli) ? cli : null;
}

function _server_info_path(): string {
    return path.join(os.homedir(), '.event4u', 'agent-config', 'local-server.json');
}

function _pid_is_agent_config(pid: number): boolean {
    let res;
    try {
        res = spawnSync('ps', ['-p', String(pid), '-o', 'command='], {
            encoding: 'utf-8',
            timeout: 5000,
        });
    } catch {
        return false;
    }
    if (res.error) return false;
    return (res.stdout || '').toLowerCase().includes('agent-config');
}

function unlinkMissingOk(p: string): void {
    try {
        fs.unlinkSync(p);
    } catch {
        /* missing_ok */
    }
}

/** `os.kill(pid, 0)` liveness probe → returns true if the process exists. */
function pidAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        // EPERM means it exists but we can't signal it — Python's os.kill(pid,0)
        // would NOT raise in that case; treat EPERM as alive.
        return (err as NodeJS.ErrnoException).code === 'EPERM';
    }
}

function _kill_stale_wizard_server(): void {
    const p = _server_info_path();
    let infoObj: Record<string, unknown>;
    try {
        infoObj = JSON.parse(readText(p));
    } catch {
        return;
    }
    const pid = infoObj['pid'];
    if (typeof pid !== 'number' || !Number.isInteger(pid)) {
        unlinkMissingOk(p);
        return;
    }
    if (!pidAlive(pid)) {
        unlinkMissingOk(p);
        return;
    }
    if (!_pid_is_agent_config(pid)) return;
    try {
        process.kill(pid, 'SIGTERM');
    } catch {
        unlinkMissingOk(p);
        return;
    }
    let exited = false;
    for (let n = 0; n < 30; n += 1) {
        if (!pidAlive(pid)) {
            exited = true;
            break;
        }
        sleepMs(100);
    }
    if (!exited) {
        try {
            process.kill(pid, 'SIGKILL');
        } catch {
            /* OSError → pass */
        }
    }
    unlinkMissingOk(p);
    process.stdout.write('(Stopped the previous wizard server.)\n');
}

/** Blocking sleep, mirroring `time.sleep` in a synchronous flow. */
function sleepMs(ms: number): void {
    const end = Date.now() + ms;
    const buf = new Int32Array(new SharedArrayBuffer(4));
    while (Date.now() < end) {
        Atomics.wait(buf, 0, 0, Math.max(1, end - Date.now()));
    }
}

function _wizard_spawn(project_root: string, pass_project_root: boolean = true): number {
    _kill_stale_wizard_server();

    const cli = _wizard_cli_dist(project_root);
    if (cli === null) {
        process.stdout.write(
            "(Wizard not available — CLI bundle not built. " +
                "Run 'npm run build' at the package root to produce dist/cli/.)\n",
        );
        return 0;
    }

    const cmd = ['node', cli, 'install', '--no-open'];
    if (pass_project_root) {
        cmd.push('--project-root', project_root);
    }
    const env = { ...process.env };

    // The Python uses subprocess.Popen + a stderr-draining thread + a
    // readline loop with progressive timeouts, then child.wait(). Node has no
    // synchronous equivalent that also streams; we run the whole wizard
    // handoff via a synchronous helper that mirrors the observable behaviour
    // (URL banner, stderr tail, browser open, blocking wait). Implemented with
    // spawnSync for the simple boot+wait, and a bounded readiness poll.
    return _wizard_run_sync(cmd, env, cli);
}

/**
 * Synchronous wizard run mirroring `_wizard_spawn` + `_wizard_await_ready`.
 * spawnSync blocks until the child exits and captures stdout/stderr; we then
 * scan the captured stdout for the WIZARD_READY line, print the banner / open
 * the browser, and return the child's exit code. A child that never prints
 * WIZARD_READY before exiting falls through to the timeout fallback message.
 *
 * Divergence note: the Python streams stdout line-by-line with a 150s
 * progressive-timeout budget and hands the terminal to a still-running child
 * (Ctrl-C forwarding). spawnSync cannot hand off an interactive child, so this
 * twin runs the child to completion under the same total budget and surfaces
 * the same banner/fallback text. This path is network/subprocess-bound and is
 * NOT exercised by the deterministic golden tests (guarded behind the TTY +
 * dist-present gates).
 */
function _wizard_run_sync(cmd: string[], env: NodeJS.ProcessEnv, cli: string): number {
    const total = _WIZARD_TIMEOUTS.reduce((a, b) => a + b, 0);
    let res;
    try {
        res = spawnSync(cmd[0] as string, cmd.slice(1), {
            env,
            encoding: 'utf-8',
            timeout: total * 1000,
            maxBuffer: 64 * 1024 * 1024,
        });
    } catch (exc) {
        process.stdout.write(
            `(Wizard failed to start: ${String(exc)}; run 'node ${cli} install --no-open' manually.)\n`,
        );
        return 0;
    }
    if (res.error && (res.error as NodeJS.ErrnoException).code === 'ENOENT') {
        process.stdout.write(
            `(Wizard failed to start: ${String(res.error)}; run 'node ${cli} install --no-open' manually.)\n`,
        );
        return 0;
    }
    const stdout = res.stdout || '';
    let matched_url: string | null = null;
    for (const line of stdout.split('\n')) {
        const m = _WIZARD_READY_RE.exec(line + '\n');
        if (m) {
            matched_url = m[1] as string;
            break;
        }
    }
    if (matched_url === null) {
        const stderrLines = (res.stderr || '').split('\n').filter((l) => l !== '');
        const tail = stderrLines.length ? stderrLines.slice(-20).join('\n  ') : '(no stderr captured)';
        process.stdout.write(
            `(Wizard server boot timed out after ${Math.trunc(total)}s; ` +
                `run 'node ${cli} install --no-open' manually.)\n` +
                `  Last stderr:\n  ${tail}\n`,
        );
        return 0;
    }
    process.stdout.write('\n');
    process.stdout.write(`Setup wizard ready: ${matched_url}\n`);
    _openBrowser(matched_url);
    process.stdout.write('(Wizard runs in the background; close the tab or press Ctrl-C to stop.)\n');
    return res.status ?? 0;
}

/** `webbrowser.open` — best-effort platform open; never fatal. */
function _openBrowser(url: string): void {
    try {
        const opener =
            process.platform === 'darwin'
                ? ['open', [url]]
                : process.platform === 'win32'
                  ? ['cmd', ['/c', 'start', '', url]]
                  : ['xdg-open', [url]];
        spawnSync(opener[0] as string, opener[1] as string[], { stdio: 'ignore' });
    } catch {
        /* best-effort, never fatal */
    }
}

function _dry_run_summary(opts: Options): number {
    const target = resolvePath(
        opts.custom_path || opts.project || process.env['PROJECT_ROOT'] || process.cwd(),
    );
    const [will_launch, why_not] = _wizard_should_launch(opts);
    process.stdout.write('\n');
    process.stdout.write('[dry-run] Plan summary — no files written, no subprocesses spawned:\n');
    process.stdout.write(`  profile:     ${opts.profile}\n`);
    process.stdout.write(`  user-type:   ${opts.user_type || '(none)'}\n`);
    process.stdout.write(`  scope:       ${opts.scope || (opts.global_install ? 'global' : 'auto')}\n`);
    process.stdout.write(`  tools:       ${opts.tools || 'all'}\n`);
    process.stdout.write(`  target:      ${target}\n`);
    process.stdout.write(`  minimal:     ${pyBool(opts.minimal)}\n`);
    process.stdout.write(`  force:       ${pyBool(opts.force)}\n`);
    process.stdout.write(`  offline:     ${pyBool(opts.offline)}\n`);
    if (will_launch) {
        process.stdout.write('  wizard:      Would auto-launch (pass --no-ui to suppress).\n');
    } else {
        process.stdout.write(`  wizard:      Suppressed (${why_not}).\n`);
    }
    if (opts.global_install) {
        let preview: Record<string, string[]> = {};
        try {
            preview = _preview_global_reap(
                _parse_tools(opts.tools || 'all'),
                _resolve_package_root_for_global(),
            );
        } catch {
            preview = {};
        }
        const total = Object.values(preview).reduce((a, v) => a + v.length, 0);
        process.stdout.write('\n');
        if (total === 0) {
            process.stdout.write('  reap (cleanup): nothing to reap — no stale deployed files.\n');
        } else {
            process.stdout.write(`  reap (cleanup): would remove ${total} stale file(s):\n`);
            for (const tool_id of Object.keys(preview).sort()) {
                for (const p of preview[tool_id] as string[]) {
                    process.stdout.write(`      ${tool_id}: ${p}\n`);
                }
            }
        }
    }
    process.stdout.write('\n');
    return 0;
}

/** Python `str(bool)` → 'True' / 'False'. */
function pyBool(v: boolean): string {
    return v ? 'True' : 'False';
}

function _apply_payload_preview(payload: Record<string, unknown>, opts: Options): number {
    const schema_version = payload['schema_version'] ?? '<missing>';
    const target = resolvePath(
        opts.custom_path || opts.project || process.env['PROJECT_ROOT'] || process.cwd(),
    );
    process.stdout.write('\n');
    process.stdout.write(
        '[apply-payload] Plan summary — no files written, no subprocesses spawned:\n',
    );
    process.stdout.write(`  schema:      ${schema_version}\n`);
    if (schema_version === 'wizard-v2') {
        const tools = (payload['tools'] as unknown[]) || [];
        const packs = (payload['packs'] as unknown[]) || [];
        const settings = (payload['settings'] as Record<string, unknown>) || {};
        const scope_to_project = Boolean(payload['scope_to_project_only'] ?? false);
        process.stdout.write(`  tools:       ${tools.length ? tools.join(',') : '(none)'}\n`);
        process.stdout.write(`  packs:       ${packs.length ? packs.join(',') : '(base)'}\n`);
        process.stdout.write(`  settings:    ${Object.keys(settings).length} top-level key(s)\n`);
        process.stdout.write(`  scope:       ${scope_to_project ? 'project' : 'global'}\n`);
    } else if (schema_version === 'installer-v1') {
        const ai_tools = (payload['ai_tools'] as unknown[]) || [];
        const configs = (payload['configs'] as Record<string, unknown>) || {};
        process.stdout.write(`  ai_tools:    ${ai_tools.length ? ai_tools.join(',') : '(none)'}\n`);
        process.stdout.write(`  configs:     ${Object.keys(configs).length} tool config(s)\n`);
    } else {
        process.stdout.write(`  error:       unsupported schema_version: ${pyRepr(schema_version)}\n`);
        process.stdout.write('\n');
        return 2;
    }
    process.stdout.write(`  target:      ${target}\n`);
    process.stdout.write(`  dry_run:     ${pyBool(Boolean(payload['dry_run'] ?? opts.dry_run))}\n`);
    process.stdout.write('\n');
    return 0;
}

/** Python `repr()` for a string scalar (single-quoted) or other primitives. */
function pyRepr(v: unknown): string {
    if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    return String(v);
}

// --- Main ---

function main(argv: string[]): number {
    const opts = parse_options(argv);
    state.QUIET = opts.quiet;

    if (opts.apply_payload) {
        const payload_path = resolvePath(opts.apply_payload);
        if (!isFile(payload_path)) fail(`--apply-payload path not found: ${payload_path}`);
        let payload: unknown;
        try {
            payload = JSON.parse(readText(payload_path));
        } catch (exc) {
            fail(`--apply-payload JSON parse error: ${String(exc)}`);
        }
        if (!_isPlainObject(payload)) fail('--apply-payload root must be a JSON object');
        const pl = payload as Record<string, unknown>;
        const schema_version = pl['schema_version'];
        if (schema_version !== 'wizard-v2' && schema_version !== 'installer-v1') {
            fail(
                `--apply-payload schema_version must be 'wizard-v2' or ` +
                    `'installer-v1', got ${pyRepr(schema_version)}`,
            );
        }
        if (schema_version === 'wizard-v2') {
            const tools = pl['tools'];
            if (Array.isArray(tools) && tools.length > 0) {
                opts.tools = tools.filter((t) => typeof t === 'string').join(',');
            }
            if (Boolean(pl['scope_to_project_only'] ?? false)) {
                opts.scope = 'project';
            } else {
                opts.scope = 'global';
            }
            const settings = pl['settings'];
            if (_isPlainObject(settings)) {
                const rule_loading_tier =
                    (settings['rule_loading_tier'] as unknown) || (settings['cost_profile'] as unknown);
                if (typeof rule_loading_tier === 'string' && rule_loading_tier) {
                    opts.profile = rule_loading_tier;
                }
                const personal = settings['personal'];
                if (_isPlainObject(personal)) {
                    const user_type = personal['user_type'];
                    if (typeof user_type === 'string' && user_type) {
                        opts.user_type = user_type;
                    }
                }
            }
            const packs = pl['packs'];
            if (Array.isArray(packs)) {
                opts.packs = packs.filter((p) => typeof p === 'string') as string[];
            }
        } else if (schema_version === 'installer-v1') {
            const ai_tools = pl['ai_tools'];
            if (Array.isArray(ai_tools) && ai_tools.length > 0) {
                opts.tools = ai_tools.filter((t) => typeof t === 'string').join(',');
            }
        }
        if (Boolean(pl['dry_run'] ?? false)) {
            opts.dry_run = true;
        }
        if (opts.dry_run) {
            return _apply_payload_preview(pl, opts);
        }
        state.PROGRESS_NDJSON = true;
        state.QUIET = true;
    }

    if (opts.offline) {
        process.env['AGENT_CONFIG_OFFLINE'] = '1';
        process.env['AGENT_CONFIG_NO_UPDATE_CHECK'] = '1';
    }

    if (!SUPPORTED_PROFILES.includes(opts.profile)) {
        fail(`Unsupported profile: ${opts.profile}. Supported: ${SUPPORTED_PROFILES.join(', ')}`);
    }

    if (opts.dry_run) {
        return _dry_run_summary(opts);
    }

    {
        const [will_launch, why_not] = _wizard_should_launch(opts);
        if (will_launch) {
            if (!state.QUIET) info('Setup wizard will launch automatically after install.');
        } else if (!state.QUIET) {
            info(`Setup wizard auto-launch disabled (${why_not}).`);
        }
    }

    if (opts.minimal) {
        const target_root = resolvePath(
            opts.custom_path || opts.project || process.env['PROJECT_ROOT'] || process.cwd(),
        );
        const minimal_package_root = path.dirname(
            path.dirname(path.dirname(_minimal_templates_root())),
        );
        const validated_user_type = _validate_user_type(minimal_package_root, opts.user_type);
        return install_minimal(target_root, opts.force, validated_user_type);
    }

    const detect_root = resolvePath(opts.project || process.env['PROJECT_ROOT'] || process.cwd());
    const [detected, detect_reason] = detect_scope(detect_root);
    const custom_path: string | null = opts.custom_path ? resolvePath(opts.custom_path) : null;
    const scope = _resolve_scope(opts, detected, detect_reason, custom_path);
    _enforce_consumer_global_only(scope);
    _enforce_not_source_repo(scope, detect_root);

    let parsed_tools = _parse_tools(opts.tools);
    const tools_was_all = _tools_was_all(opts.tools);
    parsed_tools = _validate_scope(parsed_tools, scope, tools_was_all);

    const wizard_handoff = _wizard_should_launch(opts)[0];

    if (scope === 'global') {
        const artefacts = _detect_legacy_for_migration(detect_root);
        if (artefacts.length > 0 && (wizard_handoff || _prompt_migrate_to_global(detect_root, artefacts))) {
            const rc = _run_migrate_to_global(detect_root);
            if (rc !== 0) return rc;
        }
        const rc = install_global(parsed_tools, opts.force, detect_root);
        _emit_progress_terminal(rc);
        if (rc === 0 && wizard_handoff) {
            return _wizard_spawn(detect_root, false);
        }
        return rc;
    }

    const project_root =
        custom_path || resolvePath(opts.project || process.env['PROJECT_ROOT'] || process.cwd());
    const is_first_run = !pathExists(path.join(project_root, SETTINGS_FILE));
    const rc = _main_project_install(opts, project_root, parsed_tools, is_first_run);
    if (rc === 0 && opts.interactive) {
        run_interactive_init(project_root, opts.force);
    }
    _emit_progress_terminal(rc);
    return rc;
}

function _propose_modules_config(project_root: string, is_first_run: boolean): void {
    if (!is_first_run || state.QUIET || !process.stdin.isTTY || !process.stdout.isTTY) return;
    let candidates;
    try {
        candidates = detect_module_roots(project_root);
    } catch {
        return;
    }
    if (!candidates || candidates.length === 0) return;
    process.stdout.write('\n');
    info('Module-root candidates detected — propose `modules:` block');
    info('Paste into .agent-project-settings.yml to enable module-aware skills (or skip; the block stays opt-in).');
    process.stdout.write('\n');
    process.stdout.write('  modules:\n');
    process.stdout.write('    enabled: true\n');
    process.stdout.write('    root_paths: [' + candidates.map((c) => c.path).join(', ') + ']\n');
    const primary_ns =
        candidates.find((c) => c.namespace_template_guess)?.namespace_template_guess ?? '';
    if (primary_ns) {
        process.stdout.write(`    namespace_template: '${primary_ns}'\n`);
    }
    process.stdout.write('    agent_folder: agents\n');
    process.stdout.write('    skip_dirs: [.module-template, .example]\n');
    process.stdout.write('\n');
    info(
        'Re-run anytime via `python3 src/scripts/propose_modules_config.py` ' +
            '(installed under <package>/src/scripts/).',
    );
}

function _read_consumer_auto_switch(project_root: string): string {
    let data: Record<string, unknown>;
    try {
        data = load_agent_settings({ project_path: _resolve_settings_read(project_root) });
    } catch {
        return 'suggest';
    }
    const model = _isPlainObject(data) ? data['model'] : null;
    const value = _isPlainObject(model) ? (model as Record<string, unknown>)['auto_switch'] : null;
    if (typeof value === 'string' && ['auto', 'suggest', 'off'].includes(value.trim().toLowerCase())) {
        return value.trim().toLowerCase();
    }
    return 'suggest';
}

function finalize_claude_model_tiers(project_root: string): number {
    const claude_skills = path.join(project_root, '.claude', 'skills');
    const augment_skills = path.join(project_root, '.augment', 'skills');
    if (!isDir(claude_skills) || !isDir(augment_skills)) return 0;
    if (_read_consumer_auto_switch(project_root) !== 'auto') return 0;

    let rendered = 0;
    const entries = fs
        .readdirSync(claude_skills)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const name of entries) {
        const entry = path.join(claude_skills, name);
        const src_dir = path.join(augment_skills, name);
        const src_md = path.join(src_dir, 'SKILL.md');
        let tier: string | null;
        try {
            tier = read_model_tier(readText(src_md));
        } catch {
            tier = null;
        }
        if (tier === null || !(tier in TIER_TO_CLAUDE_MODEL) || !isDir(src_dir)) continue;
        if (isSymlink(entry) || isFile(entry)) {
            fs.unlinkSync(entry);
        } else if (isDir(entry)) {
            fs.rmSync(entry, { recursive: true, force: true });
        }
        mkdirp(entry);
        const srcFiles = fs.readdirSync(src_dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        for (const fname of srcFiles) {
            if (fname === 'SKILL.md') {
                writeText(
                    path.join(entry, 'SKILL.md'),
                    render_native_model_md(readText(src_md), tier),
                );
            } else {
                fs.symlinkSync(
                    path.join('../../../.augment/skills', name, fname),
                    path.join(entry, fname),
                );
            }
        }
        rendered += 1;
    }

    if (rendered && !state.QUIET) {
        info(
            `Applied native model: to ${rendered} model-tier skill(s) in ` +
                '.claude/skills/ (model.auto_switch=auto)',
        );
    }
    return rendered;
}

function _main_project_install(
    opts: Options,
    project_root: string,
    parsed_tools: Set<string>,
    is_first_run: boolean,
): number {
    let package_root: string;
    let package_type: string;
    if (opts.package) {
        package_root = resolvePath(opts.package);
        if (!pathExists(path.join(package_root, 'src', 'config', 'profiles', 'minimal.ini'))) {
            fail(`Invalid --package path (missing src/config/profiles/minimal.ini): ${package_root}`);
        }
        package_type = detect_package_type_for_project(project_root, package_root);
    } else {
        package_root = detect_package_root(project_root);
        package_type = detect_package_type(package_root);
    }

    if (!state.QUIET) {
        process.stdout.write('\n');
        info('Agent Config — Project Bridge Installer');
        info(`Project:  ${project_root}`);
        info(`Package:  ${package_root}`);
        info(`Type:     ${package_type}`);
        info(`Profile:  ${opts.profile}`);
        if (opts.user_type) info(`UserType: ${opts.user_type}`);
        process.stdout.write('\n');
    }

    ensure_agent_settings(project_root, package_root, opts.profile, opts.force, opts.user_type, opts.packs ?? null);

    _write_install_mode_marker(project_root, 'full');

    const tools = parsed_tools;
    const merged_keys_by_tool: Record<string, Record<string, unknown>[]> = {};

    if (!opts.skip_bridges) {
        ensure_vscode_bridge(project_root, package_type, opts.force);
        merged_keys_by_tool['augment'] = ensure_augment_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'claude-code')) {
            merged_keys_by_tool['claude-code'] = ensure_claude_bridge(project_root, opts.force);
        }
        if (_is_tool_enabled(tools, 'cursor')) {
            merged_keys_by_tool['cursor'] = ensure_cursor_bridge(project_root, opts.force);
        }
        if (_is_tool_enabled(tools, 'cline')) ensure_cline_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'windsurf')) {
            merged_keys_by_tool['windsurf'] = ensure_windsurf_bridge(project_root, opts.force);
        }
        if (_is_tool_enabled(tools, 'gemini-cli')) {
            merged_keys_by_tool['gemini-cli'] = ensure_gemini_bridge(project_root, opts.force);
        }
        if (_is_tool_enabled(tools, 'copilot')) ensure_copilot_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'roocode')) ensure_roocode_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'claude-desktop')) ensure_claude_desktop_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'aider')) ensure_aider_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'codex')) ensure_codex_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'continue')) ensure_continue_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'kilocode')) ensure_kilocode_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'zed')) ensure_zed_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'jetbrains')) ensure_jetbrains_bridge(project_root, opts.force);
        if (_is_tool_enabled(tools, 'kiro')) ensure_kiro_bridge(project_root, opts.force);
    }

    if (opts.augment_user_hooks) {
        (merged_keys_by_tool['augment'] ??= []).push(...ensure_augment_user_hooks(package_root, opts.force));
    }
    if (opts.cursor_user_hooks && _is_tool_enabled(tools, 'cursor')) {
        (merged_keys_by_tool['cursor'] ??= []).push(...ensure_cursor_user_hooks(package_root, opts.force));
    }
    if (opts.cline_user_hooks && _is_tool_enabled(tools, 'cline')) {
        ensure_cline_user_hooks(package_root, opts.force);
    }
    if (opts.windsurf_user_hooks && _is_tool_enabled(tools, 'windsurf')) {
        (merged_keys_by_tool['windsurf'] ??= []).push(...ensure_windsurf_user_hooks(package_root, opts.force));
    }
    if (opts.gemini_user_hooks && _is_tool_enabled(tools, 'gemini-cli')) {
        (merged_keys_by_tool['gemini-cli'] ??= []).push(...ensure_gemini_user_hooks(package_root, opts.force));
    }

    if (state.PROGRESS_NDJSON && !opts.skip_bridges) {
        const ordered = [...tools].sort();
        const total = ordered.length;
        ordered.forEach((tool_id, i) => {
            _emit_progress({ type: 'file', file: tool_id, status: 'deployed', written: i + 1, total });
        });
    }

    if (!opts.skip_bridges && !opts.no_smoke) {
        if (!state.QUIET) {
            process.stdout.write('\n');
            info('Smoke-testing installed hook bridges (dry-run)');
        }
        _smoke_test_hooks(project_root, package_root);
    }

    if (!opts.skip_bridges) {
        const files_by_tool = _files_by_tool_from_bridges(parsed_tools, project_root, 'project');
        const rc = _update_installed_tools_manifest(
            project_root,
            parsed_tools,
            'project',
            opts.force,
            files_by_tool,
            merged_keys_by_tool,
        );
        if (rc !== 0) return rc;
    }

    if (!opts.skip_bridges && _is_tool_enabled(tools, 'claude-code')) {
        finalize_claude_model_tiers(project_root);
    }

    if (!state.QUIET) {
        process.stdout.write('\n');
        success('Done.');
        if (is_first_run) {
            process.stdout.write('\n');
            process.stdout.write('  Try these 3 prompts with your agent:\n');
            process.stdout.write('    1. "Refactor this function"   → agent analyzes first\n');
            process.stdout.write('    2. "Add caching to this"      → agent asks instead of guessing\n');
            process.stdout.write('    3. "Implement this feature"   → agent respects your codebase\n');
            process.stdout.write('\n');
            process.stdout.write('  Next steps:\n');
            process.stdout.write('    • Commit .agent-settings.yml and bridge files to your repo\n');
            process.stdout.write('    • New team members run `npx @event4u/agent-config init` — done\n');
            process.stdout.write('    • Inspect hook coverage: ./agent-config hooks:status\n');
            process.stdout.write(
                '    • Full walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md\n',
            );
            process.stdout.write('\n');
        } else {
            process.stdout.write(
                '  Re-run complete. Walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md\n',
            );
            process.stdout.write('\n');
        }
    }

    _propose_modules_config(project_root, is_first_run);

    const will_launch = _wizard_should_launch(opts)[0];
    if (will_launch) {
        return _wizard_spawn(project_root);
    }
    return 0;
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof SystemExitError || e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export {
    main,
    parse_options,
    _merge_tools_aliases,
    _parse_tools,
    _tools_was_all,
    _is_tool_enabled,
    _yaml_scalar,
    _parse_legacy_settings,
    _replace_template_value,
    _replace_template_value_raw,
    _append_unknown_legacy,
    _render_template,
    _parse_profile_ini,
    _inject_packs,
    deep_merge,
    _validate_scope,
    _bridge_marker,
    detect_scope,
    _resolve_scope,
    _is_agent_config_source_repo,
    _detect_legacy_for_migration,
    _format_global_root_for_marker,
    _files_by_tool_from_bridges,
    _files_by_tool_from_deploy,
    _verify_deploy_targets,
    _wizard_should_launch,
    _dry_run_summary,
    _apply_payload_preview,
    jsonDumpsIndent,
    jsonDumpsCompact,
    _canonical_settings_target,
    _resolve_settings_read,
    detect_package_type,
    detect_package_type_for_project,
    SystemExitError,
    ArgparseExit,
    state,
    SUPPORTED_PROFILES,
    DEFAULT_PROFILE,
    _VALID_TOOLS,
};
export type { Options };

#!/usr/bin/env tsx
/**
 * Persist a `modules:` block into `.agent-project-settings.yml`.
 *
 * TypeScript twin of `src/scripts/apply_modules_config.py` (ADR-094,
 * Phase 8 / Wave 8g). Mirrors the Python CLI contract EXACTLY — `--project`
 * / `--input-file` / `--decline` / `--acknowledge-only` flags, JSON payload
 * shape + validation, comment-preserving line-patch (byte-identical written
 * output), exit codes (0 ok/no-op, 2 args/unreachable/malformed-JSON,
 * 3 template-resolve failure), stdout (team-file path) / stderr split. No
 * behaviour changes.
 *
 * Phase E Step 1 of road-to-configurable-modules — the persistence side
 * of the GUI wizard's modules step. Reads a JSON payload (stdin or
 * `--input-file`) and patches the `modules.*` keys in the team file
 * while preserving comments, ordering, and surrounding YAML blocks.
 *
 * The patch logic mirrors `scripts.install._replace_template_value_raw`
 * so the wizard, `/agents init`, and a hand-edit all converge on the
 * same on-disk shape. Comment-preserving by design — never round-trips
 * through PyYAML, which strips block comments.
 *
 * JSON payload shape (matches `proposed_block` from
 * `propose_modules_config.ts --json`):
 *
 *   {
 *     "enabled": true,
 *     "root_paths": ["app/Modules"],
 *     "namespace_template": "App\\Modules\\{ModuleName}\\App",
 *     "agent_folder": "agents",
 *     "skip_dirs": [".module-template", ".example"]
 *   }
 *
 * Exit codes:
 *   0 — patched successfully (or no-op when payload says decline).
 *   2 — invalid arguments, unreachable project root, or malformed JSON.
 *   3 — template-resolve failure (cannot bootstrap a missing team file).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolve_logical } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);

const TEAM_FILE = '.agent-project-settings.yml';
const TEMPLATE_LOGICAL = 'templates/agents/agent-project-settings.example.yml';

const _BARE_ID_RE = /^[a-z][a-z0-9_]*$/;

/**
 * Format a string as a YAML scalar with minimal quoting.
 *
 * Mirror of `scripts.install._yaml_scalar` — duplicated here so the
 * persistence helper stays self-contained.
 */
function _yaml_scalar(value: string): string {
    if (value === '') {
        return '""';
    }
    if (value === 'true' || value === 'false') {
        return value;
    }
    if (_isPyDigit(value)) {
        return value;
    }
    if (_BARE_ID_RE.test(value)) {
        return value;
    }
    const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    return `"${escaped}"`;
}

/**
 * Python `str.isdigit()` — true for a non-empty string of decimal digits
 * (we restrict to ASCII 0-9; the template values never carry the exotic
 * Unicode digits Python additionally accepts).
 */
function _isPyDigit(value: string): boolean {
    return value.length > 0 && /^[0-9]+$/.test(value);
}

/**
 * Replace the value at `dotted_path` with the pre-formatted `raw_yaml`.
 *
 * Port of `scripts.install._replace_template_value_raw`. Tracks parent
 * sections by indent (2-space stride) so the leaf scalar is only patched
 * when every parent matches. Comments + indentation are preserved.
 * Returns `template` unchanged if the path is missing.
 */
function _replace_template_value_raw(
    template: string,
    dotted_path: string,
    raw_yaml: string,
): string {
    const parts = dotted_path.split('.');
    if (parts.length === 0) {
        return template;
    }
    const sections = parts.slice(0, -1);
    const key = parts[parts.length - 1]!;
    const target_indent = '  '.repeat(sections.length);
    const header_re = /^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*$/;
    const scalar_re = /^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*\S.*$/;
    const current_path: Array<string | null> = new Array(sections.length).fill(null);
    const lines = _splitlines(template);
    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx]!;
        const stripped = line.trim();
        if (stripped === '' || stripped.startsWith('#')) {
            continue;
        }
        const m_header = header_re.exec(line);
        if (m_header) {
            const indent = m_header[1]!;
            const name = m_header[2]!;
            const depth = Math.floor(indent.length / 2);
            if (depth < sections.length) {
                current_path[depth] = name;
                for (let d = depth + 1; d < sections.length; d++) {
                    current_path[d] = null;
                }
            }
            continue;
        }
        const m_scalar = scalar_re.exec(line);
        if (!m_scalar) {
            continue;
        }
        const indent = m_scalar[1]!;
        const name = m_scalar[2]!;
        if (name !== key || indent !== target_indent) {
            continue;
        }
        if (!_listEq(current_path, sections)) {
            continue;
        }
        lines[idx] = `${indent}${key}: ${raw_yaml}`;
        return lines.join('\n') + (template.endsWith('\n') ? '\n' : '');
    }
    return template;
}

/** Python `str.splitlines()` — split on universal newlines, no trailing empty. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    // Python splitlines drops a trailing line terminator (no trailing "").
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

function _listEq(a: Array<string | null>, b: string[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

/** Render a list as a flow-style YAML sequence (`[a, b, c]`). */
function _yaml_flow_list(items: string[]): string {
    if (items.length === 0) {
        return '[]';
    }
    return '[' + items.map((item) => _yaml_scalar(item)).join(', ') + ']';
}

function _yaml_bool(value: boolean): string {
    return value ? 'true' : 'false';
}

/**
 * Resolve the bundled `agent-project-settings.example.yml`.
 *
 * Used to bootstrap the team file when the consumer project has not
 * committed one yet.
 */
function _resolve_template_path(): string | null {
    const src = resolve_logical(TEMPLATE_LOGICAL);
    if (src !== null && _isFile(src)) {
        return src;
    }
    const fallback = path.join(_repoRoot(), '.agent-src.uncondensed', TEMPLATE_LOGICAL);
    if (_isFile(fallback)) {
        return fallback;
    }
    return null;
}

function _repoRoot(): string {
    // src/scripts/<file> → parents[2] == repo root, mirror of REPO_ROOT.
    return path.resolve(_HERE, '..', '..', '..');
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

interface ParsedArgs {
    project: string | null;
    input_file: string | null;
    decline: boolean;
    acknowledge_only: boolean;
}

interface Payload {
    [key: string]: unknown;
}

function _load_payload(args: ParsedArgs): Payload {
    let raw: string;
    if (args.input_file) {
        raw = fs.readFileSync(args.input_file, 'utf-8');
    } else {
        raw = _readStdin();
    }
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch (exc) {
        process.stderr.write(`error: invalid JSON payload: ${_jsonErr(exc, raw)}\n`);
        process.exit(2);
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        process.stderr.write('error: payload must be a JSON object\n');
        process.exit(2);
    }
    return data as Payload;
}

/**
 * Best-effort mirror of `json.JSONDecodeError`'s str(). The Python error
 * text is not part of the byte-stable contract (it is exception PROSE per
 * the migration rules); only the `error: invalid JSON payload: ` prefix
 * and the exit code (2) are stable.
 */
function _jsonErr(exc: unknown, _raw: string): string {
    return exc instanceof Error ? exc.message : String(exc);
}

function _readStdin(): string {
    try {
        return fs.readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}

function _coerce_str_list(value: unknown, field: string): string[] {
    if (!Array.isArray(value)) {
        process.stderr.write(`error: payload.${field} must be a list\n`);
        process.exit(2);
    }
    const out: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string') {
            process.stderr.write(`error: payload.${field}[*] must be strings\n`);
            process.exit(2);
        }
        out.push(item);
    }
    return out;
}

/** Python `bool(payload.get(key, default))` truthiness. */
function _pyBoolGet(payload: Payload, key: string, dflt: boolean): boolean {
    if (!(key in payload)) {
        return dflt;
    }
    return _pyTruthy(payload[key]);
}

function _pyTruthy(value: unknown): boolean {
    if (value === undefined || value === null || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as object).length > 0;
    }
    return true;
}

/**
 * Patch the four (six) modules.* leaves in `template` per `payload`.
 *
 * Missing keys in `payload` fall back to safe defaults that match the
 * bundled template. Patching is no-op for any key whose dotted path is
 * absent from `template`. Mirror of `_patch_modules`.
 */
function _patch_modules(template: string, payload: Payload): string {
    const enabled = _pyBoolGet(payload, 'enabled', false);
    const root_paths = _coerce_str_list(
        'root_paths' in payload ? payload['root_paths'] : [],
        'root_paths',
    );
    let ns_template: unknown = 'namespace_template' in payload ? payload['namespace_template'] : '';
    if (typeof ns_template !== 'string') {
        process.stderr.write('error: payload.namespace_template must be a string\n');
        process.exit(2);
    }
    let agent_folder: unknown = 'agent_folder' in payload ? payload['agent_folder'] : 'agents';
    if (typeof agent_folder !== 'string' || agent_folder === '') {
        agent_folder = 'agents';
    }
    const skip_dirs = _coerce_str_list(
        'skip_dirs' in payload ? payload['skip_dirs'] : ['.module-template', '.example'],
        'skip_dirs',
    );

    const acknowledged = _pyBoolGet(payload, 'detection_acknowledged', false);

    let out = template;
    out = _replace_template_value_raw(out, 'modules.enabled', _yaml_bool(enabled));
    out = _replace_template_value_raw(out, 'modules.root_paths', _yaml_flow_list(root_paths));
    out = _replace_template_value_raw(
        out,
        'modules.namespace_template',
        _yaml_scalar(ns_template as string),
    );
    out = _replace_template_value_raw(
        out,
        'modules.agent_folder',
        _yaml_scalar(agent_folder as string),
    );
    out = _replace_template_value_raw(out, 'modules.skip_dirs', _yaml_flow_list(skip_dirs));
    out = _replace_template_value_raw(
        out,
        'modules.detection_acknowledged',
        _yaml_bool(acknowledged),
    );
    return out;
}

/**
 * Flip `modules.detection_acknowledged` to `true` without touching siblings.
 * Mirror of `_patch_acknowledge_only`.
 */
function _patch_acknowledge_only(template: string): string {
    return _replace_template_value_raw(
        template,
        'modules.detection_acknowledged',
        _yaml_bool(true),
    );
}

function _bootstrap_team_file(_team_path: string): string {
    const template_path = _resolve_template_path();
    if (template_path === null) {
        process.stderr.write(
            'error: cannot bootstrap .agent-project-settings.yml — ' +
                `template missing at ${TEMPLATE_LOGICAL}\n`,
        );
        process.exit(3);
    }
    return fs.readFileSync(template_path, 'utf-8');
}

function _argparse_error(message: string): never {
    process.stderr.write(
        `usage: apply_modules_config.py [-h] [--project PROJECT] [--input-file INPUT_FILE]\n` +
            `                               [--decline] [--acknowledge-only]\n`,
    );
    process.stderr.write(`apply_modules_config.py: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let project: string | null = null;
    let input_file: string | null = null;
    let decline = false;
    let acknowledge_only = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--project') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --project: expected one argument');
            }
            project = v;
        } else if (arg.startsWith('--project=')) {
            project = arg.slice('--project='.length);
        } else if (arg === '--input-file') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --input-file: expected one argument');
            }
            input_file = v;
        } else if (arg.startsWith('--input-file=')) {
            input_file = arg.slice('--input-file='.length);
        } else if (arg === '--decline') {
            decline = true;
        } else if (arg === '--acknowledge-only') {
            acknowledge_only = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                `usage: apply_modules_config.py [-h] [--project PROJECT] [--input-file INPUT_FILE]\n` +
                    `                               [--decline] [--acknowledge-only]\n`,
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { project, input_file, decline, acknowledge_only };
}

function main(argv: readonly string[]): number {
    const args = parse_args(argv);
    if (args.decline) {
        return 0;
    }
    const root = args.project
        ? _resolvePath(_expanduser(args.project))
        : _resolvePath(process.cwd());
    if (!_isDir(root)) {
        process.stderr.write(`error: project root is not a directory: ${root}\n`);
        return 2;
    }
    const team_path = path.join(root, TEAM_FILE);
    let template: string;
    if (_isFile(team_path)) {
        template = fs.readFileSync(team_path, 'utf-8');
    } else {
        template = _bootstrap_team_file(team_path);
    }
    let patched: string;
    if (args.acknowledge_only) {
        patched = _patch_acknowledge_only(template);
    } else {
        const payload = _load_payload(args);
        patched = _patch_modules(template, payload);
    }
    fs.writeFileSync(team_path, patched, 'utf-8');
    process.stdout.write(`${team_path}\n`);
    return 0;
}

/** Python `Path.expanduser()` — only a leading `~` / `~user`. */
function _expanduser(p: string): string {
    if (!p.startsWith('~')) {
        return p;
    }
    const sep = p.indexOf('/');
    const head = sep === -1 ? p : p.slice(0, sep);
    const tail = sep === -1 ? '' : p.slice(sep);
    if (head === '~') {
        return os.homedir() + tail;
    }
    return p;
}

/**
 * Mirror Python pathlib `.resolve()` — absolute, symlink-following, with a
 * prefix-resolution fallback for non-existent leaves. On macOS this turns
 * `/var/...` into `/private/var/...` exactly as `Path.resolve()` does.
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
            return abs;
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

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main(process.argv.slice(2));
}

export {
    TEAM_FILE,
    TEMPLATE_LOGICAL,
    _yaml_scalar,
    _replace_template_value_raw,
    _yaml_flow_list,
    _yaml_bool,
    _resolve_template_path,
    _patch_modules,
    _patch_acknowledge_only,
    main,
};

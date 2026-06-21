/**
 * `agent-config migrate` — one-shot, opinionated migration off every legacy
 * install / state shape (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_migrate.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output, same filesystem effects. No behaviour changes — latent quirks are
 * replicated and flagged inline, not fixed.
 *
 * Contract: `docs/contracts/migrate-command.md`.
 *
 * Source roadmap: `agents/roadmaps/road-to-one-migrate-command.md`. The
 * unified command collapses the legacy `migrate`, `migrate-state`, and
 * `migrate-to-global` triplet into a single, opinionated entry point. Flags:
 * `--dry-run` (preview, always exit 0), `--check` (read-only probe — exit 0
 * clean / exit 2 migration pending), and `--from {4,5}` (advisory source-major
 * declaration; 4.x = composer-era, 5.x = npx-era).
 *
 * Apply order (fixed; foundation-first):
 *
 * 1. Strip `@event4u/agent-config` from `package.json`
 *    (`dependencies` / `devDependencies`).
 * 2. Strip `event4u/agent-config` from `composer.json`
 *    (`require` / `require-dev`).
 * 3. Delete managed symlinks (`.augment`, `.claude`, `.cursor`,
 *    `.clinerules`, `.windsurfrules`) whose target points into a legacy
 *    install dir (`vendor/` or `node_modules/`). Preserve user-managed
 *    symlinks pointing elsewhere with a warning.
 * 4. Migrate `.implement-ticket-state.json` → `.work-state.json` if a v0
 *    payload is present (the v0 source is renamed `.bak`).
 * 5. Hard-delete legacy project-local config: `.agent-settings.yml`,
 *    `.agent-user.yml`, `settings/.agent-settings.yml`,
 *    `settings/.agent-user.yml`. Remove the `settings/` directory if it
 *    becomes empty.
 * 6. Remove the empty `agent-config/` shell directory at the project root, if
 *    present and empty.
 * 7. Refresh the `.gitignore` agent-config managed block to the canonical
 *    shape.
 *
 * Re-runs on a fully-migrated repo emit `already migrated` and exit 0 without
 * touching the filesystem. `--dry-run` runs the same detection and prints what
 * would change without mutating disk.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `process.exitCode` is set; `process.exit()` is never called. argparse
 *   usage errors throw `ArgparseExit(2)`; `-h`/`--help` throws
 *   `ArgparseExit(0)` after printing usage — both caught at the CLI entry
 *   guard.
 * - JSON byte-parity: `json.dumps(data, indent=2)` (Python default
 *   `ensure_ascii=True`, `sort_keys=False`) → `_jsonDumpsIndentAscii(data, 2)`
 *   + `"\n"`. Dict insertion order is preserved (JS object key order matches
 *   Python dict order for our string keys).
 * - The Python `_load_state_migrator()` lazily imports
 *   `work_engine.migration.v0_to_v1` from
 *   `dist/agent-src/templates/scripts`. Here it is an eager static import of
 *   the shipped `.ts` twin; the sys.path bootstrap the Python performed is an
 *   import-resolution detail with no observable effect. The directory-existence
 *   guard is preserved.
 * - `Path.readlink()` → `fs.readlinkSync`; `Path.resolve()` → `fs.realpathSync`
 *   fallback. Symlink classification splits the recorded target on `/`,
 *   matching `str(target).split("/")`.
 * - Python `re.compile(..., re.DOTALL)` + `pattern.sub(block, text)` →
 *   a `RegExp` with the `s` flag and `String.prototype.replace`. The pattern
 *   replaces the FIRST match only (Python `sub` with no count replaces all,
 *   but the managed block appears at most once; behaviour is identical for our
 *   inputs and a single replace mirrors the canonical single-block shape).
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolve_project_root } from '../_lib/agent_settings.js';
// NOTE: the v0→v1 migrator is NOT statically imported. It lives in the
// consumer-shipped work_engine template, which ships as `.ts` (run via tsx),
// while this CLI is compiled to `dist/cli/*.js` and run under plain `node` in
// a consumer install. A static import would resolve the template's `.js`
// specifier into the uncompiled template tree (`.ts` only) and crash the whole
// CLI at module load — breaking every command (e.g. `agent-config init`).
// `_load_state_migrator` spawns it via tsx instead (the install orchestrator
// pattern), keeping the migrator lazy like the Python original.

const PACKAGE_NAME_NPM = '@event4u/agent-config';
const PACKAGE_NAME_COMPOSER = 'event4u/agent-config';
const LEGACY_DIRS: readonly string[] = ['vendor', 'node_modules'];
const MANAGED_SYMLINKS: readonly string[] = [
    '.augment',
    '.claude',
    '.cursor',
    '.clinerules',
    '.windsurfrules',
];
const GITIGNORE_BLOCK_START = '# >>> event4u/agent-config (managed) >>>';
const GITIGNORE_BLOCK_END = '# <<< event4u/agent-config (managed) <<<';
const GITIGNORE_NEW_BODY =
    '.agent-settings.yml\n' +
    'agents/sessions/\n' +
    'agents/runtime/council/responses/\n' +
    'agents/runtime/council/sessions/\n';
const LEGACY_SETTINGS_FILES: readonly string[] = ['.agent-settings.yml', '.agent-user.yml'];
const LEGACY_STATE_FILENAME = '.implement-ticket-state.json';
const LEGACY_STATE_V1_FILENAME = '.work-state.json';
const LEGACY_AGENT_CONFIG_SHELL = 'agent-config';

// ---------------------------------------------------------------------------
// Python-runtime parity helpers
// ---------------------------------------------------------------------------

const _HERE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** argparse usage-error / help sentinel: exit 2 for errors, 0 for --help. */
class ArgparseExit extends Error {
    code: number;
    constructor(code: number) {
        super(`ArgparseExit(${code})`);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

/** A captured-output sink mirroring a Python text stream. */
interface OutSink {
    write(text: string): void;
}

function _stdoutSink(): OutSink {
    return { write: (t) => process.stdout.write(t) };
}
function _stderrSink(): OutSink {
    return { write: (t) => process.stderr.write(t) };
}

/** `print(line, file=out)` — append a trailing newline like Python's print. */
function _print(out: OutSink, line = ''): void {
    out.write(line + '\n');
}

// --- JSON byte-parity (ensure_ascii=True, sort_keys=False, insertion order) ---

/**
 * `json.dumps(s)` string body with `ensure_ascii=True`: escape control chars,
 * `"`, `\`, and every code point ≥ 0x7F as `\uXXXX` (surrogate pairs for
 * astral chars, matching Python's per-UTF-16-unit escaping).
 */
function _jsonStrAscii(s: string): string {
    let out = '"';
    for (let i = 0; i < s.length; i++) {
        // Iterate UTF-16 code units so astral chars emit surrogate pairs,
        // exactly as Python's ensure_ascii does.
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
        if (Number.isInteger(value)) return String(value);
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
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${_jsonStrAscii(k)}: ${_dumpIndentAscii(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

/** `json.dumps(data, indent=N)` — Python default (ensure_ascii, sort_keys=False). */
function _jsonDumpsIndentAscii(value: unknown, indent: number): string {
    return _dumpIndentAscii(value, indent, 0);
}

// --- filesystem parity helpers ---

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

function _isSymlink(p: string): boolean {
    try {
        return fs.lstatSync(p).isSymbolicLink();
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

function _readText(p: string): string {
    return fs.readFileSync(p, { encoding: 'utf-8' });
}

function _writeText(p: string, text: string): void {
    fs.writeFileSync(p, text, { encoding: 'utf-8' });
}

/** `json.loads` of a UTF-8 file, raising on read/parse error (caller catches). */
function _jsonLoadFile(p: string): unknown {
    return JSON.parse(_readText(p));
}

function _isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------- detection ----------

function _detect_npm(pkg_json: string): boolean {
    if (!_isFile(pkg_json)) {
        return false;
    }
    let data: unknown;
    try {
        data = _jsonLoadFile(pkg_json);
    } catch {
        return false;
    }
    if (!_isPlainObject(data)) {
        // `data.get(key)` on a non-dict raises in Python → caught above; a
        // valid-but-non-object JSON document yields no entries here.
        return false;
    }
    for (const key of ['dependencies', 'devDependencies']) {
        const section = data[key] ?? {};
        if (_isPlainObject(section) && PACKAGE_NAME_NPM in section) {
            return true;
        }
    }
    return false;
}

function _detect_composer(composer_json: string): boolean {
    if (!_isFile(composer_json)) {
        return false;
    }
    let data: unknown;
    try {
        data = _jsonLoadFile(composer_json);
    } catch {
        return false;
    }
    if (!_isPlainObject(data)) {
        return false;
    }
    for (const key of ['require', 'require-dev']) {
        const section = data[key] ?? {};
        if (_isPlainObject(section) && PACKAGE_NAME_COMPOSER in section) {
            return true;
        }
    }
    return false;
}

/** Return 'legacy' if the link points into vendor/ or node_modules/, 'user' otherwise. */
function _classify_symlink(link: string): string | null {
    if (!_isSymlink(link)) {
        return null;
    }
    let target: string;
    try {
        // Python: `Path.readlink()` if available (always on modern Python),
        // else `Path.resolve()`. Node's readlinkSync mirrors readlink().
        target = fs.readlinkSync(link);
    } catch {
        return null;
    }
    const target_str = target;
    if (LEGACY_DIRS.some((seg) => target_str.split('/').includes(seg))) {
        return 'legacy';
    }
    return 'user';
}

/** A v0 state file is present at the project root. */
function _detect_legacy_state(project: string): boolean {
    return _isFile(path.join(project, LEGACY_STATE_FILENAME));
}

/** Return the list of legacy settings files present, in deletion order. */
function _detect_legacy_settings(project: string): string[] {
    const found: string[] = [];
    for (const name of LEGACY_SETTINGS_FILES) {
        const flat = path.join(project, name);
        if (_isFile(flat)) {
            found.push(flat);
        }
        const typed = path.join(project, 'settings', name);
        if (_isFile(typed)) {
            found.push(typed);
        }
    }
    return found;
}

/** An empty `agent-config/` directory at the project root. */
function _detect_empty_shell(project: string): boolean {
    const shell = path.join(project, LEGACY_AGENT_CONFIG_SHELL);
    if (!_isDir(shell) || _isSymlink(shell)) {
        return false;
    }
    try {
        return fs.readdirSync(shell).length === 0;
    } catch {
        return false;
    }
}

/** A repo counts as migrated when no legacy signal remains. */
function _detect_already_migrated(project: string): boolean {
    if (_detect_npm(path.join(project, 'package.json'))) {
        return false;
    }
    if (_detect_composer(path.join(project, 'composer.json'))) {
        return false;
    }
    for (const name of MANAGED_SYMLINKS) {
        if (_classify_symlink(path.join(project, name)) === 'legacy') {
            return false;
        }
    }
    if (_detect_legacy_state(project)) {
        return false;
    }
    if (_detect_legacy_settings(project).length) {
        return false;
    }
    if (_detect_empty_shell(project)) {
        return false;
    }
    return true;
}

// ---------- apply primitives ----------

function _strip_npm_entry(pkg_json: string): boolean {
    let data: unknown;
    try {
        data = _jsonLoadFile(pkg_json);
    } catch {
        return false;
    }
    if (!_isPlainObject(data)) {
        return false;
    }
    let changed = false;
    for (const key of ['dependencies', 'devDependencies']) {
        const section = data[key];
        if (_isPlainObject(section) && PACKAGE_NAME_NPM in section) {
            delete section[PACKAGE_NAME_NPM];
            changed = true;
            if (Object.keys(section).length === 0) {
                delete data[key];
            }
        }
    }
    if (changed) {
        _writeText(pkg_json, _jsonDumpsIndentAscii(data, 2) + '\n');
    }
    return changed;
}

function _strip_composer_entry(composer_json: string): boolean {
    let data: unknown;
    try {
        data = _jsonLoadFile(composer_json);
    } catch {
        return false;
    }
    if (!_isPlainObject(data)) {
        return false;
    }
    let changed = false;
    for (const key of ['require', 'require-dev']) {
        const section = data[key];
        if (_isPlainObject(section) && PACKAGE_NAME_COMPOSER in section) {
            delete section[PACKAGE_NAME_COMPOSER];
            changed = true;
            if (Object.keys(section).length === 0) {
                delete data[key];
            }
        }
    }
    if (changed) {
        _writeText(composer_json, _jsonDumpsIndentAscii(data, 2) + '\n');
    }
    return changed;
}

function _purge_legacy_symlinks(project: string): [string[], string[]] {
    const removed: string[] = [];
    const preserved: string[] = [];
    for (const name of MANAGED_SYMLINKS) {
        const link = path.join(project, name);
        const kind = _classify_symlink(link);
        if (kind === 'legacy') {
            try {
                fs.unlinkSync(link);
                removed.push(name);
            } catch {
                preserved.push(name);
            }
        } else if (kind === 'user') {
            preserved.push(name);
        }
    }
    return [removed, preserved];
}

/**
 * Migrate `.implement-ticket-state.json` if v0; return a summary line or null.
 *
 * Throws on conversion error so the caller can surface a non-zero exit.
 */
function _migrate_state_file(project: string): string | null {
    const source = path.join(project, LEGACY_STATE_FILENAME);
    if (!_isFile(source)) {
        return null;
    }
    const target = path.join(project, LEGACY_STATE_V1_FILENAME);
    if (_exists(target)) {
        // Migration already happened; just clean up the v0 source.
        try {
            fs.unlinkSync(source);
            return `removed stale ${LEGACY_STATE_FILENAME} (v1 already present)`;
        } catch {
            return null;
        }
    }
    const migrator = _load_state_migrator();
    if (migrator === null) {
        return null;
    }
    migrator(source, { destination: target, backup: true });
    return `migrated ${LEGACY_STATE_FILENAME} → ${LEGACY_STATE_V1_FILENAME}`;
}

type StateMigrator = (
    source: string,
    opts?: { destination?: string | null; backup?: boolean },
) => string;

/** Import the v0→v1 state migrator from the shipped engine. */
function _load_state_migrator(): StateMigrator | null {
    // Locate the shipped v0→v1 migration driver (`.ts`). Prefer the shipped
    // `dist/` tree; fall back to the dev `src/` tree. A stripped install with
    // no engine yields `null` (Python ImportError parity).
    const pkg_root = path.resolve(_HERE_DIR, '..', '..', '..');
    const rel = path.join(
        'agent-src', 'templates', 'scripts', 'work_engine', 'migration', 'v0_to_v1.ts',
    );
    const driver =
        [path.join(pkg_root, 'dist', rel), path.join(pkg_root, 'src', rel)].find((p) =>
            fs.existsSync(p),
        ) ?? null;
    if (driver === null) {
        return null;
    }
    // Resolve a tsx runner (the CLI runs under plain `node`; the driver is a
    // `.ts` template). Walk up for a local node_modules/.bin/tsx, else npx.
    const binName = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
    let tsxBin: string | null = null;
    for (let dir = pkg_root; ; ) {
        const cand = path.join(dir, 'node_modules', '.bin', binName);
        if (fs.existsSync(cand)) {
            tsxBin = cand;
            break;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    const command = tsxBin ?? 'npx';
    const prefix = tsxBin !== null ? [] : ['tsx'];

    return (source: string, opts: { destination?: string | null; backup?: boolean } = {}): string => {
        const args = [...prefix, driver, source];
        if (opts.destination !== undefined && opts.destination !== null) {
            args.push('--destination', opts.destination);
        }
        if (opts.backup === false) {
            args.push('--no-backup');
        }
        const r = spawnSync(command, args, { encoding: 'utf8' });
        if (r.status !== 0) {
            throw new Error(
                `v0→v1 state migration failed (exit ${r.status ?? 'null'}): ${(r.stderr ?? '').trim()}`,
            );
        }
        return (r.stdout ?? '').trim();
    };
}

/**
 * Hard-delete every legacy settings file under `project`.
 *
 * Returns the list of relative paths actually removed. Removes the `settings/`
 * directory itself if it becomes empty after the YAML sweep.
 */
function _delete_legacy_settings(project: string): string[] {
    const removed: string[] = [];
    for (const p of _detect_legacy_settings(project)) {
        try {
            fs.unlinkSync(p);
            removed.push(path.relative(project, p));
        } catch {
            continue;
        }
    }
    const settings_dir = path.join(project, 'settings');
    if (_isDir(settings_dir) && !_isSymlink(settings_dir)) {
        try {
            if (fs.readdirSync(settings_dir).length === 0) {
                fs.rmdirSync(settings_dir);
                removed.push('settings/');
            }
        } catch {
            // pass
        }
    }
    return removed;
}

function _remove_empty_shell(project: string): boolean {
    const shell = path.join(project, LEGACY_AGENT_CONFIG_SHELL);
    if (!_detect_empty_shell(project)) {
        return false;
    }
    try {
        fs.rmdirSync(shell);
    } catch {
        return false;
    }
    return true;
}

/** Escape a string for a literal RegExp (Python `re.escape`). */
function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _update_gitignore(project: string): boolean {
    const gitignore = path.join(project, '.gitignore');
    const block = `${GITIGNORE_BLOCK_START}\n` + `${GITIGNORE_NEW_BODY}` + `${GITIGNORE_BLOCK_END}\n`;
    if (!_exists(gitignore)) {
        _writeText(gitignore, block);
        return true;
    }

    const text = _readText(gitignore);
    const pattern = new RegExp(
        _reEscape(GITIGNORE_BLOCK_START) + '.*?' + _reEscape(GITIGNORE_BLOCK_END) + '\\n?',
        's',
    );
    let new_text: string;
    if (pattern.test(text)) {
        // Python `re.sub` replaces a `$`-free replacement literally; escape `$`
        // so JS String.replace does not interpret `$&` etc. in `block`.
        new_text = text.replace(pattern, () => block);
    } else {
        new_text = text;
        if (new_text && !new_text.endsWith('\n')) {
            new_text += '\n';
        }
        new_text += block;
    }
    if (new_text === text) {
        return false;
    }
    _writeText(gitignore, new_text);
    return true;
}

// ---------- plan + apply ----------

interface Plan {
    npm: boolean;
    composer: boolean;
    symlinks_legacy: string[];
    symlinks_user: string[];
    state_file: boolean;
    settings_files: string[];
    empty_shell: boolean;
}

/** Return a dict describing every detected legacy signal. */
function _build_plan(project: string): Plan {
    return {
        npm: _detect_npm(path.join(project, 'package.json')),
        composer: _detect_composer(path.join(project, 'composer.json')),
        symlinks_legacy: MANAGED_SYMLINKS.filter(
            (name) => _classify_symlink(path.join(project, name)) === 'legacy',
        ),
        symlinks_user: MANAGED_SYMLINKS.filter(
            (name) => _classify_symlink(path.join(project, name)) === 'user',
        ),
        state_file: _isFile(path.join(project, LEGACY_STATE_FILENAME)),
        settings_files: _detect_legacy_settings(project).map((p) => path.relative(project, p)),
        empty_shell: _detect_empty_shell(project),
    };
}

/** The shared `would …`-voiced action list rendered by --dry-run / --check. */
function _plan_lines(plan: Plan): string[] {
    const lines: string[] = [];
    if (plan.npm) {
        lines.push(`would remove ${PACKAGE_NAME_NPM} from package.json`);
    }
    if (plan.composer) {
        lines.push(`would remove ${PACKAGE_NAME_COMPOSER} from composer.json`);
    }
    for (const name of plan.symlinks_legacy) {
        lines.push(`would remove legacy symlink ${name}`);
    }
    for (const name of plan.symlinks_user) {
        lines.push(`would preserve user-managed ${name} (review manually)`);
    }
    if (plan.state_file) {
        lines.push(`would migrate ${LEGACY_STATE_FILENAME} → ${LEGACY_STATE_V1_FILENAME}`);
    }
    for (const rel of plan.settings_files) {
        lines.push(`would delete legacy config ${rel}`);
    }
    if (plan.empty_shell) {
        lines.push(`would remove empty ${LEGACY_AGENT_CONFIG_SHELL}/ shell`);
    }
    lines.push('would refresh .gitignore agent-config block');
    return lines;
}

function _format_dry_run(plan: Plan, out: OutSink): void {
    _print(out, 'ℹ️  legacy install detected — re-run without --dry-run to migrate:');
    for (const line of _plan_lines(plan)) {
        _print(out, `    - ${line}`);
    }
}

/**
 * Count the concrete migration actions a non-empty plan would perform.
 *
 * The .gitignore refresh is excluded — it is a normalising touch that runs on
 * every apply, not evidence of a legacy install on its own.
 */
function _pending_actions(plan: Plan): number {
    return (
        Number(plan.npm) +
        Number(plan.composer) +
        plan.symlinks_legacy.length +
        plan.symlinks_user.length +
        Number(plan.state_file) +
        plan.settings_files.length +
        Number(plan.empty_shell)
    );
}

/**
 * `--check` report — same signal set as the dry-run plan, framed as a status
 * probe with a pending-count header (exit code carries the verdict).
 */
function _format_check(plan: Plan, out: OutSink): void {
    const n = _pending_actions(plan);
    _print(
        out,
        `⚠️  legacy install detected — ${n} pending action(s) ` +
            '(run `agent-config migrate` to apply, `--dry-run` to preview):',
    );
    for (const line of _plan_lines(plan)) {
        _print(out, `    - ${line}`);
    }
}

/**
 * Advisory note when the declared --from major does not match the detected
 * install signal (4.x ↔ composer entry, 5.x ↔ npm entry). Never blocks: the
 * signal-based plan is authoritative, the declaration is a documentation hint.
 */
function _warn_on_major_mismatch(from_major: string | null, plan: Plan, out: OutSink): void {
    if (from_major === '4' && !plan.composer) {
        _print(
            out,
            'ℹ️  --from 4 declared but no composer.json agent-config entry found; ' +
                'proceeding from the detected signals.',
        );
    } else if (from_major === '5' && !plan.npm) {
        _print(
            out,
            'ℹ️  --from 5 declared but no package.json agent-config entry found; ' +
                'proceeding from the detected signals.',
        );
    }
}

function _apply(project: string, out: OutSink, err: OutSink): number {
    const summary: string[] = [];
    if (_strip_npm_entry(path.join(project, 'package.json'))) {
        summary.push(`removed ${PACKAGE_NAME_NPM} from package.json`);
    }
    if (_strip_composer_entry(path.join(project, 'composer.json'))) {
        summary.push(`removed ${PACKAGE_NAME_COMPOSER} from composer.json`);
    }
    const [removed_links, preserved_links] = _purge_legacy_symlinks(project);
    for (const name of removed_links) {
        summary.push(`removed legacy symlink ${name}`);
    }
    for (const name of preserved_links) {
        summary.push(`preserved user-managed ${name} (review manually)`);
    }
    let state_summary: string | null;
    try {
        state_summary = _migrate_state_file(project);
    } catch (exc) {
        // Surface as exit-1, mirroring the Python `except Exception`.
        _print(err, `❌  state migration failed: ${(exc as Error).message}`);
        return 1;
    }
    if (state_summary) {
        summary.push(state_summary);
    }
    for (const rel of _delete_legacy_settings(project)) {
        summary.push(`deleted legacy config ${rel}`);
    }
    if (_remove_empty_shell(project)) {
        summary.push(`removed empty ${LEGACY_AGENT_CONFIG_SHELL}/ shell`);
    }
    if (_update_gitignore(project)) {
        summary.push('.gitignore agent-config block refreshed');
    }

    _print(out, '✅  migration complete:');
    for (const line of summary) {
        _print(out, `    - ${line}`);
    }
    _print(out, '\n    Next: review the diff and commit.');
    return 0;
}

interface MainOptions {
    cwd?: string | null;
    version?: string | null; // accepted for test compat; unused.
    out?: OutSink;
    err?: OutSink;
}

/** Build the argument parser; mirrors argparse's flags + usage / error exits. */
function _parse(
    argv: string[],
    out: OutSink,
    err: OutSink,
): { dry_run: boolean; check: boolean; from_major: string | null } {
    const prog = 'agent-config migrate';
    const usage = `usage: ${prog} [-h] [--dry-run | --check] [--from {4,5}]\n`;

    const emitError = (msg: string): never => {
        err.write(usage);
        err.write(`${prog}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };

    let dry_run = false;
    let check = false;
    let from_major: string | null = null;

    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '-h' || tok === '--help') {
            out.write(usage);
            throw new ArgparseExit(0);
        } else if (tok === '--dry-run') {
            dry_run = true;
            i += 1;
        } else if (tok === '--check') {
            check = true;
            i += 1;
        } else if (tok === '--from') {
            const val: string | undefined = argv[i + 1];
            if (val === undefined) {
                emitError('argument --from: expected one argument');
                return { dry_run, check, from_major }; // unreachable; satisfies narrowing
            }
            if (val !== '4' && val !== '5') {
                emitError(
                    `argument --from: invalid choice: '${val}' (choose from '4', '5')`,
                );
            }
            from_major = val;
            i += 2;
        } else if (tok.startsWith('--from=')) {
            const val = tok.slice('--from='.length);
            if (val !== '4' && val !== '5') {
                emitError(
                    `argument --from: invalid choice: '${val}' (choose from '4', '5')`,
                );
            }
            from_major = val;
            i += 1;
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }

    if (dry_run && check) {
        emitError('argument --check: not allowed with argument --dry-run');
    }

    return { dry_run, check, from_major };
}

export function main(argv: string[] | null = null, options: MainOptions = {}): number {
    const out = options.out ?? _stdoutSink();
    const err = options.err ?? _stderrSink();
    const args = _parse(argv ?? process.argv.slice(2), out, err);

    const [project] = resolve_project_root(null, { cwd: options.cwd ?? null });

    if (args.from_major) {
        _print(out, `ℹ️  declared source major: ${args.from_major}.x`);
    }

    if (_detect_already_migrated(project)) {
        // `--check` distinguishes "clean" from "legacy" in its wording; the
        // other modes share the canonical idempotent no-op message.
        if (args.check) {
            _print(out, '✅  on the 6.0 layout — no migration needed.');
        } else {
            _print(out, '✅  already migrated — nothing to do.');
        }
        return 0;
    }

    const plan = _build_plan(project);
    _warn_on_major_mismatch(args.from_major, plan, out);

    if (args.check) {
        _format_check(plan, out);
        return 2;
    }

    if (args.dry_run) {
        _format_dry_run(plan, out);
        return 0;
    }

    return _apply(project, out, err);
}

// CLI entry guard — set process.exitCode; never call process.exit().
//
// Bundle-safety: esbuild --bundle rewrites every inlined module's
// `import.meta.url` to the OUTPUT bundle's URL, so this guard would otherwise
// fire spuriously when cmd_migrate is inlined into the installer bundle
// (dist/install/install.mjs) — install.ts owns that entry point and calls
// this module's `main` in-process via `_run_migrate_to_global`. The
// `__AGENT_CONFIG_BUNDLE__` sentinel (replaced with `true` by the bundle
// build's `--define`) disables the auto-run there; under tsx/node it is
// undefined, so `typeof` short-circuits and the standalone CLI guard fires
// normally.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled =
    typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (!_bundled && (_isCliEntry || process.argv[1] === _HERE)) {
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

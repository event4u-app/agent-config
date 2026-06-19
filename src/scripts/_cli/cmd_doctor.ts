#!/usr/bin/env tsx
/**
 * `agent-config doctor` — install + manifest health report (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_doctor.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * report lines (✅/❌/⚠️/⏭️ glyphs, ordering, fix hints), same filesystem
 * semantics. No behaviour changes — latent quirks are replicated, not fixed.
 *
 * Phase 4 of road-to-multi-package-coexistence (drift detection) and
 * Phase 2 of road-to-surface-discipline (diagnostic hub). Read-only
 * sibling to `prune`/`validate`: walks the project manifest and the
 * on-disk deploy roots, runs a battery of health checks, and produces:
 *
 * Drift categories (manifest ↔ filesystem):
 *
 * * `missing`   — manifest entry has a `path` that is **not** on disk.
 * * `modified`  — manifest entry records a `sha256` that does not
 *   match the current bytes on disk.
 * * `foreign`   — file present under one of the `deploy_roots` that
 *   no manifest entry claims (potential neighbour-tool drift).
 * * `tag-drift` — manifest-claimed `.md` file carries a frontmatter
 *   `package:` value that disagrees with this package's identifier
 *   (P5.2). Hand-edited tags or accidental cross-package writes show up
 *   here; files without frontmatter are skipped (P5.1 contract).
 *
 * Health checks (see `CHECK_IDS`):
 * scope · stale-orphans · manifest-integrity · lockfile-freshness · bridge-drift ·
 * mcp-mode · mcp-beta-readiness · offline-readiness · python-runtime ·
 * tier-usage-readiness · council-cli · unsupported-combos ·
 * wizard-state.
 * Each emits a structured `{id, status, message, remedy}` record with
 * `status` ∈ `ok` / `warn` / `fail` / `skipped` (rendered
 * `✅` / `⚠️` / `❌` / `⏭️`). `--check <id>` runs a single check.
 *
 * Exit codes: `0` (clean) · `1` (drift or any `fail` check) · `2`
 * (error such as "manifest missing"). Both human and `--json` output
 * emit the drift category lists and the structured checks array. Every
 * drift entry carries a one-line `fix` hint (P4.3).
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `main()` returns an exit code; the CLI entry guard sets
 *   `process.exitCode` (never `process.exit()`).
 * - argparse errors (unknown flags, bad `--check` / `--repair` choice,
 *   missing argument) print usage + `error:` to stderr and throw
 *   `ArgparseExit(2)`. `-h`/`--help` prints usage to stdout and throws
 *   `ArgparseExit(0)`. The `--help` BODY (per-flag descriptions) is a
 *   documented divergence — argparse re-wraps it to terminal width; the
 *   golden tests assert the `usage:` token + exit code, not the body prose.
 * - JSON byte-parity: the Python uses the DEFAULT `json.dumps(payload,
 *   indent=2)` → `ensure_ascii=True`, so non-ASCII scalars are escaped to
 *   `\uXXXX`. `_jsonDumpsIndentAscii` replicates that (distinct from the
 *   `install.ts` `ensure_ascii=False` dumper). Dict insertion order is
 *   preserved (JS object key order matches Python dict order for string
 *   keys).
 * - `_lib.*` / `scripts.config` / `scripts.ai_council.*` imports resolve to
 *   the `.ts` twins (never a `.py`). The Python dual-path try/except
 *   (`scripts._lib.X` vs `_lib.X`) collapses to a single static import.
 * - `cfg.members` / `cli_call_budget.max_calls_per_day` are `Map`s in the
 *   config twin (Python dicts); iterate with `.entries()` / `.get()`.
 * - `re.MULTILINE` `^package:\s*(.+?)\s*$` → JS regex with the `m` flag and
 *   the same lazy capture (`(.+?)`). `\s` matches the Python ASCII+Unicode
 *   whitespace set the same way under default JS `\s` for our inputs.
 * - `sorted(rglob("*"))` / `sorted(tools.items())` → array sort with the
 *   string comparator (path-string lexicographic, matching pathlib).
 * - PyYAML 1.1 `safe_load` → `yaml.parse(text, { version: '1.1' })`, `{}` on
 *   any error (ImportError / YAMLError), matching the Python `except`.
 * - `json.JSONDecodeError` `.msg` / `.lineno` → derived from the parse error
 *   position so the wizard-state malformed-JSON message matches.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import * as installed_lock from '../_lib/installed_lock.js';
import * as installed_tools from '../_lib/installed_tools.js';
import * as user_global_paths from '../_lib/user_global_paths.js';
import * as global_deploy_inventory from '../_lib/global_deploy_inventory.js';
import {
    PROJECT_ROOT_ENV,
    ROOT_OVERRIDE_ENV,
    ProjectRootError,
    find_project_root_with_trace,
    project_settings_path,
    resolve_project_root,
    type TraceRecord,
} from '../_lib/agent_settings.js';
import * as ai_council_clients from '../ai_council/clients.js';
import * as ai_council_config from '../ai_council/config.js';

type Dict = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Parity primitives (ADR-200).
// ---------------------------------------------------------------------------

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/** `os.path.expanduser` — expand a leading `~` (we only handle `~`). */
function expanduser(p: string): string {
    if (p === '~') return os.homedir();
    if (p.startsWith('~/') || p.startsWith('~\\')) {
        return path.join(os.homedir(), p.slice(2));
    }
    return p;
}

function pathExists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
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

/** `Path.resolve()` — absolute, symlink-resolved where possible. */
function resolvePath(p: string): string {
    try {
        return fs.realpathSync(path.resolve(p));
    } catch {
        return path.resolve(p);
    }
}

/** `path.read_text(encoding="utf-8")`; throws on OSError (caller catches). */
function readText(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

// --- JSON byte-parity (ensure_ascii=True; insertion order) ---
//
// The doctor's JSON paths use the DEFAULT `json.dumps(payload, indent=2)`,
// i.e. `ensure_ascii=True`: every non-ASCII code point is escaped to a
// `\uXXXX` (or surrogate pair) sequence. This differs from `install.ts`'s
// `ensure_ascii=False` dumper, so it lives here.

function _jsonStrAscii(s: string): string {
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
                } else if (code < 0x7f) {
                    out += ch;
                } else if (code <= 0xffff) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    // ensure_ascii encodes astral chars as a UTF-16 surrogate pair.
                    const v = code - 0x10000;
                    const hi = 0xd800 + (v >> 10);
                    const lo = 0xdc00 + (v & 0x3ff);
                    out +=
                        '\\u' +
                        hi.toString(16).padStart(4, '0') +
                        '\\u' +
                        lo.toString(16).padStart(4, '0');
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

/** `json.dumps(data, indent=N)` (ensure_ascii=True, sort_keys=False). */
function _jsonDumpsIndentAscii(value: unknown, indent: number): string {
    return _dumpIndentAscii(value, indent, 0);
}

/** PyYAML-1.1 `safe_load`; returns `null` on an ImportError-equivalent
 *  (yaml dep absent), `undefined` on a YAMLError-equivalent. Callers collapse
 *  both to `{}`, matching the Python `try/except ImportError` + `except`. */
function yamlSafeLoad(text: string): unknown {
    if (YAML === undefined || YAML === null) {
        return null; // ImportError (yaml unavailable)
    }
    try {
        return YAML.parse(text, { version: '1.1' });
    } catch {
        return undefined; // YAMLError sentinel
    }
}

/** `print(...)` — line to stdout. */
function print(line = ''): void {
    process.stdout.write(line + '\n');
}

/** `print(..., file=sys.stderr)`. */
function eprint(line = ''): void {
    process.stderr.write(line + '\n');
}

// ---------------------------------------------------------------------------
// Module body (cmd_doctor.py).
// ---------------------------------------------------------------------------

/** Tiny stand-in for a private sentinel value type. */
class _Sentinel {}

/**
 * Returned by `_read_inline_package_tag` when the file is out of scope for
 * tag-drift detection (no `.md` suffix, unreadable, or no leading
 * frontmatter block).
 */
const NO_FRONTMATTER = new _Sentinel();

function _resolve_project_root(arg: string | null): [string, string] {
    return resolve_project_root(arg);
}

/**
 * Path of the install-mode marker file (Step 8 A5). One-line file:
 * `minimal\n` or `full\n`.
 */
const _INSTALL_MODE_MARKER_REL = 'agents/.agent-state/install-mode.txt';

function _detect_install_mode(project_root: string): [string, string] {
    const marker = path.join(project_root, _INSTALL_MODE_MARKER_REL);
    if (isFile(marker)) {
        let value: string;
        try {
            value = readText(marker).trim();
        } catch {
            value = '';
        }
        if (value === 'minimal' || value === 'full') {
            return [value, 'marker-file'];
        }
    }
    const has_agents_md = pathExists(path.join(project_root, 'AGENTS.md'));
    const has_copilot = pathExists(
        path.join(project_root, '.github', 'copilot-instructions.md'),
    );
    if (has_agents_md && has_copilot) {
        return ['full', 'heuristic'];
    }
    return ['minimal', 'heuristic'];
}

function _settings_layer_chain(project_root: string): string[] {
    const layers: string[] = [];
    const user_global = user_global_paths.resolve_with_fallback('agent-settings.yml');
    if (user_global !== null && isFile(user_global)) {
        layers.push(String(user_global));
    }
    const project_settings = project_settings_path(project_root);
    if (isFile(project_settings)) {
        layers.push(String(project_settings));
    }
    return layers;
}

function _detect_wrapper(project_root: string): Dict {
    const wrapper = path.join(project_root, 'agent-config');
    if (!pathExists(wrapper)) {
        return { path: String(wrapper), exists: false, embedded_root: null };
    }
    return {
        path: String(wrapper),
        exists: true,
        embedded_root: String(project_root),
    };
}

function _emit_trace_text(
    root: string | null,
    anchor: string | null,
    trace: TraceRecord[],
    origin: string,
): void {
    print(`  📍  start: ${process.cwd()}`);
    print(`  📍  origin: ${origin}`);
    if (trace.length > 0) {
        print('  trace:');
        for (const record of trace) {
            const hit = record.hit;
            const symbol = hit ? '✅' : '·';
            const tag = `[${record.pass}]`;
            const anchor_str = hit ? ` → ${hit}` : '';
            print(`    ${symbol} ${tag} ${record.ancestor}${anchor_str}  (${record.reason})`);
        }
    }
    if (root !== null) {
        print(`  📍  resolved root: ${root} (anchor: ${anchor || 'n/a'})`);
    } else {
        print('  ⚠️   no anchor found in chain');
    }
}

function _emit_trace_json(
    root: string | null,
    anchor: string | null,
    trace: TraceRecord[],
    origin: string,
): void {
    const payload: Dict = {
        start: process.cwd(),
        origin,
        resolved_root: root !== null ? String(root) : null,
        anchor,
        trace,
    };
    print(_jsonDumpsIndentAscii(payload, 2));
}

function _emit_context_text(ctx: Dict): void {
    print(`  📍  project_root: ${ctx['project_root']}  (origin: ${ctx['origin']})`);
    print(`  📦  install_mode: ${ctx['install_mode']}  (source: ${ctx['install_mode_source']})`);
    const env_pin = ctx['env_pin'];
    if (env_pin) {
        const marker = ctx['root_override'] ? ' (--root override)' : '';
        print(`  🔒  env_pin: ${env_pin}${marker}`);
    } else {
        print('  🔒  env_pin: (unset)');
    }
    const layers = (ctx['settings_layers'] as string[] | undefined) || [];
    if (layers.length > 0) {
        print(`  📑  settings layers (${layers.length}):`);
        for (const layer of layers) {
            print(`        - ${layer}`);
        }
    } else {
        print('  📑  settings layers: (none)');
    }
    const wrapper = (ctx['wrapper'] as Dict | undefined) || {};
    if (wrapper['exists']) {
        print(`  🧩  wrapper: ${wrapper['path']}  (embedded root: ${wrapper['embedded_root']})`);
    } else {
        print(`  🧩  wrapper: (not present at ${wrapper['path']})`);
    }
}

function _resolve_path(project_root: string, raw: string): string {
    let p = expanduser(raw);
    if (!path.isAbsolute(p)) {
        p = path.join(project_root, p);
    }
    return p;
}

function _sha256(p: string): string | null {
    try {
        const data = fs.readFileSync(p);
        return crypto.createHash('sha256').update(data).digest('hex');
    } catch {
        return null;
    }
}

/**
 * Inline-tag identifier this package writes into deployed Markdown
 * frontmatter (P5.1). Kept in sync with `install.PACKAGE_TAG_ID`.
 */
const PACKAGE_TAG_ID = 'event4u/agent-config';

const _FRONTMATTER_PACKAGE_RE = /^package:\s*(.+?)\s*$/m;

/**
 * Extract the inline `package:` value from a Markdown frontmatter.
 *
 * Returns `NO_FRONTMATTER` when `path` is not a Markdown file or has no
 * leading `---` block. Returns `null` when frontmatter is present but lacks
 * a `package:` key. Returns the string value otherwise.
 */
function _read_inline_package_tag(p: string): string | null | _Sentinel {
    if (path.extname(p) !== '.md') {
        return NO_FRONTMATTER;
    }
    let text: string;
    try {
        text = readText(p);
    } catch {
        return NO_FRONTMATTER;
    }
    if (!(text.startsWith('---\n') || text.startsWith('---\r\n'))) {
        return NO_FRONTMATTER;
    }
    const lines = splitlines(text);
    let close_idx: number | null = null;
    for (let i = 1; i < lines.length; i++) {
        if (rstrip(lines[i] as string) === '---') {
            close_idx = i;
            break;
        }
    }
    if (close_idx === null) {
        return NO_FRONTMATTER;
    }
    const block = lines.slice(1, close_idx).join('\n');
    const m = _FRONTMATTER_PACKAGE_RE.exec(block);
    if (!m) {
        return null;
    }
    return stripQuotes((m[1] as string).trim());
}

/** Python `str.splitlines()` for the line-set the parser needs (\n, \r\n, \r). */
function splitlines(text: string): string[] {
    if (text === '') return [];
    const out = text.split(/\r\n|\r|\n/);
    // Python splitlines() drops a trailing empty produced by a terminal newline.
    if (out.length > 0 && out[out.length - 1] === '') {
        out.pop();
    }
    return out;
}

/** Python `str.rstrip()` (default whitespace, ASCII+Unicode). */
function rstrip(s: string): string {
    return s.replace(/[\s ]+$/u, '');
}

/** Python `value.strip().strip("'\"")` tail (after `.strip()` already done). */
function stripQuotes(s: string): string {
    let out = s;
    while (out.length > 0 && (out[0] === "'" || out[0] === '"')) {
        out = out.slice(1);
    }
    while (out.length > 0 && (out[out.length - 1] === "'" || out[out.length - 1] === '"')) {
        out = out.slice(0, -1);
    }
    return out;
}

/** Return a one-line remediation hint for the surfaced item. */
function _fix_hint(category: string, _kind: string | null): string {
    if (category === 'missing') {
        return 'run `./agent-config sync` to re-install';
    }
    if (category === 'modified') {
        return 'commit the local change, or re-install with --force';
    }
    if (category === 'foreign') {
        return 'identify owning tool, or run `./agent-config prune` if confirmed orphan';
    }
    if (category === 'tag-drift') {
        return (
            're-install with --force to restore the inline tag, ' +
            'or remove the file if it is no longer ours'
        );
    }
    return '';
}

type ManifestRecord = [string, string, string, string | null]; // (tool, abs_path, kind, sha)

/**
 * Flatten v2 `tools[].files[]` into per-file records. Returns the records list
 * and a set of resolved absolute paths so the foreign scan can skip claims.
 */
function _collect_manifest_entries(
    project_root: string,
    manifest: Dict,
): [ManifestRecord[], Set<string>] {
    const records: ManifestRecord[] = [];
    const known = new Set<string>();
    const tools = (manifest['tools'] as Dict[] | undefined) || [];
    for (const tool of tools) {
        if (tool['scope'] !== 'project') {
            continue;
        }
        const tool_id = String(tool['name'] ?? '');
        const files = (tool['files'] as Dict[] | undefined) || [];
        for (const entry of files) {
            const raw = (entry['path'] as string | undefined) || '';
            if (!raw) {
                continue;
            }
            const kind = (entry['kind'] as string | undefined) || '';
            const target = _resolve_path(project_root, raw);
            let resolved: string;
            try {
                resolved = resolvePath(target);
            } catch {
                resolved = target;
            }
            records.push([tool_id, target, kind, (entry['sha256'] as string | null) ?? null]);
            known.add(resolved);
        }
    }
    return [records, known];
}

/**
 * Walk every declared deploy root and surface unclaimed files. Only regular
 * files under `deploy_roots` count; bookkeeping is on the resolved final path.
 */
function _scan_foreign(
    project_root: string,
    manifest: Dict,
    known: Set<string>,
): string[] {
    const roots =
        (manifest['deploy_roots'] as unknown[] | undefined) ||
        Array.from(installed_tools.DEFAULT_DEPLOY_ROOTS);
    const foreign: string[] = [];
    const seen = new Set<string>();
    for (const root_rel of roots) {
        const root = _resolve_path(project_root, String(root_rel));
        if (!pathExists(root) || !isDir(root)) {
            continue;
        }
        for (const child of rglob(root)) {
            if (!isFile(child)) {
                continue;
            }
            let resolved: string;
            try {
                resolved = resolvePath(child);
            } catch {
                resolved = child;
            }
            if (known.has(resolved) || seen.has(resolved)) {
                continue;
            }
            seen.add(resolved);
            foreign.push(child);
        }
    }
    foreign.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return foreign;
}

/**
 * `Path.rglob("*")` — every descendant path (dirs + files), recursively.
 * Order is not relied upon by callers (they sort the matched set), but the
 * walk is deterministic (sorted per directory) to keep behaviour stable.
 */
function rglob(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            out.push(full);
            let dirLike = ent.isDirectory();
            if (ent.isSymbolicLink()) {
                // pathlib rglob follows into symlinked dirs.
                dirLike = isDir(full);
            }
            if (dirLike) {
                walk(full);
            }
        }
    };
    walk(root);
    return out;
}

/**
 * Split manifest records into missing / modified / tag-drift lists.
 */
function _classify(records: ManifestRecord[]): [Dict[], Dict[], Dict[]] {
    const missing: Dict[] = [];
    const modified: Dict[] = [];
    const tag_drift: Dict[] = [];
    for (const [tool_id, target, kind, expected] of records) {
        if (!pathExists(target)) {
            missing.push({
                tool: tool_id,
                path: String(target),
                kind,
                fix: _fix_hint('missing', kind),
            });
            continue;
        }
        const tag = _read_inline_package_tag(target);
        if (!(tag instanceof _Sentinel) && tag !== PACKAGE_TAG_ID) {
            tag_drift.push({
                tool: tool_id,
                path: String(target),
                kind,
                expected: PACKAGE_TAG_ID,
                found: tag === null ? '' : tag,
                fix: _fix_hint('tag-drift', kind),
            });
        }
        if (expected === null) {
            continue;
        }
        const actual = _sha256(target);
        if (actual === null || actual === expected) {
            continue;
        }
        modified.push({
            tool: tool_id,
            path: String(target),
            kind,
            fix: _fix_hint('modified', kind),
        });
    }
    return [missing, modified, tag_drift];
}

function _foreign_records(project_root: string, foreign: string[]): Dict[] {
    const out: Dict[] = [];
    for (const p of foreign) {
        let path_str: string;
        const rel = relativeTo(p, project_root);
        if (rel !== null) {
            path_str = rel;
        } else {
            path_str = String(p);
        }
        out.push({
            tool: '',
            path: path_str,
            kind: 'deployed',
            fix: _fix_hint('foreign', 'deployed'),
        });
    }
    return out;
}

/** `Path.relative_to(base)` — returns null on ValueError (not under base). */
function relativeTo(p: string, base: string): string | null {
    const rel = path.relative(base, p);
    if (rel === '' ) return rel;
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return rel;
}

// ---------------------------------------------------------------------------
// Health checks (Phase 2 of road-to-surface-discipline).
// ---------------------------------------------------------------------------

/** Ordered registry of structured health-check identifiers. */
const CHECK_IDS = [
    'scope',
    'global-binary',
    'stale-orphans',
    'manifest-integrity',
    'lockfile-freshness',
    'bridge-drift',
    'mcp-mode',
    'mcp-beta-readiness',
    'offline-readiness',
    'python-runtime',
    'tier-usage-readiness',
    'council-cli',
    'unsupported-combos',
    'wizard-state',
] as const;

/** Checks that need only the project root and run regardless of a lockfile. */
const GLOBAL_CHECK_IDS: ReadonlySet<string> = new Set([
    'scope',
    'global-binary',
    'stale-orphans',
    'mcp-mode',
    'mcp-beta-readiness',
    'offline-readiness',
    'python-runtime',
    'tier-usage-readiness',
    'council-cli',
    'wizard-state',
]);

/** Checks that genuinely cannot run without the project manifest. */
const MANIFEST_REQUIRED_CHECK_IDS: ReadonlySet<string> = new Set([
    'manifest-integrity',
    'lockfile-freshness',
    'unsupported-combos',
]);

/** Project-root-relative path of the ADR-020 global-only consumer marker. */
const BRIDGE_MARKER_RELATIVE = 'agents/.event4u-bridge.yml';

/** Repair targets that `--repair <id>` accepts. */
const REPAIR_IDS = ['wizard-state'] as const;

/** Six gates that govern the MCP `experimental → beta` promotion. */
const MCP_BETA_GATES: ReadonlyArray<[string, string]> = [
    ['gate-1-external-client', 'tests/mcp/external-clients'],
    ['gate-2-bearer-auth', 'tests/mcp/auth'],
    ['gate-3-parity-smoke', 'tests/mcp/parity'],
    ['gate-4-healthz-load', 'tests/mcp/load/healthz.k6.js'],
    ['gate-5-rate-limit', 'docs/contracts/mcp-rate-limit.md'],
    ['gate-6-no-drift', '.github/workflows/mcp-no-drift.yml'],
];

/** Visible status → glyph map (`warn` keeps a trailing space for alignment). */
const STATUS_SYMBOLS: Record<string, string> = {
    ok: '✅',
    warn: '⚠️ ',
    fail: '❌',
    skipped: '⏭️ ',
};

/** Minimum Python interpreter the CLI targets (parity constant). */
const MIN_PYTHON: [number, number] = [3, 10];

function _check_scope(project_root: string): Dict {
    for (const marker of ['pnpm-workspace.yaml', 'lerna.json']) {
        if (pathExists(path.join(project_root, marker))) {
            return {
                id: 'scope',
                status: 'warn',
                message: `monorepo root detected (${marker})`,
                remedy: 'run `agent-config doctor` from each workspace package',
            };
        }
    }
    const pkg = path.join(project_root, 'package.json');
    if (pathExists(pkg)) {
        try {
            const data = JSON.parse(readText(pkg)) as Dict;
            if (data['workspaces']) {
                return {
                    id: 'scope',
                    status: 'warn',
                    message: 'package.json declares workspaces (monorepo root)',
                    remedy: 'run `agent-config doctor` from each workspace package',
                };
            }
        } catch {
            // OSError / ValueError → fall through.
        }
    }
    return {
        id: 'scope',
        status: 'ok',
        message: 'standalone project root',
        remedy: '',
    };
}

function _check_manifest_integrity(manifest: Dict): Dict {
    const schema = manifest['schema_version'];
    const version = manifest['agent_config_version'];
    if (!version) {
        return {
            id: 'manifest-integrity',
            status: 'warn',
            message: 'manifest lacks `agent_config_version`',
            remedy: 're-run `./agent-config init` to record the writer version',
        };
    }
    if (!installed_tools.SCHEMA_VERSIONS_SUPPORTED.includes(schema as number)) {
        return {
            id: 'manifest-integrity',
            status: 'warn',
            message: `unknown schema_version: ${pyRepr(schema)}`,
            remedy:
                'upgrade @event4u/agent-config to a writer that recognises this schema',
        };
    }
    return {
        id: 'manifest-integrity',
        status: 'ok',
        message: `schema v${schema}, written by agent-config ${version}`,
        remedy: '',
    };
}

/** Resolve the @event4u/agent-config package root (this repo). */
function _package_root(): string {
    // cmd_doctor lives at src/scripts/_cli/cmd_doctor.{py,ts}; parents[3] = repo.
    return path.resolve(path.dirname(_HERE), '..', '..', '..');
}

/** Read `version` from this package's package.json; null on error. */
function _current_package_version(): string | null {
    try {
        const data = JSON.parse(readText(path.join(_package_root(), 'package.json'))) as Dict;
        const v = data['version'];
        if (typeof v === 'string' && v.trim()) {
            return v.trim();
        }
    } catch {
        // OSError / ValueError → null.
    }
    return null;
}

function _check_lockfile_freshness(manifest: Dict): Dict {
    const recorded = manifest['agent_config_version'];
    const current = _current_package_version();
    if (!recorded) {
        return {
            id: 'lockfile-freshness',
            status: 'warn',
            message: 'manifest has no writer version recorded',
            remedy: 're-run `./agent-config init` to refresh the manifest',
        };
    }
    if (current === null) {
        return {
            id: 'lockfile-freshness',
            status: 'warn',
            message: `manifest written by ${recorded}; current package version unknown`,
            remedy: 'verify the package install (package.json missing or unreadable)',
        };
    }
    if (recorded !== current) {
        return {
            id: 'lockfile-freshness',
            status: 'warn',
            message: `manifest writer ${recorded} != current package ${current}`,
            remedy:
                're-run `./agent-config sync` to refresh the manifest against the current package',
        };
    }
    return {
        id: 'lockfile-freshness',
        status: 'ok',
        message: `manifest and package both at ${current}`,
        remedy: '',
    };
}

/** `shutil.which(name)` — first PATH hit (with PATHEXT on win32). */
function shutilWhich(name: string): string | null {
    if (path.dirname(name) !== '.' && (name.includes('/') || name.includes('\\'))) {
        // Has a path component: check directly.
        return isExecutableFile(name) ? name : null;
    }
    const pathEnv = process.env['PATH'] || '';
    const sep = process.platform === 'win32' ? ';' : ':';
    const dirs = pathEnv.split(sep);
    const exts =
        process.platform === 'win32'
            ? (process.env['PATHEXT'] || '.COM;.EXE;.BAT;.CMD').split(';')
            : [''];
    const seenDirs = new Set<string>();
    for (const dir of dirs) {
        const d = dir === '' ? '.' : dir;
        if (seenDirs.has(d)) continue;
        seenDirs.add(d);
        for (const ext of exts) {
            const candidate = path.join(d, name + (ext === '' ? '' : ext.toLowerCase() === ext ? ext : ext));
            if (isExecutableFile(candidate)) {
                return candidate;
            }
            if (ext !== '') {
                const upper = path.join(d, name + ext);
                if (isExecutableFile(upper)) return upper;
            }
        }
    }
    return null;
}

function isExecutableFile(p: string): boolean {
    try {
        const st = fs.statSync(p);
        if (!st.isFile()) return false;
        if (process.platform === 'win32') return true;
        fs.accessSync(p, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function _check_global_binary(project_root: string): Dict {
    const binary = shutilWhich('agent-config');
    if (!binary) {
        return {
            id: 'global-binary',
            status: 'fail',
            message:
                '`agent-config` is not on PATH — Claude plugin hooks ' +
                'cannot resolve it (hooks silently no-op)',
            remedy: 'npm install -g @event4u/agent-config, then re-run doctor',
        };
    }
    const lock = installed_lock.read_lockfile();
    let global_v = '';
    if (lock !== null && typeof lock === 'object') {
        const raw = (lock as unknown as Dict)['agent_config_version'];
        global_v = typeof raw === 'string' ? lstripV(raw.trim()) : '';
    }
    const binary_v = lstripV(_current_package_version() || '');
    if (global_v && binary_v && global_v !== binary_v) {
        return {
            id: 'global-binary',
            status: 'warn',
            message: `version drift — binary ${binary_v}, global install ${global_v}`,
            remedy: 'agent-config upgrade (refresh the global install + plugin)',
        };
    }
    const bridge = path.join(project_root, 'agents', '.event4u-bridge.yml');
    const bridge_note = isFile(bridge) ? '' : ' · no project bridge marker';
    return {
        id: 'global-binary',
        status: 'ok',
        message: `on PATH (${binary}); version ${binary_v || 'unknown'}${bridge_note}`,
        remedy: !bridge_note
            ? ''
            : 'agent-config refresh --project (scaffold the bridge marker)',
    };
}

/** Python `str.lstrip("v")` — strip leading 'v' characters. */
function lstripV(s: string): string {
    let out = s;
    while (out.length > 0 && out[0] === 'v') {
        out = out.slice(1);
    }
    return out;
}

function _check_bridge_drift(
    missing: Dict[],
    modified: Dict[],
    foreign: Dict[],
    tag_drift: Dict[],
): Dict {
    const total = missing.length + modified.length + foreign.length + tag_drift.length;
    if (total === 0) {
        return {
            id: 'bridge-drift',
            status: 'ok',
            message: 'manifest matches filesystem (no drift)',
            remedy: '',
        };
    }
    const parts: string[] = [];
    if (missing.length) parts.push(`${missing.length} missing`);
    if (modified.length) parts.push(`${modified.length} modified`);
    if (foreign.length) parts.push(`${foreign.length} foreign`);
    if (tag_drift.length) parts.push(`${tag_drift.length} tag-drift`);
    return {
        id: 'bridge-drift',
        status: 'fail',
        message: `${total} drift item(s): ${parts.join(', ')}`,
        remedy: 'see the drift section below or run `./agent-config sync`',
    };
}

function _check_mcp_mode(project_root: string): Dict {
    const candidates: ReadonlyArray<[string, string]> = [
        ['.cursor/mcp.json', 'cursor'],
        ['.ai/mcp/mcp.json', 'ai-mcp'],
        ['mcp.json', 'root'],
    ];
    const found: string[] = [];
    for (const [rel, label] of candidates) {
        const p = path.join(project_root, rel);
        if (!pathExists(p)) {
            continue;
        }
        try {
            JSON.parse(readText(p));
            found.push(`${label} (${rel})`);
        } catch {
            return {
                id: 'mcp-mode',
                status: 'warn',
                message: `MCP config at ${rel} is not valid JSON`,
                remedy: `fix or remove \`${rel}\` (see docs/architecture.md § MCP)`,
            };
        }
    }
    if (found.length === 0) {
        return {
            id: 'mcp-mode',
            status: 'ok',
            message: 'no MCP config present (MCP Beta off)',
            remedy: '',
        };
    }
    return {
        id: 'mcp-mode',
        status: 'ok',
        message: `MCP config detected: ${found.join(', ')}`,
        remedy: '',
    };
}

function _check_offline_readiness(): Dict {
    const script = path.join(_package_root(), 'src', 'scripts', 'hermetic-install.sh');
    if (!pathExists(script)) {
        return {
            id: 'offline-readiness',
            status: 'warn',
            message: 'src/scripts/hermetic-install.sh not found in package',
            remedy: 'reinstall @event4u/agent-config or pull missing files',
        };
    }
    return {
        id: 'offline-readiness',
        status: 'ok',
        message: 'verified-offline install entrypoint present',
        remedy: '',
    };
}

function _check_stale_orphans(): Dict {
    const gdi = global_deploy_inventory;

    const inv = gdi.load_inventory();
    const tools = (inv['tools'] as Dict | undefined) ?? {};
    if (typeof tools !== 'object' || tools === null || Object.keys(tools).length === 0) {
        return {
            id: 'stale-orphans',
            status: 'ok',
            message: 'no global-deploy inventory yet — nothing to reconcile',
            remedy: '',
        };
    }
    let orphan_count = 0;
    const sample: string[] = [];
    const toolEntries = Object.entries(tools).sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    );
    for (const [tool_id, entryRaw] of toolEntries) {
        const entry = entryRaw as Dict;
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const anchor_raw = entry['anchor'];
        const recorded = entry['files'];
        if (typeof anchor_raw !== 'string' || !Array.isArray(recorded)) {
            continue;
        }
        const anchor = expanduser(anchor_raw);
        if (!isDir(anchor)) {
            continue;
        }
        const recorded_set = new Set(recorded.filter((r) => typeof r === 'string') as string[]);
        // Bound the scan to the top-level subtrees the package actually owns.
        const owned_roots = new Set<string>();
        for (const r of recorded_set) {
            if (r.includes('/')) {
                owned_roots.add(r.split('/', 1)[0] as string);
            }
        }
        const ownedSorted = Array.from(owned_roots).sort((a, b) =>
            a < b ? -1 : a > b ? 1 : 0,
        );
        for (const root_name of ownedSorted) {
            const root = path.join(anchor, root_name);
            if (!isDir(root)) {
                continue;
            }
            for (const md of rglob(root)) {
                if (isDir(md)) {
                    continue;
                }
                if (!md.endsWith('.md')) {
                    // rglob("*.md") in Python: only .md basenames.
                    continue;
                }
                const rel = relativeTo(md, anchor);
                if (rel === null) {
                    continue;
                }
                const relPosix = rel.split(path.sep).join('/');
                if (recorded_set.has(relPosix)) {
                    continue;
                }
                const tag = _read_inline_package_tag(md);
                if (tag instanceof _Sentinel || tag !== PACKAGE_TAG_ID) {
                    continue;
                }
                orphan_count += 1;
                if (sample.length < 5) {
                    sample.push(`${tool_id}:${relPosix}`);
                }
            }
        }
    }
    if (orphan_count === 0) {
        return {
            id: 'stale-orphans',
            status: 'ok',
            message: 'no stale package-tagged files under recorded anchors',
            remedy: '',
        };
    }
    return {
        id: 'stale-orphans',
        status: 'warn',
        message:
            `${orphan_count} stale package-tagged file(s) not tracked by the ` +
            `deploy inventory (e.g. ${sample.join(', ')})`,
        remedy:
            'run `agent-config global` to reap them ' +
            '(the tag sweep reconciles on every deploy)',
    };
}

function _check_python_runtime(): Dict {
    // Post-teardown: the package runtime is TypeScript-on-`tsx`. python3 is no
    // longer a runtime dependency, so this check no longer probes for an
    // interpreter (spawning python3 here would be misleading in a python-free
    // package). The check id is retained for the doctor's stable report shape;
    // it always reports `ok`.
    return {
        id: 'python-runtime',
        status: 'ok',
        message: 'python3 is not a runtime dependency (TS runtime via tsx)',
        remedy: '',
    };
}

function _check_mcp_beta_readiness(project_root: string): Dict {
    const pending: string[] = [];
    for (const [gate_id, rel] of MCP_BETA_GATES) {
        if (!pathExists(path.join(project_root, rel))) {
            pending.push(`${gate_id} (${rel})`);
        }
    }
    if (pending.length === 0) {
        return {
            id: 'mcp-beta-readiness',
            status: 'ok',
            message: 'all 6 MCP beta gates green — promotion authorized',
            remedy: '',
        };
    }
    return {
        id: 'mcp-beta-readiness',
        status: 'warn',
        message: `${pending.length}/6 MCP beta gate(s) pending: ${pending.join(', ')}`,
        remedy:
            'produce the artefacts listed in ' +
            'docs/contracts/mcp-beta-criteria.md (one per gate); ' +
            'do not flip `experimental` wording until all 6 are green',
    };
}

function _check_tier_usage_readiness(project_root: string): Dict {
    const settings_file = project_settings_path(project_root);
    let log_path = path.join(project_root, '.agent-tier-usage.jsonl');
    let enabled = false;
    if (isFile(settings_file)) {
        let raw: unknown;
        const loaded = yamlSafeLoad(readText0(settings_file));
        if (loaded === null) {
            // ImportError (yaml unavailable) → skip; enabled stays false.
            raw = null;
        } else {
            raw = loaded === undefined ? {} : loaded;
            if (raw === null || raw === undefined) raw = {};
            const rawDict = (typeof raw === 'object' && raw !== null && !Array.isArray(raw))
                ? (raw as Dict)
                : {};
            const teleRaw = rawDict['telemetry'];
            const tele = (typeof teleRaw === 'object' && teleRaw !== null && !Array.isArray(teleRaw))
                ? (teleRaw as Dict)
                : {};
            const tuRaw = tele['tier_usage'];
            const tu =
                typeof tuRaw === 'object' && tuRaw !== null && !Array.isArray(tuRaw)
                    ? (tuRaw as Dict)
                    : null;
            if (tu !== null) {
                const outputRaw = tu['output'];
                const output =
                    typeof outputRaw === 'object' && outputRaw !== null && !Array.isArray(outputRaw)
                        ? (outputRaw as Dict)
                        : {};
                if (typeof output['path'] === 'string' && (output['path'] as string).trim()) {
                    log_path = path.join(project_root, (output['path'] as string).trim());
                }
                const val = tu['enabled'];
                if (typeof val === 'boolean') {
                    enabled = val;
                } else if (typeof val === 'string') {
                    enabled = ['true', 'yes', 'on', '1'].includes(val.trim().toLowerCase());
                } else {
                    enabled = false;
                }
            }
        }
    }

    if (!enabled) {
        return {
            id: 'tier-usage-readiness',
            status: 'warn',
            message:
                'tier-usage telemetry disabled — empirical retiering ' +
                'decisions fall back to operator judgement',
            remedy:
                'set `telemetry.tier_usage.enabled: true` in ' +
                '.agent-settings.yml (default-off; opt-in)',
        };
    }
    if (!pathExists(log_path)) {
        return {
            id: 'tier-usage-readiness',
            status: 'warn',
            message:
                `tier-usage telemetry on but ${path.basename(log_path)} not yet ` +
                'written — no signal accumulated',
            remedy:
                'run any tracked command to seed the log; the dispatcher ' +
                'writes one record per invocation',
        };
    }
    let total = 0;
    let valid = 0;
    const allowed_fields = new Set(['ts_bucket', 'command', 'tier', 'outcome', 'user_hash']);
    const allowed_outcomes = new Set(['success', 'error', 'blocked']);
    let content: string;
    try {
        content = readText0(log_path);
    } catch (exc) {
        return {
            id: 'tier-usage-readiness',
            status: 'fail',
            message: `cannot read ${path.basename(log_path)}: ${osErrorStr(exc)}`,
            remedy: 'fix permissions on the tier-usage log',
        };
    }
    for (let line of splitlines(content)) {
        line = line.trim();
        if (!line) {
            continue;
        }
        total += 1;
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            continue;
        }
        const o = obj as Dict;
        if (!Object.keys(o).every((k) => allowed_fields.has(k))) {
            continue;
        }
        if (
            typeof o['command'] === 'string' &&
            o['command'] &&
            typeof o['tier'] === 'number' &&
            Number.isInteger(o['tier']) &&
            [0, 1, 2, 3].includes(o['tier'] as number) &&
            allowed_outcomes.has(o['outcome'] as string) &&
            typeof o['user_hash'] === 'string' &&
            (o['user_hash'] as string).length === 16 &&
            typeof o['ts_bucket'] === 'string'
        ) {
            valid += 1;
        }
    }
    if (total > 0 && valid === 0) {
        return {
            id: 'tier-usage-readiness',
            status: 'fail',
            message:
                `${total} record(s) in ${path.basename(log_path)} but 0 passed the ` +
                'privacy floor — report would refuse to render',
            remedy:
                'inspect the log; the dispatcher is writing records the ' +
                'contract forbids (paths, argv, message bodies)',
        };
    }
    if (valid === 0) {
        return {
            id: 'tier-usage-readiness',
            status: 'warn',
            message: `${path.basename(log_path)} present but empty — no signal yet`,
            remedy: 'run any tracked command to seed the log',
        };
    }
    return {
        id: 'tier-usage-readiness',
        status: 'ok',
        message:
            `${valid} record(s) past the privacy floor in ${path.basename(log_path)} ` +
            '— retiering signal available',
        remedy: '',
    };
}

/** read_text that re-throws OSError-like errors (used where Python catches them). */
function readText0(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

/** Render an OSError-equivalent like Python's `str(exc)` for the message. */
function osErrorStr(exc: unknown): string {
    if (exc && typeof exc === 'object' && 'message' in exc) {
        return String((exc as { message: unknown }).message);
    }
    return String(exc);
}

/**
 * Provider → (default binary, billable flag). Mirrors the `CliClient`
 * subclass attributes without importing them at module load time.
 */
const _CLI_PROVIDER_META: Record<string, [string, boolean]> = {
    anthropic: ['claude', false],
    openai: ['codex', false],
    gemini: ['gemini', false],
    xai: ['grok', true],
    perplexity: ['perplexity', true],
};

function _check_council_cli(project_root: string): Dict {
    // Python wraps the council-module import in a try/except ImportError so a
    // broken council install degrades to a `warn` instead of crashing doctor.
    // In the TS twin the council twins are statically bundled — the import can
    // never fail — so the "council deps unavailable" arm is unreachable here.
    // `errTypeName` is retained for parity with that arm's wording shape.
    const { load_cli_call_counts } = ai_council_clients;
    const { load_council_config, resolve_config_path } = ai_council_config;
    const council_path = resolve_config_path(project_root);
    if (!pathExists(String(council_path))) {
        return {
            id: 'council-cli',
            status: 'ok',
            message: `no council config (${council_path} not present)`,
            remedy:
                'create the user-global council config at ' +
                `${council_path} (see docs/contracts/ai-council-config.md)`,
        };
    }
    let cfg: ai_council_config.CouncilConfig;
    try {
        cfg = load_council_config(council_path);
    } catch (exc) {
        return {
            id: 'council-cli',
            status: 'warn',
            message: `council config invalid: ${excStr(exc)}`,
            remedy: `fix ${council_path} and re-run doctor`,
        };
    }
    const cli_members: Array<[string, ai_council_config.MemberConfig]> = [];
    for (const [name, m] of cfg.members.entries()) {
        if (m.enabled && m.mode === 'cli' && name in _CLI_PROVIDER_META) {
            cli_members.push([name, m]);
        }
    }
    if (cli_members.length === 0) {
        return {
            id: 'council-cli',
            status: 'ok',
            message: 'no enabled CLI-mode members',
            remedy: '',
        };
    }
    const counts = load_cli_call_counts();
    const caps = cfg.cli_call_budget.max_calls_per_day;
    const warn_at = cfg.cli_call_budget.warn_at;
    const missing: string[] = [];
    const over_warn: string[] = [];
    const lines: string[] = [];
    for (const [name, member] of cli_members) {
        const [default_bin, billable] = _CLI_PROVIDER_META[name] as [string, boolean];
        const binary_name = member.binary || default_bin;
        const resolved = shutilWhich(binary_name);
        const binary_glyph = resolved ? '✅' : '❌';
        if (resolved === null) {
            missing.push(name);
        }
        const used = Math.trunc((counts[name] as number | undefined) ?? 0);
        const cap = caps.get(name);
        let quota_glyph: string;
        let quota_str: string;
        if (cap !== undefined && cap !== null) {
            const ratio = cap > 0 ? used / cap : 0.0;
            quota_glyph = ratio >= warn_at ? '⚠️' : '✅';
            if (ratio >= warn_at) {
                over_warn.push(name);
            }
            quota_str = `${used}/${cap}`;
        } else {
            quota_glyph = '—';
            quota_str = `${used}/—`;
        }
        const billable_str = billable ? 'billable' : 'subscription';
        lines.push(
            `${name}: binary ${binary_glyph} (${binary_name}) · ` +
                `quota ${quota_glyph} ${quota_str} · ${billable_str}`,
        );
    }
    const detail = lines.join(' | ');
    if (missing.length > 0) {
        return {
            id: 'council-cli',
            status: 'warn',
            message:
                `${missing.length}/${cli_members.length} CLI member(s) missing binary ` +
                `(${missing.join(', ')}) · ${detail}`,
            remedy:
                'install the missing CLI(s) — see `council:estimate` pre-flight ' +
                'for per-provider install hints, or flip ' +
                "ai_council.members.<name>.mode to 'api'",
        };
    }
    if (over_warn.length > 0) {
        return {
            id: 'council-cli',
            status: 'warn',
            message:
                `${over_warn.length}/${cli_members.length} CLI member(s) at/over ` +
                `quota warn_at=${pyFloat(warn_at)} (${over_warn.join(', ')}) · ${detail}`,
            remedy:
                'wait for UTC rollover or run ' +
                '`./scripts-run src/scripts/council_cli quota --reset` to clear the counter',
        };
    }
    return {
        id: 'council-cli',
        status: 'ok',
        message: `${cli_members.length} CLI member(s) healthy · ${detail}`,
        remedy: '',
    };
}

/** Python `str(exc)` for an exception interpolated into a message. */
function excStr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

/**
 * Render a float the way Python `str(float)` would for the `warn_at` value
 * interpolated into the message (e.g. `0.8` not `0.8000000001`; `1.0` keeps
 * the `.0`). The config carries a plain JS number; `warn_at` defaults are
 * one-decimal fractions, so `String()` already matches Python for those.
 */
function pyFloat(value: number): string {
    if (Number.isInteger(value)) {
        return `${value}.0`;
    }
    return String(value);
}

function _check_unsupported_combos(manifest: Dict): Dict {
    const global_only = new Set(['droid', 'qoder']);
    const bad: string[] = [];
    const tools = (manifest['tools'] as Dict[] | undefined) || [];
    for (const tool of tools) {
        const name = String(tool['name'] ?? '');
        const scope = tool['scope'];
        if (global_only.has(name) && scope !== 'global') {
            bad.push(`${name} (scope=${scope}, requires global)`);
        }
    }
    if (bad.length > 0) {
        return {
            id: 'unsupported-combos',
            status: 'fail',
            message: `${bad.length} tool(s) with unsupported scope: ${bad.join(', ')}`,
            remedy: 're-install the listed tools with `--global --force`',
        };
    }
    return {
        id: 'unsupported-combos',
        status: 'ok',
        message: 'all installed tools use supported scopes',
        remedy: '',
    };
}

function _wizard_state_path(): string {
    return path.join(user_global_paths.event4u_root(), 'state', 'wizard-state.json');
}

function _check_wizard_state(): Dict {
    const state_pth = _wizard_state_path();
    if (!pathExists(state_pth)) {
        return {
            id: 'wizard-state',
            status: 'ok',
            message: 'no active wizard session',
            remedy: '',
        };
    }
    let raw: string;
    try {
        raw = readText0(state_pth);
    } catch (exc) {
        return {
            id: 'wizard-state',
            status: 'fail',
            message: `unreadable wizard-state at ${state_pth}: ${osErrorStr(exc)}`,
            remedy: 'agent-config doctor --repair wizard-state',
        };
    }
    let data: unknown;
    try {
        data = parseJsonPy(raw);
    } catch (exc) {
        const de = exc as JsonDecodeError;
        return {
            id: 'wizard-state',
            status: 'fail',
            message: `malformed JSON in wizard-state (${de.msg} at line ${de.lineno})`,
            remedy: 'agent-config doctor --repair wizard-state',
        };
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return {
            id: 'wizard-state',
            status: 'fail',
            message: `wizard-state root is ${pyTypeName(data)}, expected object`,
            remedy: 'agent-config doctor --repair wizard-state',
        };
    }
    const d = data as Dict;
    const step = d['step'];
    const partial = 'partial' in d ? d['partial'] : {};
    if (typeof step !== 'number' || !Number.isInteger(step) || (step as number) < 0 || typeof step === 'boolean') {
        return {
            id: 'wizard-state',
            status: 'fail',
            message: `wizard-state.step is ${pyRepr(step)}, expected non-negative integer`,
            remedy: 'agent-config doctor --repair wizard-state',
        };
    }
    if (typeof partial !== 'object' || partial === null || Array.isArray(partial)) {
        return {
            id: 'wizard-state',
            status: 'fail',
            message: `wizard-state.partial is ${pyTypeName(partial)}, expected object`,
            remedy: 'agent-config doctor --repair wizard-state',
        };
    }
    const total = d['totalSteps'];
    if (
        total !== undefined &&
        total !== null &&
        (typeof total !== 'number' || !Number.isInteger(total) || (total as number) < 1 || typeof total === 'boolean')
    ) {
        return {
            id: 'wizard-state',
            status: 'fail',
            message: `wizard-state.totalSteps is ${pyRepr(total)}, expected positive integer or omitted`,
            remedy: 'agent-config doctor --repair wizard-state',
        };
    }
    const suffix =
        typeof total === 'number' && Number.isInteger(total) && typeof total !== 'boolean'
            ? ` of ${total}`
            : '';
    return {
        id: 'wizard-state',
        status: 'ok',
        message: `resumable wizard session at step ${(step as number) + 1}${suffix}`,
        remedy: '',
    };
}

interface JsonDecodeError {
    msg: string;
    lineno: number;
    colno: number;
}

/**
 * Parse JSON the way Python's `json.loads` does, surfacing a
 * `json.JSONDecodeError`-shaped error with `.msg`/`.lineno`/`.colno` so the
 * malformed-JSON message matches. JS `JSON.parse` reports a char offset (not
 * line/col), so we recompute the line/col from the offset in the error text.
 */
function parseJsonPy(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch (e) {
        const m = String((e as Error).message);
        // Node V8: "... in JSON at position N (line L column C)" or "position N".
        let pos = -1;
        const posM = m.match(/position (\d+)/);
        if (posM) pos = Number.parseInt(posM[1] as string, 10);
        let lineno = 1;
        let colno = 1;
        if (pos >= 0) {
            let line = 1;
            let col = 1;
            for (let i = 0; i < pos && i < text.length; i++) {
                if (text[i] === '\n') {
                    line += 1;
                    col = 1;
                } else {
                    col += 1;
                }
            }
            lineno = line;
            colno = col;
        }
        // Python's msg is e.g. "Expecting value"; V8's differs. The golden
        // tests normalize the `.msg` token (it diverges by engine) and assert
        // the structural shape + lineno. We surface a best-effort msg so the
        // sentence renders; the lineno is the load-bearing, parity-stable part.
        const err: JsonDecodeError = { msg: pythonJsonMsg(m), lineno, colno };
        throw err;
    }
}

/** Map a V8 JSON error to the closest Python `json` message token. */
function pythonJsonMsg(v8msg: string): string {
    if (/Unexpected end of JSON input/.test(v8msg)) return 'Expecting value';
    if (/Unexpected token/.test(v8msg)) return 'Expecting value';
    if (/Expected property name/.test(v8msg)) return 'Expecting property name enclosed in double quotes';
    return 'Expecting value';
}

/** Python `type(x).__name__` for the JSON-shape error messages. */
function pyTypeName(value: unknown): string {
    if (value === null) return 'NoneType';
    if (Array.isArray(value)) return 'list';
    switch (typeof value) {
        case 'boolean':
            return 'bool';
        case 'number':
            return Number.isInteger(value) ? 'int' : 'float';
        case 'string':
            return 'str';
        case 'object':
            return 'dict';
        default:
            return typeof value;
    }
}

/** Python `repr()` for the scalar values interpolated with `{x!r}`. */
function pyRepr(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'number') {
        if (Number.isInteger(value)) return String(value);
        return String(value);
    }
    if (typeof value === 'string') {
        // Python repr prefers single quotes; escapes backslash + the quote.
        const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `'${escaped}'`;
    }
    if (Array.isArray(value)) {
        return '[' + value.map((v) => pyRepr(v)).join(', ') + ']';
    }
    if (typeof value === 'object') {
        const obj = value as Dict;
        const parts = Object.keys(obj).map((k) => `${pyRepr(k)}: ${pyRepr(obj[k])}`);
        return '{' + parts.join(', ') + '}';
    }
    return String(value);
}

type CheckRunner = () => Dict;

function _run_checks(
    project_root: string,
    manifest: Dict,
    drift: Record<string, Dict[]>,
    only: string | null = null,
): Dict[] {
    const runners: Record<string, CheckRunner> = {
        scope: () => _check_scope(project_root),
        'global-binary': () => _check_global_binary(project_root),
        'stale-orphans': _check_stale_orphans,
        'manifest-integrity': () => _check_manifest_integrity(manifest),
        'lockfile-freshness': () => _check_lockfile_freshness(manifest),
        'bridge-drift': () =>
            _check_bridge_drift(
                drift['missing'] as Dict[],
                drift['modified'] as Dict[],
                drift['foreign'] as Dict[],
                drift['tag_drift'] as Dict[],
            ),
        'mcp-mode': () => _check_mcp_mode(project_root),
        'mcp-beta-readiness': () => _check_mcp_beta_readiness(project_root),
        'offline-readiness': () => _check_offline_readiness(),
        'python-runtime': () => _check_python_runtime(),
        'tier-usage-readiness': () => _check_tier_usage_readiness(project_root),
        'council-cli': () => _check_council_cli(project_root),
        'unsupported-combos': () => _check_unsupported_combos(manifest),
        'wizard-state': _check_wizard_state,
    };
    const out: Dict[] = [];
    for (const cid of CHECK_IDS) {
        if (only !== null && cid !== only) {
            continue;
        }
        out.push((runners[cid] as CheckRunner)());
    }
    return out;
}

function _skipped_manifest_check(check_id: string): Dict {
    return {
        id: check_id,
        status: 'skipped',
        message: 'requires a project lockfile (agents/installed-tools.lock)',
        remedy:
            'run `agent-config init` to create a project lockfile, ' +
            'then re-run this check',
    };
}

function _check_bridge_drift_no_manifest(bridge_present: boolean): Dict {
    if (bridge_present) {
        return {
            id: 'bridge-drift',
            status: 'ok',
            message:
                'no project lockfile → distributed-tool drift not ' +
                'applicable (global-only consumer)',
            remedy: '',
        };
    }
    return {
        id: 'bridge-drift',
        status: 'skipped',
        message:
            'no project lockfile and no bridge marker → drift check ' +
            'not applicable',
        remedy:
            'run `agent-config init` (project install) or ' +
            '`agent-config refresh --project` (global-only consumer)',
    };
}

function _run_checks_no_manifest(
    project_root: string,
    bridge_present: boolean,
    only: string | null = null,
): Dict[] {
    const runners: Record<string, CheckRunner> = {
        scope: () => _check_scope(project_root),
        'global-binary': () => _check_global_binary(project_root),
        'stale-orphans': _check_stale_orphans,
        'manifest-integrity': () => _skipped_manifest_check('manifest-integrity'),
        'lockfile-freshness': () => _skipped_manifest_check('lockfile-freshness'),
        'bridge-drift': () => _check_bridge_drift_no_manifest(bridge_present),
        'mcp-mode': () => _check_mcp_mode(project_root),
        'mcp-beta-readiness': () => _check_mcp_beta_readiness(project_root),
        'offline-readiness': () => _check_offline_readiness(),
        'python-runtime': () => _check_python_runtime(),
        'tier-usage-readiness': () => _check_tier_usage_readiness(project_root),
        'council-cli': () => _check_council_cli(project_root),
        'unsupported-combos': () => _skipped_manifest_check('unsupported-combos'),
        'wizard-state': _check_wizard_state,
    };
    const out: Dict[] = [];
    for (const cid of CHECK_IDS) {
        if (only !== null && cid !== only) {
            continue;
        }
        out.push((runners[cid] as CheckRunner)());
    }
    return out;
}

function _run_no_manifest(
    opts: Options,
    project_root: string,
    origin: string,
    bridge_present: boolean,
): number {
    const checks = _run_checks_no_manifest(project_root, bridge_present, opts.check);
    const fail_check = checks.some((c) => c['status'] === 'fail');
    const skipped_requested =
        opts.check !== null &&
        checks.some((c) => c['id'] === opts.check && c['status'] === 'skipped');

    if (opts.json) {
        _emit_json(project_root, [], [], [], [], checks, origin);
    } else if (opts.check === null) {
        print(`  📍  project_root: ${project_root} (origin: ${origin})`);
        if (bridge_present) {
            print(
                '  ℹ️   global-only consumer: bridge marker present, no ' +
                    'project lockfile (expected under ADR-020)',
            );
            print(
                '      project-manifest checks are skipped — they apply only ' +
                    'to project-local distributed tools',
            );
        } else {
            eprint(`  ⚠️   no project lockfile and no bridge marker at ${project_root}`);
            eprint(
                '      run `agent-config init` (project install) or ' +
                    '`agent-config refresh --project` (global-only consumer)',
            );
        }
        _emit_checks_text(checks);
    } else {
        _emit_checks_text(checks);
    }

    if (opts.check !== null) {
        if (skipped_requested) {
            return 2;
        }
        return fail_check ? 1 : 0;
    }
    return bridge_present ? 0 : 2;
}

function _emit_json(
    project_root: string,
    missing: Dict[],
    modified: Dict[],
    foreign: Dict[],
    tag_drift: Dict[],
    checks: Dict[] | null = null,
    origin: string | null = null,
): void {
    const payload: Dict = {
        project_root: String(project_root),
        missing,
        modified,
        foreign,
        tag_drift,
    };
    if (origin !== null) {
        payload['project_root_origin'] = origin;
    }
    if (checks !== null) {
        payload['checks'] = checks;
    }
    print(_jsonDumpsIndentAscii(payload, 2));
}

function _emit_checks_text(checks: Dict[]): void {
    if (checks.length === 0) {
        return;
    }
    print('checks:');
    for (const c of checks) {
        const sym = STATUS_SYMBOLS[c['status'] as string] ?? '?';
        print(`  ${sym} ${c['id']}: ${c['message']}`);
        if (c['status'] !== 'ok' && c['remedy']) {
            print(`      fix: ${c['remedy']}`);
        }
    }
    print('');
}

function _emit_text(
    project_root: string,
    missing: Dict[],
    modified: Dict[],
    foreign: Dict[],
    tag_drift: Dict[],
): void {
    const total = missing.length + modified.length + foreign.length + tag_drift.length;
    if (total === 0) {
        print(`✅  doctor: manifest matches filesystem under ${project_root}`);
        return;
    }
    print(`⚠️   doctor: ${total} drift item(s) under ${project_root}`);
    const groups: ReadonlyArray<[string, Dict[]]> = [
        ['missing', missing],
        ['modified', modified],
        ['foreign', foreign],
        ['tag-drift', tag_drift],
    ];
    for (const [label, items] of groups) {
        if (items.length === 0) {
            continue;
        }
        print(`\n  ${label} (${items.length}):`);
        for (const it of items) {
            const tool = (it['tool'] as string) || '?';
            print(`    · [${tool}] ${it['path']}`);
            if (label === 'tag-drift') {
                const found = (it['found'] as string) || '(missing)';
                const expected = 'expected' in it ? it['expected'] : PACKAGE_TAG_ID;
                print(`        expected: ${expected}`);
                print(`        found:    ${found}`);
            }
            print(`        fix: ${it['fix']}`);
        }
    }
}

interface Options {
    project: string | null;
    json: boolean;
    check: string | null;
    trace_root: boolean;
    context: boolean;
    repair: string | null;
}

const PROG = 'agent-config doctor';

// Verbatim argparse usage block (captured from the .py at COLUMNS=80). The
// per-flag `--help` BODY is a documented divergence — argparse re-wraps it to
// terminal width; golden tests assert the `usage:` token + exit code only.
const USAGE =
    `usage: ${PROG} [-h] [--project PROJECT] [--json] [--check ID]\n` +
    '                           [--trace-root] [--context] [--repair ID]\n';

const _STORE_TRUE_FLAGS: Record<string, keyof Options> = {
    '--json': 'json',
    '--trace-root': 'trace_root',
    '--context': 'context',
};

const _VALUE_FLAGS: Record<string, keyof Options> = {
    '--project': 'project',
    '--check': 'check',
    '--repair': 'repair',
};

function _argError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): Options {
    const opts: Record<string, unknown> = {
        project: null,
        json: false,
        check: null,
        trace_root: false,
        context: false,
        repair: null,
    };

    const positionals: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            throw new ArgparseExit(0);
        }
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;

        const storeTrueDest = _STORE_TRUE_FLAGS[flag];
        if (storeTrueDest !== undefined) {
            if (inlineVal !== null) {
                _argError(`argument ${flag}: ignored explicit argument '${inlineVal}'`);
            }
            (opts as Dict)[storeTrueDest] = true;
            i += 1;
            continue;
        }
        const valueDest = _VALUE_FLAGS[flag];
        if (valueDest !== undefined) {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) {
                    _argError(`argument ${argMetaName(flag)}: expected one argument`);
                }
                value = argv[i + 1] as string;
                i += 1;
            }
            if (flag === '--check' && !CHECK_IDS.includes(value as (typeof CHECK_IDS)[number])) {
                _argError(
                    `argument --check: invalid choice: '${value}' ` +
                        `(choose from ${CHECK_IDS.map((c) => `'${c}'`).join(', ')})`,
                );
            }
            if (flag === '--repair' && !REPAIR_IDS.includes(value as (typeof REPAIR_IDS)[number])) {
                _argError(
                    `argument --repair: invalid choice: '${value}' ` +
                        `(choose from ${REPAIR_IDS.map((c) => `'${c}'`).join(', ')})`,
                );
            }
            (opts as Dict)[valueDest] = value;
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
    return opts as unknown as Options;
}

/** argparse's metavar for the missing-argument error (`--check` → `ID`). */
function argMetaName(flag: string): string {
    if (flag === '--check') return '--check';
    if (flag === '--repair') return '--repair';
    return flag;
}

function _run_trace_root(opts: Options): number {
    const start = process.cwd();
    const [root, anchor, trace] = find_project_root_with_trace(start);
    let origin: string;
    if (process.env[ROOT_OVERRIDE_ENV] === '1' && process.env[PROJECT_ROOT_ENV]) {
        origin = 'root-flag';
    } else if (opts.project) {
        origin = 'explicit';
    } else if (process.env[PROJECT_ROOT_ENV]) {
        origin = 'env';
    } else if (root !== null) {
        origin = anchor || 'unknown';
    } else {
        origin = 'cwd-fallback';
    }
    if (opts.json) {
        _emit_trace_json(root, anchor, trace, origin);
    } else {
        _emit_trace_text(root, anchor, trace, origin);
    }
    return 0;
}

function _run_context(opts: Options): number {
    let project_root: string;
    let origin: string;
    try {
        [project_root, origin] = _resolve_project_root(opts.project);
    } catch (exc) {
        if (exc instanceof ProjectRootError) {
            eprint(`❌  doctor: ${exc.message}`);
            return 2;
        }
        throw exc;
    }
    const [mode, mode_source] = _detect_install_mode(project_root);
    const ctx: Dict = {
        project_root: String(project_root),
        origin,
        install_mode: mode,
        install_mode_source: mode_source,
        env_pin: process.env[PROJECT_ROOT_ENV] || null,
        root_override: process.env[ROOT_OVERRIDE_ENV] === '1',
        settings_layers: _settings_layer_chain(project_root),
        wrapper: _detect_wrapper(project_root),
    };
    if (opts.json) {
        print(_jsonDumpsIndentAscii(ctx, 2));
    } else {
        _emit_context_text(ctx);
    }
    return 0;
}

function _run_repair(opts: Options): number {
    const target = opts.repair;
    if (target === 'wizard-state') {
        const state_pth = _wizard_state_path();
        const exists = pathExists(state_pth);
        const payload: Dict = {
            id: 'wizard-state',
            path: String(state_pth),
            action: exists ? 'remove' : 'noop',
        };
        if (exists) {
            try {
                fs.unlinkSync(state_pth);
            } catch (exc) {
                payload['action'] = 'error';
                payload['error'] = osErrorStr(exc);
                if (opts.json) {
                    print(_jsonDumpsIndentAscii(payload, 2));
                } else {
                    eprint(`❌  doctor: could not remove ${state_pth}: ${osErrorStr(exc)}`);
                }
                return 2;
            }
        }
        if (opts.json) {
            print(_jsonDumpsIndentAscii(payload, 2));
        } else {
            if (payload['action'] === 'remove') {
                print(`✅  doctor: reset wizard-state (${state_pth})`);
            } else {
                print(`✅  doctor: nothing to repair (no wizard-state at ${state_pth})`);
            }
        }
        return 0;
    }
    eprint(`❌  doctor: unknown repair target ${pyRepr(target)}`);
    return 2;
}

function main(argv: string[] | null = null): number {
    const opts = _parse(argv !== null ? Array.from(argv) : process.argv.slice(2));
    if (opts.repair !== null) {
        return _run_repair(opts);
    }
    if (opts.trace_root) {
        return _run_trace_root(opts);
    }
    if (opts.context) {
        return _run_context(opts);
    }
    let project_root: string;
    let origin: string;
    try {
        [project_root, origin] = _resolve_project_root(opts.project);
    } catch (exc) {
        if (exc instanceof ProjectRootError) {
            eprint(`❌  doctor: ${exc.message}`);
            return 2;
        }
        throw exc;
    }
    const manifest_pth = installed_tools.manifest_path(project_root);
    const manifest = installed_tools.read_manifest(manifest_pth);
    if (manifest === null) {
        const bridge_present = isFile(path.join(project_root, BRIDGE_MARKER_RELATIVE));
        return _run_no_manifest(opts, project_root, origin, bridge_present);
    }

    const [records, known] = _collect_manifest_entries(project_root, manifest);
    const [missing, modified, tag_drift] = _classify(records);
    const foreign = _foreign_records(project_root, _scan_foreign(project_root, manifest, known));
    const drift_groups: Record<string, Dict[]> = {
        missing,
        modified,
        foreign,
        tag_drift,
    };
    const checks = _run_checks(project_root, manifest, drift_groups, opts.check);
    const fail_check = checks.some((c) => c['status'] === 'fail');

    if (opts.json) {
        _emit_json(project_root, missing, modified, foreign, tag_drift, checks, origin);
    } else {
        if (opts.check === null) {
            print(`  📍  project_root: ${project_root} (origin: ${origin})`);
        }
        _emit_checks_text(checks);
        if (opts.check === null) {
            _emit_text(project_root, missing, modified, foreign, tag_drift);
        }
    }

    if (opts.check !== null) {
        return fail_check ? 1 : 0;
    }
    return missing.length || modified.length || foreign.length || tag_drift.length ? 1 : 0;
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export {
    main,
    _parse,
    _resolve_project_root,
    _detect_install_mode,
    _settings_layer_chain,
    _detect_wrapper,
    _read_inline_package_tag,
    _fix_hint,
    _collect_manifest_entries,
    _scan_foreign,
    _classify,
    _foreign_records,
    _check_scope,
    _check_manifest_integrity,
    _check_lockfile_freshness,
    _check_global_binary,
    _check_bridge_drift,
    _check_mcp_mode,
    _check_offline_readiness,
    _check_stale_orphans,
    _check_python_runtime,
    _check_mcp_beta_readiness,
    _check_tier_usage_readiness,
    _check_council_cli,
    _check_unsupported_combos,
    _check_wizard_state,
    _run_checks,
    _skipped_manifest_check,
    _check_bridge_drift_no_manifest,
    _run_checks_no_manifest,
    _emit_json,
    _emit_checks_text,
    _emit_text,
    _wizard_state_path,
    _run_repair,
    _run_trace_root,
    _run_context,
    CHECK_IDS,
    GLOBAL_CHECK_IDS,
    MANIFEST_REQUIRED_CHECK_IDS,
    BRIDGE_MARKER_RELATIVE,
    REPAIR_IDS,
    MCP_BETA_GATES,
    STATUS_SYMBOLS,
    MIN_PYTHON,
    PACKAGE_TAG_ID,
    NO_FRONTMATTER,
    ArgparseExit,
    _jsonDumpsIndentAscii,
};
export type { Options };

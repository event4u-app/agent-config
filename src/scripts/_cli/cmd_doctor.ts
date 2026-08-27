#!/usr/bin/env tsx
/**
 * `agent-config doctor` — install + manifest health report (TypeScript twin).
 *
 * Ported from the retired Python `src/scripts/_cli/cmd_doctor.py` (ADR-200, py2ts
 * migration). The CLI contract pins the historical contract exactly — same
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
 * scope · global-binary · claude-plugin · stale-orphans · manifest-integrity ·
 * lockfile-freshness · bridge-drift · mcp-mode · mcp-beta-readiness ·
 * offline-readiness · python-runtime · humanizer-runtime · tier-usage-readiness ·
 * council-cli · team ·
 * unsupported-combos · wizard-state · settings-review-pending ·
 * memory-merge-union · duplicate-scope-rules.
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

import { _check_overrides } from './doctor_overrides.js';
import { _is_global_only_consumer } from './doctor_install_mode.js';
// Forwarded, not re-declared: both names moved to doctor_install_mode.ts and existing
// importers of cmd_doctor.js keep resolving. `export ... from` rather than an import,
// because INSTALL_MODE_MARKER_RELATIVE is not referenced here any more and an unused
// import would be dropped — silently breaking whoever imports it from this path.
export { INSTALL_MODE_MARKER_RELATIVE, _is_global_only_consumer } from './doctor_install_mode.js';
import * as claude_plugin from '../_lib/claude_plugin.js';
import * as claude_settings_hooks from '../_lib/claude_settings_hooks.js';
import { _is_source_repo } from './cmd_refresh.js';
import * as installed_lock from '../_lib/installed_lock.js';
import * as installed_tools from '../_lib/installed_tools.js';
import * as user_global_paths from '../_lib/user_global_paths.js';
import * as global_deploy_inventory from '../_lib/global_deploy_inventory.js';
import { censusDuplicateScope } from '../_lib/duplicate_scope_census.js';
import * as preamble_byte_census from '../preamble_byte_census.js';
import * as dispatch_economy_report from '../dispatch_economy_report.js';
import * as runtime_wiring from '../_lib/runtime_wiring_checks.js';
import * as install_reach from '../_lib/install_reach_checks.js';
import * as runtime_checks from '../_lib/doctor_runtime_checks.js';
import { git_common_dir } from '../_lib/git_common_dir.js';
import * as sync_gitattributes from '../sync_gitattributes.js';
import {
    PROJECT_ROOT_ENV,
    ROOT_OVERRIDE_ENV,
    ProjectRootError,
    find_project_root_with_trace,
    iter_setting_overrides,
    project_settings_path,
    resolve_project_root,
    type TraceRecord,
} from '../_lib/agent_settings.js';
import * as ai_council_clients from '../ai_council/clients.js';
import * as ai_council_config from '../ai_council/config.js';
import {
    PROVIDER_CLI_META,
    codexHome,
    detectEnvironment,
} from '../_lib/environment_detector.js';
import {
    absentCouncilFacts,
    buildDetectionReport,
    detectionJson,
    renderDetectionLines,
    type CouncilFacts,
    type CouncilMemberFacts,
    type DetectionReport,
} from './detection_report.js';
import { review_gate_doctor_signal } from '../ai_team/review_gate.js';
import { resolvePackageRoot } from '../_lib/package_root.js';
import {
    LEGACY_ALL,
    excludedRuleBasenames,
    ruleScopeFromSettings,
    type RuleScope,
} from '../../install/rule_scope.js';

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
    return s.replace(/[\s\u0085 ]+$/u, '');
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
    'git-identity',
    'claude-plugin',
    'claude-command-wrappers',
    'surface-state',
    'hook-wiring',
    ...runtime_wiring.WIRING_CHECK_IDS,
    ...install_reach.REACH_CHECK_IDS,
    'stale-orphans',
    'overrides',
    'rule-scope-drift',
    'manifest-integrity',
    'lockfile-freshness',
    'bridge-drift',
    'mcp-mode',
    'mcp-beta-readiness',
    'offline-readiness',
    'python-runtime',
    'humanizer-runtime',
    'tier-usage-readiness',
    'council-cli',
    'detection',
    'team',
    'unsupported-combos',
    'wizard-state',
    'settings-review-pending',
    'memory-merge-union',
    'duplicate-scope-rules',
] as const;

/** Checks that need only the project root and run regardless of a lockfile. */
const GLOBAL_CHECK_IDS: ReadonlySet<string> = new Set([
    'scope',
    'global-binary',
    'git-identity',
    'claude-plugin',
    'claude-command-wrappers',
    'surface-state',
    'hook-wiring',
    ...runtime_wiring.WIRING_CHECK_IDS,
    ...install_reach.REACH_CHECK_IDS,
    'stale-orphans',
    'overrides',
    'rule-scope-drift',
    'mcp-mode',
    'mcp-beta-readiness',
    'offline-readiness',
    'python-runtime',
    'humanizer-runtime',
    'tier-usage-readiness',
    'council-cli',
    'detection',
    'team',
    'wizard-state',
    'settings-review-pending',
    'memory-merge-union',
    'duplicate-scope-rules',
]);

/** Checks that genuinely cannot run without the project manifest. */
const MANIFEST_REQUIRED_CHECK_IDS: ReadonlySet<string> = new Set([
    'manifest-integrity',
    'lockfile-freshness',
    'unsupported-combos',
]);


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

/** Placeholder git identities that must never author real history — the
 * 8.11 feedback found 72/100 recent commits stamped `t <t@t.t>` because a
 * repo-local config carried a throwaway identity. Reads config FILES (no
 * shell-out): repo-local wins over global, worktree gitdirs resolved. */
const _PLACEHOLDER_EMAIL_RE = /^(t@t\.t|.*@example\.(com|org)|.*@localhost)$/i;
const _PLACEHOLDER_NAME_RE = /^(t|test|user|nobody|x)$/i;

export function _git_config_path(project_root: string): string | null {
    // The `.git`-file / `commondir` walk this used to inline now lives in
    // `_lib/git_common_dir.ts`, so the session register and this check cannot
    // drift into two different answers to "where is the common dir".
    const common = git_common_dir(project_root);
    return common === null ? null : path.join(common, 'config');
}

function _parse_git_user(configText: string): { name: string | null; email: string | null } {
    let inUser = false;
    let name: string | null = null;
    let email: string | null = null;
    for (const raw of configText.split('\n')) {
        const line = raw.trim();
        if (line.startsWith('[')) {
            inUser = /^\[user\]/i.test(line);
            continue;
        }
        if (!inUser) {
            continue;
        }
        const m = line.match(/^(name|email)\s*=\s*(.+)$/i);
        if (m !== null) {
            if (m[1]!.toLowerCase() === 'name') name = m[2]!.trim();
            else email = m[2]!.trim();
        }
    }
    return { name, email };
}

export function _check_git_identity(project_root: string): Dict {
    const cfgPath = _git_config_path(project_root);
    if (cfgPath === null || !pathExists(cfgPath)) {
        return { id: 'git-identity', status: 'skipped', message: 'not a git repository', remedy: '' };
    }
    let ident = _parse_git_user(readText(cfgPath));
    if (ident.name === null && ident.email === null) {
        const globalCfg = path.join(os.homedir(), '.gitconfig');
        if (pathExists(globalCfg)) {
            ident = _parse_git_user(readText(globalCfg));
        }
    }
    if (ident.name === null && ident.email === null) {
        return {
            id: 'git-identity',
            status: 'warn',
            message: 'no git user identity configured (repo or global)',
            remedy: 'git config user.name "<you>" && git config user.email "<you@host>"',
        };
    }
    const badEmail = ident.email !== null && _PLACEHOLDER_EMAIL_RE.test(ident.email);
    const badName = ident.name !== null && _PLACEHOLDER_NAME_RE.test(ident.name);
    if (badEmail || badName) {
        return {
            id: 'git-identity',
            status: 'warn',
            message: `placeholder git identity configured: ${ident.name ?? '?'} <${ident.email ?? '?'}> — commits will be unattributable`,
            remedy: 'git config user.name "<you>" && git config user.email "<you@host>" (and add a .mailmap for already-authored history)',
        };
    }
    return {
        id: 'git-identity',
        status: 'ok',
        message: `${ident.name ?? '?'} <${ident.email ?? '?'}>`,
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
    return resolvePackageRoot(import.meta.url);
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
export function shutilWhich(name: string): string | null {
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
    const consumer_note = _is_global_only_consumer(project_root)
        ? ''
        : ' · no project install marker';
    return {
        id: 'global-binary',
        status: 'ok',
        message: `on PATH (${binary}); version ${binary_v || 'unknown'}${consumer_note}`,
        remedy: !consumer_note
            ? ''
            : 'agent-config refresh --project (scaffold agents/overrides/)',
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

/**
 * Claude Code plugin state under the single-surface model
 * (road-to-claude-code-single-surface): the `~/.claude/` file projection is
 * THE distribution surface for Claude Code — content, and hooks via the
 * managed settings.json block. An installed marketplace plugin next to the
 * projection is a **duplicate surface**: every skill/command lists twice
 * and the plugin's SHA snapshot rots silently. That is `fail`, with the
 * uninstall command as the fix (never uninstalled autonomously — the plugin
 * is a user-owned surface).
 */
function _check_claude_plugin(): Dict {
    const claude = shutilWhich('claude');
    if (claude === null) {
        return {
            id: 'claude-plugin',
            status: 'skipped',
            message: 'Claude Code CLI not on PATH — plugin check not applicable',
            remedy: '',
        };
    }
    if (!claude_plugin.claude_plugin_installed()) {
        return {
            id: 'claude-plugin',
            status: 'ok',
            message:
                'plugin not installed (single-surface model — the ~/.claude/ file ' +
                'projection carries content AND hooks)',
            remedy: '',
        };
    }
    const projection = path.join(os.homedir(), '.claude', 'skills');
    const projection_present = isDir(projection);
    if (projection_present) {
        return {
            id: 'claude-plugin',
            status: 'fail',
            message:
                'duplicate surface: the marketplace plugin AND the ~/.claude/ file ' +
                'projection are both installed — every skill/command lists twice and ' +
                'the plugin snapshot rots silently',
            remedy:
                `claude plugin uninstall ${claude_plugin.CLAUDE_PLUGIN_ID}@${claude_plugin.CLAUDE_MARKETPLACE_NAME} ` +
                '(hooks stay — they are registered in ~/.claude/settings.json; ' +
                'verify with the hook-wiring check)',
        };
    }
    const snapshot_v = lstripV(claude_plugin.claude_plugin_snapshot_version() || '');
    const binary_v = lstripV(_current_package_version() || '');
    if (snapshot_v && binary_v && snapshot_v !== binary_v) {
        return {
            id: 'claude-plugin',
            status: 'warn',
            message: `plugin snapshot ${snapshot_v} lags binary ${binary_v} — its command surface is stale`,
            remedy:
                'agent-config upgrade (refreshes the plugin), or ' +
                `claude plugin update ${claude_plugin.CLAUDE_PLUGIN_ID}@${claude_plugin.CLAUDE_MARKETPLACE_NAME}`,
        };
    }
    return {
        id: 'claude-plugin',
        status: 'warn',
        message:
            `plugin installed${snapshot_v ? ` (snapshot ${snapshot_v})` : ''} without the ` +
            'file projection — deprecated surface; the projection is the supported path',
        remedy: 'agent-config global (then uninstall the plugin per the printed hint)',
    };
}

/**
 * Claude Code flat-command discovery mitigation (council 2026-07-08,
 * cc-user-command-discovery): Claude Code ≤ 2.1.204 does not register FLAT
 * user-scope command files (`~/.claude/commands/<name>.md`) — nested
 * commands and user-scope skills do. The installer therefore projects
 * tier-0/1 visible flat commands as skill wrappers. This check flags the
 * silent-failure state: a projection deployed by an OLDER release that
 * still carries visible flat commands without wrappers (users see
 * "Unknown command" for /commit etc. with zero error anywhere).
 * Probe = `commit` (the canonical always-shipped visible flat command);
 * static file checks only — never a live model call.
 */
function _check_claude_command_wrappers(): Dict {
    const claude = shutilWhich('claude');
    if (claude === null) {
        return {
            id: 'claude-command-wrappers',
            status: 'skipped',
            message: 'Claude Code CLI not on PATH — wrapper check not applicable',
            remedy: '',
        };
    }
    const anchor = path.join(os.homedir(), '.claude');
    const commands_dir = path.join(anchor, 'commands');
    if (!isDir(commands_dir)) {
        return {
            id: 'claude-command-wrappers',
            status: 'skipped',
            message: 'no ~/.claude/commands projection — nothing to check',
            remedy: '',
        };
    }
    const flat_probe = fs.existsSync(path.join(commands_dir, 'commit.md'));
    const wrapper_probe = fs.existsSync(path.join(anchor, 'skills', 'commit', 'SKILL.md'));
    if (wrapper_probe) {
        return {
            id: 'claude-command-wrappers',
            status: 'ok',
            message:
                'flat-command skill wrappers present (Claude Code flat-command ' +
                'discovery workaround active)',
            remedy: '',
        };
    }
    if (flat_probe) {
        return {
            id: 'claude-command-wrappers',
            status: 'warn',
            message:
                'visible flat commands deployed WITHOUT skill wrappers — Claude Code ' +
                '\u2264 2.1.204 does not register flat user-scope command files, so ' +
                '/commit and other visible commands appear as "Unknown command"',
            remedy: 'agent-config refresh --global (re-deploys with the wrapper projection)',
        };
    }
    return {
        id: 'claude-command-wrappers',
        status: 'skipped',
        message: 'no visible flat commands in the projection — nothing to wrap',
        remedy: '',
    };
}

/**
 * Matrix-driven duplicate-surface check (road-to-install-path-convergence
 * Phase 2): reads src/config/surface-matrix.yml and flags every tool whose
 * declared duplicate-class detect paths ALL exist on this machine.
 * Generalizes the `claude-plugin` check — which stays as the named first
 * consumer — to every tool with a defined duplicate class; tools marked
 * `pending_evidence` are documented but never acted on.
 */
function _check_surface_state(): Dict {
    const matrix_path = path.join(_package_root(), 'src', 'config', 'surface-matrix.yml');
    if (!isFile(matrix_path)) {
        return {
            id: 'surface-state',
            status: 'skipped',
            message: 'surface-matrix.yml not found in this package',
            remedy: '',
        };
    }
    let tools: Dict = {};
    try {
        const raw = YAML.parse(readText(matrix_path), { version: '1.1' }) as Dict;
        const t = raw['tools'];
        if (t && typeof t === 'object' && !Array.isArray(t)) {
            tools = t as Dict;
        }
    } catch {
        return {
            id: 'surface-state',
            status: 'warn',
            message: 'surface-matrix.yml unreadable — duplicate-surface state unknown',
            remedy: 'agent-config upgrade (reinstalls the package data files)',
        };
    }

    const _expand = (p: string): string =>
        p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : path.join(_package_root(), p);

    const violations: string[] = [];
    const remedies: string[] = [];
    let checked = 0;
    for (const [tool_id, entry] of Object.entries(tools)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            continue;
        }
        const dup = (entry as Dict)['duplicate'] as Dict | undefined;
        const detect = dup ? (dup['detect'] as Dict | undefined) : undefined;
        const all_of = detect ? (detect['all_of'] as unknown) : undefined;
        if (!Array.isArray(all_of) || all_of.length === 0) {
            continue;
        }
        checked += 1;
        const present = all_of.every((p) => typeof p === 'string' && pathExistsAny(_expand(p)));
        if (present) {
            violations.push(tool_id);
            const conv = (entry as Dict)['converge'] as Dict | undefined;
            const cmd = conv ? String(conv['command'] ?? '') : '';
            if (cmd) {
                remedies.push(cmd);
            }
        }
    }

    if (violations.length > 0) {
        return {
            id: 'surface-state',
            status: 'fail',
            message:
                `duplicate surface on ${violations.length} tool(s): ${violations.join(', ')} — ` +
                'canonical + secondary install surfaces are both present',
            remedy: `${remedies.join(' · ')}${remedies.length ? ' — or: ' : ''}agent-config converge`,
        };
    }
    return {
        id: 'surface-state',
        status: 'ok',
        message: `${checked} declared duplicate class(es) checked, none present`,
        remedy: '',
    };
}

/** exists() that is true for files AND directories (surface detect paths). */
function pathExistsAny(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}


/** Managed hook wiring — moved to `_lib/runtime_wiring_checks.ts` (it IS a runtime-wiring check). */
function _check_hook_wiring(): Dict {
    return runtime_wiring.checkHookWiring({
        which: shutilWhich,
        packageRoot: _package_root(),
        homeDir: os.homedir(),
        buildMatrix: (mp) => claude_settings_hooks.build_claude_hook_matrix(mp) as Record<string, unknown>,
        managedSignature: claude_settings_hooks.MANAGED_SIGNATURE,
        pluginInstalled: () => claude_plugin.claude_plugin_installed(),
    }) as unknown as Dict;
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

/**
 * Per-file rule projection trees a consumer install writes (basenames match
 * the shipped `dist/agent-src/rules` tree). The first one that exists and
 * holds ≥ 1 `.md` rule is the surface we diff against the consumer's scope.
 */
const _RULE_PROJECTION_DIRS: readonly string[] = [
    '.augment/rules',
    '.windsurf/rules',
    '.cursor/rules',
    '.clinerules',
];

/**
 * Rule-scope drift (road-to-request-scoped-rule-load, 9.0 consumer flip).
 *
 * After the 9.0 default flip to consumer-scoped rule projection, a consumer
 * whose settings now exclude maintainer-only workspaces may still carry a
 * pre-flip FULL/GLOBAL rule projection on disk. This check diffs the scope
 * the consumer's settings imply against the rules actually projected and
 * reports the leftover set as an ACTIONABLE diff (not a bare boolean).
 *
 * The scope-derived expected set reuses the ONE install-time scoping surface
 * (`rule_scope.ts`), so doctor's diagnosis can never drift from the install
 * semantics. `excludedRuleBasenames` returns exactly the rules PRESENT in the
 * projected tree that the current scope says should NOT arrive.
 *
 * Degrades gracefully: `skipped` in the agent-config source repo (the in-repo
 * `.augment/rules` is the full generated projection, not a consumer surface)
 * and `skipped` when no projected rule tree is present to inspect.
 */
function _check_rule_scope_drift(project_root: string): Dict {
    if (_is_source_repo(project_root)) {
        return {
            id: 'rule-scope-drift',
            status: 'skipped',
            message: 'agent-config source repo — no consumer rule projection to inspect',
            remedy: '',
        };
    }

    // Consumer projection scope (absent / empty settings → legacy-all: every
    // rule ships, so nothing is ever out of scope).
    let scope: RuleScope = LEGACY_ALL;
    const settings_file = project_settings_path(project_root);
    if (isFile(settings_file)) {
        const loaded = yamlSafeLoad(readText0(settings_file));
        const raw =
            typeof loaded === 'object' && loaded !== null && !Array.isArray(loaded)
                ? (loaded as Dict)
                : {};
        scope = ruleScopeFromSettings(raw);
    }

    // First projected rule tree that exists and holds a `.md` rule.
    let rules_dir: string | null = null;
    let found = 0;
    for (const rel of _RULE_PROJECTION_DIRS) {
        const cand = path.join(project_root, rel);
        if (!isDir(cand)) {
            continue;
        }
        let count = 0;
        try {
            for (const name of fs.readdirSync(cand)) {
                if (name.endsWith('.md') && isFile(path.join(cand, name))) {
                    count += 1;
                }
            }
        } catch {
            continue;
        }
        if (count > 0) {
            rules_dir = cand;
            found = count;
            break;
        }
    }
    if (rules_dir === null) {
        return {
            id: 'rule-scope-drift',
            status: 'skipped',
            message: 'no projected rule tree found (.augment/rules, .windsurf/rules, …) — nothing to inspect',
            remedy: '',
        };
    }

    let unexpected: string[];
    try {
        unexpected = excludedRuleBasenames(rules_dir, scope);
    } catch (exc) {
        const rel = relativeTo(rules_dir, project_root) ?? rules_dir;
        return {
            id: 'rule-scope-drift',
            status: 'fail',
            message: `cannot inspect ${rel}: ${osErrorStr(exc)}`,
            remedy: 'check read permissions on the projected rule tree',
        };
    }

    const rel_dir = relativeTo(rules_dir, project_root) ?? rules_dir;
    if (unexpected.length === 0) {
        return {
            id: 'rule-scope-drift',
            status: 'ok',
            message: `rule projection matches scope (${found} rules in ${rel_dir})`,
            remedy: '',
        };
    }
    const expected = found - unexpected.length;
    const sample = unexpected.slice(0, 8);
    const more = unexpected.length - sample.length;
    const names = sample.join(', ') + (more > 0 ? `, +${more} more` : '');
    return {
        id: 'rule-scope-drift',
        status: 'warn',
        message:
            `rule-scope drift in ${rel_dir}: expected ${expected} rules, found ${found} — ` +
            `${unexpected.length} unexpected (out of scope): ${names}`,
        remedy:
            're-run `agent-config init --project` (or `agent-config global`) to re-project rules ' +
            'under the current scope — these are leftover from a pre-9.0 full/global projection',
    };
}

/**
 * Duplicate-scope rule detection (road-to-cache-economy Phase 3, C-2 —
 * confirmed at 38.5% of subagent write volume on this maintainer's own
 * checkout). When the same `.md` rule filenames are installed at BOTH the
 * user-scope Claude Code config (`~/.claude/rules`) and the project scope,
 * every session AND every subagent spawn injects two near-identical copies
 * of the same rule set. This check is DETECTION ONLY: it reports the
 * measured redundant-token estimate and names which copy is authoritative —
 * it never deletes, rewrites, or otherwise touches a user's files (per
 * `non-destructive-by-default`).
 *
 * Project scope resolves the same way the census in
 * `cache_realization_report.ts` does: `dist/agent-src/rules` in this
 * source repo itself (the only place the ~37% finding was measured), or the
 * first populated {@link _RULE_PROJECTION_DIRS} entry in a consumer install.
 * `userRulesDirOverride` exists solely so tests never touch the real
 * `~/.claude/rules` on the machine running the suite.
 */
function _check_duplicate_scope_rules(project_root: string, userRulesDirOverride?: string): Dict {
    const user_rules_dir = userRulesDirOverride ?? path.join(os.homedir(), '.claude', 'rules');

    let project_rules_dir: string | null = null;
    if (_is_source_repo(project_root)) {
        const cand = path.join(project_root, 'dist', 'agent-src', 'rules');
        if (isDir(cand)) project_rules_dir = cand;
    } else {
        for (const rel of _RULE_PROJECTION_DIRS) {
            const cand = path.join(project_root, rel);
            if (isDir(cand)) {
                project_rules_dir = cand;
                break;
            }
        }
    }

    if (project_rules_dir === null) {
        return {
            id: 'duplicate-scope-rules',
            status: 'skipped',
            message: 'no project-scope rule tree found (dist/agent-src/rules, .augment/rules, …) — nothing to compare against the user-scope copy',
            remedy: '',
        };
    }

    const census = censusDuplicateScope(user_rules_dir, project_rules_dir);
    if (!census.evaluable) {
        return {
            id: 'duplicate-scope-rules',
            status: 'ok',
            message: census.reason ?? 'no duplicate-scope rule install detected',
            remedy: '',
        };
    }

    const tokens = Math.round(census.duplicate_chars / 4);
    const rel_project = relativeTo(project_rules_dir, project_root) ?? project_rules_dir;
    return {
        id: 'duplicate-scope-rules',
        status: 'warn',
        message:
            `${census.shared_filenames.length} rule(s) installed at BOTH user scope (${user_rules_dir}) and ` +
            `project scope (${rel_project}) — an estimated ${tokens} redundant tokens are injected on every ` +
            'session AND every subagent spawn (both copies are always-loaded). Project scope is authoritative ' +
            'for this checkout.',
        remedy:
            'detection only — no file is modified. If the duplication is unwanted, refresh the user-scope copy ' +
            '(e.g. `agent-config global`) to re-sync it with the project-scope version.',
    };
}

// Both bodies moved to `_lib/doctor_runtime_checks.ts` to pay for the Phase-1
// install-reach wiring under `check_source_size_budget`. These wrappers keep the
// historical names and arity, so the runner map, the export block and the
// existing fallback test are untouched by the move.
const _check_python_runtime = (): Dict => runtime_checks.checkPythonRuntime();
const _check_humanizer_runtime = (): Dict => runtime_checks.checkHumanizerRuntime(shutilWhich);

function _check_mcp_beta_readiness(project_root: string): Dict {
    // Maintainer-scoped gate: the six artefacts live in the agent-config
    // SOURCE repo. In a consumer project the paths can never exist, so the
    // check used to emit a meaningless "6/6 gates pending" warning on every
    // consumer doctor run — skip instead.
    if (!_is_source_repo(project_root)) {
        return {
            id: 'mcp-beta-readiness',
            status: 'skipped',
            message:
                'MCP beta promotion gates apply to the agent-config source repo, ' +
                'not consumer projects',
            remedy: '',
        };
    }
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
 * Provider → (default binary, community-wrapper flag). Canonical definition
 * lives in `_lib/environment_detector.ts` so this check and the detection
 * report cannot drift on the billing-relevant boolean; aliased here to keep
 * the existing call sites unchanged.
 */
const _CLI_PROVIDER_META: Readonly<Record<string, readonly [string, boolean]>> =
    PROVIDER_CLI_META;

/**
 * m5 fix (independent-review finding) — `MemberConfig.mode` is the RAW
 * per-member override only (`config.ts::_build_member` never writes the
 * `defaults.mode`-resolved value back onto it); a member that never sets
 * `mode:` locally has `member.mode === null` regardless of what the
 * council's global default is. `defaults.mode` shipped `'auto'` as its own
 * default (road-to-always-on-orchestration Phase 3.1), so the common,
 * unconfigured case for every member is `null` here — and `auto` may
 * legitimately resolve to the `cli` rung, exactly the case
 * `config.ts::_build_member`'s own binary-override validation already
 * accounts for ("`auto` may resolve to the cli rung, so a binary override
 * is legitimate there too"). A check gated on the literal `mode === 'cli'`
 * misses every `auto`/unset member, honouring neither its binary override
 * nor its quota — silently, for the majority default shape.
 */
function _effectiveMemberMode(member: ai_council_config.MemberConfig, cfg: ai_council_config.CouncilConfig): string {
    return member.mode ?? cfg.defaults.mode;
}

/** True when `member` might run over CLI transport — `cli` pinned, or `auto` (which may resolve to it). */
function _mayRunOverCli(member: ai_council_config.MemberConfig, cfg: ai_council_config.CouncilConfig): boolean {
    const mode = _effectiveMemberMode(member, cfg);
    return mode === 'cli' || mode === 'auto';
}

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
        if (m.enabled && _mayRunOverCli(m, cfg) && name in _CLI_PROVIDER_META) {
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

// ---------------------------------------------------------------------------
// team check (road-to-team-mode Phase 1) — codex binary + auth, official
// codex plugin on Claude-Code hosts, Review-Gate consistency.
// ---------------------------------------------------------------------------

/**
 * Codex CLI home — `CODEX_HOME` env override (the codex CLI's own
 * convention), else `~/.codex`. Single definition in
 * `_lib/environment_detector.ts` so the detection report and this check probe
 * the same path; aliased here to keep the existing call sites unchanged.
 */
function _codex_home(): string {
    return codexHome();
}

/**
 * Codex binary name for the team check — REUSES the council probe's binary
 * discovery: when a council config exists and declares an enabled `openai`
 * member whose effective mode is `cli` (pinned) OR `auto` (may resolve to
 * `cli` — see `_mayRunOverCli`) with a `binary` override, honour it; else
 * the provider default from `_CLI_PROVIDER_META` (`codex`). Never throws —
 * an unreadable or invalid council config falls back to the default binary
 * (the council-cli check owns reporting that problem).
 */
function _team_codex_binary_name(project_root: string): string {
    const default_bin = (_CLI_PROVIDER_META['openai'] as [string, boolean])[0];
    const { load_council_config, resolve_config_path } = ai_council_config;
    const council_path = resolve_config_path(project_root);
    if (!pathExists(String(council_path))) {
        return default_bin;
    }
    let cfg: ai_council_config.CouncilConfig;
    try {
        cfg = load_council_config(council_path);
    } catch {
        return default_bin;
    }
    const member = cfg.members.get('openai');
    if (member && member.enabled && _mayRunOverCli(member, cfg) && member.binary) {
        return member.binary;
    }
    return default_bin;
}

/**
 * Decode a JWT payload's `exp` claim (epoch seconds) — base64 decode only,
 * NO signature verification, no network. Non-JWT / undecodable → null.
 */
function _jwt_exp(token: unknown): number | null {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const payload: unknown = JSON.parse(
            Buffer.from(parts[1] as string, 'base64url').toString('utf-8'),
        );
        if (typeof payload !== 'object' || payload === null) return null;
        const exp = (payload as Record<string, unknown>)['exp'];
        return typeof exp === 'number' && Number.isFinite(exp) && exp > 0 ? exp : null;
    } catch {
        return null;
    }
}

/** Coerce an explicit expiry field to epoch seconds (number or ISO string). */
function _epoch_seconds(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        // Heuristic: values past ~2286 in seconds are epoch milliseconds.
        return value > 1e12 ? value / 1000 : value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const ms = Date.parse(value);
        return Number.isNaN(ms) ? null : ms / 1000;
    }
    return null;
}

/**
 * Latest locally-derivable expiry (epoch seconds) from a codex `auth.json`,
 * or null when none is derivable. Sources, all offline:
 *
 * - explicit `expires_at` / `expiry` / `exp` fields (top level; numbers in
 *   seconds or ms, or ISO date strings), and
 * - the `exp` claim of JWT tokens under `tokens.{access_token,id_token}`
 *   (or the same keys top-level) — base64 payload decode only, never
 *   signature verification.
 *
 * LATEST wins: the real codex auth.json holds a refresh_token, so an
 * expired id_token sitting next to a live access_token is not an auth
 * failure — WARN only when everything derivable is past.
 */
function _codex_auth_expiry(auth_path: string): number | null {
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(auth_path, 'utf-8'));
    } catch {
        return null;
    }
    if (typeof data !== 'object' || data === null) return null;
    const d = data as Record<string, unknown>;
    const candidates: number[] = [];
    for (const key of ['expires_at', 'expiry', 'exp']) {
        const v = _epoch_seconds(d[key]);
        if (v !== null) candidates.push(v);
    }
    const tokens_raw = d['tokens'];
    const tokens =
        typeof tokens_raw === 'object' && tokens_raw !== null && !Array.isArray(tokens_raw)
            ? (tokens_raw as Record<string, unknown>)
            : {};
    for (const key of ['access_token', 'id_token']) {
        const v = _jwt_exp(tokens[key] ?? d[key]);
        if (v !== null) candidates.push(v);
    }
    return candidates.length > 0 ? Math.max(...candidates) : null;
}

/** The `ai_team` block from `.agent-settings.yml` — lenient, `{}` when absent. */
function _read_ai_team_block(project_root: string): Dict {
    const settings_file = project_settings_path(project_root);
    if (!isFile(settings_file)) return {};
    let content: string;
    try {
        content = readText0(settings_file);
    } catch {
        return {};
    }
    const loaded = yamlSafeLoad(content);
    if (typeof loaded !== 'object' || loaded === null || Array.isArray(loaded)) return {};
    const raw = (loaded as Dict)['ai_team'];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return raw as Dict;
}

/**
 * `team` health check — three sub-signals folded into one result:
 *
 * (a) codex binary present (council-probe binary discovery reused) AND
 *     auth present. Auth is a READ-ONLY probe of `$CODEX_HOME/auth.json`
 *     (default `~/.codex/auth.json`): presence, plus locally-derivable
 *     expiry evidence (`_codex_auth_expiry` — explicit expiry fields or
 *     JWT `exp` payloads; no network, no signature verification). Past
 *     expiry → WARN; no derivable expiry → presence-only note in the
 *     detail. Runtime expiry is still caught authoritatively by
 *     `OpenAICliClient._AUTH_FAILURE_PATTERNS`.
 * (b) on Claude-Code hosts (claude binary on PATH or the Claude config dir
 *     present): the official codex plugin recorded in
 *     `plugins/installed_plugins.json`, with namespace-resistant identity
 *     via `codex_plugin_identity()` — a prefix match whose marketplace
 *     source repo cannot be verified against `openai/codex-plugin-cc`
 *     keeps ✅ but is annotated "identity not fully verified (prefix
 *     match)". Detection is read-only — doctor never writes under
 *     `~/.claude/`.
 * (c) Review-Gate consistency: `ai_team.review_gate.managed` on while the
 *     loop bound (`max_consecutive_blocks`, Phase 4 — unbuilt) is absent
 *     → WARN.
 *
 * Availability, not a setting (road-to-always-on-orchestration Phase 1,
 * Step 1.3): `ai_team.enabled` was DELETED — `/team`'s on/off state is the
 * codex binary + auth facts (a) computes below, mirroring
 * `checkCodexAvailability()` (`src/scripts/ai_team/availability.ts`).
 * Absent feature ≠ broken feature: with BOTH the binary and auth absent the
 * check reports ok ("team unavailable (default) — codex CLI not
 * installed") — a normal starting state, not a misconfiguration; WARN
 * fires only when something was set up PARTWAY (binary without auth, a
 * managed Review-Gate with an invalid bound, …) or a real sub-signal
 * fails.
 */
// ---------------------------------------------------------------------------
// detection check (road-to-zero-ceremony-detection Phases 3 + 4)
// ---------------------------------------------------------------------------

/** Per-process memo so the check row and the rendered section agree exactly. */
let _detection_memo: { root: string; report: DetectionReport } | null = null;

/**
 * Read the council-config facts the detection rows need. Never throws — an
 * absent or unreadable config degrades to "no config", which the report renders
 * as a fix rather than a failure.
 */
function _read_council_facts(project_root: string): CouncilFacts {
    const { load_council_config, resolve_config_path } = ai_council_config;
    const config_path = String(resolve_config_path(project_root));
    if (!pathExists(config_path)) {
        return absentCouncilFacts(config_path);
    }
    let cfg: ai_council_config.CouncilConfig;
    try {
        cfg = load_council_config(config_path);
    } catch {
        // An invalid config is reported by the `council-cli` check, which owns
        // that problem; here it simply means no facts are derivable.
        return absentCouncilFacts(config_path);
    }
    const members: Record<string, CouncilMemberFacts> = {};
    for (const [name, m] of cfg.members) {
        members[name] = {
            enabled: m.enabled,
            mode: m.mode,
            binary: m.binary,
            apiKeyRef: m.api_key_ref,
        };
    }
    const cliCaps: Record<string, number> = {};
    for (const [provider, cap] of cfg.cli_call_budget.max_calls_per_day) {
        cliCaps[provider] = cap;
    }
    return {
        configPath: config_path,
        configPresent: true,
        enabled: cfg.enabled,
        defaultsMode: cfg.defaults.mode,
        members,
        cliCaps,
        costBudgetMaxUsd: cfg.cost_budget.max_total_usd,
    };
}

/** Build (once per process, per root) the detection report. */
function _detection_report(project_root: string): DetectionReport {
    if (_detection_memo !== null && _detection_memo.root === project_root) {
        return _detection_memo.report;
    }
    const council = _read_council_facts(project_root);
    let used: Record<string, number> = {};
    try {
        const counts = ai_council_clients.load_cli_call_counts();
        for (const provider of Object.keys(council.cliCaps)) {
            used[provider] = Number((counts as Dict)[provider] ?? 0);
        }
    } catch {
        used = {};
    }
    const report = buildDetectionReport({
        environment: detectEnvironment(),
        council,
        cliCallsUsed: used,
    });
    _detection_memo = { root: project_root, report };
    return report;
}

/** Test seam — drop the memo so a fixture root is not served a stale report. */
function _reset_detection_memo(): void {
    _detection_memo = null;
}

/**
 * `detection` health check — what this machine can do, and what it is allowed
 * to do, as two separate facts.
 *
 * Reports per provider: detected · authenticated · auth source · billing class
 * · enabled-in-config, plus the transport `auto` would pick and a one-line fix
 * for every unusable capability. All rows come from the read-only, spend-free
 * detector; nothing here makes a provider call.
 *
 * Status model — a recorded consent decision is NOT a defect:
 *
 * - no council config, or council disabled → `ok` ("not configured"), with the
 *   fix. Absent feature ≠ broken feature (same stance as the `team` check).
 * - detected but `enabled: false` → `ok`. That flag is a deliberate spend gate;
 *   warning on it would train the user to silence their own consent record.
 * - enabled to spend but no transport resolves → `warn`. That IS broken: the
 *   member is permitted to run and cannot.
 */
function _check_detection(project_root: string): Dict {
    const report = _detection_report(project_root);
    const detected = report.providers.filter((r) => r.detected);
    const hosts_installed = report.hosts.filter((h) => h.installed).length;

    if (!report.council_config_present) {
        return {
            id: 'detection',
            status: 'ok',
            message:
                `${hosts_installed} host(s) · ${detected.length} provider(s) detected · ` +
                'council not configured (default-off)',
            remedy: report.providers[0]?.fix ?? `create ${report.council_config_path}`,
        };
    }

    if (!report.council_enabled) {
        return {
            id: 'detection',
            status: 'ok',
            message:
                `${hosts_installed} host(s) · ${detected.length} provider(s) detected · ` +
                'council disabled (default-off)',
            remedy: `set \`enabled: true\` in ${report.council_config_path}`,
        };
    }

    const broken = report.providers.filter((r) => r.enabledInConfig && !r.available);
    const spending = report.providers.filter((r) => r.enabledInConfig && r.available);
    const unpermitted = detected.filter((r) => !r.enabledInConfig);

    const summary =
        `${hosts_installed} host(s) · ${spending.length} member(s) ready ` +
        `(${spending.map((r) => `${r.provider}→${r.transport}/${r.billing}`).join(', ') || 'none'})` +
        (unpermitted.length === 0
            ? ''
            : ` · ${unpermitted.length} detected but not allowed to spend: ` +
              unpermitted.map((r) => r.provider).join(', '));

    if (broken.length > 0) {
        return {
            id: 'detection',
            status: 'warn',
            message: `${summary} · ${broken.length} enabled member(s) have no transport`,
            remedy: broken.map((r) => `${r.provider}: ${r.fix}`).join(' · '),
        };
    }

    return {
        id: 'detection',
        status: 'ok',
        message: summary,
        remedy:
            unpermitted.length === 0
                ? `run \`agent-config doctor --check detection\` for the full table`
                : unpermitted.map((r) => r.fix).join(' · '),
    };
}

function _check_team(project_root: string): Dict {
    const ai_team = _read_ai_team_block(project_root);
    const gateRaw = ai_team['review_gate'];
    const gate =
        typeof gateRaw === 'object' && gateRaw !== null && !Array.isArray(gateRaw)
            ? (gateRaw as Dict)
            : {};

    const remedies: string[] = [];

    // (a) codex binary — council-probe discovery reused.
    const binary_name = _team_codex_binary_name(project_root);
    const binary_resolved = shutilWhich(binary_name);
    const binary_glyph = binary_resolved !== null ? '✅' : '❌';
    const binary_missing = binary_resolved === null;
    if (binary_missing) {
        remedies.push('install the codex CLI: `npm install -g @openai/codex`');
    }

    // (a, cont.) codex auth — READ-ONLY probe of $CODEX_HOME/auth.json:
    // presence + locally-derivable expiry evidence (no network).
    const auth_path = path.join(_codex_home(), 'auth.json');
    const authed = pathExists(auth_path);
    let auth_str: string;
    if (!authed) {
        auth_str = `codex auth ❌ (${auth_path})`;
        remedies.push('run `codex login`');
    } else {
        const expiry = _codex_auth_expiry(auth_path);
        if (expiry !== null && expiry * 1000 < Date.now()) {
            auth_str = `codex auth ⚠️ expired (${auth_path})`;
            remedies.push('auth token appears expired — run `codex login`');
        } else if (expiry === null) {
            auth_str =
                `codex auth ✅ (${auth_path}; ` +
                'presence-only check — expiry not verifiable locally)';
        } else {
            auth_str = `codex auth ✅ (${auth_path})`;
        }
    }

    // (b) official codex plugin — Claude-Code hosts only.
    const is_claude_host =
        shutilWhich('claude') !== null || pathExists(claude_plugin.claude_config_dir());
    let plugin_str: string;
    if (is_claude_host) {
        const identity = claude_plugin.codex_plugin_identity();
        if (!identity.installed) {
            plugin_str = 'codex plugin ❌';
            remedies.push(
                'install the official codex plugin: ' +
                    claude_plugin.CODEX_PLUGIN_INSTALL_HINT.map((c) => `\`${c}\``).join(' then '),
            );
        } else if (!identity.identity_verified) {
            plugin_str = 'codex plugin ✅ — identity not fully verified (prefix match)';
        } else {
            plugin_str = 'codex plugin ✅';
        }
    } else {
        plugin_str = 'codex plugin — (not a Claude Code host; fallback path applies)';
    }

    // (c) Review-Gate governance (Phase 4) — logic lives in
    // src/scripts/ai_team/review_gate.ts (upstream gate probe + WARN
    // states, incl. plugin-gate-on-while-unmanaged with the quoted
    // upstream cost warning). Independent of /team's own availability —
    // `managed` governs the codex PLUGIN's own Stop-hook loop.
    const gate_signal = review_gate_doctor_signal(project_root, gate);
    const gate_str = gate_signal.gate_str;
    remedies.push(...gate_signal.remedies);

    const detail =
        `codex binary ${binary_glyph} (${binary_name}) · ` +
        `${auth_str} · ${plugin_str} · ${gate_str}`;

    if (binary_missing && !authed) {
        // Neither the binary nor auth is present — /team simply is not set
        // up on this machine yet. CLI-first doctrine (road-to-always-on-
        // orchestration Phase 1, Step 1.3): this is a normal starting
        // state, not a misconfiguration — still surface the full detail
        // (e.g. a `review_gate.managed` left on) so nothing is hidden.
        return {
            id: 'team',
            status: 'ok',
            message: `team unavailable (default) — codex CLI not installed · ${detail}`,
            remedy: remedies.join('; '),
        };
    }

    if (remedies.length > 0) {
        return {
            id: 'team',
            status: 'warn',
            message: `${remedies.length} team sub-signal(s) failing · ${detail}`,
            remedy: remedies.join('; '),
        };
    }
    return {
        id: 'team',
        status: 'ok',
        message: `team available · ${detail}`,
        remedy: '',
    };
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

/**
 * Pending settings-surface review (road-to-settings-change-review): the
 * installer writes `state/settings-delta.json` when an upgrade changed
 * defaults / enum vocabularies / added settings. The flag persists until
 * the user resolves the review form (`agent-config config` → Settings →
 * banner) — this check keeps it visible in every doctor run.
 */
function _check_settings_review_pending(): Dict {
    const delta_pth = path.join(user_global_paths.event4u_root(), 'state', 'settings-delta.json');
    if (!pathExists(delta_pth)) {
        return {
            id: 'settings-review-pending',
            status: 'ok',
            message: 'no pending settings-surface changes',
            remedy: '',
        };
    }
    let summary = '';
    try {
        const data = JSON.parse(readText0(delta_pth)) as {
            oldVersion?: string;
            newVersion?: string;
            changes?: unknown[];
        };
        const n = Array.isArray(data.changes) ? data.changes.length : 0;
        summary = `${n} change${n === 1 ? '' : 's'} (${data.oldVersion ?? '?'} → ${data.newVersion ?? '?'})`;
    } catch {
        summary = 'unreadable delta file';
    }
    return {
        id: 'settings-review-pending',
        status: 'warn',
        message: `settings surface changed on upgrade — ${summary} awaiting review`,
        remedy: 'agent-config config (Settings → “Review changes” banner)',
    };
}

/**
 * `memory-merge-union` — read-only warn check (road-to-reachable-code-memory
 * Phase 5). The `merge=union` .gitattributes block lets two branches each
 * appending a NEW memory entry (intake JSONL, or the flat curated
 * `agents/memory/<type>.yml` files) merge cleanly instead of conflicting.
 * Without it, ordinary parallel memory writes on separate branches produce a
 * merge conflict the human has to resolve by hand. Never fails the run —
 * this is advisory, same posture as `offline-readiness`.
 */
function _check_memory_merge_union(project_root: string): Dict {
    const remedy =
        'run: npx tsx src/scripts/sync_gitattributes.ts (or `agent-config refresh --project`)';
    const target = path.join(project_root, sync_gitattributes.DEFAULT_GITATTRIBUTES);
    if (!pathExists(target)) {
        return {
            id: 'memory-merge-union',
            status: 'warn',
            message:
                'no .gitattributes at project root — memory merge-safety attributes not applied',
            remedy,
        };
    }
    let text: string;
    try {
        text = readText(target);
    } catch (exc) {
        return {
            id: 'memory-merge-union',
            status: 'warn',
            message: `unreadable .gitattributes at ${target}: ${osErrorStr(exc)}`,
            remedy,
        };
    }
    const has_block = text.includes(sync_gitattributes.SECTION_HEADER);
    const has_intake_union = /agents\/memory\/intake\/\*\.jsonl\s+merge=union/.test(text);
    if (has_block && has_intake_union) {
        return {
            id: 'memory-merge-union',
            status: 'ok',
            message:
                '.gitattributes carries the memory merge-safety block (intake JSONL union-merge present)',
            remedy: '',
        };
    }
    return {
        id: 'memory-merge-union',
        status: 'warn',
        message: has_block
            ? '.gitattributes has the managed block but is missing the intake merge=union line'
            : '.gitattributes is missing the memory merge-safety block — parallel-branch ' +
              'memory writes can conflict instead of merging',
        remedy,
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
        'git-identity': () => _check_git_identity(project_root),
        'claude-plugin': _check_claude_plugin,
        'claude-command-wrappers': _check_claude_command_wrappers,
        'surface-state': _check_surface_state,
        'hook-wiring': _check_hook_wiring,
        ...(runtime_wiring.wiringRunners({ packageRoot: _package_root(), iterOverrides: () => iter_setting_overrides({ cwd: project_root }) }) as unknown as Record<string, CheckRunner>),
        ...(install_reach.reachRunners({ projectRoot: project_root, resolvableVersion: _current_package_version() }) as unknown as Record<string, CheckRunner>),
        'stale-orphans': _check_stale_orphans,
        overrides: () => _check_overrides(project_root),
        'rule-scope-drift': () => _check_rule_scope_drift(project_root),
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
        'humanizer-runtime': () => _check_humanizer_runtime(),
        'tier-usage-readiness': () => _check_tier_usage_readiness(project_root),
        'council-cli': () => _check_council_cli(project_root),
        'detection': () => _check_detection(project_root),
        team: () => _check_team(project_root),
        'unsupported-combos': () => _check_unsupported_combos(manifest),
        'wizard-state': _check_wizard_state,
        'settings-review-pending': _check_settings_review_pending,
        'memory-merge-union': () => _check_memory_merge_union(project_root),
        'duplicate-scope-rules': () => _check_duplicate_scope_rules(project_root),
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
            'no project lockfile and no consumer install marker → drift ' +
            'check not applicable',
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
        'git-identity': () => _check_git_identity(project_root),
        'claude-plugin': _check_claude_plugin,
        'claude-command-wrappers': _check_claude_command_wrappers,
        'surface-state': _check_surface_state,
        'hook-wiring': _check_hook_wiring,
        ...(runtime_wiring.wiringRunners({ packageRoot: _package_root(), iterOverrides: () => iter_setting_overrides({ cwd: project_root }) }) as unknown as Record<string, CheckRunner>),
        ...(install_reach.reachRunners({ projectRoot: project_root, resolvableVersion: _current_package_version() }) as unknown as Record<string, CheckRunner>),
        'stale-orphans': _check_stale_orphans,
        // BOTH registries need the id. Registering only the first one crashed with
        // `runners[cid] is not a function` on a global-only consumer, which is the
        // path that has no manifest — a loud failure rather than a silent skip, and
        // worth the comment because the duplication is easy to miss.
        overrides: () => _check_overrides(project_root),
        'rule-scope-drift': () => _check_rule_scope_drift(project_root),
        'manifest-integrity': () => _skipped_manifest_check('manifest-integrity'),
        'lockfile-freshness': () => _skipped_manifest_check('lockfile-freshness'),
        'bridge-drift': () => _check_bridge_drift_no_manifest(bridge_present),
        'mcp-mode': () => _check_mcp_mode(project_root),
        'mcp-beta-readiness': () => _check_mcp_beta_readiness(project_root),
        'offline-readiness': () => _check_offline_readiness(),
        'python-runtime': () => _check_python_runtime(),
        'humanizer-runtime': () => _check_humanizer_runtime(),
        'tier-usage-readiness': () => _check_tier_usage_readiness(project_root),
        'council-cli': () => _check_council_cli(project_root),
        'detection': () => _check_detection(project_root),
        team: () => _check_team(project_root),
        'unsupported-combos': () => _skipped_manifest_check('unsupported-combos'),
        'wizard-state': _check_wizard_state,
        'settings-review-pending': _check_settings_review_pending,
        'memory-merge-union': () => _check_memory_merge_union(project_root),
        'duplicate-scope-rules': () => _check_duplicate_scope_rules(project_root),
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
                '  ℹ️   global-only consumer: install marker present, no ' +
                    'project lockfile (expected under ADR-020)',
            );
            print(
                '      project-manifest checks are skipped — they apply only ' +
                    'to project-local distributed tools',
            );
        } else {
            eprint(`  ⚠️   no project lockfile and no consumer install marker at ${project_root}`);
            eprint(
                '      run `agent-config init` (project install) or ' +
                    '`agent-config refresh --project` (global-only consumer)',
            );
        }
        _emit_checks_text(checks);
        _emit_detection_text(project_root, checks);
    } else {
        _emit_checks_text(checks);
        _emit_detection_text(project_root, checks);
    }

    if (opts.check !== null) {
        if (skipped_requested) {
            return 2;
        }
        return fail_check ? 1 : 0;
    }
    if (opts.ci && bridge_present) {
        // Same fold as the manifest path: check failures are red under --ci.
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
        // The detection section rides along whenever checks ran, so the agent /
        // GUI contract carries the full provider → transport → billing table
        // and not just the one-line check row.
        if (checks.some((c) => c['id'] === 'detection')) {
            payload['detection'] = detectionJson(_detection_report(project_root));
        }
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

/**
 * The detection section in text mode. Rendered from the same report the
 * `detection` check row and the `--json` payload use, so the three cannot
 * disagree about which members spend money.
 */
function _emit_detection_text(project_root: string, checks: Dict[]): void {
    if (!checks.some((c) => c['id'] === 'detection')) {
        return;
    }
    for (const line of renderDetectionLines(_detection_report(project_root))) {
        print(line);
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
    ci: boolean;
    check: string | null;
    trace_root: boolean;
    context: boolean;
    anatomy: boolean;
    repair: string | null;
}

const PROG = 'agent-config doctor';

// Verbatim argparse usage block (captured from the .py at COLUMNS=80). The
// per-flag `--help` BODY is a documented divergence — argparse re-wraps it to
// terminal width; golden tests assert the `usage:` token + exit code only.
const USAGE =
    `usage: ${PROG} [-h] [--project PROJECT] [--json] [--ci] [--check ID]\n` +
    '                           [--trace-root] [--context] [--anatomy]\n' +
    '                           [--repair ID]\n';

const _STORE_TRUE_FLAGS: Record<string, keyof Options> = {
    '--json': 'json',
    '--ci': 'ci',
    '--trace-root': 'trace_root',
    '--context': 'context',
    '--anatomy': 'anatomy',
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
        ci: false,
        check: null,
        trace_root: false,
        context: false,
        anatomy: false,
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

/**
 * `--anatomy` — the injection anatomy, rendered from measurements that already
 * exist. Composes `preamble_byte_census` (what occupies the always-loaded
 * preamble) with `dispatch_economy_report` (what the dispatch legs cost). It
 * takes NO new measurement and adds no threshold: both sources are advisory
 * reports and stay advisory here.
 *
 * Neither module runs anything at import time — `preamble_byte_census` gained
 * the `__AGENT_CONFIG_BUNDLE__` guard for exactly this import, since inside the
 * `build:cli-delegate` bundle its old entry check would have matched whenever
 * this command was invoked directly.
 */
function _run_anatomy(opts: Options): number {
    const census = preamble_byte_census;
    const economy = dispatch_economy_report;

    const byteCensus = census.buildReport(census.parseArgs([]));

    // The economy half reads transcripts and a registration file; either can be
    // absent on a consumer machine. An absent half is reported as absent, never
    // as a zero — a fabricated zero is the failure both source reports already
    // refuse to make.
    let economyReport: ReturnType<typeof economy.buildReport> | null = null;
    let economyError: string | null = null;
    try {
        economyReport = economy.buildReport({
            root: economy.DEFAULT_PROJECTS_ROOT,
            auditDir: path.join(process.cwd(), economy.DEFAULT_AUDIT_DIR),
            maxAgeDays: 14,
        });
    } catch (err) {
        economyError = err instanceof Error ? err.message : String(err);
    }

    if (opts.json) {
        print(
            _jsonDumpsIndentAscii(
                {
                    preamble_byte_census: byteCensus,
                    dispatch_economy: economyReport,
                    dispatch_economy_unavailable: economyError,
                } as unknown as Dict,
                2,
            ),
        );
        return 0;
    }

    print('── injection anatomy ─────────────────────────────────────────');
    print(census.renderText(byteCensus));
    print('');
    print(
        economyReport !== null
            ? economy.renderText(economyReport)
            : `dispatch-economy report unavailable: ${economyError}`,
    );
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
    if (opts.ci) {
        // `--ci` = machine-readable consumer-CI contract: JSON payload on
        // stdout, zero interactive output, and check failures fold into the
        // exit code (the default full run keys the exit off drift only).
        opts.json = true;
    }
    if (opts.repair !== null) {
        return _run_repair(opts);
    }
    if (opts.trace_root) {
        return _run_trace_root(opts);
    }
    if (opts.context) {
        return _run_context(opts);
    }
    if (opts.anatomy) {
        return _run_anatomy(opts);
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
        const bridge_present = _is_global_only_consumer(project_root);
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
        _emit_detection_text(project_root, checks);
        if (opts.check === null) {
            _emit_text(project_root, missing, modified, foreign, tag_drift);
        }
    }

    if (opts.check !== null) {
        return fail_check ? 1 : 0;
    }
    const drift_present = Boolean(
        missing.length || modified.length || foreign.length || tag_drift.length,
    );
    if (opts.ci) {
        // Exit contract under --ci: 0 clean · 1 any drift OR any check fail
        // · 2 unresolvable environment (handled above via ProjectRootError).
        return drift_present || fail_check ? 1 : 0;
    }
    return drift_present ? 1 : 0;
}

// --- CLI entry ---

/**
 * Defined by `build:cli-delegate` only — see `cmd_session_recycle.ts` for why a
 * single "am I inside a bundle" flag cannot answer "may I run".
 */
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
declare const __AGENT_CONFIG_CLI_DELEGATE__: boolean | undefined;

function _isCliEntry(): boolean {
    const bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
    const cliDelegate =
        typeof __AGENT_CONFIG_CLI_DELEGATE__ !== 'undefined' && __AGENT_CONFIG_CLI_DELEGATE__;
    // Inlined into the installer / hook / MCP bundle: never auto-run. This
    // file previously carried no such guard while its comment described the
    // pairing, so the four siblings documented one mechanism and implemented
    // two.
    if (bundled && !cliDelegate) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    if (cliDelegate) {
        // `--splitting` moves this module's body into a shared chunk, so the URL
        // comparison below weighs the CHUNK against `argv[1]` and never matches.
        // `agent-config doctor` shipped producing zero bytes and exit 0 for
        // exactly that reason — a diagnostic reporting success while saying
        // nothing. The invoked file name is the reliable signal inside this
        // bundle; the delegate smoke test keeps the literal honest.
        if (path.basename(process.argv[1], '.js') === 'cmd_doctor') {
            return true;
        }
        // A miss falls THROUGH to the realpath comparison below rather than
        // returning false: a symlinked or renamed invocation is exactly the
        // case that fallback exists for, and swallowing it here would rebuild
        // the silent no-op this change removes.
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
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
    _team_codex_binary_name,
    _check_lockfile_freshness,
    _check_global_binary,
    _check_claude_plugin,
    _check_claude_command_wrappers,
    _check_bridge_drift,
    _check_mcp_mode,
    _check_offline_readiness,
    _check_stale_orphans,
    _check_rule_scope_drift,
    _check_duplicate_scope_rules,
    _check_python_runtime,
    _check_humanizer_runtime,
    _check_mcp_beta_readiness,
    _check_tier_usage_readiness,
    _check_council_cli,
    _check_detection,
    _detection_report,
    _read_council_facts,
    _reset_detection_memo,
    _check_team,
    _check_unsupported_combos,
    _check_wizard_state,
    _check_settings_review_pending,
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

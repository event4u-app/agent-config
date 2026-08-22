#!/usr/bin/env tsx
/**
 * Agent-config sync — project the artefact roots under src/ → dist/agent-src/
 * and project dist/agent-src/ → .augment/ (copies for rules by default,
 * symlinks for the rest; opt into rule symlinks via
 * augment.rules_use_symlinks in .agent-settings.yml).
 *
 * Ported from the retired Python `src/scripts/condense.py` (ADR-200 — Python→TS
 * migration, Phase 5), which mirrored the Python CLI surface exactly.
 * ADR-201 then narrowed it: `.md` is copied verbatim + path-rewritten instead of
 * rewritten by an agent, so the condensation-hash cache and its subcommands
 * (`--check-hashes`, `--clean-hashes`, `--mark-done`, `--mark-all-done`) are gone —
 * staleness is read off the projection itself. Remaining surface: `--sync`,
 * `--list`, `--changed`, `--check`, `--generate-tools`, `--clean-tools`,
 * `--project-augment`.
 *
 * Path handling note: the retired Python implementation uses `pathlib.Path` objects.
 * This twin uses absolute path strings (the host filesystem on the
 * supported platforms is POSIX). Logical relative paths are always POSIX
 * (forward-slash) strings, matching the Python `.as_posix()` keys.
 *
 * Module-level constants (PROJECT_ROOT, SOURCE_DIR, TARGET_DIR, …) and the
 * multi-root helper functions (iter_all_sources, resolve_logical,
 * artefact_roots) are exposed through a mutable module-state object so the
 * pytest suite's monkeypatch pattern — reassigning `condense.PROJECT_ROOT`,
 * `condense.TARGET_DIR`, `condense.iter_all_sources`, … — has a faithful TS
 * equivalent. Tests mutate `MODULE_STATE` via the exported setters.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import {
    _domains_command_logical,
    artefact_roots as _agent_src_artefact_roots,
    iter_all_sources as _agent_src_iter_all_sources,
    resolve_logical as _agent_src_resolve_logical,
    strip_source_prefix,
} from './_lib/agent_src.js';
// Import-safety note: `project_thin_rules` guards its CLI entry
// (`_isCliEntry()` before `process.exit(main())`), so importing it here is
// side-effect-free. condense.ts is bundled into the installer, where a bare
// top-level `process.exit` would fire at consumer runtime — the documented
// bundled-CLI-entry-guard landmine. Verified before wiring, not assumed.
import { build_thin } from './project_thin_rules.js';
import { build_claude_hook_matrix } from './_lib/claude_settings_hooks.js';
import { is_claude_builtin_name } from './_lib/claude_builtin_names.js';
import { project_settings_path, load_agent_settings } from './_lib/agent_settings.js';
import { rule_is_compile_enabled } from './_lib/compile_time_toggles.js';
import { resolve_rule_pack_scope } from './_lib/scoped_projection.js';
import { info, success, flush_summary, resolve_level } from './_lib/script_output.js';
import {
    TIER_TO_CLAUDE_MODEL as _TIER_TO_CLAUDE_MODEL,
    MODEL_TIER_RE as _MODEL_TIER_RE,
} from './_lib/model_tier.js';

// The Python module imports `_SLUG_PREFIX_RE` from `_lib.agent_src`. The TS
// twin does not re-export that private regex, so reproduce it locally — it is
// only used by `_domains_slug_prefix` below (PROJECT_ROOT-aware mirror).
const _SLUG_PREFIX_RE = /^slug_prefix:\s*"?([a-z][a-z0-9-]*)"?\s*$/m;

/**
 * Best-effort YAML parse mirroring Python's `yaml.safe_load` tolerance.
 * Returns `null` on any parse failure (callers treat that as "no data").
 * version '1.1' matches PyYAML's bool/int quirks so frontmatter parses
 * identically. A STATIC import (not a lazy `require`) — `require` is not
 * reliably available under ESM/tsx, which silently degraded dependency
 * folding to a plain file hash when condense.ts ran as the main module.
 */
function _yamlParse(text: string): unknown {
    try {
        const data = YAML.parse(text, { version: '1.1' });
        return data === undefined ? null : data;
    } catch {
        return null;
    }
}

// --- Filesystem helpers reproducing pathlib semantics ------------------------

function _exists(p: string): boolean {
    try {
        fs.lstatSync(p);
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Path.exists() OR Path.is_symlink() — true even for a broken symlink. */
function _existsOrSymlink(p: string): boolean {
    try {
        fs.lstatSync(p);
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

function _isSymlink(p: string): boolean {
    try {
        return fs.lstatSync(p).isSymbolicLink();
    } catch {
        return false;
    }
}

/** `Path.is_dir()` that does NOT follow a symlink (lstat-based). */
function _isDirNoFollow(p: string): boolean {
    try {
        return fs.lstatSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _readText(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

function _writeText(p: string, text: string): void {
    fs.writeFileSync(p, text, 'utf-8');
}

function _mkdirp(p: string): void {
    fs.mkdirSync(p, { recursive: true });
}

/** Sorted immediate children as absolute paths (mirrors sorted(p.iterdir())). */
function _iterdirSorted(p: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(p);
    } catch {
        return [];
    }
    names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return names.map((n) => path.join(p, n));
}

/**
 * Mirror `root.rglob(pattern)` → SORTED absolute path strings. Yields every
 * descendant (files AND dirs) whose name matches; callers sort, so sort here
 * by the POSIX-string key Python uses. `pattern` is `"*"` or a `"*<suffix>"`
 * suffix glob.
 */
function _rglobSorted(root: string, pattern: string): string[] {
    const out: string[] = [];
    const suffix = pattern === '*' ? null : pattern.slice(1);
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            const matches = suffix === null ? true : ent.name.endsWith(suffix);
            if (matches) {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return out;
}

function _relativeToPosix(child: string, root: string): string {
    const rel = path.relative(root, child);
    return rel.split(path.sep).join('/');
}

function _isUnder(child: string, root: string): boolean {
    const rel = path.relative(root, child);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** POSIX `parts` of a path string, dropping empty segments (mirrors Path.parts). */
function _posixParts(p: string): string[] {
    return p.split('/').filter((s) => s.length > 0);
}

/** Python str.lstrip() with no args — strip leading Unicode whitespace. */
function _lstrip(s: string): string {
    return s.replace(/^\s+/u, '');
}

/** Python str.strip() with no args — strip leading/trailing Unicode whitespace. */
function _strip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** Python str.lstrip("\n") — strip only leading newlines. */
function _lstripNewlines(s: string): string {
    return s.replace(/^\n+/, '');
}

/** Python `.strip('"').strip("'")` — strip the given chars from both ends. */
function _stripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) start += 1;
    while (end > start && chars.includes(s[end - 1] as string)) end -= 1;
    return s.slice(start, end);
}

// =============================================================================
// Module state — mutable mirror of the Python module-level constants & hooks.
//
// The pytest suite reassigns `condense.PROJECT_ROOT`, `condense.TARGET_DIR`,
// `condense.TARGET_DIR`, `condense.SOURCE_DIR`, `condense.RULES_SOURCE`,
// `condense.SKILLS_SOURCE`, `condense.COMMANDS_SOURCE`,
// `condense.CLAUDE_SKILLS_DIR`, `condense.AUGMENT_DIR`, `condense.SETTINGS_FILE`,
// and the helper functions `condense.iter_all_sources`,
// `condense.resolve_logical`, `condense.artefact_roots`. All such state lives
// here so TS tests can inject the same way via the exported setters.
//
// PROJECT_ROOT default: Path(__file__).resolve().parent.parent.parent — the
// .py file lives at <repo>/src/scripts/condense.py, so three parents up is
// the repo root.
// =============================================================================

// road-to-consistent-rule-scoping: the predicate moved to a side-effect-free
// module so the consumer installer can import it WITHOUT pulling this file's
// module-level CLI self-invoke into its bundle. Re-exported here because four
// in-repo consumers import it from `condense.js`.
export { rule_in_scope } from '../install/ruleInScope.js';
// Re-exported for in-repo consumers; definitions moved beside emit_host_rules_cli.ts (Phase 5).
export {
    CLAUDE_PATHS_PATTERN_BUDGET,
    _claude_paths_plan,
    _escape_claude_bracket,
    _expanded_pattern_count,
    _has_non_path_trigger,
    _is_unresolved_placeholder,
    derive_trigger_globs,
    type ClaudePathsPlan,
} from '../install/claudePathsPlan.js';
import { rule_in_scope } from '../install/ruleInScope.js';
import { pruneEmptyDirs } from './_lib/prune_empty_dirs.js';
import { commandsWithheld, isExclusivelyPackageOnly, partitionActive, personaPartition, setPartitionAnnounce } from '../install/partitionEligibility.js'; // ADR-236
import { hostLayerCarries, toolIdForProjectRuleDir } from '../install/globalRuleLayers.js'; // ADR-236, per-host evidence
import { _claude_paths_plan, derive_trigger_globs } from '../install/claudePathsPlan.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url)); // <repo>/src/scripts
const _DEFAULT_PROJECT_ROOT = path.resolve(_HERE, '..', '..');

interface ModuleState {
    PROJECT_ROOT: string;
    SOURCE_DIR: string;
    TARGET_DIR: string;
    AUGMENT_DIR: string;
    SETTINGS_FILE: string;
    RULES_SOURCE: string;
    SKILLS_SOURCE: string;
    COMMANDS_SOURCE: string;
    PERSONAS_SOURCE: string;
    USER_TYPES_SOURCE: string;
    CLAUDE_SKILLS_DIR: string;
    CLAUDE_AGENTS_DIR: string;
    SUBAGENTS_SOURCE: string;
    PLUGIN_SKILLS_DIR: string;
    // Injectable multi-root helpers (monkeypatch seam).
    iter_all_sources: () => Iterable<[string, string]>;
    resolve_logical: (rel: string) => string | null;
    artefact_roots: () => Iterable<string>;
}

function _deriveState(root: string): ModuleState {
    return {
        PROJECT_ROOT: root,
        SOURCE_DIR: path.join(root, '.agent-src.uncondensed'),
        TARGET_DIR: path.join(root, 'dist/agent-src'),
        AUGMENT_DIR: path.join(root, '.augment'),
        SETTINGS_FILE: project_settings_path(root),
        RULES_SOURCE: path.join(root, 'dist/agent-src', 'rules'),
        SKILLS_SOURCE: path.join(root, 'dist/agent-src', 'skills'),
        COMMANDS_SOURCE: path.join(root, 'dist/agent-src', 'commands'),
        PERSONAS_SOURCE: path.join(root, 'dist/agent-src', 'personas'),
        USER_TYPES_SOURCE: path.join(root, 'dist/agent-src', 'user-types'),
        CLAUDE_SKILLS_DIR: path.join(root, '.claude', 'skills'),
        // ADR-109: subagents project from src/ directly (NOT dist/) — a subagent
        // is an executable system prompt Claude Code runs verbatim; telegraph
        // condensation would alter its behaviour, and it is not routed through the
        // pack/discovery condensation flow.
        CLAUDE_AGENTS_DIR: path.join(root, '.claude', 'agents'),
        SUBAGENTS_SOURCE: path.join(root, 'src', 'subagents'),
        PLUGIN_SKILLS_DIR: path.join(root, '.claude-plugin', 'skills'),
        iter_all_sources: _agent_src_iter_all_sources,
        resolve_logical: _agent_src_resolve_logical,
        artefact_roots: _agent_src_artefact_roots,
    };
}

export const MODULE_STATE: ModuleState = _deriveState(_DEFAULT_PROJECT_ROOT);
setPartitionAnnounce(success); // ADR-236: the mode line must be visible at the default level

/**
 * Test seam — reassign one or more module-state fields, mirroring the pytest
 * monkeypatch of `condense.<NAME> = ...`. When `PROJECT_ROOT` is overridden,
 * SETTINGS_FILE is NOT recomputed (Python tests set it explicitly when they
 * need it) — only the literally-supplied keys change. Not part of the Python
 * surface; a TS-only injection point.
 */
export function _setStateForTest(overrides: Partial<ModuleState>): void {
    Object.assign(MODULE_STATE, overrides);
}

/** Snapshot module state for save/restore in tests. */
export function _getStateForTest(): ModuleState {
    return { ...MODULE_STATE };
}

/**
 * Re-derive ALL module-state fields from a fresh PROJECT_ROOT (mirrors the
 * Python convention where every constant is recomputed from PROJECT_ROOT).
 * Convenience for tests that want a clean tmp-root layout.
 */
export function _resetStateForTest(root: string = _DEFAULT_PROJECT_ROOT): void {
    Object.assign(MODULE_STATE, _deriveState(root));
}

// Convenience accessors used internally — read through MODULE_STATE so a test
// override is always honoured.
function _iter_sources(): Iterable<[string, string]> {
    // Wraps the injectable iter_all_sources hook (mirrors condense._iter_sources).
    return MODULE_STATE.iter_all_sources();
}

function _resolve_source(relative: string): string | null {
    return MODULE_STATE.resolve_logical(relative);
}

function _any_source_root_exists(): boolean {
    return [...MODULE_STATE.artefact_roots()].length > 0;
}

// --- Self-projection tool toggle ---------------------------------------------

const _ALL_TOOLS: ReadonlySet<string> = new Set([
    'claude-code',
    'claude-desktop',
    'augment',
    'copilot',
    'cursor',
    'windsurf',
    'cline',
    'gemini',
]);
void _ALL_TOOLS;

/**
 * Tool ids selected by `agents/.agent-tools.yml` under `root`, or `null` when
 * the file is absent / malformed / carries no `tools:` list — `null` means
 * "all tools active", never "none".
 *
 * Root-parameterised and exported so a consumer auditing a checkout other than
 * `MODULE_STATE.PROJECT_ROOT` (a gate run with `--root`) reads the selection
 * this generator actually honours, instead of re-implementing these four
 * fallbacks and drifting from them.
 */
export function active_tools_at(root: string): ReadonlySet<string> | null {
    const tools_file = path.join(root, 'agents', '.agent-tools.yml');
    if (!_exists(tools_file)) {
        return null;
    }
    // Mirrors Python's `yaml.safe_load`; a malformed file → YAMLError → null
    // (treated as "all tools").
    let data: unknown = _yamlParse(_readText(tools_file));
    if (data === null || data === undefined) {
        data = {};
    }
    const tools =
        typeof data === 'object' && data !== null && !Array.isArray(data)
            ? (data as Record<string, unknown>)['tools']
            : null;
    if (!Array.isArray(tools)) {
        return null;
    }
    return new Set(tools.filter((t): t is string => typeof t === 'string'));
}

function _active_tools(): ReadonlySet<string> | null {
    return active_tools_at(MODULE_STATE.PROJECT_ROOT);
}

function _tool_active(tool_id: string): boolean {
    const active = _active_tools();
    return active === null ? true : active.has(tool_id);
}

// Files to copy as-is even if .md (not condensed by agent).
const COPY_AS_IS: ReadonlySet<string> = new Set(['README.md']);
// Directories whose .md content is data, not prose — copied verbatim.
const COPY_AS_IS_DIRS: ReadonlySet<string> = new Set(['ghostwriter']);

// --- settings readers --------------------------------------------------------

function _read_augment_rules_use_symlinks(): boolean {
    const data = load_agent_settings({ project_path: MODULE_STATE.SETTINGS_FILE });
    const augment = data['augment'];
    if (typeof augment !== 'object' || augment === null || Array.isArray(augment)) {
        return false;
    }
    const value = (augment as Record<string, unknown>)['rules_use_symlinks'];
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return ['true', 'yes', 'on', '1'].includes(value.trim().toLowerCase());
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    return false;
}

/**
 * Per-tool user-scope rule directory, for the scope-dedup below. Only tools
 * whose host reads a user-scope rules directory can have a redundant twin;
 * everything else has nothing to de-duplicate against.
 */
const USER_SCOPE_RULE_DIRS: Readonly<Record<string, string>> = {
    '.claude/rules': path.join('.claude', 'rules'),
};

function _read_projection_scope_dedup(): boolean {
    const data = load_agent_settings({ project_path: MODULE_STATE.SETTINGS_FILE });
    const projection = data['projection'];
    if (typeof projection !== 'object' || projection === null || Array.isArray(projection)) {
        return false;
    }
    const value = (projection as Record<string, unknown>)['scope_dedup'];
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return ['true', 'yes', 'on', '1'].includes(value.trim().toLowerCase());
    }
    return false;
}

/**
 * Rules whose user-scope twin is BYTE-IDENTICAL to the source, i.e. safe to
 * skip at project scope: the host still loads the same text, once instead of
 * twice, so nothing the model sees changes.
 *
 * Byte-identity is the whole safety argument and is not negotiable. Keying on
 * the filename alone would silently let a stale globally-installed copy win
 * whenever the two scopes hold different versions — which is the NORMAL state
 * while developing the package (measured: 110/110 shared filenames differing in
 * bytes). This is deliberately not the thin-projection mechanism: no rule
 * becomes trigger-gated, so the quality floor that disabled thin projection
 * does not apply here.
 */
function _dedupable_rules(tool_dir: string, rules: readonly string[], userHome: string): Set<string> {
    const relative = USER_SCOPE_RULE_DIRS[tool_dir];
    if (relative === undefined) {
        return new Set();
    }
    // A hostile or simply absent $HOME must make the dedup inert, not
    // adventurous. In a container `$HOME` is often unset (so `homedir()` can
    // resolve to `/`) or world-writable, and this function decides which rules
    // to STOP emitting — reading an unexpected tree there is how a projection
    // silently loses a rule. Council review of PR #1055 raised exactly this.
    let userDirStat: fs.Stats;
    const userDir = path.join(userHome, relative);
    try {
        userDirStat = fs.statSync(userDir);
    } catch {
        return new Set();
    }
    if (!userDirStat.isDirectory()) {
        return new Set();
    }
    // World-writable user scope: anyone on the box could plant a byte-identical
    // twin and thereby delete a rule from the project projection. Refuse.
    if ((userDirStat.mode & 0o002) !== 0) {
        _print(`  ⚠️  ${tool_dir}: user-scope rules dir is world-writable — scope-dedup skipped`);
        return new Set();
    }
    const skip = new Set<string>();
    for (const rule of rules) {
        const twin = path.join(userDir, rule);
        const source = path.join(MODULE_STATE.RULES_SOURCE, rule);
        try {
            if (!_isFile(twin) || !_isFile(source)) continue;
            if (fs.readFileSync(twin).equals(fs.readFileSync(source))) {
                skip.add(rule);
            }
        } catch {
            // An unreadable twin is simply not de-duplicable — emit the project copy.
        }
    }
    return skip;
}

function _lean_projection_mode(): string {
    const data = load_agent_settings({ project_path: MODULE_STATE.SETTINGS_FILE });
    const lean = data['lean_projection'];
    if (
        typeof lean === 'object' &&
        lean !== null &&
        !Array.isArray(lean) &&
        String((lean as Record<string, unknown>)['mode'] ?? '')
            .trim()
            .toLowerCase() === 'thin'
    ) {
        return 'thin';
    }
    return 'eager-all';
}

// --- hashing -----------------------------------------------------------------



export function apply_path_rewriter(relative_path: string): boolean {
    const target = path.join(MODULE_STATE.TARGET_DIR, relative_path);
    if (!_exists(target) || !relative_path.endsWith('.md')) {
        return false;
    }
    const original = _readText(target);
    const rewritten = _rewrite_paths(original, relative_path);
    if (rewritten === original) {
        return false;
    }
    _writeText(target, rewritten);
    return true;
}


/**
 * Whether the projection of `relative` is out of date.
 *
 * Post-ADR-201 the projection IS `rewrite(source)` — a pure function of the
 * source's own bytes and its own relative path. So staleness is *observable in
 * the output* rather than inferred from a stored source hash, which is both
 * simpler and strictly stronger: the old hash cache could only tell you the
 * source had moved since someone last claimed to have condensed it. It never
 * looked at dist, so a hand-edited or half-written projection read as current.
 *
 * The dropped dependency-folding (`effective_hash` mixed in the hashes of
 * `skills:` / `rules:` frontmatter deps) has no counterpart here, and needs
 * none: an LLM rewrite could be influenced by a dependency's content, a pure
 * rewrite cannot. Probed rather than assumed — the whole rewriter chain
 * (`_depth_prefix`, `_split_frontmatter`, `_rewrite_body_links`,
 * `_rewrite_frontmatter_lines`, `_parse_trust_and_owner`,
 * `_inject_hrr_banner`) touches no file but its own input.
 */
export function is_projection_stale(relative: string): boolean {
    const source = _resolve_source(relative);
    if (source === null) {
        // No source at all — a leftover in dist. `check_sync` owns that verdict.
        return false;
    }
    if (skip_compile_disabled_rule(relative)) {
        // Deliberately absent from the projection, not out of date.
        return false;
    }
    const target = path.join(MODULE_STATE.TARGET_DIR, relative);
    if (!_exists(target)) {
        return true; // never projected
    }
    return _readText(target) !== _rewrite_paths(_readText(source), relative);
}

export function list_changed_md(_source_dir?: string): string[] {
    // _source_dir retained for signature compatibility but ignored (multi-root).
    const changed: string[] = [];
    const seen = new Set<string>();
    for (const [, relative] of _iter_sources()) {
        if (seen.has(relative)) {
            continue;
        }
        seen.add(relative);
        // Resolve through `_resolve_source` rather than trusting the iterator's
        // physical hit: `src/` and `src/agent-src/` are both artefact roots, so
        // one relative path can name two unrelated files and only the resolver
        // knows which one wins.
        const source = _resolve_source(relative);
        if (source === null || !should_condense(source)) {
            continue;
        }
        if (is_projection_stale(relative)) {
            changed.push(relative);
        }
    }
    return changed;
}


export function should_condense(filepath: string): boolean {
    if (path.extname(filepath) !== '.md') {
        return false;
    }
    if (COPY_AS_IS.has(path.basename(filepath))) {
        return false;
    }
    // Determine logical relative parts so COPY_AS_IS_DIRS works for legacy +
    // post-move source roots. Default to the full path parts (Python: Path.parts).
    let rel_parts: string[] = filepath.split(path.sep).filter((s) => s.length > 0);
    for (const root of MODULE_STATE.artefact_roots()) {
        if (filepath !== root && !_isUnder(filepath, root)) {
            continue;
        }
        rel_parts = _relativeToPosix(filepath, root).split('/');
        break;
    }
    if (rel_parts.length > 0 && COPY_AS_IS_DIRS.has(rel_parts[0] as string)) {
        return false;
    }
    return true;
}

export function copy_file(source: string, target: string): void {
    _mkdirp(path.dirname(target));
    fs.copyFileSync(source, target);
    // shutil.copy2 also preserves metadata (mtime/mode); fidelity for content
    // is what matters for the sync/hash contract.
    try {
        const st = fs.statSync(source);
        fs.utimesSync(target, st.atime, st.mtime);
        fs.chmodSync(target, st.mode);
    } catch {
        /* best-effort metadata copy */
    }
}

export function cleanup_stale(_source_dir: string, target_dir: string): number {
    let deleted = 0;
    if (!_exists(target_dir)) {
        return 0;
    }
    for (const target_file of _rglobSorted(target_dir, '*')) {
        if (_isDir(target_file)) {
            continue;
        }
        const relative = _relativeToPosix(target_file, target_dir);
        if (_resolve_source(relative) === null) {
            _print(`  Deleting stale: ${relative}`);
            fs.unlinkSync(target_file);
            deleted += 1;
        }
    }
    // Remove empty directories (reverse-sorted, deepest first).
    const dirs = _rglobSorted(target_dir, '*')
        .filter((p) => _isDir(p))
        .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    for (const dirpath of dirs) {
        try {
            if (fs.readdirSync(dirpath).length === 0) {
                fs.rmdirSync(dirpath);
                _print(`  Removing empty dir: ${_relativeToPosix(dirpath, target_dir)}`);
            }
        } catch {
            /* races/permission — ignore, mirrors Python best-effort */
        }
    }
    return deleted;
}

/** ADR-201 (accepted 2026-07-29): `.md` is COPIED + path-rewritten, never rewritten
 * by an LLM. Set false to restore the pre-ADR-201 behaviour, where `.md` was skipped
 * here and an agent wrote the condensed body into `dist/` by hand.
 *
 * Measured basis for the removal: 0/429 artifacts saved ≥500 tok, aggregate 0.86%,
 * 267/429 byte-identical, and −36 tok on the always-loaded kernel (condensation made
 * the per-request surface *worse*). Determinism failed by construction: the hash
 * covered the source, never the output, so drift was undetectable — observed live.
 *
 * Council verdict A: `dist/agent-src/` STAYS as a deterministically-produced,
 * git-diffable artifact. Only the *manner* of derivation changes. */
export const COPY_MD_VERBATIM = true;

/** True when `relative` is a rule whose compile-time toggle is off, so the projector
 * must not emit it. Exported for the coupling test — without a pinned test the
 * second half of "dormancy" would be asserted rather than enforced, which is the
 * exact failure ADR telegraph/0002 § part 1 records. */
export function skip_compile_disabled_rule(relative: string): boolean {
    const posix = relative.split(path.sep).join('/');
    if (!posix.startsWith('rules/') || !posix.endsWith('.md')) {
        return false;
    }
    const rule_id = path.basename(posix, '.md');
    const settings = load_agent_settings({ project_path: MODULE_STATE.SETTINGS_FILE }) as Record<
        string,
        unknown
    >;
    return !rule_is_compile_enabled(rule_id, settings);
}

export function sync_non_md(_source_dir: string, target_dir: string): number {
    let copied = 0;
    const seen = new Set<string>();
    for (const [source_file, relative] of _iter_sources()) {
        if (!COPY_MD_VERBATIM && should_condense(source_file)) {
            continue; // pre-ADR-201: .md was condensed by the agent, not copied here
        }
        if (seen.has(relative)) {
            continue;
        }
        // ADR telegraph/0002 § part 1: a compile-time-disabled RULE must not be
        // emitted at all. Router membership alone was never zero-cost — the host
        // reads the projected FILE, so a rule dropped from router.json while its
        // body still shipped kept costing its full token price. One switch, both
        // surfaces. Unknown ids are always emitted (the map gates, it does not
        // allowlist), so this is a no-op for every rule but the gated ones.
        if (skip_compile_disabled_rule(relative)) {
            continue;
        }
        seen.add(relative);
        const target_file = path.join(target_dir, relative);
        copy_file(source_file, target_file);
        // ADR-201: a copied `.md` still needs the ONE deterministic transform the
        // removal deliberately preserves — `apply_path_rewriter` fixes relative
        // links so they resolve from the DELIVERED location (`../../docs/…` →
        // `../docs/…`, ~38 artifacts). Without this the projection's links break.
        // Idempotent: it returns false when nothing changed.
        if (COPY_MD_VERBATIM && relative.endsWith('.md')) {
            apply_path_rewriter(relative);
        }
        _print(`  Copied: ${relative}`);
        copied += 1;
    }
    return copied;
}

export function list_md_files(_source_dir?: string): string[] {
    const files: string[] = [];
    const seen = new Set<string>();
    for (const [source_file, relative] of _iter_sources()) {
        if (!should_condense(source_file)) {
            continue;
        }
        if (seen.has(relative)) {
            continue;
        }
        seen.add(relative);
        files.push(relative);
    }
    return files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function check_sync(_source_dir: string, target_dir: string): [string[], string[]] {
    const missing: string[] = [];
    const stale: string[] = [];
    const seen = new Set<string>();
    for (const [, relative] of _iter_sources()) {
        if (seen.has(relative)) {
            continue;
        }
        seen.add(relative);
        // A compile-disabled rule is deliberately absent from the projection,
        // so demanding a counterpart would report the intended state as a defect.
        // Same predicate the projector and the router compiler use.
        if (skip_compile_disabled_rule(relative)) {
            continue;
        }
        if (!_exists(path.join(target_dir, relative))) {
            missing.push(relative);
        }
    }
    if (_exists(target_dir)) {
        for (const target_file of _rglobSorted(target_dir, '*')) {
            if (_isDir(target_file)) {
                continue;
            }
            const relative = _relativeToPosix(target_file, target_dir);
            // Two ways a projected file is stale: no source at all, or a source
            // that is compile-disabled — the second is how a re-enabled-then-
            // disabled rule leaves weight behind.
            if (_resolve_source(relative) === null || skip_compile_disabled_rule(relative)) {
                stale.push(relative);
            }
        }
    }
    return [missing, stale];
}

// ── Multi-agent tool generation ──────────────────────────────────────

const TOOL_DIRS: Record<string, string> = {
    '.claude/rules': '../../dist/agent-src/rules',
    '.cursor/rules': '../../dist/agent-src/rules',
    '.clinerules': '../dist/agent-src/rules',
};

const PERSONA_TOOL_DIRS: Record<string, string> = {
    '.claude/personas': '../../dist/agent-src/personas',
    '.cursor/personas': '../../dist/agent-src/personas',
};

const USER_TYPE_TOOL_DIRS: Record<string, string> = {
    '.claude/user-types': '../../dist/agent-src/user-types',
    '.cursor/user-types': '../../dist/agent-src/user-types',
};

const _DIR_TOOL_ID: Record<string, string> = {
    '.claude/rules': 'claude-code',
    '.cursor/rules': 'cursor',
    '.clinerules': 'cline',
    '.claude/personas': 'claude-code',
    '.cursor/personas': 'cursor',
    '.claude/user-types': 'claude-code',
    '.cursor/user-types': 'cursor',
};

function _filter_tool_dirs(mapping: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [d, p] of Object.entries(mapping)) {
        if (_tool_active(_DIR_TOOL_ID[d] ?? 'claude-code')) {
            out[d] = p;
        }
    }
    return out;
}

export function strip_frontmatter(content: string): string {
    if (content.startsWith('---')) {
        const end = content.indexOf('---', 3);
        if (end !== -1) {
            content = _lstripNewlines(content.slice(end + 3));
        }
    }
    return content;
}

// ── Path rewriter (P1 of road-to-path-fixes.md) ───────────────────────────
// Kept byte-identical to check_condensation.ts::_rewritePaths (the two MUST
// agree — see ADR-200 note). Mirrors condense.py::_rewrite_paths.

const _LEGACY_SRC_PREFIX = '.agent-src.uncondensed/';
const _PROJECTED_SRC_PREFIX = 'dist/agent-src/';
const _LEGACY_PROJECTED_SRC_PREFIX = '.agent-src/';

const _FM_LIST_ITEM_RE = /^(\s*-\s*)(["']?)([^"'\n]+?\.md)(["']?)\s*$/;
const _FM_PATH_PREFIX_RE = /^(\s*(?:-\s+)?path_prefix:\s*)(["']?)([^"'\n]+?)(["']?)\s*$/;
const _BODY_DOCS_RE = /\.\.\/\.\.\/(docs\/(?:guidelines|contracts)\/[^)\s]+\.md)/g;
const _FM_PLAIN_LIST_RE = /^\s*-\s*(["']?)([^"'\n]+?)\1\s*$/;

const _HRR_BANNER_MARKER = '<!-- agent-config:human-review-banner -->';

function _depth_prefix(source_relative_path: string): string {
    const parts = _posixParts(source_relative_path);
    const depth = Math.max(parts.length - 1, 1);
    return '../'.repeat(depth);
}

function _split_frontmatter(content: string): [string[] | null, string] {
    if (!content.startsWith('---\n')) {
        return [null, content];
    }
    const end = content.indexOf('\n---\n', 4);
    if (end === -1) {
        return [null, content];
    }
    const fm_text = content.slice(4, end);
    const body = content.slice(end + '\n---\n'.length);
    return [fm_text.split('\n'), body];
}

function _rewrite_load_context_value(value: string, prefix: string): string {
    if (value.startsWith('../') || value.startsWith('./') || value.startsWith('/')) {
        return value;
    }
    if (value.startsWith(_LEGACY_SRC_PREFIX)) {
        return prefix + value.slice(_LEGACY_SRC_PREFIX.length);
    }
    if (value.startsWith(_PROJECTED_SRC_PREFIX)) {
        return prefix + value.slice(_PROJECTED_SRC_PREFIX.length);
    }
    if (value.startsWith(_LEGACY_PROJECTED_SRC_PREFIX)) {
        return prefix + value.slice(_LEGACY_PROJECTED_SRC_PREFIX.length);
    }
    return prefix + value;
}

function _rewrite_path_prefix_value(value: string): string {
    return value; // no-op — literal match pattern, not a file reference
}

function _rewrite_frontmatter_lines(lines: string[], prefix: string): string[] {
    let in_load_context = false;
    const out: string[] = [];
    for (const line of lines) {
        const bare = _lstrip(line);
        if (bare.startsWith('load_context:') || bare.startsWith('load_context_eager:')) {
            in_load_context = true;
            out.push(line);
            continue;
        }
        if (in_load_context) {
            const m = _FM_LIST_ITEM_RE.exec(line);
            if (m) {
                const indent = m[1] ?? '';
                const q1 = m[2] ?? '';
                const value = m[3] ?? '';
                const q2 = m[4] ?? '';
                out.push(`${indent}${q1}${_rewrite_load_context_value(value, prefix)}${q2}`);
                continue;
            }
            in_load_context = false;
        }
        const pm = _FM_PATH_PREFIX_RE.exec(line);
        if (pm) {
            const head = pm[1] ?? '';
            const q1 = pm[2] ?? '';
            const value = pm[3] ?? '';
            const q2 = pm[4] ?? '';
            out.push(`${head}${q1}${_rewrite_path_prefix_value(value)}${q2}`);
            continue;
        }
        out.push(line);
    }
    return out;
}

function _rewrite_body_links(body: string, prefix: string): string {
    return body.replace(_BODY_DOCS_RE, (_m, tail: string) => prefix + tail);
}

function _parse_trust_and_owner(fm_lines: string[]): [string, boolean, string] {
    let level = 'core';
    let hrr = false;
    const packs: string[] = [];
    const workspaces: string[] = [];
    let in_trust = false;
    let in_packs = false;
    let in_workspaces = false;
    for (const line of fm_lines) {
        const stripped = _lstrip(line);
        const indent = line.length - stripped.length;
        if (indent === 0 && stripped.endsWith(':')) {
            const key = stripped.slice(0, -1);
            in_trust = key === 'trust';
            in_packs = key === 'packs';
            in_workspaces = key === 'workspaces';
            continue;
        }
        if (in_trust && stripped.startsWith('level:')) {
            const after = stripped.slice(stripped.indexOf(':') + 1);
            level = _stripChars(_stripChars(_strip(after), '"'), "'");
        } else if (in_trust && stripped.startsWith('human_review_required:')) {
            const after = stripped.slice(stripped.indexOf(':') + 1);
            hrr = _strip(after).toLowerCase() === 'true';
        } else if (in_packs || in_workspaces) {
            const m = _FM_PLAIN_LIST_RE.exec(line);
            if (m) {
                const value = _strip(m[2] ?? '');
                (in_packs ? packs : workspaces).push(value);
            }
        }
    }
    let owner = 'unknown';
    if (packs.length > 0) {
        owner = (packs[0] as string).split('-')[0] as string;
    } else if (workspaces.length > 0) {
        owner = workspaces[0] as string;
    }
    return [level, hrr, owner];
}

function _inject_hrr_banner(body: string, level: string, owner: string): string {
    if (body.includes(_HRR_BANNER_MARKER)) {
        return body;
    }
    const banner =
        `${_HRR_BANNER_MARKER}\n` + `> HUMAN REVIEW REQUIRED · trust: ${level} · owner: ${owner}\n\n`;
    return banner + _lstripNewlines(body);
}

export function _rewrite_paths(content: string, source_relative_path: string): string {
    const prefix = _depth_prefix(source_relative_path);
    const [fm_lines, bodyInitial] = _split_frontmatter(content);
    let body = _rewrite_body_links(bodyInitial, prefix);
    if (fm_lines === null) {
        return body;
    }
    const new_fm = _rewrite_frontmatter_lines(fm_lines, prefix);
    const [level, hrr, owner] = _parse_trust_and_owner(fm_lines);
    if (hrr && level) {
        body = _inject_hrr_banner(body, level, owner);
    }
    return '---\n' + new_fm.join('\n') + '\n---\n' + body;
}

// Expose the HRR marker for tests (mirrors condense._HRR_BANNER_MARKER access).
export { _HRR_BANNER_MARKER };

// ── Consumer-scoped rule projection (road-to-request-scoped-rule-load P1) ──
//
// Opt-in via `projection.rule_workspaces: [<workspace-id>, …]` in
// `.agent-settings.yml`. Absent / empty = legacy-all (every rule projects —
// today's behaviour, non-breaking). When set, a non-kernel rule projects
// only if its `workspaces:` frontmatter intersects the configured set.
// Kernel rules (`type: always` / `alwaysApply: true`) ALWAYS project —
// the kernel is unconditional and workspace-independent by definition
// (rule-router contract § Schema v2). Untagged rules fail safe: they ship.
// ADR-040: projection-time filtering only, no runtime resolver.

function _read_projection_raw(key: string): unknown {
    const data = load_agent_settings({ project_path: MODULE_STATE.SETTINGS_FILE });
    const proj = data['projection'];
    return typeof proj === 'object' && proj !== null && !Array.isArray(proj)
        ? (proj as Record<string, unknown>)[key]
        : null;
}

function _read_projection_list(key: string): string[] | null {
    const value = _read_projection_raw(key);
    if (Array.isArray(value) && value.length > 0) {
        return value.map((v) => String(v));
    }
    return null;
}

function _read_rule_workspaces(): string[] | null {
    return _read_projection_list('rule_workspaces');
}

/** `runtime.active_packs` overlay, empty when unset (fresh-install default). */
function _read_runtime_active_packs(): string[] {
    const data = load_agent_settings({ project_path: MODULE_STATE.SETTINGS_FILE });
    const rt = data['runtime'];
    const value =
        typeof rt === 'object' && rt !== null && !Array.isArray(rt)
            ? (rt as Record<string, unknown>)['active_packs']
            : null;
    return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

/**
 * Pack scope for the rule layer. `rule_packs: auto` derives the active-pack
 * set (the same one the skill/command prune uses) instead of a hand-typed id
 * list; anything else keeps the historical list-or-inactive semantics.
 */
function _read_rule_packs(): string[] | null {
    return resolve_rule_pack_scope(
        _read_projection_raw('rule_packs'),
        MODULE_STATE.PROJECT_ROOT,
        _read_runtime_active_packs(),
    );
}

/**
 * Whether a rule source file projects under the given workspace + pack +
 * role scopes. Each configured scope is an independent constraint: the
 * rule's frontmatter list must intersect it. Kernel always projects;
 * untagged axes fail safe.
 *
 * `role_scope` is the subagent-role axis (road-to-lean-agent-init Phase 4):
 * a `roles:` frontmatter list, parallel to `workspaces:`/`packs:`, so a
 * review-worker subagent's rule projection can be scoped to review-shaped
 * rules instead of the full set. Additive — the new param defaults to
 * `null` (no role filtering), so every existing 2- and 3-arg call site
 * compiles and behaves unchanged.
 */
/** List rule basenames under RULES_SOURCE, workspace/pack scope applied. */
/**
 * Is this rule `type: manual` (ADR-004 reference-only)?
 *
 * The schema is explicit: `manual` = "no auto-injection (zero workspace-budget
 * cost); file remains as a reference document linkable from skills/contexts."
 * `compile_router` already honours the first half by omitting manual rules from
 * `dist/router.json`. The per-tool projection did NOT: it symlinked them into
 * `.claude/rules/` (and siblings), so under the default `eager-all` projection
 * their full bodies were injected every turn — the exact opposite of "zero
 * workspace-budget cost". `brand-consistency` is the clearest case: its own body
 * says "reference-only, no router emission", and it shipped in context anyway.
 *
 * Excluded from the per-tool trees ONLY. The file keeps its place in
 * `dist/agent-src/rules/`, which is what "remains as a reference document
 * linkable" requires — inbound cross-references must still resolve.
 */
function _is_manual_rule(rule_path: string): boolean {
    let content: string;
    try {
        content = fs.readFileSync(rule_path, 'utf-8');
    } catch {
        return false; // unreadable → fail open, same posture as the scope filters
    }
    const [fm_lines] = _split_frontmatter(content);
    if (fm_lines === null) {
        return false;
    }
    for (const line of fm_lines) {
        const m = /^type:\s*["']?([a-z]+)["']?\s*$/.exec(line);
        if (m) {
            return m[1] === 'manual';
        }
    }
    return false;
}

function _scoped_rule_basenames(): string[] {
    const scope = _read_rule_workspaces();
    const pack_scope = _read_rule_packs();
    return _iterdirSorted(MODULE_STATE.RULES_SOURCE)
        .filter((p) => p.endsWith('.md') && _isFile(p))
        .filter((p) => rule_in_scope(p, scope, pack_scope))
        // ADR-004: a manual rule costs zero workspace budget, so it never gets a
        // per-tool symlink regardless of projection mode. See _is_manual_rule.
        .filter((p) => !_is_manual_rule(p))
        // A compile-disabled rule has no dist/agent-src/ counterpart, so a per-tool
        // symlink to it would dangle. The source file still exists, which is why the
        // scope filters alone let it through — the toggle is a separate axis and this
        // is its fourth consumer, after the router compiler, the dist writer, and
        // check_sync. Same predicate in all four; that is the point.
        .filter((p) => !skip_compile_disabled_rule(`rules/${path.basename(p)}`))
        .map((p) => path.basename(p))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Narrow one directory's rule list to the package-only set — but only when THIS
 * host's own global layer is verified to carry what would be withheld.
 *
 * ## Why the decision moved from per-run to per-directory
 *
 * The filter used to sit in {@link _scoped_rule_basenames}, which runs once per
 * generation, so `partitionActive` — a claude-only fingerprint against
 * `installed.lock` — decided for every host at once. That contradicted
 * `partitionEligibility.ts`'s own fail-safe reasoning, which refuses to withhold a
 * cursor artefact on claude's evidence because it "would deliver it nowhere", and
 * it was measurably wrong in both directions on 2026-08-22: `.clinerules` was
 * narrowed to 13 on borrowed evidence, while `.cursor/rules`, `.windsurf/rules`
 * and `.augment/rules` were not narrowed at all because their emitters never
 * called the filter.
 *
 * So the narrowing is per directory and gated on real evidence:
 * {@link hostLayerCarries} reads that host's global directory and answers whether
 * every name about to be withheld is actually there. No layer, an unreadable
 * layer, or one missing a single name → the full projection is returned. A
 * withhold now costs a directory read; the alternative cost a rule.
 *
 * Shared with the three non-symlink emitters, deliberately: four call sites
 * deciding this separately is how three of them came to disagree.
 */
export function partition_rules_for_dir(
    tool_dir: string,
    rules: readonly string[],
    user_home: string = process.env['HOME'] ?? os.homedir(),
): string[] {
    if (!partitionActive(MODULE_STATE.PROJECT_ROOT)) {
        return [...rules];
    }
    const tool_id = toolIdForProjectRuleDir(tool_dir);
    if (tool_id === null) {
        // An unmapped directory has no global layer this code can point at, so
        // there is no evidence to withhold on. Full projection.
        return [...rules];
    }
    const package_only = rules.filter((r) =>
        isExclusivelyPackageOnly(path.join(MODULE_STATE.RULES_SOURCE, r)),
    );
    const withheld = rules.filter((r) => !package_only.includes(r));
    const verdict = hostLayerCarries(tool_id, withheld, user_home);
    if (!verdict.carries) {
        _print(
            `  ⚠️  ${tool_dir}: full projection kept — ${tool_id}'s global layer ` +
                `${verdict.reason === 'carries' ? 'disagreed' : verdict.reason}` +
                (verdict.missing.length > 0
                    ? ` (${String(verdict.missing.length)} rule(s) not there, e.g. ${verdict.missing.slice(0, 3).join(', ')})`
                    : ''),
        );
        return [...rules];
    }
    return package_only;
}

/**
 * The emit plan of {@link generate_rule_symlinks}: active tool dir → the exact
 * rule basenames it projects there.
 *
 * Exported so a completeness gate can assert a host rule tree matches the
 * generator WITHOUT regenerating it. That distinction is the whole point:
 * `check_bridge_derivation` regenerates and then diffs, so it can only ever see
 * a fixpoint, and a five-week-stale tree on a working checkout is invisible to
 * it. A gate that reads the tree as it stands needs the expected set from
 * somewhere, and every other candidate source is wrong in a way that
 * propagates: a hand-maintained array goes obsolete silently, and
 * `dist/agent-src/rules/` over-counts by the ADR-004 `type: manual` rules these
 * trees deliberately omit (113 files, 5 manual, 108 projected).
 *
 * `generate_rule_symlinks` consumes this too, so there is one emit plan rather
 * than a gate's reconstruction of one.
 */
export function projected_rule_trees(
    user_home: string = process.env['HOME'] ?? os.homedir(),
): Record<string, string[]> {
    const rules = _scoped_rule_basenames();
    const dedup_on = _read_projection_scope_dedup();
    const out: Record<string, string[]> = {};
    for (const tool_dir of Object.keys(_filter_tool_dirs(TOOL_DIRS))) {
        const skip = dedup_on ? _dedupable_rules(tool_dir, rules, user_home) : new Set<string>();
        const kept = rules.filter((r) => !skip.has(r));
        out[tool_dir] = partition_rules_for_dir(tool_dir, kept, user_home);
    }
    return out;
}

export function generate_rule_symlinks(): number {
    const rules = _scoped_rule_basenames();
    const tool_dirs = _filter_tool_dirs(TOOL_DIRS);

    let thin_files: Record<string, string> | null = null;
    if (_lean_projection_mode() === 'thin') {
        // DEAD-SWITCH REPAIR (road-to-renewal-foundation Phase 2). This branch
        // used to THROW: the port was skipped as "out of scope, not exercised by
        // golden parity", which left a documented, settings-selectable mode that
        // could only ever crash. `build_thin` was ported and has been present the
        // whole time — the wiring was the only thing missing.
        //
        // Scope note: this repairs the SWITCH only. The default stays
        // `eager-all`. Flipping it is parked behind the thin-projection honest
        // null (thin win-rate 36.2% < the 48% pre-registered threshold), and
        // nothing here disturbs that verdict — but a mode that throws cannot
        // even be re-measured, which is why the repair earns its place alone.
        thin_files = Object.fromEntries(
            build_thin(MODULE_STATE.RULES_SOURCE, _read_rule_workspaces()),
        );
    }

    const user_home = process.env['HOME'] ?? os.homedir();
    // Read the emit plan from the exported function rather than recomputing the
    // dedup skip here, so the gate that asserts this tree is complete and the
    // code that writes it cannot disagree.
    const plan = projected_rule_trees(user_home);
    const skipped_per_tool: Record<string, Set<string>> = {};

    let total = 0;
    for (const [tool_dir, rel_prefix] of Object.entries(tool_dirs)) {
        const target_dir = path.join(MODULE_STATE.PROJECT_ROOT, tool_dir);
        const emit_here = new Set(plan[tool_dir] ?? rules);
        const skip = new Set(rules.filter((r) => !emit_here.has(r)));
        skipped_per_tool[tool_dir] = skip;
        _mkdirp(target_dir);
        // Clean stale entries — a rule that became de-duplicable this run is
        // stale at project scope too, so it has to go with the rest.
        //
        // Symlink-only was correct while every tool dir was a symlink tree. Two
        // paths now write REAL files (`thin` mode, and the Claude emitter
        // below), and a stale real file is invisible to an `_isSymlink` test —
        // so a renamed or newly de-duplicable rule would leave its body behind,
        // loaded unconditionally, forever.
        //
        // Ownership test for a real file: its basename is an agent-config rule
        // in the projection source. A consumer's own hand-written rule is only
        // touched if it collides with one of ours by name, in which case it was
        // already being overwritten.
        for (const item of _iterdirSorted(target_dir)) {
            const name = path.basename(item);
            if (name === 'README.md') {
                continue;
            }
            const is_ours =
                _isSymlink(item) || _isFile(path.join(MODULE_STATE.RULES_SOURCE, name));
            if (is_ours && (!rules.includes(name) || skip.has(name))) {
                fs.unlinkSync(item);
            }
        }
        for (const rule of rules) {
            if (skip.has(rule)) {
                continue;
            }
            const link = path.join(target_dir, rule);
            if (_existsOrSymlink(link)) {
                fs.unlinkSync(link);
            }
            if (thin_files !== null) {
                _writeText(link, thin_files[rule] as string);
            } else if (tool_dir === '.claude/rules') {
                // Host-native activation (P3.1): emit the rule with the host's
                // own `paths:` key instead of symlinking agent-config
                // frontmatter this host does not read.
                _emit_claude_rule(path.join(MODULE_STATE.RULES_SOURCE, rule), link);
            } else {
                fs.symlinkSync(path.join(rel_prefix, rule), link);
            }
            total += 1;
        }
    }

    const source_count = rules.length;
    for (const tool_dir of Object.keys(tool_dirs)) {
        const target_dir = path.join(MODULE_STATE.PROJECT_ROOT, tool_dir);
        // Count only the RULES this run emitted, not every `.md` in the tree.
        // Some tool trees legitimately receive other artefact classes — the cline
        // tree also carries `*.subagent.md` — and counting those produced a
        // permanent "111 rules (expected 110)" warning that was pure noise. A
        // warning that is always on is a warning nobody reads.
        const emitted = new Set(rules);
        const tool_count = _iterdirSorted(target_dir).filter((f) => emitted.has(path.basename(f))).length;
        // Expect the de-duplicated count, not the source count: a skipped rule is
        // an intended absence, so warning on it would train the reader to ignore
        // this line — which is how a real drift gets missed.
        const skipped = (skipped_per_tool[tool_dir] ?? new Set()).size;
        const expected = source_count - skipped;
        if (tool_count !== expected) {
            _print(`  ⚠️  ${tool_dir}: ${tool_count} rules (expected ${expected})`);
        }
        if (skipped > 0) {
            _print(
                `  ℹ️  ${tool_dir}: ${skipped} rule(s) skipped — byte-identical twin already installed at user scope`,
            );
        }
    }

    info(
        `  ✅  Created ${total} rule symlinks across ${Object.keys(tool_dirs).length} tool directories (${source_count} rules each)`,
    );
    return total;
}

export function generate_windsurfrules(): number {
    // `.windsurfrules` is Windsurf's LEGACY single-file surface, read alongside
    // `.windsurf/rules/`. It is the same host and therefore the same evidence, so
    // it is narrowed through the same per-directory gate — keyed on
    // `.windsurf/rules` because that is the directory whose global counterpart
    // supplies the proof.
    //
    // This line exists because removing the per-run filter regressed it: the file
    // went 13 → 113 rules in one generation, silently concatenating every rule the
    // global layer already delivers into a file the host reads unconditionally. The
    // per-run filter had been covering this surface by accident.
    const rules = partition_rules_for_dir('.windsurf/rules', _scoped_rule_basenames());
    const parts = ['# Auto-generated from dist/agent-src/rules/ — do not edit directly\n'];
    for (const rule of rules) {
        const p = path.join(MODULE_STATE.RULES_SOURCE, rule);
        const content = strip_frontmatter(_readText(p));
        parts.push(`---\n\n${_strip(content)}\n`);
    }
    const output = path.join(MODULE_STATE.PROJECT_ROOT, '.windsurfrules');
    _writeText(output, parts.join('\n') + '\n');
    info(`  ✅  Generated .windsurfrules (${rules.length} rules)`);
    return rules.length;
}

// ── Modern editor formats ────────────────────────────────────────────

function _CURSOR_RULES_MDC_DIR(): string {
    return path.join(MODULE_STATE.PROJECT_ROOT, '.cursor', 'rules');
}
function _WINDSURF_RULES_DIR(): string {
    return path.join(MODULE_STATE.PROJECT_ROOT, '.windsurf', 'rules');
}
function _WINDSURF_WORKFLOWS_DIR(): string {
    return path.join(MODULE_STATE.PROJECT_ROOT, '.windsurf', 'workflows');
}
function _CURSOR_COMMANDS_DIR(): string {
    return path.join(MODULE_STATE.PROJECT_ROOT, '.cursor', 'commands');
}
function _CLAUDE_COMMANDS_DIR(): string {
    return path.join(MODULE_STATE.PROJECT_ROOT, '.claude', 'commands');
}

export function _parse_frontmatter(content: string): [Record<string, unknown>, string] {
    if (!content.startsWith('---')) {
        return [{}, content];
    }
    const end = content.indexOf('\n---', 3);
    if (end === -1) {
        return [{}, content];
    }
    const raw = _strip(content.slice(3, end));
    const body = _lstripNewlines(content.slice(end + 4));
    // Python: `meta = yaml.safe_load(raw) or {}` inside try/except YAMLError.
    let meta: unknown = _yamlParse(raw);
    if (meta === null || meta === undefined) {
        meta = {};
    }
    if (typeof meta === 'object' && meta !== null && !Array.isArray(meta)) {
        return [meta as Record<string, unknown>, body];
    }
    return [{}, body];
}

function _yaml_scalar(value: string): string {
    return JSON.stringify(value);
}


export function _emit_cursor_mdc(source: string, target: string): void {
    const [meta, body] = _parse_frontmatter(_readText(source));
    const description = _strip(String(meta['description'] ?? '').replace(/\n/g, ' '));
    const always_apply = Boolean(meta['alwaysApply'] || meta['type'] === 'always');
    // Path-shaped triggers become Cursor auto-attach globs; rules without
    // them keep `globs: ` empty and stay Agent-Requested via description.
    const globs = always_apply ? [] : derive_trigger_globs(meta);
    const lines = [
        '---',
        `description: ${_yaml_scalar(description)}`,
        `globs: ${globs.join(',')}`,
        `alwaysApply: ${always_apply ? 'true' : 'false'}`,
        '---',
        '',
        _pyRstrip(body) + '\n',
    ];
    _mkdirp(path.dirname(target));
    _writeText(target, lines.join('\n'));
}

export function _emit_windsurf_rule(source: string, target: string): void {
    const [meta, body] = _parse_frontmatter(_readText(source));
    const description = _strip(String(meta['description'] ?? '').replace(/\n/g, ' '));
    const always_apply = Boolean(meta['alwaysApply'] || meta['type'] === 'always');
    // Path-shaped triggers activate host-natively via Windsurf's `glob`
    // trigger; keyword/phrase-only rules keep `model_decision`.
    const globs = always_apply ? [] : derive_trigger_globs(meta);
    const trigger = always_apply ? 'always_on' : globs.length > 0 ? 'glob' : 'model_decision';
    const lines = [
        '---',
        `trigger: ${trigger}`,
        `description: ${_yaml_scalar(description)}`,
        `globs: ${globs.join(',')}`,
        '---',
        '',
        _pyRstrip(body) + '\n',
    ];
    _mkdirp(path.dirname(target));
    _writeText(target, lines.join('\n'));
}




/**
 * Emit a Claude Code rule carrying the host's OWN activation key.
 *
 * Sibling of {@link _emit_cursor_mdc} and {@link _emit_windsurf_rule}, and the
 * third member of a set that had two. `.claude/rules` was a symlink projection
 * of `dist/agent-src/rules`, which carried agent-config's own frontmatter
 * vocabulary (`type`, `tier`, `triggers`, `alwaysApply`, …) into a host that
 * reads **none** of it — so every rule loaded unconditionally and the corpus
 * arrived in full every session.
 *
 * Emitted frontmatter is therefore `paths:` and nothing else: the one key the
 * probed contract records as read by this host. A rule with no path-shaped
 * trigger gets no frontmatter at all rather than a block the host ignores —
 * keys that do nothing are bytes in every session's standing context.
 *
 * The body is copied byte-for-byte from the projection source (ADR-201's
 * copy-plus-rewrite discipline); only the frontmatter is host-shaped.
 */
export function _emit_claude_rule(source: string, target: string): void {
    const [meta, body] = _parse_frontmatter(_readText(source));
    const plan = _claude_paths_plan(meta);
    for (const d of plan.dropped) {
        _print(
            `  ⚠️  ${path.basename(target)}: dropped \`paths:\` pattern ${JSON.stringify(d.pattern)} (${d.reason}) — ` +
                (plan.globs.length > 0
                    ? 'the rule keeps its other patterns'
                    : 'the rule now loads unconditionally'),
        );
    }
    const lines: string[] = [];
    if (plan.globs.length > 0) {
        lines.push('---', 'paths:');
        for (const g of plan.globs) {
            lines.push(`  - ${_yaml_scalar(g)}`);
        }
        lines.push('---', '');
    }
    lines.push(_pyRstrip(body) + '\n');
    _mkdirp(path.dirname(target));
    _writeText(target, lines.join('\n'));
}

/** Python str.rstrip() with no args. */
function _pyRstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

function _clean_modern_dir(target_dir: string, valid_names: ReadonlySet<string>): void {
    if (!_exists(target_dir)) {
        return;
    }
    for (const item of _iterdirSorted(target_dir)) {
        const name = path.basename(item);
        if (name === 'README.md') {
            continue;
        }
        if (!valid_names.has(name)) {
            if (_isDir(item) && !_isSymlink(item)) {
                fs.rmSync(item, { recursive: true, force: true });
            } else {
                fs.unlinkSync(item);
            }
        }
    }
}

export function generate_cursor_mdc_rules(): number {
    const scope = _read_rule_workspaces();
    const pack_scope = _read_rule_packs();
    let rules = _rglobSorted(MODULE_STATE.RULES_SOURCE, '*.md')
        .filter((p) => _isFile(p))
        .filter((p) => rule_in_scope(p, scope, pack_scope))
        // ADR-004 manual rules are reference-only — never auto-injected into a
        // per-tool tree. Same predicate as generate_rule_symlinks.
        .filter((p) => !_is_manual_rule(p));
    // ADR-236 per-host partition. Applied to the BASENAMES and then mapped back,
    // because `partition_rules_for_dir` speaks the same vocabulary as the emit plan
    // and the gate. `_clean_modern_dir` below sweeps whatever is no longer in
    // `valid`, so the narrowing removes the existing duplicates rather than only
    // declining to add more — a filter without a sweep is not a partition.
    const kept = new Set(
        partition_rules_for_dir(
            '.cursor/rules',
            rules.map((r) => path.basename(r)),
        ),
    );
    rules = rules.filter((r) => kept.has(path.basename(r)));
    const stems = rules.map((r) => path.basename(r, '.md'));
    const valid = new Set([
        ...stems.map((s) => `${s}.mdc`),
        ...rules.map((r) => path.basename(r)),
    ]);
    _clean_modern_dir(_CURSOR_RULES_MDC_DIR(), valid);
    for (const rule of rules) {
        _emit_cursor_mdc(rule, path.join(_CURSOR_RULES_MDC_DIR(), `${path.basename(rule, '.md')}.mdc`));
    }
    info(`  ✅  Wrote ${rules.length} \`.cursor/rules/*.mdc\` files`);
    return rules.length;
}

export function generate_windsurf_modern_rules(): number {
    const scope = _read_rule_workspaces();
    const pack_scope = _read_rule_packs();
    let rules = _rglobSorted(MODULE_STATE.RULES_SOURCE, '*.md')
        .filter((p) => _isFile(p))
        .filter((p) => rule_in_scope(p, scope, pack_scope))
        // ADR-004 manual rules are reference-only — never auto-injected into a
        // per-tool tree. Same predicate as generate_rule_symlinks.
        .filter((p) => !_is_manual_rule(p));
    // ADR-236 per-host partition, same shape as the cursor emitter above and for
    // the same reason: `_clean_modern_dir` turns the narrowed set into a removal.
    const kept = new Set(
        partition_rules_for_dir(
            '.windsurf/rules',
            rules.map((r) => path.basename(r)),
        ),
    );
    rules = rules.filter((r) => kept.has(path.basename(r)));
    const valid = new Set(rules.map((r) => path.basename(r)));
    _clean_modern_dir(_WINDSURF_RULES_DIR(), valid);
    for (const rule of rules) {
        _emit_windsurf_rule(rule, path.join(_WINDSURF_RULES_DIR(), path.basename(rule)));
    }
    info(`  ✅  Wrote ${rules.length} \`.windsurf/rules/*.md\` files`);
    return rules.length;
}

export function generate_cursor_commands(active_command_slugs: ReadonlySet<string> | null = null): number {
    if (!_isDir(path.join(MODULE_STATE.PROJECT_ROOT, 'src', 'domains'))) {
        return 0;
    }
    const cmds = [...iterCommands()].filter(
        ([, slug]) => active_command_slugs === null || active_command_slugs.has(slug),
    );
    const valid = new Set(cmds.map(([, slug]) => `${slug}.md`));
    _clean_modern_dir(_CURSOR_COMMANDS_DIR(), valid);
    _mkdirp(_CURSOR_COMMANDS_DIR());
    let count = 0;
    for (const [source_file, slug] of cmds) {
        const link = path.join(_CURSOR_COMMANDS_DIR(), `${slug}.md`);
        if (_existsOrSymlink(link)) {
            fs.unlinkSync(link);
        }
        const rel = path.join('../..', _relativeToPosix(source_file, MODULE_STATE.PROJECT_ROOT));
        fs.symlinkSync(rel, link);
        count += 1;
    }
    info(`  ✅  Linked ${count} \`.cursor/commands/*.md\` files`);
    return count;
}

export function generate_windsurf_workflows(active_command_slugs: ReadonlySet<string> | null = null): number {
    if (!_isDir(path.join(MODULE_STATE.PROJECT_ROOT, 'src', 'domains'))) {
        return 0;
    }
    const cmds = [...iterCommands()].filter(
        ([, slug]) => active_command_slugs === null || active_command_slugs.has(slug),
    );
    const valid = new Set(cmds.map(([, slug]) => `${slug}.md`));
    _clean_modern_dir(_WINDSURF_WORKFLOWS_DIR(), valid);
    _mkdirp(_WINDSURF_WORKFLOWS_DIR());
    let count = 0;
    for (const [source_file, slug] of cmds) {
        const link = path.join(_WINDSURF_WORKFLOWS_DIR(), `${slug}.md`);
        if (_existsOrSymlink(link)) {
            fs.unlinkSync(link);
        }
        const rel = path.join('../..', _relativeToPosix(source_file, MODULE_STATE.PROJECT_ROOT));
        fs.symlinkSync(rel, link);
        count += 1;
    }
    info(`  ✅  Linked ${count} \`.windsurf/workflows/*.md\` files`);
    return count;
}

export function generate_gemini_md(): void {
    const link = path.join(MODULE_STATE.PROJECT_ROOT, 'GEMINI.md');
    if (_existsOrSymlink(link)) {
        fs.unlinkSync(link);
    }
    fs.symlinkSync('AGENTS.md', link);
    info('  ✅  Created GEMINI.md → AGENTS.md symlink');
}

function _command_slug(source_file: string): string {
    const rel = _relativeToPosix(source_file, MODULE_STATE.COMMANDS_SOURCE);
    return _posixParts(rel.replace(/\.md$/, '')).join('-');
}
void _command_slug; // mirrors the Python helper; not on the hot path here

/**
 * Yield [source_file, slug] for every command, sourced from src/domains/.
 * Mirrors condense._iter_commands (ADR-044 amendment).
 */
function* iterCommands(): Generator<[string, string]> {
    const src_domains = path.join(MODULE_STATE.PROJECT_ROOT, 'src', 'domains');
    if (!_isDir(src_domains)) {
        return;
    }
    for (const source_file of _rglobSorted(src_domains, 'command.md')) {
        if (!_isFile(source_file)) {
            continue;
        }
        const rel = _relativeToPosix(source_file, MODULE_STATE.PROJECT_ROOT);
        let slug = _command_path_to_slug(rel);
        if (!slug) {
            continue;
        }
        const pack_id = _relativeToPosix(source_file, src_domains).split('/')[0] as string;
        const prefix = _domains_slug_prefix(pack_id);
        if (prefix && slug !== prefix && !slug.startsWith(prefix + '-')) {
            slug = `${prefix}-${slug}`;
        }
        yield [source_file, slug];
    }
}

function _read_model_auto_switch(): string {
    const data = load_agent_settings({ project_path: MODULE_STATE.SETTINGS_FILE });
    const model = data['model'];
    const value =
        typeof model === 'object' && model !== null && !Array.isArray(model)
            ? (model as Record<string, unknown>)['auto_switch']
            : null;
    if (typeof value === 'string' && ['auto', 'suggest', 'off'].includes(value.trim().toLowerCase())) {
        return value.trim().toLowerCase();
    }
    return 'suggest';
}

function _read_projection_mode(): string {
    const data = load_agent_settings({ project_path: MODULE_STATE.SETTINGS_FILE });
    const proj = data['projection'];
    const value =
        typeof proj === 'object' && proj !== null && !Array.isArray(proj)
            ? (proj as Record<string, unknown>)['mode']
            : null;
    if (typeof value === 'string' && ['legacy-all', 'scoped'].includes(value.trim().toLowerCase())) {
        return value.trim().toLowerCase();
    }
    return 'legacy-all';
}

function _domains_slug_prefix(pack_id: string): string {
    const manifest = path.join(MODULE_STATE.PROJECT_ROOT, 'src', 'domains', pack_id, 'pack.yaml');
    if (!_isFile(manifest)) {
        return '';
    }
    const m = _SLUG_PREFIX_RE.exec(_readText(manifest));
    return m ? (m[1] as string) : '';
}

function _command_path_to_slug(manifest_path: string): string {
    const logical = strip_source_prefix(manifest_path);
    if (logical && logical.startsWith('commands/')) {
        return _posixParts(logical.slice('commands/'.length).replace(/\.md$/, '')).join('-');
    }
    const parts = manifest_path.split(path.sep).filter((s) => s.length > 0);
    const i = parts.indexOf('commands');
    return parts
        .slice(i + 1)
        .join('/')
        .replace(/\.md$/, '')
        .split('/')
        .join('-');
}

function _skill_path_to_name(manifest_path: string): string {
    const parts = manifest_path.split(path.sep).filter((s) => s.length > 0);
    const i = parts.indexOf('skills');
    return parts[i + 1] as string;
}
void _skill_path_to_name;

function _resolve_active_predicates(): [ReadonlySet<string> | null, ReadonlySet<string> | null] {
    if (_read_projection_mode() !== 'scoped') {
        return [null, null];
    }
    // The `config` package twins (packs / session_profiles / profiles) are not
    // ported (out of scope — scoped mode is opt-in and not exercised by golden
    // parity). Throw a clear error if a consumer enables it, mirroring an
    // unmet import.
    throw new Error('projection.mode=scoped requires the config package (not ported in condense.ts)');
}

function _model_tier(skill_md: string): string | null {
    if (!_exists(skill_md)) {
        return null;
    }
    const text = fs.readFileSync(skill_md).toString('utf-8');
    if (!text.startsWith('---\n')) {
        return null;
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return null;
    }
    const m = _MODEL_TIER_RE.exec(text.slice(4, end));
    return m ? (m[1] as string) : null;
}

function _render_native_model_md(src_md: string, tier: string): string {
    const text = _readText(src_md);
    const model = _TIER_TO_CLAUDE_MODEL[tier] as string;
    return text.replace(_MODEL_TIER_RE, `model: ${model}`);
}

export function generate_claude_skills(active_skill_names: ReadonlySet<string> | null = null): number {
    if (partitionActive(MODULE_STATE.PROJECT_ROOT)) active_skill_names = new Set<string>();
    if (!_exists(MODULE_STATE.SKILLS_SOURCE)) {
        process.stderr.write('  ⚠️  dist/agent-src/skills/ not found — skipping skills\n');
        return 0;
    }

    let skills = _iterdirSorted(MODULE_STATE.SKILLS_SOURCE)
        .filter((p) => _isDir(p))
        .map((p) => path.basename(p))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (active_skill_names !== null) {
        skills = skills.filter((s) => active_skill_names.has(s));
    }
    const skill_set = new Set(skills);
    const command_slugs = partitionActive(MODULE_STATE.PROJECT_ROOT)
        ? new Set<string>()
        : new Set([...iterCommands()].map(([, slug]) => slug));

    _mkdirp(MODULE_STATE.CLAUDE_SKILLS_DIR);
    const auto = _read_model_auto_switch() === 'auto';

    for (const item of _iterdirSorted(MODULE_STATE.CLAUDE_SKILLS_DIR)) {
        const name = path.basename(item);
        if (skill_set.has(name) || command_slugs.has(name) || name === 'README.md') {
            continue;
        }
        if (_isSymlink(item)) {
            fs.unlinkSync(item);
        } else if (_isDirNoFollow(item)) {
            const skill_md = path.join(item, 'SKILL.md');
            if (_isFile(skill_md) && !_isSymlink(skill_md)) {
                fs.rmSync(item, { recursive: true, force: true });
            }
        }
    }

    let count = 0;
    let rendered = 0;
    for (const skill of skills) {
        const link = path.join(MODULE_STATE.CLAUDE_SKILLS_DIR, skill);
        const src_dir = path.join(MODULE_STATE.SKILLS_SOURCE, skill);
        const value = auto ? _model_tier(path.join(src_dir, 'SKILL.md')) : null;
        if (_isSymlink(link)) {
            fs.unlinkSync(link);
        } else if (_isDirNoFollow(link)) {
            fs.rmSync(link, { recursive: true, force: true });
        } else if (_existsOrSymlink(link)) {
            fs.unlinkSync(link);
        }
        if (value !== null && value in _TIER_TO_CLAUDE_MODEL) {
            _mkdirp(link);
            for (const entry of _iterdirSorted(src_dir)) {
                const entryName = path.basename(entry);
                if (entryName === 'SKILL.md') {
                    _writeText(
                        path.join(link, 'SKILL.md'),
                        _render_native_model_md(entry, value),
                    );
                } else {
                    fs.symlinkSync(
                        path.join('../../../dist/agent-src/skills', skill, entryName),
                        path.join(link, entryName),
                    );
                }
            }
            rendered += 1;
        } else {
            fs.symlinkSync(path.join('../../dist/agent-src/skills', skill), link);
        }
        count += 1;
    }

    const suffix = rendered ? ` (${rendered} rendered with native model:)` : '';
    info(`  ✅  Created ${count} skill entries in .claude/skills/${suffix}`);
    return count;
}

export function extract_description_from_md(content: string): string {
    for (const raw of _strip(content).split('\n')) {
        const line = _strip(raw);
        if (line.startsWith('# ')) {
            return _strip(line.slice(2));
        }
        if (line && !line.startsWith('#')) {
            return line.slice(0, 120);
        }
    }
    return '';
}

/**
 * The `commands/<sub>` path of a command source file, or `null` when it is a
 * FLAT command (`commands/<name>.md`).
 *
 * A nested path is what Claude Code renders as `/cluster:sub`. Flat command
 * FILES are not registered by Claude Code (probed ≤ 2.1.204 — see the
 * flat-command mitigation in `install.ts`), which is why flat commands keep a
 * skill wrapper and nested ones do not need one.
 */
function _nested_command_subpath(source_file: string): string | null {
    const rel = _relativeToPosix(source_file, MODULE_STATE.PROJECT_ROOT);
    const logical = _domains_command_logical(rel);
    if (logical === null || !logical.startsWith('commands/')) {
        return null;
    }
    const sub = logical.slice('commands/'.length).replace(/\.md$/, '');
    return sub.includes('/') ? sub : null;
}

/**
 * Project-scope `.claude/commands/<cluster>/<sub>.md` — the colon form.
 *
 * Before this, the package repo's own `.claude/` carried NO commands directory:
 * every command reached Claude Code as a hyphen-named skill wrapper in
 * `.claude/skills/`, while the colon form existed only in the user-global tree
 * written by `install.ts`. Every clustered command was therefore listed TWICE
 * for anyone with a global install (`roadmap-process-full` AND
 * `roadmap:process-full`), costing 4,214 GPT tok of catalog — measured 2026-08-02.
 *
 * Emitting the nested form here lets `generate_claude_commands` stop wrapping
 * the clustered commands: one listing, same reachability, and reachability no
 * longer depends on a global deploy. Dedup AND precedence: `commandsWithheld`.
 *
 * ADR-003 (colon canonical for clusters) and ADR-044 (flat commands stay
 * hyphenated) both hold: flat commands are untouched and keep their wrapper.
 */
export function generate_claude_project_commands(
    active_command_slugs: ReadonlySet<string> | null = null,
): number {
    if (commandsWithheld(MODULE_STATE.PROJECT_ROOT)) active_command_slugs = new Set<string>();
    // Returns before the stale sweep — invariant, see `commandsWithheld`.
    if (!_isDir(path.join(MODULE_STATE.PROJECT_ROOT, 'src', 'domains'))) {
        return 0;
    }
    const nested: Array<[string, string]> = [];
    for (const [source_file, slug] of iterCommands()) {
        if (active_command_slugs !== null && !active_command_slugs.has(slug)) {
            continue;
        }
        const sub = _nested_command_subpath(source_file);
        if (sub !== null) {
            nested.push([source_file, sub]);
        }
    }

    const target_root = _CLAUDE_COMMANDS_DIR();
    const valid = new Set(nested.map(([, sub]) => `${sub}.md`));
    // Sweep stale links first — a renamed, deleted or WITHHELD command must not linger.
    if (_exists(target_root)) {
        for (const item of _rglobSorted(target_root, '*.md')) {
            const rel = _relativeToPosix(item, target_root);
            if (!valid.has(rel)) {
                fs.unlinkSync(item);
            }
        }
        pruneEmptyDirs(target_root); // else the gate counts 40 empty cluster dirs as 40 commands
    }

    let count = 0;
    for (const [source_file, sub] of nested) {
        const link = path.join(target_root, `${sub}.md`);
        _mkdirp(path.dirname(link));
        if (_existsOrSymlink(link)) {
            fs.unlinkSync(link);
        }
        // path.relative, not a hand-counted `../` run: the nesting depth
        // varies (2 and 3 segments both occur) and an off-by-one here writes
        // a dangling link that still LOOKS right in `ls -l`.
        const rel_target = path.relative(path.dirname(link), source_file);
        fs.symlinkSync(rel_target, link);
        count += 1;
    }
    info(`  ✅  Linked ${count} \`.claude/commands/**/*.md\` files (colon form)`);
    return count;
}

export function generate_claude_commands(active_command_slugs: ReadonlySet<string> | null = null): number {
    if (partitionActive(MODULE_STATE.PROJECT_ROOT)) active_command_slugs = new Set<string>();
    if (!_isDir(path.join(MODULE_STATE.PROJECT_ROOT, 'src', 'domains'))) {
        process.stderr.write('  ⚠️  src/domains/ not found — skipping commands\n');
        return 0;
    }

    _mkdirp(MODULE_STATE.CLAUDE_SKILLS_DIR);

    let skill_names = new Set<string>();
    if (_exists(MODULE_STATE.SKILLS_SOURCE)) {
        skill_names = new Set(
            _iterdirSorted(MODULE_STATE.SKILLS_SOURCE)
                .filter((p) => _isDir(p))
                .map((p) => path.basename(p)),
        );
    }

    const current_slugs = new Set<string>();
    let count = 0;
    let skipped = 0;
    let reserved = 0;
    let rendered = 0;
    const auto = _read_model_auto_switch() === 'auto';
    for (const [source_file, slug] of iterCommands()) {
        if (active_command_slugs !== null && !active_command_slugs.has(slug)) {
            continue;
        }
        if (skill_names.has(slug)) {
            skipped += 1;
            continue;
        }
        // A clustered command already reaches Claude Code as `/cluster:sub`
        // from `.claude/commands/` (generate_claude_project_commands). A
        // hyphen wrapper on top would be a second listing of the same command
        // — the double-listing this de-duplicates. Flat commands still need
        // the wrapper: Claude Code does not register flat command FILES.
        if (_nested_command_subpath(source_file) !== null) {
            skipped += 1;
            continue;
        }
        // Never claim a `/name` that is a Claude Code built-in command or
        // bundled skill — a same-name entry shadows the built-in (e.g. a
        // `review` entry hides Claude Code's own /review). Nested
        // `/cluster:sub` slugs are hyphen-joined and cannot collide.
        // See src/scripts/_lib/claude_builtin_names.ts.
        if (is_claude_builtin_name(slug)) {
            reserved += 1;
            continue;
        }
        current_slugs.add(slug);

        const skill_dir = path.join(MODULE_STATE.CLAUDE_SKILLS_DIR, slug);
        _mkdirp(skill_dir);

        const skill_file = path.join(skill_dir, 'SKILL.md');
        if (_existsOrSymlink(skill_file)) {
            fs.unlinkSync(skill_file);
        }

        const rel_path = _relativeToPosix(source_file, MODULE_STATE.PROJECT_ROOT);
        const value = auto ? _model_tier(source_file) : null;
        if (value !== null && value in _TIER_TO_CLAUDE_MODEL) {
            _writeText(skill_file, _render_native_model_md(source_file, value));
            rendered += 1;
        } else {
            const rel_target = path.join('../../..', rel_path);
            fs.symlinkSync(rel_target, skill_file);
        }
        count += 1;
    }

    let removed_dirs = 0;
    for (const item of _iterdirSorted(MODULE_STATE.CLAUDE_SKILLS_DIR)) {
        if (!_isDirNoFollow(item) || _isSymlink(item)) {
            continue;
        }
        const name = path.basename(item);
        if (skill_names.has(name) || current_slugs.has(name)) {
            continue;
        }
        const skill_md = path.join(item, 'SKILL.md');
        if (_isSymlink(skill_md) || _isFile(skill_md)) {
            const entries = _iterdirSorted(item);
            if (entries.length === 1 && path.basename(entries[0] as string) === 'SKILL.md') {
                fs.unlinkSync(skill_md);
                fs.rmdirSync(item);
                removed_dirs += 1;
            }
        }
    }

    let msg = `  ✅  Created ${count} command entries in .claude/skills/`;
    if (rendered) {
        msg += ` (${rendered} rendered with native model:)`;
    }
    if (skipped) {
        msg += ` (${skipped} skipped — same-name skill exists)`;
    }
    if (reserved) {
        msg += ` (${reserved} withheld — Claude Code built-in name)`;
    }
    if (removed_dirs) {
        msg += ` (${removed_dirs} stale dirs removed)`;
    }
    info(msg);
    return count;
}

/**
 * Project `src/subagents/*.md` (subagent-v1, ADR-109) → `.claude/agents/*.md`
 * in Claude Code's native subagent format.
 *
 * The source frontmatter carries governance metadata (schema_version, trust,
 * lifecycle, discovery, source) that Claude Code does not understand; the native
 * `.claude/agents/` format wants only `{name, description, tools, model}` + the
 * system-prompt body. This is a **frontmatter transform**, not a symlink:
 *
 *  - `model_tier` → native `model:` via `_TIER_TO_CLAUDE_MODEL` (ADR-034/035);
 *    the `inherit` sentinel passes through to `model: inherit`.
 *  - `tools` (a YAML list) → the comma-joined form Claude Code accepts.
 *  - the body (everything after the closing `---`) is copied verbatim.
 *
 * Static projection only — Claude Code (or the user via `@<name>`) decides
 * dispatch; nothing here runs an agent. Reads from `src/` directly (subagent
 * prompts are not telegraph-condensed). Reaps stale generated `.claude/agents/`
 * files whose source no longer exists.
 */
export function generate_claude_subagents(): number {
    if (!_isDir(MODULE_STATE.SUBAGENTS_SOURCE)) {
        return 0;
    }
    _mkdirp(MODULE_STATE.CLAUDE_AGENTS_DIR);

    const sources = _rglobSorted(MODULE_STATE.SUBAGENTS_SOURCE, '*.md').filter(
        (p) => _isFile(p) && !path.basename(p).startsWith('_'),
    );
    const current = new Set<string>();
    let count = 0;

    // Prompt-defense preamble partial (road-to-opt-subagent-harvest P1.1):
    // `_`-prefixed files in src/subagents/ are partials, never agents. The
    // preamble is injected at the top of every projected body so the whole
    // fleet carries a uniform injection-defense baseline — each dispatched
    // subagent is an untrusted-content ingestion point.
    const defensePath = path.join(MODULE_STATE.SUBAGENTS_SOURCE, '_prompt-defense.md');
    const defense = _isFile(defensePath) ? _readText(defensePath).trim() : '';

    for (const src of sources) {
        const stem = path.basename(src, '.md');
        const text = _readText(src);
        if (!text.startsWith('---\n')) {
            continue;
        }
        const end = text.indexOf('\n---\n', 4);
        if (end === -1) {
            continue;
        }
        const fmBlock = text.slice(4, end);
        const body = text.slice(end + 5);
        const fm = _yamlParse(fmBlock) as Record<string, unknown> | null;
        if (fm === null) {
            continue;
        }
        const name = typeof fm['name'] === 'string' ? (fm['name'] as string) : stem;
        const description = typeof fm['description'] === 'string' ? (fm['description'] as string) : '';
        const toolsRaw = fm['tools'];
        const tools = Array.isArray(toolsRaw) ? toolsRaw.map((t) => String(t)).join(', ') : String(toolsRaw ?? '');
        const tier = typeof fm['model_tier'] === 'string' ? (fm['model_tier'] as string) : 'inherit';
        const model = tier === 'inherit' ? 'inherit' : (_TIER_TO_CLAUDE_MODEL[tier] ?? 'inherit');
        // Optional pinned reasoning effort (skill-quality-gates Phase 4, Source S):
        // pass through to the native frontmatter only when the source declares it —
        // hosts without an effort knob never see the key.
        const effort = typeof fm['effort'] === 'string' ? (fm['effort'] as string) : null;

        const guardedBody =
            defense !== '' && !body.includes('prompt-defense-preamble')
                ? `\n${defense}\n${body}`
                : body;
        const out =
            '---\n' +
            `name: ${name}\n` +
            `description: ${description}\n` +
            `tools: ${tools}\n` +
            `model: ${model}\n` +
            (effort !== null ? `effort: ${effort}\n` : '') +
            '---\n' +
            guardedBody;

        const target = path.join(MODULE_STATE.CLAUDE_AGENTS_DIR, `${name}.md`);
        _writeText(target, out);
        current.add(`${name}.md`);
        count += 1;
    }

    // Reap stale generated agent files (source removed). Only touch plain .md
    // files we would have generated; never follow into unrelated content.
    for (const item of _iterdirSorted(MODULE_STATE.CLAUDE_AGENTS_DIR)) {
        const base = path.basename(item);
        if (base === 'README.md' || current.has(base)) {
            continue;
        }
        if (_isFile(item) && base.endsWith('.md') && !_isSymlink(item)) {
            fs.unlinkSync(item);
        }
    }

    info(`  ✅  Created ${count} subagent entries in .claude/agents/`);
    return count;
}

/**
 * Cross-host degradation for subagent-v1 (ADR-109 §4).
 *
 * Only Claude Code has native subagents (`generate_claude_subagents`). On the
 * other rules-surface hosts a subagent projects to a **loadable context file** —
 * a *passive reference*, honestly labelled: there is NO host-native `@`-dispatch
 * (faking it would need a runtime the package refuses to add). Council
 * (claude-sonnet-4-5 + gpt-4o, 2026-07-05) converged here over honest-null: the
 * body is 95% reusable review discipline, 5% dispatch syntax, so an advanced user
 * on Cursor / Windsurf / Cline loads it on intent and applies the discipline
 * manually. This is **governance parity, not feature parity** — trust / lifecycle
 * / model_tier stay legible; automation does not.
 *
 * Placement is reaper-safe by construction:
 *  - Cursor / Windsurf → a dedicated `subagents/` subdir with its own reaper,
 *    so it never collides with the aggressive `_clean_modern_dir` rule reapers.
 *  - Cline → a flat real `<name>.subagent.md` in `.clinerules/` (whose reaper
 *    only unlinks *symlinks*, so a real file survives).
 *
 * Copilot / Gemini are skipped (no per-file context surface), per ADR-109 §4.
 * Reads from `src/` directly (subagent prompts are not telegraph-condensed).
 */
export function generate_subagent_host_contexts(): number {
    if (!_isDir(MODULE_STATE.SUBAGENTS_SOURCE)) {
        return 0;
    }
    const sources = _rglobSorted(MODULE_STATE.SUBAGENTS_SOURCE, '*.md').filter((p) => _isFile(p));

    // Build the passive-reference body once per subagent, keyed by projected name.
    const rendered: Array<{ name: string; text: string }> = [];
    for (const src of sources) {
        const stem = path.basename(src, '.md');
        const text = _readText(src);
        if (!text.startsWith('---\n')) {
            continue;
        }
        const end = text.indexOf('\n---\n', 4);
        if (end === -1) {
            continue;
        }
        const fm = _yamlParse(text.slice(4, end)) as Record<string, unknown> | null;
        if (fm === null) {
            continue;
        }
        const body = text.slice(end + 5);
        const name = typeof fm['name'] === 'string' ? (fm['name'] as string) : stem;
        const description = typeof fm['description'] === 'string' ? (fm['description'] as string) : '';
        // `trust` is either a flat string or the subagent-v1 nested object
        // {level, confidence, human_review_required}; surface the level either way.
        const trustRaw = fm['trust'];
        const trust =
            typeof trustRaw === 'string'
                ? trustRaw
                : typeof trustRaw === 'object' && trustRaw !== null && typeof (trustRaw as Record<string, unknown>)['level'] === 'string'
                  ? ((trustRaw as Record<string, unknown>)['level'] as string)
                  : 'unknown';
        const lifecycle = typeof fm['lifecycle'] === 'string' ? (fm['lifecycle'] as string) : 'unknown';
        const tier = typeof fm['model_tier'] === 'string' ? (fm['model_tier'] as string) : 'inherit';
        const toolsRaw = fm['tools'];
        const tools = Array.isArray(toolsRaw)
            ? toolsRaw.map((t) => String(t)).join(', ')
            : String(toolsRaw ?? '');
        const out =
            '---\n' +
            `description: ${description}\n` +
            '---\n\n' +
            `# Subagent (passive reference): ${name}\n\n` +
            '> Passive subagent reference. This host has **no native subagent dispatch** —\n' +
            `> there is no \`@${name}\` here. Load this discipline manually and apply it.\n` +
            '> Governance parity (trust / lifecycle / model tier) is preserved below;\n' +
            '> feature parity is not (ADR-109 §4).\n\n' +
            `- trust: ${trust}\n` +
            `- lifecycle: ${lifecycle}\n` +
            `- model tier: ${tier}\n` +
            (tools ? `- tools: ${tools}\n` : '') +
            '\n' +
            _pyRstrip(body) +
            '\n';
        rendered.push({ name, text: out });
    }

    // Host targets: [dir, filename(name)->basename, reaper-predicate].
    const targets: Array<{ active: boolean; dir: string; file: (n: string) => string; owns: (b: string) => boolean }> = [
        {
            active: _tool_active('cursor'),
            dir: path.join(MODULE_STATE.PROJECT_ROOT, '.cursor', 'subagents'),
            file: (n) => `${n}.md`,
            owns: (b) => b.endsWith('.md'),
        },
        {
            active: _tool_active('windsurf'),
            dir: path.join(MODULE_STATE.PROJECT_ROOT, '.windsurf', 'subagents'),
            file: (n) => `${n}.md`,
            owns: (b) => b.endsWith('.md'),
        },
        {
            active: _tool_active('cline'),
            dir: path.join(MODULE_STATE.PROJECT_ROOT, '.clinerules'),
            file: (n) => `${n}.subagent.md`,
            owns: (b) => b.endsWith('.subagent.md'),
        },
    ];

    let count = 0;
    for (const t of targets) {
        if (!t.active) {
            continue;
        }
        const current = new Set(rendered.map((r) => t.file(r.name)));
        _mkdirp(t.dir);
        for (const r of rendered) {
            _writeText(path.join(t.dir, t.file(r.name)), r.text);
            count += 1;
        }
        // Reap stale generated files we own whose source is gone. Never touch
        // symlinks (cline's rule symlinks) or a README.
        if (_exists(t.dir)) {
            for (const item of _iterdirSorted(t.dir)) {
                const base = path.basename(item);
                if (base === 'README.md' || current.has(base)) {
                    continue;
                }
                if (_isFile(item) && !_isSymlink(item) && t.owns(base)) {
                    fs.unlinkSync(item);
                }
            }
        }
    }
    info(`  ✅  Projected ${count} passive subagent context file(s) to non-Claude-Code hosts`);
    return count;
}

// Bootstrap shim (road-to-install-path-convergence): the Claude Code plugin
// ships ZERO content skills. It carries only hooks/hooks.json (byte-identical
// to the managed settings block, so Claude Code dedupes) plus this single
// pointer skill whose description names the canonical install command.
export const PLUGIN_POINTER_SLUG = 'install-agent-config';
export const PLUGIN_POINTER_SKILL_BODY = `---
name: install-agent-config
description: >-
  Install or upgrade the event4u agent-config suite. This marketplace plugin
  is a bootstrap shim — it ships hooks plus this pointer only; ALL skills,
  rules, and commands are installed via \`npx -y @event4u/agent-config init\`.
  Use when the user asks to install, set up, or upgrade agent-config, or
  wonders why this plugin contains no other skills.
---

# Install agent-config

This plugin is a **bootstrap shim**. It exists so the marketplace listing
stays discoverable and existing plugin installs keep working hooks — the
content surface (skills, rules, commands, personas) is distributed as a
file projection, not through this plugin.

## Install (canonical, one command)

\`\`\`bash
npx -y @event4u/agent-config init
\`\`\`

The installer writes the full content projection, registers the dispatcher
hooks as a managed block in \`~/.claude/settings.json\` (byte-identical to
this plugin's hooks, so nothing double-fires), and keeps everything
upgradeable via \`agent-config upgrade\`.

## Already installed both?

Run \`agent-config doctor\` to check for duplicate surfaces, and
\`agent-config converge\` to clean up consented duplicates.
`;

export function generate_plugin_command_skills(): number {
    if (!_isDir(path.join(MODULE_STATE.PROJECT_ROOT, 'src', 'domains'))) {
        return 0;
    }
    _mkdirp(MODULE_STATE.PLUGIN_SKILLS_DIR);

    // 1. Materialize the pointer skill (idempotent overwrite-on-drift).
    const pointer_dir = path.join(MODULE_STATE.PLUGIN_SKILLS_DIR, PLUGIN_POINTER_SLUG);
    _mkdirp(pointer_dir);
    const pointer_file = path.join(pointer_dir, 'SKILL.md');
    if (_isSymlink(pointer_file)) {
        fs.unlinkSync(pointer_file);
    }
    if (!_isFile(pointer_file) || fs.readFileSync(pointer_file, 'utf-8') !== PLUGIN_POINTER_SKILL_BODY) {
        fs.writeFileSync(pointer_file, PLUGIN_POINTER_SKILL_BODY);
    }

    // 2. Prune every other skill dir so the tree converges to shim shape
    //    from any prior state. Removable = every entry is a symlink (the
    //    generated projection shape — SKILL.md and optional evals links into
    //    src/), or the dir holds only a single SKILL.md file (the old sweep's
    //    rule). Dirs with real extra files are never touched.
    let removed_dirs = 0;
    for (const item of _iterdirSorted(MODULE_STATE.PLUGIN_SKILLS_DIR)) {
        if (!_isDirNoFollow(item) || _isSymlink(item)) {
            continue;
        }
        if (path.basename(item) === PLUGIN_POINTER_SLUG) {
            continue;
        }
        const entries = _iterdirSorted(item);
        const all_symlinks = entries.length > 0 && entries.every((e) => _isSymlink(e));
        const single_skill_md =
            entries.length === 1 &&
            path.basename(entries[0] as string) === 'SKILL.md' &&
            _isFile(entries[0] as string);
        if (all_symlinks || single_skill_md) {
            for (const e of entries) {
                fs.unlinkSync(e);
            }
            fs.rmdirSync(item);
            removed_dirs += 1;
        }
    }

    let msg = '  ✅  Plugin skills: bootstrap shim (1 pointer skill) in .claude-plugin/skills/';
    if (removed_dirs) {
        msg += ` (${removed_dirs} content entries pruned)`;
    }
    info(msg);
    return 1;
}

export function generate_persona_symlinks(): number {
    if (!_exists(MODULE_STATE.PERSONAS_SOURCE)) {
        _print('  ⚠️  dist/agent-src/personas/ not found — skipping personas');
        return 0;
    }
    const personas = _rglobSorted(MODULE_STATE.PERSONAS_SOURCE, '*.md')
        .filter((p) => _isFile(p) && path.basename(p, '.md') !== 'README')
        .map((p) => path.basename(p))
        // glob('*.md') is non-recursive in Python; mirror that — only top level.
        .filter((name) => _isFile(path.join(MODULE_STATE.PERSONAS_SOURCE, name)));
    // Python uses PERSONAS_SOURCE.glob("*.md") (non-recursive). Re-derive
    // from a direct listing to match exactly.
    const direct = _iterdirSorted(MODULE_STATE.PERSONAS_SOURCE)
        .filter((p) => p.endsWith('.md') && _isFile(p) && path.basename(p, '.md') !== 'README')
        .map((p) => path.basename(p))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    void personas;
    const partition = personaPartition(MODULE_STATE.PROJECT_ROOT, direct);
    const tool_dirs = _filter_tool_dirs(PERSONA_TOOL_DIRS);
    let total = 0;
    for (const [tool_dir, rel_prefix] of Object.entries(tool_dirs)) {
        const target_dir = path.join(MODULE_STATE.PROJECT_ROOT, tool_dir);
        _mkdirp(target_dir);
        for (const item of _iterdirSorted(target_dir)) {
            const name = path.basename(item);
            if (_isSymlink(item) && !partition.listFor(tool_dir).includes(name) && name !== 'README.md') {
                fs.unlinkSync(item);
            }
        }
        for (const persona of partition.listFor(tool_dir)) {
            const link = path.join(target_dir, persona);
            const target = path.join(rel_prefix, persona);
            if (_existsOrSymlink(link)) {
                fs.unlinkSync(link);
            }
            fs.symlinkSync(target, link);
            total += 1;
        }
    }
    const per_dir = Object.keys(tool_dirs).map((d) => `${d}=${partition.countFor(d)}`);
    info(`  ✅  Created ${total} persona symlinks — ${per_dir.join(' · ')}${partition.note}`);
    return total;
}

export function generate_user_type_symlinks(): number {
    if (!_exists(MODULE_STATE.USER_TYPES_SOURCE)) {
        _print('  ⚠️  dist/agent-src/user-types/ not found — skipping user-types');
        return 0;
    }
    const user_types = _iterdirSorted(MODULE_STATE.USER_TYPES_SOURCE)
        .filter((p) => p.endsWith('.md') && _isFile(p) && path.basename(p, '.md') !== 'README')
        .map((p) => path.basename(p))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const tool_dirs = _filter_tool_dirs(USER_TYPE_TOOL_DIRS);
    let total = 0;
    for (const [tool_dir, rel_prefix] of Object.entries(tool_dirs)) {
        const target_dir = path.join(MODULE_STATE.PROJECT_ROOT, tool_dir);
        _mkdirp(target_dir);
        for (const item of _iterdirSorted(target_dir)) {
            const name = path.basename(item);
            if (_isSymlink(item) && !user_types.includes(name) && name !== 'README.md') {
                fs.unlinkSync(item);
            }
        }
        for (const user_type of user_types) {
            const link = path.join(target_dir, user_type);
            const target = path.join(rel_prefix, user_type);
            if (_existsOrSymlink(link)) {
                fs.unlinkSync(link);
            }
            fs.symlinkSync(target, link);
            total += 1;
        }
    }
    info(
        `  ✅  Created ${total} user-type symlinks across ${Object.keys(tool_dirs).length} tool directories (${user_types.length} user-types each)`,
    );
    return total;
}

export function generate_plugin_hooks(): number {
    const manifest_path = path.join(
        MODULE_STATE.PROJECT_ROOT,
        'src',
        'scripts',
        'hook_manifest.yaml',
    );
    if (!_exists(manifest_path)) {
        process.stderr.write('  ⚠️  scripts/hook_manifest.yaml not found — skipping plugin hooks\n');
        return 0;
    }

    // Single source of truth: the SAME matrix derivation the installer uses
    // for the managed settings.json block (road-to-claude-code-single-surface
    // Phase 4) — plugin hooks.json and settings hooks cannot drift by
    // construction. Backstop: tests/install/claude_hook_matrix_parity.test.ts.
    const matrix = build_claude_hook_matrix(manifest_path);
    const hooks: Record<string, unknown[]> = {};
    for (const [native, command] of Object.entries(matrix)) {
        hooks[native] = [{ hooks: [{ type: 'command', command }] }];
    }

    const hooks_dir = path.join(MODULE_STATE.PROJECT_ROOT, 'hooks');
    _mkdirp(hooks_dir);
    const out = path.join(hooks_dir, 'hooks.json');
    _writeText(out, _jsonDumpsHooks({ hooks }) + '\n');
    info(`  ✅  Generated hooks/hooks.json (${Object.keys(hooks).length} Claude plugin hooks)`);
    return Object.keys(hooks).length;
}

/** Mirror json.dumps(obj, indent=2) for the hooks payload (insertion order). */
function _jsonDumpsHooks(obj: unknown): string {
    return _pyJson(obj, 0);
}

/**
 * json.dumps(indent=2) equivalent preserving insertion order, no sort_keys,
 * ensure_ascii=False is fine here (ASCII content). Matches CPython spacing:
 * `": "` after keys, `,` newline-separated.
 */
function _pyJson(value: unknown, indent: number): string {
    const pad = '  '.repeat(indent);
    const padInner = '  '.repeat(indent + 1);
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => padInner + _pyJson(v, indent + 1));
        return `[\n${items.join(',\n')}\n${pad}]`;
    }
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0) {
            return '{}';
        }
        const items = entries.map(([k, v]) => `${padInner}${JSON.stringify(k)}: ${_pyJson(v, indent + 1)}`);
        return `{\n${items.join(',\n')}\n${pad}}`;
    }
    return JSON.stringify(value);
}

function _generate_tools_inner(
    cmd_slugs: ReadonlySet<string> | null,
    skill_names: ReadonlySet<string> | null,
): void {
    info('🔧  Generating multi-agent tool directories...\n');
    const rules = generate_rule_symlinks();
    const windsurfrules = _tool_active('windsurf') ? generate_windsurfrules() : 0;
    if (_tool_active('gemini')) {
        generate_gemini_md();
    }
    const skills = _tool_active('claude-code') ? generate_claude_skills(skill_names) : 0;
    // Colon form first: `generate_claude_commands` skips every command this
    // one emitted, so the ordering is what keeps the two from double-listing.
    const claude_cmds = _tool_active('claude-code')
        ? generate_claude_project_commands(cmd_slugs)
        : 0;
    const commands = _tool_active('claude-code') ? generate_claude_commands(cmd_slugs) : 0;
    const subagents = _tool_active('claude-code') ? generate_claude_subagents() : 0;
    const subagent_contexts = generate_subagent_host_contexts();
    const plugin_cmd_skills = _tool_active('claude-code') ? generate_plugin_command_skills() : 0;
    const plugin_hooks = _tool_active('claude-code') ? generate_plugin_hooks() : 0;
    const personas = generate_persona_symlinks();
    const user_types = generate_user_type_symlinks();
    const cursor_mdc = _tool_active('cursor') ? generate_cursor_mdc_rules() : 0;
    const windsurf_modern = _tool_active('windsurf') ? generate_windsurf_modern_rules() : 0;
    const cursor_cmds = _tool_active('cursor') ? generate_cursor_commands(cmd_slugs) : 0;
    const windsurf_wf = _tool_active('windsurf') ? generate_windsurf_workflows(cmd_slugs) : 0;
    const summary =
        `✅  generate-tools — rules=${rules} skills=${skills} ` +
        `claude_commands=${claude_cmds} command_skills=${commands} ` +
        `subagents=${subagents} subagent_contexts=${subagent_contexts} plugin_cmd_skills=${plugin_cmd_skills} ` +
        `plugin_hooks=${plugin_hooks} ` +
        `personas=${personas} user_types=${user_types} ` +
        `cursor_mdc=${cursor_mdc} windsurf_rules=${windsurf_modern} ` +
        `cursor_commands=${cursor_cmds} windsurf_workflows=${windsurf_wf} ` +
        `windsurfrules=${windsurfrules}`;
    if (resolve_level() === 'verbose') {
        _print(`\n${summary}`);
    } else {
        success(summary);
        flush_summary();
    }
}

export function generate_tools(): void {
    const [cmd_slugs, skill_names] = _resolve_active_predicates();
    const scoped = cmd_slugs !== null;
    try {
        _generate_tools_inner(cmd_slugs, skill_names);
    } catch (e) {
        if (scoped) {
            info('  ⚠️  scoped projection failed — restoring full (legacy-all) projection');
            _generate_tools_inner(null, null);
        }
        throw e;
    }
    if (!scoped) {
        info(
            '  ℹ️  Profile mode available — focused surface. ' +
                'Run `agent-config use --profile=developer`.',
        );
    }
}

// ── .augment/ projection ──────────────────────────────────────────────

const AUGMENT_SYMLINK_DIRS = [
    'skills',
    'commands',
    'guidelines',
    'personas',
    'user-types',
    'templates',
    'contexts',
    'scripts',
] as const;
const AUGMENT_SYMLINK_FILES = ['README.md'] as const;

export function project_to_augment(): void {
    if (!_exists(MODULE_STATE.TARGET_DIR)) {
        _print(`  ⚠️  ${path.basename(MODULE_STATE.TARGET_DIR)}/ not found — nothing to project`);
        return;
    }

    _mkdirp(MODULE_STATE.AUGMENT_DIR);

    const use_symlinks = _read_augment_rules_use_symlinks();

    const src_rules = path.join(MODULE_STATE.TARGET_DIR, 'rules');
    const dst_rules = path.join(MODULE_STATE.AUGMENT_DIR, 'rules');
    _mkdirp(dst_rules);
    const existing = new Set(
        _iterdirSorted(dst_rules)
            .filter((f) => _isFile(f) || _isSymlink(f))
            .map((f) => path.basename(f)),
    );
    const current = new Set<string>();
    let written = 0;
    if (_exists(src_rules)) {
        // ADR-236 per-host partition. Applied on BOTH branches of
        // `use_symlinks` below, because the flag selects a different writer and a
        // narrowing on one of them would leave the other duplicating.
        //
        // This emitter reads `dist/agent-src/rules` directly rather than going
        // through `_scoped_rule_basenames`, so it never had the scope or the
        // ADR-004 manual filter either — which is why it wrote 118 files where the
        // symlink trees wrote 113. The partition is what this step adds; the other
        // two differences are pre-existing and left alone.
        //
        // The stale sweep below (`existing` minus `current`) turns the narrowed set
        // into a removal, so an .augment/rules populated by an earlier version is
        // reconciled in one run.
        const rules = partition_rules_for_dir(
            '.augment/rules',
            _iterdirSorted(src_rules)
                .filter((p) => p.endsWith('.md') && _isFile(p))
                .map((p) => path.basename(p))
                .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
        );
        for (const rule of rules) {
            const target = path.join(dst_rules, rule);
            if (_isSymlink(target) || _existsOrSymlink(target)) {
                fs.unlinkSync(target);
            }
            if (use_symlinks) {
                fs.symlinkSync(path.join('..', '..', 'dist/agent-src', 'rules', rule), target);
            } else {
                copy_file(path.join(src_rules, rule), target);
            }
            current.add(rule);
            written += 1;
        }
    }
    let removed_rules = 0;
    for (const name of existing) {
        if (!current.has(name)) {
            fs.unlinkSync(path.join(dst_rules, name));
            removed_rules += 1;
        }
    }
    const mode_label = use_symlinks ? 'Symlinked' : 'Copied';
    _print(
        `  ✅  ${mode_label} ${written} rules to .augment/rules/` +
            (removed_rules ? ` (${removed_rules} stale removed)` : ''),
    );

    for (const sub of AUGMENT_SYMLINK_DIRS) {
        const dst = path.join(MODULE_STATE.AUGMENT_DIR, sub);
        if (_isSymlink(dst) || _existsOrSymlink(dst)) {
            if (_isDir(dst) && !_isSymlink(dst)) {
                fs.rmSync(dst, { recursive: true, force: true });
            } else {
                fs.unlinkSync(dst);
            }
        }
        const src = path.join(MODULE_STATE.TARGET_DIR, sub);
        if (_exists(src)) {
            fs.symlinkSync(path.join('..', 'dist/agent-src', sub), dst);
            _print(`  ✅  Symlinked .augment/${sub} → ../dist/agent-src/${sub}`);
        }
    }

    for (const name of AUGMENT_SYMLINK_FILES) {
        const dst = path.join(MODULE_STATE.AUGMENT_DIR, name);
        const src = path.join(MODULE_STATE.TARGET_DIR, name);
        if (_isSymlink(dst) || _existsOrSymlink(dst)) {
            fs.unlinkSync(dst);
        }
        if (_exists(src)) {
            fs.symlinkSync(path.join('..', 'dist/agent-src', name), dst);
            _print(`  ✅  Symlinked .augment/${name} → ../dist/agent-src/${name}`);
        }
    }

    const known = new Set<string>([...AUGMENT_SYMLINK_DIRS, ...AUGMENT_SYMLINK_FILES, 'rules', 'state']);
    for (const item of _iterdirSorted(MODULE_STATE.AUGMENT_DIR)) {
        const name = path.basename(item);
        if (known.has(name)) {
            continue;
        }
        if (_isSymlink(item) || _isFile(item)) {
            fs.unlinkSync(item);
            _print(`  🗑️  Removed stale .augment/${name}`);
        } else if (_isDir(item)) {
            fs.rmSync(item, { recursive: true, force: true });
            _print(`  🗑️  Removed stale .augment/${name}/`);
        }
    }
}

export function clean_tools(): void {
    const targets = [
        path.join(MODULE_STATE.PROJECT_ROOT, '.claude'),
        path.join(MODULE_STATE.PROJECT_ROOT, '.cursor'),
        path.join(MODULE_STATE.PROJECT_ROOT, '.clinerules'),
        path.join(MODULE_STATE.PROJECT_ROOT, '.windsurf'),
        path.join(MODULE_STATE.PROJECT_ROOT, '.windsurfrules'),
        path.join(MODULE_STATE.PROJECT_ROOT, 'GEMINI.md'),
    ];
    for (const t of targets) {
        if (_isDirNoFollow(t) && !_isSymlink(t)) {
            fs.rmSync(t, { recursive: true, force: true });
            _print(`  🗑️  Removed ${_relativeToPosix(t, MODULE_STATE.PROJECT_ROOT)}`);
        } else if (_existsOrSymlink(t)) {
            fs.unlinkSync(t);
            _print(`  🗑️  Removed ${_relativeToPosix(t, MODULE_STATE.PROJECT_ROOT)}`);
        }
    }
    _print('✅  All generated tool files cleaned');
}

// --- CLI ---------------------------------------------------------------------

/** Plain stdout print mirroring Python's print(). */
function _print(line: string): void {
    process.stdout.write(`${line}\n`);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (!_exists(MODULE_STATE.SOURCE_DIR) && !_any_source_root_exists()) {
        _print(
            `❌  No source directory found (looked at the artefact roots under src/ and ${MODULE_STATE.SOURCE_DIR})`,
        );
        return 1;
    }

    const arg = argv.length > 0 ? (argv[0] as string) : '--sync';

    if (arg === '--list') {
        const files = list_md_files(MODULE_STATE.SOURCE_DIR);
        _print(`📄  ${files.length} .md files total:\n`);
        for (const f of files) {
            _print(`  ${f}`);
        }
    } else if (arg === '--changed') {
        const changed = list_changed_md(MODULE_STATE.SOURCE_DIR);
        if (changed.length === 0) {
            _print('✅  Every .md projection matches its source');
            return 0;
        }
        _print(`📝  ${changed.length} .md projection(s) out of date — run 'task sync':\n`);
        for (const f of changed) {
            _print(`  ${f}`);
        }
    } else if (arg === '--check') {
        const [missing, stale] = check_sync(MODULE_STATE.SOURCE_DIR, MODULE_STATE.TARGET_DIR);
        if (missing.length === 0 && stale.length === 0) {
            _print('✅  dist/agent-src/ is in sync with the artefact roots under src/');
            return 0;
        }
        if (missing.length > 0) {
            _print(`❌  Missing in dist/agent-src/ (${missing.length}):`);
            for (const f of missing) {
                _print(`  ${f}`);
            }
        }
        if (stale.length > 0) {
            _print(`❌  Stale in dist/agent-src/ (${stale.length}):`);
            for (const f of stale) {
                _print(`  ${f}`);
            }
        }
        _print(`\nRun 'task sync' — the projection is a deterministic copy, so it needs no agent step.`);
        return 1;
    } else if (arg === '--sync') {
        // SOURCE_DIR is the pre-ADR-051 single root, kept only as a fallback probe;
        // the real inputs are the artefact roots the multi-root iterator walks.
        _print(`Source: the artefact roots under src/`);
        _print(`Target: ${MODULE_STATE.TARGET_DIR}\n`);
        _print('--- Syncing non-.md files ---');
        const copied = sync_non_md(MODULE_STATE.SOURCE_DIR, MODULE_STATE.TARGET_DIR);
        _print(`\n--- Cleanup stale files ---`);
        const deleted = cleanup_stale(MODULE_STATE.SOURCE_DIR, MODULE_STATE.TARGET_DIR);
        const changed = list_changed_md(MODULE_STATE.SOURCE_DIR);
        _print(`\n✅  Done: ${copied} copied, ${deleted} stale deleted`);
        if (changed.length > 0) {
            // --sync writes .md itself, so anything still stale here is a bug in
            // the projector, not work left for a follow-up step.
            _print(`❌  ${changed.length} .md projection(s) still out of date after sync (run --changed)`);
        } else {
            _print(`✅  Every .md projection matches its source`);
        }
        _print(`\n--- Projecting dist/agent-src/ → .augment/ ---`);
        project_to_augment();
    } else if (arg === '--generate-tools') {
        generate_tools();
    } else if (arg === '--clean-tools') {
        clean_tools();
    } else if (arg === '--project-augment') {
        project_to_augment();
    } else {
        _print(
            'Usage: condense [--sync|--list|--changed|--check|--generate-tools|--clean-tools|--project-augment]',
        );
        return 1;
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
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

const isMain =
    _isCliEntry();

if (isMain) {
    process.exit(main());
}

#!/usr/bin/env tsx
/**
 * Agent-config sync — condense .agent-src.uncondensed/ → dist/agent-src/
 * and project dist/agent-src/ → .augment/ (copies for rules by default,
 * symlinks for the rest; opt into rule symlinks via
 * augment.rules_use_symlinks in .agent-settings.yml).
 *
 * TypeScript twin of `src/scripts/condense.py` (ADR-089 — Python→TS
 * migration, Phase 5). Mirrors the Python CLI surface EXACTLY — every
 * subcommand (`--sync`, `--list`, `--changed`, `--check`, `--check-hashes`,
 * `--clean-hashes`, `--mark-done <path>`, `--mark-all-done`,
 * `--generate-tools`, `--clean-tools`, `--project-augment`) — same flags,
 * exit codes, stdout/stderr split, byte-identical messages. No behaviour
 * changes; latent Python bugs replicated and flagged.
 *
 * Path handling note: the Python original uses `pathlib.Path` objects.
 * This twin uses absolute path strings (the host filesystem on the
 * supported platforms is POSIX). Logical relative paths are always POSIX
 * (forward-slash) strings, matching the Python `.as_posix()` keys.
 *
 * Module-level constants (PROJECT_ROOT, SOURCE_DIR, TARGET_DIR, …) and the
 * multi-root helper functions (iter_all_sources, resolve_logical,
 * artefact_roots) are exposed through a mutable module-state object so the
 * pytest suite's monkeypatch pattern — reassigning `condense.PROJECT_ROOT`,
 * `condense.HASH_FILE`, `condense.iter_all_sources`, … — has a faithful TS
 * equivalent. Tests mutate `MODULE_STATE` via the exported setters.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import {
    artefact_roots as _agent_src_artefact_roots,
    iter_all_sources as _agent_src_iter_all_sources,
    resolve_logical as _agent_src_resolve_logical,
    strip_source_prefix,
} from './_lib/agent_src.js';
import { project_settings_path, load_agent_settings } from './_lib/agent_settings.js';
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
// The pytest suite reassigns `condense.PROJECT_ROOT`, `condense.HASH_FILE`,
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

const _HERE = path.dirname(fileURLToPath(import.meta.url)); // <repo>/src/scripts
const _DEFAULT_PROJECT_ROOT = path.resolve(_HERE, '..', '..');

interface ModuleState {
    PROJECT_ROOT: string;
    SOURCE_DIR: string;
    TARGET_DIR: string;
    AUGMENT_DIR: string;
    HASH_FILE: string;
    SETTINGS_FILE: string;
    RULES_SOURCE: string;
    SKILLS_SOURCE: string;
    COMMANDS_SOURCE: string;
    PERSONAS_SOURCE: string;
    USER_TYPES_SOURCE: string;
    CLAUDE_SKILLS_DIR: string;
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
        HASH_FILE: path.join(root, 'internal', '.condensation-hashes.json'),
        SETTINGS_FILE: project_settings_path(root),
        RULES_SOURCE: path.join(root, 'dist/agent-src', 'rules'),
        SKILLS_SOURCE: path.join(root, 'dist/agent-src', 'skills'),
        COMMANDS_SOURCE: path.join(root, 'dist/agent-src', 'commands'),
        PERSONAS_SOURCE: path.join(root, 'dist/agent-src', 'personas'),
        USER_TYPES_SOURCE: path.join(root, 'dist/agent-src', 'user-types'),
        CLAUDE_SKILLS_DIR: path.join(root, '.claude', 'skills'),
        PLUGIN_SKILLS_DIR: path.join(root, '.claude-plugin', 'skills'),
        iter_all_sources: _agent_src_iter_all_sources,
        resolve_logical: _agent_src_resolve_logical,
        artefact_roots: _agent_src_artefact_roots,
    };
}

export const MODULE_STATE: ModuleState = _deriveState(_DEFAULT_PROJECT_ROOT);

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

function _active_tools(): ReadonlySet<string> | null {
    const tools_file = path.join(MODULE_STATE.PROJECT_ROOT, 'agents', '.agent-tools.yml');
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

export function file_hash(filepath: string): string {
    const h = crypto.createHash('sha256');
    h.update(fs.readFileSync(filepath));
    return h.digest('hex');
}

const _DEP_FRONTMATTER_KEYS = ['skills', 'rules'] as const;

function _slug_to_logical(slug: string): string | null {
    for (const cand of [`skills/${slug}/SKILL.md`, `rules/${slug}.md`]) {
        if (_resolve_source(cand) !== null) {
            return cand;
        }
    }
    return null;
}

function _direct_includes(relative: string): string[] {
    const source = _resolve_source(relative);
    if (source === null) {
        return [];
    }
    let meta: Record<string, unknown>;
    try {
        [meta] = _parse_frontmatter(_readText(source));
    } catch {
        return [];
    }
    const deps: string[] = [];
    for (const key of _DEP_FRONTMATTER_KEYS) {
        const value = meta[key];
        if (!Array.isArray(value)) {
            continue;
        }
        for (const item of value) {
            if (typeof item !== 'string') {
                continue;
            }
            const logical = _slug_to_logical(item.trim());
            if (logical !== null && logical !== relative) {
                deps.push(logical);
            }
        }
    }
    return deps;
}

export function effective_hash(relative: string, _seen: ReadonlySet<string> | null = null): string {
    const source = _resolve_source(relative);
    if (source === null) {
        return '';
    }
    const own = file_hash(source);
    if (_seen !== null && _seen.has(relative)) {
        return own; // cycle — fold own content only
    }
    const deps = [...new Set(_direct_includes(relative))].sort((a, b) =>
        a < b ? -1 : a > b ? 1 : 0,
    );
    if (deps.length === 0) {
        return own; // leaf — identical to plain file_hash
    }
    const seenNext = new Set(_seen ?? []);
    seenNext.add(relative);
    const parts = [own, ...deps.map((dep) => effective_hash(dep, seenNext))];
    return crypto.createHash('sha256').update(parts.join('\n'), 'utf-8').digest('hex');
}

export function load_hashes(): Record<string, string> {
    if (_exists(MODULE_STATE.HASH_FILE)) {
        try {
            return JSON.parse(_readText(MODULE_STATE.HASH_FILE)) as Record<string, string>;
        } catch {
            return {};
        }
    }
    return {};
}

export function save_hashes(hashes: Record<string, string>): void {
    _mkdirp(path.dirname(MODULE_STATE.HASH_FILE));
    _writeText(MODULE_STATE.HASH_FILE, _jsonDumpsSorted(hashes) + '\n');
}

/** Mirror json.dumps(obj, indent=2, sort_keys=True) for a flat string map. */
function _jsonDumpsSorted(obj: Record<string, string>): string {
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (keys.length === 0) {
        return '{}';
    }
    const lines = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(obj[k])}`);
    return `{\n${lines.join(',\n')}\n}`;
}

export function mark_done(relative_path: string): void {
    const source_file = _resolve_source(relative_path);
    if (source_file === null || !_exists(source_file)) {
        _print(`❌  Source file not found: ${relative_path}`);
        process.exit(1);
    }
    apply_path_rewriter(relative_path);
    const hashes = load_hashes();
    hashes[relative_path] = effective_hash(relative_path);
    save_hashes(hashes);
    _print(`✅  Marked as condensed: ${relative_path}`);
}

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

export function mark_all_done(): void {
    const hashes = load_hashes();
    let count = 0;
    for (const [source_file, relative] of _iter_sources()) {
        if (!should_condense(source_file)) {
            continue;
        }
        hashes[relative] = effective_hash(relative);
        count += 1;
    }
    save_hashes(hashes);
    _print(`✅  Marked ${count} files as condensed`);
}

export function list_changed_md(_source_dir?: string): string[] {
    // _source_dir retained for signature compatibility but ignored (multi-root).
    const hashes = load_hashes();
    const changed: string[] = [];
    for (const [source_file, relative] of _iter_sources()) {
        if (!should_condense(source_file)) {
            continue;
        }
        const current_hash = effective_hash(relative);
        const stored_hash = hashes[relative];
        if (stored_hash !== current_hash) {
            changed.push(relative);
        }
    }
    return changed;
}

export function find_stale_hashes(_source_dir?: string): string[] {
    const hashes = load_hashes();
    const stale: string[] = [];
    for (const relative of Object.keys(hashes).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
        if (_resolve_source(relative) === null) {
            stale.push(relative);
        }
    }
    return stale;
}

export function clean_stale_hashes(_source_dir?: string): number {
    const stale = find_stale_hashes(_source_dir);
    if (stale.length === 0) {
        return 0;
    }
    const hashes = load_hashes();
    for (const relative of stale) {
        delete hashes[relative];
    }
    save_hashes(hashes);
    return stale.length;
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

export function sync_non_md(_source_dir: string, target_dir: string): number {
    let copied = 0;
    const seen = new Set<string>();
    for (const [source_file, relative] of _iter_sources()) {
        if (should_condense(source_file)) {
            continue; // .md files are condensed by the agent, not copied here
        }
        if (seen.has(relative)) {
            continue;
        }
        seen.add(relative);
        const target_file = path.join(target_dir, relative);
        copy_file(source_file, target_file);
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
            if (_resolve_source(relative) === null) {
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
// agree — see ADR-089 note). Mirrors condense.py::_rewrite_paths.

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

export function generate_rule_symlinks(): number {
    const rules = _iterdirSorted(MODULE_STATE.RULES_SOURCE)
        .filter((p) => p.endsWith('.md') && _isFile(p))
        .map((p) => path.basename(p))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const tool_dirs = _filter_tool_dirs(TOOL_DIRS);

    let thin_files: Record<string, string> | null = null;
    if (_lean_projection_mode() === 'thin') {
        // The `project_thin_rules` twin is not ported (out of scope — thin mode
        // is opt-in and not exercised by golden parity). Throw a clear error if
        // a consumer actually enables it, mirroring an unmet import.
        throw new Error(
            'lean_projection.mode=thin requires project_thin_rules (not ported in condense.ts)',
        );
    }

    let total = 0;
    for (const [tool_dir, rel_prefix] of Object.entries(tool_dirs)) {
        const target_dir = path.join(MODULE_STATE.PROJECT_ROOT, tool_dir);
        _mkdirp(target_dir);
        // Clean stale symlinks
        for (const item of _iterdirSorted(target_dir)) {
            const name = path.basename(item);
            if (_isSymlink(item) && !rules.includes(name) && name !== 'README.md') {
                fs.unlinkSync(item);
            }
        }
        for (const rule of rules) {
            const link = path.join(target_dir, rule);
            if (_existsOrSymlink(link)) {
                fs.unlinkSync(link);
            }
            if (thin_files !== null) {
                _writeText(link, thin_files[rule] as string);
            } else {
                fs.symlinkSync(path.join(rel_prefix, rule), link);
            }
            total += 1;
        }
    }

    const source_count = rules.length;
    for (const tool_dir of Object.keys(tool_dirs)) {
        const target_dir = path.join(MODULE_STATE.PROJECT_ROOT, tool_dir);
        const tool_count = _iterdirSorted(target_dir).filter((f) => f.endsWith('.md')).length;
        if (tool_count !== source_count) {
            _print(`  ⚠️  ${tool_dir}: ${tool_count} rules (expected ${source_count})`);
        }
    }

    info(
        `  ✅  Created ${total} rule symlinks across ${Object.keys(tool_dirs).length} tool directories (${source_count} rules each)`,
    );
    return total;
}

export function generate_windsurfrules(): number {
    const rules = _iterdirSorted(MODULE_STATE.RULES_SOURCE)
        .filter((p) => p.endsWith('.md') && _isFile(p))
        .map((p) => path.basename(p))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
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

function _parse_frontmatter(content: string): [Record<string, unknown>, string] {
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

function _emit_cursor_mdc(source: string, target: string): void {
    const [meta, body] = _parse_frontmatter(_readText(source));
    const description = _strip(String(meta['description'] ?? '').replace(/\n/g, ' '));
    const always_apply = Boolean(meta['alwaysApply'] || meta['type'] === 'always');
    const lines = [
        '---',
        `description: ${_yaml_scalar(description)}`,
        'globs: ',
        `alwaysApply: ${always_apply ? 'true' : 'false'}`,
        '---',
        '',
        _pyRstrip(body) + '\n',
    ];
    _mkdirp(path.dirname(target));
    _writeText(target, lines.join('\n'));
}

function _emit_windsurf_rule(source: string, target: string): void {
    const [meta, body] = _parse_frontmatter(_readText(source));
    const description = _strip(String(meta['description'] ?? '').replace(/\n/g, ' '));
    const always_apply = Boolean(meta['alwaysApply'] || meta['type'] === 'always');
    const trigger = always_apply ? 'always_on' : 'model_decision';
    const lines = [
        '---',
        `trigger: ${trigger}`,
        `description: ${_yaml_scalar(description)}`,
        'globs: ',
        '---',
        '',
        _pyRstrip(body) + '\n',
    ];
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
    const rules = _rglobSorted(MODULE_STATE.RULES_SOURCE, '*.md').filter((p) => _isFile(p));
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
    const rules = _rglobSorted(MODULE_STATE.RULES_SOURCE, '*.md').filter((p) => _isFile(p));
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
    const command_slugs = new Set([...iterCommands()].map(([, slug]) => slug));

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

export function generate_claude_commands(active_command_slugs: ReadonlySet<string> | null = null): number {
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
    if (removed_dirs) {
        msg += ` (${removed_dirs} stale dirs removed)`;
    }
    info(msg);
    return count;
}

export function generate_plugin_command_skills(): number {
    if (!_isDir(path.join(MODULE_STATE.PROJECT_ROOT, 'src', 'domains'))) {
        return 0;
    }
    _mkdirp(MODULE_STATE.PLUGIN_SKILLS_DIR);

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
    for (const [source_file, slug] of iterCommands()) {
        if (skill_names.has(slug)) {
            continue;
        }
        current_slugs.add(slug);
        const skill_dir = path.join(MODULE_STATE.PLUGIN_SKILLS_DIR, slug);
        _mkdirp(skill_dir);
        const skill_file = path.join(skill_dir, 'SKILL.md');
        if (_existsOrSymlink(skill_file)) {
            fs.unlinkSync(skill_file);
        }
        const rel_path = _relativeToPosix(source_file, MODULE_STATE.PROJECT_ROOT);
        const rel_target = path.join('../../..', rel_path);
        fs.symlinkSync(rel_target, skill_file);
        count += 1;
    }

    let removed_dirs = 0;
    for (const item of _iterdirSorted(MODULE_STATE.PLUGIN_SKILLS_DIR)) {
        if (!_isDirNoFollow(item) || _isSymlink(item)) {
            continue;
        }
        if (current_slugs.has(path.basename(item))) {
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

    let msg = `  ✅  Created ${count} command entries in .claude-plugin/skills/`;
    if (removed_dirs) {
        msg += ` (${removed_dirs} stale dirs removed)`;
    }
    info(msg);
    return count;
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
    const list = direct;
    const tool_dirs = _filter_tool_dirs(PERSONA_TOOL_DIRS);
    let total = 0;
    for (const [tool_dir, rel_prefix] of Object.entries(tool_dirs)) {
        const target_dir = path.join(MODULE_STATE.PROJECT_ROOT, tool_dir);
        _mkdirp(target_dir);
        for (const item of _iterdirSorted(target_dir)) {
            const name = path.basename(item);
            if (_isSymlink(item) && !list.includes(name) && name !== 'README.md') {
                fs.unlinkSync(item);
            }
        }
        for (const persona of list) {
            const link = path.join(target_dir, persona);
            const target = path.join(rel_prefix, persona);
            if (_existsOrSymlink(link)) {
                fs.unlinkSync(link);
            }
            fs.symlinkSync(target, link);
            total += 1;
        }
    }
    info(
        `  ✅  Created ${total} persona symlinks across ${Object.keys(tool_dirs).length} tool directories (${list.length} personas each)`,
    );
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

    // Python: `manifest = yaml.safe_load(...) or {}`.
    let manifest = _yamlParse(_readText(manifest_path)) as Record<string, unknown> | null;
    if (manifest === null || manifest === undefined) {
        manifest = {};
    }
    const hook_spec = (manifest['schema_version'] as unknown) ?? 1;
    const platforms = (manifest['platforms'] ?? {}) as Record<string, unknown>;
    const claude_events = ((platforms['claude'] ?? {}) as Record<string, unknown>) || {};
    const nativeAliasesAll = (manifest['native_event_aliases'] ?? {}) as Record<string, unknown>;
    const aliases = ((nativeAliasesAll['claude'] ?? {}) as Record<string, unknown>) || {};
    // Reverse the native→agent-config map.
    const ac_to_native: Record<string, string> = {};
    for (const [native, ac] of Object.entries(aliases)) {
        ac_to_native[String(ac)] = native;
    }

    const hooks: Record<string, unknown[]> = {};
    for (const [ac_event, concerns] of Object.entries(claude_events)) {
        if (!concerns || (Array.isArray(concerns) && concerns.length === 0)) {
            continue;
        }
        const native = ac_to_native[ac_event];
        if (native === undefined) {
            continue;
        }
        const command =
            'BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; ' +
            `"$BIN" dispatch:hook --platform claude --event ${ac_event} ` +
            `--native-event ${native} --project-dir "$CLAUDE_PROJECT_DIR" ` +
            `--min-version ${String(hook_spec)}`;
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
    const commands = _tool_active('claude-code') ? generate_claude_commands(cmd_slugs) : 0;
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
        `commands=${commands} plugin_cmd_skills=${plugin_cmd_skills} ` +
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
        const rules = _iterdirSorted(src_rules)
            .filter((p) => p.endsWith('.md') && _isFile(p))
            .map((p) => path.basename(p))
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
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
            `❌  No source directory found (looked at ${MODULE_STATE.SOURCE_DIR} and packages/*/.agent-src.uncondensed)`,
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
            _print('✅  No .md files changed since last condensation');
            return 0;
        }
        _print(`📝  ${changed.length} .md files changed since last condensation:\n`);
        for (const f of changed) {
            _print(`  ${f}`);
        }
    } else if (arg === '--mark-done') {
        if (argv.length < 2) {
            _print('Usage: python scripts/condense.py --mark-done <relative-path>');
            return 1;
        }
        mark_done(argv[1] as string);
    } else if (arg === '--mark-all-done') {
        mark_all_done();
    } else if (arg === '--check') {
        const [missing, stale] = check_sync(MODULE_STATE.SOURCE_DIR, MODULE_STATE.TARGET_DIR);
        if (missing.length === 0 && stale.length === 0) {
            _print('✅  dist/agent-src/ is in sync with .agent-src.uncondensed/');
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
        _print(`\nRun 'task sync' to fix non-.md files, then ask the agent to condense .md files.`);
        return 1;
    } else if (arg === '--sync') {
        _print(`Source: ${MODULE_STATE.SOURCE_DIR}`);
        _print(`Target: ${MODULE_STATE.TARGET_DIR}\n`);
        _print('--- Syncing non-.md files ---');
        const copied = sync_non_md(MODULE_STATE.SOURCE_DIR, MODULE_STATE.TARGET_DIR);
        _print(`\n--- Cleanup stale files ---`);
        const deleted = cleanup_stale(MODULE_STATE.SOURCE_DIR, MODULE_STATE.TARGET_DIR);
        const hashes = load_hashes();
        const stale_keys = Object.keys(hashes).filter((k) => _resolve_source(k) === null);
        for (const k of stale_keys) {
            delete hashes[k];
        }
        if (stale_keys.length > 0) {
            save_hashes(hashes);
            _print(`  Cleaned ${stale_keys.length} stale hash entries`);
        }
        const changed = list_changed_md(MODULE_STATE.SOURCE_DIR);
        _print(`\n✅  Done: ${copied} copied, ${deleted} stale deleted`);
        if (changed.length > 0) {
            _print(`📝  ${changed.length} .md files need condensation (run --changed to see them)`);
        } else {
            _print(`✅  All .md files are up to date`);
        }
        _print(`\n--- Projecting dist/agent-src/ → .augment/ ---`);
        project_to_augment();
    } else if (arg === '--check-hashes') {
        let has_issues = false;
        const changed = list_changed_md(MODULE_STATE.SOURCE_DIR);
        const stale = find_stale_hashes(MODULE_STATE.SOURCE_DIR);

        if (stale.length > 0) {
            has_issues = true;
            _print(`⚠️  ${stale.length} stale hash(es) for deleted source files:\n`);
            for (const f of stale) {
                _print(`  ${f}`);
            }
            _print(`\nRun 'task sync-clean-hashes' to remove them.\n`);
        }

        if (changed.length > 0) {
            has_issues = true;
            _print(`❌  ${changed.length} .md file(s) need recondensation:\n`);
            for (const f of changed) {
                const stored = load_hashes()[f];
                const reason = stored === undefined ? 'no hash stored' : 'hash mismatch';
                _print(`  ${f}  (${reason})`);
            }
            _print(`\nRun '/condense' command to recondense these files.`);
        }

        if (!has_issues) {
            _print('✅  All condensation hashes are clean (no stale, no mismatches)');
            return 0;
        }
        return 1;
    } else if (arg === '--clean-hashes') {
        const count = clean_stale_hashes(MODULE_STATE.SOURCE_DIR);
        if (count) {
            _print(`✅  Removed ${count} stale hash(es)`);
        } else {
            _print('✅  No stale hashes found');
        }
    } else if (arg === '--generate-tools') {
        generate_tools();
    } else if (arg === '--clean-tools') {
        clean_tools();
    } else if (arg === '--project-augment') {
        project_to_augment();
    } else {
        _print(
            'Usage: python scripts/condense.py [--sync|--list|--changed|--check|--check-hashes|--clean-hashes|--mark-done <path>|--mark-all-done|--generate-tools|--clean-tools|--project-augment]',
        );
        return 1;
    }
    return 0;
}

const isMain =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
    process.exit(main());
}

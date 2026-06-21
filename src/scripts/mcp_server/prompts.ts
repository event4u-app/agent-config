// Prompt loader — reads `dist/agent-src/skills/` and `dist/agent-src/commands/`.
//
// Phase 1 (A4) exposed 5 hand-picked, stack-agnostic skills. Phase 2
// (B1–B3) extends to the full set: every `SKILL.md` under
// `dist/agent-src/skills/` plus every `*.md` under `dist/agent-src/commands/`.
//
// Frontmatter `name` + `description` map to MCP prompt metadata; the
// body (frontmatter stripped) is the prompt content. Frontmatter
// `source:` is forwarded verbatim into the MCP `_meta` field so clients
// can filter package-vs-project entries on the wire.
//
// Project-overrides resolution: `dist/agent-src/` is the already-merged
// view at sync time; the runtime loader does not re-merge.
//
// Frontmatter validation (B3): entries missing `name` or `description`
// are skipped and surfaced in the second tuple element of `scan_*`
// helpers (caller decides whether to log).
//
// TS twin of prompts.py (py2ts Phase 8). Mirrors the full public surface:
//   PHASE_1_SKILLS, PromptKind, UserTypeMatch, SkillPrompt, load_skill,
//   load_phase_1_prompts, scan_skills, scan_commands, load_all_prompts,
//   to_mcp_prompt_meta, PromptCache. The leading-underscore helpers
//   (_project_root, _strip_frontmatter) are exported because resources.ts
//   imports them (mirrors `from .prompts import _project_root, _strip_frontmatter`).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { project_settings_path } from '../_lib/agent_settings.js';

// Phase 1 hand-picked skills — kept for the Phase-1 entrypoint
// (`load_phase_1_prompts`) and as the contract-test fixture set. The
// roadmap originally listed `verify-before-complete`, which lives as
// a rule, not a skill; its skill counterpart is
// `verify-completion-evidence` (same evidence-gate obligation).
export const PHASE_1_SKILLS: readonly string[] = [
    'verify-completion-evidence',
    'systematic-debugging',
    'test-driven-development',
    'refine-ticket',
    'conventional-commits-writing',
];

export type PromptKind = 'skill' | 'command';
export type UserTypeMatch = '' | 'match' | 'universal' | 'outside';

/**
 * Resolved Markdown prompt ready for MCP exposure.
 *
 * `kind` distinguishes the two Phase-2 source families. The name
 * field is the frontmatter `name:` value verbatim (e.g.
 * `test-driven-development` or `research:report`); MCP wire names
 * are derived in `to_mcp_prompt_meta` with `kind`-aware prefixing.
 *
 * `recommended_for_user_types` mirrors the SKILL.md frontmatter
 * array (step-9 user-type axis). Empty tuple = universal (no
 * user-type constraint declared). `user_type_match` is the
 * cache-computed match label against the active `personal.user_type`
 * in `.agent-settings.yml`; empty string means filtering is disabled.
 *
 * Mirrors the Python frozen dataclass field order; defaults applied at
 * construction sites (kind="skill", recommended_for_user_types=(),
 * user_type_match="").
 */
export interface SkillPrompt {
    readonly name: string;
    readonly description: string;
    readonly body: string;
    readonly source: string;
    readonly kind: PromptKind;
    readonly recommended_for_user_types: readonly string[];
    readonly user_type_match: UserTypeMatch;
}

/** Walk up from this file to the repo root (parent of `scripts/`). */
export function _project_root(): string {
    // Python: Path(__file__).resolve().parent.parent.parent.parent
    //   __file__ = src/scripts/mcp_server/prompts.py
    //   → .../src/scripts/mcp_server → src/scripts → src → repo root.
    return path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
}

/**
 * Split a Markdown file with `---` frontmatter into [meta, body].
 *
 * Tiny YAML-ish parser sufficient for our flat key/value frontmatter.
 * Avoids a YAML dependency for Phase 1; the frontmatter shape is
 * enforced by `task lint-skills` upstream.
 */
export function _strip_frontmatter(text: string): [Record<string, string>, string] {
    if (!text.startsWith('---\n')) {
        return [{}, text];
    }
    // Python: text.split("---\n", 2) → at most 3 parts. ValueError when
    // fewer than 3 parts unpack — mirror by counting splits manually.
    const parts = _splitMax(text, '---\n', 2);
    if (parts.length < 3) {
        return [{}, text];
    }
    const fm = parts[1] as string;
    const body = parts[2] as string;
    const meta: Record<string, string> = {};
    for (const line of fm.split('\n')) {
        if (!line.trim() || line.startsWith('#')) {
            continue;
        }
        if (!line.includes(':')) {
            continue;
        }
        const idx = line.indexOf(':');
        const key = line.slice(0, idx);
        const value = line.slice(idx + 1);
        meta[key.trim()] = _stripQuotes(value.trim());
    }
    return [meta, _lstripNewlines(body)];
}

/** Mirror Python `str.split(sep, maxsplit)` exactly (limited splits, remainder kept). */
function _splitMax(text: string, sep: string, maxsplit: number): string[] {
    const out: string[] = [];
    let rest = text;
    let count = 0;
    while (count < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx === -1) {
            break;
        }
        out.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        count += 1;
    }
    out.push(rest);
    return out;
}

/** Mirror Python `value.strip().strip('"').strip("'")` for a single token. */
function _stripQuotes(value: string): string {
    let v = value;
    v = _strip(v, '"');
    v = _strip(v, "'");
    return v;
}

/** Strip every leading + trailing occurrence of `ch` (Python `str.strip(ch)`). */
function _strip(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) {
        start += 1;
    }
    while (end > start && s[end - 1] === ch) {
        end -= 1;
    }
    return s.slice(start, end);
}

/** Mirror Python `body.lstrip("\n")`. */
function _lstripNewlines(s: string): string {
    let i = 0;
    while (i < s.length && s[i] === '\n') {
        i += 1;
    }
    return s.slice(i);
}

/** Mirror Python `str.rstrip()` (strip trailing whitespace). */
function _rstrip(s: string): string {
    return s.replace(/\s+$/, '');
}

/**
 * Parse `[a, b, c]` inline-array frontmatter value into a tuple.
 *
 * Returns `[]` for any malformed or empty value. Quotes around items
 * are stripped. This is intentionally a tiny parser — the canonical
 * schema for skill frontmatter is enforced upstream by
 * `task lint-skills` / `scripts/validate_frontmatter.py`.
 */
export function _parse_inline_array(value: string): string[] {
    const v = value.trim();
    if (!(v.startsWith('[') && v.endsWith(']'))) {
        return [];
    }
    const inner = v.slice(1, -1).trim();
    if (!inner) {
        return [];
    }
    const items: string[] = [];
    for (const raw of inner.split(',')) {
        const item = _stripQuotes(raw.trim());
        if (item) {
            items.push(item);
        }
    }
    return items;
}

/**
 * Read `personal.user_type` from `.agent-settings.yml`.
 *
 * Returns `""` when the file is missing, the key is unset, or the
 * value is still the install-time placeholder (`__USER_TYPE__`).
 * Empty string disables the runtime filter (legacy behavior — every
 * skill surfaces with its native sort order).
 *
 * Tiny line-based parser to avoid a YAML runtime dependency for
 * the loader (consistent with `_strip_frontmatter`). Only matches
 * `user_type:` directly under the top-level `personal:` block.
 */
export function _load_active_user_type(root: string): string {
    const settings = project_settings_path(root);
    if (!_isFile(settings)) {
        return '';
    }
    let text: string;
    try {
        text = fs.readFileSync(settings, 'utf-8');
    } catch {
        return '';
    }
    let in_personal = false;
    for (const raw of text.split('\n')) {
        if (!raw || raw.trimStart().startsWith('#')) {
            continue;
        }
        if (!_isSpace(raw[0] as string)) {
            // Top-level key — flip in_personal based on whether it's `personal:`.
            const head = _strip(raw.split('#', 1)[0]!.trim(), ':');
            // Python `.rstrip(":")` strips only trailing colons; emulate.
            const headTrimmed = _rstripChar(raw.split('#')[0]!.trim(), ':');
            in_personal = headTrimmed === 'personal';
            void head;
            continue;
        }
        if (!in_personal) {
            continue;
        }
        const stripped = raw.trim();
        if (!stripped.startsWith('user_type:')) {
            continue;
        }
        const idx = stripped.indexOf(':');
        let value = stripped.slice(idx + 1);
        value = _stripQuotes(value.split('#', 1)[0]!.trim());
        if (value.startsWith('__') && value.endsWith('__')) {
            return '';
        }
        return value;
    }
    return '';
}

/** Mirror Python `str.rstrip(ch)` (trailing-only strip of a single char). */
function _rstripChar(s: string, ch: string): string {
    let end = s.length;
    while (end > 0 && s[end - 1] === ch) {
        end -= 1;
    }
    return s.slice(0, end);
}

/** Mirror Python `str.isspace()` for a single character. */
function _isSpace(ch: string): boolean {
    return ch.length > 0 && /\s/.test(ch);
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

/**
 * pathlib `Path` ordering: compare the path COMPONENTS lexicographically,
 * element by element; shorter is "less" when one is a prefix. Matches
 * CPython `PurePath.__lt__` (case-normalised `_parts` tuple compare).
 */
function _pathlibCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return pa.length - pb.length;
}

/** Sorted immediate child entries (mirrors `sorted(p.iterdir())`). */
function _iterdirSorted(p: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(p);
    } catch {
        return [];
    }
    const full = names.map((n) => path.join(p, n));
    full.sort(_pathlibCompare);
    return full;
}

/** Sorted recursive `*.md` paths under a root (mirrors `sorted(root.rglob("*.md"))`). */
function _rglobMdSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name.endsWith('.md')) {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort(_pathlibCompare);
    return out;
}

/** Load a single skill by name. Raises FileNotFoundError-equivalent if missing. */
export function load_skill(name: string, root?: string | null): SkillPrompt {
    const base = root ?? _project_root();
    const p = path.join(base, 'dist/agent-src', 'skills', name, 'SKILL.md');
    if (!fs.existsSync(p)) {
        const err = new Error(`SKILL.md not found: ${p}`) as Error & { code?: string };
        err.code = 'ENOENT';
        throw err;
    }
    return _load_file(p, 'skill', name);
}

function _load_file(p: string, kind: PromptKind, fallback_name: string): SkillPrompt {
    const text = fs.readFileSync(p, 'utf-8');
    const [meta, body] = _strip_frontmatter(text);
    return {
        name: meta.name ?? fallback_name,
        description: (meta.description ?? '').trim(),
        body: _rstrip(body) + '\n',
        source: meta.source ?? 'package',
        kind,
        recommended_for_user_types: _parse_inline_array(meta.recommended_for_user_types ?? ''),
        user_type_match: '',
    };
}

/**
 * Load every skill listed in PHASE_1_SKILLS.
 *
 * Kept for backward compatibility with Phase-1 tests and as a
 * minimal smoke path. Production entrypoint is `load_all_prompts`.
 */
export function load_phase_1_prompts(root?: string | null): SkillPrompt[] {
    const prompts: SkillPrompt[] = [];
    const errors: string[] = [];
    for (const name of PHASE_1_SKILLS) {
        try {
            prompts.push(load_skill(name, root));
        } catch (exc) {
            const err = exc as Error & { code?: string };
            if (err.code === 'ENOENT') {
                errors.push(err.message);
            } else {
                throw exc;
            }
        }
    }
    if (errors.length > 0 && prompts.length === 0) {
        throw new Error('No Phase 1 skills loaded. Errors:\n  - ' + errors.join('\n  - '));
    }
    return prompts;
}

/**
 * Enumerate every `dist/agent-src/skills/*\/SKILL.md`.
 *
 * Returns `[prompts, errors]`. Files missing `name` or
 * `description` frontmatter are skipped with a one-line reason in
 * `errors`. Files that fail to read are surfaced the same way.
 */
export function scan_skills(root?: string | null): [SkillPrompt[], string[]] {
    const base = root ?? _project_root();
    const skills_root = path.join(base, 'dist/agent-src', 'skills');
    const prompts: SkillPrompt[] = [];
    const errors: string[] = [];
    if (!_isDir(skills_root)) {
        return [prompts, errors];
    }
    for (const skill_dir of _iterdirSorted(skills_root)) {
        const p = path.join(skill_dir, 'SKILL.md');
        if (!_isFile(p)) {
            continue;
        }
        let prompt: SkillPrompt;
        try {
            prompt = _load_file(p, 'skill', path.basename(skill_dir));
        } catch (exc) {
            errors.push(`${p}: read failed (${_excText(exc)})`);
            continue;
        }
        if (!prompt.description) {
            errors.push(`${p}: missing frontmatter description`);
            continue;
        }
        prompts.push(prompt);
    }
    return [prompts, errors];
}

/**
 * Enumerate every `dist/agent-src/commands/**\/*.md`.
 *
 * Same return contract as `scan_skills`. Command frontmatter `name:`
 * values are path-derived hyphen slugs (e.g. `research-report`,
 * enforced by command.schema.json); the value is preserved verbatim
 * and translated to MCP wire form in `to_mcp_prompt_meta`.
 */
export function scan_commands(root?: string | null): [SkillPrompt[], string[]] {
    const base = root ?? _project_root();
    const cmd_root = path.join(base, 'dist/agent-src', 'commands');
    const prompts: SkillPrompt[] = [];
    const errors: string[] = [];
    if (!_isDir(cmd_root)) {
        return [prompts, errors];
    }
    for (const p of _rglobMdSorted(cmd_root)) {
        if (!_isFile(p)) {
            continue;
        }
        // rel = path.relative_to(cmd_root).with_suffix(""); fallback = str(rel).replace("/", "-")
        const rel = path.relative(cmd_root, p).replace(/\.md$/, '');
        const fallback = rel.split(path.sep).join('-');
        let prompt: SkillPrompt;
        try {
            prompt = _load_file(p, 'command', fallback);
        } catch (exc) {
            errors.push(`${p}: read failed (${_excText(exc)})`);
            continue;
        }
        if (!prompt.description) {
            errors.push(`${p}: missing frontmatter description`);
            continue;
        }
        prompts.push(prompt);
    }
    return [prompts, errors];
}

function _excText(exc: unknown): string {
    return exc instanceof Error ? exc.message : String(exc);
}

/**
 * Phase 2 entrypoint — all skills + all commands.
 *
 * Result is sorted by MCP wire name (deterministic across boots)
 * and de-duplicated: if the same wire name appears in both lists
 * (should not happen in a clean tree) the skill copy wins and the
 * duplicate is reported in `errors`.
 */
export function load_all_prompts(root?: string | null): [SkillPrompt[], string[]] {
    const [skills, skill_errors] = scan_skills(root);
    const [commands, command_errors] = scan_commands(root);
    const errors = [...skill_errors, ...command_errors];
    const seen = new Map<string, SkillPrompt>();
    for (const prompt of [...skills, ...commands]) {
        const wire = to_mcp_prompt_meta(prompt).name as string;
        if (seen.has(wire)) {
            errors.push(
                `duplicate MCP name '${wire}': keeping ${seen.get(wire)!.kind}, ` +
                    `skipping ${prompt.kind}`,
            );
            continue;
        }
        seen.set(wire, prompt);
    }
    const merged = [...seen.values()].sort((a, b) =>
        _strCmp(to_mcp_prompt_meta(a).name as string, to_mcp_prompt_meta(b).name as string),
    );
    return [merged, errors];
}

/** Stable lexicographic comparator (mirrors Python `sorted` on strings). */
function _strCmp(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

/**
 * Project a SkillPrompt into MCP `Prompt` constructor kwargs.
 *
 * Wire-name shape:
 *     skill.<frontmatter-name>     (skills)
 *     command.<frontmatter-name>   (commands)
 * Command names are plain hyphen slugs (`research-report`) since the
 * 2026-06 Zed fix — `command.schema.json` forbids colons. The legacy
 * `: → .` rewrite below stays only as a tolerance shim for stale
 * colon-named trees (pre-fix checkouts / installed copies).
 *
 * When the user-type axis is active (`PromptCache` resolves a
 * non-empty `personal.user_type`), each prompt carries a
 * `user_type_match` label and the projected `_meta` surfaces it so
 * MCP clients can render the "outside <id> filter" collapse group.
 * Absent / empty label means filtering is off — meta is unchanged
 * from the legacy shape, preserving back-compat.
 */
export function to_mcp_prompt_meta(prompt: SkillPrompt): Record<string, unknown> {
    let wire: string;
    if (prompt.kind === 'command') {
        wire = `command.${prompt.name.replace(/:/g, '.')}`;
    } else {
        wire = `skill.${prompt.name}`;
    }
    const meta: Record<string, unknown> = { source: prompt.source, kind: prompt.kind };
    if (prompt.user_type_match) {
        meta.user_type_match = prompt.user_type_match;
    }
    return {
        name: wire,
        title: prompt.name,
        description: prompt.description,
        arguments: [],
        _meta: meta,
    };
}

/**
 * Return `[sort_rank, match_label]` for the step-9 axis.
 *
 * Ranks (lower sorts first):
 *     0 = match     — user_type is in `recommended_for_user_types`
 *     1 = universal — prompt declares no recommended_for_user_types
 *     2 = outside   — declared, but user_type is not in the list
 *
 * Caller must guarantee `user_type` is non-empty (filter is on).
 */
export function _user_type_rank(
    prompt: SkillPrompt,
    user_type: string,
): [number, UserTypeMatch] {
    const declared = prompt.recommended_for_user_types;
    if (declared.length === 0) {
        return [1, 'universal'];
    }
    if (declared.includes(user_type)) {
        return [0, 'match'];
    }
    return [2, 'outside'];
}

/**
 * In-memory cache with mtime-based invalidation (B5 hot-reload).
 *
 * `get()` re-scans `dist/agent-src/skills/` and `dist/agent-src/commands/`
 * when any tracked SKILL.md / command file has changed mtime since
 * the previous scan. New / removed files also trigger a refresh
 * (the set of tracked paths is part of the staleness key).
 *
 * The cache is intentionally simple: no inotify, no debounce, no
 * background thread. The server calls `get()` once per
 * `prompts/list` request, which is the natural rate-limiter.
 */
export class PromptCache {
    private _root: string;
    private _prompts: SkillPrompt[] = [];
    private _errors: string[] = [];
    private _signature: Array<[string, number]> = [];
    private _index: Map<string, SkillPrompt> = new Map();
    private _active_user_type = '';

    constructor(root?: string | null) {
        this._root = root ?? _project_root();
    }

    private _current_signature(): Array<[string, number]> {
        const entries: Array<[string, number]> = [];
        const skills_root = path.join(this._root, 'dist/agent-src', 'skills');
        if (_isDir(skills_root)) {
            for (const skill_dir of _iterdirSorted(skills_root)) {
                const p = path.join(skill_dir, 'SKILL.md');
                if (_isFile(p)) {
                    entries.push([p, _mtime(p)]);
                }
            }
        }
        const cmd_root = path.join(this._root, 'dist/agent-src', 'commands');
        if (_isDir(cmd_root)) {
            for (const p of _rglobMdSorted(cmd_root)) {
                if (_isFile(p)) {
                    entries.push([p, _mtime(p)]);
                }
            }
        }
        // `.agent-settings.yml` participates in the signature so a
        // user_type flip (re-run install with a different --user-type)
        // invalidates the cache without needing a SKILL.md touch.
        const settings = path.join(this._root, '.agent-settings.yml');
        if (_isFile(settings)) {
            entries.push([settings, _mtime(settings)]);
        }
        return entries;
    }

    private _refresh(): void {
        let [prompts, errors] = load_all_prompts(this._root);
        const user_type = _load_active_user_type(this._root);
        this._active_user_type = user_type;
        if (user_type) {
            // Tag every prompt with its match label and resort:
            //   match (0) → universal (1) → outside (2), then wire name.
            const tagged: SkillPrompt[] = [];
            for (const prompt of prompts) {
                const [, label] = _user_type_rank(prompt, user_type);
                tagged.push({ ...prompt, user_type_match: label });
            }
            prompts = _stableSort(tagged, (a, b) => {
                const ra = _user_type_rank(a, user_type)[0];
                const rb = _user_type_rank(b, user_type)[0];
                if (ra !== rb) {
                    return ra - rb;
                }
                return _strCmp(
                    to_mcp_prompt_meta(a).name as string,
                    to_mcp_prompt_meta(b).name as string,
                );
            });
        }
        this._prompts = prompts;
        this._errors = errors;
        this._index = new Map(
            prompts.map((p) => [to_mcp_prompt_meta(p).name as string, p]),
        );
    }

    /** Return cached prompts + errors, refreshing on mtime change. */
    get(): [SkillPrompt[], string[]] {
        const signature = this._current_signature();
        if (!_sigEqual(signature, this._signature)) {
            this._signature = signature;
            this._refresh();
        }
        return [this._prompts, this._errors];
    }

    /** Cached `(path, mtime)` tuples (Phase-6 F1 input). Call `get()` first. */
    get signature(): ReadonlyArray<readonly [string, number]> {
        return this._signature;
    }

    /** Currently resolved `personal.user_type` (or `""` if no filter). */
    get active_user_type(): string {
        return this._active_user_type;
    }

    /** Resolve an MCP wire name to its SkillPrompt, refreshing first. */
    lookup(wire_name: string): SkillPrompt | null {
        this.get();
        return this._index.get(wire_name) ?? null;
    }
}

/** Mirror Python `path.stat().st_mtime` (seconds, float). */
function _mtime(p: string): number {
    return fs.statSync(p).mtimeMs / 1000;
}

function _sigEqual(a: Array<[string, number]>, b: Array<[string, number]>): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i]![0] !== b[i]![0] || a[i]![1] !== b[i]![1]) {
            return false;
        }
    }
    return true;
}

/** Stable sort (Array.prototype.sort is spec-stable on modern V8; explicit for intent parity). */
function _stableSort<T>(arr: T[], cmp: (a: T, b: T) => number): T[] {
    return arr
        .map((v, i) => [v, i] as const)
        .sort((x, y) => {
            const c = cmp(x[0], y[0]);
            return c !== 0 ? c : x[1] - y[1];
        })
        .map((pair) => pair[0]);
}

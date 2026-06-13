// Session-profile overlay — recommendation-bias MVP.
//
// Implements the `runtime.active_packs` overlay locked in the
// session-profile-activation roadmap (Phase 0 decisions, 2026-06-02):
//
//   * The overlay is an **ephemeral** list of pack ids written to
//     `agents/settings/.agent-settings.local.yml` (gitignored, deepest layer),
//     never the committed settings file. It is a runtime modulation of the
//     existing `pack` axis, not a fifth axis (ADR-010 addendum).
//   * Activation resolves a token (a `session-profiles.yml` alias OR a raw
//     pack id) to a seed set, **fails fast** if a seed pack is not installed,
//     then expands the transitive `requires_hint` closure from `packs.yml`.
//   * Reads are **fail-open**: a corrupt / unparseable / schema-invalid overlay
//     is ignored and the full surface returns (the council's trust-boundary
//     requirement). Writes are **atomic** (tmp + rename).
//   * Deactivation is **explicit** (`/profile deactivate`) — option (a). There
//     is no silent `session_start` reset (the registry-refresh Catch-22); the
//     hook only emits a staleness *notice*.
//
// Surfacing rule (recommendation-bias): an artefact from the discovery
// manifest is surfaced when it is **core-trust** (or unscoped) — always shown
// — OR its `packs` intersect the active overlay. Execution is NOT gated.
//
// Pure functions are unit-testable; the `__main__` CLI is what the `/profile`
// command shells out to.
//
// Twin of `src/scripts/config/session_profiles.py`.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ESM-standard `require` shim. The bare `require` global is present when this
// module is *imported* (tsx injects it) but absent when the module is the
// directly-executed CLI entry; resolve it explicitly so the lazy yaml load
// works in both execution modes (mirrors Python's lazy `import yaml`).
const _require = createRequire(import.meta.url);

import {
    LOCAL_PROJECT_FILE,
    LOCAL_PROJECT_SUBDIR,
    find_project_root,
    load_agent_settings,
} from '../_lib/agent_settings.js';
import * as profile_explain from './profile_explain.js';

// `any` mirrors Python's `dict[str, Any]` heterogeneous manifest / overlay.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type Dict = Record<string, Any>;

// --- Paths -----------------------------------------------------------------

export const PACKS_VOCAB_REL = 'src/config/discovery/packs.yml';
export const ALIASES_REL = 'src/config/discovery/session-profiles.yml';
export const DISCOVERY_MANIFEST_REL = 'dist/discovery/discovery-manifest.json';

/** Dotted key the overlay lives under in the local settings file. */
export const OVERLAY_SECTION = 'runtime';
export const OVERLAY_KEY = 'active_packs';

/** Trust levels that are ALWAYS surfaced regardless of the active overlay. */
export const ALWAYS_TRUST_LEVELS: ReadonlySet<string> = new Set(['core']);

/** Raised for an unknown token or a not-installed pack (fail-fast). */
export class SessionProfileError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SessionProfileError';
    }
}

export class ActivationResult {
    readonly active_packs: readonly string[];
    readonly requested: readonly string[];
    readonly closure_added: readonly string[];
    readonly notes: readonly string[];

    constructor(params: {
        active_packs: readonly string[];
        requested: readonly string[];
        closure_added?: readonly string[];
        notes?: readonly string[];
    }) {
        this.active_packs = params.active_packs;
        this.requested = params.requested;
        this.closure_added = params.closure_added ?? [];
        this.notes = params.notes ?? [];
    }
}

export class SurfaceResult {
    active_packs: string[];
    shown: Dict[];
    hidden: Dict[];

    constructor(params: { active_packs: string[]; shown?: Dict[]; hidden?: Dict[] }) {
        this.active_packs = params.active_packs;
        this.shown = params.shown ?? [];
        this.hidden = params.hidden ?? [];
    }
}

// --- Loaders ---------------------------------------------------------------

function _read_yaml(p: string): Any {
    if (!_exists(p)) {
        return null;
    }
    let YAML: typeof import('yaml');
    try {
        // Lazy require mirrors Python's `import yaml` (yaml is None on failure).
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        YAML = _require('yaml') as typeof import('yaml');
    } catch {
        return null;
    }
    try {
        const text = fs.readFileSync(p, 'utf-8');
        const data = YAML.parse(text, { version: '1.1' });
        return data === undefined ? null : data;
    } catch {
        return null;
    }
}

/** Return `{pack_id: pack_dict}` from `packs.yml` (empty on failure). */
export function load_packs_vocab(repo_root: string): Record<string, Dict> {
    const data = _read_yaml(path.join(repo_root, PACKS_VOCAB_REL));
    if (!Array.isArray(data)) {
        return {};
    }
    const out: Record<string, Dict> = {};
    for (const entry of data) {
        if (_isPlainDict(entry) && (entry as Dict)['id']) {
            out[String((entry as Dict)['id'])] = entry as Dict;
        }
    }
    return out;
}

/** Return `{alias: [pack_id, ...]}` from `session-profiles.yml`. */
export function load_aliases(repo_root: string): Record<string, string[]> {
    const data = _read_yaml(path.join(repo_root, ALIASES_REL));
    if (!_isPlainDict(data)) {
        return {};
    }
    const aliases = (data as Dict)['aliases'];
    if (!_isPlainDict(aliases)) {
        return {};
    }
    const out: Record<string, string[]> = {};
    for (const name of Object.keys(aliases as Dict)) {
        const packs = (aliases as Dict)[name];
        if (Array.isArray(packs)) {
            out[String(name)] = packs.map((p) => String(p));
        }
    }
    return out;
}

/**
 * The set of pack ids treated as installed.
 *
 * Source of truth: the top-level `packs:` block injected into the settings
 * file at install time. When absent (e.g. the maintainer repo, or a base-only
 * install) the **full vocabulary** is treated as available — every pack's
 * artefacts are present on disk there.
 */
export function installed_packs(repo_root: string, settings: Dict | null = null): Set<string> {
    if (settings === null) {
        settings = load_agent_settings({ cwd: repo_root });
    }
    const declared = settings['packs'];
    if (Array.isArray(declared) && declared.length > 0) {
        return new Set(declared.map((p) => String(p)));
    }
    return new Set(Object.keys(load_packs_vocab(repo_root)));
}

// --- Closure + token resolution -------------------------------------------

/**
 * Transitive `requires` closure of `seeds`, sorted, deduped.
 *
 * Reads the canonical `requires` graph (capability-packs.md), falling back to
 * the legacy `requires_hint` name during the deprecation window.
 */
export function expand_closure(
    seeds: string[] | Set<string>,
    vocab: Record<string, Dict>,
): string[] {
    const seen = new Set<string>();
    const stack: string[] = [...seeds];
    while (stack.length > 0) {
        const pid = stack.pop() as string;
        if (seen.has(pid)) {
            continue;
        }
        seen.add(pid);
        const entry = vocab[pid] ?? {};
        const deps = entry['requires'] ?? entry['requires_hint'] ?? [];
        if (Array.isArray(deps)) {
            for (const dep of deps) {
                if (!seen.has(String(dep))) {
                    stack.push(String(dep));
                }
            }
        }
    }
    return _sorted([...seen]);
}

/**
 * Resolve activation tokens (alias names or pack ids) to a seed pack set.
 *
 * Raises `SessionProfileError` for a token that is neither a known alias nor a
 * known pack id.
 */
export function resolve_tokens(
    tokens: string[],
    vocab: Record<string, Dict>,
    aliases: Record<string, string[]>,
): string[] {
    const seeds = new Set<string>();
    for (const token of tokens) {
        if (Object.prototype.hasOwnProperty.call(aliases, token)) {
            for (const p of aliases[token]!) {
                seeds.add(p);
            }
        } else if (Object.prototype.hasOwnProperty.call(vocab, token)) {
            seeds.add(token);
        } else {
            const known = _sorted([...new Set([...Object.keys(aliases), ...Object.keys(vocab)])]);
            throw new SessionProfileError(
                `unknown profile/pack '${token}'. Known: ${known.join(', ')}`,
            );
        }
    }
    return _sorted([...seeds]);
}

// --- Overlay read / write (fail-open read, atomic write) -------------------

function _overlay_path(repo_root: string): string {
    return path.join(repo_root, ...LOCAL_PROJECT_SUBDIR, LOCAL_PROJECT_FILE);
}

/**
 * Return the active pack list. **Fail-open**: any problem → `[]`.
 *
 * Schema: `runtime.active_packs` must be a list of strings. Anything else
 * (missing, wrong type, unparseable file) yields an empty list so a corrupt
 * overlay never hides the full surface.
 */
export function read_overlay(repo_root: string): string[] {
    const data = _read_yaml(_overlay_path(repo_root));
    if (!_isPlainDict(data)) {
        return [];
    }
    const runtime = (data as Dict)[OVERLAY_SECTION];
    if (!_isPlainDict(runtime)) {
        return [];
    }
    const packs = (runtime as Dict)[OVERLAY_KEY];
    if (!Array.isArray(packs)) {
        return [];
    }
    // Python: `[str(p) for p in packs if isinstance(p, (str, int))]`. Python
    // `bool` is a subclass of `int`, so booleans pass and stringify to
    // 'True' / 'False'.
    const out: string[] = [];
    for (const p of packs) {
        if (typeof p === 'string') {
            out.push(p);
        } else if (typeof p === 'boolean') {
            out.push(p ? 'True' : 'False');
        } else if (typeof p === 'number' && Number.isInteger(p)) {
            out.push(String(p));
        }
    }
    return out;
}

/** Atomic write of the whole local settings dict (tmp + rename). */
function _write_local(repo_root: string, data: Dict): void {
    const p = _overlay_path(repo_root);
    const parent = path.dirname(p);
    fs.mkdirSync(parent, { recursive: true });
    const header =
        '# Per-machine local overrides (gitignored, deepest-winning layer).\n' +
        '# `runtime.active_packs` is the EPHEMERAL session-profile overlay —\n' +
        '# managed by `/profile`. Delete the key (or this file) to reset.\n';
    let YAML: typeof import('yaml') | null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        YAML = _require('yaml') as typeof import('yaml');
    } catch {
        YAML = null;
    }
    // PyYAML `safe_dump(data, sort_keys=False, default_flow_style=False)`.
    const body = YAML ? _pySafeDumpBlock(data) : '';
    // mkstemp(dir=parent, prefix=..., suffix=.tmp) + os.replace.
    let fd: number | null = null;
    let tmp = '';
    for (let attempt = 0; attempt < 32; attempt += 1) {
        tmp = path.join(
            parent,
            `.agent-settings.local.${crypto.randomBytes(6).toString('hex')}.tmp`,
        );
        try {
            fd = fs.openSync(tmp, 'wx', 0o600);
            break;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
            throw err;
        }
    }
    if (fd === null) {
        throw new Error('could not create a unique temp file');
    }
    try {
        fs.writeSync(fd, header);
        fs.writeSync(fd, body);
        fs.closeSync(fd);
        fd = null;
        fs.renameSync(tmp, p);
    } finally {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            } catch {
                /* already closed */
            }
        }
        if (fs.existsSync(tmp)) {
            fs.unlinkSync(tmp);
        }
    }
}

/** Set `runtime.active_packs` to `packs` (atomic), preserving other keys. */
export function set_overlay(repo_root: string, packs: string[]): void {
    let data = _read_yaml(_overlay_path(repo_root));
    if (!_isPlainDict(data)) {
        data = {};
    }
    const dataDict = data as Dict;
    let runtime = dataDict[OVERLAY_SECTION];
    if (!_isPlainDict(runtime)) {
        runtime = {};
    }
    const runtimeDict = runtime as Dict;
    if (packs.length > 0) {
        runtimeDict[OVERLAY_KEY] = _sorted([...new Set(packs)]);
        dataDict[OVERLAY_SECTION] = runtimeDict;
    } else {
        delete runtimeDict[OVERLAY_KEY];
        if (Object.keys(runtimeDict).length > 0) {
            dataDict[OVERLAY_SECTION] = runtimeDict;
        } else {
            delete dataDict[OVERLAY_SECTION];
        }
    }
    _write_local(repo_root, dataDict);
}

export function clear_overlay(repo_root: string): void {
    set_overlay(repo_root, []);
}

// --- High-level operations -------------------------------------------------

/**
 * Resolve + validate + expand + write the overlay for `tokens`.
 *
 * Fail-fast (raises `SessionProfileError`) when a resolved seed pack is not
 * installed.
 */
export function activate(
    repo_root: string,
    tokens: string[],
    settings: Dict | null = null,
): ActivationResult {
    const vocab = load_packs_vocab(repo_root);
    const aliases = load_aliases(repo_root);
    const seeds = resolve_tokens(tokens, vocab, aliases);
    const inst = installed_packs(repo_root, settings);
    const missing = seeds.filter((p) => !inst.has(p));
    if (missing.length > 0) {
        throw new SessionProfileError(
            `not installed: ${_sorted(missing).join(', ')}. ` +
                'Install the pack first (it is not in your settings `packs:` list).',
        );
    }
    const closure = expand_closure(seeds, vocab);
    // Closure members must also be installed; drop + note any that are not
    // (defensive — a misconfigured requires_hint should not block activation).
    const usable = closure.filter((p) => inst.has(p));
    const dropped = closure.filter((p) => !inst.has(p));
    set_overlay(repo_root, usable);
    const notes: string[] = [];
    if (dropped.length > 0) {
        notes.push(`closure deps not installed, skipped: ${_sorted(dropped).join(', ')}`);
    }
    const seedSet = new Set(seeds);
    const added = _sorted(usable.filter((p) => !seedSet.has(p)));
    return new ActivationResult({
        active_packs: _sorted(usable),
        requested: [...tokens],
        closure_added: added,
        notes,
    });
}

/**
 * Clear the overlay (no tokens) or remove the named packs from it.
 *
 * Returns the resulting active pack list. With `tokens`, only the named packs
 * *themselves* are removed from the flat active set — never their transitive
 * closure. A shared dependency therefore survives as long as it is its own
 * entry in the overlay (e.g. deactivating `laravel` while `php` is active
 * leaves both `php` and `engineering-base` in place). This is the safe,
 * predictable behaviour for a flat pack overlay: removing a pack only ever
 * *widens* the surface, never hides something a remaining pack needs.
 */
export function deactivate(repo_root: string, tokens: string[] | null = null): string[] {
    if (!tokens || tokens.length === 0) {
        clear_overlay(repo_root);
        return [];
    }
    const vocab = load_packs_vocab(repo_root);
    const aliases = load_aliases(repo_root);
    const to_remove = new Set(resolve_tokens(tokens, vocab, aliases));
    const current = new Set(read_overlay(repo_root));
    const new_active = _sorted([...current].filter((p) => !to_remove.has(p)));
    set_overlay(repo_root, new_active);
    return new_active;
}

// --- Surface filter (recommendation-bias) ----------------------------------

export function load_manifest(repo_root: string): Dict[] {
    const p = path.join(repo_root, DISCOVERY_MANIFEST_REL);
    if (!_exists(p)) {
        return [];
    }
    let data: Any;
    try {
        data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
        return [];
    }
    const arts = _isPlainDict(data) ? (data as Dict)['artefacts'] : undefined;
    return Array.isArray(arts) ? (arts as Dict[]) : [];
}

/** Core-trust or unscoped artefacts are always surfaced. */
export function is_always_shown(artefact: Dict): boolean {
    const packs = artefact['packs'] ?? [];
    if (!Array.isArray(packs) || packs.length === 0) {
        return true;
    }
    const trust = artefact['trust'];
    const level = _isPlainDict(trust) ? (trust as Dict)['level'] : undefined;
    return level !== undefined && level !== null && ALWAYS_TRUST_LEVELS.has(level);
}

export function is_surfaced(artefact: Dict, active: Set<string>): boolean {
    if (active.size === 0) {
        return true; // no overlay → everything surfaces
    }
    if (is_always_shown(artefact)) {
        return true;
    }
    const packs = artefact['packs'] ?? [];
    if (!Array.isArray(packs)) {
        return false;
    }
    return packs.some((p) => active.has(p as string));
}

/** Split manifest artefacts into shown / hidden for the active overlay. */
export function compute_surface(
    repo_root: string,
    options: { category?: string | null; active?: string[] | null } = {},
): SurfaceResult {
    const category = options.category ?? null;
    let active = options.active ?? null;
    if (active === null) {
        active = read_overlay(repo_root);
    }
    const active_set = new Set(active);
    const result = new SurfaceResult({ active_packs: _sorted([...active_set]) });
    for (const art of load_manifest(repo_root)) {
        if (category && art['category'] !== category) {
            continue;
        }
        if (art['category'] !== 'command' && art['category'] !== 'skill') {
            continue;
        }
        const slim: Dict = {
            name: art['name'] ?? null,
            category: art['category'] ?? null,
            packs: art['packs'] ?? [],
        };
        if (is_surfaced(art, active_set)) {
            result.shown.push(slim);
        } else {
            result.hidden.push(slim);
        }
    }
    return result;
}

/**
 * Return the `session_start` staleness notice, or `null` if no overlay.
 *
 * Implements option (a)'s companion: the overlay survives a restart, so on a
 * new session we *remind* (never silently reset).
 */
export function stale_notice(repo_root: string): string | null {
    const active = read_overlay(repo_root);
    if (active.length === 0) {
        return null;
    }
    return (
        `profile still active from a previous session: ${active.join(', ')} ` +
        '— `/profile deactivate` to clear, `/profile show` for details.'
    );
}

/**
 * Deterministic, template-based plain-language render of `show` state for a
 * non-technical employee. NEVER LLM-generated, never names a hidden pack (no
 * leak / hallucination surface) — a pure function of the `show` JSON, so the
 * golden tests fully pin it. Staleness is rendered as PERSISTENCE, not an
 * age-in-days: the overlay carries no timestamp and adding one would change
 * overlay semantics (out of scope — see the contract addendum).
 */
export function format_plain_status(
    active: string[],
    commands_shown: number,
    skills_shown: number,
    hidden_total: number,
): string {
    if (active.length === 0) {
        return (
            'No profile is active — you see the full surface: every command and ' +
            'skill is available.'
        );
    }
    return [
        `Profile active: ${active.join(', ')}.`,
        `You'll see ${commands_shown} commands and ${skills_shown} skills.`,
        `${hidden_total} item(s) are hidden behind packs you haven't turned on — ` +
            "that's what changed vs the full surface.",
        'This overlay persists across sessions until you run `/profile deactivate`.',
    ].join('\n');
}

// --- CLI -------------------------------------------------------------------

function _repo_root(arg: string | null): string {
    if (arg) {
        return path.resolve(arg);
    }
    const found = find_project_root(process.cwd());
    return found ?? process.cwd();
}

/** Parsed-args shape for the session_profiles CLI. */
interface ParsedArgs {
    cmd: string;
    root: string | null;
    json: boolean;
    tokens: string[];
    plain: boolean;
    category: string | null;
    mode: string;
}

/**
 * Minimal argparse-equivalent for the session_profiles CLI. Honors the shared
 * `--root` / `--json` flags both before AND after the subcommand (argparse
 * `parents=[common]` behaviour), the subcommand-specific flags, and the
 * `required` subcommand. Throws `CliUsageError` on a usage problem so `main`
 * maps it to argparse's exit code 2.
 */
class CliUsageError extends Error {}

function _parse_args(argv: string[]): ParsedArgs {
    const SUBCOMMANDS = ['activate', 'deactivate', 'show', 'surface', 'stale-notice', 'explain'];
    const parsed: ParsedArgs = {
        cmd: '',
        root: null,
        json: false,
        tokens: [],
        plain: false,
        category: null,
        mode: 'plain',
    };
    let cmd: string | null = null;
    const positionals: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '--root') {
            const next = argv[i + 1];
            if (next === undefined) {
                throw new CliUsageError('argument --root: expected one argument');
            }
            parsed.root = next;
            i += 2;
            continue;
        }
        if (tok.startsWith('--root=')) {
            parsed.root = tok.slice('--root='.length);
            i += 1;
            continue;
        }
        if (tok === '--json') {
            parsed.json = true;
            i += 1;
            continue;
        }
        if (tok === '--plain') {
            parsed.plain = true;
            i += 1;
            continue;
        }
        if (tok === '--category') {
            const next = argv[i + 1];
            if (next === undefined) {
                throw new CliUsageError('argument --category: expected one argument');
            }
            if (next !== 'command' && next !== 'skill') {
                throw new CliUsageError(
                    `argument --category: invalid choice: '${next}'`,
                );
            }
            parsed.category = next;
            i += 2;
            continue;
        }
        if (tok.startsWith('--category=')) {
            const v = tok.slice('--category='.length);
            if (v !== 'command' && v !== 'skill') {
                throw new CliUsageError(`argument --category: invalid choice: '${v}'`);
            }
            parsed.category = v;
            i += 1;
            continue;
        }
        if (tok === '--mode') {
            const next = argv[i + 1];
            if (next === undefined) {
                throw new CliUsageError('argument --mode: expected one argument');
            }
            if (next !== 'plain' && next !== 'technical') {
                throw new CliUsageError(`argument --mode: invalid choice: '${next}'`);
            }
            parsed.mode = next;
            i += 2;
            continue;
        }
        if (tok.startsWith('--mode=')) {
            const v = tok.slice('--mode='.length);
            if (v !== 'plain' && v !== 'technical') {
                throw new CliUsageError(`argument --mode: invalid choice: '${v}'`);
            }
            parsed.mode = v;
            i += 1;
            continue;
        }
        if (tok.startsWith('-') && tok !== '-') {
            throw new CliUsageError(`unrecognized arguments: ${tok}`);
        }
        if (cmd === null) {
            if (!SUBCOMMANDS.includes(tok)) {
                throw new CliUsageError(`invalid choice: '${tok}'`);
            }
            cmd = tok;
        } else {
            positionals.push(tok);
        }
        i += 1;
    }
    if (cmd === null) {
        throw new CliUsageError('the following arguments are required: cmd');
    }
    parsed.cmd = cmd;
    // activate requires >=1 token; deactivate accepts 0+.
    if (cmd === 'activate' && positionals.length < 1) {
        throw new CliUsageError('the following arguments are required: tokens');
    }
    parsed.tokens = positionals;
    return parsed;
}

export function main(argv: string[] | null = null): number {
    let args: ParsedArgs;
    try {
        args = _parse_args(argv ?? process.argv.slice(2));
    } catch (exc) {
        if (exc instanceof CliUsageError) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
    const root = _repo_root(args.root);

    try {
        if (args.cmd === 'activate') {
            const res = activate(root, args.tokens);
            const payload = {
                active_packs: [...res.active_packs],
                requested: [...res.requested],
                closure_added: [...res.closure_added],
                notes: [...res.notes],
            };
            if (args.json) {
                process.stdout.write(_jsonDumps(payload) + '\n');
            } else {
                process.stdout.write(
                    `activated: ${res.active_packs.join(', ') || '(none)'}\n`,
                );
                if (res.closure_added.length > 0) {
                    process.stdout.write(`  + closure: ${res.closure_added.join(', ')}\n`);
                }
                for (const n of res.notes) {
                    process.stdout.write(`  note: ${n}\n`);
                }
            }
            return 0;
        }

        if (args.cmd === 'deactivate') {
            const active = deactivate(root, args.tokens.length > 0 ? args.tokens : null);
            if (args.json) {
                process.stdout.write(_jsonDumps({ active_packs: active }) + '\n');
            } else {
                process.stdout.write(
                    `active now: ${active.join(', ') || '(none — full surface)'}\n`,
                );
            }
            return 0;
        }

        if (args.cmd === 'show') {
            const active = read_overlay(root);
            const surf = compute_surface(root, { active });
            const cmds_shown = surf.shown.filter((a) => a['category'] === 'command').length;
            const skills_shown = surf.shown.filter((a) => a['category'] === 'skill').length;
            if (args.plain) {
                process.stdout.write(
                    format_plain_status(active, cmds_shown, skills_shown, surf.hidden.length) +
                        '\n',
                );
                return 0;
            }
            if (args.json) {
                process.stdout.write(
                    _jsonDumps({
                        active_packs: active,
                        shown_total: surf.shown.length,
                        hidden_total: surf.hidden.length,
                        commands_shown: cmds_shown,
                        skills_shown: skills_shown,
                    }) + '\n',
                );
            } else if (active.length === 0) {
                process.stdout.write('no profile active — full surface (everything shown).\n');
            } else {
                process.stdout.write(`active packs: ${active.join(', ')}\n`);
                process.stdout.write(
                    `surfaced: ${cmds_shown} commands, ${skills_shown} skills ` +
                        `(${surf.hidden.length} hidden behind inactive packs)\n`,
                );
            }
            return 0;
        }

        if (args.cmd === 'explain') {
            const active = read_overlay(root);
            const surf = compute_surface(root, { active });
            const cmds_shown = surf.shown.filter((a) => a['category'] === 'command').length;
            const skills_shown = surf.shown.filter((a) => a['category'] === 'skill').length;
            const env = profile_explain.build_profile_envelope(
                active,
                cmds_shown,
                skills_shown,
                surf.hidden.length,
            );
            if (args.json) {
                process.stdout.write(_jsonDumps(env) + '\n');
            } else {
                process.stdout.write(
                    profile_explain.render_profile_overlay(env, args.mode) + '\n',
                );
            }
            return 0;
        }

        if (args.cmd === 'surface') {
            const surf = compute_surface(root, { category: args.category });
            if (args.json) {
                process.stdout.write(
                    _jsonDumps({
                        active_packs: surf.active_packs,
                        shown: surf.shown,
                        hidden: surf.hidden,
                    }) + '\n',
                );
            } else {
                process.stdout.write(`active: ${surf.active_packs.join(', ') || '(none)'}\n`);
                process.stdout.write(`shown (${surf.shown.length}):\n`);
                for (const a of surf.shown) {
                    process.stdout.write(`  + ${a['category']}/${a['name']}\n`);
                }
                process.stdout.write(`hidden (${surf.hidden.length}):\n`);
                for (const a of surf.hidden) {
                    const packsList = Array.isArray(a['packs']) ? a['packs'] : [];
                    process.stdout.write(
                        `  - ${a['category']}/${a['name']} [${packsList.join(',')}]\n`,
                    );
                }
            }
            return 0;
        }

        if (args.cmd === 'stale-notice') {
            const notice = stale_notice(root);
            if (notice) {
                process.stdout.write(notice + '\n');
            }
            return 0;
        }
    } catch (exc) {
        if (exc instanceof SessionProfileError) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    return 0;
}

// --- parity primitives -----------------------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isPlainDict(value: Any): value is Dict {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Map)
    );
}

/** Python `sorted()` — code-point comparison for strings (no locale). */
function _sorted(items: string[]): string[] {
    return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Python `json.dumps(obj)` (default separators `(', ', ': ')`, no indent). */
function _jsonDumps(obj: Any): string {
    function enc(value: Any): string {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return _encStr(value);
        if (Array.isArray(value)) {
            return '[' + value.map((v) => enc(v)).join(', ') + ']';
        }
        const keys = Object.keys(value as Dict);
        return (
            '{' +
            keys.map((k) => _encStr(k) + ': ' + enc((value as Dict)[k])).join(', ') +
            '}'
        );
    }
    return enc(obj);
}

/** json.dumps string encoder — ensure_ascii=True. */
function _encStr(s: string): string {
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

// --- PyYAML safe_dump (block style, sort_keys=False, default_flow_style=False)

/**
 * Faithful subset of `yaml.safe_dump(data, sort_keys=False,
 * default_flow_style=False)` for the overlay shapes this module emits
 * (nested mappings, string/number/bool/null scalars, lists of scalars or
 * mappings, empty `{}` / `[]`). Reproduces PyYAML's block-style layout and
 * the implicit-resolver scalar quoting (a plain scalar that would re-read as
 * a non-string gets single-quoted).
 */
function _pySafeDumpBlock(data: Dict): string {
    const lines: string[] = [];
    _emitMapping(data, 0, lines);
    if (lines.length === 0) {
        // Empty top-level mapping → `{}` (PyYAML).
        return '{}\n';
    }
    return lines.join('\n') + '\n';
}

function _emitMapping(map: Dict, indent: number, lines: string[]): void {
    const pad = ' '.repeat(indent);
    for (const key of Object.keys(map)) {
        const value = map[key];
        const keyStr = _scalarToken(String(key));
        if (Array.isArray(value)) {
            if (value.length === 0) {
                lines.push(`${pad}${keyStr}: []`);
            } else {
                lines.push(`${pad}${keyStr}:`);
                _emitSequence(value, indent, lines);
            }
        } else if (_isPlainDict(value)) {
            if (Object.keys(value as Dict).length === 0) {
                lines.push(`${pad}${keyStr}: {}`);
            } else {
                lines.push(`${pad}${keyStr}:`);
                _emitMapping(value as Dict, indent + 2, lines);
            }
        } else {
            lines.push(`${pad}${keyStr}: ${_scalarToken(_pyScalar(value))}`);
        }
    }
}

function _emitSequence(seq: Any[], indent: number, lines: string[]): void {
    // PyYAML block sequence under a mapping key sits at the SAME indent as the
    // key (the `- ` dash aligns with the key, items continue at indent+2).
    const pad = ' '.repeat(indent);
    for (const item of seq) {
        if (Array.isArray(item)) {
            if (item.length === 0) {
                lines.push(`${pad}- []`);
            } else {
                lines.push(`${pad}-`);
                _emitSequence(item, indent + 2, lines);
            }
        } else if (_isPlainDict(item)) {
            if (Object.keys(item as Dict).length === 0) {
                lines.push(`${pad}- {}`);
            } else {
                // First key sits on the dash line; the rest indent by 2.
                const keys = Object.keys(item as Dict);
                const sub: string[] = [];
                _emitMapping(item as Dict, indent + 2, sub);
                // sub[0] looks like `${indent+2}firstKey: ...`; strip its pad
                // and prefix `- ` at the parent indent.
                const firstTrimmed = sub[0]!.slice(indent + 2);
                lines.push(`${pad}- ${firstTrimmed}`);
                for (let j = 1; j < sub.length; j += 1) {
                    lines.push(sub[j]!);
                }
                void keys;
            }
        } else {
            lines.push(`${pad}- ${_scalarToken(_pyScalar(item))}`);
        }
    }
}

/** Python scalar → its plain string form before quoting (str/int/float/bool/null). */
function _pyScalar(value: Any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        // Integral floats keep their int form here; PyYAML emits `1.5` for
        // floats and `1` for ints. JS cannot distinguish int 1 from float 1.0,
        // but the overlay never carries floats, so plain `String` is faithful.
        return String(value);
    }
    return String(value);
}

// Implicit-resolver patterns (PyYAML resolver), anchored — a plain string
// matching any of these would re-read as a non-string, so it gets quoted.
const _BOOL_RE =
    /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/;
const _NULL_RE = /^(?:~|null|Null|NULL|)$/;
const _FLOAT_RE =
    /^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;
const _INT_RE =
    /^(?:[-+]?0b[0-1_]+|[-+]?0[0-7_]+|[-+]?(?:0|[1-9][0-9_]*)|[-+]?0x[0-9a-fA-F_]+|[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$/;
const _TIMESTAMP_RE =
    /^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]|[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?(?:[Tt]|[ \t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$/;

/** A scalar token, single-quoted when a plain emit would re-resolve to non-str. */
function _scalarToken(value: string): string {
    if (value === '') {
        return "''";
    }
    // Special characters that force quoting in block context (subset: the
    // overlay only ever emits plain identifiers, paths, and the literals
    // produced by `_pyScalar`).
    const needsQuoteSpecial =
        /[:#\[\]{}&*!|>'"%@`,]/.test(value) ||
        value.startsWith(' ') ||
        value.endsWith(' ') ||
        value.includes('\n');
    const reResolvesNonStr =
        _BOOL_RE.test(value) ||
        _NULL_RE.test(value) ||
        _FLOAT_RE.test(value) ||
        _INT_RE.test(value) ||
        _TIMESTAMP_RE.test(value);
    if (needsQuoteSpecial || reResolvesNonStr) {
        // Single-quoted style (PyYAML default for these): double inner quotes.
        return `'${value.replace(/'/g, "''")}'`;
    }
    return value;
}

// --- entrypoint ------------------------------------------------------------

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

/**
 * Locate artefact source roots across the monorepo physical layout.
 *
 * TypeScript twin of `src/scripts/_lib/agent_src.py` (ADR-089, Phase 2
 * Wave 2a). The public API mirrors the Python module EXACTLY — same
 * exported snake_case names, same root ordering, same logical-relpath
 * computation, same first-win precedence when a logical path resolves
 * across multiple roots, and the same error behaviour
 * (`logical_relpath` throws when a path is under no known root; the
 * collision guard in `_root_specs` throws on duplicate non-empty
 * prefixes). No behaviour changes — latent bugs replicated.
 *
 * Phase 4 of the monorepo migration (ADR-017) physically moves source
 * artefacts out of the flat `.agent-src.uncondensed/` directory into
 * `packages/core/.agent-src.uncondensed/` and
 * `packages/pack-*\/.agent-src.uncondensed/` trees. This helper hides
 * that decision from every scanner so they keep working pre-move and
 * post-move with the same call shape.
 *
 * Contract:
 *
 * - `artefact_roots()` returns every directory that contains source
 *   `.md` artefacts. Pre-move that is `.agent-src.uncondensed/` at
 *   the repo root. Post-move it is every `packages/*\/.agent-src.uncondensed/`.
 *   Both can coexist during the migration window.
 * - `iter_artefacts()` yields every source `.md` path under those roots.
 * - `logical_relpath(p)` returns the artefact's stable identity path
 *   (e.g. `skills/laravel/SKILL.md`), independent of which physical
 *   root contains it. This is what manifests, hash maps, and projections
 *   use as the artefact key.
 * - `strip_source_prefix(p)` returns the same as `logical_relpath`
 *   but accepts repo-relative POSIX strings (used by the condenseor's
 *   output-path computation and the LEGACY_SRC_PREFIX logic).
 *
 * Path handling note: the Python original uses `pathlib.Path` objects.
 * This twin uses absolute POSIX path strings as the `Path` equivalent
 * (the host filesystem on the supported platforms is POSIX). All public
 * functions that the Python original typed as `Path` accept/return
 * strings here; semantics — `.relative_to`, `.as_posix`, `.resolve`,
 * `.rglob`, `.is_dir`, `.is_file`, `.exists` — are reproduced via the
 * helpers below.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Path-root configuration (mutable to mirror Python module attributes) ----
//
// The Python original derives ROOT from `Path(__file__).resolve().parents[3]`
// and every other root from it as module-level constants. Tests in
// `tests/test_agent_src_domains.py` reassign `agent_src.SRC_DOMAINS` directly
// and clear `agent_src._slug_prefix_cache` to point the resolver at a tmp
// tree. To preserve that test-injection surface AND the constant-derivation
// fidelity, the roots live in a mutable config object whose getters the rest
// of the module reads through; tests mutate the same object.

const _HERE = path.dirname(fileURLToPath(import.meta.url));
// _HERE === <repo>/src/scripts/_lib ; parents[3] of the .py file (src/scripts/
// _lib/agent_src.py) is the repo root — three dirs up from _lib.
const _DEFAULT_ROOT = path.resolve(_HERE, '..', '..', '..');

/**
 * Mutable root configuration. The exported `ROOT` / `LEGACY_SRC` / … getters
 * read these so a test can override (e.g. `setRoots({ SRC_DOMAINS: tmp })`)
 * exactly as the Python tests reassign `agent_src.SRC_DOMAINS`.
 */
interface RootConfig {
    ROOT: string;
    LEGACY_SRC: string;
    PACKAGES: string;
    PACKAGE_CORE: string;
    SRC: string;
    SRC_SKILLS: string;
    SRC_RULES: string;
    SRC_AGENT: string;
    SRC_DOMAINS: string;
}

function _deriveRoots(root: string): RootConfig {
    const packages = path.join(root, 'packages');
    const src = path.join(root, 'src');
    return {
        ROOT: root,
        LEGACY_SRC: path.join(root, '.agent-src.uncondensed'),
        PACKAGES: packages,
        PACKAGE_CORE: path.join(packages, 'core'),
        SRC: src,
        SRC_SKILLS: path.join(src, 'skills'),
        SRC_RULES: path.join(src, 'rules'),
        SRC_AGENT: path.join(src, 'agent-src'),
        SRC_DOMAINS: path.join(src, 'domains'),
    };
}

const _roots: RootConfig = _deriveRoots(_DEFAULT_ROOT);

/**
 * Test seam mirroring the Python tests' direct attribute reassignment
 * (`agent_src.SRC_DOMAINS = tmp_path`). Reassigns the named roots and
 * clears the slug-prefix cache (mirrors `_with_tmp_domains`). Pass a
 * partial config; unspecified roots keep their current values. Not part
 * of the Python surface — a TS-only injection point.
 */
export function _setRootsForTest(overrides: Partial<RootConfig>): void {
    Object.assign(_roots, overrides);
    _slug_prefix_cache.clear();
}

/** Snapshot the current root config (for save/restore in tests). */
export function _getRootsForTest(): RootConfig {
    return { ..._roots };
}

// Read-only accessors mirroring the Python module-level constants. Functions,
// not `const`, because the underlying `_roots` is mutable per the test seam.
export const ROOT = (): string => _roots.ROOT;
export const LEGACY_SRC = (): string => _roots.LEGACY_SRC;
export const PACKAGES = (): string => _roots.PACKAGES;
export const PACKAGE_CORE = (): string => _roots.PACKAGE_CORE;
export const SRC = (): string => _roots.SRC;
export const SRC_SKILLS = (): string => _roots.SRC_SKILLS;
export const SRC_RULES = (): string => _roots.SRC_RULES;
export const SRC_AGENT = (): string => _roots.SRC_AGENT;
export const SRC_DOMAINS = (): string => _roots.SRC_DOMAINS;

const _SRC_DOMAINS_PREFIX = 'src/domains/';

// --- Filesystem helpers reproducing pathlib semantics ------------------------

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

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Sorted immediate child directory entries (mirrors `sorted(p.iterdir())`). */
function _iterdirSorted(p: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(p);
    } catch {
        return [];
    }
    // Python sorts Path objects by their full string form; for a flat listing
    // that is equivalent to sorting the child basenames, which all share the
    // same parent prefix. Sort basenames for the same order, return abs paths.
    names.sort();
    return names.map((name) => path.join(p, name));
}

/**
 * Mirror `root.rglob(pattern)` returning a SORTED list of absolute path
 * strings. Python's `rglob` yields every descendant (files and dirs) whose
 * name matches the glob; the callers here always sort the result, so this
 * helper sorts by the same POSIX-string key Python uses.
 *
 * `pattern` is either `"*"` (everything) or `"*<suffix>"` / `"*.md"` style
 * suffix glob; only those shapes are used by this module.
 */
function _rglobSorted(root: string, pattern: string): string[] {
    const out: string[] = [];
    const suffix = pattern === '*' ? null : pattern.slice(1); // drop leading '*'
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
            // Recurse into directories. `isDirectory()` on a Dirent does not
            // follow symlinks; pathlib.rglob follows directory symlinks. Use a
            // stat-based dir check to match Python's traversal, but guard
            // against unreadable entries.
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    // Sort by POSIX string (paths already use the platform separator; on POSIX
    // hosts that equals the as_posix form Python sorts by).
    out.sort();
    return out;
}

/** POSIX relative path of `child` under `root` (mirrors `relative_to().as_posix()`). */
function _relativeToPosix(child: string, root: string): string {
    const rel = path.relative(root, child);
    return rel.split(path.sep).join('/');
}

/**
 * `true` when `child` is at or below `root` (mirrors `Path.relative_to` not
 * raising). `path.relative` returns a `..`-leading or absolute path when
 * `child` is outside `root`.
 */
function _isUnder(child: string, root: string): boolean {
    const rel = path.relative(root, child);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// --- src/domains command mapping ---------------------------------------------

/**
 * Map a physical `src/domains` command file to its logical path.
 *
 * `src/domains/<pack>/<subpath...>/command.md` → `commands/<subpath...>.md`.
 * Returns `null` for anything that is not a `command.md` leaf with at least
 * one verb segment after the pack.
 *
 * Mirrors `_domains_command_logical`. `p` is an absolute path string.
 */
export function _domains_command_logical(p: string): string | null {
    const dom = _roots.SRC_DOMAINS;
    if (p !== dom && !_isUnder(p, dom)) {
        return null;
    }
    const rel = _relativeToPosix(p, dom);
    const parts = rel.split('/');
    if (parts.length < 3 || parts[parts.length - 1] !== 'command.md') {
        return null;
    }
    const subpath = parts.slice(1, -1).join('/'); // drop <pack> and command.md
    return `commands/${subpath}.md`;
}

/**
 * Yield `[physical_path, logical_relpath]` for every domains command, in
 * deterministic order. Naturally inert until `src/domains/*\/**\/command.md`
 * files exist. Mirrors `_iter_domains_commands`.
 */
export function* _iter_domains_commands(): Generator<[string, string]> {
    const dom = _roots.SRC_DOMAINS;
    if (!_isDir(dom)) {
        return;
    }
    for (const p of _rglobSorted(dom, 'command.md')) {
        if (!_isFile(p)) {
            continue;
        }
        const logical = _domains_command_logical(p);
        if (logical !== null) {
            yield [p, logical];
        }
    }
}

// --- Canonical command-slug derivation (ADR-044 amendment) -------------------

const _SLUG_PREFIX_RE = /^slug_prefix:\s*"?([a-z][a-z0-9-]*)"?\s*$/m;
const _slug_prefix_cache: Map<string, string> = new Map();

/**
 * Return the `slug_prefix` declared in `src/domains/<pack>/pack.yaml`.
 *
 * Empty string when the pack has no prefix (the default) or no manifest.
 * Cached per pack id. Minimal line scan — no YAML dependency. Mirrors
 * `pack_slug_prefix`.
 */
export function pack_slug_prefix(pack_id: string): string {
    const cached = _slug_prefix_cache.get(pack_id);
    if (cached !== undefined) {
        return cached;
    }
    let prefix = '';
    const manifest = path.join(_roots.SRC_DOMAINS, pack_id, 'pack.yaml');
    if (_isFile(manifest)) {
        const m = _SLUG_PREFIX_RE.exec(fs.readFileSync(manifest, 'utf-8'));
        if (m) {
            prefix = m[1] as string;
        }
    }
    _slug_prefix_cache.set(pack_id, prefix);
    return prefix;
}

/**
 * Canonical flat slug for a `src/domains` command file.
 *
 * `src/domains/<pack>/<subpath>/command.md` → `<subpath hyphenated>`,
 * pack-prefixed when the pack declares `slug_prefix`. Returns `null` for
 * anything that is not a domains `command.md` leaf. Mirrors `command_slug`.
 */
export function command_slug(physical_path: string): string | null {
    const logical = _domains_command_logical(physical_path); // commands/<subpath>.md
    if (logical === null) {
        return null;
    }
    // base = "-".join(Path(logical[len("commands/"):]).with_suffix("").parts)
    const afterCommands = logical.slice('commands/'.length); // <subpath>.md
    const withoutSuffix = afterCommands.replace(/\.md$/, '');
    const base = withoutSuffix.split('/').join('-');
    if (!base) {
        return null;
    }
    const dom = _roots.SRC_DOMAINS;
    let pack_id: string;
    if (physical_path !== dom && !_isUnder(physical_path, dom)) {
        return base; // mirrors Python's ValueError → return base
    }
    pack_id = _relativeToPosix(physical_path, dom).split('/')[0] as string;
    const prefix = pack_slug_prefix(pack_id);
    if (prefix && base !== prefix && !base.startsWith(`${prefix}-`)) {
        return `${prefix}-${base}`;
    }
    return base;
}

// --- Root specs --------------------------------------------------------------

const _LEGACY_PREFIX = '.agent-src.uncondensed/';
const _PACKAGE_SUFFIX = '/.agent-src.uncondensed/';
const _SRC_SKILLS_PREFIX = 'src/skills/';
const _SRC_RULES_PREFIX = 'src/rules/';

/**
 * Every active `[physical_root, logical_prefix]` artefact source.
 *
 * The logical path of a file under `physical_root` is
 * `logical_prefix + relativeTo(physical_root)`. For the legacy and
 * `packages/*\/` `.agent-src.uncondensed/` roots the prefix is empty. For the
 * 6.0.0-D flat library roots (`src/skills`, `src/rules`) the prefix is the
 * category because the directory IS the category.
 *
 * Order is stable: legacy first, then `packages/` entries sorted
 * alphabetically, then `src/agent-src`, then the flat library roots.
 * First-win on the walk. Throws on a non-empty logical-prefix collision
 * (council guard). Mirrors `_root_specs`.
 */
function _root_specs(): Array<[string, string]> {
    const specs: Array<[string, string]> = [];
    if (_exists(_roots.LEGACY_SRC)) {
        specs.push([_roots.LEGACY_SRC, '']);
    }
    if (_exists(_roots.PACKAGES)) {
        for (const pkg of _iterdirSorted(_roots.PACKAGES)) {
            const sub = path.join(pkg, '.agent-src.uncondensed');
            if (_isDir(sub)) {
                specs.push([sub, '']);
            }
        }
    }
    if (_isDir(_roots.SRC_AGENT)) {
        specs.push([_roots.SRC_AGENT, '']);
    }
    if (_isDir(_roots.SRC_SKILLS)) {
        specs.push([_roots.SRC_SKILLS, 'skills/']);
    }
    if (_isDir(_roots.SRC_RULES)) {
        specs.push([_roots.SRC_RULES, 'rules/']);
    }
    // Collision guard (council-required): two source roots emitting the same
    // non-empty logical prefix would let condense silently overwrite one
    // category's output with another's. Fail loud. Empty-prefix roots are
    // exempt — they namespace via per-category subdirs.
    const seen: Map<string, string> = new Map();
    for (const [physical, prefix] of specs) {
        if (!prefix) {
            continue;
        }
        const claimedBy = seen.get(prefix);
        if (claimedBy !== undefined) {
            throw new Error(
                `source-root logical-prefix collision: ${JSON.stringify(prefix)} claimed by ` +
                    `both ${claimedBy} and ${physical}`,
            );
        }
        seen.set(prefix, physical);
    }
    return specs;
}

/**
 * Every existing **container** directory under which the per-category
 * subdirectories (`skills/` / `rules/` / `commands/` / …) live.
 *
 * The "category-append" view used by scanners that do `root / "skills"` etc.
 * Returns at most one `.agent-src.uncondensed/` root (legacy), one per
 * `packages/*\/` subdirectory, and — once the 6.0.0-D flat library exists —
 * the `src/` container. Order: legacy, `packages/` sorted, then `src`.
 * Mirrors `artefact_roots`.
 */
export function artefact_roots(): string[] {
    const roots: string[] = [];
    if (_exists(_roots.LEGACY_SRC)) {
        roots.push(_roots.LEGACY_SRC);
    }
    if (_exists(_roots.PACKAGES)) {
        for (const pkg of _iterdirSorted(_roots.PACKAGES)) {
            const sub = path.join(pkg, '.agent-src.uncondensed');
            if (_isDir(sub)) {
                roots.push(sub);
            }
        }
    }
    if (_isDir(_roots.SRC_AGENT)) {
        roots.push(_roots.SRC_AGENT);
    }
    if (_isDir(_roots.SRC_SKILLS) || _isDir(_roots.SRC_RULES)) {
        roots.push(_roots.SRC);
    }
    return roots;
}

/**
 * Yield every artefact file under every active source root.
 *
 * Walks `_root_specs` (the leaf view). Deterministic order; deduplicated on
 * logical path so a file present in two roots during the move window is
 * yielded once. Symlinks and non-files are skipped. Mirrors `iter_artefacts`.
 */
export function* iter_artefacts(suffix = '.md'): Generator<string> {
    const seen: Set<string> = new Set();
    for (const [root, prefix] of _root_specs()) {
        for (const p of _rglobSorted(root, `*${suffix}`)) {
            if (!_isFile(p)) {
                continue;
            }
            const rel = prefix + _relativeToPosix(p, root);
            if (seen.has(rel)) {
                continue;
            }
            seen.add(rel);
            yield p;
        }
    }
    if (suffix === '.md') {
        for (const [p, rel] of _iter_domains_commands()) {
            if (seen.has(rel)) {
                continue;
            }
            seen.add(rel);
            yield p;
        }
    }
}

/**
 * Yield `[physical_path, logical_relpath]` for every file under every root.
 *
 * Same deterministic order as `iter_artefacts` but covers *all* files (md and
 * non-md) and pre-computes the logical relative path. First-win on duplicate
 * logical paths. Mirrors `iter_all_sources`.
 */
export function* iter_all_sources(): Generator<[string, string]> {
    const seen: Set<string> = new Set();
    for (const [root, prefix] of _root_specs()) {
        for (const p of _rglobSorted(root, '*')) {
            if (!_isFile(p)) {
                continue;
            }
            // The Python original guards `relative_to` with try/except
            // ValueError; here `p` is always under `root` by construction, but
            // we mirror the guard for fidelity.
            if (p !== root && !_isUnder(p, root)) {
                continue;
            }
            const rel = prefix + _relativeToPosix(p, root);
            if (seen.has(rel)) {
                continue;
            }
            seen.add(rel);
            yield [p, rel];
        }
    }
    for (const [p, rel] of _iter_domains_commands()) {
        if (seen.has(rel)) {
            continue;
        }
        seen.add(rel);
        yield [p, rel];
    }
}

/**
 * Yield every command source file across all layouts.
 *
 * Covers the legacy / `packages/*\/.agent-src.uncondensed/commands/` trees AND
 * the 6.0.0-D `src/domains/<pack>/<subpath>/command.md` homes, deduplicated on
 * the logical command path (`commands/<subpath>.md`) — packages-tree wins
 * (first-win order). Mirrors `iter_commands`.
 */
export function* iter_commands(): Generator<string> {
    const seen: Set<string> = new Set();
    for (const [root, prefix] of _root_specs()) {
        if (prefix) {
            // flat skills/rules roots carry no commands subtree
            continue;
        }
        const base = path.join(root, 'commands');
        if (!_isDir(base)) {
            continue;
        }
        for (const p of _rglobSorted(base, '*.md')) {
            if (!_isFile(p)) {
                continue;
            }
            const rel = `commands/${_relativeToPosix(p, base)}`;
            if (seen.has(rel)) {
                continue;
            }
            seen.add(rel);
            yield p;
        }
    }
    for (const [p, rel] of _iter_domains_commands()) {
        if (seen.has(rel)) {
            continue;
        }
        seen.add(rel);
        yield p;
    }
}

/**
 * Return the physical path that backs `logical_rel`, or `null`.
 *
 * Walks `_root_specs` in order and returns the first hit. A flat library root
 * only matches a logical path under its prefix; the suffix after the prefix is
 * the path inside that physical root. Falls back to a `src/domains` glob for
 * `commands/<subpath>.md`. Mirrors `resolve_logical`.
 */
export function resolve_logical(logical_rel: string): string | null {
    const rel = logical_rel.replaceAll('\\', '/').replace(/^\/+/, '');
    for (const [root, prefix] of _root_specs()) {
        let p: string;
        if (prefix) {
            if (!rel.startsWith(prefix)) {
                continue;
            }
            p = path.join(root, rel.slice(prefix.length));
        } else {
            p = path.join(root, rel);
        }
        if (_exists(p)) {
            return p;
        }
    }
    // 6.0.0-D domains commands: a logical `commands/<subpath>.md` is backed by
    // `src/domains/<pack>/<subpath>/command.md`. Pack is not encoded in the
    // logical path, so glob the domains tree for the matching leaf.
    if (rel.startsWith('commands/') && rel.endsWith('.md') && _isDir(_roots.SRC_DOMAINS)) {
        const subpath = rel.slice('commands/'.length, rel.length - '.md'.length);
        for (const packDir of _iterdirSorted(_roots.SRC_DOMAINS)) {
            const cand = path.join(packDir, subpath, 'command.md');
            if (_isFile(cand)) {
                return cand;
            }
        }
    }
    return null;
}

/**
 * Return the artefact's logical identity path (POSIX, no prefix).
 *
 * Throws if `inputPath` is not under any known source root. Mirrors
 * `logical_relpath`. `inputPath` is an absolute or repo-relative path string.
 */
export function logical_relpath(inputPath: string): string {
    const p = path.isAbsolute(inputPath)
        ? path.resolve(inputPath)
        : path.resolve(_roots.ROOT, inputPath);
    for (const [root, prefix] of _root_specs()) {
        const resolvedRoot = path.resolve(root);
        if (p === resolvedRoot || _isUnder(p, resolvedRoot)) {
            return prefix + _relativeToPosix(p, resolvedRoot);
        }
    }
    // 6.0.0-D domains command (src/domains/<pack>/<subpath>/command.md).
    const domainsLogical = _domains_command_logical(p);
    if (domainsLogical !== null) {
        return domainsLogical;
    }
    throw new Error(`path is not under any artefact root: ${inputPath}`);
}

/**
 * Strip the `.agent-src.uncondensed/` anchor from a repo-relative path.
 *
 * Accepts both the legacy flat layout and the monorepo packages layout.
 * Returns `null` if the path is not under any source root. Mirrors
 * `strip_source_prefix`.
 */
export function strip_source_prefix(rel: string): string | null {
    const posix = rel.replaceAll('\\', '/');
    if (posix.startsWith(_LEGACY_PREFIX)) {
        return posix.slice(_LEGACY_PREFIX.length);
    }
    if (posix.startsWith('packages/')) {
        const idx = posix.indexOf(_PACKAGE_SUFFIX);
        if (idx !== -1) {
            return posix.slice(idx + _PACKAGE_SUFFIX.length);
        }
    }
    // 6.0.0-D flat library: physical category prefix → logical category.
    if (posix.startsWith(_SRC_SKILLS_PREFIX)) {
        return `skills/${posix.slice(_SRC_SKILLS_PREFIX.length)}`;
    }
    if (posix.startsWith(_SRC_RULES_PREFIX)) {
        return `rules/${posix.slice(_SRC_RULES_PREFIX.length)}`;
    }
    // 6.0.0-D domains command: src/domains/<pack>/<subpath>/command.md
    // → commands/<subpath>.md (pack stripped, command.md leaf → subpath).
    if (posix.startsWith(_SRC_DOMAINS_PREFIX) && posix.endsWith('/command.md')) {
        const rest = posix.slice(_SRC_DOMAINS_PREFIX.length); // <pack>/<subpath>/command.md
        const parts = rest.split('/');
        if (parts.length >= 3) {
            return `commands/${parts.slice(1, -1).join('/')}.md`;
        }
    }
    return null;
}

/** `true` if a repo-relative POSIX path sits under any source root. */
export function is_artefact_path(rel: string): boolean {
    return strip_source_prefix(rel) !== null;
}

/**
 * Return the canonical `packages/core/<relative_target>` path.
 *
 * Pure resolver: deterministic, no filesystem I/O. Mirrors
 * `resolve_package_core_path`. Returns an absolute path string.
 */
export function resolve_package_core_path(relative_target: string): string {
    const rel = relative_target.replaceAll('\\', '/').replace(/^\/+/, '');
    return rel ? path.join(_roots.PACKAGE_CORE, rel) : _roots.PACKAGE_CORE;
}

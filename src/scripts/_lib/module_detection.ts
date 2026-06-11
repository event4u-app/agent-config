/**
 * Detect module root directories from a project tree.
 *
 * TypeScript twin of `src/scripts/_lib/module_detection.py` (ADR-088,
 * Phase 2 Wave 1 batch C). Public API mirrors the Python module exactly —
 * same exported snake_case names, same return shapes, same confidence
 * ladder, same read-only / tolerant contract.
 *
 * Contract — pure, read-only, tolerant:
 *
 * - `detect_module_roots` walks the candidate paths once and reports every
 *   directory that *exists*. It never creates files, never recurses past
 *   the first level needed to score confidence, and silently skips paths
 *   it cannot read.
 * - The return shape is a list of `ModuleCandidate` objects ordered by
 *   descending confidence; callers may turn that list straight into
 *   numbered options.
 * - Confidence is a three-step ladder:
 *   - `high` — directory exists *and* its first level contains plausible
 *     module subdirectories for the stack.
 *   - `medium` — directory exists but is empty / unclear; still surfaced
 *     so the installer can ask the user.
 *   - Absent paths are skipped entirely; they never appear in the output.
 *
 * No interactive logic, no settings I/O, no logging side-effects.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Directory entry names that never count as modules. Mirrors the
 * `modules.skip_dirs` default from
 * `templates/agents/agent-project-settings.example.yml`.
 */
const _SKIP_DIRS: ReadonlySet<string> = new Set(['.module-template', '.example']);

/**
 * Path segments that exclude a file from module-like detection.
 * Vendored dependencies, build artefacts, VCS state, IDE config —
 * never a real module no matter what shape the parent directory has.
 */
const _NOISE_SEGMENTS: ReadonlySet<string> = new Set([
    'vendor',
    'node_modules',
    '.git',
    '.idea',
    '.vscode',
    'dist',
    'build',
    'tmp',
    'var',
    'storage',
    'bootstrap',
    'public',
    '.venv',
    'venv',
    '__pycache__',
]);

/**
 * Parent directory names that hint at a module layout when their
 * immediate child is a non-noise segment (i.e. `Modules/User/...`,
 * `packages/foo/...`). Case-sensitive — `Modules` (Laravel HMVC)
 * differs from `modules` (Node convention) intentionally; both are
 * accepted.
 */
const _MODULE_PARENTS: ReadonlySet<string> = new Set([
    'Modules',
    'modules',
    'packages',
    'apps',
    'internal',
]);

/**
 * Return `true` when `rel_path` sits inside a module-shaped tree.
 *
 * Heuristic for the `module-detect-on-the-fly` skill: triggered by
 * repo-relative POSIX paths the agent is about to edit or reference.
 * A path is *module-like* when:
 *
 * 1. None of its segments are in `_NOISE_SEGMENTS` (vendored, build,
 *    VCS, IDE state — never a real module).
 * 2. At least one segment matches `_MODULE_PARENTS` AND has a non-noise
 *    sibling directly underneath (so `Modules/` alone does not trigger,
 *    but `Modules/User/...` does).
 *
 * Pure, case-sensitive on parent names. Empty / dotted / Windows-style
 * inputs return `false`. The function never touches the filesystem —
 * callers pass in a path string they already know about.
 */
export function is_module_like_path(rel_path: string): boolean {
    if (!rel_path) {
        return false;
    }
    const normalised = rel_path.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
    if (!normalised) {
        return false;
    }
    const parts = normalised.split('/');
    for (const segment of parts) {
        if (_NOISE_SEGMENTS.has(segment)) {
            return false;
        }
    }
    for (let idx = 0; idx < parts.length - 1; idx += 1) {
        const segment = parts[idx] as string;
        if (!_MODULE_PARENTS.has(segment)) {
            continue;
        }
        const child = parts[idx + 1] as string;
        if (!child || child.startsWith('.')) {
            continue;
        }
        if (_SKIP_DIRS.has(child)) {
            continue;
        }
        return true;
    }
    return false;
}

/**
 * One detected module-root candidate.
 *
 * Fields mirror the JSON shape callers ultimately persist into
 * `modules.root_paths` (the `path` field) plus metadata used by the
 * installer to phrase the numbered-options prompt. Mirrors the frozen
 * `ModuleCandidate` dataclass of the Python original.
 */
export interface ModuleCandidate {
    /** Repo-relative POSIX path of the module root (e.g. `app/Modules`). */
    readonly path: string;

    /**
     * Stack identifier — one of `laravel-hmvc`, `symfony-ddd`,
     * `node-monorepo`, `python-src`, `go-internal`, `composer-src`.
     */
    readonly stack: string;

    /**
     * PHP-style namespace template with `{ModuleName}` placeholder
     * (e.g. `App\Modules\{ModuleName}`). Empty string for stacks without
     * a PHP-style namespace (Node, Python, Go).
     */
    readonly namespace_template_guess: string;

    /** One of `high` or `medium` per the ladder in the module doc comment. */
    readonly confidence: string;
}

/**
 * Detection rules — order encodes priority when two rules match the same
 * directory. The third tuple slot is the value emitted as
 * `namespace_template_guess` on a hit; empty for non-PHP stacks.
 */
const _RULES: ReadonlyArray<readonly [string, string, string]> = [
    ['app/Modules', 'laravel-hmvc', 'App\\Modules\\{ModuleName}'],
    ['src/Module', 'symfony-ddd', 'App\\Module\\{ModuleName}'],
    ['packages', 'node-monorepo', ''],
    ['apps', 'node-monorepo', ''],
    ['modules', 'node-monorepo', ''],
    ['src', 'python-src', ''],
    ['internal', 'go-internal', ''],
    ['cmd', 'go-internal', ''],
];

/** Stat helper following symlinks; any error counts as "not there". */
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

/**
 * Single-character uppercase test matching Python's `str.isupper()` for
 * one-char strings: the char must be cased AND uppercase.
 */
function _isUpperChar(ch: string): boolean {
    if (!ch) {
        return false;
    }
    return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

/** Return first-level subdirectory names of `root` that look like modules. */
function _list_module_subdirs(root: string): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(root).sort();
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const name of entries) {
        // Mirrors Python's `entry.is_dir()` — follows symlinks, errors → skip.
        if (!_isDir(path.join(root, name))) {
            continue;
        }
        if (name.startsWith('.')) {
            continue;
        }
        if (_SKIP_DIRS.has(name)) {
            continue;
        }
        out.push(name);
    }
    return out;
}

/** Return `high` when `subdirs` looks like a populated module root. */
function _score_confidence(stack: string, root: string, subdirs: readonly string[]): string {
    if (subdirs.length === 0) {
        return 'medium';
    }
    if (stack === 'laravel-hmvc' || stack === 'symfony-ddd') {
        const capitalized = subdirs.filter((name) => _isUpperChar(name.slice(0, 1)));
        return capitalized.length > 0 ? 'high' : 'medium';
    }
    if (stack === 'node-monorepo') {
        const withPkgJson = subdirs.filter((name) => _isFile(path.join(root, name, 'package.json')));
        return withPkgJson.length > 0 ? 'high' : 'medium';
    }
    if (stack === 'python-src') {
        const withInit = subdirs.filter((name) => _isFile(path.join(root, name, '__init__.py')));
        return withInit.length > 0 ? 'high' : 'medium';
    }
    if (stack === 'go-internal') {
        return subdirs.length > 0 ? 'high' : 'medium';
    }
    return 'medium';
}

/**
 * Return module-root candidates discovered under `project_root`.
 *
 * Pure read-only scan. Walks each rule in `_RULES`, reports every
 * directory that exists, and never recurses past the first level needed
 * to score confidence. Order: `high` first, then `medium`; rule order
 * breaks ties. Absent paths never appear in the output.
 */
export function detect_module_roots(project_root: string): ModuleCandidate[] {
    const high: ModuleCandidate[] = [];
    const medium: ModuleCandidate[] = [];
    for (const [rel_path, stack, namespace_template] of _RULES) {
        const abs_path = path.join(project_root, rel_path);
        if (!_isDir(abs_path)) {
            continue;
        }
        const subdirs = _list_module_subdirs(abs_path);
        const confidence = _score_confidence(stack, abs_path, subdirs);
        const candidate: ModuleCandidate = {
            path: rel_path,
            stack,
            namespace_template_guess: namespace_template,
            confidence,
        };
        if (confidence === 'high') {
            high.push(candidate);
        } else {
            medium.push(candidate);
        }
    }
    return [...high, ...medium];
}

/**
 * Vendor-namespaced user-global path resolution.
 *
 * TypeScript twin of `src/scripts/_lib/user_global_paths.py` (ADR-094,
 * Phase 2 / Wave 1 batch B). Mirrors the Python module's public API
 * exactly — same exported snake_case names, same semantics, same
 * path-resolution behavior. Single source of truth for "where does this
 * package keep user-global state on disk?".
 *
 * Resolution order:
 *
 *   1. `$EVENT4U_CONFIG_HOME`  — full path override (testing + power users).
 *   2. `~/.event4u/agent-config/`  — vendor-namespaced source-of-truth.
 *
 * For backward compatibility during the transition, `legacy_xdg_root()`
 * exposes the old `~/.config/agent-config/` path so loaders can read
 * state written by pre-2.4 installs. Writers should never target the
 * legacy path; the auto-migration shim copies state once into the new
 * namespace.
 *
 * Contract — pure, read-only, never auto-creates directories
 * (except `migrate_legacy_namespace`, which mirrors the Python shim).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** Environment map shape — mirrors Python's `Optional[dict]` env parameter. */
export type EnvMap = Record<string, string | undefined>;

/**
 * Marker suffix for in-progress entry copies during migration. A copy
 * that crashes mid-flight leaves `<name><suffix><pid>` behind so the
 * next run can clean it up before retrying — instead of treating a
 * partial subdir as a completed copy.
 *
 * Exported (despite the underscore) because the pytest suite accesses
 * `user_global_paths._PARTIAL_SUFFIX`; the vitest port does the same.
 */
export const _PARTIAL_SUFFIX = '.event4u-partial-';

/**
 * Environment variable that overrides `event4u_root()` outright.
 * Accepts a full path (`~` expanded). Primarily used by tests; power
 * users may also point this at a custom location.
 */
export const EVENT4U_HOME_ENV = 'EVENT4U_CONFIG_HOME';

/** Vendor-namespaced default. Relative to the user's home directory. */
export const DEFAULT_EVENT4U_ROOT_RELATIVE = path.join('.event4u', 'agent-config');

/**
 * Legacy XDG-shaped default written by pre-2.4 installs. Read-only
 * fallback during the transition; never the target of a write.
 */
export const LEGACY_XDG_ROOT_RELATIVE = path.join('.config', 'agent-config');

/**
 * Expand a leading `~` like Python's `Path.expanduser()`.
 *
 * Divergence candidate (flagged, not fixed): Python also expands
 * `~user` via the pwd database; this port leaves `~user` unchanged
 * (which is also Python's behavior when the user is unknown).
 */
function expanduser(p: string): string {
    if (p === '~') {
        return os.homedir();
    }
    if (p.startsWith('~/') || (process.platform === 'win32' && p.startsWith('~\\'))) {
        return path.join(os.homedir(), p.slice(2));
    }
    return p;
}

/**
 * Mirror of `pathlib.Path.is_absolute()`.
 *
 * On POSIX a path is absolute iff it has a root (`/...`). On Windows,
 * pathlib requires BOTH a drive and a root (`C:\\...` or UNC) — unlike
 * Node's `path.isAbsolute`, which accepts rootless `\\foo`. The Python
 * semantics are replicated here.
 */
function is_absolute_like_python(p: string): boolean {
    if (process.platform === 'win32') {
        return /^[a-zA-Z]:[\\/]/.test(p) || /^([\\/]{2})[^\\/]+[\\/][^\\/]+/.test(p);
    }
    return p.startsWith('/');
}

/**
 * Return the active user-global root directory.
 *
 * Honours `EVENT4U_CONFIG_HOME` first, falls back to
 * `~/.event4u/agent-config/`. Never creates the directory.
 */
export function event4u_root(env?: EnvMap | null): string {
    const env_map = env ?? process.env;
    const override = env_map[EVENT4U_HOME_ENV];
    if (override) {
        return expanduser(override);
    }
    return path.join(os.homedir(), DEFAULT_EVENT4U_ROOT_RELATIVE);
}

/**
 * Return the pre-2.4 user-global root at `~/.config/agent-config/`.
 *
 * Used by loaders during the transition to read settings, lockfiles,
 * and keys written before the namespace migration ran. Writers MUST
 * NOT target this path — only `event4u_root()` is a valid write
 * target. Never creates the directory.
 */
export function legacy_xdg_root(): string {
    return path.join(os.homedir(), LEGACY_XDG_ROOT_RELATIVE);
}

/**
 * Resolve a named file/dir under the user-global root, with legacy fallback.
 *
 * Returns the new-namespace path if it exists on disk, otherwise the
 * legacy XDG path if it exists, otherwise `null`. Callers that need
 * the *write target* (regardless of existence) should use
 * `path.join(event4u_root(), relative_name)` directly.
 *
 * `relative_name` is a forward-slash separated string (e.g.
 * `"installed.lock"` or `"agents/global"`). It is treated as a
 * path fragment relative to the chosen root; absolute paths are
 * rejected with an `Error` (Python raises `ValueError`).
 */
export function resolve_with_fallback(
    relative_name: string,
    options: { env?: EnvMap | null } = {},
): string | null {
    if (is_absolute_like_python(relative_name)) {
        throw new Error(
            `resolve_with_fallback expects a relative path, got '${relative_name}'`,
        );
    }
    const new_path = path.join(event4u_root(options.env ?? null), relative_name);
    if (fs.existsSync(new_path)) {
        return new_path;
    }
    const legacy_path = path.join(legacy_xdg_root(), relative_name);
    if (fs.existsSync(legacy_path)) {
        return legacy_path;
    }
    return null;
}

/**
 * Return the canonical write target for a named user-global file/dir.
 *
 * Always rooted at `event4u_root()` — writers never target the
 * legacy XDG path. Caller is responsible for `mkdir -p` on the parent
 * before writing. Never creates the directory itself.
 */
export function write_target(
    relative_name: string,
    options: { env?: EnvMap | null } = {},
): string {
    if (is_absolute_like_python(relative_name)) {
        throw new Error(`write_target expects a relative path, got '${relative_name}'`);
    }
    return path.join(event4u_root(options.env ?? null), relative_name);
}

/**
 * Breadcrumb dropped into the legacy root after a successful migration.
 * Tells the user where their state now lives and how to clean up. The
 * legacy tree itself is never auto-deleted — only the user does that.
 */
export const MIGRATION_BREADCRUMB_NAME = 'MIGRATED.md';

const _BREADCRUMB_TEMPLATE = `# Migrated to \`~/.event4u/agent-config/\`

This directory (\`~/.config/agent-config/\`) is the **legacy** location
for \`event4u/agent-config\` user-global state. As of v2.4 the canonical
location is \`~/.event4u/agent-config/\`.

The migration shim has already copied your settings, keys, lockfiles,
and overrides into the new namespace. File modes (0600 on keys) were
preserved. Loaders prefer the new path but still read from this tree
as a fallback, so removing it is safe **once you've confirmed** the
new location is working.

## To clean up

\`\`\`bash
rm -rf ~/.config/agent-config
\`\`\`

## Why the move

\`~/.config/\` is a generic XDG-shaped directory shared by many tools.
\`~/.event4u/agent-config/\` is vendor-namespaced and avoids collisions
with unrelated CLIs. See
\`agents/roadmaps/road-to-event4u-namespace-and-claude-desktop.md\` for
the full rationale.
`;

/**
 * Copy pre-2.4 user-global state from legacy XDG root into the new namespace.
 *
 * Idempotent and safe to call on every install / init. Returns `true`
 * if a copy ran during this invocation, `false` when the migration
 * was already complete or there was nothing to migrate.
 *
 * Contract (mirrors the Python shim):
 *
 * - Never auto-deletes the legacy tree — that's the user's call (the
 *   breadcrumb at `~/.config/agent-config/MIGRATED.md` documents it).
 * - Preserves file modes (0600 key files stay 0600 after the copy)
 *   and timestamps, like `shutil.copytree(..., copy_function=copy2)`.
 * - If the new root already exists with any content, the migration
 *   treats it as already-done and only writes the breadcrumb (if
 *   missing) — never overwrites new-namespace state.
 * - If the legacy root is missing or empty, the function is a no-op.
 * - Per-entry atomic write: each entry is copied to a sibling
 *   `<name>.event4u-partial-<pid>` and then renamed into the final
 *   name. If a previous run crashed mid-copy, the leftover
 *   `*.event4u-partial-*` siblings are cleaned up at the top of the
 *   next run before retrying — a partial directory is never mistaken
 *   for a completed copy.
 *
 * `legacy_root_override` is for tests; production callers omit it.
 */
export function migrate_legacy_namespace(
    options: { env?: EnvMap | null; legacy_root_override?: string | null } = {},
): boolean {
    const legacy_root = options.legacy_root_override ?? legacy_xdg_root();
    const new_root = event4u_root(options.env ?? null);

    let legacy_stat: fs.Stats;
    try {
        legacy_stat = fs.statSync(legacy_root);
    } catch {
        return false;
    }
    if (!legacy_stat.isDirectory()) {
        return false;
    }

    // Skip the migrated-breadcrumb itself when checking for content so a
    // second invocation does not loop on its own marker.
    const legacy_entries = fs
        .readdirSync(legacy_root)
        .filter((name) => name !== MIGRATION_BREADCRUMB_NAME);
    if (legacy_entries.length === 0) {
        return false;
    }

    // Real content check ignores partial-copy debris from a prior
    // interrupted run; otherwise the breadcrumb would be written for
    // a half-finished migration and retry would never run.
    const new_has_content =
        fs.existsSync(new_root) &&
        fs.readdirSync(new_root).some((name) => !_is_partial_name(name));
    if (new_has_content) {
        _ensure_breadcrumb(legacy_root);
        return false;
    }

    fs.mkdirSync(new_root, { recursive: true });
    _purge_partial_entries(new_root);

    for (const name of legacy_entries) {
        const entry = path.join(legacy_root, name);
        const target = path.join(new_root, name);
        if (fs.existsSync(target)) {
            continue;
        }
        const staging = path.join(new_root, `${name}${_PARTIAL_SUFFIX}${process.pid}`);
        if (fs.existsSync(staging)) {
            _remove_path(staging);
        }
        if (fs.statSync(entry).isDirectory()) {
            // Mirrors shutil.copytree(copy_function=copy2): modes are
            // preserved by the copy; timestamps via preserveTimestamps.
            fs.cpSync(entry, staging, { recursive: true, preserveTimestamps: true });
        } else {
            fs.copyFileSync(entry, staging);
            // copy2 semantics: explicitly carry over mode + timestamps.
            const src_stat = fs.statSync(entry);
            fs.chmodSync(staging, src_stat.mode & 0o7777);
            fs.utimesSync(staging, src_stat.atime, src_stat.mtime);
        }
        fs.renameSync(staging, target);
    }

    _ensure_breadcrumb(legacy_root);
    return true;
}

function _is_partial_name(name: string): boolean {
    return name.includes(_PARTIAL_SUFFIX);
}

/** Remove `*.event4u-partial-*` leftovers from a previous interrupted run. */
function _purge_partial_entries(new_root: string): void {
    for (const name of fs.readdirSync(new_root)) {
        if (_is_partial_name(name)) {
            _remove_path(path.join(new_root, name));
        }
    }
}

function _remove_path(p: string): void {
    let st: fs.Stats | null = null;
    try {
        st = fs.lstatSync(p);
    } catch {
        // Missing path — Python's unlink(missing_ok=True) tolerates this.
        return;
    }
    if (st.isDirectory() && !st.isSymbolicLink()) {
        fs.rmSync(p, { recursive: true });
    } else {
        fs.rmSync(p, { force: true });
    }
}

/** Write the `MIGRATED.md` breadcrumb into `legacy_root` if absent. */
function _ensure_breadcrumb(legacy_root: string): void {
    const breadcrumb = path.join(legacy_root, MIGRATION_BREADCRUMB_NAME);
    if (fs.existsSync(breadcrumb)) {
        return;
    }
    fs.writeFileSync(breadcrumb, _BREADCRUMB_TEMPLATE, 'utf-8');
}

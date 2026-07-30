/**
 * Detect whether a directory is a project whose `agents/` folder is managed
 * by this package.
 *
 * `.agent-settings.yml` resolution and settings-cascade routing already have
 * a project-root walker (`find_project_root_with_anchor` in
 * `_lib/agent_settings.ts`), but that walker answers a different question —
 * "where does the settings cascade start reading from" — and its `agents/`
 * check exists only to pick a boundary anchor for that walk (its marker list
 * mixes package-source-repo-only paths, e.g. `settings/.ai-council.yml`, with
 * consumer-only paths). It also treats a bare `.git` anywhere in the ancestor
 * chain as "a project was found", which is the right answer for "where do
 * settings live" but the wrong answer for "is this THIS package's managed
 * `agents/` folder" — a third-party repo with an unrelated `agents/`
 * directory and its own `.git` would resolve to a root there too. No
 * existing helper answers the narrower managed/unmanaged/not-a-project
 * question this module exists for.
 *
 * Contract — pure, read-only, tolerant:
 *
 * - Never writes, never mutates, never touches the network.
 * - Operates on the given `start` directory directly — it does not walk
 *   ancestors looking for a project root (that is the caller's job, e.g.
 *   via `find_project_root` when the caller only has a subdirectory).
 *   Keeping this helper non-walking keeps it a distinct primitive from the
 *   settings-root walker above rather than a second, subtly different copy
 *   of the same walk.
 * - Silently tolerant of a missing/unreadable `start` — every check falls
 *   through to `false`, which resolves to `'not-a-project'`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SECTION_HEADER as _MANAGED_GITIGNORE_HEADER } from '../sync_gitignore.js';

/**
 * Three-state answer — never a boolean, because "no `agents/` folder" and
 * "no project at all" route differently downstream (an unmanaged repo is a
 * candidate for adoption; a bare directory outside any repo is not a
 * project the P-routing question even applies to).
 */
export type ManagedAgentsFolderStatus = 'managed' | 'unmanaged' | 'not-a-project';

/**
 * Detection predicate — chosen after inspecting what the installer actually
 * writes into a consumer project (verified against source, not invented):
 *
 *   is_project   := <start>/.git exists (file or directory — worktrees and
 *                    submodules use a `.git` file, not a directory).
 *   has_agents   := <start>/agents is a directory.
 *   has_marker   := ANY of —
 *     (a) <start>/.gitignore contains the managed-block header line
 *         `# event4u/agent-config` (`SECTION_HEADER` in
 *         `sync_gitignore.ts`) — installed by `refresh --project` /
 *         `sync:gitignore`. Strongest signal: the literal package name, so
 *         a third-party repo carries it only if it also runs this package.
 *     (b) <start>/agents/overrides/ is a directory — scaffolded by
 *         `install.ts` for every consumer project (the "guaranteed
 *         minimal-consumer surface", ADR-020).
 *     (c) a resolvable `.agent-settings.yml` exists — canonical
 *         `<start>/agents/settings/.agent-settings.yml`, or the legacy
 *         `<start>/.agent-settings.yml` fallback (see
 *         `project_settings_path` in `_lib/agent_settings.ts`).
 *
 *   status := has_agents && has_marker  → 'managed'
 *             is_project (else)         → 'unmanaged'
 *             otherwise                 → 'not-a-project'
 *
 * Rejected alternatives:
 *
 *   - `agents/` existence alone (no marker). Rejected: this is exactly the
 *     false positive the roadmap phase calls out — an unrelated multi-agent
 *     framework repo, or any project that happens to name a directory
 *     `agents/`, would read as managed with zero package-specific evidence.
 *   - Reusing `find_project_root_with_anchor`'s `_AGENTS_DIR_MARKERS` list
 *     verbatim (`roadmaps`, `settings/.ai-council.yml`,
 *     `roadmaps-progress.md`, `overrides`). Rejected: two of those four
 *     (`settings/.ai-council.yml`, `roadmaps-progress.md`) are `pkg`-scope
 *     only per `docs/contracts/agents-layout.md`'s consumer-slim-profile
 *     table — they never appear in an installed consumer project, so
 *     requiring "any one" would under-detect nothing (they're just dead
 *     weight for the consumer case) but reusing the *function* would also
 *     inherit its `.git`-anchor and `.agent-settings.yml`-layer-fallback
 *     semantics, which answer "where is the settings root" rather than
 *     "is `agents/` managed" (see module docblock).
 *   - `agents/roadmaps/` as a marker. Rejected: it is listed as "Optional"
 *     even in the consumer-slim profile — a managed project with zero
 *     roadmaps yet (the common case right after install) would false-
 *     negative.
 */
function _existsAt(dir: string, ...segments: readonly string[]): boolean {
    try {
        fs.statSync(path.join(dir, ...segments));
        return true;
    } catch {
        return false;
    }
}

function _isDirAt(dir: string, ...segments: readonly string[]): boolean {
    try {
        return fs.statSync(path.join(dir, ...segments)).isDirectory();
    } catch {
        return false;
    }
}

function _isFileAt(dir: string, ...segments: readonly string[]): boolean {
    try {
        return fs.statSync(path.join(dir, ...segments)).isFile();
    } catch {
        return false;
    }
}

/** `true` when `start` sits at the root of a git repository (or worktree). */
function _isGitProject(start: string): boolean {
    // `.git` is a directory in a normal clone, a file in a worktree or
    // submodule checkout — `statSync` (not `lstatSync`) is deliberate so a
    // broken symlink named `.git` does not count as present.
    return _existsAt(start, '.git');
}

/** `true` when `<start>/.gitignore` carries the managed-block header line. */
function _hasManagedGitignoreBlock(start: string): boolean {
    if (!_isFileAt(start, '.gitignore')) {
        return false;
    }
    let text: string;
    try {
        text = fs.readFileSync(path.join(start, '.gitignore'), 'utf-8');
    } catch {
        return false;
    }
    return text
        .split(/\r\n|\r|\n/)
        .some((line) => line.trim() === _MANAGED_GITIGNORE_HEADER);
}

/** `true` when `<start>/agents/overrides` exists as a directory. */
function _hasOverridesDir(start: string): boolean {
    return _isDirAt(start, 'agents', 'overrides');
}

/**
 * `true` when a resolvable `.agent-settings.yml` exists — canonical
 * `agents/settings/.agent-settings.yml`, or the legacy repo-root
 * `.agent-settings.yml`.
 */
function _hasResolvableAgentSettings(start: string): boolean {
    return (
        _isFileAt(start, 'agents', 'settings', '.agent-settings.yml') ||
        _isFileAt(start, '.agent-settings.yml')
    );
}

/**
 * Classify `start` as `'managed'` (an `agents/` folder this package
 * installed and can safely write project facts into), `'unmanaged'` (a real
 * project — has a `.git` — with no such folder, or an `agents/` folder this
 * package did not install), or `'not-a-project'` (no `.git` at `start` at
 * all — e.g. a bare directory outside any repo).
 *
 * Read-only. Does not walk ancestors — `start` is checked directly; pass a
 * project root (e.g. from `find_project_root`) when the caller only has a
 * subdirectory.
 */
export function detect_managed_agents_folder(start: string): ManagedAgentsFolderStatus {
    if (!_isGitProject(start)) {
        return 'not-a-project';
    }
    const hasAgentsDir = _isDirAt(start, 'agents');
    const hasMarker =
        _hasManagedGitignoreBlock(start) ||
        _hasOverridesDir(start) ||
        _hasResolvableAgentSettings(start);
    if (hasAgentsDir && hasMarker) {
        return 'managed';
    }
    return 'unmanaged';
}

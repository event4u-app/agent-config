/**
 * Detection layer — Phase A2 port of `scripts/install.py:detect_*`.
 *
 * Pure functions only: read once, return a plan. No side effects in
 * the detection itself — atomic writes and conflict resolution happen
 * in later phases against the data this module returns.
 *
 * Mirrors:
 *   - `SCOPE_DETECT_MANIFESTS`            → {@link SCOPE_DETECT_MANIFESTS}
 *   - `SCOPE_DETECT_AI_DIRS`              → {@link SCOPE_DETECT_AI_DIRS}
 *   - `SCOPE_DETECT_AI_FILES`             → {@link SCOPE_DETECT_AI_FILES}
 *   - `detect_scope(cwd)`                 → {@link detectScope}
 *   - `detect_package_root(project_root)` → {@link detectPackageRoot}
 *   - `detect_package_type(...)`          → {@link detectPackageType}
 *
 * v4 addition (no Python counterpart): {@link discoverPacks} walks the
 * monorepo `packages/` tree to enumerate available packs.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import type { InstallTarget } from './types.js';

/**
 * Settings-file name used as the strongest project-scope signal.
 *
 * Matches `SETTINGS_FILE` in `scripts/install.py`. Presence in `cwd`
 * short-circuits scope detection to `'project'` without consulting
 * the manifest / AI-tool lists.
 */
export const SETTINGS_FILE = '.agent-settings.yml';

/**
 * Manifest files that, when present, count as a project-shape signal.
 *
 * Listed in the order they are most commonly canonical; detection
 * short-circuits on the first hit. `.git/` is intentionally absent —
 * monorepos, dotfile-git repos, and non-Git workspaces all break it
 * (ADR-007 D2).
 */
export const SCOPE_DETECT_MANIFESTS: readonly string[] = [
    'package.json',
    'composer.json',
    'pyproject.toml',
    'Cargo.toml',
    'go.mod',
    'Gemfile',
];

/** Project-local AI-tool config directories that count as a presence signal. */
export const SCOPE_DETECT_AI_DIRS: readonly string[] = [
    '.claude',
    '.cursor',
    '.windsurf',
    '.augment',
    '.clinerules',
    '.copilot',
    '.gemini',
    '.codex',
    '.aider',
    '.continue',
    '.roo',
    '.kilocode',
];

/** Project-local AI-tool config files that count as a presence signal. */
export const SCOPE_DETECT_AI_FILES: readonly string[] = [
    'CLAUDE.md',
    'AGENTS.md',
    'GEMINI.md',
    '.windsurfrules',
    '.aider.conf.yml',
];

/**
 * Scope detection outcome.
 *
 * - `project` — install into `cwd` (existing `.agent-settings.yml`).
 * - `prompt`  — caller MUST resolve the ambiguity (manifest + AI marker).
 * - `global`  — install to user-scope paths (default).
 */
export type Scope = 'project' | 'prompt' | 'global';

/** Reason string carried alongside a {@link Scope} for UI / log surfaces. */
export interface ScopeDecision {
    readonly scope: Scope;
    readonly reason: string;
}

/**
 * Multi-signal scope detection (ADR-007 D2 / Phase 1.3).
 *
 * 1:1 port of `scripts/install.py:detect_scope`. Pure — no side effects.
 */
export function detectScope(cwd: string): ScopeDecision {
    if (existsSync(join(cwd, SETTINGS_FILE))) {
        return { scope: 'project', reason: `existing ${SETTINGS_FILE}` };
    }

    const manifest = SCOPE_DETECT_MANIFESTS.find((m) => existsSync(join(cwd, m)));
    const aiDir = SCOPE_DETECT_AI_DIRS.find((d) => isDir(join(cwd, d)));
    const aiFile = SCOPE_DETECT_AI_FILES.find((f) => existsSync(join(cwd, f)));

    if (manifest !== undefined && (aiDir !== undefined || aiFile !== undefined)) {
        const marker = aiDir ?? aiFile;
        return {
            scope: 'prompt',
            reason: `manifest (${manifest}) + AI-tool config (${marker ?? ''})`,
        };
    }

    return { scope: 'global', reason: 'no project-scope signals' };
}

/**
 * Map a {@link Scope} to the {@link InstallTarget} consumed by plan builder.
 *
 * `prompt` is treated as ambiguous — caller resolves via CLI flag or UI.
 * Defaulting `prompt` to `global` here would silently swallow the signal.
 */
export function scopeToTarget(scope: Scope): InstallTarget | null {
    if (scope === 'project') return 'project';
    if (scope === 'global') return 'global';
    return null;
}

/** Project shape inferred from manifest presence. */
export interface ProjectShape {
    readonly kind: 'composer' | 'npm' | 'cargo' | 'pyproject' | 'go' | 'ruby' | 'unknown';
    readonly root: string;
    readonly manifest: string | null;
}

/**
 * Detect project shape from manifest markers — pure read of cwd.
 *
 * Manifest-to-kind mapping mirrors {@link SCOPE_DETECT_MANIFESTS}:
 * `package.json` → npm, `composer.json` → composer, etc.
 */
export function detectProjectShape(root: string): ProjectShape {
    const manifest = SCOPE_DETECT_MANIFESTS.find((m) => existsSync(join(root, m)));
    if (manifest === undefined) {
        return { kind: 'unknown', root, manifest: null };
    }
    const kind = ({
        'package.json': 'npm',
        'composer.json': 'composer',
        'pyproject.toml': 'pyproject',
        'Cargo.toml': 'cargo',
        'go.mod': 'go',
        Gemfile: 'ruby',
    } as const)[manifest] ?? 'unknown';
    return { kind, root, manifest };
}

/** AI-tool presence flags discovered in a project tree. */
export interface ToolPresence {
    readonly augment: boolean;
    readonly claude: boolean;
    readonly cursor: boolean;
    readonly cline: boolean;
    readonly windsurf: boolean;
    readonly agentsMd: boolean;
}

/** Read AI-tool presence flags from `root`. Pure — no writes. */
export function detectToolPresence(root: string): ToolPresence {
    return {
        augment: isDir(join(root, '.augment')),
        claude: isDir(join(root, '.claude')),
        cursor: isDir(join(root, '.cursor')),
        cline: isDir(join(root, '.clinerules')),
        windsurf: isDir(join(root, '.windsurf')) || existsSync(join(root, '.windsurfrules')),
        agentsMd: existsSync(join(root, 'AGENTS.md')),
    };
}

/**
 * Discover packs under a workspace root (`packages/pack-*` convention).
 *
 * Returns absolute paths to every directory under `<workspace>/packages/`
 * whose name starts with `pack-`. v4-only addition — the legacy Python
 * installer has no equivalent because packs are a v4 concept.
 */
export function discoverPacks(workspaceRoot: string): readonly string[] {
    const packagesDir = join(workspaceRoot, 'packages');
    if (!isDir(packagesDir)) {
        return [];
    }
    return readdirSync(packagesDir)
        .filter((name) => name.startsWith('pack-'))
        .map((name) => resolve(packagesDir, name))
        .filter(isDir);
}

/**
 * Locate the agent-config package root from a project root.
 *
 * 1:1 port of `scripts/install.py:detect_package_root` — prefers an
 * npm-installed copy under `node_modules/@event4u/agent-config/`,
 * falls back to the project root itself for in-package development
 * (presence of `config/profiles/minimal.ini` is the development-mode
 * signal in the Python script; we mirror it).
 *
 * Returns `null` instead of failing — caller decides UX (Python `fail`
 * exits the process; the TS engine surfaces the error to the wizard).
 */
export function detectPackageRoot(projectRoot: string): string | null {
    const npmPath = join(projectRoot, 'node_modules', '@event4u', 'agent-config');
    if (isDir(npmPath)) {
        return resolve(npmPath);
    }
    if (existsSync(join(projectRoot, 'config', 'profiles', 'minimal.ini'))) {
        return projectRoot;
    }
    return null;
}

/** Classify a package root as `npm` (under node_modules) or `local`. */
export function detectPackageType(packageRoot: string): 'npm' | 'local' {
    return packageRoot.split(/[\\/]/).includes('node_modules') ? 'npm' : 'local';
}

function isDir(path: string): boolean {
    try {
        return statSync(path).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Result of a v3-on-disk probe. road-to-unified-setup § Phase E2.
 *
 * The v4 wizard renders a backup-screen with two CTAs when a v3 install
 * is detected — `path` reports where the legacy tree lives, `version`
 * carries the first non-empty line of `<path>/VERSION` for the operator
 * banner, `backupTarget` is the suggested destination for the rsync /
 * cp copy. `present: false` short-circuits the banner.
 */
export interface LegacyV3Detection {
    readonly present: boolean;
    readonly path: string;
    readonly version: string | null;
    readonly backupTarget: string;
}

/**
 * Detect a v3.x install at `~/.event4u/agent-config/` (or the override
 * passed in). Returns `present: false` when the directory or the
 * `VERSION` file is missing, or when the recorded major version is not
 * `3.x`. The caller decides what to do with `present: true` — the wire
 * route in `installRoute` exposes the structure 1:1.
 */
export function detectLegacyV3(opts: { home?: string } = {}): LegacyV3Detection {
    const home = opts.home ?? homedir();
    const path = join(home, '.event4u', 'agent-config');
    const backupTarget = join(home, '.event4u', 'agent-config.v3.bak');
    if (!isDir(path)) {
        return { present: false, path, version: null, backupTarget };
    }
    const versionFile = join(path, 'VERSION');
    if (!existsSync(versionFile)) {
        return { present: false, path, version: null, backupTarget };
    }
    let raw = '';
    try {
        raw = readFileSync(versionFile, 'utf8').trim();
    } catch {
        return { present: false, path, version: null, backupTarget };
    }
    const firstLine = raw.split('\n', 1)[0]?.trim() ?? '';
    const major = firstLine.split('.')[0]?.trim();
    if (major !== '3') {
        return { present: false, path, version: firstLine || null, backupTarget };
    }
    return { present: true, path, version: firstLine, backupTarget };
}

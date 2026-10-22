/**
 * Where agent-config's Claude hooks are registered, which runtime they would
 * reach right now, and which of four states that adds up to.
 *
 * `hooks:status` used to answer from one file: `<project>/.claude/settings.json`.
 * Claude Code merges that file with `~/.claude/settings.json`, and a global
 * install registers its hooks in the second, so a working global install read
 * "missing" from any project without its own settings file — every fresh
 * worktree. The same check also read "installed" for a project settings file
 * that merely existed, whatever hooks it carried, foreign ones included.
 *
 * Read-only and never throws: the post-install smoke probe runs this, and a
 * malformed settings file must degrade the report, not abort it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { MANAGED_SIGNATURE } from './claude_settings_hooks.js';

export type ClaudeHookState = 'not-installed' | 'installed-not-executable' | 'executable' | 'observed-at-runtime';

/** The dispatcher a hook command would reach, in the order the command tries them. */
export type ClaudeHookRuntime = 'staged' | 'path-cli' | 'none';

export interface ClaudeHookScope {
    registered_in: Array<'global' | 'project'>;
    /** Commands carrying the managed signature; foreign commands are never counted here. */
    managed_commands: { global: number; project: number };
    foreign_commands: { global: number; project: number };
    runtime: ClaudeHookRuntime;
    runtime_version: string | null;
    /** Set when the runtime that wins is OLDER than the source checkout it serves. */
    version_skew: string | null;
    state: ClaudeHookState;
}

export interface ClaudeHookScopeInput {
    projectRoot: string;
    home: string;
    /** `<event4u root>/runtime` — where the staged runtime and carrier.json live. */
    runtimeRoot: string;
    /** The PATH to search for a global `agent-config`. */
    pathEnv: string;
}

function readJson(file: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Managed and foreign command counts in one settings file. */
function countCommands(file: string): { managed: number; foreign: number } {
    const out = { managed: 0, foreign: 0 };
    const doc = readJson(file);
    const hooks = isObject(doc) ? doc['hooks'] : null;
    if (!isObject(hooks)) return out;
    for (const groups of Object.values(hooks)) {
        if (!Array.isArray(groups)) continue;
        for (const group of groups) {
            const entries = isObject(group) ? group['hooks'] : null;
            if (!Array.isArray(entries)) continue;
            for (const h of entries) {
                const cmd = isObject(h) ? h['command'] : null;
                if (typeof cmd !== 'string') continue;
                if (cmd.includes(MANAGED_SIGNATURE)) out.managed += 1;
                else out.foreign += 1;
            }
        }
    }
    return out;
}

function exists(p: string): boolean {
    try {
        fs.accessSync(p);
        return true;
    } catch {
        return false;
    }
}

function executable(p: string): boolean {
    try {
        fs.accessSync(p, fs.constants.X_OK);
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function versionAt(pkgDir: string): string | null {
    const doc = readJson(path.join(pkgDir, 'package.json'));
    const v = isObject(doc) ? doc['version'] : null;
    return typeof v === 'string' ? v : null;
}

/** Numeric dotted-version compare; a non-numeric part compares as 0. */
function olderThan(a: string, b: string): boolean {
    const pa = a.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
    const pb = b.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0) return d < 0;
    }
    return false;
}

/**
 * The runtime the installed hook command reaches, tried in the SAME order as
 * `build_claude_hook_matrix` — a status that resolved in a different order
 * would report a runtime the hooks never use. That command trusts only two:
 * the staged runtime, then an `agent-config` on PATH whose path is absolute and
 * outside the project. Nothing inside the project counts, however runnable.
 */
function resolveRuntime(input: ClaudeHookScopeInput): { runtime: ClaudeHookRuntime; version: string | null } {
    const { projectRoot, runtimeRoot, pathEnv } = input;
    const current = path.join(runtimeRoot, 'current');
    let nodePath = '';
    try {
        nodePath = fs.readFileSync(path.join(current, 'node'), 'utf8').trim();
    } catch {
        nodePath = '';
    }
    if (nodePath !== '' && executable(nodePath) && exists(path.join(current, 'dist', 'hooks', 'dispatch.js'))) {
        return { runtime: 'staged', version: versionAt(current) };
    }
    const cli = firstOnPath('agent-config', pathEnv);
    if (cli !== null && path.isAbsolute(cli) && !insideDir(cli, projectRoot)) return { runtime: 'path-cli', version: null };
    return { runtime: 'none', version: null };
}

/** `command -v` reads the first PATH hit, so only that one decides. */
function firstOnPath(name: string, pathEnv: string): string | null {
    for (const dir of pathEnv.split(path.delimiter)) {
        if (dir === '') continue;
        const p = path.join(dir, name);
        if (executable(p)) return p;
    }
    return null;
}

function insideDir(p: string, dir: string): boolean {
    const rel = path.relative(path.resolve(dir), path.resolve(p));
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function observedReached(runtimeRoot: string): boolean {
    const doc = readJson(path.join(runtimeRoot, 'carrier.json'));
    const hosts = isObject(doc) ? doc['hosts'] : null;
    const claude = isObject(hosts) ? hosts['claude'] : null;
    return isObject(claude) && claude['outcome'] === 'reached';
}

export function claudeHookScope(input: ClaudeHookScopeInput): ClaudeHookScope {
    const global = countCommands(path.join(input.home, '.claude', 'settings.json'));
    const project = countCommands(path.join(input.projectRoot, '.claude', 'settings.json'));
    const registered_in: Array<'global' | 'project'> = [];
    if (global.managed > 0) registered_in.push('global');
    if (project.managed > 0) registered_in.push('project');

    const { runtime, version } = resolveRuntime(input);

    // A source checkout served by an OLDER staged or global runtime runs the old
    // guards while the maintainer edits the new ones. Surfaced, never enforced
    // here: a status report that refused would hide the very thing it reports.
    let version_skew: string | null = null;
    const isSource = exists(path.join(input.projectRoot, 'src', 'scripts', 'hook_manifest.yaml'));
    const checkoutVersion = isSource ? versionAt(input.projectRoot) : null;
    if (runtime === 'staged' && version !== null && checkoutVersion !== null && olderThan(version, checkoutVersion)) {
        version_skew = `staged runtime ${version} is older than this checkout ${checkoutVersion} — its hooks run the older guards until the checkout's bundle is built (npm run build:hooks) or the runtime is restaged`;
    }

    let state: ClaudeHookState;
    if (registered_in.length === 0) state = 'not-installed';
    else if (runtime === 'none') state = 'installed-not-executable';
    else if (observedReached(input.runtimeRoot)) state = 'observed-at-runtime';
    else state = 'executable';

    return {
        registered_in,
        managed_commands: { global: global.managed, project: project.managed },
        foreign_commands: { global: global.foreign, project: project.foreign },
        runtime,
        runtime_version: version,
        version_skew,
        state,
    };
}

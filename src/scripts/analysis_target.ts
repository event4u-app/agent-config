#!/usr/bin/env tsx
/**
 * analysis_target.ts — resolve what an analysis door is about to read: the
 * project, the scope inside it, and whether a PR can be opened from it.
 *
 *   ./scripts-run src/scripts/analysis_target                 # prints the scope line
 *   ./scripts-run src/scripts/analysis_target --json          # the full record
 *   ./scripts-run src/scripts/analysis_target --scope=repo    # widen to the project
 *   ./scripts-run src/scripts/analysis_target --scope <path>  # a path inside the project
 *   ./scripts-run src/scripts/analysis_target --project <dir> # fix the project root
 *
 * Composes `find_project_root_with_anchor` with an outer walk and leaves the
 * walk itself untouched, because the settings cascade depends on it. The
 * inner walk alone returns a marked module as the project and an unmarked one
 * as the repository root; the outer walk is what places both under the outer
 * project. Exit 0 resolved, 2 refused.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    ANCHOR_GIT,
    PROJECT_ROOT_ENV,
    enumerate_modules,
    find_project_root_with_anchor,
    project_settings_path,
} from './_lib/agent_settings.js';
import { detect_module_roots } from './_lib/module_detection.js';

const HERE = fileURLToPath(import.meta.url);

export type ScopeKind = 'repo' | 'module' | 'subdir';
export type Vcs = 'git' | 'none';

export interface PrTarget {
    available: boolean;
    branch: string | null;
    reason: 'branch' | 'detached-head' | 'empty-repository' | 'no-vcs';
}

export interface AnalysisTarget {
    project_root: string;
    scope_root: string;
    scope_kind: ScopeKind;
    scope_name: string;
    anchor: string;
    module_source: 'modules-config' | 'detected' | null;
    vcs: Vcs;
    pr_target: PrTarget;
    ac_installed: boolean;
}

export interface ResolveOptions {
    cwd?: string;
    project?: string | null;
    scope?: string | null;
    env?: NodeJS.ProcessEnv;
}

export class AnalysisTargetError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AnalysisTargetError';
    }
}

function realOrAbsolute(p: string): string {
    const absolute = path.resolve(p);
    try {
        return fs.realpathSync(absolute);
    } catch {
        return absolute;
    }
}

function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

export function isInside(child: string, parent: string): boolean {
    const rel = path.relative(parent, child);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Every anchored root from `start` outward, innermost first. Stops after the
 * first `.git` anchor: a nested repository below an outer one is a boundary,
 * so a submodule or worktree stays its own scope.
 */
export function anchoredRoots(start: string): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    let cursor: string | null = start;
    while (cursor !== null) {
        const hit = find_project_root_with_anchor(cursor);
        if (hit === null) break;
        out.push(hit);
        if (hit[1] === ANCHOR_GIT) break;
        const parent = path.dirname(hit[0]);
        cursor = parent === hit[0] ? null : parent;
    }
    return out;
}

/** Module directories of `root`; configured modules come first and win on conflict. */
export function moduleDirs(root: string): Array<{ dir: string; source: 'modules-config' | 'detected' }> {
    const out: Array<{ dir: string; source: 'modules-config' | 'detected' }> = [];
    const seen = new Set<string>();
    let configured: ReturnType<typeof enumerate_modules> = [];
    try {
        configured = enumerate_modules({ project_root: root, cwd: root });
    } catch {
        configured = [];
    }
    for (const entry of configured) {
        const dir = realOrAbsolute(path.join(root, entry.module_path));
        if (!seen.has(dir)) {
            seen.add(dir);
            out.push({ dir, source: 'modules-config' });
        }
    }
    for (const candidate of detect_module_roots(root)) {
        if (candidate.confidence !== 'high') continue;
        const parent = path.join(root, candidate.path);
        let children: string[] = [];
        try {
            children = fs.readdirSync(parent).sort();
        } catch {
            continue;
        }
        for (const name of children) {
            if (name.startsWith('.')) continue;
            const child = path.join(parent, name);
            if (!isDir(child)) continue;
            const dir = realOrAbsolute(child);
            if (!seen.has(dir)) {
                seen.add(dir);
                out.push({ dir, source: 'detected' });
            }
        }
    }
    return out;
}

function gitDirOf(root: string): string | null {
    const dotGit = path.join(root, '.git');
    let stat: fs.Stats;
    try {
        stat = fs.statSync(dotGit);
    } catch {
        return null;
    }
    if (stat.isDirectory()) return dotGit;
    const match = /^gitdir:\s*(.+)\s*$/m.exec(fs.readFileSync(dotGit, 'utf8'));
    return match ? path.resolve(root, match[1] as string) : null;
}

function refExists(gitDir: string, ref: string): boolean {
    const commonFile = path.join(gitDir, 'commondir');
    const common = fs.existsSync(commonFile)
        ? path.resolve(gitDir, fs.readFileSync(commonFile, 'utf8').trim())
        : gitDir;
    for (const dir of [gitDir, common]) {
        if (fs.existsSync(path.join(dir, ref))) return true;
        const packed = path.join(dir, 'packed-refs');
        if (fs.existsSync(packed) && fs.readFileSync(packed, 'utf8').split('\n').some((l) => l.endsWith(` ${ref}`))) {
            return true;
        }
    }
    return false;
}

export function readPrTarget(projectRoot: string): { vcs: Vcs; pr_target: PrTarget } {
    const gitDir = gitDirOf(projectRoot);
    if (gitDir === null) {
        return { vcs: 'none', pr_target: { available: false, branch: null, reason: 'no-vcs' } };
    }
    let head = '';
    try {
        head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    } catch {
        return { vcs: 'git', pr_target: { available: false, branch: null, reason: 'empty-repository' } };
    }
    const symbolic = /^ref:\s*(refs\/heads\/(.+))$/.exec(head);
    if (symbolic === null) {
        return { vcs: 'git', pr_target: { available: false, branch: null, reason: 'detached-head' } };
    }
    const branch = symbolic[2] as string;
    if (!refExists(gitDir, symbolic[1] as string)) {
        return { vcs: 'git', pr_target: { available: false, branch, reason: 'empty-repository' } };
    }
    return { vcs: 'git', pr_target: { available: true, branch, reason: 'branch' } };
}

function classify(
    scope: string,
    projectRoot: string,
): { kind: ScopeKind; root: string; source: AnalysisTarget['module_source'] } {
    for (const mod of moduleDirs(projectRoot)) {
        if (isInside(scope, mod.dir)) {
            return { kind: 'module', root: mod.dir, source: mod.source };
        }
    }
    if (scope === projectRoot) return { kind: 'repo', root: projectRoot, source: null };
    return { kind: 'subdir', root: scope, source: null };
}

/**
 * Precedence: `--project` / `AGENT_CONFIG_PROJECT_ROOT` fix the project; a
 * cwd inside a module of an outer anchored root makes that root the project
 * whether or not the module carries its own `agents/` marker; otherwise the
 * innermost walk stands. `--scope` must resolve inside the project.
 */
export function resolveAnalysisTarget(options: ResolveOptions = {}): AnalysisTarget {
    const env = options.env ?? process.env;
    const cwd = realOrAbsolute(options.cwd ?? process.cwd());
    const explicit = options.project ?? env[PROJECT_ROOT_ENV] ?? null;

    let projectRoot: string;
    let anchor: string;
    let moduleHit: { root: string; source: AnalysisTarget['module_source'] } | null = null;

    if (explicit !== null && explicit !== '') {
        projectRoot = realOrAbsolute(path.resolve(cwd, explicit));
        if (!isDir(projectRoot)) {
            throw new AnalysisTargetError(`project root is not a directory: ${projectRoot}`);
        }
        anchor = 'explicit';
    } else {
        const roots = anchoredRoots(cwd);
        if (roots.length === 0) {
            projectRoot = cwd;
            anchor = 'cwd-fallback';
        } else {
            [projectRoot, anchor] = roots[0] as [string, string];
            for (const [outer, outerAnchor] of [...roots].reverse()) {
                const hit = classify(cwd, outer);
                if (hit.kind === 'module') {
                    projectRoot = outer;
                    anchor = outerAnchor;
                    moduleHit = { root: hit.root, source: hit.source };
                    break;
                }
            }
        }
    }

    let scopeRoot: string;
    let kind: ScopeKind;
    let source: AnalysisTarget['module_source'] = null;
    const scopeArg = options.scope ?? null;
    if (scopeArg === 'repo') {
        scopeRoot = projectRoot;
        kind = 'repo';
    } else {
        let requested: string;
        if (scopeArg !== null && scopeArg !== '') {
            requested = realOrAbsolute(path.resolve(cwd, scopeArg));
            if (!isInside(requested, projectRoot)) {
                throw new AnalysisTargetError(
                    `--scope resolves outside the project root: ${requested} is not inside ${projectRoot}`,
                );
            }
        } else if (isInside(cwd, projectRoot)) {
            requested = cwd;
        } else {
            requested = projectRoot;
        }
        if (moduleHit !== null && requested === cwd) {
            scopeRoot = moduleHit.root;
            kind = 'module';
            source = moduleHit.source;
        } else {
            const hit = classify(requested, projectRoot);
            scopeRoot = hit.root;
            kind = hit.kind;
            source = hit.source;
        }
    }

    const { vcs, pr_target } = readPrTarget(projectRoot);
    return {
        project_root: projectRoot,
        scope_root: scopeRoot,
        scope_kind: kind,
        scope_name: path.basename(scopeRoot),
        anchor,
        module_source: source,
        vcs,
        pr_target,
        ac_installed: fs.existsSync(project_settings_path(projectRoot)),
    };
}

export function scopeLine(target: AnalysisTarget): string {
    return `Scope: ${target.scope_kind} ${target.scope_name} at ${target.scope_root} (anchor: ${target.anchor})`;
}

function readFlag(argv: string[], name: string): string | null {
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] as string;
        if (arg === `--${name}`) return argv[i + 1] ?? null;
        if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3);
    }
    return null;
}

export function main(argv: string[] = process.argv.slice(2), cwd: string = process.cwd()): number {
    try {
        const target = resolveAnalysisTarget({ cwd, project: readFlag(argv, 'project'), scope: readFlag(argv, 'scope') });
        if (argv.includes('--json')) {
            process.stdout.write(`${JSON.stringify(target, null, 2)}\n`);
        } else {
            process.stdout.write(`${scopeLine(target)}\n`);
        }
        return 0;
    } catch (error) {
        if (error instanceof AnalysisTargetError) {
            process.stderr.write(`analysis_target: ${error.message}\n`);
            return 2;
        }
        throw error;
    }
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main());
}

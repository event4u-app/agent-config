import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    AnalysisTargetError,
    main,
    resolveAnalysisTarget,
    scopeLine,
} from '../../src/scripts/analysis_target.js';

let base: string;
let savedHome: string | undefined;
let savedEnv: string | undefined;

function mk(...parts: string[]): string {
    const p = path.join(base, ...parts);
    fs.mkdirSync(p, { recursive: true });
    return p;
}

function write(rel: string, body: string): void {
    const p = path.join(base, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

/** A git repository with one commit on `main`, written by hand so no git binary is needed. */
function gitRepo(rel: string): string {
    const root = mk(rel);
    write(path.join(rel, '.git/HEAD'), 'ref: refs/heads/main\n');
    write(path.join(rel, '.git/refs/heads/main'), `${'a'.repeat(40)}\n`);
    return root;
}

beforeEach(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-target-')));
    savedHome = process.env['HOME'];
    savedEnv = process.env['AGENT_CONFIG_PROJECT_ROOT'];
    process.env['HOME'] = mk('home');
    delete process.env['AGENT_CONFIG_PROJECT_ROOT'];
});

afterEach(() => {
    if (savedHome === undefined) delete process.env['HOME'];
    else process.env['HOME'] = savedHome;
    if (savedEnv === undefined) delete process.env['AGENT_CONFIG_PROJECT_ROOT'];
    else process.env['AGENT_CONFIG_PROJECT_ROOT'] = savedEnv;
    fs.rmSync(base, { recursive: true, force: true });
});

describe('resolveAnalysisTarget', () => {
    it('resolves the repository root as a repo scope', () => {
        const root = gitRepo('proj');
        const t = resolveAnalysisTarget({ cwd: root });
        expect(t).toMatchObject({ project_root: root, scope_root: root, scope_kind: 'repo', anchor: 'git', vcs: 'git' });
        expect(t.pr_target).toEqual({ available: true, branch: 'main', reason: 'branch' });
        expect(scopeLine(t)).toBe(`Scope: repo proj at ${root} (anchor: git)`);
    });

    it('resolves a plain subfolder as a subdir scope of the outer project', () => {
        const root = gitRepo('proj');
        const sub = mk('proj', 'lib', 'deep');
        const t = resolveAnalysisTarget({ cwd: sub });
        expect(t).toMatchObject({ project_root: root, scope_root: sub, scope_kind: 'subdir' });
    });

    it('places a cwd inside an unmarked module under the outer project', () => {
        const root = gitRepo('proj');
        mk('proj', 'app', 'Modules', 'Foo', 'agents');
        const deep = mk('proj', 'app', 'Modules', 'Foo', 'src');
        const t = resolveAnalysisTarget({ cwd: deep });
        expect(t).toMatchObject({
            project_root: root,
            scope_root: path.join(root, 'app/Modules/Foo'),
            scope_kind: 'module',
            scope_name: 'Foo',
            module_source: 'detected',
        });
    });

    it('places a cwd inside a module with its own agents/roadmaps under the outer project', () => {
        const root = gitRepo('proj');
        mk('proj', 'app', 'Modules', 'Foo', 'agents', 'roadmaps');
        const deep = mk('proj', 'app', 'Modules', 'Foo', 'src');
        const t = resolveAnalysisTarget({ cwd: deep });
        expect(t).toMatchObject({
            project_root: root,
            scope_root: path.join(root, 'app/Modules/Foo'),
            scope_kind: 'module',
            anchor: 'git',
        });
    });

    it('prefers a configured module over detection', () => {
        const root = gitRepo('proj');
        write('proj/.agent-project-settings.yml', 'modules:\n  root_paths: [domains]\n');
        const deep = mk('proj', 'domains', 'billing', 'src');
        const t = resolveAnalysisTarget({ cwd: deep });
        expect(t).toMatchObject({
            project_root: root,
            scope_root: path.join(root, 'domains/billing'),
            scope_kind: 'module',
            module_source: 'modules-config',
        });
    });

    it('widens to the project with --scope=repo', () => {
        const root = gitRepo('proj');
        const deep = mk('proj', 'app', 'Modules', 'Foo', 'src');
        const t = resolveAnalysisTarget({ cwd: deep, scope: 'repo' });
        expect(t).toMatchObject({ project_root: root, scope_root: root, scope_kind: 'repo' });
    });

    it('refuses a --scope outside the project root', () => {
        const root = gitRepo('proj');
        const outside = mk('elsewhere');
        expect(() => resolveAnalysisTarget({ cwd: root, scope: outside })).toThrow(AnalysisTargetError);
    });

    it('refuses a --scope symlink whose target escapes the project root', () => {
        const root = gitRepo('proj');
        const outside = mk('elsewhere', 'secret');
        fs.symlinkSync(outside, path.join(root, 'link'));
        expect(() => resolveAnalysisTarget({ cwd: root, scope: 'link' })).toThrow(/outside the project root/);
    });

    it('treats a nested repository as its own scope', () => {
        gitRepo('proj');
        const sub = mk('proj', 'vendor', 'lib');
        write('proj/vendor/lib/.git', 'gitdir: ../../.git/modules/lib\n');
        write('proj/.git/modules/lib/HEAD', 'ref: refs/heads/main\n');
        write('proj/.git/modules/lib/refs/heads/main', `${'b'.repeat(40)}\n`);
        const t = resolveAnalysisTarget({ cwd: sub });
        expect(t).toMatchObject({ project_root: sub, scope_kind: 'repo', anchor: 'git' });
        expect(t.pr_target.available).toBe(true);
    });

    it('reports no PR target on a detached HEAD', () => {
        const root = gitRepo('proj');
        write('proj/.git/HEAD', `${'c'.repeat(40)}\n`);
        expect(resolveAnalysisTarget({ cwd: root }).pr_target).toEqual({
            available: false,
            branch: null,
            reason: 'detached-head',
        });
    });

    it('reports no PR target in an empty repository', () => {
        const root = mk('proj');
        write('proj/.git/HEAD', 'ref: refs/heads/main\n');
        expect(resolveAnalysisTarget({ cwd: root }).pr_target.reason).toBe('empty-repository');
    });

    it('reports vcs none without git and falls back to the cwd', () => {
        const dir = mk('plain', 'dir');
        const t = resolveAnalysisTarget({ cwd: dir });
        expect(t).toMatchObject({ project_root: dir, scope_kind: 'repo', vcs: 'none', anchor: 'cwd-fallback' });
        expect(t.pr_target.reason).toBe('no-vcs');
    });

    it('reports whether agent-config is installed', () => {
        const root = gitRepo('proj');
        expect(resolveAnalysisTarget({ cwd: root }).ac_installed).toBe(false);
        write('proj/agents/settings/.agent-settings.yml', 'personal: {}\n');
        expect(resolveAnalysisTarget({ cwd: root }).ac_installed).toBe(true);
    });

    it('lets --project fix the project root', () => {
        const root = gitRepo('proj');
        const t = resolveAnalysisTarget({ cwd: mk('elsewhere'), project: root });
        expect(t).toMatchObject({ project_root: root, scope_root: root, anchor: 'explicit' });
    });
});

describe('main', () => {
    it('exits 2 on a refused scope', () => {
        const root = gitRepo('proj');
        expect(main(['--scope', mk('elsewhere')], root)).toBe(2);
    });
});

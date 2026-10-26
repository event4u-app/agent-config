import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { graphHome, graphsRoot, homeDirs, hubDir, isHomeDir, legacyGraphsRoot, projectCachePath } from '../../../src/scripts/code_graph/graph_home.js';
import { repoIdentity } from '../../../src/scripts/code_graph/repo_identity.js';

let tmp: string;
let env: Record<string, string>;

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-graph-home-')));
    env = { EVENT4U_CONFIG_HOME: path.join(tmp, 'home') };
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('graphHome — a root with a project home', () => {
    it('keeps graph, map and caches in one folder, agents/map/, with .build/ for the caches', () => {
        const root = path.join(tmp, 'proj');
        fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
        const h = graphHome(root, env);
        const build = path.join(root, 'agents', 'map', '.build');
        expect(h.kind).toBe('project');
        expect(h.mapDir).toBe(path.join(root, 'agents', 'map'));
        expect(h.buildDir).toBe(build);
        expect(h.cachePath).toBe(path.join(build, 'code-graph-v1.json'));
        expect(h.buildCachePath).toBe(h.cachePath);
        expect(h.lockPath).toBe(path.join(build, 'code-graph-refresh.lock'));
        expect(h.autoRefreshPath).toBe(path.join(build, 'code-graph-auto-refresh.json'));
        expect(fs.existsSync(env.EVENT4U_CONFIG_HOME!)).toBe(false);
        expect(fs.existsSync(build)).toBe(false);
    });

    it('reads the pre-ADR-303 cache and opt-in while only they exist, and always builds into .build/', () => {
        const root = path.join(tmp, 'old');
        const legacy = path.join(root, 'agents', 'runtime', 'state');
        fs.mkdirSync(legacy, { recursive: true });
        fs.writeFileSync(path.join(legacy, 'code-graph-v1.json'), '{}');
        fs.writeFileSync(path.join(legacy, 'code-graph-auto-refresh.json'), '{}');
        const before = graphHome(root, env);
        expect(before.cachePath).toBe(path.join(legacy, 'code-graph-v1.json'));
        expect(projectCachePath(root)).toBe(before.cachePath);
        expect(before.autoRefreshPath).toBe(path.join(legacy, 'code-graph-auto-refresh.json'));
        expect(before.buildCachePath).toBe(path.join(root, 'agents', 'map', '.build', 'code-graph-v1.json'));
        expect(before.lockPath.startsWith(path.join(root, 'agents', 'map', '.build'))).toBe(true);
        fs.mkdirSync(before.buildDir, { recursive: true });
        fs.writeFileSync(before.buildCachePath, '{}');
        const after = graphHome(root, env);
        expect(after.cachePath).toBe(after.buildCachePath);
        expect(projectCachePath(root)).toBe(after.buildCachePath);
    });

    it('treats a project install (`.agent-settings.yml`) as a project home without creating agents/', () => {
        const root = path.join(tmp, 'installed');
        fs.mkdirSync(root, { recursive: true });
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), 'project: {}\n');
        const h = graphHome(root, env);
        expect(h.kind).toBe('project');
        expect(h.cachePath).toBe(path.join(root, 'agents', 'map', '.build', 'code-graph-v1.json'));
        expect(fs.existsSync(path.join(root, 'agents'))).toBe(false);
    });
});

describe('graphHome — a root without one', () => {
    it('lives in the hub as map/<repo id>-<checkout>/ and never creates agents/', () => {
        const root = path.join(tmp, 'foreign');
        fs.mkdirSync(root, { recursive: true });
        execFileSync('git', ['-C', root, 'init', '-q']);
        const h = graphHome(root, env);
        expect(h.kind).toBe('global');
        const id = repoIdentity(root, env).repoId;
        expect(h.repoId).toBe(id);
        expect(path.dirname(h.dir)).toBe(graphsRoot(env));
        expect(path.basename(h.dir)).toMatch(new RegExp(`^${id}-[0-9a-f]{8}$`));
        expect(graphsRoot(env)).toBe(hubDir(env));
        expect(hubDir(env)).toBe(path.join(env.EVENT4U_CONFIG_HOME!, 'map'));
        expect(h.mapDir).toBe(h.dir);
        expect(h.cachePath).toBe(path.join(h.dir, '.build', 'code-graph-v1.json'));
        expect(h.lockPath).toBe(path.join(h.dir, '.build', 'code-graph-refresh.lock'));
        expect(h.legacyDir).toBe(path.join(legacyGraphsRoot(env), path.basename(h.dir), 'state'));
        expect(fs.existsSync(path.join(root, 'agents'))).toBe(false);
    });

    it('reads a home an older release wrote under runtime/graphs/ until the hub holds one', () => {
        const root = path.join(tmp, 'foreign-old');
        fs.mkdirSync(root, { recursive: true });
        execFileSync('git', ['-C', root, 'init', '-q']);
        const h = graphHome(root, env);
        fs.mkdirSync(h.legacyDir, { recursive: true });
        fs.writeFileSync(path.join(h.legacyDir, 'code-graph-v1.json'), '{}');
        expect(graphHome(root, env).cachePath).toBe(path.join(h.legacyDir, 'code-graph-v1.json'));
        expect(graphHome(root, env).buildCachePath).toBe(path.join(h.dir, '.build', 'code-graph-v1.json'));
    });

    it('lists homes in both places and never takes the hub\'s own entries for one', () => {
        const hub = hubDir(env);
        for (const d of ['projects', '.build', 'abc-1', path.join('..', 'runtime', 'graphs', 'def-2')]) fs.mkdirSync(path.join(hub, d), { recursive: true });
        fs.writeFileSync(path.join(hub, 'index.html'), '');
        expect(homeDirs(env).map((d) => path.basename(d)).sort()).toEqual(['abc-1', 'def-2']);
        expect(isHomeDir(path.join(hub, 'abc-1'), env)).toBe(true);
        expect(isHomeDir(path.join(legacyGraphsRoot(env), 'def-2'), env)).toBe(true);
        for (const own of ['projects', '.build', 'index.html', '']) expect(isHomeDir(path.join(hub, own), env)).toBe(false);
        expect(isHomeDir(path.join(hub, 'abc-1', 'code'), env)).toBe(false);
    });

    it('gives two clones of one origin (https and ssh) one repo id and separate homes', () => {
        const clone = (name: string, origin: string): string => {
            const dir = path.join(tmp, name);
            fs.mkdirSync(dir, { recursive: true });
            execFileSync('git', ['-C', dir, 'init', '-q']);
            execFileSync('git', ['-C', dir, 'remote', 'add', 'origin', origin]);
            return dir;
        };
        const a = graphHome(clone('clone-a', 'https://github.com/Acme/widget.git'), env);
        const b = graphHome(clone('clone-b', 'git@github.com:Acme/widget.git'), env);
        expect(a.repoId).toBe(b.repoId);
        expect(a.dir).not.toBe(b.dir);
        expect(a.lockPath).not.toBe(b.lockPath);
        expect(a.cachePath).not.toBe(b.cachePath);
    });

    it('gives a worktree its own writable home under the shared repo id', () => {
        const main = path.join(tmp, 'm');
        fs.mkdirSync(main, { recursive: true });
        const g = (...a: string[]): string => execFileSync('git', ['-C', main, ...a], { encoding: 'utf-8' });
        g('init', '-q');
        fs.writeFileSync(path.join(main, 'a.ts'), 'export const a = 1;\n');
        g('add', 'a.ts');
        g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'a');
        const wt = path.join(tmp, 'w');
        g('worktree', 'add', '-q', wt);
        const hm = graphHome(main, env);
        const hw = graphHome(wt, env);
        expect(hw.repoId).toBe(hm.repoId);
        expect(hw.dir).not.toBe(hm.dir);
        expect(path.basename(hw.dir).startsWith(`${hm.repoId}-`)).toBe(true);
    });
});

describe('graphHome — every reader and writer goes through it (2.4)', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');

    it('names the three path constants only in graph_home.ts and the writer gate that checks them', () => {
        const hits = execFileSync('git', ['-C', repoRoot, 'grep', '-n', '-w', '-E', '(NATIVE_CACHE_REL|MAP_DIR_REL|LOCK_REL)', '--', 'src/scripts/*.ts'], {
            encoding: 'utf-8',
        })
            .split('\n')
            .filter(Boolean)
            .map((l) => l.split(':')[0]);
        expect([...new Set(hits)].sort()).toEqual(['src/scripts/check_graph_writers.ts', 'src/scripts/code_graph/graph_home.ts']);
    });

    it('keeps this repository\'s graph, map and lock in agents/map/', async () => {
        const { buildCacheFor } = await import('../../../src/scripts/code_graph/cli.js');
        const h = graphHome(repoRoot, env);
        expect(h.kind).toBe('project');
        expect(buildCacheFor(repoRoot)).toBe(path.join(repoRoot, 'agents', 'map', '.build', 'code-graph-v1.json'));
        expect(h.mapDir).toBe(path.join(repoRoot, 'agents', 'map'));
        expect(h.lockPath).toBe(path.join(repoRoot, 'agents', 'map', '.build', 'code-graph-refresh.lock'));
    });

    it('sends a root without a project home to the user-global cache in every module', async () => {
        const { cacheFor } = await import('../../../src/scripts/code_graph/cli.js');
        const root = path.join(tmp, 'bare');
        fs.mkdirSync(root, { recursive: true });
        const saved = process.env.EVENT4U_CONFIG_HOME;
        process.env.EVENT4U_CONFIG_HOME = env.EVENT4U_CONFIG_HOME;
        try {
            expect(cacheFor(root)).toBe(graphHome(root, env).cachePath);
            expect(cacheFor(root).startsWith(graphsRoot(env))).toBe(true);
        } finally {
            process.env.EVENT4U_CONFIG_HOME = saved;
        }
    });
});

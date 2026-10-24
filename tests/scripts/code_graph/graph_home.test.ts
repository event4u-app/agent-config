import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { graphHome, graphsRoot } from '../../../src/scripts/code_graph/graph_home.js';
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
    it('keeps today\'s paths under <root>/agents/ when agents/ exists', () => {
        const root = path.join(tmp, 'proj');
        fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
        const h = graphHome(root, env);
        expect(h.kind).toBe('project');
        expect(h.cachePath).toBe(path.join(root, 'agents', 'runtime', 'state', 'code-graph-v1.json'));
        expect(h.stateDir).toBe(path.join(root, 'agents', 'runtime', 'state'));
        expect(h.mapDir).toBe(path.join(root, 'agents', 'map'));
        expect(h.lockPath).toBe(path.join(root, 'agents', 'runtime', 'state', 'code-graph-refresh.lock'));
        expect(h.autoRefreshPath).toBe(path.join(root, 'agents', 'runtime', 'state', 'code-graph-auto-refresh.json'));
        expect(fs.existsSync(env.EVENT4U_CONFIG_HOME!)).toBe(false);
    });

    it('treats a project install (`.agent-settings.yml`) as a project home without creating agents/', () => {
        const root = path.join(tmp, 'installed');
        fs.mkdirSync(root, { recursive: true });
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), 'project: {}\n');
        const h = graphHome(root, env);
        expect(h.kind).toBe('project');
        expect(h.cachePath).toBe(path.join(root, 'agents', 'runtime', 'state', 'code-graph-v1.json'));
        expect(fs.existsSync(path.join(root, 'agents'))).toBe(false);
    });
});

describe('graphHome — a root without one', () => {
    it('lives under runtime/graphs/<repo id> and never creates agents/', () => {
        const root = path.join(tmp, 'foreign');
        fs.mkdirSync(root, { recursive: true });
        execFileSync('git', ['-C', root, 'init', '-q']);
        const h = graphHome(root, env);
        expect(h.kind).toBe('global');
        const id = repoIdentity(root, env).repoId;
        expect(h.repoId).toBe(id);
        expect(h.dir).toBe(path.join(graphsRoot(env), id));
        expect(graphsRoot(env)).toBe(path.join(env.EVENT4U_CONFIG_HOME!, 'runtime', 'graphs'));
        expect(h.cachePath).toBe(path.join(h.dir, 'state', 'code-graph-v1.json'));
        expect(h.mapDir).toBe(path.join(h.dir, 'map'));
        expect(h.lockPath).toBe(path.join(h.dir, 'state', 'code-graph-refresh.lock'));
        expect(fs.existsSync(path.join(root, 'agents'))).toBe(false);
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

    it('names the three path constants only in graph_home.ts', () => {
        const hits = execFileSync('git', ['-C', repoRoot, 'grep', '-n', '-w', '-E', '(NATIVE_CACHE_REL|MAP_DIR_REL|LOCK_REL)', '--', 'src/scripts/*.ts'], {
            encoding: 'utf-8',
        })
            .split('\n')
            .filter(Boolean)
            .map((l) => l.split(':')[0]);
        expect([...new Set(hits)]).toEqual(['src/scripts/code_graph/graph_home.ts']);
    });

    it('keeps this repository\'s graph, map and lock exactly where they are today', async () => {
        const { cacheFor } = await import('../../../src/scripts/code_graph/cli.js');
        const h = graphHome(repoRoot, env);
        expect(h.kind).toBe('project');
        expect(cacheFor(repoRoot)).toBe(path.join(repoRoot, 'agents', 'runtime', 'state', 'code-graph-v1.json'));
        expect(h.mapDir).toBe(path.join(repoRoot, 'agents', 'map'));
        expect(h.lockPath).toBe(path.join(repoRoot, 'agents', 'runtime', 'state', 'code-graph-refresh.lock'));
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

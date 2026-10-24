import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { graphHome, graphsRoot } from '../../../src/scripts/code_graph/graph_home.js';

const CLI = path.resolve('src/scripts/code_graph/cli.ts');
const TSX = path.resolve('node_modules/.bin/tsx');

let tmp: string;
let repo: string;
let home: string;

function run(args: string[]): { status: number; stdout: string; stderr: string } {
    const env: NodeJS.ProcessEnv = { ...process.env, EVENT4U_CONFIG_HOME: home };
    delete env['AGENT_CONFIG_PROJECT_ROOT'];
    delete env['AGENT_CONFIG_ROOT_OVERRIDE'];
    try {
        const stdout = execFileSync(TSX, [CLI, ...args], { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return { status: 0, stdout, stderr: '' };
    } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string };
        return { status: err.status ?? -1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
}

const git = (...a: string[]): string => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' });

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-foreign-')));
    repo = path.join(tmp, 'foreign');
    home = path.join(tmp, 'home');
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'a.ts'), 'export function hi(): number {\n    return 1;\n}\n');
    git('init', '-q');
    git('add', '-A');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'one file');
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('a repository without agents/ (ADR-299, 2.5)', () => {
    it('build and map write nothing into it; the graph sits under the user-global home', () => {
        const build = run(['build', '--root', repo]);
        expect(build.status, build.stderr).toBe(0);
        const map = run(['map', '--root', repo, '--no-verify']);
        expect(map.status, map.stderr).toBe(0);

        expect(git('status', '--porcelain', '--untracked-files=all', '--ignored')).toBe('');
        expect(fs.existsSync(path.join(repo, 'agents'))).toBe(false);

        const h = graphHome(repo, { EVENT4U_CONFIG_HOME: home });
        expect(h.kind).toBe('global');
        expect(h.cachePath.startsWith(graphsRoot({ EVENT4U_CONFIG_HOME: home }))).toBe(true);
        expect(fs.existsSync(h.cachePath)).toBe(true);
        expect(fs.existsSync(path.join(h.mapDir, 'map.json'))).toBe(true);
        expect(build.stdout).toContain(`cache: ${h.cachePath}`);
    }, 120_000);

    it('detect and a query answer from that home', () => {
        expect(run(['build', '--root', repo]).status).toBe(0);
        const detect = run(['detect', '--root', repo, '--format', 'json']);
        expect(JSON.parse(detect.stdout).verdict).toBe('FRESH');
        const q = run(['query', 'hi', '--root', repo]);
        expect(q.status, q.stderr).toBe(0);
        expect(q.stdout).toMatch(/source: native:/);
        expect(git('status', '--porcelain', '--untracked-files=all', '--ignored')).toBe('');
    }, 120_000);

    it('refuses auto-refresh, which serves project homes only', () => {
        const r = run(['auto-refresh', 'on', '--root', repo]);
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/needs a project home/);
        expect(git('status', '--porcelain', '--untracked-files=all', '--ignored')).toBe('');
    });
});

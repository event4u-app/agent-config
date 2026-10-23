import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../../src/scripts/code_graph/cli.js';

const CLI = path.resolve('src/scripts/code_graph/cli.ts');
const TSX = path.resolve('node_modules/.bin/tsx');

let project: string;

function run(args: string[], cwd: string): { status: number; stdout: string } {
    const env = { ...process.env };
    delete env['AGENT_CONFIG_PROJECT_ROOT'];
    delete env['AGENT_CONFIG_ROOT_OVERRIDE'];
    try {
        const stdout = execFileSync(TSX, [CLI, ...args], { cwd, env, encoding: 'utf8' });
        return { status: 0, stdout };
    } catch (e) {
        const err = e as { status?: number; stdout?: string };
        return { status: err.status ?? -1, stdout: err.stdout ?? '' };
    }
}

beforeEach(() => {
    project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-consumer-')));
    fs.mkdirSync(path.join(project, '.git'));
    fs.mkdirSync(path.join(project, 'app', 'deep'), { recursive: true });
    fs.writeFileSync(path.join(project, 'app', 'a.ts'), "import { b } from './b.js';\nexport const a = (): number => b();\n");
    fs.writeFileSync(path.join(project, 'app', 'b.ts'), 'export function b(): number { return 1; }\n');
});
afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true });
});

describe('code-graph in a consumer project (D1, D2)', () => {
    it('a flagless build from a nested directory indexes the project, not the package', () => {
        const r = run(['build'], path.join(project, 'app', 'deep'));
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/— 2 files ·/);
    });

    it('writes the cache under the project, where detect and MCP read it', () => {
        expect(run(['build'], project).status).toBe(0);
        expect(fs.existsSync(path.join(project, 'agents', 'runtime', 'state', 'code-graph-v1.json'))).toBe(true);
        const detect = run(['detect', '--format', 'json'], project);
        expect(JSON.parse(detect.stdout).verdict).toBe('FRESH');
    });

    it('never writes into the package tree when run for another project', () => {
        const pkgCache = path.join(REPO_ROOT, 'agents', 'runtime', 'state', 'code-graph-v1.json');
        const before = fs.existsSync(pkgCache) ? fs.statSync(pkgCache).mtimeMs : null;
        expect(run(['build'], project).status).toBe(0);
        const after = fs.existsSync(pkgCache) ? fs.statSync(pkgCache).mtimeMs : null;
        expect(after).toBe(before);
    });
});

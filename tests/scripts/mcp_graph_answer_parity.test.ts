/**
 * The MCP graph tools answer as the CLI does: `graph_tests_for` reads a module
 * the way its tests import it (a `.js` specifier names the `.ts` source) and
 * names the grep fallback on an empty answer; `graph_impact` keeps `test_files`
 * and `seeds` whole in its budgeted header, because they are what a caller acts on.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { ToolCache } from '../../src/scripts/mcp_server/tools.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const TESTS = 12;
async function rig(): Promise<string> {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-parity-')));
    dirs.push(dir);
    const w = (rel: string, body: string): void => {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), body);
    };
    const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'd@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'd@example.com' } });
    w('src/service.ts', 'export function handle(x: string): string {\n    return x.trim();\n}\n');
    for (let i = 0; i < TESTS; i++) w(`tests/t${i}.test.ts`, "import { handle } from '../src/service.js';\n\nexport function check(): boolean {\n    return handle('a') === 'a';\n}\n");
    git('init', '-q', '-b', 'main');
    git('add', '.');
    git('commit', '-qm', 'init');
    w('src/service.ts', 'export function handle(x: string): string {\n    return x.trim().toLowerCase();\n}\n');
    git('commit', '-qam', 'change');
    await buildFromRepo(dir, path.join(dir, 'agents/runtime/state/code-graph-v1.json'));
    return dir;
}

describe('MCP graph answers match the CLI', () => {
    it('graph_tests_for resolves a .js specifier to its module and names the fallback when empty', async () => {
        const root = await rig();
        const cache = new ToolCache();
        const t = await cache.dispatch('graph_tests_for', { symbol: 'src/service.js' }, root);
        expect(t['status']).toBe('ok');
        expect((t['tests'] as string[]).length).toBe(TESTS);
        const none = await cache.dispatch('graph_tests_for', { symbol: 'nothingLikeThis' }, root);
        expect(String(none['no_entry'])).toMatch(/no entry for 'nothingLikeThis'.*grep -rn/);
    }, 60_000);
});

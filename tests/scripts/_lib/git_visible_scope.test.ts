import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gitVisibleFiles, withGitVisibleScope, withGitVisibleScopeAsync } from '../../../src/scripts/_lib/git_visible_files.js';
import { runLaneReaders } from '../../../src/scripts/code_graph/lane_runner.js';
import { readSystems } from '../../../src/scripts/code_graph/lanes/systems/index.js';
import { readRuntime } from '../../../src/scripts/code_graph/lanes/runtime/index.js';
import type { CodeGraph } from '../../../src/scripts/code_graph/types.js';

let root: string;

function write(rel: string, body: string): void {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gv-scope-')));
    write('.gitignore', 'dist/\n');
    write('package.json', JSON.stringify({ name: 'fx', dependencies: { lodash: '^4.17.21' } }));
    write('src/a.ts', "import _ from 'lodash';\nexport const a = _.identity(1);\n");
    write('docker-compose.yml', 'services:\n  db:\n    image: postgres:16\n');
    write('dist/a.js', 'module.exports = 1;\n');
    execFileSync('git', ['init', '-q'], { cwd: root });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('the git file-listing scope (2026-11-01)', () => {
    it('answers once per root inside a scope, and fresh outside it', () => {
        withGitVisibleScope(() => {
            const first = gitVisibleFiles(root);
            write('src/b.ts', 'export const b = 2;\n');
            expect(gitVisibleFiles(root)).toBe(first);
            expect(first?.files.has('src/b.ts')).toBe(false);
        });
        expect(gitVisibleFiles(root)?.files.has('src/b.ts')).toBe(true);
    });

    it('a nested scope shares the outer one, and the async scope behaves the same', async () => {
        const inner = withGitVisibleScope(() => {
            const outer = gitVisibleFiles(root);
            return withGitVisibleScope(() => gitVisibleFiles(root) === outer);
        });
        expect(inner).toBe(true);
        await withGitVisibleScopeAsync(async () => {
            const first = gitVisibleFiles(root);
            await new Promise((r) => setTimeout(r, 1));
            expect(gitVisibleFiles(root)).toBe(first);
        });
    });

    it('lane readers give the same output inside a scope as without one', () => {
        expect(withGitVisibleScope(() => readSystems(root))).toEqual(readSystems(root));
        expect(withGitVisibleScope(() => readRuntime(root))).toEqual(readRuntime(root));
    });

    it('a lane run still honours .gitignore under the scope', () => {
        const graph: CodeGraph = { nodes: [], edges: [] } as unknown as CodeGraph;
        const { graph: out } = runLaneReaders(root, graph);
        expect(JSON.stringify(out)).not.toContain('dist/a.js');
    });
});

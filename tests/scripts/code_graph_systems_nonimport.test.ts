import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readSystems } from '../../src/scripts/code_graph/lanes/systems/index.js';
import type { LaneOutput } from '../../src/scripts/code_graph/lanes/lane_fact.js';

let root: string;
let out: LaneOutput;
const inputs = (name: string): string[] => (out.facts.find((f) => f.kind === 'package' && f.attrs['name'] === name)?.attrs['nonimport'] as string[]) ?? [];

beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-nonimport-')));
    const w = (rel: string, body: string): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    };
    const deps = { typescript: '^5.0.0', prettier: '^3.0.0', '@types/node': '^20.0.0', '@tsconfig/node20': '^20.0.0', 'eslint-plugin-import': '^2.0.0', vitest: '^2.0.0', '@vitest/coverage-v8': '^2.0.0' };
    w('package.json', JSON.stringify({ name: 'app', scripts: { build: 'tsc -p .' }, devDependencies: deps }, null, 2));
    const pkgs: Record<string, object> = { '': { name: 'app', devDependencies: deps } };
    for (const n of Object.keys(deps)) pkgs[`node_modules/${n}`] = { version: '1.0.0', dev: true, ...(n === 'typescript' ? { bin: { tsc: 'bin/tsc' } } : n === 'prettier' ? { bin: { prettier: 'bin/prettier.cjs' } } : {}) };
    w('package-lock.json', JSON.stringify({ name: 'app', lockfileVersion: 3, packages: pkgs }, null, 2));
    w('.github/workflows/ci.yml', 'name: CI\non: push\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npx prettier --check .\n');
    w('tsconfig.json', JSON.stringify({ extends: '@tsconfig/node20/tsconfig.json', compilerOptions: { types: ['node'] } }, null, 2));
    w('.eslintrc.json', JSON.stringify({ plugins: ['import'] }, null, 2));
    w('vitest.config.ts', "export default { test: { coverage: { provider: 'v8' } } };\n");
    out = readSystems(root);
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('JS non-import uses as typed inputs (6.3, H10)', () => {
    it.each([
        ['typescript', /^script package\.json:\d+ build$/],
        ['prettier', /^ci \.github\/workflows\/ci\.yml:7 prettier$/],
        ['@types/node', /^tsconfig tsconfig\.json:\d+ types node$/],
        ['@tsconfig/node20', /^tsconfig tsconfig\.json:\d+ extends @tsconfig\/node20$/],
        ['eslint-plugin-import', /^eslint \.eslintrc\.json:\d+ import$/],
        ['@vitest/coverage-v8', /^vite vitest\.config\.ts:\d+ coverage provider v8$/],
    ])('%s is reached by %s', (name, re) => {
        expect(inputs(name).some((e) => re.test(e)), JSON.stringify(inputs(name))).toBe(true);
    });

    it('marks none of them unused', () => {
        const unused = out.facts.filter((f) => f.kind === 'package' && f.attrs['unused'] === true).map((f) => f.attrs['name']);
        expect(unused.filter((n) => n !== 'vitest')).toEqual([]);
    });
});

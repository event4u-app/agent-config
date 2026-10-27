import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { spanHash } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';

const REPO = path.resolve(__dirname, '../..');
let root: string;
let cache: string;
let graph: CodeGraph;

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-core-facts-')));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/shop.ts'), 'export class Shop {\n    total(): number {\n        return 1;\n    }\n}\n');
    spawnSync('git', ['init', '-q'], { cwd: root });
    cache = path.join(root, 'graph.json');
    graph = (await buildFromRepo(root, cache, { lanes: false })).graph;
}, 120_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('fact metadata on core nodes (2.7, H9)', () => {
    it('gives a class and a method an owner file, a span witness and rung T1', () => {
        const cls = graph.nodes.find((n) => n.kind === 'class' && n.label === 'Shop');
        expect(cls?.fact).toEqual({ owner: 'src/shop.ts', witness: { file: 'src/shop.ts', line: 1, hash: spanHash('export class Shop {') }, rung: 'T1' });
        const m = graph.nodes.find((n) => n.kind === 'method' && n.label.endsWith('total'));
        expect(m?.fact?.witness).toEqual({ file: 'src/shop.ts', line: 2, hash: spanHash('total(): number {') });
        expect(m?.fact?.lane).toBeUndefined();
    });

    it('gives a file node a file witness', () => {
        expect(graph.nodes.find((n) => n.kind === 'file' && n.id === 'src/shop.ts')?.fact).toEqual({ owner: 'src/shop.ts', witness: { file: 'src/shop.ts', line: 0, hash: '', kind: 'file' }, rung: 'T1' });
    });

    it('`confirm file:<path>` reads the file witness and names its state', () => {
        const r = spawnSync(path.join(REPO, 'scripts-run'), ['src/scripts/code_graph/cli', 'confirm', 'file:src/shop.ts', '--root', root, '--graph', cache], { encoding: 'utf-8' });
        expect(r.stdout).toMatch(/state: confirmed/);
    }, 60_000);
});

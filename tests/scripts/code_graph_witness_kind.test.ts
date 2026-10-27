import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { verifyAll } from '../../src/scripts/code_graph/verify/verify_all.js';
import { witnessKind } from '../../src/scripts/code_graph/verify/witness_check.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';

const REPO = path.resolve(__dirname, '../..');
let root: string;
let graph: CodeGraph;

const git = (...args: string[]): void => {
    spawnSync('git', args, { cwd: root, env: { ...process.env, GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'd@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'd@example.com' } });
};
const w = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
};

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-wkind-')));
    git('init', '-q', '-b', 'main');
    w('compose.yaml', 'services:\n  app:\n    image: nginx:1.27\n  db:\n    image: postgres:16\n');
    w('src/a.js', "export const a = require('./b');\n");
    w('src/b.js', 'module.exports = 1;\n');
    git('add', '.');
    git('commit', '-qm', 'one');
    for (const n of [2, 3, 4]) {
        w('src/a.js', `export const a = require('./b'); // ${n}\n`);
        w('src/b.js', `module.exports = ${n};\n`);
        git('add', '.');
        git('commit', '-qm', `change ${n}`);
    }
    graph = (await buildFromRepo(root, null, { lanes: true })).graph;
}, 120_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('witness kinds (2.5, H7)', () => {
    it('records the history witness as a commit, and infers span or name for the rest', () => {
        const hist = graph.edges.find((e) => e.fact?.lane === 'history');
        expect(hist?.fact?.witness.kind).toBe('commit');
        expect(witnessKind({ hash: 'abcd1234' })).toBe('span');
        expect(witnessKind({ hash: null })).toBe('name');
    });

    it('confirms every lane on a fresh build, history included', () => {
        const rates = verifyAll(root, graph);
        expect(rates.map((r) => r.lane)).toEqual(expect.arrayContaining(['history', 'runtime']));
        for (const r of rates) expect([r.lane, r.rate]).toEqual([r.lane, 1]);
    });

    it('drops a lane below 1 when its source changes, and a commit witness when the object is gone', () => {
        w('compose.yaml', 'services:\n  web:\n    image: caddy:2\n');
        const forged: CodeGraph = { ...graph, edges: graph.edges.map((e) => (e.fact?.lane === 'history' ? { ...e, fact: { ...e.fact, witness: { ...e.fact.witness, hash: 'deadbeef' } } } : e)) };
        const rates = Object.fromEntries(verifyAll(root, forged).map((r) => [r.lane, r.rate]));
        expect(rates['runtime']).toBeLessThan(1);
        expect(rates['history']).toBe(0);
    });

    it('`code-graph verify --all --min-rate` exits 1 below the rate', () => {
        const cache = path.join(root, 'g.json');
        fs.writeFileSync(cache, JSON.stringify(graph));
        const r = spawnSync(path.join(REPO, 'scripts-run'), ['src/scripts/code_graph/cli', 'verify', '--all', '--min-rate', '0.99', '--root', root, '--graph', cache], { encoding: 'utf-8' });
        expect(r.status).toBe(1);
        expect(r.stdout).toMatch(/below 0\.99: .*runtime/);
    }, 60_000);
});

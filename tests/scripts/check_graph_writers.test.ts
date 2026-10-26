import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main, scanSource, scanTree } from '../../src/scripts/check_graph_writers.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-writers-'));
});
afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
});

function plant(rel: string, text: string): void {
    const p = path.join(tmp, 'src', rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
}

const HEAD = "import * as fs from 'node:fs';\nimport * as path from 'node:path';\n";

describe('check_graph_writers (5.2)', () => {
    it('is green on this tree and reads all of it', () => {
        const r = scanTree(REPO_ROOT);
        expect(r.findings).toEqual([]);
        expect(r.scanned).toBeGreaterThan(500);
    });

    it('is red on a graph cache written to the pre-ADR-303 state directory, directly or through a variable', () => {
        const direct = scanSource('a.ts', `${HEAD}fs.writeFileSync(path.join(root, 'agents', 'runtime', 'state', 'code-graph-v1.json'), '{}');\n`);
        expect(direct.map((f) => f.call)).toEqual(['writeFileSync']);
        const viaVar = scanSource(
            'b.ts',
            `${HEAD}const STATE = path.join('agents', 'runtime', 'state');\nfunction f(root: string): void {\n    const cache = path.join(root, STATE, 'code-graph-v1.json');\n    write_atomic(cache, '{}');\n}\n`,
        );
        expect(viaVar.map((f) => [f.call, f.line])).toEqual([['write_atomic', 6]]);
    });

    it('is red on a map, estate index or hub page written outside both layouts', () => {
        const map = scanSource('c.ts', `${HEAD}fs.mkdirSync(path.join(root, 'agents', 'graph'), { recursive: true });\nfs.writeFileSync(path.join(root, 'agents', 'graph', 'map.json'), '{}');\n`);
        expect(map.map((f) => f.call)).toEqual(['writeFileSync']);
        const estate = scanSource('d.ts', `${HEAD}const db = new DatabaseSync(path.join(registryDir(), 'index-v1.sqlite3'));\n`);
        expect(estate.map((f) => f.call)).toEqual(['new DatabaseSync']);
        const copy = scanSource('e.ts', `${HEAD}fs.copyFileSync(src, path.join(event4u_root(), 'runtime', 'graphs', id, 'code-graph-v1.json'));\n`);
        expect(copy.map((f) => f.call)).toEqual(['copyFileSync']);
    });

    it('holds the layout resolvers themselves to the two layouts', () => {
        const constant = scanSource('graph_home.ts', `${HEAD}export const NATIVE_CACHE_REL = path.join('agents', 'runtime', 'state', 'code-graph-v1.json');\n`);
        expect(constant.map((f) => f.call)).toEqual(['NATIVE_CACHE_REL =']);
        const resolver = scanSource('estate_map.ts', `${HEAD}export function estateMapDir(): string {\n    return path.join(event4u_root(), 'runtime', 'estate', 'map');\n}\n`);
        expect(resolver.map((f) => f.call)).toEqual(['estateMapDir()']);
        const inside = scanSource('graph_home.ts', `${HEAD}export const NATIVE_CACHE_REL = path.join('agents', 'map', '.build', 'code-graph-v1.json');\nexport function hubDir(): string {\n    return path.join(event4u_root(), 'map');\n}\n`);
        expect(inside).toEqual([]);
    });

    it('lets a temp copy, a read of the old path and a write inside agents/map/ pass', () => {
        const ok = scanSource(
            'f.ts',
            `${HEAD}const copy = path.join(os.tmpdir(), 'x', 'code-graph-v1.json');\nfs.copyFileSync(graph, copy);\n` +
                `const old = fs.readFileSync(path.join(root, 'agents', 'runtime', 'state', 'code-graph-v1.json'), 'utf-8');\n` +
                `const ro = new DatabaseSync(path.join(registryDir(), 'index-v1.sqlite3'), { readOnly: true });\n` +
                `fs.writeFileSync(path.join(root, 'agents', 'map', '.build', 'code-graph-v1.json'), old);\n`,
        );
        expect(ok).toEqual([]);
    });

    it('exits 1 on a planted writer, names it, and exits 0 once it is gone', () => {
        const lines: string[] = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
            lines.push(String(s));
            return true;
        });
        plant('ok.ts', `${HEAD}export const x = 1;\n`);
        plant('scripts/writer.ts', `${HEAD}fs.writeFileSync(path.join(root, 'agents', 'runtime', 'state', 'code-graph-v1.json'), '{}');\n`);
        expect(main(['--root', tmp])).toBe(1);
        expect(lines.join('')).toMatch(/src\/scripts\/writer\.ts:3 writeFileSync/);
        expect(lines.join('')).toMatch(/^scanned: 2$/m);
        fs.rmSync(path.join(tmp, 'src', 'scripts', 'writer.ts'));
        expect(main(['--root', tmp])).toBe(0);
        expect(main(['--root'])).toBe(2);
    });
});

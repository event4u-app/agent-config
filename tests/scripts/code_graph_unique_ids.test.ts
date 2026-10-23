import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { sqliteTwinPath } from '../../src/scripts/code_graph/sqlite_store.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';
import { isSqliteAvailableSync } from '../../src/scripts/_lib/sqlite_guard.js';

let dir: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-ids-'));
    fs.mkdirSync(path.join(dir, 'src'));
    // `type X` beside `const X`, a getter beside its setter, and two nested
    // helpers that share a name: every shape that used to collide.
    fs.writeFileSync(
        path.join(dir, 'src', 'a.ts'),
        [
            'export type Outcome = "ok" | "no";',
            'export const Outcome = { ok: "ok" } as const;',
            'export class Box {',
            '    get v(): number { return 1; }',
            '    set v(x: number) { void x; }',
            '}',
            'export function one(): number { function walk(): number { return 1; } return walk(); }',
            'export function two(): number { function walk(): number { return 2; } return walk(); }',
            '',
        ].join('\n'),
    );
    fs.writeFileSync(
        path.join(dir, 'src', 'b.php'),
        '<?php\nfunction helper() { return 1; }\nif (true) { function helper() { return 2; } }\n',
    );
});
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('node ids are unique per file (D3)', () => {
    it('salts the second and later same-named declarations in declaration order', async () => {
        const { graph } = await buildFromRepo(dir, null);
        const ids = graph.nodes.map((n) => n.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain('src/a.ts#Outcome');
        expect(ids).toContain('src/a.ts#Outcome@2');
        expect(ids).toContain('src/a.ts#Box::v');
        expect(ids).toContain('src/a.ts#Box::v@2');
        expect(ids).toContain('src/b.php#helper@2');
    });

    it('is deterministic across builds', async () => {
        const a = await buildFromRepo(dir, null);
        const b = await buildFromRepo(dir, null);
        expect(a.json).toBe(b.json);
    });

    it('validateGraph rejects a duplicate id', () => {
        const g = {
            schema_version: 5,
            source_checksum: 'x',
            nodes: [
                { id: 'a.ts#X', label: 'X', kind: 'type', source_file: 'a.ts', source_location: [] },
                { id: 'a.ts#X', label: 'X', kind: 'constant', source_file: 'a.ts', source_location: [] },
            ],
            edges: [],
        };
        const r = validateGraph(g);
        expect(r.ok).toBe(false);
        expect(r.errors.join(' ')).toMatch(/duplicate: a\.ts#X/);
    });

    // Node 22.6, the package floor, ships node:sqlite, so this is never skipped.
    it('the SQLite twin is written once ids are unique', async () => {
        expect(isSqliteAvailableSync()).toBe(true);
        const out = path.join(dir, 'agents', 'runtime', 'state', 'code-graph-v1.json');
        await buildFromRepo(dir, out);
        expect(fs.existsSync(sqliteTwinPath(out))).toBe(true);
    });
});

describe('the incremental cache is keyed on what extracted it (D5)', () => {
    it('a changed extractor fingerprint forces a full re-extraction', async () => {
        const out = path.join(dir, 'cache', 'g.json');
        const cold = await buildFromRepo(dir, out, { update: true, fingerprint: 'extractor-a' });
        const same = await buildFromRepo(dir, out, { update: true, fingerprint: 'extractor-a' });
        expect(same.reused).toBe(cold.fileCount);
        const changed = await buildFromRepo(dir, out, { update: true, fingerprint: 'extractor-b' });
        expect(changed.reExtracted).toBe(changed.fileCount);
        expect(changed.reused).toBe(0);
    });
});

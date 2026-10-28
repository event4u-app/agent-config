/**
 * I.1 — one source registry; a new writer without a row fails.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REGISTRY_REL, REPO_ROOT, check, orphans, readRegistry, storeWrites } from '../../src/scripts/check_source_registry.js';

let root: string;
const put = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
};
const row = (name: string, p: string, writer: string[], readers: string[] = ['src/scripts/reader.ts']) => ({ name, path: p, format: 'jsonl', writer, readers, privacy: 'project', owner: 'project', delete_path: 'rm', hosts: 'all', status: 'active' });

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-registry-'));
    put('src/scripts/reader.ts', 'export {};\n');
    put('src/scripts/writer.ts', "import fs from 'node:fs';\nconst DIR = path.join('agents', 'memory', 'intake');\nfs.writeFileSync(path.join(DIR, 'x.jsonl'), '');\n");
    put(REGISTRY_REL, JSON.stringify({ stores: [row('memory-intake', 'agents/memory/intake', ['src/scripts/writer.ts'])] }));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('storeWrites', () => {
    it('follows a constant one step into a write call; a mention without a write is no writer', () => {
        expect(storeWrites("const D = 'agents/decisions/x.jsonl';\nfs.appendFileSync(D, line);\n")).toEqual(['agents/decisions']);
        expect(storeWrites("const D = 'agents/decisions/x.jsonl';\nconsole.log(D);\n")).toEqual([]);
        expect(storeWrites("// fs.writeFileSync('agents/memory/x')\n")).toEqual([]);
    });
});

describe('check', () => {
    it('is clean when every writer has a row', () => {
        expect(check(root)).toEqual([]);
    });

    it('is red on a planted writer without a row', () => {
        put('src/scripts/planted.ts', "import fs from 'node:fs';\nfs.writeFileSync('agents/knowledge/intake/new.jsonl', '');\n");
        expect(check(root)).toEqual([{ kind: 'writer-without-row', file: 'src/scripts/planted.ts', detail: expect.stringContaining('agents/knowledge') }]);
    });

    it('a reviewed non-writer needs a reason and is then skipped', () => {
        put('src/scripts/planted.ts', "import fs from 'node:fs';\nfs.writeFileSync('agents/knowledge/intake/new.jsonl', '');\n");
        const doc = JSON.parse(fs.readFileSync(path.join(root, REGISTRY_REL), 'utf-8'));
        put(REGISTRY_REL, JSON.stringify({ ...doc, reviewed_not_writers: [{ file: 'src/scripts/planted.ts', root: 'agents/knowledge', reason: '' }] }));
        expect(check(root).map((f) => f.kind).sort()).toEqual(['bad-row', 'writer-without-row']);
        put(REGISTRY_REL, JSON.stringify({ ...doc, reviewed_not_writers: [{ file: 'src/scripts/planted.ts', root: 'agents/knowledge', reason: 'writes a fixture copy' }] }));
        expect(check(root)).toEqual([]);
    });

    it('a row without an owner or delete path, and a writer that is gone, are findings', () => {
        put(REGISTRY_REL, JSON.stringify({ stores: [{ ...row('memory-intake', 'agents/memory/intake', ['src/scripts/writer.ts', 'src/scripts/gone.ts']), owner: 'someone', delete_path: '' }] }));
        expect(check(root).map((f) => f.kind).sort()).toEqual(['bad-row', 'dead-writer']);
    });

    it('orphans: written, never read', () => {
        expect(orphans([row('j', 'agents/runtime/journal', ['w.ts'], [])] as never)).toHaveLength(1);
    });
});

describe('the real registry', () => {
    it('lists agents/knowledge and host memory, every row has an owner and a delete path, and the tree has no unregistered writer', () => {
        const rows = readRegistry(REPO_ROOT);
        expect(rows.map((r) => r.name)).toEqual(expect.arrayContaining(['team-knowledge-pages', 'host-memory', 'local-doc-ingest', 'session-memory-index', 'second-brain-retrieval-store', 'memory-fts-index']));
        expect(rows.find((r) => r.name === 'host-memory')).toMatchObject({ owner: 'user', read_only: true });
        expect(check(REPO_ROOT)).toEqual([]);
    });
});

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildMap, lineJson, mapGeneration, readMap } from '../../src/scripts/code_graph/map.js';

let root: string;

function write(rel: string, body: string): void {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
}

function git(...args: string[]): void {
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, stdio: 'ignore' });
}

/** Every tracked map file except the manifest and the viewer, path → bytes. */
function contentFiles(): Map<string, string> {
    const dir = path.join(root, 'agents', 'map');
    const out = new Map<string, string>();
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            const rel = path.relative(dir, p);
            if (e.isDirectory()) {
                if (e.name !== '.build') walk(p);
            } else if (rel !== 'manifest.json' && rel !== 'index.html') out.set(rel, fs.readFileSync(p, 'utf-8'));
        }
    };
    walk(dir);
    return out;
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-stable-')));
    fs.mkdirSync(path.join(root, 'agents'));
    write('.gitignore', '/agents/map/.build/\n');
    write('src/util/log.ts', 'export function log(m: string): void { void m; }\n');
    write('src/a.ts', "import { log } from './util/log.js';\nexport function a(): void { log('a'); }\n");
    write('src/b.ts', "import { a } from './a.js';\nexport function b(): void { a(); }\n");
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'init');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('a committed map changes only where the tree did (2026-11-01)', () => {
    it('a redraw after committing the map itself writes byte-identical content files', async () => {
        await buildMap(root);
        const first = contentFiles();
        git('add', '-A');
        git('commit', '-qm', 'map');
        await buildMap(root);
        expect(contentFiles()).toEqual(first);
    });

    it('no content file pins the drawn-at commit, and the manifest does', async () => {
        await buildMap(root);
        const sha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim();
        // A commit may appear as history (provenance.commits); what must not appear is the drawn-at pin.
        const doc = JSON.parse(contentFiles().get('code/map.json') ?? '{}') as { meta: { commit: string }; model: { pin?: unknown; provenance?: { head?: unknown } } };
        expect(doc.meta.commit).toBe('');
        expect(doc.model.pin).toBeUndefined();
        expect(doc.model.provenance?.head).toBeUndefined();
        for (const [rel, body] of contentFiles()) if (rel.endsWith('.md')) expect(body, rel).not.toContain(sha);
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'agents', 'map', 'manifest.json'), 'utf-8')) as { commit: string; generation: string };
        expect(manifest.commit).toBe(sha);
        expect(manifest.generation).toMatch(/^[0-9a-f]{16}$/);
    });

    it('readers still get the commit and generation, from the manifest', async () => {
        await buildMap(root);
        const map = readMap(root);
        expect(map?.meta.commit).toMatch(/^[0-9a-f]{12}$/);
        expect(map?.meta.graph_generation).toBe(mapGeneration(path.join(root, 'agents', 'map')));
    });

    it('a one-file change leaves the other areas\' content untouched', async () => {
        await buildMap(root);
        git('add', '-A');
        git('commit', '-qm', 'map');
        const before = contentFiles();
        write('src/b.ts', "import { a } from './a.js';\nexport function b(): void { a(); a(); }\n");
        git('commit', '-qam', 'b');
        await buildMap(root);
        const after = contentFiles();
        const changed = [...after.keys()].filter((k) => after.get(k) !== before.get(k));
        expect(changed).toEqual(expect.arrayContaining(['code/map.json']));
        expect(changed.filter((k) => k.endsWith('.json') && !k.startsWith('code/'))).toEqual([]);
    });
});

describe('folder areas keep their names and stay local (owner decision 2026-11-01)', () => {
    it('a file added in one folder leaves the other folder\'s area page byte-identical', async () => {
        for (const d of ['alpha', 'beta']) {
            for (let i = 0; i < 6; i++) write(`src/${d}/m${i}.ts`, `import { v${(i + 1) % 6} } from './m${(i + 1) % 6}.js';\nexport const v${i} = (): number => v${(i + 1) % 6}() + 1;\n`);
        }
        git('add', '-A');
        git('commit', '-qm', 'folders');
        await buildMap(root);
        const pages = (): string[] => fs.readdirSync(path.join(root, 'agents', 'map', 'code', 'areas')).sort();
        const before = pages();
        const beta = fs.readFileSync(path.join(root, 'agents', 'map', 'code', 'areas', 'src-beta.md'), 'utf-8');
        write('src/alpha/m6.ts', "import { v0 } from './m0.js';\nexport const v6 = (): number => v0();\n");
        git('add', '-A');
        git('commit', '-qm', 'alpha grows');
        await buildMap(root);
        expect(pages()).toEqual(before);
        expect(before).toEqual(expect.arrayContaining(['src-alpha.md', 'src-beta.md']));
        expect(fs.readFileSync(path.join(root, 'agents', 'map', 'code', 'areas', 'src-beta.md'), 'utf-8')).toBe(beta);
    });
});

describe('lineJson', () => {
    it('round-trips and puts one array element per line', () => {
        const v = { meta: { title: 't' }, model: { files: [{ path: 'a' }, { path: 'b' }], n: 1, empty: [] }, skip: undefined };
        const text = lineJson(v);
        expect(JSON.parse(text)).toEqual({ meta: { title: 't' }, model: { files: [{ path: 'a' }, { path: 'b' }], n: 1, empty: [] } });
        expect(text.split('\n')).toEqual(expect.arrayContaining(['   {"path":"a"},', '   {"path":"b"}']));
    });
});

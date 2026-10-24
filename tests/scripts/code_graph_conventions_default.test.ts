import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { conventionsDefault, DEFAULT_MECHANISMS, fsRoutePath } from '../../src/scripts/code_graph/conventions_default.js';
import { declaredEntryFiles } from '../../src/scripts/code_graph/map.js';
import type { CodeGraph, CodeNode } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const roots: string[] = [];

function tree(files: Record<string, string>): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-default-')));
    roots.push(root);
    for (const [rel, body] of Object.entries(files)) {
        const p = path.join(root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body);
    }
    return root;
}

afterEach(() => {
    for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

const via = (g: CodeGraph, v: string) => g.edges.filter((e) => e.resolved_via === v).map((e) => `${e.source} -> ${e.target}`);

describe('literal-path (3.1)', () => {
    it('links a literal naming exactly one file, with extension inference, and stays schema-valid', async () => {
        const root = tree({
            'src/a.ts': "export const t = loadTemplate('templates/home.html');\nexport const w = spawnWorker('./worker');\n",
            'src/worker.ts': 'export const x = 1;\n',
            'templates/home.html': '<h1>home</h1>\n',
        });
        const { graph } = await buildFromRepo(root, null);
        expect(via(graph, 'literal-path')).toEqual(['src/a.ts -> src/worker.ts', 'src/a.ts -> templates/home.html']);
        expect(graph.edges.find((e) => e.resolved_via === 'literal-path')?.confidence).toBe('INFERRED');
        expect(graph.nodes.some((n) => n.id === 'templates/home.html' && n.kind === 'file')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });

    it('draws nothing for a path that only appears in a comment, a docstring or a log message', async () => {
        const root = tree({
            'src/a.ts':
                "// see 'templates/home.html' for the layout\n/* old: 'templates/old.html' */\nconsole.log('templates/home.html');\n" +
                "logger.info('reading', 'templates/old.html');\nthrow new Error('templates/home.html');\nexport const t = render('templates/kept.html');\n",
            'src/b.py': "\"\"\"Loads 'templates/home.html'.\"\"\"\n# also 'templates/old.html'\nprint('templates/home.html')\nlogging.warning('templates/old.html')\n",
            'src/c.php': "<?php\n// 'templates/home.html'\nLog::info('templates/old.html');\n",
            'templates/home.html': '<h1>home</h1>\n',
            'templates/old.html': '<h1>old</h1>\n',
            'templates/kept.html': '<h1>kept</h1>\n',
        });
        const { graph } = await buildFromRepo(root, null);
        expect(via(graph, 'literal-path')).toEqual(['src/a.ts -> templates/kept.html']);
    });

    it('draws nothing when a literal matches two files', async () => {
        const root = tree({
            'src/a.ts': "export const t = open('./util');\n",
            'src/util.ts': 'export const x = 1;\n',
            'src/util/index.ts': 'export const y = 2;\n',
        });
        const { graph } = await buildFromRepo(root, null);
        expect(via(graph, 'literal-path')).toEqual([]);
    });

    it('never doubles an import edge between the same two files', async () => {
        const root = tree({
            'src/a.ts': "import { x } from './b';\nexport const y = x;\n",
            'src/b.ts': 'export const x = 1;\n',
        });
        const { graph } = await buildFromRepo(root, null);
        expect(via(graph, 'literal-path')).toEqual([]);
    });

    it('ignores data files, dotfiles and URLs', async () => {
        const root = tree({
            'src/a.ts': "read('config/app.json'); read('.gitignore'); fetch('https://x.test/src/b.ts');\n",
            'src/b.ts': 'export const x = 1;\n',
            'config/app.json': '{}\n',
            '.gitignore': 'node_modules\n',
        });
        const { graph } = await buildFromRepo(root, null);
        expect(via(graph, 'literal-path')).toEqual([]);
    });
});

describe('graph identity (review fix)', () => {
    it('changes when a template appears, and not when a cache file does', async () => {
        const root = tree({ 'src/a.ts': "export const t = load('templates/home.html');\n" });
        const before = (await buildFromRepo(root, null)).graph.source_checksum;
        fs.writeFileSync(path.join(root, 'build.log'), 'x');
        expect((await buildFromRepo(root, null)).graph.source_checksum).toBe(before);
        fs.mkdirSync(path.join(root, 'templates'));
        fs.writeFileSync(path.join(root, 'templates/home.html'), '<h1/>');
        expect((await buildFromRepo(root, null)).graph.source_checksum).not.toBe(before);
    });
});

describe('literal-dotted (3.2)', () => {
    const file = (p: string): CodeNode => ({ id: p, label: p, kind: 'file', source_file: p, source_location: [] });
    const run = (src: string, paths: string[], on: boolean) =>
        conventionsDefault({
            files: [{ path: 'app/a.py', source: src }],
            paths,
            nodes: [file('app/a.py')],
            edges: [],
            mechanisms: { ...DEFAULT_MECHANISMS, 'literal-dotted': on },
        });

    it('is off by default — it measured under the precision bar', () => {
        expect(DEFAULT_MECHANISMS['literal-dotted']).toBe(false);
        expect(run("render('users.list')", ['app/a.py', 'templates/users/list.html'], false).edges).toEqual([]);
    });

    it('resolves a dotted template name to its one template when switched on', () => {
        const r = run("render('users.list')", ['app/a.py', 'templates/users/list.html'], true);
        expect(r.edges.map((e) => [e.target, e.relation, e.resolved_via])).toEqual([['templates/users/list.html', 'renders', 'literal-dotted']]);
    });

    it('refuses a dotted name two templates end with', () => {
        const r = run("render('users.list')", ['app/a.py', 'templates/users/list.html', 'admin/users/list.twig'], true);
        expect(r.edges).toEqual([]);
    });
});

describe('manifest entries (3.3)', () => {
    it('reads bin, exports and pyproject scripts in every package root', () => {
        const root = tree({
            'package.json': JSON.stringify({ bin: { tool: './bin/tool.js' }, exports: { '.': './dist/index.js', './x': { import: './dist/x.mjs' } } }),
            'services/api/pyproject.toml': '[project]\nname = "api"\n\n[project.scripts]\napi = "api.cli:main"\n',
            'services/api/src/api/cli.py': 'def main(): pass\n',
        });
        const entries = declaredEntryFiles(root);
        expect(entries).toEqual(expect.arrayContaining(['bin/tool.js', 'dist/index.js', 'dist/x.mjs', 'services/api/src/api/cli.py']));
    });
});

describe('fs-route (3.4)', () => {
    it('derives routes from page modules', () => {
        const dirs = new Set(['web/pages', 'site/app']);
        expect(fsRoutePath('web/pages/users/[id].tsx', dirs)).toEqual({ verb: 'PAGE', route: '/users/[id]' });
        expect(fsRoutePath('web/pages/index.tsx', dirs)).toEqual({ verb: 'PAGE', route: '/' });
        expect(fsRoutePath('web/pages/_app.tsx', dirs)).toBeNull();
        expect(fsRoutePath('site/app/(shop)/cart/page.tsx', dirs)).toEqual({ verb: 'PAGE', route: '/cart' });
        expect(fsRoutePath('site/app/api/items/route.ts', dirs)).toEqual({ verb: 'ROUTE', route: '/api/items' });
        expect(fsRoutePath('kit/src/routes/blog/+page.svelte', dirs)).toEqual({ verb: 'PAGE', route: '/blog' });
    });

    it('leaves a module whose routes a provider already declared', () => {
        const page = 'app/api/items/route.ts';
        const r = conventionsDefault({
            files: [],
            paths: ['app/page.tsx', page],
            nodes: [
                { id: page, label: page, kind: 'file', source_file: page, source_location: [] },
                { id: `${page}#route:ROUTE GET /api/items`, label: 'ROUTE GET /api/items', kind: 'route', source_file: page, source_location: [] },
            ],
            edges: [],
        });
        expect(r.nodes.filter((n) => n.kind === 'route').map((n) => n.label)).toEqual(['PAGE /']);
    });

    it('draws route nodes for a pages tree and none for a routes folder of PHP files', async () => {
        const root = tree({
            'pages/index.tsx': 'export default function Home() { return null; }\n',
            'pages/about.tsx': 'export default function About() { return null; }\n',
            'routes/web.php': "<?php\nRoute::get('/', fn () => 1);\n",
            'lib/pages/helper.ts': 'export const h = 1;\n',
        });
        const { graph } = await buildFromRepo(root, null);
        expect(graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort()).toEqual(['PAGE /', 'PAGE /about']);
        expect(via(graph, 'fs-route').sort()).toEqual([
            'pages/about.tsx#route:PAGE /about -> pages/about.tsx',
            'pages/index.tsx#route:PAGE / -> pages/index.tsx',
        ]);
    });
});

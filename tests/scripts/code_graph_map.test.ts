import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { buildMap, diffFiles, embedJson, MAP_TOKEN_BUDGET } from '../../src/scripts/code_graph/map.js';
import { buildMapModel, staticRole } from '../../src/scripts/code_graph/map_model.js';
import { labelProblems } from '../../src/scripts/code_graph/map_verify.js';

let root: string;

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

/**
 * Two coupled clusters, a utility every file imports, tests that import their
 * subject and a shared base, an isolated file — and one file whose NAME is
 * hostile markup, because file and symbol names come from the scanned repo.
 */
function fixture(): void {
    write('src/util/log.ts', 'export function log(m: string): void { void m; }\n');
    for (const c of ['billing', 'auth']) {
        // Dense: every file imports every other, so the cluster has no
        // internal seam for modularity to cut along.
        for (let i = 0; i < 6; i++) {
            const others = [0, 1, 2, 3, 4, 5].filter((j) => j !== i);
            write(
                `src/${c}/f${i}.ts`,
                "import { log } from '../util/log.js';\n" +
                    others.map((j) => `import { g${j} } from './f${j}.js';\n`).join('') +
                    `export function g${i}(): number { log('x'); return ${others.map((j) => `g${j}.length`).join(' + ')}; }\n`,
            );
        }
    }
    for (let i = 0; i < 30; i++) write(`src/misc/u${i}.ts`, "import { log } from '../util/log.js';\nexport const u = (): void => log('u');\n");
    write('tests/base.ts', 'export class TestCase {}\n');
    write(
        'tests/billing.test.ts',
        "import { TestCase } from './base.js';\nimport { g0 } from '../src/billing/f0.js';\nexport class T extends TestCase { run(): unknown { return g0; } }\n",
    );
    write('src/lonely.ts', 'export const nobody = 1;\n');
    write(
        'src/evil/<script>alert(1)<!--x.ts',
        'export function evil(): string { return "</script><script>alert(2)</script>"; }\nexport const injected = 1;\n',
    );
    write('package.json', JSON.stringify({ name: 'fx', bin: { fx: './src/billing/f0.ts' } }));
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-map-')));
    fixture();
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the map model (Phase 2)', () => {
    it('gives every file exactly one role and never calls an unconnected file dead', async () => {
        const { graph } = await buildFromRepo(root, null);
        const m = buildMapModel(graph, { entryFiles: ['src/billing/f0.ts'] });
        const role = (p: string): string | undefined => m.files.find((f) => f.path === p)?.role;
        expect(role('tests/billing.test.ts')).toBe('test');
        expect(role('src/billing/f0.ts')).toBe('entry');
        expect(role('src/lonely.ts')).toBe('isolated');
        expect(m.files.every((f) => typeof f.role === 'string')).toBe(true);
        expect(JSON.stringify(m)).not.toMatch(/"dead"/);
    });

    it('holds the utility everything imports out of the areas as infrastructure', async () => {
        const { graph } = await buildFromRepo(root, null);
        const m = buildMapModel(graph);
        const util = m.files.find((f) => f.path === 'src/util/log.ts');
        expect(util?.role).toBe('infra');
        expect(util?.area).toBe(-1);
        expect(m.thresholds.infraInDegree).toBeGreaterThanOrEqual(10);
    });

    it('separates the two coupled clusters and lets the test join what it tests, not its base class', async () => {
        const { graph } = await buildFromRepo(root, null);
        const m = buildMapModel(graph);
        const areaOf = (p: string): number => m.files.find((f) => f.path === p)?.area ?? -2;
        expect(areaOf('src/billing/f1.ts')).toBe(areaOf('src/billing/f4.ts'));
        expect(areaOf('src/billing/f1.ts')).not.toBe(areaOf('src/auth/f1.ts'));
        expect(areaOf('tests/billing.test.ts')).toBe(areaOf('src/billing/f0.ts'));
    });

    it('caps every area at a quarter of the clustered files', async () => {
        const { graph } = await buildFromRepo(root, null);
        const m = buildMapModel(graph);
        const clustered = m.files.filter((f) => f.area >= 0).length;
        for (const a of m.areas.filter((x) => x.kind === 'area')) {
            expect(a.files.length).toBeLessThanOrEqual(Math.max(8, 0.25 * clustered));
        }
    });

    it('is a pure function: same graph, same bytes', async () => {
        const { graph } = await buildFromRepo(root, null);
        expect(JSON.stringify(buildMapModel(graph))).toBe(JSON.stringify(buildMapModel(graph)));
    });

    it('names the stack roles by path', () => {
        const none = new Set<string>();
        expect(staticRole('resources/views/books/show.blade.php', none)).toBe('view');
        expect(staticRole('database/migrations/2024_01_01_create_books.php', none)).toBe('migration');
        expect(staticRole('lang/de/messages.php', none)).toBe('translation');
        expect(staticRole('config/app.php', none)).toBe('config');
        expect(staticRole('routes/web.php', none)).toBe('entry');
        expect(staticRole('app/Models/Book.php', none)).toBe('code');
    });
});

describe('agents/map/ artefacts (Phase 3)', () => {
    it('writes index.html, MAP.md, map.json and area pages into agents/map/', async () => {
        const r = await buildMap(root);
        for (const f of ['index.html', 'MAP.md', 'map.json']) {
            expect(fs.existsSync(path.join(root, 'agents', 'map', f))).toBe(true);
        }
        expect(r.written.some((w) => w.startsWith('areas/'))).toBe(true);
    });

    it('two builds of the same tree are byte-identical', async () => {
        await buildMap(root);
        const read = (): string[] =>
            ['index.html', 'MAP.md', 'map.json'].map((f) => fs.readFileSync(path.join(root, 'agents', 'map', f), 'utf-8'));
        const first = read();
        await buildMap(root);
        expect(read()).toEqual(first);
    });

    it('index.html loads nothing from the network and pins its inline code by hash', async () => {
        await buildMap(root);
        const html = fs.readFileSync(path.join(root, 'agents', 'map', 'index.html'), 'utf-8');
        expect(html).not.toMatch(/\b(src|href)\s*=\s*["']?https?:/i);
        expect(html).not.toMatch(/@import|url\(\s*["']?https?:/i);
        expect(html).toMatch(/Content-Security-Policy" content="default-src 'none'; script-src 'sha256-/);
    });

    it('renders a hostile file name as data, never as markup', async () => {
        await buildMap(root);
        const html = fs.readFileSync(path.join(root, 'agents', 'map', 'index.html'), 'utf-8');
        // Exactly the two script elements the template writes.
        expect(html.match(/<script\b/g)?.length).toBe(2);
        const dataBlock = html.slice(html.indexOf('id="map-data">') + 'id="map-data">'.length, html.lastIndexOf('</script>\n<script>'));
        expect(dataBlock).not.toContain('<');
        expect(dataBlock).toContain('\\u003cscript>alert(1)\\u003c!--x.ts');
        // A string literal from the source never enters the data.
        expect(html).not.toContain('alert(2)');
        expect(embedJson({ a: '</script>\u2028' })).toBe('{"a":"\\u003c/script>\\u2028"}');
    });

    it('carries no absolute host path in any artefact', async () => {
        await buildMap(root);
        const dir = path.join(root, 'agents', 'map');
        const all = [
            ...['index.html', 'MAP.md', 'map.json'].map((f) => path.join(dir, f)),
            ...fs.readdirSync(path.join(dir, 'areas')).map((f) => path.join(dir, 'areas', f)),
        ];
        for (const f of all) expect(fs.readFileSync(f, 'utf-8')).not.toContain(root);
    });

    it('holds MAP.md to its token budget and says what it cut', async () => {
        await buildMap(root);
        const mapMd = fs.readFileSync(path.join(root, 'agents', 'map', 'MAP.md'), 'utf-8');
        expect(mapMd.length).toBeLessThanOrEqual(MAP_TOKEN_BUDGET * 4 + 400);
        expect(mapMd).toMatch(/^# Map of /);
        expect(mapMd).toMatch(/Thresholds: seed 42 · infrastructure above in-degree \d+/);
        expect(mapMd).toContain('## Areas');
    });
});

describe('the canvas label check (3.6)', () => {
    it('counts a label leaving the canvas and a pair of overlapping labels', () => {
        const inside = { x: 10, y: 10, w: 40, h: 14 };
        expect(labelProblems([inside], 200, 100)).toEqual({ outside: 0, overlapping: 0 });
        expect(labelProblems([{ x: 180, y: 10, w: 40, h: 14 }], 200, 100).outside).toBe(1);
        expect(labelProblems([inside, { x: 30, y: 15, w: 40, h: 14 }], 200, 100).overlapping).toBe(1);
        expect(labelProblems([inside, { x: 60, y: 10, w: 40, h: 14 }], 200, 100).overlapping).toBe(0);
    });
});

describe('the diff view (5.3)', () => {
    const git = (...args: string[]): void => {
        execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' });
    };

    it('marks the changed file, what links into it, and the areas the change touches', async () => {
        git('init', '-q');
        git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'add', '-A');
        git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-qm', 'seed');
        fs.appendFileSync(path.join(root, 'src', 'billing', 'f2.ts'), '// touched\n');
        const r = await buildMap(root, { diffRev: 'HEAD' });
        const d = r.model.diff;
        expect(d).toBeDefined();
        const paths = (xs: number[]): string[] => xs.map((i) => r.model.files[i]?.path ?? '');
        expect(paths(d?.changed ?? [])).toEqual(['src/billing/f2.ts']);
        expect(paths(d?.impacted ?? [])).toContain('src/billing/f0.ts');
        expect(d?.areas[0]?.[0]).toBe(r.model.files.find((f) => f.path === 'src/billing/f2.ts')?.area);
        expect(fs.readFileSync(path.join(root, 'agents', 'map', 'MAP.md'), 'utf-8')).toContain('## This change (`HEAD`..working tree)');
    });

    it('refuses a rev that would reach git as an option', () => {
        expect(diffFiles(root, '--output=/tmp/x')).toBeNull();
    });
});

describe('the artefact layer (6.4)', () => {
    it('keeps the declared relations, drops pack and workspace membership, and maps artefacts to files', async () => {
        const { graph } = await buildFromRepo(root, null);
        const m = buildMapModel(graph, {
            artefacts: {
                nodes: [
                    { id: 'billing-skill', path: 'src/billing/f0.ts', category: 'skill' },
                    { id: 'auth-rule', path: null, category: 'rule' },
                ],
                edges: [
                    { from: 'auth-rule', to: 'billing-skill', rel: 'routes_to' },
                    { from: 'billing-skill', to: 'pack:core', rel: 'member_of' },
                ],
            },
        });
        const a = m.artefacts;
        expect(a?.relationCounts).toEqual({ routes_to: 1 });
        expect(a?.edges).toHaveLength(1);
        const billing = a?.nodes.find((n) => n[0] === 'billing-skill');
        expect(billing && m.files[billing[1]]?.path).toBe('src/billing/f0.ts');
        expect(a?.nodes.find((n) => n[0] === 'auth-rule')?.[1]).toBe(-1);
    });

    it('is absent for a project that is not an agent-config source tree', async () => {
        const r = await buildMap(root);
        expect(r.model.artefacts).toBeUndefined();
    });
});

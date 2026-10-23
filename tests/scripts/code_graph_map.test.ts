import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { buildMap, diffFiles, embedJson, MAP_TOKEN_BUDGET, readMap, readOutcomes, recordOutcome } from '../../src/scripts/code_graph/map.js';
import { areaDrift, buildMapModel, outcomeScores, prOverlap, staticRole } from '../../src/scripts/code_graph/map_model.js';
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

describe('the map learns and serves the workflow (Phase 7)', () => {
    it('reports no drift for an unchanged tree, so a rebuild keeps its bytes', async () => {
        const first = await buildMap(root);
        const again = await buildMap(root);
        expect(again.model.drift).toBeUndefined();
        expect(JSON.stringify(again.model)).toBe(JSON.stringify(first.model));
    });

    it('names an area that grew since the last map', async () => {
        await buildMap(root);
        for (let i = 6; i < 9; i++) {
            write(`src/billing/f${i}.ts`, "import { g0 } from './f0.js';\nimport { g1 } from './f1.js';\n" + `export const h${i} = (): number => g0() + g1();\n`);
        }
        const r = await buildMap(root);
        const grew = r.model.drift?.changed.find(([a]) => r.model.areas[a]?.files.some((f) => r.model.files[f]?.path === 'src/billing/f7.ts'));
        expect(grew?.[1]).toBeGreaterThan(0);
        expect(fs.readFileSync(path.join(root, 'agents', 'map', 'MAP.md'), 'utf-8')).toContain('## Since the last map');
    });

    it('detects a split and a merge by file membership', async () => {
        const { graph } = await buildFromRepo(root, null);
        const m = buildMapModel(graph);
        const billing = m.areas.findIndex((a) => a.files.some((f) => m.files[f]?.path === 'src/billing/f0.ts'));
        const auth = m.areas.findIndex((a) => a.files.some((f) => m.files[f]?.path === 'src/auth/f0.ts'));
        const merged = JSON.parse(JSON.stringify(m)) as typeof m;
        const billingFiles = merged.areas[billing]?.files ?? [];
        merged.areas[auth]?.files.push(...billingFiles);
        merged.areas.splice(billing, 1);
        const asMerge = areaDrift(m, merged);
        expect(asMerge?.merged.length).toBe(1);
        const asSplit = areaDrift(merged, m);
        expect(asSplit?.split.length).toBe(1);
    });

    it('flags two open PRs that touch the same area, advisory only', async () => {
        const { graph } = await buildFromRepo(root, null);
        const m = buildMapModel(graph);
        const o = prOverlap(m, [
            { number: 2, title: 'b', files: ['src/billing/f1.ts'] },
            { number: 1, title: 'a', files: ['src/billing/f0.ts', 'README.md'] },
            { number: 3, title: 'c', files: ['src/auth/f0.ts'] },
        ]);
        expect(o.prs.map((p) => p.number)).toEqual([1, 2, 3]);
        expect(o.conflicts.map(([a, b]) => [a, b])).toEqual([[1, 2]]);
    });

    it('decays an outcome against the newest event, not the clock', async () => {
        const { graph } = await buildFromRepo(root, null);
        const m = buildMapModel(graph);
        const i = m.files.findIndex((f) => f.path === 'src/billing/f0.ts');
        const j = m.files.findIndex((f) => f.path === 'src/auth/f0.ts');
        const scores = outcomeScores(m, [
            { path: 'src/billing/f0.ts', outcome: 'useful', at: '2026-01-15T00:00:00Z' },
            { path: 'src/auth/f0.ts', outcome: 'dead-end', at: '2026-01-01T00:00:00Z' },
        ]);
        expect(scores).toEqual([
            [Math.min(i, j), i < j ? 1 : -0.5],
            [Math.max(i, j), i < j ? -0.5 : 1],
        ]);
    });

    it('records an outcome locally and draws it on the next map', async () => {
        recordOutcome(root, path.join(root, 'src', 'billing', 'f0.ts'), 'useful');
        const r = await buildMap(root);
        const i = r.model.files.findIndex((f) => f.path === 'src/billing/f0.ts');
        expect(r.model.outcomes).toEqual([[i, 1]]);
    });
});

describe('review findings, pinned', () => {
    it('refuses an --out directory that holds someone else\'s files', async () => {
        const foreign = path.join(root, 'docs');
        write('docs/areas/keep.md', '# mine\n');
        await expect(buildMap(root, { outDir: foreign })).rejects.toThrow(/not empty and holds no map\.json/);
        expect(fs.existsSync(path.join(foreign, 'areas', 'keep.md'))).toBe(true);
    });

    it('reads a map of another shape as no map at all', async () => {
        write('agents/map/map.json', '{}');
        expect(readMap(root)).toBeNull();
        write('agents/map/map.json', JSON.stringify({ meta: {}, model: { version: 999, files: [], areas: [], edges: [], analyses: {} } }));
        expect(readMap(root)).toBeNull();
        // ...and the next build over it draws instead of crashing on drift.
        await expect(buildMap(root)).resolves.toBeDefined();
    });

    it('keeps a backtick in a file name from breaking out of its code span', async () => {
        write('src/billing/we`ird.ts', "import { g0 } from './f0.js';\nexport const w = (): number => g0();\n");
        await buildMap(root);
        const page = fs.readdirSync(path.join(root, 'agents', 'map', 'areas')).map((f) => fs.readFileSync(path.join(root, 'agents', 'map', 'areas', f), 'utf-8')).join('\n');
        expect(page).toContain("`src/billing/we'ird.ts`");
        expect(page).not.toContain('we`ird');
    });

    it('records an outcome only for a file inside the root, and skips malformed log lines', () => {
        expect(() => recordOutcome(root, path.join(os.tmpdir()), 'useful')).toThrow(/not a file inside/);
        write('agents/runtime/state/map-outcomes.jsonl', 'null\n{not json\n{"path":"src/a.ts","outcome":"useful","at":"2026-01-01T00:00:00Z"}\n');
        expect(readOutcomes(root)).toEqual([{ path: 'src/a.ts', outcome: 'useful', at: '2026-01-01T00:00:00Z' }]);
    });
});

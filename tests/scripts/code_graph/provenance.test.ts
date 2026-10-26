import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../../src/scripts/code_graph/map.js';
import type { MapProvenance } from '../../../src/scripts/code_graph/map_model.js';
import { readProvenance, ticketsIn } from '../../../src/scripts/code_graph/provenance.js';
import { writeProvenanceFixture } from './provenance_fixture.js';

let root: string;

beforeAll(() => {
    root = writeProvenanceFixture();
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('the provenance index', () => {
    it('attributes branch commits to the PR that merged them, with the branch ticket', () => {
        const p = readProvenance(root)!;
        const f = p.files['database/migrations/2026_10_01_000000_create_orders_table.php']!;
        const intro = p.commits[f.introduced!]!;
        expect(intro.subject).toBe('add orders');
        expect(intro.pr).toBe('#7');
        expect(intro.tickets).toEqual(['ABC-12']);
        expect(p.tickets['ABC-12']?.length).toBeGreaterThan(0);
    });

    it('reads a squash subject as its PR', () => {
        const p = readProvenance(root)!;
        const f = p.files['database/migrations/2026_10_02_000000_add_status_to_orders_table.php']!;
        expect(p.commits[f.introduced!]?.pr).toBe('#9');
    });

    it('separates a file\'s introduction from its last change', () => {
        const p = readProvenance(root)!;
        const app = p.files['src/app.js']!;
        expect(p.commits[app.introduced!]?.subject).toBe('chore: init');
        expect(p.commits[app.last]?.pr).toBe('#7');
        expect(app.changes).toBe(2);
    });

    it('never reads an acceptance criterion in prose as a ticket', () => {
        const p = readProvenance(root)!;
        expect(Object.keys(p.tickets)).toEqual(['ABC-12']);
    });

    it('withholds an author configured as an address and reads no e-mail', () => {
        const p = readProvenance(root)!;
        expect(JSON.stringify(p)).not.toContain('example.com');
        expect(p.commits.every((c) => c.author === 'Dev One')).toBe(true);
    });
});

describe('ticket positions', () => {
    it.each([
        [null, 'ABC-12: add orders', '', ['ABC-12']],
        [null, '[ABC-12] add orders', '', ['ABC-12']],
        [null, 'feat(ABC-12): add orders', '', ['ABC-12']],
        ['ABC-12-orders', 'add orders', '', ['ABC-12']],
        [null, 'docs: AC-1 holds', 'see ISO-8601 and AC-2', []],
    ])('branch %s, subject %s → %j', (branch, subject, body, want) => {
        expect(ticketsIn(branch, subject, body, null)).toEqual(want);
    });

    it('with the project keys, a key counts in the body too', () => {
        expect(ticketsIn(null, 'add orders', 'Refs ABC-12, see AC-1', ['ABC'])).toEqual(['ABC-12']);
    });
});

describe('provenance in the map', () => {
    let prov: MapProvenance;
    let mapDir: string;

    beforeAll(async () => {
        fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
        const res = await buildMap(root, {});
        mapDir = res.outDir;
        prov = (JSON.parse(fs.readFileSync(path.join(mapDir, 'code', 'map.json'), 'utf-8')) as { model: { provenance: MapProvenance } }).model.provenance;
    }, 120_000);

    it('gives the route the PR and ticket of the commit that introduced its line', () => {
        const r = prov.routes['POST /orders'];
        expect(r).toBeDefined();
        const intro = prov.commits[r![0]]!;
        expect([intro[3], intro[4]]).toEqual(['#7', ['ABC-12']]);
    });

    it('gives a column the PR of the migration that added it', () => {
        const f = prov.files['database/migrations/2026_10_02_000000_add_status_to_orders_table.php'];
        expect(prov.commits[f![0]]?.[3]).toBe('#9');
    });

    it('finds what a ticket introduced', () => {
        const commits = new Set(prov.tickets['ABC-12']);
        const built = Object.entries(prov.files).filter(([, v]) => commits.has(v[0])).map(([k]) => k);
        expect(built).toContain('database/migrations/2026_10_01_000000_create_orders_table.php');
        expect(Object.entries(prov.routes).filter(([, v]) => commits.has(v[0])).map(([k]) => k)).toEqual(['POST /orders']);
    });

    it('writes no e-mail address anywhere under the map folder', () => {
        const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === '.build' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
        for (const f of walk(mapDir)) expect(fs.readFileSync(f, 'utf-8')).not.toContain('example.com');
    });
});

describe('code-graph provenance', () => {
    it('answers a ticket, a PR, a file and a route', async () => {
        const { buildFromRepo } = await import('../../../src/scripts/code_graph/build.js');
        const { provenanceAnswer } = await import('../../../src/scripts/code_graph/provenance_verbs.js');
        const { graph } = await buildFromRepo(root, null, { lanes: true });
        const index = readProvenance(root)!;
        const cache = fs.mkdtempSync(path.join(root, '.cache-'));
        const ticket = provenanceAnswer(root, graph, index, 'ABC-12', cache).lines.join('\n');
        expect(ticket).toMatch(/introduced \(\d+\):[\s\S]*create_orders_table\.php/);
        expect(ticket).toMatch(/routes introduced \(1\):\n {2}POST \/orders/);
        expect(ticket).toMatch(/ask it; nothing of its text is stored here/);
        expect(provenanceAnswer(root, graph, index, '#9', cache).lines.join('\n')).toMatch(/introduced \(1\):\n {2}database\/migrations\/2026_10_02_000000_add_status_to_orders_table\.php/);
        expect(provenanceAnswer(root, graph, index, 'src/app.js', cache).lines.join('\n')).toMatch(/introduced: {3}2026-10-01 \w{8} Dev One — chore: init/);
        const route = provenanceAnswer(root, graph, index, 'POST /orders', cache);
        expect(route.kind).toBe('element');
        expect(route.lines.join('\n')).toMatch(/introduced: {3}2026-10-01 \w{8} ABC-12 Dev One — add orders|introduced: {3}2026-10-01 \w{8} #7 ABC-12 Dev One — add orders/);
        expect(provenanceAnswer(root, graph, index, 'nothing-here', cache).kind).toBe('none');
    }, 120_000);
});

describe('provenance feeds the pack and review risk', () => {
    it('names the ticket and PR a file came in for, and the tickets a diff touches', async () => {
        const { introducedNote, ticketsTouched } = await import('../../../src/scripts/code_graph/provenance.js');
        const p = readProvenance(root)!;
        expect(introducedNote(p, 'database/migrations/2026_10_01_000000_create_orders_table.php')).toBe('introduced for ABC-12, PR #7 (2026-10-01)');
        expect(introducedNote(p, 'README.md')).toBeNull();
        const touched = ticketsTouched(p, ['src/app.js', 'database/migrations/2026_10_02_000000_add_status_to_orders_table.php']);
        expect(touched.map((t) => t.key)).toEqual(['#7', '#9', 'ABC-12']);
        expect(touched.find((t) => t.key === '#7')?.files).toEqual(['src/app.js']);
    });
});

describe('the context pack carries provenance', () => {
    it('an item from a file that came in for a ticket names it', async () => {
        const { buildFromRepo } = await import('../../../src/scripts/code_graph/build.js');
        const { loadGraph } = await import('../../../src/scripts/code_graph/query.js');
        const { contextPack } = await import('../../../src/scripts/code_graph/verify/pack.js');
        const { cachedProvenance } = await import('../../../src/scripts/code_graph/provenance.js');
        const dir = fs.mkdtempSync(path.join(root, '.pack-'));
        const cache = path.join(dir, 'code-graph-v1.json');
        await buildFromRepo(root, cache, { lanes: true });
        cachedProvenance(root, dir);
        const p = contextPack(loadGraph(cache), root, cache, '', { diffFiles: ['src/app.js'] });
        const item = p.items.find((i) => (i.at ?? '').startsWith('src/app.js') || i.id === 'src/app.js');
        expect(item).toBeDefined();
        expect(p.lines.join('\n')).not.toContain('introduced for ABC-12');
        const q = contextPack(loadGraph(cache), root, cache, '', { diffFiles: ['database/migrations/2026_10_01_000000_create_orders_table.php'] });
        expect(q.lines.join('\n')).toContain('introduced for ABC-12, PR #7 (2026-10-01)');
    }, 120_000);
});

/**
 * The data lane and the build that runs every lane: DR-1…DR-13 over the planted
 * data fixtures, their exemptions, the actual-schema rungs, and a reader that
 * fails without failing the build.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo, runLaneReaders } from '../../src/scripts/code_graph/build.js';
import { type DriftFinding, evaluateDrift } from '../../src/scripts/code_graph/drift.js';
import { DRIFT_RULES } from '../../src/scripts/code_graph/drift_rules.js';
import { readData, readDeclaredWaivers, redundantIndexes, typeFamily } from '../../src/scripts/code_graph/lanes/data/read_data.js';
import { spanHash } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import { mergeLaneOutputs } from '../../src/scripts/code_graph/lanes/merge.js';
import { RUNTIME_RULES } from '../../src/scripts/code_graph/lanes/runtime/drift_rules.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';

const FIX = path.resolve(__dirname, '../fixtures/code-graph');
const DRIFT = path.join(FIX, 'data', 'drift');
const CLEAN = path.join(FIX, 'data', 'clean');
const P1 = path.join(FIX, 'correctness', 'p1-blog');

const tmp: string[] = [];
function copy(src: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-data-'));
    tmp.push(dir);
    fs.cpSync(src, dir, { recursive: true });
    return dir;
}
afterAll(() => {
    for (const d of tmp) fs.rmSync(d, { recursive: true, force: true });
});

async function laned(root: string): Promise<CodeGraph> {
    return (await buildFromRepo(root, null, { lanes: true })).graph;
}
const findings = (g: CodeGraph, root: string): DriftFinding[] => evaluateDrift(g, DRIFT_RULES, readDeclaredWaivers(root)).findings;
const ids = (fs: DriftFinding[], rule: string): string[] => fs.filter((f) => f.rule === rule).map((f) => f.subject).sort();

let drift: DriftFinding[];
let driftGraph: CodeGraph;
beforeAll(async () => {
    driftGraph = await laned(DRIFT);
    drift = findings(driftGraph, DRIFT);
});

describe('data drift on the planted fixture', () => {
    it('fires every planted class on its subject', () => {
        expect(ids(drift, 'DR-2')).toEqual(['column:orders.agent_id', 'column:orders.coupon_id']);
        expect(ids(drift, 'DR-5')).toEqual(['column:orders.coupon_id']);
        expect(ids(drift, 'DR-6')).toEqual(['column:order_items.order_id', 'column:orders.agent_id', 'column:orders.coupon_id', 'column:orders.user_id']);
        expect(ids(drift, 'DR-7')).toEqual(['column:orders.agent_id']);
        expect(ids(drift, 'DR-8')).toEqual(['column:orders.user_id']);
        expect(ids(drift, 'DR-9')).toEqual(['column:order_items.order_id']);
        expect(ids(drift, 'DR-10')).toEqual(['column:orders.coupon_id']);
        expect(ids(drift, 'DR-12')).toEqual(['table:orders']);
        expect(ids(drift, 'DR-13')).toEqual(['column:orders.warehouse_id']);
    });

    it('sets the actual schema (T3 snapshot, T4 oracle) against the migrations both ways', () => {
        const dr11 = drift.filter((f) => f.rule === 'DR-11').map((f) => `${f.title}: ${f.subject}`).sort();
        expect(dr11).toEqual([
            'actual column no migration creates: column:coupons.expires_at@oracle',
            'actual column no migration creates: column:users.legacy_flag@actual',
            'actual table no migration creates: table:audit_log@actual',
            'intended and actual column differ: column:orders.shop_id',
            'intended column missing from the actual schema: column:orders.note',
        ]);
        // A table the snapshot does not cover is never reported as missing from it.
        expect(drift.some((f) => f.rule === 'DR-11' && f.subject.startsWith('column:order_items.'))).toBe(false);
    });

    it('gives every finding two witnesses that hash to the line they name', () => {
        for (const f of drift.filter((x) => x.rule !== 'DR-11' || x.title !== 'actual table no migration creates')) {
            for (const w of f.witnesses) {
                expect(w, `${f.rule} ${f.subject}`).not.toBeNull();
                const line = fs.readFileSync(path.join(DRIFT, w!.file!), 'utf-8').split('\n')[w!.line! - 1]!;
                expect(spanHash(line.trim()), `${f.rule} ${w!.at}`).toBe(w!.hash);
            }
            expect(f.engine).toBe('pgsql');
            expect(f.tier).toBe('advice');
        }
    });

    it('proposes fixes as text: an orphan pre-check, then NOT VALID and VALIDATE on PostgreSQL', () => {
        const dr1 = drift.find((f) => f.rule === 'DR-1' && f.subject === 'column:orders.shop_id')!;
        expect(dr1.fix).toContain('SELECT count(*) FROM orders c LEFT JOIN shops p ON p.id = c.shop_id');
        expect(dr1.fix).toMatch(/NOT VALID;\nALTER TABLE orders VALIDATE CONSTRAINT orders_shop_id_foreign;$/);
        expect(drift.find((f) => f.rule === 'DR-6' && f.subject === 'column:orders.user_id')?.fix).toBe('CREATE INDEX CONCURRENTLY orders_user_id_index ON orders (user_id);');
    });

    it('waives a declared virtual relation with its reason, and exempts one across connections', () => {
        expect(drift.find((f) => f.subject === 'column:orders.shop_id' && f.rule === 'DR-1')?.waived?.reason).toMatch(/^declared virtual relation: shops live/);
        expect(drift.some((f) => f.rule === 'DR-1' && f.subject === 'column:tenant:invoices.user_id')).toBe(false);
        // The cross-connection exemption is the annotation, not a missing relation.
        const col = driftGraph.nodes.find((n) => n.id === 'column:tenant:invoices.user_id')!;
        expect(col.fact?.attrs?.['data:cross_connection']).toBe(true);
    });

    it('emits one connection fact per connection, with the engine the project states', () => {
        const conns = driftGraph.nodes.filter((n) => n.kind === 'connection').map((n) => [n.id, n.fact?.attrs?.['engine'], n.fact?.witness.file]);
        expect(conns).toEqual([
            ['connection:default', 'pgsql', 'config/database.php'],
            ['connection:tenant', 'pgsql', 'config/database.php'],
        ]);
    });
});

describe('the negatives stay silent', () => {
    it('the clean fixture yields no data finding', async () => {
        const g = await laned(CLEAN);
        expect(findings(g, CLEAN).map((f) => `${f.rule} ${f.subject}`)).toEqual([]);
    });

    it('P1 keeps DR-1 on comments.post_id, DR-3 on Tag and DR-4 on post_tag through the lane build', async () => {
        const f = findings(await laned(P1), P1);
        expect(f.filter((x) => ['DR-1', 'DR-3', 'DR-4'].includes(x.rule)).map((x) => `${x.rule} ${x.subject}`)).toEqual([
            'DR-1 column:comments.post_id',
            'DR-3 app/Models/Tag.php#Tag',
            'DR-4 table:post_tag',
        ]);
    });

    it('a keyless connection declared by the project exempts DR-1 instead of waiving it', async () => {
        const dir = copy(DRIFT);
        fs.writeFileSync(path.join(dir, 'agents/map/data/declarations.json'), JSON.stringify({ fk_mode: { default: 'none' } }));
        const f = findings(await laned(dir), dir);
        expect(f.filter((x) => x.rule === 'DR-1')).toEqual([]);
    });
});

describe('engine awareness', () => {
    const unknownEngine = (dir: string): void => {
        fs.writeFileSync(path.join(dir, 'config/database.php'), "<?php\n\nreturn ['connections' => []];\n");
    };

    it('an unstated engine makes DR-6 ask, and a MySQL service in compose answers it', async () => {
        const dir = copy(CLEAN);
        fs.writeFileSync(path.join(dir, 'database/migrations/2024_01_01_000002_create_posts_table.php'), fs.readFileSync(path.join(CLEAN, 'database/migrations/2024_01_01_000002_create_posts_table.php'), 'utf-8').replace("->index()->constrained()", '->constrained()'));
        unknownEngine(dir);
        expect(ids(findings(await laned(dir), dir), 'DR-6')).toEqual(['column:posts.user_id']);
        fs.writeFileSync(path.join(dir, 'compose.yaml'), 'services:\n  db:\n    image: mysql:8.4\n');
        const g = await laned(dir);
        expect(ids(findings(g, dir), 'DR-6')).toEqual([]);
        expect(g.nodes.find((n) => n.id === 'connection:default')?.fact?.attrs).toMatchObject({ engine: null, effective_engine: 'mysql', engine_source: 'runtime' });
    });

    it('RT-2 compares the data lane connection with the runtime database image', async () => {
        const dir = copy(CLEAN);
        fs.writeFileSync(path.join(dir, 'compose.yaml'), 'services:\n  db:\n    image: mysql:8.4\n');
        const rt2 = evaluateDrift(await laned(dir), RUNTIME_RULES).findings.filter((f) => f.rule === 'RT-2');
        expect(rt2.map((f) => f.subject)).toEqual(['connection:default']);
        expect(rt2[0]!.message).toMatch(/pgsql.*mysql/);
    });
});

describe('the actual-schema readers', () => {
    it('reads a committed schema dump nothing else replays as T2, and never a dump with data rows', async () => {
        const dir = copy(CLEAN);
        fs.mkdirSync(path.join(dir, 'database/schema'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'database/schema/pgsql-schema.sql'), 'CREATE TABLE public.legacy_reports (\n    id bigint NOT NULL,\n    body text\n);\n');
        fs.writeFileSync(path.join(dir, 'dump.sql'), '-- MySQL dump 10.13\nCREATE TABLE things (id int);\nINSERT INTO things VALUES (1);\n');
        const { graph } = await buildFromRepo(dir, null);
        const out = readData(dir, graph);
        expect(out.facts.filter((f) => f.rung === 'T2').map((f) => f.id)).toEqual(['column:legacy_reports.body', 'column:legacy_reports.id', 'table:legacy_reports']);
        expect(out.skipped).toEqual([{ file: 'dump.sql', reason: 'dump holds data rows; only a schema-only dump is read' }]);
    });

    it('names its type families and redundant indexes from the facts alone', () => {
        expect(['bigint unsigned', 'int8', 'bigserial'].map(typeFamily)).toEqual(['int64', 'int64', 'int64']);
        expect(typeFamily('character varying(255)')).toBe(typeFamily('varchar'));
        expect(typeFamily('integer')).not.toBe(typeFamily('bigint'));
        expect(redundantIndexes(['a_idx(a)', 'ab_idx(a,b)', 'b_uq(b) unique'], ['id'])).toEqual(['a_idx(a) is a leading prefix of ab_idx(a,b)']);
        expect(redundantIndexes(['b_idx(b)', 'ba_idx(b,a)'], [])).toEqual(['b_idx(b) is a leading prefix of ba_idx(b,a)']);
        expect(redundantIndexes(['ab_idx(a,b)', 'b_idx(b)'], [])).toEqual([]);
    });
});

describe('the build runs every lane and survives a failing one', () => {
    it('reports each lane and merges their facts', async () => {
        const r = await buildFromRepo(DRIFT, null, { lanes: true });
        expect(r.lanes?.runs.map((x) => x.lane).sort()).toEqual(['data', 'decisions', 'delivery', 'flows', 'history', 'interfaces', 'runtime']);
        expect(r.lanes?.runs.every((x) => x.error === undefined)).toBe(true);
        expect(r.graph.nodes.some((n) => n.kind === 'connection')).toBe(true);
    });

    it('a reader that throws is reported and left out; the graph still has the rest', async () => {
        const { graph } = await buildFromRepo(DRIFT, null);
        const r = runLaneReaders(DRIFT, graph, {
            readers: {
                runtime: () => {
                    throw new Error('planted reader failure');
                },
            },
        });
        expect(r.summary.runs.find((x) => x.lane === 'runtime')?.error).toBe('planted reader failure');
        expect(r.graph.nodes.some((n) => n.kind === 'connection')).toBe(true);
    });
});

describe('annotations on facts another reader owns', () => {
    it('are refused without the lane prefix or without a fact to carry them, and a re-merge removes exactly them', () => {
        const empty = { lane: 'data' as const, facts: [], relations: [], skipped: [] };
        const r = mergeLaneOutputs(driftGraph, [
            {
                ...empty,
                annotations: [
                    { id: 'table:orders', attrs: { soft_deletes: true } },
                    { id: 'nowhere', attrs: { 'data:x': true } },
                ],
            },
        ]);
        expect(r.refused.map((x) => x.reason)).toEqual(['annotation keys must carry the lane prefix "data:": soft_deletes', 'annotated node not in the graph']);
        const orders = (g: CodeGraph) => g.nodes.find((n) => n.id === 'table:orders')!.fact!.attrs!;
        expect(orders(driftGraph)['data:redundant_indexes']).toBeDefined();
        const cleared = mergeLaneOutputs(driftGraph, [empty]).graph;
        expect(Object.keys(orders(cleared)).filter((k) => k.startsWith('data:'))).toEqual([]);
        expect(orders(cleared)['engine']).toBe('pgsql');
    });
});

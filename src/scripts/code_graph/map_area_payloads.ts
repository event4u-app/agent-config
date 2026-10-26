/**
 * The knowledge areas of the map, produced from the merged graph's facts.
 *
 * Each payload is a projection of facts the lane readers merged into the graph,
 * every item with the witness it was read from (confirm state `unconfirmed`: an
 * index fact until `confirm` re-reads it). Drift comes from the one engine and
 * lands in the area of its rule's lane. An area whose lane ran and found
 * nothing carries `empty` with the reason; an area no reader ran for is left
 * out, and the page says so. Tours are templates over facts: each step hashes
 * the facts it was built from, and a step whose hash differs from the previous
 * map's is `stale`. Nothing here writes a file; ERD pages are returned for the
 * map writer to place.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gitProbe } from '../_lib/spawn_env.js';
import type { IrForeignKey, IrTable, SchemaIr } from '../_lib/schema/ir.js';
import { emptySkipCounters, IR_VERSION } from '../_lib/schema/ir.js';
import { renderMermaidIr } from '../_lib/schema/render/mermaid.js';
import { isTestFile } from './build.js';
import { type DriftFinding, evaluateDrift } from './drift.js';
import { ALL_DRIFT_RULES } from './drift_rules.js';
import { readDeclaredWaivers } from './lanes/data/read_data.js';
import { spanHash } from './lanes/lane_fact.js';
import type {
    AgentPayload,
    AgentVerb,
    AreaFinding,
    Completeness,
    DataPayload,
    DataTable,
    DeliveryPayload,
    ImpactItem,
    ImpactLayer,
    ImpactPayload,
    InterfaceService,
    InterfacesPayload,
    MapAreas,
    MapTour,
    RuntimePayload,
    SourceRung,
    Witness,
} from './map_areas.js';
import { diffHunks, type Hunk, reviewRisk, type RiskItem } from './review_risk.js';
import type { CodeEdge, CodeGraph, CodeNode } from './types.js';

export interface ErdPage {
    cluster: string;
    tables: string[];
    /** Path inside the map folder. */
    file: string;
    content: string;
}

export interface AreaBuild {
    areas: MapAreas;
    erd: ErdPage[];
}

export interface ProduceOptions {
    /** Rev to set the working tree against for Impact; default HEAD, and Impact is empty without a change. */
    diffRev?: string;
    /** The previous map's tours, so a step whose input changed is marked stale. */
    previousTours?: MapTour[];
    /** Node ids the working-tree overlay holds and the committed index does not: their witnesses read `added`. */
    added?: readonly string[];
    /** Hunks to use instead of running `git diff` (tests). */
    hunks?: Hunk[];
}

const LANES_OF_AREA = { data: 'data', interfaces: 'interfaces', runtime: 'runtime', delivery: 'delivery' } as const;

/** Whether a lane's reader ran in the build the graph came from, and why it merged nothing when it failed. */
interface LaneState {
    ran: boolean;
    error?: string;
}

/**
 * `lanes_run` is the record; a graph written before it existed falls back to
 * "some lane fact is present", which cannot tell one lane from another.
 */
function laneState(c: Ctx, lane: string, legacyRan: boolean): LaneState {
    const runs = c.graph.lanes_run;
    if (!runs) return { ran: legacyRan };
    const r = runs.find((x) => x.lane === lane);
    if (!r) return { ran: false };
    return r.error === undefined ? { ran: true } : { ran: true, error: publicError(c, r.error) };
}

/** A reader's error goes into a committed page: no host path survives in it. */
function publicError(c: Ctx, message: string): string {
    return (c.root ? message.split(c.root).join('.') : message)
        .replace(/(?:[A-Za-z]:)?[\\/](?:Users|home|private|tmp|var|opt|root)[\\/][^\s'"`]*/g, '<path>')
        .slice(0, 240);
}

/** The reason an area that ran shows instead of facts. */
function emptyReason(st: LaneState, foundNothing: string): string {
    return st.error === undefined ? foundNothing : `the reader failed: ${st.error}`;
}

const COMPLETENESS: readonly Completeness[] = ['unknown', 'partial', 'complete'];
const worst = (cs: readonly string[]): Completeness =>
    cs.length === 0 ? 'unknown' : (cs.reduce((a, b) => (COMPLETENESS.indexOf(a as Completeness) <= COMPLETENESS.indexOf(b as Completeness) ? a : b)) as Completeness);

interface Ctx {
    root: string;
    graph: CodeGraph;
    byId: Map<string, CodeNode>;
    out: Map<string, CodeEdge[]>;
    inn: Map<string, CodeEdge[]>;
    lines: Map<string, string[] | null>;
    added: ReadonlySet<string>;
}

function lineOf(c: Ctx, file: string, line: number): string | null {
    if (!c.lines.has(file)) {
        try {
            c.lines.set(file, fs.readFileSync(path.join(c.root, file), 'utf-8').split('\n'));
        } catch {
            c.lines.set(file, null);
        }
    }
    return c.lines.get(file)?.[line - 1] ?? null;
}

const safeFile = (f: string | null | undefined): f is string => typeof f === 'string' && f !== '' && !f.startsWith('/') && !f.includes('\\') && !/^[a-z]:/i.test(f) && !f.split('/').includes('..');

/** A witness the page can show, or null when the fact names no readable repository line. */
function witness(c: Ctx, w: { file: string | null; line: number | null; hash: string | null } | undefined | null, rung?: SourceRung): Witness | null {
    if (!w || !safeFile(w.file) || !w.line || w.line < 1) return null;
    let hash = w.hash && /^[0-9a-f]{6,}$/i.test(w.hash) ? w.hash : null;
    if (!hash) {
        const text = lineOf(c, w.file, w.line);
        if (text === null) return null;
        hash = spanHash(text.trim());
    }
    return { file: w.file, line: w.line, hash, confirm: 'unconfirmed', ...(rung ? { rung } : {}) };
}

function nodeWitness(c: Ctx, n: CodeNode | undefined): Witness | null {
    if (!n) return null;
    if (n.fact) {
        const w = witness(c, n.fact.witness, n.fact.rung);
        return w && c.added.has(n.id) ? { ...w, confirm: 'added' } : w;
    }
    const line = n.source_location[0] ?? (n.kind === 'file' ? 1 : null);
    return witness(c, { file: n.source_file, line, hash: null }, 'T1');
}

function edgeWitness(c: Ctx, e: CodeEdge): Witness | null {
    return e.fact ? witness(c, e.fact.witness, e.fact.rung) : nodeWitness(c, c.byId.get(e.source));
}

function refWitness(c: Ctx, ref: unknown): Witness | null {
    if (typeof ref !== 'string') return null;
    const m = /^(.*):(\d+):([0-9a-f]{6,})$/.exec(ref);
    return m ? witness(c, { file: m[1] as string, line: Number(m[2]), hash: m[3] as string }) : null;
}

const attr = (n: CodeNode | undefined, k: string): unknown => n?.fact?.attrs?.[k];
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v !== '' ? [v] : []);

function toAreaFinding(c: Ctx, f: DriftFinding): AreaFinding {
    const ws = f.witnesses.map((w) => (w ? witness(c, w) : null)).filter((w): w is Witness => w !== null);
    return {
        id: f.rule,
        severity: f.handoff ? 'high' : f.tier === 'gate' ? 'high' : /suggestion/.test(f.title) ? 'info' : 'medium',
        subject: f.subject,
        message: `${f.message}${f.waived ? ` — waived: ${f.waived.reason}` : ''}${f.fix ? `\nfix (proposal, never applied): ${f.fix}` : ''}`,
        witnesses: ws,
        ...(f.engine !== 'unknown' ? { engine: f.engine } : {}),
        completeness: (COMPLETENESS as readonly string[]).includes(f.completeness) ? (f.completeness as Completeness) : 'unknown',
    };
}

// ---- data -------------------------------------------------------------------

function tableName(n: CodeNode): string {
    const conn = String(attr(n, 'connection') ?? 'default');
    return conn === 'default' ? n.label : `${conn}:${n.label}`;
}

function dataPayload(c: Ctx, findings: AreaFinding[], st: LaneState): { payload: DataPayload; erd: ErdPage[] } | null {
    const intended = c.graph.nodes.filter((n) => n.kind === 'table' && n.fact && !n.id.includes('@'));
    const actualSources = [...new Set(c.graph.nodes.filter((n) => n.kind === 'table' && n.id.includes('@')).map((n) => n.fact?.owner ?? '').filter(Boolean))].sort();
    const actualCols = new Map<string, CodeNode>();
    for (const n of c.graph.nodes) if (n.kind === 'column' && n.id.includes('@')) actualCols.set(n.id.replace(/@\w+$/, ''), n);
    const members = (t: CodeNode): CodeNode[] =>
        (c.out.get(t.id) ?? []).filter((e) => e.relation === 'member').map((e) => c.byId.get(e.target)).filter((x): x is CodeNode => x?.kind === 'column');
    const tables: DataTable[] = [];
    const irTables = new Map<string, { conn: string; ir: IrTable }>();
    for (const t of intended) {
        const tw = nodeWitness(c, t);
        if (!tw) continue;
        const uniques = new Set(strs(attr(t, 'indexes')).map((s) => /^.*\(([^,)]*)\)\s+unique$/.exec(s)?.[1]).filter((x): x is string => !!x));
        const actualSeen = attr(t, 'data:actual_seen') !== undefined;
        const cols = members(t)
            .map((col) => {
                const w = nodeWitness(c, col);
                if (!w) return null;
                const name = col.label.slice(t.label.length + 1);
                const fk = (c.out.get(col.id) ?? []).some((e) => e.relation === 'references');
                const key = attr(col, 'primary') === true ? 'pk' : fk ? 'fk' : uniques.has(name) ? 'uk' : attr(col, 'index') === 'declared' ? 'ix' : undefined;
                const act = actualCols.get(col.id);
                const actW = act ? nodeWitness(c, act) : null;
                const uses = (relation: 'reads' | 'writes'): Witness[] =>
                    (c.inn.get(col.id) ?? []).filter((e) => e.relation === relation).map((e) => edgeWitness(c, e)).filter((x): x is Witness => x !== null);
                const reads = uses('reads');
                const writes = uses('writes');
                return {
                    name,
                    type: String(attr(col, 'type') ?? ''),
                    nullable: attr(col, 'nullable') === true,
                    ...(key ? { key: key as 'pk' | 'fk' | 'uk' | 'ix' } : {}),
                    witness: w,
                    ...(typeof attr(col, 'data:type_family') === 'string' ? { family: String(attr(col, 'data:type_family')) } : {}),
                    ...(act && actW
                        ? { actual: { type: String(attr(act, 'type') ?? ''), nullable: attr(act, 'nullable') === true, ...(typeof attr(act, 'data:type_family') === 'string' ? { family: String(attr(act, 'data:type_family')) } : {}), witness: actW } }
                        : actualSeen
                          ? { actual: null }
                          : {}),
                    ...(reads.length || writes.length ? { code: { reads, writes } } : {}),
                };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
            .sort((a, b) => a.witness.file.localeCompare(b.witness.file) || a.witness.line - b.witness.line || (a.name < b.name ? -1 : 1));
        const models = (c.inn.get(t.id) ?? []).filter((e) => e.relation === 'persists').map((e) => c.byId.get(e.source)?.source_file ?? '').filter(Boolean);
        tables.push({ name: tableName(t), connection: String(attr(t, 'connection') ?? 'default'), columns: cols, models: [...new Set(models)].sort(), witness: tw });
        irTables.set(t.id, {
            conn: String(attr(t, 'connection') ?? 'default'),
            ir: {
                name: t.label,
                comment: null,
                columns: cols.map((col, i) => ({ name: col.name, type: col.type || 'unknown', nullable: col.nullable, default: null, auto_increment: false, ordinal: i + 1, comment: null })),
                primary_key: strs(attr(t, 'primary_key')),
                indexes: [],
                foreign_keys: [],
            },
        });
    }
    const foreignKeys: DataPayload['foreignKeys'] = [];
    const tableOf = (colId: string): CodeNode | undefined => {
        const m = (c.inn.get(colId) ?? []).find((e) => e.relation === 'member' && c.byId.get(e.source)?.kind === 'table');
        return m ? c.byId.get(m.source) : undefined;
    };
    const fkLinks = new Map<string, Set<string>>();
    for (const e of c.graph.edges) {
        if (e.relation !== 'references' || c.byId.get(e.source)?.kind !== 'column' || c.byId.get(e.target)?.kind !== 'column') continue;
        const from = tableOf(e.source);
        const to = tableOf(e.target);
        const w = edgeWitness(c, e);
        if (!from || !to || !w) continue;
        const fromCol = c.byId.get(e.source)!.label.slice(from.label.length + 1);
        const toCol = c.byId.get(e.target)!.label.slice(to.label.length + 1);
        const onDelete = e.fact?.attrs?.['on_delete'];
        const onUpdate = e.fact?.attrs?.['on_update'];
        foreignKeys.push({
            from: { table: tableName(from), column: fromCol },
            to: { table: tableName(to), column: toCol },
            ...(typeof onDelete === 'string' ? { onDelete } : {}),
            ...(typeof onUpdate === 'string' ? { onUpdate } : {}),
            witness: w,
        });
        const fk: IrForeignKey = { name: String(e.fact?.attrs?.['name'] ?? `${from.label}_${fromCol}_foreign`), columns: [fromCol], ref_table: to.label, ref_columns: [toCol], on_delete: typeof onDelete === 'string' ? onDelete : null, on_update: typeof onUpdate === 'string' ? onUpdate : null };
        irTables.get(from.id)?.ir.foreign_keys.push(fk);
        fkLinks.set(from.id, new Set([...(fkLinks.get(from.id) ?? []), to.id]));
        fkLinks.set(to.id, new Set([...(fkLinks.get(to.id) ?? []), from.id]));
    }
    const relations: DataPayload['relations'] = [];
    for (const e of c.graph.edges) {
        if (e.relation !== 'relates') continue;
        const kind = e.fact?.attrs?.['kind'];
        const w = edgeWitness(c, e);
        if (!w || typeof kind !== 'string' || !['1:1', '1:n', 'n:1', 'n:m', 'polymorphic'].includes(kind)) continue;
        const owner = /#([^:#]+)::/.exec(e.source)?.[1] ?? c.byId.get(e.source)?.label ?? e.source;
        const key = e.fact?.attrs?.['key'];
        relations.push({ kind: kind as DataPayload['relations'][number]['kind'], from: owner, to: c.byId.get(e.target)?.label ?? e.target, ...(typeof key === 'string' ? { key } : {}), witness: w });
    }

    // ERD clusters: tables joined by foreign keys, per connection; tables with no key form one cluster per connection.
    const erd: ErdPage[] = [];
    const seen = new Set<string>();
    const clusters: Array<{ conn: string; ids: string[] }> = [];
    for (const id of [...irTables.keys()].sort()) {
        if (seen.has(id)) continue;
        const group: string[] = [];
        const stack = [id];
        while (stack.length) {
            const x = stack.pop()!;
            if (seen.has(x) || !irTables.has(x)) continue;
            seen.add(x);
            group.push(x);
            stack.push(...(fkLinks.get(x) ?? []));
        }
        clusters.push({ conn: irTables.get(id)!.conn, ids: group.sort() });
    }
    const singles = new Map<string, string[]>();
    for (const cl of clusters) {
        if (cl.ids.length > 1) continue;
        singles.set(cl.conn, [...(singles.get(cl.conn) ?? []), ...cl.ids]);
    }
    const groups = [...clusters.filter((cl) => cl.ids.length > 1), ...[...singles].map(([conn, ids]) => ({ conn, ids, standalone: true }))];
    const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    for (const g of groups) {
        const names = g.ids.map((id) => irTables.get(id)!.ir.name);
        const hub = [...g.ids].sort((a, b) => (fkLinks.get(b)?.size ?? 0) - (fkLinks.get(a)?.size ?? 0) || (a < b ? -1 : 1))[0];
        const anchor = 'standalone' in g ? 'standalone' : (hub ? irTables.get(hub)!.ir.name : 'tables');
        const cluster = slug(g.conn === 'default' ? anchor : `${g.conn}-${anchor}`);
        const ir: SchemaIr = {
            ir_version: IR_VERSION,
            dialect: 'pgsql',
            source: { kind: 'sql', normalization_class: 'static', ref: 'agents/map' },
            skipped: emptySkipCounters(),
            tables: g.ids.map((id) => irTables.get(id)!.ir),
        };
        const file = `data/schema-${cluster}.md`;
        erd.push({
            cluster,
            file,
            tables: g.ids.map((id) => tableName(c.byId.get(id)!)),
            content: [
                `# Schema — ${cluster}`,
                '',
                `Connection \`${g.conn}\` · ${names.length} table(s): ${names.map((n) => `\`${n}\``).join(', ')}. Drawn from the migrations the code graph replayed; every table and column carries its witness in \`map.json\`.`,
                '',
                '```mermaid',
                renderMermaidIr(ir).trimEnd(),
                '```',
                '',
            ].join('\n'),
        });
    }

    if (tables.length === 0 && actualSources.length === 0) {
        return {
            payload: { reader: 'data lane (migrations, dumps, snapshots)', completeness: 'unknown', empty: emptyReason(st, 'no migration, schema file, committed dump or snapshot was found'), findings, tables: [], foreignKeys: [], relations: [] },
            erd: [],
        };
    }
    const conn = c.byId.get('connection:default');
    const engine = attr(conn, 'effective_engine') ?? attr(conn, 'engine') ?? attr(intended[0], 'engine');
    return {
        payload: {
            reader: 'data lane (migrations T1, dumps T2, snapshots T3, oracle files T4)',
            completeness: worst(intended.map((t) => String(attr(t, 'completeness') ?? 'unknown'))),
            ...(typeof engine === 'string' && engine !== 'unknown' ? { engine } : {}),
            ...(actualSources.length ? { actualSources } : {}),
            erd: erd.map((p) => ({ cluster: p.cluster, file: p.file, tables: p.tables })),
            findings,
            tables,
            foreignKeys,
            relations,
        },
        erd,
    };
}

// ---- interfaces ---------------------------------------------------------------

const PROTOCOLS = ['rest', 'soap', 'graphql', 'grpc', 'sdk', 'webhook'] as const;

function interfacesPayload(c: Ctx, findings: AreaFinding[], st: LaneState): InterfacesPayload | null {
    const services: InterfaceService[] = [];
    for (const s of c.graph.nodes.filter((n) => n.kind === 'service' && n.fact?.lane === 'interfaces')) {
        const sw = nodeWitness(c, s);
        if (!sw) continue;
        const proto = strs(attr(s, 'protocols'))[0] ?? '';
        const configNames = new Set(strs(attr(s, 'config_names')));
        for (const e of c.out.get(s.id) ?? []) if (e.relation === 'configured-by') configNames.add(e.target.replace(/^env(-var)?:/, '').replace(/^.*#/, ''));
        const operations: InterfaceService['operations'] = [];
        for (const m of c.out.get(s.id) ?? []) {
            if (m.relation !== 'member') continue;
            const o = c.byId.get(m.target);
            const ow = nodeWitness(c, o);
            if (!o || o.kind !== 'operation' || !ow) continue;
            const required = new Set(strs(attr(o, 'required')));
            const callers = (c.inn.get(o.id) ?? []).filter((e) => e.relation === 'calls-out').map((e) => edgeWitness(c, e)).filter((w): w is Witness => w !== null);
            const method = attr(o, 'method');
            const p = attr(o, 'path');
            operations.push({
                name: o.label,
                ...(typeof method === 'string' ? { method } : {}),
                ...(typeof p === 'string' ? { path: p } : {}),
                params: strs(attr(o, 'params')).map((name) => ({ name, required: required.has(name) })),
                callers,
                ...(attr(o, 'source') === 'contract' ? { contract: ow } : {}),
                witness: ow,
            });
        }
        services.push({
            name: s.label,
            protocol: (PROTOCOLS as readonly string[]).includes(proto) ? (proto as InterfaceService['protocol']) : 'unknown',
            direction: proto === 'webhook' ? 'inbound' : 'outbound',
            configNames: [...configNames].sort(),
            operations: operations.sort((a, b) => (a.name < b.name ? -1 : 1)),
            witness: sw,
        });
    }
    if (!st.ran && services.length === 0) return null;
    return {
        reader: 'interfaces lane (call sites, contracts, configuration names)',
        completeness: st.error !== undefined ? 'unknown' : services.some((s) => s.protocol === 'unknown') ? 'partial' : 'complete',
        ...(services.length === 0 ? { empty: emptyReason(st, 'no outbound call site, contract or service configuration name was found') } : {}),
        findings,
        services: services.sort((a, b) => (a.name < b.name ? -1 : 1)),
    };
}

// ---- runtime -------------------------------------------------------------------

function runtimePayload(c: Ctx, findings: AreaFinding[], st: LaneState): RuntimePayload | null {
    const services: RuntimePayload['services'] = [];
    for (const s of c.graph.nodes.filter((n) => n.kind === 'service' && n.fact?.lane === 'runtime' && attr(n, 'source') !== 'resolved')) {
        const w = nodeWitness(c, s);
        if (!w) continue;
        const outs = c.out.get(s.id) ?? [];
        const target = (rel: string): CodeNode[] => outs.filter((e) => e.relation === rel).map((e) => c.byId.get(e.target)).filter((x): x is CodeNode => x !== undefined);
        const image = target('uses-image')[0];
        const imageRef = attr(image, 'ref') ?? attr(s, 'image');
        const ports = target('publishes').map((p): RuntimePayload['services'][number]['ports'][number] => {
            const published = Number(attr(p, 'published'));
            const t = Number(attr(p, 'target'));
            const proto = attr(p, 'protocol');
            return { ...(Number.isFinite(published) && published > 0 ? { published } : {}), target: Number.isFinite(t) ? t : 0, ...(proto === 'tcp' || proto === 'udp' ? { protocol: proto as 'tcp' | 'udp' } : {}) };
        });
        const envNames = new Set<string>();
        for (const e of target('configured-by')) if (e.kind === 'env-var') envNames.add(String(attr(e, 'name') ?? e.label));
        for (const n of c.graph.nodes) if (n.kind === 'env-var' && attr(n, 'context') === s.id) envNames.add(String(attr(n, 'name') ?? n.label));
        services.push({
            name: s.label,
            ...(typeof imageRef === 'string' ? { image: imageRef } : image ? { image: image.label } : {}),
            ports,
            networks: target('on-network').map((n) => n.label).sort(),
            envNames: [...envNames].sort(),
            witness: w,
        });
    }
    const counts = new Map<string, number>();
    for (const s of services) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
    for (const s of services) if ((counts.get(s.name) ?? 0) > 1) s.name = `${s.name} (${s.witness.file})`;
    const resources: RuntimePayload['resources'] = [];
    for (const r of c.graph.nodes.filter((n) => n.kind === 'resource' && n.fact?.lane === 'runtime')) {
        const w = nodeWitness(c, r);
        if (!w) continue;
        const type = String(attr(r, 'api_kind') ?? attr(r, 'type') ?? attr(r, 'resource_type') ?? r.label.split(/[./]/)[0] ?? 'resource');
        const module = attr(r, 'module');
        const ns = attr(r, 'namespace');
        resources.push({ name: r.label, type, ...(typeof module === 'string' ? { module } : {}), environments: typeof ns === 'string' ? [ns] : [], witness: w });
    }
    const environments = [...new Set([...c.graph.nodes.filter((n) => n.kind === 'environment' && n.fact?.lane === 'runtime').map((n) => n.label), ...resources.flatMap((r) => r.environments)])].sort();
    if (!st.ran && services.length === 0 && resources.length === 0) return null;
    return {
        reader: 'runtime lane (compose, Dockerfiles, Terraform, Kubernetes, task files)',
        completeness: st.error !== undefined ? 'unknown' : 'complete',
        ...(services.length === 0 && resources.length === 0 ? { empty: emptyReason(st, 'no compose file, Dockerfile, Terraform or Kubernetes manifest was found') } : {}),
        findings,
        environments,
        resources: resources.sort((a, b) => (a.name < b.name ? -1 : 1)),
        services: services.sort((a, b) => (a.name < b.name ? -1 : 1)),
    };
}

// ---- delivery ------------------------------------------------------------------

function deliveryPayload(c: Ctx, findings: AreaFinding[], st: LaneState): DeliveryPayload | null {
    const strip = (id: string, kind: string): string => id.replace(new RegExp(`^${kind}:`), '');
    const workflows: DeliveryPayload['workflows'] = [];
    for (const w of c.graph.nodes.filter((n) => n.kind === 'workflow' && n.fact?.lane === 'delivery' && !n.id.startsWith('workflow:include:'))) {
        const ww = nodeWitness(c, w);
        if (!ww) continue;
        workflows.push({ file: w.fact!.owner, name: w.label, triggers: strs(attr(w, 'triggers')), witness: ww });
    }
    const jobs: DeliveryPayload['jobs'] = [];
    for (const j of c.graph.nodes.filter((n) => n.kind === 'job' && n.fact?.lane === 'delivery')) {
        const jw = nodeWitness(c, j);
        if (!jw) continue;
        const outs = c.out.get(j.id) ?? [];
        const env = attr(j, 'environment');
        const cond = attr(j, 'if') ?? attr(j, 'condition');
        jobs.push({
            id: strip(j.id, 'job'),
            workflow: strip(String(attr(j, 'context') ?? j.fact!.owner), 'workflow'),
            name: j.label,
            needs: outs.filter((e) => e.relation === 'needs').map((e) => strip(e.target, 'job')),
            ...(typeof env === 'string' ? { environment: env } : {}),
            ...(typeof cond === 'string' ? { condition: cond } : {}),
            uses: outs.filter((e) => e.relation === 'uses' || e.relation === 'calls').map((e) => c.byId.get(e.target)?.label ?? strip(strip(e.target, 'action'), 'workflow')),
            witness: jw,
        });
    }
    const chain: DeliveryPayload['chain'] = [];
    for (const e of c.graph.edges) {
        if (e.fact?.lane !== 'delivery' || !['builds', 'delivers', 'deploys-to'].includes(e.relation)) continue;
        const w = edgeWitness(c, e);
        if (!w) continue;
        const src = c.byId.get(e.source);
        const tgt = c.byId.get(e.target);
        if (e.relation === 'builds') chain.push({ kind: 'build', name: `${src?.label ?? e.source} → ${tgt?.label ?? e.target}`, job: strip(e.source, 'job'), witness: w });
        else if (e.relation === 'delivers' && tgt?.kind === 'environment') {
            const via = e.fact.attrs?.['via'];
            chain.push({ kind: 'image', name: src?.label ?? e.source, environment: tgt.label, ...(typeof via === 'string' ? { job: strip(via, 'job') } : {}), witness: w });
        } else if (e.relation === 'deploys-to') chain.push({ kind: 'deploy', name: src?.label ?? e.source, environment: tgt?.label ?? e.target, job: strip(e.source, 'job'), witness: w });
    }
    const environments = [...new Set(c.graph.nodes.filter((n) => n.kind === 'environment' && n.fact?.lane === 'delivery').map((n) => n.label))].sort();
    if (!st.ran && workflows.length === 0) return null;
    return {
        reader: 'delivery lane (GitHub Actions, GitLab CI)',
        completeness: st.error !== undefined ? 'unknown' : 'complete',
        ...(workflows.length === 0 ? { empty: emptyReason(st, 'no GitHub Actions workflow or GitLab CI file was found') } : {}),
        findings,
        workflows: workflows.sort((a, b) => (a.file < b.file ? -1 : 1)),
        jobs: jobs.sort((a, b) => (a.id < b.id ? -1 : 1)),
        environments,
        chain,
    };
}

// ---- impact ----------------------------------------------------------------------

function impactPayload(c: Ctx, opts: ProduceOptions): ImpactPayload | null {
    const rev = opts.diffRev ?? 'HEAD';
    const hunks = opts.hunks ?? diffHunks(c.root, rev);
    if (hunks === null) return null;
    const reader = 'review-risk over the working diff';
    if (hunks.length === 0) return { reader, completeness: 'complete', empty: `no change against ${rev}`, findings: [], rev, changed: [], affected: [] };
    const r = reviewRisk(c.root, c.graph, rev, hunks);
    const affected: ImpactItem[] = [];
    const add = (layer: ImpactLayer, i: RiskItem): void => {
        const w = i.witness ? witness(c, i.witness) : null;
        if (w) affected.push({ layer, name: i.label, why: i.why, witness: w });
    };
    const testOrCode = (i: RiskItem): ImpactLayer => (isTestFile(i.witness?.file ?? '') ? 'tests' : 'code');
    for (const s of r.seeds) add(testOrCode(s), s);
    const termItems = (term: string): RiskItem[] => r.terms.find((t) => t.term === term)?.items ?? [];
    for (const i of termItems('callers')) add(testOrCode(i), i);
    for (const i of termItems('columns')) add('data', i);
    for (const i of termItems('operations')) add('interfaces', i);
    for (const i of termItems('pipelines')) add('delivery', i);
    for (const i of termItems('area crossings')) if (i.why.startsWith('runtime:')) add('runtime', i);
    return {
        reader,
        completeness: 'complete',
        findings: [],
        rev,
        changed: r.changed,
        affected,
        risk: {
            total: r.total,
            terms: r.terms.map((t) => {
                const w = t.items[0]?.witness ? witness(c, t.items[0].witness) : null;
                return { term: t.term, fact: `${t.items.length} × weight ${t.weight}${t.items.length ? ` (first: ${t.items[0]!.label})` : ''}`, contribution: t.contribution, ...(w ? { witness: w } : {}) };
            }),
        },
    };
}

// ---- agent -----------------------------------------------------------------------

/** Every graph verb an agent can call, what it answers, and the MCP tool (and mode) that answers the same. */
export const AGENT_VERBS: readonly AgentVerb[] = [
    { name: 'query', answers: 'Which symbols match a name, kind or relation filter — with witness and population line', cli: 'agent-config code-graph query <term>', mcp: 'graph_query' },
    { name: 'explain', answers: 'The two-hop neighbourhood of one symbol (callers, callees, members), never generated prose', cli: 'agent-config code-graph explain <symbol>', mcp: 'graph_node' },
    { name: 'affected', answers: 'What reaches a symbol or the files changed since a rev', cli: 'agent-config code-graph affected <symbol>|--since <rev>' },
    { name: 'path', answers: 'The shortest stated path between two symbols', cli: 'agent-config code-graph path <a> <b>', mcp: 'graph_path' },
    { name: 'impact', answers: 'Callers, dependents and test files a diff can break', cli: 'agent-config code-graph impact --diff <rev>', mcp: 'graph_impact' },
    { name: 'tests-for', answers: 'The test files that exercise a symbol', cli: 'agent-config code-graph tests-for <symbol>', mcp: 'graph_tests_for' },
    { name: 'untested', answers: 'Changed symbols no test imports', cli: 'agent-config code-graph untested --diff <rev>', mcp: 'graph_impact (untested_only)' },
    { name: 'dead', answers: 'Symbols nothing reaches, refused where the graph cannot tell', cli: 'agent-config code-graph dead', mcp: 'graph_dead' },
    { name: 'review-risk', answers: 'A diff as a sum of terms — callers, entry points, flows, co-change partners, areas, columns, operations, pipelines — each fact with its witness', cli: 'agent-config code-graph review-risk [--diff <rev>]', mcp: 'graph_impact (review_risk)' },
    { name: 'confirm', answers: 'Whether the witnesses of an answer still hold in the working tree: confirmed, moved, changed or gone', cli: 'agent-config code-graph confirm <id…>', mcp: 'graph_node (confirm)' },
    { name: 'pack', answers: 'A verified context pack for a task within a token budget, each item at file:line', cli: 'agent-config code-graph pack "<task>"', mcp: 'graph_query (pack)' },
];

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The verbs the CLI dispatches, read from its own source: a verb the CLI does not route is not listed. */
export function cliVerbs(dir: string = HERE): Set<string> {
    for (const f of ['cli.ts', 'cli.js']) {
        try {
            const src = fs.readFileSync(path.join(dir, f), 'utf-8');
            return new Set([...src.matchAll(/sub === '([a-z-]+)'/g)].map((m) => m[1] as string));
        } catch {
            continue;
        }
    }
    return new Set();
}

function agentPayload(): AgentPayload {
    const routed = cliVerbs();
    const verbs = AGENT_VERBS.filter((v) => routed.has(v.name));
    return {
        reader: 'code-graph CLI and MCP surface',
        completeness: 'complete',
        findings: [],
        verbs,
    };
}

// ---- tours -----------------------------------------------------------------------

const hashOf = (parts: unknown[]): string => createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 12);

function tours(c: Ctx, areas: MapAreas, previous: readonly MapTour[] = []): MapTour[] {
    const flows = c.graph.nodes
        .filter((n) => n.kind === 'flow')
        .sort((a, b) => Number(attr(b, 'size') ?? 0) - Number(attr(a, 'size') ?? 0) || (a.id < b.id ? -1 : 1))
        .slice(0, 3);
    const out: MapTour[] = [];
    for (const f of flows) {
        const entry = c.byId.get(String(attr(f, 'entry') ?? ''));
        const steps: MapTour['steps'] = [];
        const w = f.fact?.witness;
        steps.push({
            area: 'code',
            ...(entry?.source_file ? { item: entry.source_file } : {}),
            text: `Entry point: ${String(attr(f, 'entry_kind') ?? 'entry')} ${entry?.label ?? f.label} in ${entry?.source_file ?? w?.file ?? '?'}:${w?.line ?? '?'}.`,
            inputHash: hashOf([w?.hash, attr(f, 'entry')]),
            state: 'fresh',
        });
        steps.push({
            area: 'code',
            text: `The flow walks ${String(attr(f, 'size') ?? 0)} symbol(s) to depth ${String(attr(f, 'depth') ?? 0)}${attr(f, 'truncated_size') || attr(f, 'truncated_depth') ? ' (cut at a cap)' : ''}.`,
            inputHash: hashOf([attr(f, 'nodes'), attr(f, 'depth')]),
            state: 'fresh',
        });
        // A flow that reads columns reaches their tables too.
        const viaColumns = strs(attr(f, 'nodes'))
            .filter((id) => c.byId.get(id)?.kind === 'column')
            .map((id) => (c.inn.get(id) ?? []).find((e) => e.relation === 'member' && c.byId.get(e.source)?.kind === 'table'))
            .map((e) => (e ? c.byId.get(e.source)?.label : undefined))
            .filter((x): x is string => x !== undefined);
        const tables = [...new Set([...strs(attr(f, 'tables')), ...viaColumns])].sort();
        if (tables.length) {
            const t = c.graph.nodes.find((n) => n.kind === 'table' && n.label === tables[0]);
            steps.push({
                area: 'data',
                item: `table/${tables[0]}`,
                text: `It reaches ${tables.length} table(s): ${tables.join(', ')}.`,
                inputHash: hashOf([tables, t?.fact?.witness.hash]),
                state: 'fresh',
            });
        }
        const wf = areas.delivery?.workflows[0];
        if (wf) {
            const jobs = (areas.delivery?.jobs ?? []).filter((j) => j.workflow === wf.file);
            steps.push({
                area: 'delivery',
                item: `workflow/${wf.file}`,
                text: `It ships through ${wf.name} (${wf.file}) with ${jobs.length} job(s): ${jobs.map((j) => j.name).join(', ')}.`,
                inputHash: hashOf([wf.witness.hash, jobs.map((j) => j.witness.hash)]),
                state: 'fresh',
            });
        }
        const id = `flow-${hashOf([f.id])}`;
        const before = previous.find((t) => t.id === id);
        for (const [i, s] of steps.entries()) {
            const old = before?.steps[i];
            if (old && old.inputHash !== s.inputHash) s.state = 'stale';
        }
        out.push({ id, title: `Follow ${f.label}`, steps });
    }
    return out;
}

/** Every knowledge area the merged graph can fill, with its ERD pages. */
export function produceAreas(root: string, graph: CodeGraph, opts: ProduceOptions = {}): AreaBuild {
    const c: Ctx = { root, graph, byId: new Map(graph.nodes.map((n) => [n.id, n] as const)), out: new Map(), inn: new Map(), lines: new Map(), added: new Set(opts.added ?? []) };
    for (const e of graph.edges) {
        c.out.set(e.source, [...(c.out.get(e.source) ?? []), e]);
        c.inn.set(e.target, [...(c.inn.get(e.target) ?? []), e]);
    }
    const legacyRan = graph.nodes.some((n) => n.fact?.lane !== undefined) || graph.edges.some((e) => e.fact?.lane !== undefined);
    const lane = (id: string): LaneState => laneState(c, id, legacyRan);
    const report = evaluateDrift(graph, ALL_DRIFT_RULES, readDeclaredWaivers(root));
    const byLane = (lane: string): AreaFinding[] => report.findings.filter((f) => f.lane === lane).map((f) => toAreaFinding(c, f));
    const areas: MapAreas = {};
    const dataLane = lane(LANES_OF_AREA.data);
    const data = dataPayload(c, byLane(LANES_OF_AREA.data), dataLane);
    if (data && (dataLane.ran || data.payload.tables.length)) areas.data = data.payload;
    const interfaces = interfacesPayload(c, byLane(LANES_OF_AREA.interfaces), lane(LANES_OF_AREA.interfaces));
    if (interfaces) areas.interfaces = interfaces;
    const runtime = runtimePayload(c, byLane(LANES_OF_AREA.runtime), lane(LANES_OF_AREA.runtime));
    if (runtime) areas.runtime = runtime;
    const delivery = deliveryPayload(c, byLane(LANES_OF_AREA.delivery), lane(LANES_OF_AREA.delivery));
    if (delivery) areas.delivery = delivery;
    let isRepo = true;
    try {
        gitProbe(root, ['rev-parse', '--verify', '-q', 'HEAD']);
    } catch {
        isRepo = false;
    }
    const impact = isRepo || opts.hunks ? impactPayload(c, opts) : null;
    if (impact) areas.impact = impact;
    areas.agent = agentPayload();
    const t = tours(c, areas, opts.previousTours);
    if (t.length) areas.tours = t;
    return { areas, erd: areas.data ? (data?.erd ?? []) : [] };
}

/**
 * Flows lane: what an entry point reaches, walked over stated edges only.
 *
 * Entries are what the graph already declares — `route` nodes through their
 * `routes-to` handler — plus classes whose `inherits` edge names a base listed
 * in `caps.json` (a queued job, a console command, an event listener, a
 * scheduled task), entered through their conventional handler method. A walk
 * follows `calls` / `persists` / `reads` edges whose `resolved_via` is a stated
 * mechanism; a name-match or an untyped receiver is not followed, so a flow is
 * a lower bound and says so when a cap cut it short.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isStatedResolution, type CodeEdge, type CodeGraph, type CodeNode, type ResolvedVia } from '../../types.js';
import { spanHash, type LaneFact, type LaneOutput } from '../lane_fact.js';
import defaults from './caps.json';

export type EntryKind = 'route' | 'job' | 'cli' | 'listener' | 'schedule';

export interface FlowCaps {
    max_depth: number;
    max_branch: number;
    max_nodes: number;
    max_overlap: number;
    walk_relations: string[];
    entry_markers: Record<Exclude<EntryKind, 'route'>, string[]>;
    entry_methods: string[];
}

export const DEFAULT_FLOW_CAPS: Readonly<FlowCaps> = defaults as FlowCaps;

export interface BuildFlowsOptions extends Partial<FlowCaps> {
    /** repository root; the entry line is read from it to hash the witness */
    root: string;
    /** entry points the caller declares beyond what the graph marks */
    entries?: Array<{ id: string; kind: EntryKind }>;
}

interface Entry {
    kind: EntryKind;
    /** the declaring node (route, or class) */
    node: CodeNode;
    /** where the walk starts */
    start: string;
    basis: 'route-table' | 'inherits-marker' | 'declared';
}

interface Walk {
    entry: Entry;
    nodes: string[];
    depth: number;
    truncated: { depth: boolean; branch: boolean; size: boolean };
}

const REACHED_KINDS = { table: 'tables', operation: 'operations', environment: 'environments' } as const;

function lastSegment(id: string): string {
    const bare = id.replace(/^symbol:/, '');
    const parts = bare.split(/[\\/.#:]+/).filter(Boolean);
    return parts[parts.length - 1] ?? bare;
}

function findEntries(graph: CodeGraph, caps: FlowCaps, declared: BuildFlowsOptions['entries']): Entry[] {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n] as const));
    const out = new Map<string, Entry>();
    const add = (e: Entry): void => {
        if (!out.has(e.node.id)) out.set(e.node.id, e);
    };
    for (const e of graph.edges) {
        if (e.relation !== 'routes-to') continue;
        const n = nodeById.get(e.source);
        if (n?.kind === 'route' && nodeById.has(e.target)) add({ kind: 'route', node: n, start: e.target, basis: 'route-table' });
    }
    const markerKind = new Map<string, Exclude<EntryKind, 'route'>>();
    for (const [kind, names] of Object.entries(caps.entry_markers) as Array<[Exclude<EntryKind, 'route'>, string[]]>) {
        for (const name of names) if (!markerKind.has(name)) markerKind.set(name, kind);
    }
    const handlerOf = (classId: string): string | undefined => {
        for (const m of caps.entry_methods) if (nodeById.has(`${classId}::${m}`)) return `${classId}::${m}`;
        return undefined;
    };
    for (const e of graph.edges) {
        if (e.relation !== 'inherits') continue;
        const n = nodeById.get(e.source);
        if (!n || n.kind !== 'class') continue;
        const base = nodeById.get(e.target)?.label ?? lastSegment(e.target);
        const kind = markerKind.get(base);
        const start = kind ? handlerOf(n.id) : undefined;
        if (kind && start) add({ kind, node: n, start, basis: 'inherits-marker' });
    }
    for (const d of declared ?? []) {
        const n = nodeById.get(d.id);
        if (!n) continue;
        const start = n.kind === 'class' ? (handlerOf(n.id) ?? n.id) : n.id;
        add({ kind: d.kind, node: n, start, basis: 'declared' });
    }
    return [...out.values()].sort((a, b) => (a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0));
}

function walkFrom(entry: Entry, outgoing: ReadonlyMap<string, CodeEdge[]>, nodeIds: ReadonlySet<string>, caps: FlowCaps): Walk {
    const walk: Walk = { entry, nodes: [], depth: 0, truncated: { depth: false, branch: false, size: false } };
    const seen = new Set<string>([entry.node.id]);
    walk.nodes.push(entry.node.id);
    // A method's class carries the model's `persists` edge; reaching the method reaches the class.
    const owner = (id: string): string | undefined => {
        const i = id.lastIndexOf('::');
        const cls = i > 0 ? id.slice(0, i) : undefined;
        return cls && nodeIds.has(cls) ? cls : undefined;
    };
    let frontier = [entry.start];
    for (let depth = 0; frontier.length > 0; depth++) {
        const next: string[] = [];
        for (const id of frontier) {
            if (!seen.has(id)) {
                if (walk.nodes.length >= caps.max_nodes) {
                    walk.truncated.size = true;
                    continue;
                }
                seen.add(id);
                walk.nodes.push(id);
            }
            walk.depth = Math.max(walk.depth, depth);
            if (depth >= caps.max_depth) {
                if ((outgoing.get(id) ?? []).length > 0) walk.truncated.depth = true;
                continue;
            }
            const sources = [id];
            const cls = owner(id);
            if (cls) sources.push(cls);
            const targets = new Set<string>();
            for (const s of sources) {
                for (const e of outgoing.get(s) ?? []) {
                    if (s === cls && e.relation !== 'persists') continue;
                    targets.add(e.target);
                }
            }
            // A call to a method the class inherits from outside the repository
            // (`Report::create`) has no node; it still lands on the class.
            const sorted = [...new Set([...targets].map((t) => (nodeIds.has(t) ? t : owner(t))).filter((t): t is string => t !== undefined))].sort();
            if (sorted.length > caps.max_branch) walk.truncated.branch = true;
            for (const t of sorted.slice(0, caps.max_branch)) if (!seen.has(t)) next.push(t);
        }
        frontier = [...new Set(next)];
    }
    return walk;
}

function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
    let shared = 0;
    for (const x of a) if (b.has(x)) shared++;
    return shared / Math.max(1, Math.min(a.size, b.size));
}

function readLine(root: string, file: string, line: number): string | null {
    try {
        return fs.readFileSync(path.join(root, file), 'utf-8').split(/\r?\n/)[line - 1] ?? null;
    } catch {
        return null;
    }
}

export function buildFlows(graph: CodeGraph, opts: BuildFlowsOptions): LaneOutput {
    const caps: FlowCaps = {
        max_depth: opts.max_depth ?? DEFAULT_FLOW_CAPS.max_depth,
        max_branch: opts.max_branch ?? DEFAULT_FLOW_CAPS.max_branch,
        max_nodes: opts.max_nodes ?? DEFAULT_FLOW_CAPS.max_nodes,
        max_overlap: opts.max_overlap ?? DEFAULT_FLOW_CAPS.max_overlap,
        walk_relations: opts.walk_relations ?? DEFAULT_FLOW_CAPS.walk_relations,
        entry_markers: opts.entry_markers ?? DEFAULT_FLOW_CAPS.entry_markers,
        entry_methods: opts.entry_methods ?? DEFAULT_FLOW_CAPS.entry_methods,
    };
    const output: LaneOutput = { lane: 'flows', facts: [], relations: [], skipped: [] };
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n] as const));
    const walkable = new Set(caps.walk_relations);
    const outgoing = new Map<string, CodeEdge[]>();
    for (const e of graph.edges) {
        if (!walkable.has(e.relation)) continue;
        if (!isStatedResolution(e.resolved_via as ResolvedVia)) continue;
        const list = outgoing.get(e.source);
        if (list) list.push(e);
        else outgoing.set(e.source, [e]);
    }
    const nodeIds = new Set(nodeById.keys());

    const walks = findEntries(graph, caps, opts.entries).map((en) => walkFrom(en, outgoing, nodeIds, caps));
    // Larger flows first, so a smaller flow mostly inside a kept one folds into it.
    walks.sort((a, b) => b.nodes.length - a.nodes.length || (a.entry.node.id < b.entry.node.id ? -1 : 1));
    const kept: Array<{ walk: Walk; set: Set<string>; folded: string[] }> = [];
    for (const w of walks) {
        const set = new Set(w.nodes);
        const host = kept.find((k) => overlap(k.set, set) > caps.max_overlap);
        if (host) host.folded.push(w.entry.node.id);
        else kept.push({ walk: w, set, folded: [] });
    }

    const facts: LaneFact[] = [];
    for (const { walk, folded } of kept) {
        const n = walk.entry.node;
        const line = n.source_location[0] ?? 1;
        const text = readLine(opts.root, n.source_file, line);
        if (text === null) {
            output.skipped.push({ file: n.source_file, reason: `entry ${n.id} unreadable, flow not witnessed` });
            continue;
        }
        const reached: Record<'tables' | 'operations' | 'environments', string[]> = { tables: [], operations: [], environments: [] };
        for (const id of walk.nodes) {
            const node = nodeById.get(id);
            const bucket = node ? REACHED_KINDS[node.kind as keyof typeof REACHED_KINDS] : undefined;
            if (bucket && node) reached[bucket].push(node.label);
        }
        facts.push({
            kind: 'flow',
            id: `flow:${n.id}`,
            name: `${walk.entry.kind} ${n.label}`,
            attrs: {
                entry: n.id,
                entry_kind: walk.entry.kind,
                entry_basis: walk.entry.basis,
                nodes: walk.nodes,
                size: walk.nodes.length,
                depth: walk.depth,
                tables: [...new Set(reached.tables)].sort(),
                operations: [...new Set(reached.operations)].sort(),
                environments: [...new Set(reached.environments)].sort(),
                folded_entries: folded.sort(),
                truncated_depth: walk.truncated.depth,
                truncated_branch: walk.truncated.branch,
                truncated_size: walk.truncated.size,
            },
            witness: { file: n.source_file, line, hash: spanHash(text) },
            rung: 'T1',
            owner: n.source_file,
        });
    }
    output.facts = facts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return output;
}

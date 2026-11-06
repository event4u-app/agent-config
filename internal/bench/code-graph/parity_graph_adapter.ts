#!/usr/bin/env tsx
/**
 * Turns an external tool's node-link graph export into the edge shape
 * `edge_oracle.ts` scores (road-to-a-graph-that-wins 2.8, the same-roots parity run).
 *
 *   tsx internal/bench/code-graph/parity_graph_adapter.ts --foreign <graph.json>
 *       --native <native graph.json> --out <adapted graph.json>
 *
 * The external graph has no `resolved_via`; the mechanism is its own per-edge
 * confidence tag joined to the scored relation family (`extracted:calls`,
 * `inferred:imports`, …), so its stated/guessed split is read off its own claim.
 *
 * Its nodes carry only a start line, no range, so each endpoint is mapped onto the
 * native node declared on the same file and start line (the label decides between
 * several) and the native nodes are carried over: both graphs are then scored
 * against identical symbol ranges. A symbol with no native declaration on that
 * line falls back to its file id — scored at file level only, and counted. A
 * target with no file (an external module) becomes an unresolved `symbol:` target,
 * which the scorer excludes exactly as it excludes the native graph's.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface NodeLinkGraph {
    nodes: Array<{ id: string; label?: string | undefined; source_file?: string | undefined; source_location?: string | undefined }>;
    links: Array<{ source: string; target: string; relation: string; confidence?: string | undefined }>;
}

interface NativeNode {
    id: string;
    label: string;
    kind: string;
    source_file: string;
    source_location: number[];
}

export interface AdaptedEdge {
    source: string;
    target: string;
    relation: string;
    confidence: string;
    resolved_via: string;
    provider: string;
}

export interface AdaptStats {
    links: number;
    dangling: number;
    unmapped_symbols: number;
    dropped_relation: Record<string, number>;
}

/** The external relation vocabulary, folded onto the families the scorer reads. */
export const RELATION_FAMILY: Readonly<Record<string, string>> = {
    calls: 'calls',
    indirect_call: 'calls',
    imports: 'imports',
    imports_from: 'imports',
    re_exports: 'imports',
    dynamic_import: 'imports',
    includes: 'imports',
    references: 'references',
    references_constant: 'references',
    uses_static_prop: 'references',
    inherits: 'inherits',
    extends: 'inherits',
    implements: 'inherits',
    mixes_in: 'inherits',
};

const bare = (label: string): string => label.replace(/^\./, '').replace(/\(\)$/, '');
const lineOf = (loc: string | undefined): number | null => {
    const m = /^L(\d+)/.exec(loc ?? '');
    return m ? Number(m[1]) : null;
};

export function adaptNodeLinkGraph<N extends NativeNode>(
    foreign: NodeLinkGraph,
    native: { nodes: N[] },
): { nodes: N[]; edges: AdaptedEdge[]; stats: AdaptStats } {
    const declaredAt = new Map<string, N[]>();
    for (const n of native.nodes) {
        const start = n.source_location[0];
        if (!n.id.includes('#') || start === undefined) continue;
        const key = `${n.source_file}\0${start}`;
        declaredAt.set(key, [...(declaredAt.get(key) ?? []), n]);
    }

    const stats: AdaptStats = { links: foreign.links.length, dangling: 0, unmapped_symbols: 0, dropped_relation: {} };
    const unmapped = new Set<string>();
    const idOf = new Map<string, string>();
    for (const f of foreign.nodes) {
        const file = f.source_file;
        if (!file) {
            idOf.set(f.id, `symbol:${f.id}`);
            continue;
        }
        if ((f.label ?? '') === path.basename(file)) {
            idOf.set(f.id, file);
            continue;
        }
        const line = lineOf(f.source_location);
        const candidates = line === null ? [] : (declaredAt.get(`${file}\0${line}`) ?? []);
        const hit = candidates.length === 1 ? candidates[0] : candidates.find((c) => c.label === bare(f.label ?? ''));
        if (hit) idOf.set(f.id, hit.id);
        else {
            idOf.set(f.id, file);
            unmapped.add(f.id);
        }
    }

    const edges: AdaptedEdge[] = [];
    const counted = new Set<string>();
    for (const link of foreign.links) {
        const family = RELATION_FAMILY[link.relation];
        if (family === undefined) {
            stats.dropped_relation[link.relation] = (stats.dropped_relation[link.relation] ?? 0) + 1;
            continue;
        }
        const source = idOf.get(link.source);
        const target = idOf.get(link.target);
        if (source === undefined || target === undefined) {
            stats.dangling++;
            continue;
        }
        for (const end of [link.source, link.target]) if (unmapped.has(end)) counted.add(end);
        const confidence = (link.confidence ?? 'EXTRACTED').toUpperCase();
        edges.push({ source, target, relation: family, confidence, resolved_via: `${confidence.toLowerCase()}:${family}`, provider: 'parity' });
    }
    stats.unmapped_symbols = counted.size;
    return { nodes: native.nodes, edges, stats };
}

function parseArgs(argv: readonly string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (!a.startsWith('--')) continue;
        const v = argv[i + 1];
        if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
        out[a.slice(2)] = v;
        i++;
    }
    return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = parseArgs(process.argv.slice(2));
    if (!args.foreign || !args.native || !args.out) {
        process.stderr.write('usage: parity_graph_adapter.ts --foreign <graph.json> --native <graph.json> --out <graph.json>\n');
        process.exit(2);
    }
    const adapted = adaptNodeLinkGraph(JSON.parse(fs.readFileSync(args.foreign, 'utf8')) as NodeLinkGraph, JSON.parse(fs.readFileSync(args.native, 'utf8')) as { nodes: NativeNode[] });
    fs.writeFileSync(args.out, JSON.stringify({ nodes: adapted.nodes, edges: adapted.edges }));
    process.stdout.write(`${JSON.stringify(adapted.stats)}\n`);
}

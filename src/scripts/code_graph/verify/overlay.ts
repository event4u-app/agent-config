/**
 * The working-tree overlay: facts are owned by files, and a file the working
 * tree changed against the indexed commit has its facts replaced — exactly its
 * facts, no others — by a fresh reading of the working tree, held beside the
 * committed index rather than written into it.
 *
 * The fresh reading is a full in-memory build that reuses the committed cache's
 * per-file extracts, so only the changed files are parsed again and every
 * cross-file binding is the one a rebuild would draw; lane readers whose facts
 * the committed index holds are re-run when the build did not already carry
 * them. Of that reading only the facts owned by a changed file are kept.
 *
 * Queries read committed ⊕ overlay through {@link overlayView}: a committed fact
 * owned by a changed file is hidden, the overlay's facts are shown, and a fact
 * the committed index never held reads `added`. An overlay computed against
 * another index (its checksum differs) is ignored, never half-applied.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from '../../_lib/fs_atomic.js';
import { buildFromRepo, sidecarPath } from '../build.js';
import type { LaneOutput } from '../lanes/lane_fact.js';
import { mergeLaneOutputs } from '../lanes/merge.js';
import type { ConfirmState } from '../map_areas.js';
import type { LoadedGraph } from '../query.js';
import { openGraphIndex } from '../sqlite_store.js';
import type { CodeEdge, CodeGraph, CodeNode } from '../types.js';
import { edgeKey, nodeOwner, openOwnerIndex } from './owner_index.js';
import { headSha, verifyPaths, workingChanges } from './paths.js';
import { type Tombstone, writeTombstones } from './tombstones.js';

export interface Overlay {
    version: 1;
    basis: { checksum: string; head: string | null; dirty: boolean };
    /** Files whose facts the overlay replaces. */
    files: string[];
    /** Of those, the ones deleted from the working tree. */
    deleted: string[];
    nodes: CodeNode[];
    edges: CodeEdge[];
    removed_nodes: string[];
    removed_edges: string[];
    /** Node ids the committed index does not hold. */
    added: string[];
    /** Node ids the committed index holds with a different fact. */
    changed: string[];
}

export interface OverlayResult {
    overlay: Overlay;
    tombstones: Tombstone[];
    /** Lane readers re-run for the overlay, and any that failed. */
    lanes: { ran: string[]; failed: string[] };
}

type LaneReader = (root: string, graph?: CodeGraph) => LaneOutput;

/** File-reading lanes, loaded on demand so a caller that never overlays never imports them. */
async function laneReaders(): Promise<Record<string, LaneReader>> {
    const [ifc, rt, dl, dc, sy] = await Promise.all([
        import('../lanes/interfaces/index.js'),
        import('../lanes/runtime/index.js'),
        import('../lanes/delivery/index.js'),
        import('../lanes/decisions/decisions.js'),
        import('../lanes/systems/index.js'),
    ]);
    return {
        interfaces: (r) => ifc.readInterfaces(r),
        runtime: (r) => rt.readRuntime(r),
        delivery: (r) => dl.readDelivery(r),
        decisions: (r) => dc.readDecisions(r),
        // the working graph's imports decide which packages the changed files use
        systems: (r, g) => sy.readSystems(r, g ? { graph: g } : {}),
    };
}

function edgeOwner(e: CodeEdge, ownerOf: (id: string) => string | undefined): string {
    return e.fact?.owner ?? ownerOf(e.source) ?? e.source;
}

export function basisLabel(b: Overlay['basis']): string {
    return `${b.head ?? 'no-commit'}${b.dirty ? '+dirty' : ''}`;
}

/** The facts of `graph` owned by any of `files`. */
export function ownedFacts(graph: Pick<CodeGraph, 'nodes' | 'edges'>, files: ReadonlySet<string>): { nodes: CodeNode[]; edges: CodeEdge[] } {
    const owner = new Map(graph.nodes.map((n) => [n.id, nodeOwner(n)] as const));
    return {
        nodes: graph.nodes.filter((n) => files.has(nodeOwner(n))),
        edges: graph.edges.filter((e) => files.has(edgeOwner(e, (id) => owner.get(id)))),
    };
}

export interface ComputeOptions {
    /** Files to re-read in addition to what `git status` reports. */
    touched?: readonly string[];
    /** Test seam: the graph a rebuild of the working tree draws. */
    workingGraph?: (root: string, cachePath: string) => Promise<CodeGraph>;
    /** Test seam: lane readers by lane name. */
    readers?: Record<string, LaneReader>;
}

/**
 * Compute the overlay of `root`'s working tree over the committed index at
 * `cachePath`, write it and its tombstones, and return both.
 */
export async function computeOverlay(root: string, cachePath: string, opts: ComputeOptions = {}): Promise<OverlayResult> {
    const index = openGraphIndex(cachePath);
    const owners = index ? openOwnerIndex(cachePath) : null;
    if (!index || !owners) {
        index?.close();
        throw new Error('no current graph index — run `code-graph build` first');
    }
    try {
        return await overlayOver(root, cachePath, index, owners, opts);
    } finally {
        owners.close();
        index.close();
    }
}

async function overlayOver(
    root: string,
    cachePath: string,
    index: NonNullable<ReturnType<typeof openGraphIndex>>,
    owners: NonNullable<ReturnType<typeof openOwnerIndex>>,
    opts: ComputeOptions,
): Promise<OverlayResult> {
    const changes = workingChanges(root);
    const deleted = new Set(changes?.deleted ?? []);
    const touched = (opts.touched ?? []).map((f) => f.split(path.sep).join('/').replace(/^\.\//, ''));
    for (const f of touched) if (!fs.existsSync(path.join(root, f))) deleted.add(f);
    const files = [...new Set([...(changes?.changed ?? []), ...deleted, ...touched])].sort();
    const fileSet = new Set(files);
    const head = headSha(root);
    const basis = { checksum: index.sourceChecksum, head, dirty: (changes?.changed.length ?? 0) + (changes?.deleted.length ?? 0) > 0 };
    const empty: Overlay = { version: 1, basis, files, deleted: [...deleted].sort(), nodes: [], edges: [], removed_nodes: [], removed_edges: [], added: [], changed: [] };
    const lanes = { ran: [] as string[], failed: [] as string[] };
    if (files.length === 0) {
        writeOverlay(cachePath, empty);
        return { overlay: empty, tombstones: writeTombstones(verifyPaths(cachePath).tombstones, [], 'overlay'), lanes };
    }

    let wt = opts.workingGraph
        ? await opts.workingGraph(root, cachePath)
        : (await buildFromRepo(root, null, { update: true, sidecarFrom: sidecarPath(cachePath) })).graph;
    const present = new Set(wt.nodes.map((n) => n.fact?.lane).filter((l): l is string => typeof l === 'string'));
    const wanted = owners.factLanes().filter((l) => !present.has(l));
    if (wanted.length > 0) {
        const readers = opts.readers ?? (await laneReaders());
        const outputs: LaneOutput[] = [];
        for (const lane of wanted) {
            const read = readers[lane];
            if (!read) continue;
            try {
                outputs.push(read(root, wt));
                lanes.ran.push(lane);
            } catch {
                lanes.failed.push(lane);
            }
        }
        if (outputs.length > 0) wt = mergeLaneOutputs(wt, outputs).graph;
    }

    const committed = owners.factsOwnedBy(files);
    const fresh = ownedFacts(wt, fileSet);
    const wtIds = new Set(wt.nodes.map((n) => n.id));
    const wtEdgeKeys = new Set(wt.edges.map(edgeKey));
    const committedById = new Map(committed.nodes.map((n) => [n.id, n] as const));
    const added: string[] = [];
    const changed: string[] = [];
    for (const n of fresh.nodes) {
        const before = committedById.get(n.id) ?? (index.hasNode(n.id) ? index.getNode(n.id) : undefined);
        if (!before) added.push(n.id);
        else if (JSON.stringify(before) !== JSON.stringify(n)) changed.push(n.id);
    }
    const removedNodes = committed.nodes.filter((n) => !wtIds.has(n.id));
    const removedEdges = committed.edges.filter((e) => !wtEdgeKeys.has(edgeKey(e))).map(edgeKey);
    const overlay: Overlay = {
        ...empty,
        nodes: fresh.nodes,
        edges: fresh.edges,
        removed_nodes: removedNodes.map((n) => n.id).sort(),
        removed_edges: [...new Set(removedEdges)].sort(),
        added: added.sort(),
        changed: changed.sort(),
    };
    const label = basisLabel(basis);
    const stones: Tombstone[] = removedNodes.map((n) => ({
        id: n.id,
        kind: n.kind,
        label: n.label,
        owner: nodeOwner(n),
        witness: n.fact?.witness ?? (n.source_location[0] ? { file: n.source_file, line: n.source_location[0] as number, hash: '' } : null),
        reason: deleted.has(nodeOwner(n)) ? 'owner-deleted' : 'span-gone',
        basis: label,
        by: 'overlay',
    }));
    writeOverlay(cachePath, overlay);
    return { overlay, tombstones: writeTombstones(verifyPaths(cachePath).tombstones, stones, 'overlay'), lanes };
}

export function writeOverlay(cachePath: string, overlay: Overlay): void {
    const file = verifyPaths(cachePath).overlay;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    write_atomic(file, `${JSON.stringify(overlay)}\n`);
}

/** The overlay computed against the index with `checksum`, or null. */
export function readOverlay(cachePath: string, checksum: string): Overlay | null {
    try {
        const ov = JSON.parse(fs.readFileSync(verifyPaths(cachePath).overlay, 'utf-8')) as Overlay;
        return ov.version === 1 && ov.basis?.checksum === checksum ? ov : null;
    } catch {
        return null;
    }
}

/** The state an overlay assigns an id before any witness is re-read. */
export function overlayState(ov: Overlay | null, id: string): ConfirmState | undefined {
    if (!ov) return undefined;
    if (ov.added.includes(id)) return 'added';
    if (ov.removed_nodes.includes(id)) return 'gone';
    return undefined;
}

/**
 * A `LoadedGraph` reading committed ⊕ overlay. Committed facts owned by an
 * overlay file are hidden; the overlay's facts replace them.
 */
export function overlayView(g: LoadedGraph, ov: Overlay | null): LoadedGraph {
    if (!ov || ov.files.length === 0) return g;
    const files = new Set(ov.files);
    const removed = new Set(ov.removed_nodes);
    const nodes = new Map(ov.nodes.map((n) => [n.id, n] as const));
    const out = new Map<string, CodeEdge[]>();
    const inn = new Map<string, CodeEdge[]>();
    for (const e of ov.edges) {
        out.set(e.source, [...(out.get(e.source) ?? []), e]);
        inn.set(e.target, [...(inn.get(e.target) ?? []), e]);
    }
    const getNode = (id: string): CodeNode | undefined => {
        const own = nodes.get(id);
        if (own) return own;
        if (removed.has(id)) return undefined;
        const n = g.byId.get(id);
        return n && files.has(nodeOwner(n)) ? undefined : n;
    };
    const ownerOf = (id: string): string | undefined => {
        const n = nodes.get(id) ?? g.byId.get(id);
        return n ? nodeOwner(n) : undefined;
    };
    const keep = (e: CodeEdge): boolean => !files.has(edgeOwner(e, ownerOf));
    const added = ov.nodes.filter((n) => ov.added.includes(n.id));
    return {
        ...g,
        byId: { get: getNode, has: (id) => getNode(id) !== undefined },
        out: { get: (id) => [...(g.out.get(id) ?? []).filter(keep), ...(out.get(id) ?? [])] },
        in: { get: (id) => [...(g.in.get(id) ?? []).filter(keep), ...(inn.get(id) ?? [])] },
        idsByLabel: (label, limit) => {
            const base = g.idsByLabel(label, limit + removed.size).filter((id) => getNode(id) !== undefined);
            const extra = ov.nodes.filter((n) => n.label === label && !base.includes(n.id)).map((n) => n.id);
            return [...base, ...extra].slice(0, limit);
        },
        idsInFiles: (fs_) => {
            const set = new Set(fs_);
            const base = g.idsInFiles(fs_).filter((id) => getNode(id) !== undefined);
            const extra = ov.nodes.filter((n) => n.kind !== 'file' && set.has(n.source_file) && !base.includes(n.id)).map((n) => n.id);
            return [...base, ...extra];
        },
        allNodeIds: () => [...new Set([...g.allNodeIds().filter((id) => getNode(id) !== undefined), ...ov.nodes.map((n) => n.id)])].sort(),
        kindCount: (kind) => g.kindCount(kind) + added.filter((n) => n.kind === kind).length - ov.removed_nodes.filter((id) => g.byId.get(id)?.kind === kind).length,
    };
}

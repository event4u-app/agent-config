/**
 * Edge reads for the two diff detectors (`road-to-a-graph-that-wins` 3.2).
 *
 * ADDITIVE BY CONSTRUCTION. Nothing here is read by the plain detectors'
 * `analyze` / `scanDiff`, and no exit code branches on it: the graph-backed
 * verdict sits beside the plain one, and `paired_verdict` decides from labelled
 * findings whether it is better, worse, or not yet distinguishable. A graph that
 * is absent, unreadable or SCIP-only yields `graph: null` on every row — the
 * plain verdict alone, never a guessed one.
 *
 * ONLY ACCEPTED EDGES DECIDE. An edge counts when `isStatedResolution` admits
 * its `resolved_via`; guess edges (`name-lookup`, `dynamic`, `foreign`) are
 * recorded under `guess_edges` so a reader can see what was withheld, and never
 * move the verdict.
 *
 * NOT IN THE HOOK BUNDLE. Imported only by the two `detect_*` CLIs, which no
 * hook reaches, so the graph open costs the stop hook nothing.
 */
import * as path from 'node:path';

import { detectSources, pickSource } from '../code_graph/detect.js';
import { projectCachePath } from '../code_graph/graph_home.js';
import { type LoadedGraph, loadGraph } from '../code_graph/query.js';
import { type CodeEdge, isStatedResolution, type Relation, type ResolvedVia } from '../code_graph/types.js';
import { decidePairedVerdict, type PairedVerdict } from './paired_verdict.js';

/** One edge a verdict rested on, with the line that witnesses its source. */
export interface UsedEdge {
    source: string;
    target: string;
    relation: Relation;
    resolved_via: ResolvedVia;
    /** `file:line` — the edge fact's witness when recorded, else the source node's declaration. */
    witness: string;
}

/** `fire` — the graph corroborates the finding; `quiet` — it does not; `null` — no graph answered. */
export type GraphCall = 'fire' | 'quiet' | null;

export interface PairedRow {
    /** `file:line`, the key a label set uses. */
    key: string;
    file: string;
    line: number;
    detector_id: string;
    plain: 'fire';
    graph: GraphCall;
    /** Why the graph said what it said, in the reading's own vocabulary. */
    reason: string;
    edges: UsedEdge[];
    guess_edges: UsedEdge[];
}

export interface GraphBackedReport {
    graph_used: boolean;
    graph_source: string | null;
    rows: PairedRow[];
    /** Direction of graph-backed vs plain over the labelled rows; underpowered until enough disagree. */
    paired_verdict: PairedVerdict;
}

/** `true` — the finding is real; `false` — a false positive. Keyed by `file:line`. */
export type FindingLabels = Readonly<Record<string, boolean>>;

/** Relations through which a symbol is used by other code — not `tests`, which is what was deleted. */
const CALLER_RELATIONS: ReadonlySet<Relation> = new Set<Relation>([
    'calls', 'imports', 'uses', 'references', 'inherits', 'injects', 'renders', 'routes-to', 'triggers',
]);

/** Relations a request travels along from an entry point to the code that runs it. */
const REACH_RELATIONS: ReadonlySet<Relation> = new Set<Relation>(['calls', 'routes-to', 'triggers', 'injects']);

const ENTRY_KINDS: ReadonlySet<string> = new Set(['route']);

/** A bound on the backward walk; a route deeper than this is reported `quiet`, not searched forever. */
const MAX_DEPTH = 12;

function witnessOf(g: LoadedGraph, e: CodeEdge): string {
    const w = e.fact?.witness;
    if (w !== undefined) return `${w.file}:${String(w.line)}`;
    const n = g.byId.get(e.source);
    const line = n?.source_location[0];
    return `${n?.source_file ?? e.source}:${line === undefined ? '?' : String(line)}`;
}

function used(g: LoadedGraph, e: CodeEdge): UsedEdge {
    return { source: e.source, target: e.target, relation: e.relation, resolved_via: e.resolved_via, witness: witnessOf(g, e) };
}

/** Open the project's graph, or `null` for every reason there is — absent, SCIP-only, unreadable. */
export function openDetectorGraph(root: string, explicitPath?: string): LoadedGraph | null {
    try {
        if (explicitPath !== undefined) return loadGraph(explicitPath, `native:${path.relative(root, explicitPath)}`);
        const picked = pickSource(detectSources(root, projectCachePath(root)));
        if (!picked || picked.kind === 'scip') return null;
        return loadGraph(picked.path, `${picked.kind}:${path.relative(root, picked.path)}`);
    } catch {
        return null;
    }
}

/**
 * Deleted test file → its subjects (targets of its `tests` edges) → callers of
 * each subject from outside that file. `fire` when any subject keeps one
 * accepted caller: the code is still live and has just lost its verification.
 */
export function deletedTestReading(g: LoadedGraph, testFile: string): Pick<PairedRow, 'graph' | 'reason' | 'edges' | 'guess_edges'> {
    const owners = [testFile, ...g.idsInFiles([testFile])].filter((id) => g.byId.has(id));
    if (owners.length === 0) return { graph: null, reason: 'test file not indexed', edges: [], guess_edges: [] };
    const subjects = new Set<string>();
    for (const o of owners) {
        for (const e of g.out.get(o) ?? []) {
            if (e.relation === 'tests' && isStatedResolution(e.resolved_via)) subjects.add(e.target);
        }
    }
    if (subjects.size === 0) return { graph: 'quiet', reason: 'no accepted tests edge names a subject', edges: [], guess_edges: [] };
    const edges: UsedEdge[] = [];
    const guess: UsedEdge[] = [];
    for (const s of [...subjects].sort()) {
        const targets = [s];
        if (g.byId.get(s)?.kind === 'file') targets.push(...g.idsInFiles([s]));
        for (const t of targets) {
            for (const e of g.in.get(t) ?? []) {
                if (!CALLER_RELATIONS.has(e.relation)) continue;
                if (g.byId.get(e.source)?.source_file === testFile || e.source === testFile) continue;
                (isStatedResolution(e.resolved_via) ? edges : guess).push(used(g, e));
            }
        }
    }
    if (edges.length > 0) return { graph: 'fire', reason: 'subject keeps an accepted caller', edges, guess_edges: guess };
    return { graph: 'quiet', reason: guess.length > 0 ? 'subject has guess-only callers' : 'subject has no caller', edges: [], guess_edges: guess };
}

/** The innermost declared node in `file` whose span contains `line`. */
function enclosing(g: LoadedGraph, file: string, line: number): string | null {
    let best: { id: string; span: number } | null = null;
    for (const id of g.idsInFiles([file])) {
        const loc = g.byId.get(id)?.source_location ?? [];
        const start = loc[0];
        const end = loc[2];
        if (start === undefined || end === undefined || line < start || line > end) continue;
        const span = end - start;
        if (best === null || span < best.span) best = { id, span };
    }
    return best?.id ?? null;
}

/**
 * Catch at `file:line` → its enclosing symbol → backward over accepted
 * reach edges to an entry node. `fire` with the path when one is reached;
 * the guess edges met on the way are recorded and never extend the walk.
 */
export function entryPathReading(g: LoadedGraph, file: string, line: number): Pick<PairedRow, 'graph' | 'reason' | 'edges' | 'guess_edges'> {
    const start = enclosing(g, file, line);
    if (start === null) return { graph: null, reason: 'no indexed symbol encloses the catch', edges: [], guess_edges: [] };
    const via = new Map<string, CodeEdge>();
    const seen = new Set([start]);
    const guess: UsedEdge[] = [];
    let frontier = [start];
    for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth += 1) {
        const next: string[] = [];
        for (const id of frontier) {
            for (const e of g.in.get(id) ?? []) {
                if (!REACH_RELATIONS.has(e.relation)) continue;
                if (!isStatedResolution(e.resolved_via)) {
                    guess.push(used(g, e));
                    continue;
                }
                if (seen.has(e.source)) continue;
                seen.add(e.source);
                via.set(e.source, e);
                if (ENTRY_KINDS.has(g.byId.get(e.source)?.kind ?? '')) {
                    const chain: UsedEdge[] = [];
                    for (let cur: string = e.source; cur !== start; ) {
                        const step = via.get(cur) as CodeEdge;
                        chain.push(used(g, step));
                        cur = step.target;
                    }
                    return { graph: 'fire', reason: 'catch on an accepted path from an entry point', edges: chain, guess_edges: guess };
                }
                next.push(e.source);
            }
        }
        frontier = next.sort();
    }
    return {
        graph: 'quiet',
        reason: guess.length > 0 ? 'entry point reachable only through a guess edge, if at all' : 'no entry point reaches the catch',
        edges: [],
        guess_edges: guess,
    };
}

/**
 * Graph-backed against plain, decided by direction over labelled rows.
 *
 * The plain detector fires on every row, so it is right exactly when the label
 * says the finding is real; the graph-backed one is right when its call agrees
 * with the label. Rows the graph did not answer, and unlabelled rows, carry no
 * evidence about direction and are left out rather than counted as ties.
 */
export function pairedAgainstPlain(rows: readonly PairedRow[], labels: FindingLabels = {}): PairedVerdict {
    const deltas: number[] = [];
    for (const r of rows) {
        const label = labels[r.key];
        if (label === undefined || r.graph === null) continue;
        const plainRight = label ? 1 : 0;
        const graphRight = (r.graph === 'fire') === label ? 1 : 0;
        deltas.push(graphRight - plainRight);
    }
    return decidePairedVerdict({ deltas });
}

export function buildReport(
    g: LoadedGraph | null,
    findings: ReadonlyArray<{ id: string; file: string; line: number }>,
    read: (g: LoadedGraph, f: { file: string; line: number }) => Pick<PairedRow, 'graph' | 'reason' | 'edges' | 'guess_edges'>,
    labels: FindingLabels = {},
): GraphBackedReport {
    const rows: PairedRow[] = findings.map((f) => {
        const base = { key: `${f.file}:${String(f.line)}`, file: f.file, line: f.line, detector_id: f.id, plain: 'fire' as const };
        if (g === null) return { ...base, graph: null, reason: 'no graph', edges: [], guess_edges: [] };
        try {
            return { ...base, ...read(g, f) };
        } catch (err) {
            return { ...base, graph: null, reason: `graph read failed: ${String(err)}`, edges: [], guess_edges: [] };
        }
    });
    return { graph_used: g !== null, graph_source: g?.source ?? null, rows, paired_verdict: pairedAgainstPlain(rows, labels) };
}

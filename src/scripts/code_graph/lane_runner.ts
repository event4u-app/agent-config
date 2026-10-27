/** Runs every lane reader over a tree and merges their facts into the graph. */
import { gitProbe } from '../_lib/spawn_env.js';
import { readData } from './lanes/data/read_data.js';
import { readDecisions } from './lanes/decisions/decisions.js';
import { readDelivery } from './lanes/delivery/index.js';
import { buildFlows } from './lanes/flows/flows.js';
import { readHistory } from './lanes/history/history.js';
import { readInterfaces } from './lanes/interfaces/index.js';
import type { LaneOutput } from './lanes/lane_fact.js';
import { type MergeRefusal, mergeLaneOutputs } from './lanes/merge.js';
import { readRuntime } from './lanes/runtime/index.js';
import { readSystems } from './lanes/systems/index.js';
import type { CodeGraph } from './types.js';

export interface LaneRun {
    lane: LaneOutput['lane'];
    ms: number;
    facts: number;
    relations: number;
    skipped: number;
    /** Relations about files the graph does not hold (co-changes of docs and configs), left out before the merge. */
    outside?: number;
    /** The reader threw: its lane is left out of the graph, the build goes on. */
    error?: string;
}

export interface LaneSummary {
    runs: LaneRun[];
    refused: MergeRefusal[];
    ms: number;
}

/** Bounds the history lane's one `git log` pass, so a huge history cannot stall a build. */
const HISTORY_GIT_TIMEOUT_MS = 20_000;

/**
 * Run every lane reader over the tree and merge their facts into `graph`.
 *
 * A reader that throws is recorded in the summary and its lane is left out;
 * it never fails the build. Flows walk the merged graph, so they run last.
 * The runtime lane runs before the data lane, which takes a connection's
 * engine from the runtime's database service when the project states none.
 */
export function runLaneReaders(
    root: string,
    graph: CodeGraph,
    opts: { readers?: Partial<Record<LaneOutput['lane'], (root: string) => LaneOutput>> } = {},
): { graph: CodeGraph; summary: LaneSummary } {
    const started = Date.now();
    const runs: LaneRun[] = [];
    const run = (lane: LaneOutput['lane'], read: () => LaneOutput): LaneOutput | null => {
        const t0 = Date.now();
        try {
            const replaced = opts.readers?.[lane];
            const out = replaced ? replaced(root) : read();
            runs.push({ lane, ms: Date.now() - t0, facts: out.facts.length, relations: out.relations.length, skipped: out.skipped.length });
            return out;
        } catch (e) {
            runs.push({ lane, ms: Date.now() - t0, facts: 0, relations: 0, skipped: 0, error: (e as Error).message });
            return null;
        }
    };
    const runtime = run('runtime', () => readRuntime(root));
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const history = run('history', () => readHistory(root, { git: (r, a) => gitProbe(r, a, { maxBuffer: 512 * 1024 * 1024, timeout: HISTORY_GIT_TIMEOUT_MS }) }));
    if (history) {
        const kept = history.relations.filter((r) => nodeIds.has(r.from) && nodeIds.has(r.to));
        const rec = runs.find((r) => r.lane === 'history');
        if (rec) Object.assign(rec, { relations: kept.length, outside: history.relations.length - kept.length });
        history.relations = kept;
    }
    const outputs = [
        runtime,
        run('interfaces', () => readInterfaces(root)),
        run('delivery', () => readDelivery(root)),
        history,
        run('decisions', () => readDecisions(root, { nodes: nodeIds })),
        run('data', () => readData(root, graph, runtime ? { runtime } : {})),
        run('systems', () => readSystems(root, { graph })),
    ].filter((o): o is LaneOutput => o !== null);
    const first = mergeLaneOutputs(graph, outputs);
    const flows = run('flows', () => buildFlows(first.graph, { root }));
    const second = flows ? mergeLaneOutputs(first.graph, [flows]) : { graph: first.graph, refused: [] };
    // No timing in the graph: a rebuild of the same tree stays byte-identical.
    const lanes_run = runs.map(({ ms: _m, skipped: _s, outside: _o, ...r }) => r);
    return { graph: { ...second.graph, lanes_run }, summary: { runs, refused: [...first.refused, ...second.refused], ms: Date.now() - started } };
}

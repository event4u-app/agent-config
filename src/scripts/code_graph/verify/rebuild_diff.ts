/**
 * `rebuild-diff`: build the graph incrementally (reusing the cache's per-file
 * extracts, as a refresh does) and cold (every file parsed again), and report
 * every fact on which the two disagree. A build is pure over its extracts, so
 * any difference means a cached extract no longer matches what the reader
 * produces from the same file today — a reader defect, recorded as one.
 * Meant to run on a schedule beside the incremental refreshes it audits.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildFromRepo, sidecarPath } from '../build.js';
import { edgeKey } from './owner_index.js';
import type { CodeGraph } from '../types.js';

export interface RebuildDiff {
    same: boolean;
    incremental: { nodes: number; edges: number };
    cold: { nodes: number; edges: number };
    /** Fact ids (nodes) or edge keys present in only one of the two, or present in both with different content. */
    only_incremental: string[];
    only_cold: string[];
    different: string[];
}

export interface RebuildDiffOptions {
    /** Test seams: the two builds. */
    incremental?: () => Promise<CodeGraph>;
    cold?: () => Promise<CodeGraph>;
}

function factMap(g: CodeGraph): Map<string, string> {
    const m = new Map<string, string>();
    for (const n of g.nodes) m.set(`node ${n.id}`, JSON.stringify(n));
    for (const e of g.edges) m.set(`edge ${edgeKey(e).split('\0').join(' ')}`, JSON.stringify(e));
    return m;
}

export function diffGraphs(incremental: CodeGraph, cold: CodeGraph): RebuildDiff {
    const a = factMap(incremental);
    const b = factMap(cold);
    const onlyA: string[] = [];
    const onlyB: string[] = [];
    const diff: string[] = [];
    for (const [k, v] of a) {
        const w = b.get(k);
        if (w === undefined) onlyA.push(k);
        else if (w !== v) diff.push(k);
    }
    for (const k of b.keys()) if (!a.has(k)) onlyB.push(k);
    return {
        same: onlyA.length === 0 && onlyB.length === 0 && diff.length === 0,
        incremental: { nodes: incremental.nodes.length, edges: incremental.edges.length },
        cold: { nodes: cold.nodes.length, edges: cold.edges.length },
        only_incremental: onlyA.sort(),
        only_cold: onlyB.sort(),
        different: diff.sort(),
    };
}

export async function rebuildDiff(root: string, cachePath: string, opts: RebuildDiffOptions = {}): Promise<RebuildDiff> {
    const incremental = opts.incremental
        ? await opts.incremental()
        : (await buildFromRepo(root, null, { update: true, sidecarFrom: sidecarPath(cachePath) })).graph;
    const cold = opts.cold ? await opts.cold() : (await buildFromRepo(root, null)).graph;
    return diffGraphs(incremental, cold);
}

/** Append the disagreement to the reader-gap log as one line. */
export function logRebuildDiff(gapLog: string, d: RebuildDiff): void {
    if (d.same) return;
    try {
        fs.mkdirSync(path.dirname(gapLog), { recursive: true });
        fs.appendFileSync(
            gapLog,
            `${JSON.stringify({ at: new Date().toISOString(), kind: 'rebuild-diff', only_incremental: d.only_incremental.length, only_cold: d.only_cold.length, different: d.different.length, sample: [...d.only_incremental, ...d.only_cold, ...d.different].slice(0, 20) })}\n`,
        );
    } catch {
        /* the report on stdout stands without the log */
    }
}

export function renderRebuildDiff(d: RebuildDiff): string[] {
    if (d.same) return [`rebuild-diff: incremental and cold builds agree — ${d.cold.nodes} nodes, ${d.cold.edges} edges`];
    const lines = [
        `rebuild-diff: incremental and cold builds DISAGREE — reader defect(s): ${d.only_incremental.length} only incremental, ${d.only_cold.length} only cold, ${d.different.length} different`,
    ];
    for (const k of d.only_incremental.slice(0, 20)) lines.push(`  only incremental: ${k}`);
    for (const k of d.only_cold.slice(0, 20)) lines.push(`  only cold:        ${k}`);
    for (const k of d.different.slice(0, 20)) lines.push(`  different:        ${k}`);
    return lines;
}

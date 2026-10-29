/**
 * The graph's endpoint contract, checked: nodes first (unique ids, valid
 * spans), then edges (every source is a node; every target is a node, a core
 * reference the extractor leaves unresolved by design, or a lane edge that says
 * it is unresolved and why). `code-graph lint` prints what this returns.
 */
import type { CodeGraph } from './types.js';

export type LintKind = 'duplicate-id' | 'invalid-span' | 'dangling-source' | 'dangling-target';

export interface LintProblem {
    kind: LintKind;
    item: string;
    detail: string;
}

/** Targets the core extractor writes when a name does not bind to a node in this tree. */
const CORE_REFERENCE = /^(?:symbol|external):/;

/** A lane relation whose target is not in the graph must say so, with a reason (`lanes/merge.ts`). */
export function declaredUnresolved(attrs: Record<string, unknown> | undefined): boolean {
    return attrs?.['relation_state'] === 'unresolved' && typeof attrs['reason'] === 'string' && attrs['reason'] !== '';
}

function spanProblem(loc: readonly number[]): string | null {
    if (loc.length === 0) return null;
    if (loc.length !== 4 || loc.some((x) => !Number.isInteger(x))) return `expected [] or four integers, got ${JSON.stringify(loc)}`;
    const [l1, c1, l2, c2] = loc as [number, number, number, number];
    if (l1 < 1 || c1 < 1) return `start ${l1}:${c1} is not 1-based`;
    if (l2 < l1 || (l2 === l1 && c2 < c1)) return `end ${l2}:${c2} lies before start ${l1}:${c1}`;
    return null;
}

export function lintGraph(g: Pick<CodeGraph, 'nodes' | 'edges'>): LintProblem[] {
    const out: LintProblem[] = [];
    const ids = new Set<string>();
    for (const n of g.nodes) {
        if (ids.has(n.id)) out.push({ kind: 'duplicate-id', item: n.id, detail: 'two nodes share this id' });
        ids.add(n.id);
        const bad = spanProblem(n.source_location);
        if (bad) out.push({ kind: 'invalid-span', item: n.id, detail: bad });
    }
    for (const e of g.edges) {
        const item = `${e.source} ${e.relation} ${e.target}`;
        if (!ids.has(e.source)) out.push({ kind: 'dangling-source', item, detail: `source not in the graph${e.fact?.lane ? ` (lane ${e.fact.lane})` : ''}` });
        if (ids.has(e.target)) continue;
        if (e.fact?.lane === undefined ? CORE_REFERENCE.test(e.target) : declaredUnresolved(e.fact.attrs)) continue;
        out.push({ kind: 'dangling-target', item, detail: `target not in the graph${e.fact?.lane ? ` (lane ${e.fact.lane}, no relation_state: unresolved)` : ''}` });
    }
    return out;
}

/**
 * Regression hypotheses through the graph (roadmap H.5). For a bug first seen
 * in release R: the changes merged in R's window whose changed symbols the top
 * in-app frames reach within k hops — forward over `calls` and `uses`, and
 * across data through a `reads` on one side and a `writes` of the same target
 * on the other (O10: k = 3, window = one release, widened per query).
 *
 * Ranked by hop distance, then time from merge to first seen, then whether the
 * change was itself a fix. Every hypothesis carries its path with a per-edge
 * witness; an edge whose resolution is a guess is marked dashed. It stays a
 * hypothesis until a test or a bisect proves it (H.6).
 */
import { type CodeEdge, isStatedResolution } from './types.js';

export const DEFAULT_HOPS = 3;

export interface ChangeInWindow {
    sha: string;
    /** merge date, YYYY-MM-DD */
    date: string;
    pr: string | null;
    tickets: string[];
    /** true when the change was itself a fix (`kind` on the provenance commit) */
    fix: boolean;
    symbols: string[];
}

export interface PathStep {
    source: string;
    target: string;
    relation: CodeEdge['relation'];
    witness: string;
    dashed: boolean;
}

export interface RegressionHypothesis {
    state: 'hypothesis';
    frame: string;
    symbol: string;
    sha: string;
    pr: string | null;
    tickets: string[];
    hops: number;
    days_to_first_seen: number | null;
    fix_induced: boolean;
    path: PathStep[];
}

const step = (e: CodeEdge): PathStep => ({ source: e.source, target: e.target, relation: e.relation, witness: `${e.resolved_via}/${e.confidence}`, dashed: !isStatedResolution(e.resolved_via) || e.confidence !== 'EXTRACTED' });

const days = (from: string, to: string): number | null => {
    const d = (Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000;
    return Number.isFinite(d) ? Math.round(d) : null;
};

/** Shortest path from `start` to every node within `k` hops; a call or use is one hop, a read→write join two. */
export function reach(edges: readonly CodeEdge[], start: string, k: number): Map<string, PathStep[]> {
    const out = new Map<string, CodeEdge[]>();
    const readsOf = new Map<string, CodeEdge[]>();
    const writersOf = new Map<string, CodeEdge[]>();
    for (const e of edges) {
        if (e.relation === 'calls' || e.relation === 'uses') (out.get(e.source) ?? out.set(e.source, []).get(e.source))?.push(e);
        else if (e.relation === 'reads') (readsOf.get(e.source) ?? readsOf.set(e.source, []).get(e.source))?.push(e);
        else if (e.relation === 'writes') (writersOf.get(e.target) ?? writersOf.set(e.target, []).get(e.target))?.push(e);
    }
    // A hop is one edge walked, so a read→write join through data costs two:
    // coupling through a table is weaker evidence than a direct call.
    const seen = new Map<string, PathStep[]>([[start, []]]);
    const buckets: string[][] = [[start]];
    for (let cost = 0; cost < k && cost < buckets.length; cost++) {
        for (const n of buckets[cost] ?? []) {
            const base = seen.get(n) as PathStep[];
            if (base.length !== cost) continue;
            const moves: Array<[string, PathStep[]]> = [];
            for (const e of out.get(n) ?? []) moves.push([e.target, [step(e)]]);
            for (const r of readsOf.get(n) ?? []) for (const w of writersOf.get(r.target) ?? []) moves.push([w.source, [step(r), step(w)]]);
            for (const [to, steps] of moves) {
                const c = cost + steps.length;
                if (c > k || (seen.has(to) && (seen.get(to) as PathStep[]).length <= c)) continue;
                seen.set(to, [...base, ...steps]);
                (buckets[c] ??= []).push(to);
            }
        }
    }
    return seen;
}

const hopsOf = (p: PathStep[]): number => p.length;

export function regressionHypotheses(graph: { edges: readonly CodeEdge[] }, frameSymbols: readonly string[], changes: readonly ChangeInWindow[], firstSeen: string, k = DEFAULT_HOPS): RegressionHypothesis[] {
    const best = new Map<string, RegressionHypothesis>();
    for (const frame of frameSymbols) {
        const reached = reach(graph.edges, frame, k);
        for (const c of changes) {
            for (const symbol of c.symbols) {
                const p = reached.get(symbol);
                if (p === undefined) continue;
                const h: RegressionHypothesis = { state: 'hypothesis', frame, symbol, sha: c.sha, pr: c.pr, tickets: c.tickets, hops: hopsOf(p), days_to_first_seen: days(c.date, firstSeen), fix_induced: c.fix, path: p };
                const prev = best.get(c.sha);
                if (prev === undefined || rank(h, prev) < 0) best.set(c.sha, h);
            }
        }
    }
    return [...best.values()].sort(rank);
}

function rank(a: RegressionHypothesis, b: RegressionHypothesis): number {
    return a.hops - b.hops || (a.days_to_first_seen ?? Infinity) - (b.days_to_first_seen ?? Infinity) || Number(b.fix_induced) - Number(a.fix_induced) || (a.sha < b.sha ? -1 : a.sha > b.sha ? 1 : 0);
}

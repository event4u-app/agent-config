/**
 * Check v2.1 (registration § Check v2.1): closure membership computed from edges that
 * stand — stated by the reader and ruled VALID by at least one judge.
 *
 * Hop 1 is an edge into the target symbol itself. After that, chains are followed by
 * node: with `nodeOf` (the enclosing symbol of a line, from the oracle image's
 * `enclosing.php`), an edge continues a chain only when it lands in the symbol a reached
 * edge left from; a file-scope line (`-`, e.g. a route definition) is its own node, and
 * a class node counts as reached once any of its members is. Without `nodeOf`, or for a
 * line it cannot resolve (TS, Vue, Blade), the node is the file.
 */
import { isTestPath } from './oracle_truth.js';

export interface Edge {
    from_file: string;
    from_line: number;
    to_file: string;
    to_line: number;
    to_symbol: string;
    kind: string;
    note?: string;
}

export interface Target {
    file: string;
    line: number;
    symbol: string;
}

export type EdgeVerdict = 'VALID' | 'INVALID' | 'UNSURE';

export const edgeKey = (e: Edge): string => `${e.from_file}:${e.from_line}->${e.to_file}:${e.to_line}`;

const lastSegment = (s: string): string => s.split(/::|\\|\.|#/).filter(Boolean).pop()?.replace(/\(\)$/, '') ?? s;

function intoTarget(e: Edge, t: Target): boolean {
    if (e.to_file !== t.file) return false;
    // A class target (capitalised, no member part) is reached through any of its members;
    // a free function stays symbol-level like a method.
    if (!/::|#/.test(t.symbol) && /^[A-Z]/.test(lastSegment(t.symbol))) return true;
    return e.to_line === t.line || lastSegment(e.to_symbol) === lastSegment(t.symbol);
}

/** One judge reply → verdict per edge key. A reply without `{"edges": [...]}` is refused. */
export function parseEdgeRulings(text: string, ids: Record<string, string>): Map<string, EdgeVerdict> {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    let parsed: { edges?: { id: string; verdict: EdgeVerdict }[] } | null = null;
    if (start >= 0 && end > start) {
        try {
            parsed = JSON.parse(text.slice(start, end + 1)) as { edges?: { id: string; verdict: EdgeVerdict }[] };
        } catch {
            parsed = null;
        }
    }
    if (!parsed?.edges) throw new Error('judge reply carries no edge rulings ({"edges": [...]})');
    const out = new Map<string, EdgeVerdict>();
    for (const r of parsed.edges) {
        const k = ids[r.id];
        if (k !== undefined) out.set(k, r.verdict);
    }
    return out;
}

/** Edges every judge rules VALID — what remains when two-voice edges are set aside (§ Residual strata). */
export function bothValidEdges(edges: Edge[], verdicts: Record<string, ReadonlyMap<string, EdgeVerdict | string>>): Edge[] {
    const judges = Object.values(verdicts);
    return edges.filter((e) => judges.length > 0 && judges.every((m) => m.get(edgeKey(e)) === 'VALID'));
}

/**
 * A test whose source fakes the queue, bus or event dispatcher, or mocks a class, may
 * reach the target only statically (§ Residual strata item 3). An HTTP fake is not one:
 * it stubs the outbound call, not the chain in front of it.
 */
export function fakesItsChain(source: string): boolean {
    return /\b(?:Queue|Bus|Event)::fake\s*\(|\$this->(?:mock|partialMock)\s*\(|\bMockery::mock\s*\(|->createMock\s*\(/.test(source);
}

/** Edges the reader states that at least one judge rules VALID (two of three). */
export function standingEdges(edges: Edge[], verdicts: Record<string, ReadonlyMap<string, EdgeVerdict | string>>): Edge[] {
    return edges.filter((e) => Object.values(verdicts).some((m) => m.get(edgeKey(e)) === 'VALID'));
}

export function closureFromEdges(
    target: Target,
    edges: Edge[],
    opts: { hopLimit?: number; testsOnly?: boolean } = {},
    nodeOf?: (file: string, line: number) => string | undefined,
): Map<string, number> {
    const node = (file: string, line: number): string => {
        const n = nodeOf?.(file, line);
        if (n === undefined) return `file:${file}`;
        return n === '-' ? `${file}:${line}` : n;
    };
    const reached = new Map<string, number>();
    const hop = new Map<string, number>();
    const mark = (e: Edge, depth: number, next: Edge[]): void => {
        const from = node(e.from_file, e.from_line);
        if (reached.has(from)) return;
        reached.set(from, depth);
        if (!hop.has(e.from_file)) hop.set(e.from_file, depth);
        next.push(e);
    };
    let frontier: Edge[] = [];
    for (const e of edges) if (intoTarget(e, target)) mark(e, 1, frontier);
    for (let depth = 2; frontier.length > 0; depth++) {
        const layer = new Set(frontier.map((e) => node(e.from_file, e.from_line)));
        const layerClasses = new Set([...layer].filter((n) => n.includes('::')).map((n) => n.split('::')[0] as string));
        frontier = [];
        for (const e of edges) {
            const to = node(e.to_file, e.to_line);
            const intoLayer = layer.has(to) || (!to.includes('::') && !to.startsWith('file:') && !/:\d+$/.test(to) && layerClasses.has(to));
            if (intoLayer) mark(e, depth, frontier);
        }
    }
    const out = new Map<string, number>();
    for (const [file, h] of hop) {
        if (opts.hopLimit !== undefined && h > opts.hopLimit) continue;
        if (opts.testsOnly && !isTestPath(file)) continue;
        out.set(file, h);
    }
    return out;
}

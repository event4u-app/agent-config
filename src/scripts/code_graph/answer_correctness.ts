/**
 * Answers that are right, or say how to get the right one. A verb that finds no
 * entry names the text search to run instead, so "no entry" never reads as
 * "not used". `usage` answers a symbol when no package of that name exists,
 * and pack seeds are ranked by what the question names: a file, an area, a
 * symbol — then the knowledge index, when it holds the words.
 */
import type { LoadedGraph } from './query.js';
import { resolveExactNode, tree } from './query.js';

/** The fallback line for an empty answer; the query is quoted for a shell. */
export function noEntryLine(query: string, verb: string): string {
    const q = query.replace(/'/g, "'\\''");
    return `no entry for '${q}' in the graph's ${verb} — this is not proof of absence; search the text: grep -rn -- '${q}' .`;
}

export interface SymbolUsage {
    symbol: string;
    users: number;
    files: string[];
}

/** Who reaches a symbol over stated in-edges, up to two hops; null when no node matches exactly. */
export function symbolUsage(g: LoadedGraph, query: string, limit = 2000): SymbolUsage | null {
    // Exact only: a fuzzy match would answer for a different symbol with confidence.
    const id = resolveExactNode(g, query).id;
    if (id === null) return null;
    const items = tree(g, id, { direction: 'in', depth: 2, limit }).items;
    const files = [...new Set(items.map((i) => g.byId.get(i.id)?.source_file).filter((f): f is string => !!f))].sort();
    return { symbol: id, users: items.length, files };
}

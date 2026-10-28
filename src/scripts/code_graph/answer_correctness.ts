/**
 * Answers that are right, or say how to get the right one. A verb that finds no
 * entry names the text search to run instead, so "no entry" never reads as
 * "not used". `usage` answers a symbol when no package of that name exists,
 * and pack seeds are ranked by what the question names: a file, an area, a
 * symbol — then the knowledge index, when it holds the words.
 */
import type { GraphState } from './detect.js';
import type { LoadedGraph, RecommendedRead } from './query.js';
import { resolveExactNode, resolveSeeds, tree } from './query.js';
import type { CodeEdge } from './types.js';
import { partialFiles, type TestsForResult, isAcceptedEdge, testsFor } from './verbs.js';
import { uncertaintySentence } from './uncertainty.js';

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

/**
 * `tests-for` that reads a module the way its tests do: a `.js` specifier names
 * the `.ts` source, and a test of a module imports its symbols, so a file seed
 * also collects the tests of every symbol the file declares. Kept beside
 * `testsFor` rather than inside it, because `verbs.ts` ships in the hook bundle.
 */
export function testsForModule(g: LoadedGraph, symbol: string, state: GraphState): TestsForResult {
    const asSource = symbol.replace(/\.(m?)js$/, '.$1ts');
    const base = testsFor(g, resolveSeeds(g, symbol).length || asSource === symbol ? symbol : asSource, state);
    const files = base.seeds.filter((s) => g.byId.get(s)?.source_file === s);
    const tests = new Set(base.tests);
    const accepted = [...base.accepted_edges];
    const rejected = [...base.rejected_edges];
    for (const id of g.idsInFiles(files)) {
        for (const e of g.in.get(id) ?? []) {
            if (e.relation !== 'tests') continue;
            if (!isAcceptedEdge(e)) rejected.push(e);
            else if (!tests.has(e.source) || !accepted.includes(e)) {
                accepted.push(e);
                tests.add(e.source);
            }
        }
    }
    const list = [...tests].sort();
    const hist = (es: readonly CodeEdge[]): string => {
        const c = new Map<string, number>();
        for (const e of es) c.set(e.resolved_via, (c.get(e.resolved_via) ?? 0) + 1);
        return c.size ? [...c.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([v, n]) => `${v} ${n}`).join(' · ') : '(none)';
    };
    return { ...base, tests: list, lines: list, accepted_edges: accepted, rejected_edges: rejected, accepted_via: hist(accepted), rejected_via: hist(rejected) };
}

/**
 * {@link testsForModule} with the partial files and the uncertainty sentence the
 * `tests-for` answer carries — the module walk plus what it cannot vouch for.
 */
export function testsForModuleAnswer(
    g: LoadedGraph,
    symbol: string,
    state: GraphState,
): TestsForResult & { partial_files: string[]; complete: boolean; uncertainty?: string } {
    const r = testsForModule(g, symbol, state);
    const seedFiles = r.seeds.map((id) => g.byId.get(id)?.source_file ?? '');
    const partial = partialFiles(g, [...seedFiles, ...r.tests.map((id) => g.byId.get(id)?.source_file ?? '')]);
    const why = uncertaintySentence({ verb: 'tests-for', empty: r.tests.length === 0, state, not_indexed: [], partial, files: seedFiles });
    return { ...r, partial_files: partial, complete: partial.length === 0, ...(why ? { uncertainty: why } : {}) };
}

/**
 * An impact seeded from hunks reaches the changed symbols' dependents, not the
 * tests of the file they live in — a new function has no dependent yet, while
 * its file's tests are still the ones to re-run. Adds the test files whose
 * accepted `tests` edge points at a seed's declaring file or at anything it declares. Kept outside
 * `verbs.ts`, which ships in the hook bundle.
 */
export function withDeclaringFileTests<T extends { seeds: string[]; test_files: string[]; recommended_reads: RecommendedRead[] }>(g: LoadedGraph, r: T, isTest: (relPath: string) => boolean): T {
    const files = new Set(r.seeds.map((s) => g.byId.get(s)?.source_file).filter((f): f is string => !!f && g.byId.has(f)));
    const tests = new Set(r.test_files);
    for (const id of [...files, ...g.idsInFiles([...files])]) {
        for (const e of g.in.get(id) ?? []) {
            if (e.relation !== 'tests' || !isAcceptedEdge(e)) continue;
            const src = g.byId.get(e.source)?.source_file ?? e.source;
            if (isTest(src)) tests.add(src);
        }
    }
    const added = [...tests].filter((t) => !r.test_files.includes(t) && !r.recommended_reads.some((x) => x.path === t));
    return { ...r, test_files: [...tests].sort(), recommended_reads: [...r.recommended_reads, ...added.sort().map((path) => ({ path, lines: null }))] };
}

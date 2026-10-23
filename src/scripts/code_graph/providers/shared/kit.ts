/**
 * The building blocks every convention provider shares: emitting deduplicated
 * edges, declaring route and table nodes, finding the symbol a line belongs to
 * or the one a decorator precedes, and resolving a handler name the way the
 * file itself states it (same file, then its imports).
 *
 * A provider stays a parameter table plus the semantics only it knows; the
 * mechanics live here once (road-to-graph-providers-for-every-stack 4.1).
 */
import * as path from 'node:path';

import type { SourceFile } from '../../build.js';
import type { CodeEdge, CodeNode, ResolvedVia } from '../../types.js';
import type { ProviderInput, ProviderResult } from '../types.js';

/** Line-start offsets, so many `lineAt` lookups stay linear. */
export function lineIndex(src: string): (index: number) => number {
    const starts = [0];
    for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
    return (index: number): number => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if ((starts[mid] as number) <= index) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
}

export interface Kit {
    files: readonly SourceFile[];
    fileIds: ReadonlySet<string>;
    nodeById: ReadonlyMap<string, CodeNode>;
    /** Every project path under the provider's roots, code or not. */
    paths: readonly string[];
    /** The package roots the provider was detected in (`''` is the repository root). */
    roots: readonly string[];
    /** The code files whose path ends with one of `exts`. */
    filesWithExt(...exts: string[]): SourceFile[];
    /** Make sure a file node exists for a non-code target (a template). */
    fileNode(p: string): void;
    emit(source: string, target: string, relation: CodeEdge['relation'], via: ResolvedVia): void;
    /** Declare a route node in `file`; returns its id (`<file>#route:<VERB> <path>`, `@n` when repeated). */
    route(file: string, verb: string, routePath: string, line: number): string;
    /** Declare (once) the table node `table:<name>`, first seen in `file`. */
    table(name: string, file: string, line: number): string;
    /** The innermost function or method node whose span holds `line`, else the file. */
    enclosing(file: string, line: number): string;
    /** The first function, method or class node starting at or after `line` (what a decorator decorates). */
    nextSymbol(file: string, line: number, kinds?: readonly CodeNode['kind'][]): CodeNode | null;
    /** The class node whose span holds `line`. */
    classAt(file: string, line: number): CodeNode | null;
    /**
     * A name as written in `file`, resolved the way the file states it: a
     * same-file symbol first, then a symbol an import edge of the file binds.
     */
    resolveName(file: string, name: string): string | null;
    /** A method `member` of the class node `classId`, if the class declares it. */
    methodOf(classId: string, member: string): string | null;
    result(): ProviderResult;
}

export function makeKit(input: ProviderInput): Kit {
    const files = input.files;
    const fileIds = new Set(files.map((f) => f.path));
    const nodeById = new Map(input.baseNodes.map((n) => [n.id, n] as const));
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];
    const seenEdge = new Set<string>();
    const seenNode = new Set<string>();
    const routeOrdinal = new Map<string, number>();

    const symbolsByFile = new Map<string, CodeNode[]>();
    for (const n of input.baseNodes) {
        if (n.kind === 'file' || n.source_location.length === 0) continue;
        const list = symbolsByFile.get(n.source_file) ?? [];
        list.push(n);
        symbolsByFile.set(n.source_file, list);
    }
    for (const list of symbolsByFile.values()) list.sort((a, b) => (a.source_location[0] as number) - (b.source_location[0] as number));

    const importsByFile = new Map<string, Map<string, string>>();
    for (const e of input.baseEdges) {
        if (e.relation !== 'imports') continue;
        const from = nodeById.get(e.source)?.source_file;
        const to = nodeById.get(e.target);
        if (!from || !to) continue;
        const m = importsByFile.get(from) ?? new Map<string, string>();
        if (!m.has(to.label)) m.set(to.label, to.id);
        importsByFile.set(from, m);
    }

    const emit: Kit['emit'] = (source, target, relation, via) => {
        const key = `${source}\0${relation}\0${target}`;
        if (seenEdge.has(key)) return;
        seenEdge.add(key);
        edges.push({ source, target, relation, confidence: 'EXTRACTED', resolved_via: via, provider: 'native' });
    };
    const span = (n: CodeNode): [number, number] => [n.source_location[0] as number, (n.source_location[2] ?? n.source_location[0]) as number];

    return {
        files,
        fileIds,
        nodeById,
        paths: input.paths,
        roots: input.roots,
        filesWithExt: (...exts) => files.filter((f) => exts.some((x) => f.path.endsWith(x))),
        fileNode(p) {
            if (nodeById.has(p) || seenNode.has(p)) return;
            seenNode.add(p);
            nodes.push({ id: p, label: p, kind: 'file', source_file: p, source_location: [] });
        },
        emit,
        route(file, verb, routePath, line) {
            const base = `${file}#route:${verb} ${routePath}`;
            const n = (routeOrdinal.get(base) ?? 0) + 1;
            routeOrdinal.set(base, n);
            const id = n === 1 ? base : `${base}@${n}`;
            nodes.push({ id, label: `${verb} ${routePath}`, kind: 'route', source_file: file, source_location: [line, 1, line, 1] });
            emit(file, id, 'member', 'same-file');
            return id;
        },
        table(name, file, line) {
            const id = `table:${name}`;
            if (!seenNode.has(id)) {
                seenNode.add(id);
                nodes.push({ id, label: name, kind: 'table', source_file: file, source_location: [line, 1, line, 1] });
            }
            return id;
        },
        enclosing(file, line) {
            let best: CodeNode | null = null;
            for (const n of symbolsByFile.get(file) ?? []) {
                if (n.kind !== 'method' && n.kind !== 'function') continue;
                const [s, e] = span(n);
                if (s <= line && line <= e && (!best || s >= (best.source_location[0] as number))) best = n;
            }
            return best ? best.id : file;
        },
        nextSymbol(file, line, kinds = ['method', 'function', 'class']) {
            for (const n of symbolsByFile.get(file) ?? []) if (kinds.includes(n.kind) && span(n)[0] >= line) return n;
            return null;
        },
        classAt(file, line) {
            let best: CodeNode | null = null;
            for (const n of symbolsByFile.get(file) ?? []) {
                if (n.kind !== 'class') continue;
                const [s, e] = span(n);
                if (s <= line && line <= e && (!best || s >= (best.source_location[0] as number))) best = n;
            }
            return best;
        },
        resolveName(file, name) {
            const local = (symbolsByFile.get(file) ?? []).find((n) => n.label === name && n.kind !== 'method');
            if (local) return local.id;
            return importsByFile.get(file)?.get(name) ?? null;
        },
        methodOf(classId, member) {
            const id = `${classId}::${member}`;
            return nodeById.has(id) ? id : null;
        },
        result: () => ({ nodes, edges }),
    };
}

/**
 * The one symbol named `name` declared by a file in `file`'s own directory with
 * the same extension — what a language whose package is its directory (Go, a
 * Java package) sees without an import. Null when none or several declare it.
 */
export function packageSymbol(kit: Kit, file: string, name: string, kinds: readonly CodeNode['kind'][]): string | null {
    const dir = path.posix.dirname(file);
    const ext = path.posix.extname(file);
    const hits: string[] = [];
    for (const n of kit.nodeById.values()) {
        if (n.label !== name || !kinds.includes(n.kind)) continue;
        if (path.posix.dirname(n.source_file) !== dir || path.posix.extname(n.source_file) !== ext) continue;
        hits.push(n.id);
    }
    return hits.length === 1 ? (hits[0] as string) : null;
}

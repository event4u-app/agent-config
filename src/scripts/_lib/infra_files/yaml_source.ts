/**
 * YAML with line numbers. Every infrastructure reader needs the `file:line` a
 * value sits on, which a plain `parse()` throws away; this keeps the parsed
 * node next to its position without a second, hand-rolled parser.
 */
import { LineCounter, isAlias, isMap, isPair, isScalar, isSeq, parseAllDocuments, type Document, type Node } from 'yaml';

export type YNode = Node | null | undefined;

export interface YamlSource {
    docs: Document[];
    /** first parse error, or null */
    error: string | null;
    lineOf(node: unknown): number;
    lineText(line: number): string;
}

export function parseYamlSource(text: string): YamlSource {
    const lc = new LineCounter();
    let docs: Document[] = [];
    let error: string | null = null;
    try {
        docs = parseAllDocuments(text, { lineCounter: lc, schema: 'failsafe', uniqueKeys: false, prettyErrors: false }) as Document[];
        if (!Array.isArray(docs)) docs = [];
        const firstErr = docs.find((d) => d.errors.length > 0);
        if (firstErr) error = firstErr.errors[0]!.message.split('\n')[0]!;
    } catch (e) {
        error = (e as Error).message;
        docs = [];
    }
    const lines = text.split('\n');
    return {
        docs,
        error,
        lineOf(node: unknown): number {
            const range = (node as { range?: [number, number, number] } | null)?.range;
            return range ? lc.linePos(range[0]).line : 1;
        },
        lineText(line: number): string {
            return (lines[line - 1] ?? '').trimEnd();
        },
    };
}

export interface Entry {
    key: string;
    /** line of the key */
    line: number;
    value: YNode;
}

function deref(doc: Document, n: YNode): YNode {
    return isAlias(n) ? (n.resolve(doc) as YNode) : n;
}

/** The key/value pairs of a mapping, in order, with each key's line. Merge keys resolve. */
export function entries(src: YamlSource, doc: Document, node: YNode): Entry[] {
    const n = deref(doc, node);
    if (!isMap(n)) return [];
    const out: Entry[] = [];
    for (const item of n.items) {
        if (!isPair(item)) continue;
        const k = item.key as YNode;
        const key = isScalar(k) ? String(k.value) : '';
        if (key === '<<') {
            const v = deref(doc, item.value as YNode);
            const sources = isSeq(v) ? v.items.map((x) => deref(doc, x as YNode)) : [v];
            for (const s of sources) out.push(...entries(src, doc, s));
            continue;
        }
        out.push({ key, line: src.lineOf(k), value: deref(doc, item.value as YNode) });
    }
    return out;
}

export function get(src: YamlSource, doc: Document, node: YNode, key: string): Entry | undefined {
    const all = entries(src, doc, node);
    for (let i = all.length - 1; i >= 0; i--) if (all[i]!.key === key) return all[i];
    return undefined;
}

export function items(doc: Document, node: YNode): YNode[] {
    const n = deref(doc, node);
    return isSeq(n) ? n.items.map((x) => deref(doc, x as YNode)) : [];
}

/** A scalar as a string; null for maps, sequences and absent values. */
export function scalar(doc: Document, node: YNode): string | null {
    const n = deref(doc, node);
    if (!isScalar(n) || n.value === null || n.value === undefined) return null;
    return String(n.value);
}

/** A scalar or a sequence of scalars, as a string list. */
export function stringList(doc: Document, node: YNode): string[] {
    const one = scalar(doc, node);
    if (one !== null) return [one];
    return items(doc, node)
        .map((x) => scalar(doc, x))
        .filter((x): x is string => x !== null);
}

export const isMapNode = (doc: Document, n: YNode): boolean => isMap(deref(doc, n));
export const isSeqNode = (doc: Document, n: YNode): boolean => isSeq(deref(doc, n));

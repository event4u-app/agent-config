/**
 * A reader for the part of a SCIP index (`index.scip`) the graph uses, decoded
 * in-process with no protobuf runtime (road-to-a-map-that-draws-itself 6.2, E8).
 *
 * SCIP is a compiler-grade index a language's own indexer writes
 * (scip-typescript, scip-java, scip-python, …). Its occurrences say, per file
 * and line, which symbol is DEFINED there and which is REFERENCED — the
 * precise answer the native extractor can only approximate by name. Read here:
 *
 *   Index.documents (2)            Document.relative_path (1)
 *   Document.occurrences (2)       Occurrence.range (1) · symbol (2) · symbol_roles (3)
 *
 * Everything else is skipped by wire type, so a newer index with more fields
 * still reads. A malformed buffer throws; the caller treats that as "no SCIP".
 */
import type { CodeEdge, CodeNode } from './types.js';
import { GUESS_RESOLVED_VIA } from './types.js';

export interface ScipOccurrence {
    /** 0-based start line. */
    line: number;
    symbol: string;
    definition: boolean;
}

export interface ScipDocument {
    path: string;
    occurrences: ScipOccurrence[];
}

const DEFINITION_ROLE = 0x1;

class Reader {
    private pos = 0;
    constructor(private readonly buf: Uint8Array) {}
    get done(): boolean {
        return this.pos >= this.buf.length;
    }
    varint(): number {
        let result = 0;
        let shift = 0;
        for (;;) {
            if (this.pos >= this.buf.length) throw new Error('scip: truncated varint');
            const b = this.buf[this.pos++] as number;
            if (shift < 49) result += (b & 0x7f) * 2 ** shift;
            if ((b & 0x80) === 0) return result;
            shift += 7;
            if (shift > 63) throw new Error('scip: varint too long');
        }
    }
    bytes(): Uint8Array {
        const n = this.varint();
        if (this.pos + n > this.buf.length) throw new Error('scip: truncated field');
        const out = this.buf.subarray(this.pos, this.pos + n);
        this.pos += n;
        return out;
    }
    skip(wire: number): void {
        if (wire === 0) this.varint();
        else if (wire === 1) this.pos += 8;
        else if (wire === 2) this.bytes();
        else if (wire === 5) this.pos += 4;
        else throw new Error(`scip: unsupported wire type ${wire}`);
        if (this.pos > this.buf.length) throw new Error('scip: truncated field');
    }
}

const utf8 = new TextDecoder('utf-8');

function readOccurrence(buf: Uint8Array): ScipOccurrence {
    const r = new Reader(buf);
    const range: number[] = [];
    let symbol = '';
    let roles = 0;
    while (!r.done) {
        const key = r.varint();
        const field = Math.floor(key / 8);
        const wire = key % 8;
        if (field === 1 && wire === 2) {
            const packed = new Reader(r.bytes());
            while (!packed.done) range.push(packed.varint());
        } else if (field === 1 && wire === 0) range.push(r.varint());
        else if (field === 2 && wire === 2) symbol = utf8.decode(r.bytes());
        else if (field === 3 && wire === 0) roles = r.varint();
        else r.skip(wire);
    }
    return { line: range[0] ?? 0, symbol, definition: (roles & DEFINITION_ROLE) !== 0 };
}

function readDocument(buf: Uint8Array): ScipDocument {
    const r = new Reader(buf);
    let docPath = '';
    const occurrences: ScipOccurrence[] = [];
    while (!r.done) {
        const key = r.varint();
        const field = Math.floor(key / 8);
        const wire = key % 8;
        if (field === 1 && wire === 2) docPath = utf8.decode(r.bytes());
        else if (field === 2 && wire === 2) occurrences.push(readOccurrence(r.bytes()));
        else r.skip(wire);
    }
    return { path: docPath, occurrences };
}

export function readScipIndex(buf: Uint8Array): ScipDocument[] {
    const r = new Reader(buf);
    const docs: ScipDocument[] = [];
    while (!r.done) {
        const key = r.varint();
        const field = Math.floor(key / 8);
        const wire = key % 8;
        if (field === 2 && wire === 2) docs.push(readDocument(r.bytes()));
        else r.skip(wire);
    }
    return docs;
}

/**
 * Edges a SCIP index proves: a reference in file F at line L to a symbol
 * defined in file G at line M becomes `innermost node at F:L → node at G:M`.
 * Local symbols (`local N`) are file-private and skipped; a definition the
 * native graph has no file for is skipped too, so every edge lands on a node.
 */
export function scipEdges(docs: readonly ScipDocument[], nodes: readonly CodeNode[]): CodeEdge[] {
    const byFile = new Map<string, CodeNode[]>();
    for (const n of nodes) {
        const list = byFile.get(n.source_file) ?? [];
        list.push(n);
        byFile.set(n.source_file, list);
    }
    const innermost = (file: string, line1: number): string | null => {
        let best: CodeNode | null = null;
        for (const n of byFile.get(file) ?? []) {
            if (n.kind === 'file' || n.source_location.length < 3) continue;
            const s = n.source_location[0] as number;
            const e = n.source_location[2] as number;
            if (s <= line1 && line1 <= e && (!best || s >= (best.source_location[0] as number))) best = n;
        }
        return best ? best.id : byFile.has(file) ? file : null;
    };
    const declaredAt = (file: string, line1: number): string | null => {
        const hit = (byFile.get(file) ?? []).find((n) => n.kind !== 'file' && n.source_location[0] === line1);
        return hit ? hit.id : byFile.has(file) ? file : null;
    };

    const defs = new Map<string, { file: string; line: number }>();
    for (const d of docs) {
        for (const o of d.occurrences) {
            if (o.definition && o.symbol && !o.symbol.startsWith('local ') && !defs.has(o.symbol)) {
                defs.set(o.symbol, { file: d.path, line: o.line + 1 });
            }
        }
    }
    const seen = new Set<string>();
    const out: CodeEdge[] = [];
    for (const d of [...docs].sort((a, b) => (a.path < b.path ? -1 : 1))) {
        for (const o of d.occurrences) {
            if (o.definition || !o.symbol || o.symbol.startsWith('local ')) continue;
            const def = defs.get(o.symbol);
            if (!def) continue;
            const source = innermost(d.path, o.line + 1);
            const target = declaredAt(def.file, def.line);
            if (!source || !target || source === target) continue;
            const key = `${source}\0${target}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
                source,
                target,
                relation: 'uses',
                confidence: 'EXTRACTED',
                resolved_via: 'compiler-index',
                provider: 'scip',
            });
        }
    }
    return out;
}

/**
 * A native guess (name lookup, dynamic dispatch) from the same source to a
 * same-named target is superseded once the compiler index states the link.
 */
export function supersededByScip(scip: readonly CodeEdge[], nodes: readonly CodeNode[]): (e: CodeEdge) => boolean {
    const label = new Map(nodes.map((n) => [n.id, n.label] as const));
    const named = new Map<string, Set<string>>();
    for (const e of scip) {
        const l = label.get(e.target);
        if (!l) continue;
        const set = named.get(e.source) ?? new Set<string>();
        set.add(l);
        named.set(e.source, set);
    }
    return (e: CodeEdge): boolean => {
        if (!GUESS_RESOLVED_VIA.has(e.resolved_via)) return false;
        const set = named.get(e.source);
        if (!set) return false;
        const target = label.get(e.target) ?? e.target.replace(/^symbol:/, '');
        return set.has(target);
    };
}

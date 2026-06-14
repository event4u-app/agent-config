#!/usr/bin/env node
/**
 * corpus-grounding · bm25_search — retrieval layer (interface v1).
 *
 * TypeScript twin of `src/skills/corpus-grounding/scripts/bm25_search.py`
 * (ADR-096 Python→TS migration). Pure-stdlib BM25 ranking over CSV corpora
 * plus a structured pre-filter (`filters`) applied BEFORE ranking. Retrievers
 * are selected by name (`bm25` / `structured` / `hybrid`) — never
 * network-by-default; embeddings are intentionally absent until a measured
 * recall failure justifies them (ADR-061 §2).
 *
 * Skill-shipped tool — standalone by design (no `_lib` imports), so the
 * Python-parity primitives it needs (float math, `len()` as code-point count,
 * `csv.DictReader` quoting, Python `re` semantics, `json.dumps` byte-parity)
 * are inlined here. The public names below mirror the Python module 1:1
 * (Python style is part of the contract, ADR-096).
 *
 * Interface-stability contract: see SKILL.md § Interface contract (v1).
 * Breaking changes to public names below require a major bump there.
 */

import * as fs from 'node:fs';

export const DEFAULT_MAX_RESULTS = 3;

/**
 * Marker for a Python `float`. CPython `json.dumps` / f-strings render an
 * integral float (`1.0`) with its `.0`; JS numbers lose that. BM25 scores —
 * and the structured retriever's `1.0` — are Python floats, so the `scores`
 * array carries this marker and the serializer renders it with float
 * semantics. Defined here (the cluster's dependency root) and re-used by
 * `decision_engine` + `ground`.
 */
export class PyFloat {
    constructor(readonly value: number) {}
}

/** Unwrap a number that may be wrapped in PyFloat. */
export function floatVal(v: number | PyFloat): number {
    return v instanceof PyFloat ? v.value : v;
}

/** Heterogeneous CSV row dict — string→string (csv.DictReader yields strs). */
export type Row = Record<string, string>;

/** A filter value: a single accepted value or a list of accepted values. */
export type FilterValue = string | string[];
export type Filters = Record<string, FilterValue>;

/** search_rows return shape (interface v1). */
export interface SearchResult {
    count: number;
    results: Row[];
    scores?: PyFloat[];
    filtered_from?: number;
    error?: string;
    [key: string]: unknown;
}

// ── Python-parity primitives (inlined — skill scripts ship standalone) ──────

/** Python `len(str)` — number of Unicode code points, not UTF-16 units. */
function pyLen(s: string): number {
    let n = 0;
    // Iterating a string yields code points (surrogate pairs counted once).
    for (const _ of s) {
        n += 1;
    }
    return n;
}

// ── BM25 ────────────────────────────────────────────────────────────────

/** BM25 ranking (k1=1.5, b=0.75 — upstream-tuned defaults). */
export class BM25 {
    k1: number;

    b: number;

    corpus: string[][];

    doc_lengths: number[];

    avgdl: number;

    idf: Record<string, number>;

    doc_freqs: Record<string, number>;

    N: number;

    constructor(k1 = 1.5, b = 0.75) {
        this.k1 = k1;
        this.b = b;
        this.corpus = [];
        this.doc_lengths = [];
        this.avgdl = 0.0;
        this.idf = {};
        this.doc_freqs = {};
        this.N = 0;
    }

    /** Lowercase, strip punctuation, drop tokens shorter than 3 chars. */
    static tokenize(text: unknown): string[] {
        // Python: re.sub(r"[^\w\s]", " ", str(text).lower()).
        // Python's `re` `\w` for str is Unicode (letters, digits, underscore);
        // `\s` is Unicode whitespace. Mirror with \p{L}\p{N}_ and \s under /u.
        const cleaned = pyStr(text).toLowerCase().replace(/[^\p{L}\p{N}_\s]/gu, ' ');
        // Python str.split() with no arg: split on runs of whitespace, no empties.
        return cleaned.split(/\s+/).filter((w) => w.length > 0 && pyLen(w) > 2);
    }

    fit(documents: string[]): void {
        this.corpus = documents.map((doc) => BM25.tokenize(doc));
        this.N = this.corpus.length;
        if (this.N === 0) {
            return;
        }
        this.doc_lengths = this.corpus.map((doc) => doc.length);
        let total = 0;
        for (const dl of this.doc_lengths) {
            total += dl;
        }
        this.avgdl = total / this.N;
        for (const doc of this.corpus) {
            // Python: for word in set(doc) — dedupe per document.
            for (const word of new Set(doc)) {
                this.doc_freqs[word] = (this.doc_freqs[word] ?? 0) + 1;
            }
        }
        for (const word of Object.keys(this.doc_freqs)) {
            const freq = this.doc_freqs[word] as number;
            this.idf[word] = Math.log((this.N - freq + 0.5) / (freq + 0.5) + 1);
        }
    }

    /** Score every document; returns [index, score] sorted descending. */
    score(query: string): [number, number][] {
        const query_tokens = BM25.tokenize(query);
        const scores: [number, number][] = [];
        for (let idx = 0; idx < this.corpus.length; idx += 1) {
            const doc = this.corpus[idx] as string[];
            let score = 0.0;
            const doc_len = this.doc_lengths[idx] as number;
            const term_freqs: Record<string, number> = {};
            for (const word of doc) {
                term_freqs[word] = (term_freqs[word] ?? 0) + 1;
            }
            for (const token of query_tokens) {
                if (token in this.idf) {
                    const tf = term_freqs[token] ?? 0;
                    const numerator = tf * (this.k1 + 1);
                    const denominator = tf + this.k1 * (1 - this.b + (this.b * doc_len) / this.avgdl);
                    score += (this.idf[token] as number) * (numerator / denominator);
                }
            }
            scores.push([idx, score]);
        }
        // Python sorted(scores, key=lambda x: x[1], reverse=True) — stable;
        // ties keep their original relative order. Node's Array.sort is stable;
        // a `b - a` comparator returns 0 for ties → original order preserved,
        // matching CPython's stable reverse sort.
        const indexed = scores.map((pair, i) => ({ pair, i }));
        indexed.sort((a, b) => {
            const d = b.pair[1] - a.pair[1];
            if (d !== 0) {
                return d;
            }
            return a.i - b.i;
        });
        return indexed.map((x) => x.pair);
    }
}

// ── CSV loading — mirrors Python's csv.DictReader ───────────────────────────

/**
 * Load a CSV corpus file as a list of row dicts (UTF-8).
 *
 * Mirrors `csv.DictReader` over the default `excel` dialect: comma delimiter,
 * `"` quotechar, doubled-quote escaping (`""` → `"`), and field/record
 * boundaries that respect quoting (newlines inside quotes stay in the field).
 * The first row is the header. Extra fields beyond the header land under the
 * `None` restkey — but the Python source never reads them, so we drop them
 * exactly as the downstream code does (it only reads named columns).
 */
export function load_csv(filepath: string): Row[] {
    const text = fs_readText(filepath);
    const records = _parseCsv(text);
    if (records.length === 0) {
        return [];
    }
    const header = records[0] as string[];
    const out: Row[] = [];
    for (let r = 1; r < records.length; r += 1) {
        const fields = records[r] as string[];
        const row: Row = {};
        for (let c = 0; c < header.length; c += 1) {
            const key = header[c] as string;
            // csv.DictReader: missing trailing fields → restval (default None,
            // but downstream str(row.get(col, "")) coerces). Python stores None
            // for short rows; the consumers always wrap with str(... or "").
            // We store "" for a missing field so str() parity holds; for a
            // present field we store the parsed value.
            row[key] = c < fields.length ? (fields[c] as string) : '';
        }
        out.push(row);
    }
    return out;
}

/**
 * Parse CSV text into records of fields, matching Python's csv default dialect.
 *
 * - Comma delimiter, `"` quote char, `""` → literal `"` inside a quoted field.
 * - Quoted fields may contain commas and newlines.
 * - Record terminators: `\r\n`, `\r`, or `\n` (csv universal-newline behavior).
 * - A trailing newline does not create a trailing empty record.
 */
function _parseCsv(text: string): string[][] {
    const records: string[][] = [];
    let field = '';
    let record: string[] = [];
    let inQuotes = false;
    let sawAny = false;
    let i = 0;
    const n = text.length;
    const pushField = (): void => {
        record.push(field);
        field = '';
    };
    const pushRecord = (): void => {
        records.push(record);
        record = [];
    };
    while (i < n) {
        const ch = text[i] as string;
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < n && text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                } else {
                    inQuotes = false;
                    i += 1;
                }
            } else {
                field += ch;
                i += 1;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            sawAny = true;
            i += 1;
        } else if (ch === ',') {
            pushField();
            sawAny = true;
            i += 1;
        } else if (ch === '\r' || ch === '\n') {
            // Universal newline: \r\n counts once.
            pushField();
            pushRecord();
            sawAny = false;
            if (ch === '\r' && i + 1 < n && text[i + 1] === '\n') {
                i += 2;
            } else {
                i += 1;
            }
        } else {
            field += ch;
            sawAny = true;
            i += 1;
        }
    }
    // Flush a trailing field/record only if we saw content on the last line.
    if (sawAny || field.length > 0 || record.length > 0) {
        pushField();
        pushRecord();
    }
    return records;
}

// ── filters ───────────────────────────────────────────────────────────────

/**
 * Structured pre-filter BEFORE ranking.
 *
 * `filters` maps column name → required value (string, case-insensitive
 * substring match) or list of accepted values. Unknown columns simply never
 * match (empty result is a legitimate, visible outcome — callers surface it as
 * an evidence gap, never silently widen).
 */
export function apply_filters(rows: Row[], filters: Filters | null | undefined): Row[] {
    if (!filters || Object.keys(filters).length === 0) {
        return rows;
    }

    const rowOk = (row: Row): boolean => {
        for (const col of Object.keys(filters)) {
            const want = filters[col] as FilterValue;
            const have = pyStr(row[col] ?? '').toLowerCase();
            if (Array.isArray(want)) {
                // Python: any(str(w).lower() in have for w in want).
                if (!want.some((w) => have.includes(pyStr(w).toLowerCase()))) {
                    return false;
                }
            } else if (!have.includes(pyStr(want).toLowerCase())) {
                return false;
            }
        }
        return true;
    };

    return rows.filter((r) => rowOk(r));
}

// ── retrievers ──────────────────────────────────────────────────────────────

type Hit = [Row, number];

function _retrieve_bm25(
    rows: Row[],
    search_cols: string[],
    query: string,
    max_results: number,
): Hit[] {
    const documents = rows.map((row) => search_cols.map((col) => pyStr(row[col] ?? '')).join(' '));
    const bm25 = new BM25();
    bm25.fit(documents);
    const ranked = bm25.score(query);
    const out: Hit[] = [];
    for (const [idx, score] of ranked.slice(0, max_results)) {
        if (score > 0) {
            out.push([rows[idx] as Row, score]);
        }
    }
    return out;
}

/**
 * Pure filter retrieval — rows already pre-filtered; rank by column order
 * stability (score 1.0 each). Useful for exact-axis lookups.
 */
function _retrieve_structured(
    rows: Row[],
    _search_cols: string[],
    _query: string,
    max_results: number,
): Hit[] {
    return rows.slice(0, max_results).map((row) => [row, 1.0] as Hit);
}

/**
 * Structured pre-filter is applied by the caller; hybrid = BM25 over the
 * filtered set, falling back to stable order when the query is empty.
 */
function _retrieve_hybrid(
    rows: Row[],
    search_cols: string[],
    query: string,
    max_results: number,
): Hit[] {
    if (query.trim() === '') {
        return _retrieve_structured(rows, search_cols, query, max_results);
    }
    return _retrieve_bm25(rows, search_cols, query, max_results);
}

type Retriever = (rows: Row[], search_cols: string[], query: string, max_results: number) => Hit[];

/** Retriever registry — selected by name in the manifest or per call. */
export const RETRIEVERS: Record<string, Retriever> = {
    bm25: _retrieve_bm25,
    structured: _retrieve_structured,
    hybrid: _retrieve_hybrid,
};

/**
 * Search one corpus file. Returns a dict with results + raw scores.
 *
 * Result shape (interface v1):
 * `{"count": int, "results": [row-projection…], "scores": [float…],
 *    "filtered_from": int}`
 */
export function search_rows(
    filepath: string,
    search_cols: string[],
    output_cols: string[],
    query: string,
    max_results: number = DEFAULT_MAX_RESULTS,
    filters: Filters | null = null,
    retriever = 'bm25',
): SearchResult {
    if (!(retriever in RETRIEVERS)) {
        // Python: raise ValueError(f"Unknown retriever: {retriever!r}. Available: {sorted(RETRIEVERS)}")
        const available = Object.keys(RETRIEVERS).sort();
        throw new ValueError(
            `Unknown retriever: ${pyRepr(retriever)}. Available: ${pyReprList(available)}`,
        );
    }
    if (!fs_exists(filepath)) {
        return { error: `File not found: ${filepath}`, count: 0, results: [] };
    }

    let rows = load_csv(filepath);
    const total = rows.length;
    rows = apply_filters(rows, filters);

    const hits = (RETRIEVERS[retriever] as Retriever)(rows, search_cols, query, max_results);
    const results: Row[] = hits.map(([row]) => {
        const projection: Row = {};
        for (const col of output_cols) {
            if (col in row) {
                projection[col] = row[col] ?? '';
            }
        }
        return projection;
    });
    return {
        count: results.length,
        results,
        // Python scores are floats (BM25 math + the structured 1.0). Wrap so
        // an integral score (e.g. 1.0) serialises with its `.0`.
        scores: hits.map(([, score]) => new PyFloat(score)),
        filtered_from: total,
    };
}

// ── error parity ────────────────────────────────────────────────────────────

/** Mirror of Python's ValueError, so `decision_engine` callers can map it. */
export class ValueError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValueError';
    }
}

// ── small Python-parity helpers reused across the cluster ───────────────────

/** Python `str(x)` for the value shapes this module sees. */
export function pyStr(value: unknown): string {
    if (value === null || value === undefined) {
        // The Python source never passes None to pyStr without a `or ""` guard,
        // but for safety mirror str(None) -> "None".
        return value === null ? 'None' : 'undefined';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    return String(value);
}

/** Python `repr(s)` for a string — single-quoted unless it contains a `'`. */
export function pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    if (hasSingle && !hasDouble) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** repr() of a list of strings: `['a', 'b']`. */
export function pyReprList(items: string[]): string {
    return `[${items.map((i) => pyRepr(i)).join(', ')}]`;
}

// ── filesystem shims (kept tiny + local so the module stays standalone) ──────

function fs_readText(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

function fs_exists(p: string): boolean {
    return fs.existsSync(p);
}

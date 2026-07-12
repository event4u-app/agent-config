/**
 * Hand-rolled, dependency-free lexical index for memory/knowledge retrieval
 * (road-to-retrieval-substrate-hardening B2).
 *
 * The current `memory_lookup._score` gives every keyword match the SAME coarse
 * bucket (0.8 glob / 0.6 substring), so several entries tie at the top and
 * retrieval "recalls but does not rank" (the mean-tie-set 3.3 finding from
 * road-to-second-brain-retrieval-precision). This module replaces that bucket
 * with a continuous BM25 score over an IDF-weighted term index, plus a
 * character-trigram candidate prefilter so it stays cheap at corpus scale.
 *
 * It is the BM25 core ADR-061 already sanctions — pure Node stdlib, NO engine
 * fork, NO minisearch-class dependency. `_score` stays as the below-tripwire
 * mini-corpus fallback; this index activates at the `lint_knowledge_scale`
 * tripwire. Deterministic: identical docs + query → identical scores + order.
 */

/** BM25 term-frequency saturation. */
export const BM25_K1 = 1.5;
/** BM25 length-normalisation strength. */
export const BM25_B = 0.75;
/** Minimum token length kept (drops single chars / punctuation noise). */
export const MIN_TOKEN_LEN = 2;

export interface IndexDoc {
    id: string;
    /** All searchable text of the entry, already concatenated. */
    text: string;
}

interface DocStats {
    id: string;
    len: number; // token count
    tf: Map<string, number>; // term → frequency in this doc
    trigrams: Set<string>;
}

/** Lowercase, split on non-alphanumeric, keep tokens ≥ MIN_TOKEN_LEN. */
export function tokenize(s: string): string[] {
    const out: string[] = [];
    for (const raw of s.toLowerCase().split(/[^a-z0-9]+/)) {
        if (raw.length >= MIN_TOKEN_LEN) out.push(raw);
    }
    return out;
}

/** Character trigrams of a normalised string (alphanumerics + single spaces). */
export function trigrams(s: string): Set<string> {
    const norm = s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const out = new Set<string>();
    if (norm.length < 3) {
        if (norm.length > 0) out.add(norm);
        return out;
    }
    for (let i = 0; i + 3 <= norm.length; i++) {
        out.add(norm.slice(i, i + 3));
    }
    return out;
}

/**
 * An in-memory BM25 index over a fixed document set. Built once, queried many
 * times. Stateless after construction — `rank()` / `score()` never mutate it,
 * so a cached instance is safe to reuse until the underlying corpus changes.
 */
export class LexicalIndex {
    private readonly docs: Map<string, DocStats> = new Map();
    private readonly df: Map<string, number> = new Map();
    private readonly n: number;
    private readonly avgdl: number;

    constructor(documents: readonly IndexDoc[]) {
        let totalLen = 0;
        for (const d of documents) {
            const tokens = tokenize(d.text);
            const tf = new Map<string, number>();
            for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
            for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
            this.docs.set(d.id, { id: d.id, len: tokens.length, tf, trigrams: trigrams(d.text) });
            totalLen += tokens.length;
        }
        this.n = documents.length;
        this.avgdl = this.n > 0 ? totalLen / this.n : 0;
    }

    /** Robertson–Spärck-Jones IDF, floored at 0 so common terms never subtract. */
    private idf(term: string): number {
        const df = this.df.get(term) ?? 0;
        if (df === 0) return 0;
        return Math.max(0, Math.log(1 + (this.n - df + 0.5) / (df + 0.5)));
    }

    /**
     * BM25 score of one document against the tokenised query terms, weighted by
     * **term coverage**: the raw BM25 sum is multiplied by `coverage²`, where
     * `coverage = distinct-query-terms-matched / distinct-query-terms`. This
     * stops a single generic, high-TF term match from outranking a document that
     * matches several rarer query terms once each (Phase 1 refinement). A
     * single-term query has `coverage == 1`, so its score is unchanged — the
     * weighting only re-orders genuinely multi-term queries.
     */
    score(queryTerms: readonly string[], docId: string): number {
        const doc = this.docs.get(docId);
        if (doc === undefined || doc.len === 0) return 0;
        let s = 0;
        const matched = new Set<string>();
        for (const term of queryTerms) {
            const tf = doc.tf.get(term);
            if (tf === undefined) continue;
            const idf = this.idf(term);
            if (idf === 0) continue;
            const denom = tf + BM25_K1 * (1 - BM25_B + (BM25_B * doc.len) / (this.avgdl || 1));
            s += (idf * (tf * (BM25_K1 + 1))) / denom;
            matched.add(term);
        }
        if (s === 0) return 0;
        const distinctQuery = new Set(queryTerms).size;
        const coverage = distinctQuery > 0 ? matched.size / distinctQuery : 1;
        return s * coverage * coverage;
    }

    /**
     * Rank documents for a set of query keys (phrases are tokenised). A
     * character-trigram prefilter selects candidates cheaply; the guard keeps
     * any doc sharing a query TOKEN even when no trigram overlaps, so the
     * prefilter never drops a genuine lexical match. Ties break by id for a
     * stable, deterministic order.
     */
    rank(queryKeys: readonly string[]): Array<{ id: string; score: number }> {
        const queryText = queryKeys.join(' ');
        const qTerms = tokenize(queryText);
        const qTermSet = new Set(qTerms);
        const qTrigrams = trigrams(queryText);

        const candidates: string[] = [];
        for (const [id, doc] of this.docs) {
            let hit = false;
            for (const t of qTrigrams) {
                if (doc.trigrams.has(t)) {
                    hit = true;
                    break;
                }
            }
            if (!hit) {
                // Guard: keep a doc that shares an exact query token even with
                // no trigram overlap (short tokens / edge normalisation).
                for (const t of qTermSet) {
                    if (doc.tf.has(t)) {
                        hit = true;
                        break;
                    }
                }
            }
            if (hit) candidates.push(id);
        }

        const scored = candidates
            .map((id) => ({ id, score: this.score(qTerms, id) }))
            .filter((r) => r.score > 0);
        scored.sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        return scored;
    }

    /** Document count — for the caller's tripwire / diagnostics. */
    get size(): number {
        return this.n;
    }
}

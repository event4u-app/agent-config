/**
 * Token-based Jaccard similarity — the dedup primitive for the
 * road-to-knowledge-system capture-hygiene layer (Phase 2).
 *
 * Deterministic, no embeddings, no network. Thresholds per the
 * 2026-07-05 council verdict (AutoSci dedup discipline, adapted):
 *   >= MERGE_THRESHOLD  → treat as a duplicate, suggest the matched entry
 *   >= WARN_THRESHOLD   → surface the nearest match, let the human decide
 *   below WARN_THRESHOLD → no conflict, proceed to create
 *
 * Deliberately does NOT touch `memory_signal.ts` — that script is a
 * byte-faithful parity twin of its retired Python original ("no
 * behaviour changes" is a load-bearing contract of that file). This
 * module is consumed as an ADDITIONAL, advisory check layered on top,
 * from `check_memory_similarity.ts` and later the knowledge-page
 * consolidation flow (Phase 5).
 */

export const MERGE_THRESHOLD = 0.8;
export const WARN_THRESHOLD = 0.4;

export type SimilarityClass = 'merge' | 'warn' | 'create';

const TOKEN_RE = /[a-z0-9]+/g;

/** Lowercase, split on non-alphanumeric runs, drop empties. Order-independent by design (Jaccard is set-based). */
export function tokenize(text: string): Set<string> {
    const tokens = (text.toLowerCase().match(TOKEN_RE) ?? []).filter((t) => t.length > 0);
    return new Set(tokens);
}

/** Jaccard(A, B) = |A ∩ B| / |A ∪ B|. Two empty inputs are defined as identical (1.0); one empty vs. non-empty is 0. */
export function jaccardSimilarity(a: string, b: string): number {
    const setA = tokenize(a);
    const setB = tokenize(b);
    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersection = 0;
    for (const tok of setA) {
        if (setB.has(tok)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 1.0 : intersection / union;
}

export function classifySimilarity(score: number): SimilarityClass {
    if (score >= MERGE_THRESHOLD) return 'merge';
    if (score >= WARN_THRESHOLD) return 'warn';
    return 'create';
}

export interface Candidate {
    id: string;
    text: string;
}

export interface SimilarityMatch {
    id: string;
    text: string;
    score: number;
    classification: SimilarityClass;
}

/** Best (highest-score) match across candidates, or null when candidates is empty. Ties resolve to the first candidate in iteration order (deterministic given a deterministic input order). */
export function findMostSimilar(target: string, candidates: Iterable<Candidate>): SimilarityMatch | null {
    let best: SimilarityMatch | null = null;
    for (const candidate of candidates) {
        const score = jaccardSimilarity(target, candidate.text);
        if (best === null || score > best.score) {
            best = { id: candidate.id, text: candidate.text, score, classification: classifySimilarity(score) };
        }
    }
    return best;
}

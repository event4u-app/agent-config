/**
 * Catalog search scoring — a thin field-boosted wrapper over the shared
 * `LexicalIndex` (BM25 + trigram prefilter).
 *
 * DECISION (road-to-persona-library-harvest.md Phase 2.3): the roadmap sketched
 * porting the upstream Hermes `_score` (token overlap + name/description
 * boosts). We do NOT — `_lib/lexical_index.ts` already ships a calibrated BM25
 * core (ADR-061-sanctioned, dependency-free) with a coverage² multi-term
 * weighting and a trigram candidate prefilter. Maintaining a second lexical
 * scorer would be duplication. Instead we reuse `LexicalIndex` and get the
 * field boost by REPEATING the name (×3) and description (×2) terms in each
 * doc's indexed text, so a query term hitting the name outranks the same term
 * buried in a tag. No new scorer.
 */
import type { CatalogIndexEntry } from '../build_catalog_index.js';
import { LexicalIndex } from './lexical_index.js';

export interface CatalogFilter {
    cls?: CatalogIndexEntry['cls'];
    /** Match against the entry's tags (packs/domain/tier). */
    pack?: string;
    limit?: number;
}

export interface CatalogHit {
    entry: CatalogIndexEntry;
    score: number;
}

/** Field-boosted searchable text: name ×3, description ×2, tags ×1. */
function _docText(e: CatalogIndexEntry): string {
    return [e.name, e.name, e.name, e.description, e.description, ...e.tags].join(' ');
}

function _filter(entries: readonly CatalogIndexEntry[], f: CatalogFilter): CatalogIndexEntry[] {
    return entries.filter((e) => {
        if (f.cls && e.cls !== f.cls) return false;
        if (f.pack && !e.tags.includes(f.pack)) return false;
        return true;
    });
}

/**
 * Rank catalog entries against a free-text query. The index is built over the
 * (filtered) candidate set so IDF reflects the searched scope. Empty or
 * whitespace query → no hits (a search tool must not dump the catalog).
 */
export function searchCatalog(
    entries: readonly CatalogIndexEntry[],
    query: string,
    filter: CatalogFilter = {},
): CatalogHit[] {
    const q = query.trim();
    if (q.length === 0) return [];
    const candidates = _filter(entries, filter);
    if (candidates.length === 0) return [];

    const index = new LexicalIndex(candidates.map((e) => ({ id: e.id, text: _docText(e) })));
    const byId = new Map(candidates.map((e) => [e.id, e]));
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 8;

    const ranked = index.rank([q]).filter((r) => r.score > 0);
    return ranked.slice(0, limit).map((r) => ({ entry: byId.get(r.id) as CatalogIndexEntry, score: r.score }));
}

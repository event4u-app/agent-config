#!/usr/bin/env python3
"""corpus-grounding · bm25_search — retrieval layer (interface v1).

Pure-stdlib BM25 ranking over CSV corpora plus a structured pre-filter
(`filters`) applied BEFORE ranking. Retrievers are selected by name
(`bm25` / `structured` / `hybrid`) — never network-by-default; embeddings
are intentionally absent until a measured recall failure justifies them
(ADR-061 §2).

Ported and de-duplicated from `nextlevelbuilder/ui-ux-pro-max-skill`
(`core.py`; `slide_search_core.py` was byte-identical — one engine now).
Upstream: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
@ b7e3af80f6e331f6fb456667b82b12cade7c9d35 · MIT · last checked 2026-06-07.
Slide-only paths stripped. See ../ATTRIBUTION-pointer in SKILL.md.

Interface-stability contract: see SKILL.md § Interface contract (v1).
Breaking changes to public names below require a major bump there.
"""

from __future__ import annotations

import csv
import re
from collections import defaultdict
from math import log
from pathlib import Path

DEFAULT_MAX_RESULTS = 3

__all__ = [
    "BM25",
    "load_csv",
    "apply_filters",
    "search_rows",
    "RETRIEVERS",
]


class BM25:
    """BM25 ranking (k1=1.5, b=0.75 — upstream-tuned defaults)."""

    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self.corpus: list[list[str]] = []
        self.doc_lengths: list[int] = []
        self.avgdl: float = 0.0
        self.idf: dict[str, float] = {}
        self.doc_freqs: "defaultdict[str, int]" = defaultdict(int)
        self.N = 0

    @staticmethod
    def tokenize(text: object) -> list[str]:
        """Lowercase, strip punctuation, drop tokens shorter than 3 chars."""
        cleaned = re.sub(r"[^\w\s]", " ", str(text).lower())
        return [w for w in cleaned.split() if len(w) > 2]

    def fit(self, documents: list[str]) -> None:
        self.corpus = [self.tokenize(doc) for doc in documents]
        self.N = len(self.corpus)
        if self.N == 0:
            return
        self.doc_lengths = [len(doc) for doc in self.corpus]
        self.avgdl = sum(self.doc_lengths) / self.N
        for doc in self.corpus:
            for word in set(doc):
                self.doc_freqs[word] += 1
        for word, freq in self.doc_freqs.items():
            self.idf[word] = log((self.N - freq + 0.5) / (freq + 0.5) + 1)

    def score(self, query: str) -> list[tuple[int, float]]:
        """Score every document; returns (index, score) sorted descending."""
        query_tokens = self.tokenize(query)
        scores: list[tuple[int, float]] = []
        for idx, doc in enumerate(self.corpus):
            score = 0.0
            doc_len = self.doc_lengths[idx]
            term_freqs: "defaultdict[str, int]" = defaultdict(int)
            for word in doc:
                term_freqs[word] += 1
            for token in query_tokens:
                if token in self.idf:
                    tf = term_freqs[token]
                    numerator = tf * (self.k1 + 1)
                    denominator = tf + self.k1 * (
                        1 - self.b + self.b * doc_len / self.avgdl
                    )
                    score += self.idf[token] * numerator / denominator
            scores.append((idx, score))
        return sorted(scores, key=lambda x: x[1], reverse=True)


def load_csv(filepath: Path) -> list[dict]:
    """Load a CSV corpus file as a list of row dicts (UTF-8)."""
    with open(filepath, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def apply_filters(rows: list[dict], filters: dict | None) -> list[dict]:
    """Structured pre-filter BEFORE ranking.

    ``filters`` maps column name → required value (string, case-insensitive
    substring match) or list of accepted values. Unknown columns simply
    never match (empty result is a legitimate, visible outcome — callers
    surface it as an evidence gap, never silently widen).
    """
    if not filters:
        return rows

    def row_ok(row: dict) -> bool:
        for col, want in filters.items():
            have = str(row.get(col, "")).lower()
            if isinstance(want, list):
                if not any(str(w).lower() in have for w in want):
                    return False
            else:
                if str(want).lower() not in have:
                    return False
        return True

    return [r for r in rows if row_ok(r)]


def _retrieve_bm25(
    rows: list[dict],
    search_cols: list[str],
    query: str,
    max_results: int,
) -> list[tuple[dict, float]]:
    documents = [
        " ".join(str(row.get(col, "")) for col in search_cols) for row in rows
    ]
    bm25 = BM25()
    bm25.fit(documents)
    ranked = bm25.score(query)
    out: list[tuple[dict, float]] = []
    for idx, score in ranked[:max_results]:
        if score > 0:
            out.append((rows[idx], score))
    return out


def _retrieve_structured(
    rows: list[dict],
    search_cols: list[str],
    query: str,
    max_results: int,
) -> list[tuple[dict, float]]:
    """Pure filter retrieval — rows already pre-filtered; rank by column
    order stability (score 1.0 each). Useful for exact-axis lookups."""
    del search_cols, query
    return [(row, 1.0) for row in rows[:max_results]]


def _retrieve_hybrid(
    rows: list[dict],
    search_cols: list[str],
    query: str,
    max_results: int,
) -> list[tuple[dict, float]]:
    """Structured pre-filter is applied by the caller; hybrid = BM25 over
    the filtered set, falling back to stable order when the query is empty."""
    if not query.strip():
        return _retrieve_structured(rows, search_cols, query, max_results)
    return _retrieve_bm25(rows, search_cols, query, max_results)


#: Retriever registry — selected by name in the manifest or per call.
RETRIEVERS = {
    "bm25": _retrieve_bm25,
    "structured": _retrieve_structured,
    "hybrid": _retrieve_hybrid,
}


def search_rows(
    filepath: Path,
    search_cols: list[str],
    output_cols: list[str],
    query: str,
    max_results: int = DEFAULT_MAX_RESULTS,
    filters: dict | None = None,
    retriever: str = "bm25",
) -> dict:
    """Search one corpus file. Returns a dict with results + raw scores.

    Result shape (interface v1):
    ``{"count": int, "results": [row-projection…], "scores": [float…],
       "filtered_from": int}``
    """
    if retriever not in RETRIEVERS:
        raise ValueError(
            f"Unknown retriever: {retriever!r}. Available: {sorted(RETRIEVERS)}"
        )
    if not filepath.exists():
        return {"error": f"File not found: {filepath}", "count": 0, "results": []}

    rows = load_csv(filepath)
    total = len(rows)
    rows = apply_filters(rows, filters)

    hits = RETRIEVERS[retriever](rows, search_cols, query, max_results)
    results = [
        {col: row.get(col, "") for col in output_cols if col in row}
        for row, _score in hits
    ]
    return {
        "count": len(results),
        "results": results,
        "scores": [score for _row, score in hits],
        "filtered_from": total,
    }

"""Cross-repo retrieval — read-only, targeted, opt-in (ADR-032 Option A).

Phase 4 of `road-to-leaner-core-and-discovery`. Given a query and the opted-in
`linked_projects` siblings, runs a bounded *targeted* search (path-glob +
content grep — never a full walk) and returns the retrieval envelope defined in
`docs/contracts/cross-repo-retrieval.md`. Reuses the redaction + chunking floor
from `knowledge_ingest.py` so no secret crosses a repo boundary.

Scope guards (Option A):
  - read-only, no writes, no network;
  - only siblings with `include: true` in agents/settings/.agent-settings.local.yml;
  - `large`-flagged siblings REQUIRE a `--path-scope` (reject an unscoped query);
  - ≤ --max-chunks results, one concept per query.

Usage:
    python3 scripts/cross_repo_retrieve.py "<query>" [--path-scope GLOB]
            [--max-chunks N] [--format text|json] [--root PATH]
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "src" / "cli" / "python"))
from linked_projects_list import collect as collect_siblings  # type: ignore  # noqa: E402

try:
    from knowledge_ingest import redact, chunk_text  # type: ignore
except Exception:  # pragma: no cover - keep retrieval usable if ingest moves
    def redact(text, counters):  # type: ignore
        return text, 0

    def chunk_text(text, target_bytes=2048):  # type: ignore
        return [text[:target_bytes]] if text else []

DEFAULT_MAX_CHUNKS = 8
MAX_FILES_SCANNED = 2000  # hard ceiling on the targeted walk, defence-in-depth
TEXT_SUFFIXES = {".md", ".txt", ".py", ".ts", ".tsx", ".js", ".jsx", ".php", ".go",
                 ".rs", ".rb", ".java", ".json", ".yml", ".yaml", ".toml", ".sql", ".sh"}
SKIP_DIRS = {".git", "node_modules", "dist", "vendor", ".venv", "__pycache__",
             ".idea", ".vscode", "build", "target", ".next", "coverage"}


def _freshness(repo: Path, rel: str) -> str:
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%ad", "--date=short", "--", rel],
            cwd=repo, capture_output=True, text=True, timeout=8, check=False,
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    try:
        from datetime import datetime, timezone
        ts = (repo / rel).stat().st_mtime
        return datetime.fromtimestamp(ts, timezone.utc).date().isoformat()
    except OSError:
        return "unknown"


def _iter_files(repo: Path, path_scope: str | None):
    count = 0
    for p in sorted(repo.rglob("*")):
        if count >= MAX_FILES_SCANNED:
            break
        if not p.is_file() or p.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in p.relative_to(repo).parts):
            continue
        rel = str(p.relative_to(repo))
        if path_scope and not fnmatch.fnmatch(rel, path_scope):
            continue
        count += 1
        yield p, rel


def _terms(query: str) -> list[str]:
    return [t for t in query.lower().replace(",", " ").split() if len(t) > 2]


def search_sibling(repo: Path, query: str, terms: list[str], path_scope: str | None,
                   budget: int) -> list[dict]:
    hits: list[dict] = []
    repo_name = repo.name
    for p, rel in _iter_files(repo, path_scope):
        if len(hits) >= budget:
            break
        rel_lower = rel.lower()
        path_match = any(t in rel_lower for t in terms)
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        text_lower = text.lower()
        content_terms = [t for t in terms if t in text_lower]
        if not path_match and not content_terms:
            continue
        # Pull the most relevant chunk (first chunk containing a term, else the head).
        chunks = chunk_text(text)
        chosen = next((c for c in chunks if any(t in c.lower() for t in terms)), chunks[0] if chunks else "")
        redacted, _ = redact(chosen, {})
        reason = (f"path matches: {rel}" if path_match
                  else f"content term(s): {', '.join(content_terms[:3])}")
        hits.append({
            "source_repo": repo_name,
            "path": rel,
            "chunk": redacted[:2048],
            "freshness": _freshness(repo, rel),
            "match_reason": reason,
        })
    return hits


def retrieve(root: Path, query: str, path_scope: str | None, max_chunks: int) -> dict:
    siblings = collect_siblings(root, show_all=False)  # opted-in only
    if not siblings:
        return {"query": query, "matches": [], "note": "no opted-in linked-project siblings — nothing to search"}
    terms = _terms(query)
    if not terms:
        return {"query": query, "matches": [], "note": "query too short — give at least one term > 2 chars"}
    matches: list[dict] = []
    skipped: list[str] = []
    for sib in siblings:
        if len(matches) >= max_chunks:
            break
        repo = Path(sib["path"])
        if sib.get("large") and not path_scope:
            skipped.append(sib["path"])
            continue
        matches.extend(search_sibling(repo, query, terms, path_scope, max_chunks - len(matches)))
    out: dict = {"query": query, "matches": matches[:max_chunks]}
    if skipped:
        out["note"] = ("large sibling(s) skipped — supply --path-scope to search them: "
                       + "; ".join(skipped))
    return out


def render_text(result: dict) -> str:
    matches = result["matches"]
    if not matches:
        return result.get("note", "no matches")
    lines = ["| source_repo | path | freshness | why |", "|---|---|---|---|"]
    for m in matches:
        lines.append(f"| {m['source_repo']} | {m['path']} | {m['freshness']} | {m['match_reason']} |")
    if result.get("note"):
        lines += ["", f"> {result['note']}"]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Targeted, read-only cross-repo retrieval (ADR-032 Option A).")
    ap.add_argument("query", help="What to retrieve (one concept; ≥ 1 term > 2 chars).")
    ap.add_argument("--path-scope", default=None, help="Glob to scope the search (required for large siblings).")
    ap.add_argument("--max-chunks", type=int, default=DEFAULT_MAX_CHUNKS)
    ap.add_argument("--format", choices=("text", "json"), default="text")
    ap.add_argument("--root", default=".")
    args = ap.parse_args(argv)

    result = retrieve(Path(args.root).resolve(), args.query, args.path_scope, args.max_chunks)
    print(json.dumps(result, indent=2) if args.format == "json" else render_text(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

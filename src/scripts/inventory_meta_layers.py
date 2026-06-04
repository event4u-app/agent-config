"""Meta-layer / concept-surface inventory — read-only discovery pass.

Drives Phase 1 of `agents/roadmaps/road-to-leaner-core-and-discovery.md`.
Sibling to `scripts/inventory_abstraction_budget.py`: that tool counts
per-artefact references + frontmatter bloat; this one inventories the
*concept surface* the post-5.x feedback names as meta-complexity.

For each concept it emits one row:
    concept · surfaces it lives in · line cost · last-touched · overlap candidates

Concept = a normalized token shared by ≥ 2 stable artefacts (a rule, a
contract, a guideline, or a context) — i.e. a single idea defined in
more than one surface. Plus the curated meta-layer families the
feedback names explicitly (iron-laws, value, roadmap, linked-projects,
marketplace, governance). Also tabulates always-loaded rule families
(kernel) + Iron-Law count per rule.

Output: agents/evidence/analysis/meta-layer-inventory.md (+ .csv)
Read-only. Touches no abstraction file.

Usage:
    python3 scripts/inventory_meta_layers.py [--quiet]
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RULES_DIR = REPO_ROOT / ".agent-src" / "rules"
CONTRACTS_DIR = REPO_ROOT / "docs" / "contracts"
GUIDELINES_DIR = REPO_ROOT / "docs" / "guidelines"
CONTEXTS_DIR = REPO_ROOT / ".agent-src" / "contexts"
ROUTER = REPO_ROOT / "dist" / "router.json"
EVIDENCE_DIR = REPO_ROOT / "agents" / "evidence" / "analysis"

IRON_LAW_RE = re.compile(r"^#{1,3}\s+(?:The\s+)?Iron\s+Laws?\b", re.IGNORECASE | re.MULTILINE)

# Generic filename tokens that carry no concept identity — dropped before grouping.
STOPWORDS = {
    "rule", "rules", "contract", "contracts", "mechanics", "policy", "schema",
    "config", "v1", "v2", "and", "the", "of", "for", "to", "in", "on", "a",
    "adr", "model", "spec", "format", "default", "defaults", "system", "examples",
    "demos", "writing", "patterns", "auto", "core", "base",
}

# Curated meta-layer families the feedback names (always emitted as rows).
SEED_FAMILIES = ["iron", "value", "roadmap", "linked", "marketplace", "governance", "council"]


@dataclass
class Surface:
    path: Path
    kind: str  # rule | contract | guideline | context
    lines: int
    tokens: set[str] = field(default_factory=set)

    @property
    def rel(self) -> str:
        return str(self.path.relative_to(REPO_ROOT))


def _last_touched(path: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%ad", "--date=short", "--", str(path)],
            cwd=REPO_ROOT, capture_output=True, text=True, check=False, timeout=10,
        )
        return out.stdout.strip() or "untracked"
    except Exception:
        return "unknown"


def _tokens(stem: str) -> set[str]:
    return {t for t in re.split(r"[-_]", stem.lower()) if t and t not in STOPWORDS and len(t) > 2}


def _collect(directory: Path, kind: str) -> list[Surface]:
    out: list[Surface] = []
    if not directory.exists():
        return out
    for p in sorted(directory.rglob("*.md")):
        if p.name == "README.md":
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        out.append(Surface(p, kind, text.count("\n") + 1, _tokens(p.stem)))
    return out


def _kernel_and_tiers() -> dict[str, int | list[str]]:
    if not ROUTER.exists():
        return {"kernel": [], "tier_1": 0, "tier_2": 0}
    d = json.loads(ROUTER.read_text(encoding="utf-8"))
    return {
        "kernel": d.get("kernel", []),
        "tier_1": d.get("tier_1", 0) if isinstance(d.get("tier_1"), int) else len(d.get("tier_1", [])),
        "tier_2": d.get("tier_2", 0) if isinstance(d.get("tier_2"), int) else len(d.get("tier_2", [])),
    }


def _iron_law_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for p in sorted(RULES_DIR.glob("*.md")):
        text = p.read_text(encoding="utf-8", errors="replace")
        n = len(IRON_LAW_RE.findall(text))
        if n:
            counts[p.stem] = n
    return counts


def _stack(s: Surface) -> str:
    """Concern stack a surface belongs to. PHP coding guidelines are a
    different domain from agent-behaviour rules/contracts — a shared topic
    word (`git`, `security`) between them is coincidence, not duplication.
    """
    return "php" if "/guidelines/php/" in s.rel.replace("\\", "/") else "agent"


def _same_concept(a: Surface, b: Surface) -> bool:
    """Genuine concept duplication, not topic adjacency.

    True when one stem is a prefix of the other (the rule→mechanics/examples
    split — `language-and-tone` ⊂ `language-and-tone-examples`), OR the two
    stems share ≥ 2 significant tokens (a tight family like `domain-safety-*`).
    Single shared topic token (`skill`, `command`, `agent`) is NOT enough.

    Cross-stack guard (Phase-1 council namespace-hygiene, 2026-05-30): a PHP
    coding guideline and an agent rule/contract that merely share one topic
    word (`git`, `security`) are distinct concerns — only group them on a
    near-identical stem (prefix containment), never on a lone shared token.
    """
    sa, sb = a.path.stem.lower(), b.path.stem.lower()
    short, long = (sa, sb) if len(sa) <= len(sb) else (sb, sa)
    # Containment only counts when the prefix is itself a multi-token concept
    # (`language-and-tone` ⊂ `…-examples`), never a generic single word
    # (`git` ⊂ `git-history-discipline` is coincidence, not duplication).
    if short != long and long.startswith(short + "-") and len(_tokens(short)) >= 2:
        return True
    if _stack(a) != _stack(b):
        return False
    return len(a.tokens & b.tokens) >= 2


def _concept_rows(surfaces: list[Surface]) -> list[dict]:
    # Union-find over the genuine-duplication adjacency.
    parent = list(range(len(surfaces)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        parent[find(i)] = find(j)

    for i in range(len(surfaces)):
        for j in range(i + 1, len(surfaces)):
            if _same_concept(surfaces[i], surfaces[j]):
                union(i, j)

    comps: dict[int, list[Surface]] = defaultdict(list)
    for idx, s in enumerate(surfaces):
        comps[find(idx)].append(s)

    rows: list[dict] = []
    for group in comps.values():
        if len(group) < 2:
            continue
        kinds = {s.kind for s in group}
        # Concept label = the most-common significant token shared across the group.
        tok_freq: dict[str, int] = defaultdict(int)
        for s in group:
            for t in s.tokens:
                tok_freq[t] += 1
        shared = [t for t, n in tok_freq.items() if n == len(group)] or [max(tok_freq, key=tok_freq.get)]
        label = "-".join(sorted(shared)[:2])
        seeded = any(any(t.startswith(f) or f.startswith(t) for f in SEED_FAMILIES) for t in shared)
        cross_kind = len(kinds) >= 2
        contract_dup = sum(1 for s in group if s.kind == "contract") >= 2
        line_cost = sum(s.lines for s in group)
        touched = max((_last_touched(s.path) for s in group), default="unknown")
        rows.append({
            "concept": label,
            "surfaces": "; ".join(s.rel for s in sorted(group, key=lambda x: x.rel)),
            "surface_count": len(group),
            "kinds": ",".join(sorted(kinds)),
            "line_cost": line_cost,
            "last_touched": touched,
            "overlap": "Y" if (cross_kind or contract_dup) else "family",
            "seeded": "Y" if seeded else "",
        })
    rows.sort(key=lambda r: (-r["surface_count"], -r["line_cost"]))
    return rows


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Meta-layer / concept-surface inventory (read-only).")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args(argv)

    surfaces = (
        _collect(RULES_DIR, "rule")
        + _collect(CONTRACTS_DIR, "contract")
        + _collect(GUIDELINES_DIR, "guideline")
        + _collect(CONTEXTS_DIR, "context")
    )
    tiers = _kernel_and_tiers()
    iron = _iron_law_counts()
    rows = _concept_rows(surfaces)

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    md = EVIDENCE_DIR / "meta-layer-inventory.md"
    csv_path = EVIDENCE_DIR / "meta-layer-inventory.csv"

    kernel = tiers["kernel"]
    overlap_count = sum(1 for r in rows if r["overlap"] == "Y")
    iron_total = sum(iron.values())

    lines = [
        "# Meta-Layer / Concept-Surface Inventory",
        "",
        "> Read-only discovery output for `agents/roadmaps/road-to-leaner-core-and-discovery.md` Phase 1.",
        "> Counts are grep/git-backed via `scripts/inventory_meta_layers.py`. A row is an *overlap candidate*",
        "> when one concept (a shared filename token) is defined across ≥ 2 stable surfaces.",
        "",
        "## Summary",
        "",
        "| Metric | Value |",
        "|---|---:|",
        f"| Always-loaded kernel rule families | {len(kernel)} |",
        f"| tier_1 (balanced) rules | {tiers['tier_1']} |",
        f"| tier_2 (full) rules | {tiers['tier_2']} |",
        f"| Rules carrying Iron-Law headings | {len(iron)} |",
        f"| Total Iron-Law headings across rules | {iron_total} |",
        f"| Concept surfaces scanned (rule/contract/guideline/context) | {len(surfaces)} |",
        f"| Concept overlap candidates (≥ 2 surfaces, cross-kind/contract-dup) | {overlap_count} |",
        "",
        f"Kernel: {', '.join(kernel)}",
        "",
        "## Iron-Law density per rule (top 15)",
        "",
        "| Rule | Iron Laws |",
        "|---|---:|",
    ]
    for stem, n in sorted(iron.items(), key=lambda kv: -kv[1])[:15]:
        lines.append(f"| `{stem}` | {n} |")

    lines += [
        "",
        "## Concept-overlap ledger",
        "",
        "> One row per concept defined in ≥ 2 surfaces. `overlap=Y` = cross-kind or duplicate-contract",
        "> (genuine merge/delete candidate). `seeded` = a feedback-named meta-layer family.",
        "> Classification (merge / delete / keep-with-reason) is filled in Step 2 — left blank here.",
        "",
        "| Concept | Surfaces | # | Kinds | Lines | Last touched | Overlap | Class |",
        "|---|---|---:|---|---:|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| `{r['concept']}` | {r['surfaces']} | {r['surface_count']} | {r['kinds']} | "
            f"{r['line_cost']} | {r['last_touched']} | {r['overlap']} | _unclassified_ |"
        )
    lines.append("")
    md.write_text("\n".join(lines), encoding="utf-8")

    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["concept", "surface_count", "kinds", "line_cost", "last_touched", "overlap", "seeded", "surfaces"])
        w.writeheader()
        for r in rows:
            w.writerow(r)

    if not args.quiet:
        print(f"meta-layer inventory: {len(surfaces)} surfaces, {len(rows)} concept rows, {overlap_count} overlap candidates")
        print(f"  → {md.relative_to(REPO_ROOT)}")
        print(f"  → {csv_path.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

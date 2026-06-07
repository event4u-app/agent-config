#!/usr/bin/env python3
"""corpus-grounding · decision_engine — reasoning layer (interface v1).

Manifest-parameterised conditional grounding (ADR-061 §3 tier 2):
multi-domain search per the manifest's reasoning plan, decision-rule
evaluation (JSON conditionals + an optional Python-callable escape hatch
where JSON caps out), best-match selection, and a grounded-output dict
that ALWAYS carries a confidence score + an evidence-gap line (contract —
prevents false precision / authority inflation).

Reasoning flow ported from `nextlevelbuilder/ui-ux-pro-max-skill`
`design_system.py` (`_apply_reasoning`, multi-domain search, best-match
selection) and de-frontend-hardcoded: every axis comes from the manifest.
Upstream: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
@ b7e3af80f6e331f6fb456667b82b12cade7c9d35 · MIT · last checked 2026-06-07.

Pure stdlib. No network, no subprocess. Writes only under --persist
(opt-in, see persist_grounding). Interface contract: SKILL.md.
"""

from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

from bm25_search import DEFAULT_MAX_RESULTS, search_rows
from schema_validator import ManifestError, resolve_data_path

__all__ = [
    "detect_domain",
    "search_domain",
    "search_stack",
    "evaluate_rules",
    "ground",
    "persist_grounding",
]


# ---------------------------------------------------------------- detection
def detect_domain(manifest: dict, query: str) -> str:
    """Keyword-vote routing of a query onto one of the manifest's domains."""
    detect = manifest.get("detect") or {}
    query_lower = query.lower()
    scores = {
        name: sum(
            1
            for kw in keywords
            if re.search(r"\b" + re.escape(str(kw).lower()) + r"\b", query_lower)
        )
        for name, keywords in detect.items()
        if name != "_stack"
    }
    if scores:
        best = max(scores, key=lambda k: scores[k])
        if scores[best] > 0:
            return best
    return manifest.get("default_domain") or next(iter(manifest["domains"]))


# ---------------------------------------------------------------- search ops
def search_domain(
    manifest: dict,
    query: str,
    domain: str | None = None,
    max_results: int | None = None,
    filters: dict | None = None,
) -> dict:
    """Search one manifest domain. Adds confidence + evidence_gap."""
    if domain is None:
        domain = detect_domain(manifest, query)
    domains = manifest["domains"]
    if domain not in domains:
        return {
            "error": f"Unknown domain: {domain!r}. Available: {sorted(domains)}",
            "count": 0,
            "results": [],
        }
    cfg = domains[domain]
    merged_filters = dict(cfg.get("filters") or {})
    if filters:
        merged_filters.update(filters)
    result = search_rows(
        resolve_data_path(manifest, cfg["file"]),
        cfg["search_cols"],
        cfg["output_cols"],
        query,
        max_results or cfg.get("max_results", DEFAULT_MAX_RESULTS),
        merged_filters or None,
        manifest.get("retriever", "bm25"),
    )
    result.update({"domain": domain, "query": query, "file": cfg["file"]})
    _attach_confidence(result)
    return result


def search_stack(
    manifest: dict,
    query: str,
    stack: str,
    max_results: int = DEFAULT_MAX_RESULTS,
    filters: dict | None = None,
) -> dict:
    """Search one stack axis (optional manifest extension)."""
    stacks = manifest.get("stacks") or {}
    if stack not in stacks:
        return {
            "error": f"Unknown stack: {stack!r}. Available: {sorted(stacks)}",
            "count": 0,
            "results": [],
        }
    cols = manifest["stack_cols"]
    result = search_rows(
        resolve_data_path(manifest, stacks[stack]),
        cols["search_cols"],
        cols["output_cols"],
        query,
        max_results,
        filters,
        manifest.get("retriever", "bm25"),
    )
    result.update({"domain": "stack", "stack": stack, "query": query, "file": stacks[stack]})
    _attach_confidence(result)
    return result


def _attach_confidence(result: dict) -> None:
    """Confidence from BM25 score shape; evidence gap when weak/empty."""
    scores = result.get("scores") or []
    gaps: list[str] = []
    if not scores:
        label, numeric = "low", 0.0
        gaps.append(
            f"no corpus rows matched the query in domain "
            f"'{result.get('domain', '?')}' — answer falls back to agent priors"
        )
    else:
        top = scores[0]
        numeric = round(min(1.0, top / 10.0), 3)
        if top >= 4.0:
            label = "high"
        elif top >= 1.5:
            label = "medium"
        else:
            label = "low"
            gaps.append("top BM25 score is weak — treat the match as a hint, not a verdict")
    result["confidence"] = {"label": label, "score": numeric}
    result["evidence_gap"] = gaps


# ---------------------------------------------------------------- rules
def evaluate_rules(rules: dict, query: str, context: dict | None = None) -> dict:
    """Evaluate JSON conditional rules against the query/context.

    Upstream rule shape: ``{"if_<condition>": "<directive>"}``. A condition
    matches when its underscore-separated tokens appear in the query or in
    a truthy context flag of the same name. Returns
    ``{"matched": {...}, "unmatched": {...}}`` — both surfaced, so the
    agent sees the full rule space (auditable, never a hidden gate).
    """
    context = context or {}
    query_lower = query.lower()
    matched: dict = {}
    unmatched: dict = {}
    for key, directive in (rules or {}).items():
        cond = key[3:] if key.startswith("if_") else key
        tokens = [t for t in cond.split("_") if t]
        hit = bool(context.get(cond)) or (
            tokens and all(t in query_lower for t in tokens)
        )
        (matched if hit else unmatched)[key] = directive
    return {"matched": matched, "unmatched": unmatched}


def _load_rules_callable(manifest: dict):
    """Optional Python escape hatch: reasoning.rules_module beside the
    manifest exposing evaluate(rules, query, context) -> dict.

    Runtime-safety: only a manifest-relative module inside the skill dir is
    loadable (same containment rule as corpus files)."""
    reasoning = manifest.get("reasoning") or {}
    rel = reasoning.get("rules_module")
    if not rel:
        return None
    path = resolve_data_path(manifest, rel)
    if not path.exists():
        raise ManifestError(f"reasoning.rules_module not found: {path}")
    spec = importlib.util.spec_from_file_location("corpus_grounding_rules", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    fn = getattr(module, "evaluate", None)
    if not callable(fn):
        raise ManifestError(f"{path} must expose evaluate(rules, query, context)")
    return fn


def _find_reasoning_rule(rows: list[dict], match_column: str, category: str) -> dict:
    """Exact → partial → keyword match of a category onto the rule rows."""
    category_lower = category.lower()
    for rule in rows:
        if str(rule.get(match_column, "")).lower() == category_lower:
            return rule
    for rule in rows:
        cat = str(rule.get(match_column, "")).lower()
        if cat and (cat in category_lower or category_lower in cat):
            return rule
    for rule in rows:
        cat = str(rule.get(match_column, "")).lower()
        keywords = cat.replace("/", " ").replace("-", " ").split()
        if any(kw in category_lower for kw in keywords):
            return rule
    return {}


def _select_best_match(results: list[dict], priority_keywords: list[str], name_col: str | None) -> dict:
    """Priority-keyword re-ranking of a domain's results (upstream port)."""
    if not results:
        return {}
    if not priority_keywords:
        return results[0]
    if name_col:
        for priority in priority_keywords:
            p = priority.lower().strip()
            for result in results:
                name = str(result.get(name_col, "")).lower()
                if p and (p in name or name in p):
                    return result
    scored: list[tuple[int, dict]] = []
    for result in results:
        blob = str(result).lower()
        score = 0
        for kw in priority_keywords:
            k = kw.lower().strip()
            if not k:
                continue
            if name_col and k in str(result.get(name_col, "")).lower():
                score += 10
            elif k in str(result.get("Keywords", "")).lower():
                score += 3
            elif k in blob:
                score += 1
        scored.append((score, result))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1] if scored and scored[0][0] > 0 else results[0]


# ---------------------------------------------------------------- grounding
def ground(manifest: dict, query: str, context: dict | None = None) -> dict:
    """Conditional grounding: category → rules → planned multi-domain search.

    Returns (interface v1):
    ``{"domain": str, "query": str, "category": str, "rule": {...},
       "rules_evaluation": {"matched": …, "unmatched": …},
       "selections": {<domain>: {"best": row, "alternatives": [...],
                                  "confidence": …}},
       "confidence": {"label": …, "score": …},
       "evidence_gap": [str, …]}``
    """
    reasoning = manifest.get("reasoning")
    if not reasoning:
        raise ManifestError(
            f"manifest domain {manifest.get('domain')!r} has no reasoning block "
            "(tier is lookup-only — use search instead of ground)"
        )

    gaps: list[str] = []

    # 1 — category lookup (which row of the reasoning map applies).
    category = manifest.get("default_category", "General")
    cat_domain = reasoning.get("category_domain")
    cat_column = reasoning.get("category_column")
    if cat_domain and cat_column:
        cat_result = search_domain(manifest, query, cat_domain, max_results=1)
        rows = cat_result.get("results") or []
        if rows:
            category = str(rows[0].get(cat_column) or category)
        else:
            gaps.append(
                f"category lookup in '{cat_domain}' found nothing — "
                f"grounding against default category '{category}'"
            )

    # 2 — reasoning rule for the category.
    rules_path = resolve_data_path(manifest, reasoning["file"])
    from bm25_search import load_csv  # local import keeps module deps one-way

    rule_rows = load_csv(rules_path) if rules_path.exists() else []
    rule = _find_reasoning_rule(rule_rows, reasoning["match_column"], category)
    if not rule:
        gaps.append(
            f"no reasoning rule matched category '{category}' — "
            "selections below are unweighted corpus hits"
        )

    # 3 — decision rules (JSON; optional Python escape hatch).
    raw_rules: dict = {}
    rules_column = reasoning.get("rules_column")
    if rules_column and rule.get(rules_column):
        try:
            raw_rules = json.loads(rule[rules_column])
        except json.JSONDecodeError:
            gaps.append(f"decision rules in column '{rules_column}' are not valid JSON")
    custom = _load_rules_callable(manifest)
    rules_evaluation = (
        custom(raw_rules, query, context or {})
        if custom
        else evaluate_rules(raw_rules, query, context)
    )

    # 4 — priority keywords from the rule (e.g. style priority).
    priority: list[str] = []
    priority_column = reasoning.get("priority_column")
    if priority_column and rule.get(priority_column):
        priority = [s.strip() for s in str(rule[priority_column]).split("+") if s.strip()]

    # 5 — planned multi-domain search.
    selections: dict = {}
    domain_confidences: list[float] = []
    plan: dict = reasoning.get("plan") or {}
    priority_domain = reasoning.get("priority_domain")
    name_cols: dict = reasoning.get("name_columns") or {}
    for domain_name, max_results in plan.items():
        q = query
        if domain_name == priority_domain and priority:
            q = f"{query} {' '.join(priority[:2])}"
        result = search_domain(manifest, q, domain_name, max_results=int(max_results))
        results = result.get("results") or []
        best = (
            _select_best_match(results, priority, name_cols.get(domain_name))
            if domain_name == priority_domain
            else (results[0] if results else {})
        )
        selections[domain_name] = {
            "best": best,
            "alternatives": [r for r in results if r is not best],
            "confidence": result.get("confidence"),
        }
        gaps.extend(result.get("evidence_gap") or [])
        domain_confidences.append((result.get("confidence") or {}).get("score", 0.0))

    # 6 — aggregate confidence (weakest link wins — grounded output is only
    # as strong as its weakest contributing domain).
    numeric = round(min(domain_confidences), 3) if domain_confidences else 0.0
    label = "high" if numeric >= 0.4 else "medium" if numeric >= 0.15 else "low"

    return {
        "domain": manifest.get("domain"),
        "query": query,
        "category": category,
        "rule": {k: v for k, v in rule.items() if k != rules_column},
        "rules_evaluation": rules_evaluation,
        "selections": selections,
        "confidence": {"label": label, "score": numeric},
        "evidence_gap": gaps
        or ["none — every planned domain returned a scored match"],
    }


# ---------------------------------------------------------------- persistence
def persist_grounding(
    grounded: dict,
    output_dir: Path,
    project: str | None = None,
    page: str | None = None,
) -> dict:
    """Opt-in (--persist): write the grounded output as a master file +
    optional page override (upstream MASTER.md pattern, generalized).

    Writes ONLY under ``output_dir`` (caller-chosen). Returns created paths.
    """
    project_slug = (project or grounded.get("query", "default")).lower().replace(" ", "-")
    base = Path(output_dir) / "design-system" / project_slug
    base.mkdir(parents=True, exist_ok=True)
    created: list[str] = []

    master = base / "MASTER.md"
    master.write_text(_render_markdown(grounded, master=True), encoding="utf-8")
    created.append(str(master))

    if page:
        pages = base / "pages"
        pages.mkdir(parents=True, exist_ok=True)
        page_file = pages / f"{page.lower().replace(' ', '-')}.md"
        page_file.write_text(
            f"# {page.title()} — page overrides\n\n"
            "> Rules here OVERRIDE the project MASTER.md for this page only.\n"
            "> Start empty; add only deviations.\n",
            encoding="utf-8",
        )
        created.append(str(page_file))
    return {"status": "success", "created_files": created}


def _render_markdown(grounded: dict, master: bool = False) -> str:
    """Generic markdown rendering of a grounded output (interface v1)."""
    lines: list[str] = []
    if master:
        lines += [
            "# Design System Master File",
            "",
            "> **LOGIC:** When building a specific page, first check "
            "`pages/<page>.md`. If it exists, its rules **override** this "
            "master file. Otherwise follow the rules below.",
            "",
        ]
    lines += [
        f"## Grounded recommendation: {grounded.get('query', '')}",
        "",
        f"- **Domain:** {grounded.get('domain', '')}",
        f"- **Category:** {grounded.get('category', '')}",
        f"- **Confidence:** {grounded.get('confidence', {}).get('label', '?')} "
        f"({grounded.get('confidence', {}).get('score', 0)})",
        "",
    ]
    for domain, sel in (grounded.get("selections") or {}).items():
        best = sel.get("best") or {}
        if not best:
            continue
        lines.append(f"### {domain}")
        for key, value in best.items():
            value_str = str(value)
            if len(value_str) > 300:
                value_str = value_str[:300] + "…"
            if value_str:
                lines.append(f"- **{key}:** {value_str}")
        lines.append("")
    matched = (grounded.get("rules_evaluation") or {}).get("matched") or {}
    if matched:
        lines.append("### Matched decision rules")
        for key, directive in matched.items():
            lines.append(f"- `{key}` → {directive}")
        lines.append("")
    lines.append("### Evidence gap")
    for gap in grounded.get("evidence_gap") or []:
        lines.append(f"- {gap}")
    lines.append("")
    return "\n".join(lines)

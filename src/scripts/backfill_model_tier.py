#!/usr/bin/env python3
"""Backfill / migrate `model_tier` on every skill and command (ADR-035).

Vendor-neutral capability band `lite | medium | high | inherit` (replaces the
concrete-model `recommended_model` from ADR-034). Behaviour per artefact:

- **Has `recommended_model`** (ADR-034 legacy) → migrate via the value map
  (`opus→high`, `sonnet→medium`, `gpt→high`, `inherit→inherit`) and rename the
  key to `model_tier`. Same line count — no body shift.
- **Already `model_tier`** → leave (idempotent).
- **Untagged** → classify fresh from the task→tier heuristic
  (`contexts/model-recommendations.md`): deep reasoning → high; mechanical /
  impl / docs / tests / quality → medium; clearly-trivial → lite; meta /
  ambiguous → inherit.

A small explicit `_LITE` set demotes obviously-trivial mechanical skills to the
cheapest band; `_CONTEXT_LARGE` adds the orthogonal `context: large` modifier to
genuinely long-context skills. Writes BOTH the source and its `dist/agent-src` copy
(frontmatter stays byte-identical); refresh condensation hashes afterwards.

CLI: python3 scripts/backfill_model_tier.py [--dry-run]
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_frontmatter import parse_frontmatter  # noqa: E402
from _lib.agent_src import artefact_roots, iter_commands, strip_source_prefix  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CONDENSED = ROOT / "dist/agent-src"

# ADR-034 → ADR-035 value map.
_MIGRATE = {"opus": "high", "sonnet": "medium", "gpt": "high", "inherit": "inherit"}

# Fresh-classification slug signals (deep reasoning / large-analysis → high).
_HIGH = (
    "architect", "refactor", "debug", "threat", "authz", "adversarial",
    "blast-radius", "defense-in-depth", "data-flow", "decision-record",
    "adr-create", "security-audit", "privacy-review", "review", "judge-",
    "bug-analyzer", "systematic-debugging", "incident", "risk-officer",
    "migration-architect", "moat", "analysis", "analyze", "analyzer",
    "research", "deep-reading", "repomix", "sequential-thinking",
    "project-analysis", "universal-project", "market-entry",
    "scenario-modeling", "forecast", "dcf-modeling", "unit-economics",
    "funnel-analysis",
)
_MEDIUM = (
    "test", "pest", "playwright", "lint", "quality-tools", "format", "docs",
    "readme-writing", "commit", "conventional", "css", "tailwind", "blade",
    "flux", "livewire", "form-handler", "api-endpoint", "api-testing",
    "eloquent", "laravel", "dto", "mail", "notification", "migration",
    "middleware", "scheduling", "websocket", "reverb", "horizon", "pulse",
    "pennant", "validation", "docker", "terraform", "terragrunt", "github-ci",
    "traefik", "grafana", "dashboard", "openapi", "sql", "artisan", "composer",
    "jobs-events", "multi-tenancy", "secrets", "logging", "database",
    "php-coder", "php-service", "nextjs", "react", "symfony", "mcp",
    "devcontainer", "copilot", "module",
)
_DOMAIN_DEFAULT = {
    "engineering": "medium", "quality": "medium", "devops": "medium",
    "discovery": "high", "product": "inherit", "process": "inherit",
}

# Clearly-trivial, no-reasoning mechanical skills → cheapest band.
_LITE = {"file-editor", "md-language-check"}
# Genuinely long-context skills → orthogonal context modifier (ADR-035).
_CONTEXT_LARGE = {
    "project-analysis-core", "project-analysis-hypothesis-driven",
    "project-analyzer", "universal-project-analysis", "repomix-packer",
    "deep-reading-analyst",
}

_RM_RE = re.compile(r'^recommended_model:[ \t]*"?[a-z0-9-]+"?[ \t]*$', re.MULTILINE)
_MT_RE = re.compile(r'^model_tier:', re.MULTILINE)
_CTX_RE = re.compile(r'^context:', re.MULTILINE)


def _classify(slug: str, domain: str | None) -> str:
    s = slug.lower()
    if s in _LITE:
        return "lite"
    if any(k in s for k in _HIGH):
        return "high"
    if any(k in s for k in _MEDIUM):
        return "medium"
    return _DOMAIN_DEFAULT.get(domain or "", "inherit")


def _resolve_tier(slug: str, fm: dict | None) -> str:
    existing_mt = fm.get("model_tier") if isinstance(fm, dict) else None
    if existing_mt:
        tier = existing_mt
    else:
        existing_rm = fm.get("recommended_model") if isinstance(fm, dict) else None
        if existing_rm:
            tier = _MIGRATE.get(existing_rm, "inherit")
        else:
            tier = _classify(slug, fm.get("domain") if isinstance(fm, dict) else None)
    return "lite" if slug in _LITE else tier


def _apply(path: Path, tier: str, want_context: bool) -> bool:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return False
    end = text.find("\n---\n", 4)
    if end == -1:
        return False
    fm, body = text[4:end], text[end:]
    changed = False
    if _MT_RE.search(fm):
        pass  # already migrated — idempotent
    elif _RM_RE.search(fm):
        fm = _RM_RE.sub(f"model_tier: {tier}", fm, count=1)
        changed = True
    else:
        fm = f"model_tier: {tier}\n" + fm
        changed = True
    if want_context and not _CTX_RE.search(fm):
        fm = re.sub(r'(^model_tier:.*$)', r'\1\ncontext: large', fm, count=1, flags=re.MULTILINE)
        changed = True
    if changed:
        path.write_text("---\n" + fm + body, encoding="utf-8")
    return changed


def _iter():
    for root in artefact_roots():
        sdir = root / "skills"
        if sdir.exists():
            for p in sorted(sdir.rglob("SKILL.md")):
                slug = p.parent.name
                yield p, CONDENSED / "skills" / slug / "SKILL.md", slug
    # Commands live under packages/*/commands/ AND the 6.0.0-D
    # src/domains/<pack>/<subpath>/command.md homes; iter_commands() covers
    # both. The condensed path + slug derive from the logical command path.
    for p in iter_commands():
        if p.name == "AGENTS.md":
            continue
        logical = strip_source_prefix(p.relative_to(ROOT).as_posix()) or ""
        sub = logical[len("commands/"):] if logical.startswith("commands/") else p.name
        slug = "-".join(Path(sub).with_suffix("").parts)
        yield p, CONDENSED / "commands" / sub, slug


def run(apply: bool) -> int:
    dist: Counter = Counter()
    ctx = 0
    touched = 0
    for src, cond, slug in _iter():
        fm, _ = parse_frontmatter(src.read_text(encoding="utf-8"))
        tier = _resolve_tier(slug, fm)
        want_ctx = slug in _CONTEXT_LARGE
        dist[tier] += 1
        if want_ctx:
            ctx += 1
        if apply:
            if _apply(src, tier, want_ctx):
                touched += 1
            if cond.exists():
                _apply(cond, tier, want_ctx)
    verb = "would set" if not apply else "set"
    print(f"model_tier backfill ({'dry-run' if not apply else 'apply'}):")
    for t in ("lite", "medium", "high", "inherit"):
        print(f"  {t:8s}: {dist[t]}")
    print(f"  context:large on {ctx} skills · {verb} {touched} newly · total {sum(dist.values())}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    return run(apply=not args.dry_run)


if __name__ == "__main__":
    sys.exit(main())

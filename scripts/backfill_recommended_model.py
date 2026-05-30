#!/usr/bin/env python3
"""Backfill `recommended_model` on every skill and command (Phase 5 / ADR-034).

Derives a per-artefact recommendation from the task→model table in
`contexts/model-recommendations.md`, conservatively:

- **opus**   — deep structural reasoning: architecture, refactoring, review,
               complex debugging, security/threat/authz, design decisions.
- **gpt**    — large-context / planning / research / multi-file analysis.
- **sonnet** — mechanical implementation, tests, quality, docs, config, infra
               (the cheapest tier — no `haiku`).
- **inherit**— genuinely model-agnostic / meta work; keep the session model.

Anything the classifier cannot confidently place lands on `inherit` (safe — the
Phase 6 measurement + per-skill evals refine the tags later, per ADR-034). The
field is written to BOTH the source artefact and its condensed `.agent-src`
copy so the frontmatter stays byte-identical (the condensation roundtrip
invariant); the Claude/Augment projections follow via `task generate-tools`.

CLI: python3 scripts/backfill_recommended_model.py [--dry-run]
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_frontmatter import parse_frontmatter  # noqa: E402
from _lib.agent_src import artefact_roots  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CONDENSED = ROOT / ".agent-src"

# Substring signals on the artefact slug (highest precedence first).
_OPUS = (
    "architect", "refactor", "debug", "threat", "authz", "adversarial",
    "blast-radius", "defense-in-depth", "data-flow", "decision-record",
    "adr-create", "security-audit", "privacy-review", "review", "judge-",
    "bug-analyzer", "systematic-debugging", "incident", "risk-officer",
    "migration-architect", "moat",
)
_GPT = (
    "analysis", "analyze", "analyzer", "research", "deep-reading", "repomix",
    "sequential-thinking", "project-analysis", "universal-project",
    "market-entry", "scenario-modeling", "forecast", "dcf-modeling",
    "unit-economics", "funnel-analysis", "performance-analysis",
)
# Mechanical / implementation signals.
_SONNET = (
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
# Domain fallback when no slug signal matches.
_DOMAIN_DEFAULT = {
    "engineering": "sonnet",
    "quality": "sonnet",
    "devops": "sonnet",
    "discovery": "gpt",
    "product": "inherit",
    "process": "inherit",
}


def _classify(slug: str, domain: str | None) -> str:
    s = slug.lower()
    if any(k in s for k in _OPUS):
        return "opus"
    if any(k in s for k in _GPT):
        return "gpt"
    if any(k in s for k in _SONNET):
        return "sonnet"
    return _DOMAIN_DEFAULT.get(domain or "", "inherit")


def _inject(path: Path, value: str) -> bool:
    """Insert `recommended_model: <value>` as the first frontmatter line if the
    field is absent. Returns True if the file was changed."""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return False
    end = text.find("\n---\n", 4)
    if end == -1:
        return False
    if re.search(r"^recommended_model:", text[4:end], re.MULTILINE):
        return False
    new = "---\nrecommended_model: " + value + "\n" + text[4:]
    path.write_text(new, encoding="utf-8")
    return True


def _iter_targets():
    """Yield (source_path, condensed_path, slug, domain, kind)."""
    for root in artefact_roots():
        # Skills
        sdir = root / "skills"
        if sdir.exists():
            for skill_md in sorted(sdir.rglob("SKILL.md")):
                slug = skill_md.parent.name
                yield skill_md, CONDENSED / "skills" / slug / "SKILL.md", slug, "skill"
        # Commands
        cdir = root / "commands"
        if cdir.exists():
            for cmd in sorted(cdir.rglob("*.md")):
                if cmd.name == "AGENTS.md":
                    continue
                rel = cmd.relative_to(cdir)
                slug = "-".join(rel.with_suffix("").parts)
                yield cmd, CONDENSED / "commands" / rel, slug, "command"


def run(apply: bool) -> int:
    dist: Counter = Counter()
    touched = 0
    for src, cond, slug, kind in _iter_targets():
        fm, _ = parse_frontmatter(src.read_text(encoding="utf-8"))
        domain = fm.get("domain") if isinstance(fm, dict) else None
        existing = fm.get("recommended_model") if isinstance(fm, dict) else None
        value = existing if existing else _classify(slug, domain)
        dist[value] += 1
        if existing:
            continue
        if apply:
            changed = _inject(src, value)
            if cond.exists():
                _inject(cond, value)
            touched += 1 if changed else 0
        else:
            touched += 1
    verb = "would tag" if not apply else "tagged"
    print(f"recommended_model backfill ({'dry-run' if not apply else 'apply'}):")
    for model in ("opus", "sonnet", "gpt", "inherit"):
        print(f"  {model:8s}: {dist[model]}")
    print(f"  TOTAL artefacts: {sum(dist.values())} · {verb} {touched} newly")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    return run(apply=not args.dry_run)


if __name__ == "__main__":
    sys.exit(main())

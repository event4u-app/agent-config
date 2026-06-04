#!/usr/bin/env python3
"""Lint persona governance — per-domain cap (hard) + citation floor (warn).

Enforces the mechanical checks in
`.agent-src.uncondensed/rules/persona-governance.md`:

  1. **Per-domain cap (HARD)** — ≤ 2 active specialist personas per
     content domain. Core-tier personas are exempt. `status:
     deprecated` rows (if any survive a transition window) are
     excluded from the count; the canonical path is in-commit
     deletion, no soak window.
  2. **Skill citation floor (WARN)** — every active specialist
     persona SHOULD be cited by `personas: [<id>]` in at least one
     skill SKILL.md under `.agent-src.uncondensed/skills/` or
     `.claude/skills/`. Surfaced as a warning, never blocks CI:
     the citation floor is enforced at PR time per the rule (a new
     specialist MUST land with a cite); pre-existing wiring debt is
     tracked as `--citation-debt` for the maintainer dashboard.

Schema conformance (check 4) is delegated to `lint-skills`.
Deprecation path (check 3) is reviewed at PR time via the table in
`docs/personas.md`.

Domain inference: persona ids → content domain via `DOMAIN_MAP`,
mirroring `persona-governance.md § Per-domain cap`. Personas absent
from the map are cross-cutting (uncapped).

Exit codes:
  0  per-domain cap clean (citation warnings non-blocking)
  1  per-domain cap violated
"""
from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

QUIET = "--quiet" in sys.argv

REPO = Path(__file__).resolve().parents[2]
PERSONA_DIR = REPO / ".agent-src.uncondensed" / "personas"
SKILL_ROOTS: tuple[Path, ...] = (
    REPO / ".agent-src.uncondensed" / "skills",
    REPO / ".claude" / "skills",
)

# Per-domain cap — mirrors persona-governance.md § Per-domain cap.
# Maps persona id → content-domain bucket. Personas absent from this
# map are cross-cutting (uncapped) — typically singleton specialists
# without a domain peer (e.g. `qa`, `tech-writer`).
DOMAIN_MAP: dict[str, str] = {
    "hollywood-director": "ai-video",
    "ai-video-technical-director": "ai-video",
    "backend-architect": "backend",
    "eloquent-tamer": "backend",
    "cmo": "gtm",
    "revops": "gtm",
    "growth-pm": "growth",
    "customer-success-lead": "customer",
    "discovery-lead": "customer",
    "engineering-manager": "people",
    "people-strategist": "people",
    "finance-partner": "money",
    "strategist": "money",
}
PER_DOMAIN_CAP = 2


def emit(msg: str) -> None:
    if not QUIET:
        print(msg)


def parse_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    out: dict[str, str] = {}
    for line in text[3:end].splitlines():
        m = re.match(r"^([a-zA-Z_][\w-]*):\s*(.*)$", line)
        if m:
            out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return out


def collect_personas() -> list[tuple[str, str, str, Path]]:
    """Return (id, tier, status, path) for every persona file."""
    out: list[tuple[str, str, str, Path]] = []
    if not PERSONA_DIR.exists():
        return out
    for path in sorted(PERSONA_DIR.glob("*.md")):
        if path.stem == "README":
            continue
        fm = parse_frontmatter(path)
        pid = fm.get("id") or path.stem
        tier = fm.get("tier", "")
        status = fm.get("status", "active") or "active"
        out.append((pid, tier, status, path))
    return out


def citations_for(persona_id: str) -> list[Path]:
    pattern = re.compile(rf"(^|[\s,\[]){re.escape(persona_id)}([\s,\]]|$)")
    hits: list[Path] = []
    for root in SKILL_ROOTS:
        if not root.exists():
            continue
        for skill in root.rglob("SKILL.md"):
            text = skill.read_text(encoding="utf-8", errors="replace")
            if text.startswith("---"):
                end = text.find("\n---", 3)
                fm_block = text[3:end] if end != -1 else ""
            else:
                fm_block = ""
            if "personas:" not in fm_block:
                continue
            if pattern.search(fm_block):
                hits.append(skill)
    return hits


def main() -> int:
    personas = collect_personas()
    if not personas:
        emit("persona-governance: no persona files found — nothing to lint.")
        return 0

    by_domain: dict[str, list[str]] = defaultdict(list)
    missing_citations: list[str] = []

    for pid, tier, status, _ in personas:
        if status == "deprecated" or tier != "specialist":
            continue
        domain = DOMAIN_MAP.get(pid)
        if domain:
            by_domain[domain].append(pid)
        if not citations_for(pid):
            missing_citations.append(pid)

    overflows = {d: ids for d, ids in by_domain.items() if len(ids) > PER_DOMAIN_CAP}
    for d, ids in sorted(by_domain.items()):
        marker = "❌" if d in overflows else "✅"
        emit(f"{marker}  domain={d}  {len(ids)}/{PER_DOMAIN_CAP}  {', '.join(sorted(ids))}")
    for pid in sorted(missing_citations):
        emit(f"⚠️   no-skill-citation  {pid}  (warn — see PR-time gate)")

    if overflows:
        print("\npersona-governance: per-domain cap violated.", file=sys.stderr)
        for d, ids in sorted(overflows.items()):
            print(f"  - domain '{d}' has {len(ids)} specialists (cap {PER_DOMAIN_CAP}): {', '.join(sorted(ids))}", file=sys.stderr)
        return 1

    active = sum(1 for _, t, s, _ in personas if s != "deprecated" and t == "specialist")
    cited = active - len(missing_citations)
    emit(f"persona-governance: {active} active specialist persona(s) — all domains within cap; {cited}/{active} cited by ≥ 1 skill.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""F13 — README hero-count drift regression (Phase 0b.1, Surface 3).

Failure mode replayed: the README badge line ships pre-release counts
that disagree with what the package actually contains. Reviewer 1 cited
this as a recurring pre-1.16 incident — the README on `main` claimed
pre-1.15 numbers for two release cycles. The 1.16 follow-up roadmap
(F13 → 0b.1) requires a regression test so the next divergence fails
CI instead of shipping silently.

The hero badges in `README.md` (shields.io URLs near the top) must list:

    Skills-{S}- · Rules-{R}- · Commands-{C}- · Guidelines-{G}- ·
    Personas-{P}- · Advisors-{A}-

where the counts come from disk:

  * Skills      = `.agent-src.uncondensed/skills/*` directory count
  * Rules       = `.agent-src.uncondensed/rules/*.md` file count
  * Commands    = `.agent-src.uncondensed/commands/*.md` minus files
                  with frontmatter `deprecated_in:` (deprecation shims
                  are documented separately in AGENTS.md)
  * Guidelines  = `docs/guidelines/**/*.md` recursive count
  * Personas    = `.agent-src.uncondensed/personas/*.md` top-level
                  files, excluding `README.md` and `_template-*` scaffolds
                  (the `advisors/` subdirectory is counted separately)
  * Advisors    = `.agent-src.uncondensed/personas/advisors/*.md` count
                  — distinct class (Council Replace-mode personas, see
                  step-1-ai-council-cli-transport Phase 7)

AI-tool count is held constant at 8 (Augment, Claude, Cursor, Cline,
Windsurf, Gemini, Copilot, Claude.ai) — drift in that number requires
documentation work, not a count update.

Note: `AGENTS.md` previously carried the same skill/rule headline
numbers, but the Thin-Root refactor (2026-05-08, Phase 6) made
AGENTS.md a navigation surface only. Counts now live solely in
README.md and `docs/architecture.md`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib.agent_src import artefact_roots  # noqa: E402

ROOTS = artefact_roots()

# Hero badges are shields.io URLs of the form
# `https://img.shields.io/badge/<Label>-<N>-<hex>?style=flat-square`.
# Each label is matched independently so badge ordering may change
# without breaking the sentinel.
BADGE_RES = {
    "Skills": re.compile(r"/badge/Skills-(\d+)-"),
    "Rules": re.compile(r"/badge/Rules-(\d+)-"),
    "Commands": re.compile(r"/badge/Commands-(\d+)-"),
    "Guidelines": re.compile(r"/badge/Guidelines-(\d+)-"),
    "Personas": re.compile(r"/badge/Personas-(\d+)-"),
    "Advisors": re.compile(r"/badge/Advisors-(\d+)-"),
}


def _count_skills() -> int:
    total = 0
    for root in ROOTS:
        d = root / "skills"
        if d.is_dir():
            total += sum(1 for p in d.iterdir() if p.is_dir())
    return total


def _count_rules() -> int:
    return sum(
        1 for root in ROOTS for _ in (root / "rules").glob("*.md")
        if (root / "rules").is_dir()
    )


def _count_active_commands() -> int:
    total = 0
    deprecated = 0
    # Commands may be flat (`commands/<name>.md`) or nested under a cluster
    # directory (`commands/<cluster>/<sub>.md`). Walk recursively and skip the
    # AGENTS.md reference orchestrator that lives under .agent-src/commands/.
    for root in ROOTS:
        cmd_dir = root / "commands"
        if not cmd_dir.is_dir():
            continue
        for p in cmd_dir.rglob("*.md"):
            if p.name == "AGENTS.md":
                continue
            total += 1
            text = p.read_text(encoding="utf-8")
            if re.search(r"^deprecated_in:\s*", text, re.MULTILINE):
                deprecated += 1
    return total - deprecated


def _count_guidelines() -> int:
    return sum(1 for p in (REPO_ROOT / "docs" / "guidelines").rglob("*.md"))


def _count_personas() -> int:
    # Top-level .md files in personas/, excluding README.md and any
    # _template-* scaffold files. The advisors/ subdirectory is counted
    # separately by _count_advisors() — distinct class.
    total = 0
    for root in ROOTS:
        d = root / "personas"
        if not d.is_dir():
            continue
        total += sum(
            1
            for p in d.glob("*.md")
            if p.name != "README.md" and not p.name.startswith("_")
        )
    return total


def _count_advisors() -> int:
    total = 0
    for root in ROOTS:
        d = root / "personas" / "advisors"
        if d.is_dir():
            total += sum(1 for _ in d.glob("*.md"))
    return total


def test_readme_hero_counts_match_disk() -> None:
    readme = (REPO_ROOT / "README.md").read_text(encoding="utf-8")
    missing = [label for label, rx in BADGE_RES.items() if not rx.search(readme)]
    assert not missing, (
        "README.md is missing hero shields.io badge(s) for: "
        + ", ".join(missing)
        + " — expected `/badge/<Label>-<N>-<hex>?style=flat-square`."
    )
    claimed = {label: int(rx.search(readme).group(1)) for label, rx in BADGE_RES.items()}
    actual = {
        "Skills": _count_skills(),
        "Rules": _count_rules(),
        "Commands": _count_active_commands(),
        "Guidelines": _count_guidelines(),
        "Personas": _count_personas(),
        "Advisors": _count_advisors(),
    }
    drift = {k: (claimed[k], actual[k]) for k in claimed if claimed[k] != actual[k]}
    assert not drift, (
        "README.md hero counts drifted from disk reality:\n"
        + "\n".join(
            f"  {k}: README claims {c}, disk has {a} (Δ={a - c:+d})"
            for k, (c, a) in drift.items()
        )
        + "\n\nUpdate README.md (and AGENTS.md if needed) before merging."
    )


def test_agents_md_is_thin_root_navigation_surface() -> None:
    """AGENTS.md is a Thin-Root navigation surface — not a count source.

    Phase 6 of the road-to-augment-limit-fit roadmap removed the
    `skills/ (N skills)` / `rules/ (N rules)` headline lines from
    AGENTS.md to keep the file under the Thin-Root cap (≤ 2,800 chars).
    Counts now live in README.md and `docs/architecture.md`.

    This test guards against accidental re-introduction of count
    annotations that would inflate AGENTS.md back above the cap.
    """
    agents = (REPO_ROOT / "AGENTS.md").read_text(encoding="utf-8")
    assert not re.search(r"skills/\s*\(\d+ skills?\)", agents), (
        "AGENTS.md re-introduced `skills/ (N skills)` count annotation; "
        "Thin-Root contract forbids count display in AGENTS.md."
    )
    assert not re.search(r"rules/\s*\(\d+ rules?\)", agents), (
        "AGENTS.md re-introduced `rules/ (N rules)` count annotation; "
        "Thin-Root contract forbids count display in AGENTS.md."
    )


# --- Tier coverage drift sentinel (roadmap 6.5) ---
#
# Extend the README drift surface to cover the rule-tier classification.
# After Phase 2 (Tier-Bulk-Retrofit), every rule must declare a `tier:`
# frontmatter value from the locked set. `lint_rule_tiers.py` enforces
# this in the CI Taskfile pipeline; this test mirrors the assertion at
# the pytest layer so a stand-alone `pytest` run also fails on drift.
#
# Locked tier vocabulary lives in agents/settings/contexts/hardening-pattern.md
# and agents/settings/contexts/rule-trigger-matrix.md.
VALID_TIERS = frozenset({"1", "2a", "2b", "3", "safety-floor", "mechanical-already"})


def _rule_tier(path: Path) -> str | None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        if k.strip() == "tier":
            return v.strip().strip('"').strip("'")
    return None


def test_every_rule_declares_a_valid_tier() -> None:
    """Every rule must declare a `tier:` from the locked vocabulary.

    Drift sentinel: a new rule added without a tier (or with an unknown
    value) should fail this test the same way the CI Taskfile gate
    `lint-rule-tiers` does, even when the rest of the pipeline is skipped.
    """
    rules: list[Path] = []
    for root in ROOTS:
        d = root / "rules"
        if d.is_dir():
            rules.extend(sorted(d.glob("*.md")))
    rules.sort(key=lambda p: p.name)
    assert rules, "no rules found in any pack's rules/ directory"
    missing: list[str] = []
    invalid: list[tuple[str, str]] = []
    for rule in rules:
        tier = _rule_tier(rule)
        if tier is None:
            missing.append(rule.name)
        elif tier not in VALID_TIERS:
            invalid.append((rule.name, tier))
    drift_lines = [f"  missing tier: {n}" for n in missing] + [
        f"  invalid tier '{t}': {n}" for n, t in invalid
    ]
    assert not drift_lines, (
        "rule-tier coverage drifted (Phase 2 lock):\n"
        + "\n".join(drift_lines)
        + "\n\nDeclare `tier:` from "
        + ", ".join(sorted(VALID_TIERS))
        + " in the rule frontmatter."
    )

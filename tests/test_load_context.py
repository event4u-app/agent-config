"""Phase 1.1.1 / 0.4 contract regression — `load_context:` rollout floor.

Each policy rule that adopted `load_context:` must keep its
load-bearing obligation keywords on the combined (rule + context)
surface at or above the locked baseline. This is the 2A.4
obligation-keyword-diff acceptance branch (a) — `total_after >=
count_before_rule` — applied as a per-rule regression gate.

Baselines below were measured 2026-05-03 against the post-rollout
state on `feat/better-basement` (commits `0b93832` Phase 6.2 + `62d39ea`
Phase 7.4). A drop trips the test: either the rule lost an obligation
that should have moved to context, or the context lost one that
should have stayed.

Counting mode: `grep -coE` matching-line counts (markdown-line as the
read-comprehension load unit, per `agents/roadmaps/structural-
optimization-2A4-example.md` §4.1).

Run a single rule via `pytest tests/test_load_context.py -k
commit_policy -v`.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / ".agent-src.uncompressed"

# (rule_basename, mechanics_path_under_contexts/, iron_law_caps_phrase, baseline)
# baseline maps keyword -> minimum total matching-line count across rule + context.
CASES: list[tuple[str, str, str, dict[str, tuple[str, int]]]] = [
    (
        "commit-policy",
        "authority/commit-mechanics.md",
        "NEVER COMMIT",
        {
            "NEVER":      (r"\bNEVER\b", 3),
            "Iron Law":   (r"Iron Law", 2),
            "commit":     (r"\bcommit(s|ted|ting|ment|ments)?\b", 47),
        },
    ),
    (
        "scope-control",
        "authority/scope-mechanics.md",
        "USER FENCED OFF EXECUTION",  # `scope-control` has no single Iron Law;
        # the fenced-step caps block is the inline normative anchor.
        {
            "MUST":       (r"\bMUST\b", 2),
            "NEVER":      (r"\bNEVER\b", 5),
            "scope":      (r"\bscope(s|d)?\b", 10),
            "permission": (r"\bpermission(s)?\b", 8),
        },
    ),
    (
        "verify-before-complete",
        "execution/verification-mechanics.md",
        "NO COMPLETION CLAIMS",
        {
            "Iron Law":   (r"Iron Law", 3),
            "verify":     (r"\bverif(y|ied|ies|ication|ying)\b", 16),
            "complete":   (r"\bcomplet(e|es|ed|ing|ion|ions)\b", 9),
        },
    ),
    (
        "non-destructive-by-default",
        "authority/destructive-mechanics.md",
        "HARD FLOOR OVERRIDES EVERYTHING",
        {
            "Iron Law":    (r"Iron Law", 3),
            "Hard Floor":  (r"Hard Floor", 3),
            "destructive": (r"\bdestructiv(e|ely)\b", 7),
            "production":  (r"\bproduction\b", 2),
        },
    ),
]


def _frontmatter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    return yaml.safe_load(text[4:end]) or {} if end != -1 else {}


def _line_count(text: str, pattern: str) -> int:
    rx = re.compile(pattern)
    return sum(1 for ln in text.splitlines() if rx.search(ln))


@pytest.mark.parametrize(
    "rule,ctx_rel,iron_law_phrase,baseline",
    CASES,
    ids=[c[0].replace("-", "_") for c in CASES],
)
def test_rule_preserves_obligation_baseline(
    rule: str, ctx_rel: str, iron_law_phrase: str, baseline: dict[str, tuple[str, int]]
) -> None:
    rule_path = SRC_ROOT / "rules" / f"{rule}.md"
    ctx_path = SRC_ROOT / "contexts" / ctx_rel
    assert rule_path.exists(), f"rule not found: {rule_path}"
    assert ctx_path.exists(), f"mechanics context not found: {ctx_path}"

    fm = _frontmatter(rule_path)
    declared = [str(p) for p in (fm.get("load_context") or [])]
    expected_decl = f".agent-src.uncompressed/contexts/{ctx_rel}"
    assert expected_decl in declared, (
        f"{rule}: frontmatter load_context: must declare {expected_decl}; "
        f"got {declared}"
    )

    rule_text = rule_path.read_text(encoding="utf-8")
    assert iron_law_phrase in rule_text, (
        f"{rule}: Iron Law caps phrase {iron_law_phrase!r} must stay inline; "
        f"do not move it to {ctx_rel}"
    )

    ctx_text = ctx_path.read_text(encoding="utf-8")
    failures: list[str] = []
    for keyword, (pattern, floor) in baseline.items():
        total = _line_count(rule_text, pattern) + _line_count(ctx_text, pattern)
        if total < floor:
            failures.append(
                f"  {keyword!r}: total {total} < baseline floor {floor} "
                f"(pattern={pattern})"
            )
    assert not failures, (
        f"{rule}: obligation-keyword baseline regression "
        f"(2A.4 branch (a) violated):\n" + "\n".join(failures)
    )

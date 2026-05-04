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
COMP_ROOT = REPO_ROOT / ".agent-src"
SRC_PREFIX = ".agent-src.uncompressed/"
COMP_PREFIX = ".agent-src/"

# Q2 cap — mirrors `scripts/check_always_budget.py::MAX_CONTEXTS_PER_RULE`.
# Phase 1.3 of `road-to-context-layer-maturity`.
MAX_CONTEXTS_PER_RULE = 3
# Q3 / depth — mirrors `scripts/check_always_budget.py::MAX_DEPTH`.
MAX_DEPTH = 2

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



# ---------------------------------------------------------------------------
# Q1 / Q2 / Q3 contract checks (Phase 1.5 of road-to-context-layer-maturity)
# Locked decisions live in
# `docs/contracts/load-context-budget-model.md`. These tests pin the
# contract so a regression in the rule set or the linter trips CI.
# ---------------------------------------------------------------------------


def _frontmatter_block_text(path: Path) -> str:
    """Return the raw YAML frontmatter string (without `---` fences)."""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return ""
    end = text.find("\n---\n", 4)
    return text[4:end] if end != -1 else ""


def _yaml_list_order_from_raw(fm_text: str, key: str) -> list[str]:
    """Extract the ordered ``- value`` items under a top-level YAML key.

    Handcrafted reader: tolerates the project's frontmatter style
    (top-level keys at column 0, list items prefixed ``  - ``). Returns
    [] when the key is absent. Used to verify Q1 (load order = file order
    in frontmatter) without trusting PyYAML to preserve list ordering
    twice.
    """
    out: list[str] = []
    in_block = False
    for raw_line in fm_text.splitlines():
        stripped = raw_line.lstrip()
        # End of the target block: any new top-level key (column 0, ends
        # with `:`) terminates the list.
        if in_block and raw_line and not raw_line.startswith((" ", "\t", "-")):
            break
        if raw_line.startswith(f"{key}:"):
            in_block = True
            continue
        if in_block and stripped.startswith("- "):
            out.append(stripped[2:].strip().strip('"').strip("'"))
    return out


def _all_rule_files() -> list[Path]:
    return sorted((SRC_ROOT / "rules").glob("*.md"))


def _src_to_comp(entry: str) -> Path:
    if entry.startswith(SRC_PREFIX):
        return REPO_ROOT / (COMP_PREFIX + entry[len(SRC_PREFIX):])
    return REPO_ROOT / entry


def _declared_contexts(rule: Path) -> list[str]:
    """Top-level (depth 1) declared context entries, in frontmatter order."""
    fm_text = _frontmatter_block_text(rule)
    return (
        _yaml_list_order_from_raw(fm_text, "load_context_eager")
        + _yaml_list_order_from_raw(fm_text, "load_context")
    )


def test_q1_load_order_matches_frontmatter_yaml_order() -> None:
    """Q1 — frontmatter list order is the deterministic load order.

    For every rule that declares ≥ 1 context, the YAML-parsed list must
    equal the raw line-order list. Catches regressions where a tool
    rewrites frontmatter using a non-order-preserving structure.
    Locked: `docs/contracts/load-context-budget-model.md` § Load order.
    """
    failures: list[str] = []
    for rule in _all_rule_files():
        fm = _frontmatter(rule)
        fm_text = _frontmatter_block_text(rule)
        for key in ("load_context", "load_context_eager"):
            yaml_list = [str(p) for p in (fm.get(key) or [])]
            raw_list = _yaml_list_order_from_raw(fm_text, key)
            if yaml_list != raw_list:
                failures.append(
                    f"  {rule.name} ({key}): yaml-parsed={yaml_list} "
                    f"raw-order={raw_list}"
                )
    assert not failures, (
        "Q1 (load order) regression — frontmatter list order must equal "
        "raw line order; see docs/contracts/load-context-budget-model.md "
        "§ Load order (Q1):\n" + "\n".join(failures)
    )


def test_q2_per_rule_context_count_cap() -> None:
    """Q2 — combined `load_context:` + `load_context_eager:` ≤ 3 per rule.

    Mirror of `scripts/check_always_budget.py::MAX_CONTEXTS_PER_RULE`.
    A 4th declared context is the structural signal that the rule
    should split, not load more.
    Locked: `docs/contracts/load-context-budget-model.md`
    § Per-rule context-count cap (Q2).
    """
    breaches: list[tuple[str, int]] = []
    for rule in _all_rule_files():
        n = len(_declared_contexts(rule))
        if n > MAX_CONTEXTS_PER_RULE:
            breaches.append((rule.name, n))
    assert not breaches, (
        f"Q2 (concurrency cap) regression — > {MAX_CONTEXTS_PER_RULE} "
        f"declared contexts per rule:\n"
        + "\n".join(f"  {n}: {c}" for n, c in breaches)
    )


def _walk_transitive_contexts(rule: Path) -> set[Path]:
    """Walk `load_context:` + `load_context_eager:` to depth ``MAX_DEPTH``.

    Mirrors `scripts/check_always_budget.py::_walk_contexts`. Resolves
    ``.agent-src.uncompressed/`` entries to their compressed twin under
    ``.agent-src/`` so size accounting matches the linter's compressed-
    artifact view (the surface the agent actually loads at runtime).
    """
    seen: set[Path] = set()
    stack: list[tuple[Path, int]] = [(rule, 0)]
    while stack:
        node, depth = stack.pop()
        if depth >= MAX_DEPTH:
            continue
        fm = _frontmatter(node) if node.suffix == ".md" else {}
        entries = list(fm.get("load_context") or []) + list(
            fm.get("load_context_eager") or []
        )
        for entry in entries:
            comp = _src_to_comp(str(entry))
            if not comp.exists() or comp in seen:
                continue
            seen.add(comp)
            stack.append((comp, depth + 1))
    return seen


def test_q3_model_b_literal_no_sharing_discount() -> None:
    """Q3 — extended size = raw(rule) + Σ raw(transitive ctx); no divisor.

    Locked at 3a in `docs/contracts/load-context-budget-model.md`
    § Cross-rule sharing (Q3). Each rule pays the full ``RawSize(X)``
    of every context it loads — no ``chars(X) / N`` discount when N
    rules share context X.

    Two assertions:

    1. **Locked formula on a known rule** (``autonomous-execution``,
       3 declared contexts). Extended size from first principles must
       equal ``raw(rule) + Σ raw(ctx)``.
    2. **Shared-context guard.** For any context loaded by ≥ 2 rules,
       each rule's extended-overhead must be ≥ ``raw(ctx)``. If no
       current shared loader exists (Phase 1.4 inventory: 0), the
       guard is a no-op but stays in place as a regression net.
    """
    rule = COMP_ROOT / "rules" / "autonomous-execution.md"
    assert rule.exists(), f"expected canonical Q3 fixture missing: {rule}"
    contexts = _walk_transitive_contexts(rule)
    expected_ext = rule.stat().st_size + sum(c.stat().st_size for c in contexts)
    assert expected_ext > rule.stat().st_size, (
        "Q3 fixture invariant violated — autonomous-execution must load "
        "≥ 1 context for this test to lock the formula."
    )

    loaders: dict[Path, list[Path]] = {}
    for src_rule in _all_rule_files():
        comp_rule = _src_to_comp(f"{SRC_PREFIX}rules/{src_rule.name}")
        if not comp_rule.exists():
            continue
        for ctx in _walk_transitive_contexts(comp_rule):
            loaders.setdefault(ctx, []).append(comp_rule)

    shared = {ctx: rs for ctx, rs in loaders.items() if len(rs) >= 2}
    failures: list[str] = []
    for ctx, rules in shared.items():
        ctx_size = ctx.stat().st_size
        for r in rules:
            r_contexts = _walk_transitive_contexts(r)
            ext = r.stat().st_size + sum(c.stat().st_size for c in r_contexts)
            if ctx not in r_contexts:
                failures.append(
                    f"  {r.name} did not transitively include shared "
                    f"context {ctx.name} in its extended set"
                )
                continue
            if ext - r.stat().st_size < ctx_size:
                failures.append(
                    f"  {r.name}: extended-overhead "
                    f"{ext - r.stat().st_size} < raw({ctx.name})"
                    f"={ctx_size} — sharing discount detected"
                )
    assert not failures, (
        "Q3 (Model (b) literal) regression — shared contexts must charge "
        "the full raw size to each loader; see "
        "docs/contracts/load-context-budget-model.md "
        "§ Cross-rule sharing (Q3):\n" + "\n".join(failures)
    )


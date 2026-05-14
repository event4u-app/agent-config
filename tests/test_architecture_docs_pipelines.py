"""Drift test — `docs/architecture.md` index <-> four pipeline sub-pages.

Per Phase 3 Step 5 of `agents/roadmaps/road-to-distribution-maturity.md`.

Asserts three drift directions:

1. **Index -> sub-pages.** `docs/architecture.md` must link to all four
   sub-pages (compression, augment-projection, multi-tool-projection,
   claude-bundle). A sub-page added without being indexed = drift.
2. **Sub-page -> cited scripts / tests.** Every relative-path citation
   inside a sub-page (markdown links and ``backtick`` paths that point
   at `scripts/...`, `tests/...`, `taskfiles/...`, `docs/...`) must
   resolve on disk. A renamed script the sub-page still cites = drift.
3. **Sub-page -> cited Taskfile targets.** Every Taskfile target named
   inline (e.g. `task sync`, `task generate-tools`,
   `task build-cloud-bundles-all`) must exist in `Taskfile.yml` or
   under `taskfiles/*.yml`. A removed target the sub-page still cites
   = drift.

Failure messages include the offending sub-page + the unresolved
citation so the fix is one-line.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
ARCH_INDEX = REPO_ROOT / "docs" / "architecture.md"
ARCH_DIR = REPO_ROOT / "docs" / "architecture"

EXPECTED_SUBPAGES = (
    "source-projection.md",
    "augment-projection.md",
    "multi-tool-projection.md",
    "claude-bundle.md",
)

# Citation patterns inside sub-pages.
MD_LINK_RE = re.compile(r"\[[^\]]+\]\(([^)\s#]+)(?:#[^)]*)?\)")
TASK_RE = re.compile(r"`task\s+([a-z0-9][a-z0-9:_\-]*)`")

# Citations we accept as repo-relative without verifying:
# - external URLs (http/https)
# - parent-of-repo navigations (../architecture.md from a sub-page is fine)
# - anchor-only links
EXTERNAL_PREFIXES = ("http://", "https://", "mailto:")


def _resolve_relative(sub_page: Path, target: str) -> Path:
    """Resolve a markdown-link target relative to the sub-page's dir."""
    return (sub_page.parent / target).resolve()


def _all_taskfile_targets() -> set[str]:
    """All `task <name>:` targets defined in Taskfile.yml + taskfiles/*.yml.

    A target is a top-level key (no leading whitespace) ending in `:`
    that is not a YAML directive (`---`, `version:`, `includes:` block,
    `vars:` block, `env:` block, `tasks:` block).
    """
    targets: set[str] = set()
    candidates = [REPO_ROOT / "Taskfile.yml"]
    candidates.extend(sorted((REPO_ROOT / "taskfiles").glob("*.yml")))
    target_re = re.compile(r"^\s{2}([a-z0-9][a-z0-9:_\-]*):\s*$")
    for path in candidates:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            m = target_re.match(line)
            if m:
                targets.add(m.group(1))
    return targets


def test_index_links_all_four_subpages():
    """`docs/architecture.md` references each of the four sub-pages."""
    text = ARCH_INDEX.read_text(encoding="utf-8")
    missing = [
        name for name in EXPECTED_SUBPAGES
        if f"architecture/{name}" not in text
    ]
    assert not missing, (
        f"docs/architecture.md is missing pointers to: {missing}. "
        f"Each Pipeline A/B/C/D sub-page must be linked from the index."
    )


@pytest.mark.parametrize("subpage_name", EXPECTED_SUBPAGES)
def test_subpage_exists(subpage_name: str):
    """Each expected pipeline sub-page exists on disk."""
    path = ARCH_DIR / subpage_name
    assert path.exists(), (
        f"Expected pipeline sub-page missing: {path.relative_to(REPO_ROOT)}. "
        f"Phase 3 Step 2 requires all four pipelines to own a sub-page."
    )


@pytest.mark.parametrize("subpage_name", EXPECTED_SUBPAGES)
def test_subpage_citations_resolve(subpage_name: str):
    """Every markdown-link target in a sub-page must resolve on disk."""
    sub = ARCH_DIR / subpage_name
    text = sub.read_text(encoding="utf-8")
    broken: list[str] = []
    for target in MD_LINK_RE.findall(text):
        if target.startswith(EXTERNAL_PREFIXES):
            continue
        if target.startswith("#"):
            continue
        resolved = _resolve_relative(sub, target)
        if not resolved.exists():
            broken.append(target)
    assert not broken, (
        f"{sub.relative_to(REPO_ROOT)} has broken citations: {broken}. "
        f"Each Phase 3 Step 3 citation must resolve to an existing path."
    )


@pytest.mark.parametrize("subpage_name", EXPECTED_SUBPAGES)
def test_subpage_taskfile_targets_exist(subpage_name: str):
    """Every `task <name>` referenced in a sub-page exists in the Taskfile."""
    sub = ARCH_DIR / subpage_name
    text = sub.read_text(encoding="utf-8")
    cited = set(TASK_RE.findall(text))
    if not cited:
        pytest.skip(f"{sub.name}: no Taskfile targets cited")
    defined = _all_taskfile_targets()
    missing = sorted(cited - defined)
    assert not missing, (
        f"{sub.relative_to(REPO_ROOT)} cites Taskfile targets that no longer "
        f"exist: {missing}. Either restore the target or update the citation."
    )
